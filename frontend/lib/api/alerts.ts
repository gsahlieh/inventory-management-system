// src/lib/api/alerts.ts
import { makeApiCall } from "@/utils/apiClient";

// --- Alert API Functions ---

export const getLowStockAlerts = async () => {
  return makeApiCall("/api/alerts/low-stock", {
    method: "GET",
  });
};
