// src/lib/api/audit.ts
import { makeApiCall } from "@/utils/apiClient";

// --- Audit Log API Functions ---

export const getAuditLogs = async () => {
  return makeApiCall("/api/audit-logs", {
    method: "GET",
  });
};
