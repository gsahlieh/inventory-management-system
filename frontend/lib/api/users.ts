// src/lib/api/users.ts
import { makeApiCall } from "@/utils/apiClient";

// Define interfaces for payload types
interface AssignRolePayload {
  role: string; // e.g., 'admin', 'manager', 'viewer'
}

// --- User & Role API Functions ---

// Optional: Update if you need to pass token here too
export const getUsersAndRoles = async (authToken?: string) => {
  return makeApiCall("/api/users", {
    method: "GET",
    authToken, // Pass token
  });
};

// Modify getUserRole to accept and pass the token
export const getUserRole = async (userId: string, authToken?: string) => {
  if (!userId) throw new Error("User ID is required.");
  // Pass the authToken in the options object
  return makeApiCall(`/api/users/${userId}/role`, {
    method: "GET",
    authToken, // Pass token
  });
};

// Modify assignUserRole to accept and pass the token
export const assignUserRole = async (
  userId: string,
  roleData: AssignRolePayload,
  authToken?: string
) => {
  if (!userId) throw new Error("User ID is required.");
  // Pass the authToken in the options object
  return makeApiCall(`/api/users/${userId}/role`, {
    method: "PUT",
    body: roleData,
    authToken, // Pass token
  });
};
