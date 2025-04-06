// src/lib/api/reports.ts
import { makeApiCall } from "@/utils/apiClient";

// --- Report API Functions ---

export const getMonthlyInventoryReport = async () => {
  return makeApiCall("/api/reports/inventory/monthly", {
    method: "GET",
  });
};
