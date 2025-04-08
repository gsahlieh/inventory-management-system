// utils/apiClient.ts
import { createClient } from "@/utils/supabase/client"; // Keep for client-side fallback

interface ApiCallOptions {
  method: string;
  body?: any; // Can be JSON object or FormData
  isFormData?: boolean; // Flag for file uploads
  authToken?: string; // <-- Add optional auth token
}

export async function makeApiCall(endpoint: string, options: ApiCallOptions) {
  // Determine if running on the server or client
  const isServer = typeof window === "undefined";

  // Get the appropriate base URL
  const publicApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL; // For client
  const internalApiUrl = process.env.INTERNAL_API_BASE_URL; // For server

  console.log(
    "NEXT_PUBLIC_API_BASE_URL:",
    process.env.NEXT_PUBLIC_API_BASE_URL
  );
  console.log("INTERNAL_API_BASE_URL:", process.env.INTERNAL_API_BASE_URL);

  const baseUrl = isServer ? internalApiUrl : publicApiUrl;
  const urlVariableName = isServer
    ? "INTERNAL_API_BASE_URL"
    : "NEXT_PUBLIC_API_BASE_URL";

  // Check if the required base URL is configured
  if (!baseUrl) {
    console.error(`API base URL (${urlVariableName}) is not configured.`);
    throw new Error(`API base URL (${urlVariableName}) is not configured.`);
  }

  let token: string | null = options.authToken || null; // Prioritize passed token

  // If no token was passed AND we are on the client-side, try fetching via SDK
  // Server-side calls MUST have the token passed via options.authToken
  if (!token && !isServer) {
    console.log(
      "No auth token provided on client, attempting to fetch session via client SDK..."
    );
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Error getting session via client SDK:", sessionError);
      // Depending on your app's needs, you might allow calls without a session
      // or throw an error. Sticking with throwing for now.
      throw new Error(`Error getting session: ${sessionError.message}`);
    }
    if (session) {
      token = session.access_token;
      console.log("Fetched session token via client SDK.");
    }
    // If still no session client-side, we might proceed if the endpoint allows anonymous access,
    // or throw if auth is always required.
  }

  // If still no token after checks (especially crucial server-side), throw error.
  if (!token) {
    // You might want to allow certain public API endpoints, but for protected ones:
    console.error(
      "Authentication token could not be obtained. Ensure it's passed for server-side calls or a session exists client-side."
    );
    throw new Error("Authentication token could not be obtained.");
  }

  // 2. Prepare headers and body
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`, // Use the obtained token
  };

  if (options.isFormData) {
    // Don't set Content-Type for FormData; browser does it with boundary
  } else {
    // Only set Content-Type if there's a body and it's not FormData
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }
  }

  let bodyToSend: BodyInit | null = null;
  if (options.body) {
    bodyToSend = options.isFormData
      ? (options.body as FormData)
      : JSON.stringify(options.body);
  }

  // 3. Make fetch request (using the dynamically determined baseUrl)
  console.log(
    `Making API call (${isServer ? "server" : "client"}) to: ${baseUrl}${endpoint} with method ${options.method}`
  );
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: options.method,
    headers: headers,
    body: bodyToSend,
    // Keep cache: 'no-store' if you always want fresh data, especially for server components
    cache: "no-store",
  });

  // 4. Handle response (keep existing logic)
  const responseBody = await response.text(); // Read body once

  if (!response.ok) {
    let errorData: any = { message: `HTTP error ${response.status}` };
    try {
      const parsedJson = JSON.parse(responseBody);
      // Use a more specific error message from backend if available
      errorData.message =
        parsedJson?.error ||
        parsedJson?.message ||
        `HTTP error ${response.status}`;
      errorData.details = parsedJson;
    } catch (e) {
      // If parsing fails, use the raw text or default message
      errorData.message = responseBody || errorData.message;
      console.warn("Response body is not valid JSON:", responseBody);
    }
    console.error(
      `API Error (${response.status}) calling ${endpoint}: ${errorData.message}`,
      errorData.details || "" // Log details if available
    );

    // Throw specific errors based on status code
    if (response.status === 401) {
      throw new Error(
        `API call failed (401 Unauthorized): ${errorData.message}. Check token validity or API permissions.`
      );
    }
    if (response.status === 403) {
      throw new Error(
        `API call failed (403 Forbidden): ${errorData.message}. Check API permissions.`
      );
    }
    // Generic error for other statuses
    throw new Error(
      `API call failed (${response.status}): ${errorData.message}`
    );
  }

  // Attempt to parse JSON only if responseBody is not empty
  if (!responseBody) {
    return { success: true }; // Or null, or whatever indicates success without data
  }

  try {
    return JSON.parse(responseBody);
  } catch (e) {
    console.warn("Could not parse JSON response body:", responseBody);
    // Return the raw response if JSON parsing fails but status was OK
    return { success: true, rawResponse: responseBody };
  }
}
