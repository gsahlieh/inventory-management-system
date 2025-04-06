// src/lib/api/users.ts
import { makeApiCall } from "@/utils/apiClient";

// Define interfaces for payload types
interface AssignRolePayload {
  role: string; // e.g., 'admin', 'manager', 'viewer'
}

// --- User & Role API Functions ---

export const getUsersAndRoles = async () => {
  return makeApiCall("/api/users", {
    method: "GET",
  });
};

export const assignUserRole = async (
  userId: string,
  roleData: AssignRolePayload
) => {
  if (!userId) throw new Error("User ID is required.");
  return makeApiCall(`/api/users/${userId}/role`, {
    method: "PUT",
    body: roleData,
  });
};
