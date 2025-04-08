// viewer/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react"; // Added useMemo
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { getAllItems, getItemById } from "@/lib/api/items";
import { getItemTrends } from "@/lib/api/chart"; // Added getItemTrends import

// Import Chart.js components and Line chart type
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

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
  const [selectedItem, setSelectedItem] = useState<any>(null); // For details modal

  // --- Trend Chart State ---
  const [selectedItemForTrend, setSelectedItemForTrend] = useState<
    string | null
  >(null);
  const [trendData, setTrendData] = useState<any>(null);
  const [trendLoading, setTrendLoading] = useState(false); // Specific loading for trends

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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Reset specific loading states when changing tabs
    setTrendLoading(false);
    setSelectedItemForTrend(null); // Close trend modal if open
    setSelectedItem(null); // Close details modal if open

    // Only need to handle inventory tab explicitly if needed,
    // but fetchItems is already called on initial load.
    // If you want to re-fetch on tab click:
    // if (tab === 'inventory' && items.length === 0) fetchItems();
  };

  const handleViewDetails = async (itemId: string) => {
    try {
      // Optionally add loading state for details view
      setSelectedItemForTrend(null); // Close trends if open
      const item = await getItemById(itemId);
      setSelectedItem(item);
    } catch (error) {
      console.error("Error fetching item details:", error);
      setSelectedItem(null); // Clear selection on error
    }
  };

  // --- Trend Chart Handlers ---
  const handleViewTrends = async (itemId: string) => {
    try {
      setTrendLoading(true); // Use specific loading state
      setSelectedItem(null); // Close details if open
      setSelectedItemForTrend(itemId);
      setTrendData(null); // Clear previous data
      const data = await getItemTrends(itemId);
      // Format timestamps for better readability
      const formattedData = {
        ...data,
        labels: data.labels.map((ts: string) =>
          new Date(ts).toLocaleDateString()
        )
      };
      setTrendData(formattedData);
    } catch (error) {
      console.error("Error fetching trends:", error);
      setTrendData(null); // Ensure data is null on error
    } finally {
      setTrendLoading(false);
    }
  };

  const handleCloseTrendModal = () => {
    setSelectedItemForTrend(null);
    setTrendData(null);
  };

  // --- Chart Configuration ---
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false, // Allow chart to fill container height
      plugins: {
        legend: {
          position: "top" as const
        },
        title: {
          display: true,
          text: "Quantity Over Time"
        }
      },
      scales: {
        y: {
          beginAtZero: true // Start y-axis at 0
        }
      }
    }),
    []
  );

  const chartData = useMemo(() => {
    if (!trendData || !trendData.labels || !trendData.quantities) {
      return { labels: [], datasets: [] }; // Return empty structure if no data
    }
    return {
      labels: trendData.labels,
      datasets: [
        {
          label: "Quantity",
          data: trendData.quantities,
          borderColor: "rgb(153, 102, 255)", // Example color (purple)
          backgroundColor: "rgba(153, 102, 255, 0.5)" // Example color (purple)
        }
      ]
    };
  }, [trendData]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterCategory("");
  };

  if (loading && activeTab === "inventory" && !selectedItemForTrend) {
    // Show loading only when fetching initial items and not viewing trends
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
          <p>Browse and search inventory items, view details, and trends.</p>{" "}
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
            {loading && items.length === 0 ? (
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
                        <td className="px-3 py-4 whitespace-nowrap space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleViewTrends(item.id)}
                            disabled={
                              trendLoading && selectedItemForTrend === item.id
                            } // Disable button while loading its trend
                          >
                            {trendLoading && selectedItemForTrend === item.id
                              ? "Loading..."
                              : "Trends"}
                          </Button>
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

          {/* --- Trends Modal --- */}
          {selectedItemForTrend && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-background p-6 rounded-lg w-full max-w-3xl shadow-lg">
                <h2 className="text-lg font-medium mb-4">
                  Inventory Trends for{" "}
                  {items.find((i) => i.id === selectedItemForTrend)?.name ||
                    "Item"}
                </h2>
                {/* Chart Area */}
                <div className="relative h-64 mb-4 border rounded-lg p-2">
                  {trendLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background bg-opacity-80">
                      Loading Chart Data...
                    </div>
                  ) : trendData &&
                    chartData.labels &&
                    chartData.labels.length > 0 ? (
                    <Line options={chartOptions} data={chartData} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No trend data available for this item.
                    </div>
                  )}
                </div>
                {/* Optional: Raw Data Display */}
                {trendData && !trendLoading && (
                  <div className="mt-4">
                    <p className="text-sm font-medium">Raw Trend Data:</p>
                    <pre className="border p-3 rounded-lg text-xs max-h-32 overflow-auto bg-muted">
                      {JSON.stringify(trendData, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="flex justify-end mt-6">
                  <Button variant="outline" onClick={handleCloseTrendModal}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
          {/* --- End Trends Modal --- */}
        </div>
      )}

      <div className="mt-4">
        <Link href="/protected">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
