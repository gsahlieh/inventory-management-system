// utils/apiClient.ts
import { createClient } from "@/utils/supabase/client"; // Keep for client-side fallback

interface ApiCallOptions {
  method: string;
  body?: any; // Can be JSON object or FormData
  isFormData?: boolean; // Flag for file uploads
  authToken?: string; // <-- Add optional auth token
}

export async function makeApiCall(endpoint: string, options: ApiCallOptions) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiUrl) {
    throw new Error(
      "API base URL is not configured (NEXT_PUBLIC_API_BASE_URL)."
    );
  }

  let token: string | null = null;

  // 1. Get token: Prioritize provided token, otherwise fetch using client SDK
  if (options.authToken) {
    token = options.authToken;
    console.log("Using provided auth token for API call.");
  } else {
    console.log(
      "No auth token provided, attempting to fetch session via client SDK..."
    );
    // This branch will primarily be used if makeApiCall is ever called from client-side code
    const supabase = createClient(); // Use client for session fetching if no token given
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      // Log the specific session error for better debugging
      console.error("Error getting session via client SDK:", sessionError);
      throw new Error(`Error getting session: ${sessionError.message}`);
    }
    if (!session) {
      console.error("No active session found via client SDK.");
      throw new Error("You must be logged in.");
    }
    token = session.access_token;
    console.log("Fetched session token via client SDK.");
  }

  if (!token) {
    // This should theoretically not be reached if the logic above is sound
    throw new Error("Authentication token could not be obtained.");
  }

  // 2. Prepare headers and body
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`, // Use the obtained token
  };

  if (options.isFormData) {
    // Don't set Content-Type for FormData
  } else {
    headers["Content-Type"] = "application/json";
  }

  let bodyToSend: BodyInit | null = null;
  if (options.body) {
    bodyToSend = options.isFormData
      ? (options.body as FormData)
      : JSON.stringify(options.body);
  }

  // 3. Make fetch request
  console.log(
    `Making API call to: ${apiUrl}${endpoint} with method ${options.method}`
  );
  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: options.method,
    headers: headers,
    body: bodyToSend,
    // Important for server components: prevent Next.js from caching fetch results inappropriately
    // if your API calls should always be fresh based on the user's current state.
    // Use 'no-store' if the data changes frequently and shouldn't be cached.
    // Use 'force-cache' or remove this line if caching is desired (default).
    cache: "no-store",
  });

  // 4. Handle response (keep existing logic)
  const responseBody = await response.text();

  if (!response.ok) {
    let errorData: any = { message: `HTTP error ${response.status}` };
    try {
      const parsedJson = JSON.parse(responseBody);
      errorData.message = parsedJson?.error || `HTTP error ${response.status}`;
      errorData.details = parsedJson;
    } catch (e) {
      errorData.message = responseBody || errorData.message;
      console.warn("Response body is not valid JSON:", responseBody);
    }
    console.error(
      `API Error (${response.status}) calling ${endpoint}: ${errorData.message}`,
      errorData.details
    );
    // Make error more specific if possible
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
    throw new Error(
      `API call failed (${response.status}): ${errorData.message}`
    );
  }

  try {
    return responseBody ? JSON.parse(responseBody) : { success: true };
  } catch (e) {
    console.warn("Could not parse JSON response body:", responseBody);
    return { success: true, rawResponse: responseBody };
  }
}
