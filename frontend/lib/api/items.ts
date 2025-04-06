// src/lib/api/items.ts
import { makeApiCall } from "@/utils/apiClient";

// Define interfaces for payload types (optional but recommended)
interface ItemPayload {
  name: string;
  quantity: number;
  price: number;
  category: string;
}

interface UpdateQuantityPayload {
  quantity: number;
}

// --- Item API Functions ---

export const addItem = async (itemData: ItemPayload) => {
  return makeApiCall("/api/items", {
    method: "POST",
    body: itemData,
  });
};

export const getAllItems = async () => {
  return makeApiCall("/api/items", {
    method: "GET",
  });
};

export const getItemById = async (itemId: string) => {
  if (!itemId) throw new Error("Item ID is required.");
  return makeApiCall(`/api/items/${itemId}`, {
    method: "GET",
  });
};

export const updateItem = async (itemId: string, itemData: ItemPayload) => {
  if (!itemId) throw new Error("Item ID is required.");
  return makeApiCall(`/api/items/${itemId}`, {
    method: "PUT",
    body: itemData,
  });
};

export const updateItemQuantity = async (
  itemId: string,
  quantityData: UpdateQuantityPayload
) => {
  if (!itemId) throw new Error("Item ID is required.");
  return makeApiCall(`/api/items/${itemId}/quantity`, {
    method: "PATCH",
    body: quantityData,
  });
};

export const deleteItem = async (itemId: string) => {
  if (!itemId) throw new Error("Item ID is required.");
  return makeApiCall(`/api/items/${itemId}`, {
    method: "DELETE",
  });
};

export const bulkUpdateQuantity = async (file: File) => {
  if (!file) throw new Error("CSV file is required.");
  const formData = new FormData();
  formData.append("file", file); // Ensure backend expects 'file'

  return makeApiCall("/api/items/bulk-update-quantity", {
    method: "POST",
    body: formData,
    isFormData: true,
  });
};
