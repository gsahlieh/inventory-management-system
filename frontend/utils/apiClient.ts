// utils/apiClient.ts
import { createClient } from "@/utils/supabase/client";

interface ApiCallOptions {
  method: string;
  body?: any; // Can be JSON object or FormData
  isFormData?: boolean; // Flag for file uploads
}

export async function makeApiCall(endpoint: string, options: ApiCallOptions) {
  const supabase = createClient();
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiUrl) {
    throw new Error(
      "API base URL is not configured (NEXT_PUBLIC_API_BASE_URL)."
    );
  }

  // 1. Get token
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`Error getting session: ${sessionError.message}`);
  }
  if (!session) {
    throw new Error("You must be logged in.");
  }
  const token = session.access_token;

  // 2. Prepare headers and body
  const headers: HeadersInit = {};
  if (options.isFormData) {
    // Don't set Content-Type for FormData, browser does it with boundary
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["Content-Type"] = "application/json";
    headers["Authorization"] = `Bearer ${token}`;
  }

  let bodyToSend: BodyInit | null = null;
  if (options.body) {
    bodyToSend = options.isFormData
      ? (options.body as FormData)
      : JSON.stringify(options.body);
  }

  // 3. Make fetch request
  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: options.method,
    headers: headers,
    body: bodyToSend,
  });

  // 4. Handle response
  const responseBody = await response.text(); // Read as text first

  if (!response.ok) {
    let errorData: any = { message: `HTTP error ${response.status}` };
    try {
      const parsedJson = JSON.parse(responseBody);
      // Use the 'error' field from Flask's JSON response if available
      errorData.message = parsedJson?.error || `HTTP error ${response.status}`;
      errorData.details = parsedJson; // Include full details
    } catch (e) {
      // If parsing fails, use the raw text (or default message)
      errorData.message = responseBody || errorData.message;
      console.warn("Response body is not valid JSON:", responseBody);
    }
    console.error(
      `API Error (${response.status}): ${errorData.message}`,
      errorData.details
    );
    throw new Error(
      `API call failed (${response.status}): ${errorData.message}`
    );
  }

  // Attempt to parse JSON if response is OK and body exists
  try {
    return responseBody ? JSON.parse(responseBody) : { success: true }; // Return success object for empty OK responses
  } catch (e) {
    console.warn("Could not parse JSON response body:", responseBody);
    return { success: true, rawResponse: responseBody }; // Return raw response if parsing fails but status was OK
  }
}
