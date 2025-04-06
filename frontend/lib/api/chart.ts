// src/lib/api/chart.ts
import { makeApiCall } from "@/utils/apiClient";

// --- Chart API Functions ---

export const getItemTrends = async (itemId: string) => {
  if (!itemId) throw new Error("Item ID is required.");
  return makeApiCall(`/api/items/${itemId}/trends`, {
    method: "GET",
  });
};