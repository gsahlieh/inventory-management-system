"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { getAllItems, getItemById } from "@/lib/api/items";
// Removed: import { getMonthlyInventoryReport } from "@/lib/api/reports";

export default function ViewerDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inventory"); // Default to inventory
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  // Removed: const [report, setReport] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession();

      if (error || !session) {
        router.push("/sign-in");
        return;
      }

      // We don't need to check the role for viewers since everyone can view
      fetchItems(); // Fetch items on initial load
      setLoading(false);
    };

    checkUser();
  }, [router, supabase]); // Added dependencies

  useEffect(() => {
    if (items.length > 0) {
      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(items.map((item) => item.category).filter(Boolean))
      );
      setCategories(uniqueCategories as string[]);

      // Apply filters
      let filtered = [...items];

      // Apply search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter((item) =>
          item.name.toLowerCase().includes(term)
        );
      }

      // Apply category filter
      if (filterCategory) {
        filtered = filtered.filter((item) => item.category === filterCategory);
      }

      setFilteredItems(filtered);
    } else {
      setFilteredItems([]); // Ensure filteredItems is empty if items is empty
      setCategories([]); // Ensure categories is empty if items is empty
    }
  }, [items, searchTerm, filterCategory]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await getAllItems();
      setItems(data || []);
      // No need to setFilteredItems here, the useEffect handles it
    } catch (error) {
      console.error("Error fetching items:", error);
      setItems([]); // Set to empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Removed: fetchReport function

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Only need to handle inventory tab explicitly if needed,
    // but fetchItems is already called on initial load.
    // If you want to re-fetch on tab click:
    // if (tab === 'inventory') fetchItems();
  };

  const handleViewDetails = async (itemId: string) => {
    try {
      // Optionally add loading state for details view
      const item = await getItemById(itemId);
      setSelectedItem(item);
    } catch (error) {
      console.error("Error fetching item details:", error);
      setSelectedItem(null); // Clear selection on error
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterCategory("");
  };

  if (loading && activeTab === "inventory") {
    // Show loading only when fetching initial items
    return (
      <div className="flex justify-center items-center min-h-64">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      <div className="w-full">
        <div className="bg-accent text-sm p-4 rounded-md text-foreground">
          <h1 className="font-semibold text-xl mb-2">Inventory Viewer</h1>
          <p>Browse and search inventory items and view details.</p>{" "}
          {/* Updated description */}
        </div>
      </div>

      {/* --- Updated Tab List (Only Inventory) --- */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === "inventory" ? "default" : "outline"}
          onClick={() => handleTabChange("inventory")}
        >
          Browse Inventory
        </Button>
        {/* Removed Report Button */}
      </div>

      {/* Inventory Browser */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="space-y-4 border p-4 rounded-md">
            <h2 className="text-lg font-medium">Search and Filter</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Search by Name
                </label>
                <Input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Filter by Category
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  disabled={categories.length === 0} // Disable if no categories
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>

          {/* Items List */}
          <div>
            <h2 className="text-lg font-medium mb-3">Inventory Items</h2>
            {loading ? (
              <p>Loading items...</p> // Show loading text while items are being fetched initially
            ) : filteredItems.length === 0 ? (
              <p>
                {items.length === 0
                  ? "No inventory items available."
                  : "No items found matching the filters."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-4 whitespace-nowrap">
                          {item.name}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          {item.category || "-"}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          ${item.price.toFixed(2)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(item.id)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Item Details Modal */}
          {selectedItem && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-background p-6 rounded-lg w-full max-w-lg shadow-lg">
                <h2 className="text-lg font-medium mb-4">Item Details</h2>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Name</p>
                      <p>{selectedItem.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Category
                      </p>
                      <p>{selectedItem.category || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Quantity
                      </p>
                      <p>{selectedItem.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Price
                      </p>
                      <p>${selectedItem.price.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Total Value
                      </p>
                      <p>
                        ${(selectedItem.quantity * selectedItem.price).toFixed(
                          2
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Item ID
                      </p>
                      <p className="text-xs">{selectedItem.id}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <Button variant="outline" onClick={() => setSelectedItem(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Removed Inventory Report Section */}

      <div className="mt-4">
        <Link href="/protected">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
