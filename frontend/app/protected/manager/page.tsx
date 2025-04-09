// manager/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react"; // Ensured useMemo is imported
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  getAllItems,
  updateItemQuantity,
  bulkUpdateQuantity
} from "@/lib/api/items";
import { getLowStockAlerts } from "@/lib/api/alerts";
import { getItemTrends } from "@/lib/api/chart"; // Ensured getItemTrends is imported
import { getUserRole } from "@/lib/api/users";

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

export default function ManagerDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inventory");
  const [items, setItems] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState<any>(null);
  const [editingQuantity, setEditingQuantity] = useState<any>(null);
  const [newQuantity, setNewQuantity] = useState<number>(0);

  // --- Trend Chart State ---
  const [selectedItemForTrend, setSelectedItemForTrend] = useState<
    string | null
  >(null);
  const [trendData, setTrendData] = useState<any>(null);
  const [trendLoading, setTrendLoading] = useState(false); // Specific loading for trends

  useEffect(() => {
    const checkManager = async () => {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession();

      if (error || !session) {
        router.push("/sign-in");
        return;
      }

      try {
        // Fetch the user's role
        const roleData = await getUserRole(
          session.user.id,
          session.access_token
        );

        if (!roleData) {
          router.push("/protected");
          setLoading(false); // Set loading false before redirecting
          return; // Exit early
        }
        if (roleData.role !== "manager") {
          router.push("/protected");
          setLoading(false); // Set loading false before redirecting
        } else {
          await fetchItems(); // Wait for items to load before setting loading false
          setLoading(false); // Set loading false ONLY if manager check passes and initial data is loaded
        }
      } catch (err) {
        router.push("/protected");
        setLoading(false); // Ensure loading is set false even on unexpected errors
      }
    };

    checkManager();
  }, [router, supabase.auth]); // Added dependencies

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await getAllItems();
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const data = await getLowStockAlerts();
      setAlerts(data || []);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Reset specific loading states when changing tabs
    setTrendLoading(false);
    setSelectedItemForTrend(null); // Close trend modal if open

    if (tab === "inventory" && items.length === 0) fetchItems(); // Fetch only if not already loaded
    if (tab === "alerts" && alerts.length === 0) fetchAlerts();
    // No need to fetch for bulk tab
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setBulkUpdateStatus(null);
    }
  };

  const handleBulkUpdate = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      const result = await bulkUpdateQuantity(selectedFile);
      setBulkUpdateStatus(result);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Refresh items list
      fetchItems();
    } catch (error: any) {
      console.error("Error during bulk update:", error);
      setBulkUpdateStatus({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuantity = (item: any) => {
    setEditingQuantity(item);
    setNewQuantity(item.quantity);
  };

  const handleUpdateQuantity = async () => {
    if (!editingQuantity) return; // Add check
    try {
      await updateItemQuantity(editingQuantity.id, { quantity: newQuantity });
      setEditingQuantity(null);
      fetchItems(); // Refresh items after update
      // Also refresh alerts if the item was in the alerts list
      if (alerts.some((alert) => alert.id === editingQuantity.id)) {
        fetchAlerts();
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  // --- Trend Chart Handlers ---
  const handleViewTrends = async (itemId: string) => {
    try {
      setTrendLoading(true); // Use specific loading state
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
  ); // Empty dependency array means this object is created once

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
          borderColor: "rgb(75, 192, 192)", // Example color
          backgroundColor: "rgba(75, 192, 192, 0.5)" // Example color
        }
      ]
    };
  }, [trendData]); // Recalculate only when trendData changes

  // Main component loading state
  if (loading && !selectedItemForTrend) {
    // Show main loading only if not loading trends
    return (
      <div className="flex justify-center items-center min-h-64">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      {/* Header */}
      <div className="w-full">
        <div className="bg-accent text-sm p-4 rounded-md text-foreground">
          <h1 className="font-semibold text-xl mb-2">Manager Dashboard</h1>
          <p>
            As a manager, you can update inventory quantities, generate
            low-stock alerts, and upload bulk updates.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === "inventory" ? "default" : "outline"}
          onClick={() => handleTabChange("inventory")}
        >
          Manage Inventory
        </Button>
        <Button
          variant={activeTab === "alerts" ? "default" : "outline"}
          onClick={() => handleTabChange("alerts")}
        >
          Low Stock Alerts
        </Button>
        <Button
          variant={activeTab === "bulk" ? "default" : "outline"}
          onClick={() => handleTabChange("bulk")}
        >
          Bulk Update
        </Button>
      </div>

      {/* Inventory Management */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          <h2 className="text-lg font-medium">Update Inventory Quantities</h2>
          {loading && items.length === 0 ? (
            <p>Loading items...</p>
          ) : items.length === 0 ? (
            <p>No items found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                {/* Table Header */}
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
                {/* Table Body */}
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
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
                          onClick={() => handleEditQuantity(item)}
                        >
                          Update Quantity
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {/* Edit Quantity Modal */}
      {editingQuantity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background p-6 rounded-lg w-full max-w-md">
            <h2 className="text-lg font-medium mb-4">Update Quantity</h2>
            <p>Item: {editingQuantity.name}</p>
            <p>Current Quantity: {editingQuantity.quantity}</p>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                New Quantity
              </label>
              <Input
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(parseInt(e.target.value))}
                required
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingQuantity(null)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleUpdateQuantity}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Alerts */}
      {activeTab === "alerts" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Low Stock Alerts</h2>
            <Button onClick={() => fetchAlerts()}>Refresh Alerts</Button>
          </div>

          {loading && alerts.length === 0 ? (
            <p>Loading alerts...</p>
          ) : alerts.length === 0 ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-md">
              <p className="font-medium">No low stock alerts</p>
              <p className="text-sm">
                All items are above the low stock threshold
              </p>
            </div>
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
                      Current Quantity
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {alerts.map((item) => (
                    <tr key={item.id} className="">
                      <td className="px-3 py-4 whitespace-nowrap">
                        {item.name}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {item.category || "-"}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap font-medium text-red-600">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditQuantity(item)}
                        >
                          Update Quantity
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bulk Update */}
      {activeTab === "bulk" && (
        <div className="space-y-4">
          <div className="border p-4 rounded-md">
            <h2 className="text-lg font-medium mb-3">
              Bulk Update Quantities via CSV
            </h2>
            <p className="text-sm mb-4">
              Upload a CSV file with columns: <code>item_id</code> and{" "}
              <code>new_quantity</code>
            </p>

            <div className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-gray-600 file:text-white
                    hover:file:bg-gray-800"
                />
              </div>

              <Button onClick={handleBulkUpdate} disabled={!selectedFile}>
                Upload and Process
              </Button>

              {/* This pre tag remains dynamic for actual results */}
              {bulkUpdateStatus && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Upload Result:</h3>
                  <pre className="bg- border p-3 rounded-lg text-xs max-h-48 overflow-auto">
                    {JSON.stringify(bulkUpdateStatus, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* This pre tag is now hardcoded with multi-line example */}
            <div className="mt-6">
              <h3 className="font-medium mb-2">CSV Format Example:</h3>
              <pre className="border p-3 rounded-lg text-xs">
                {`item_id,new_quantity
c5531d6e-63fa-4c8b-989d-f8134968c588,50
71a5c67e-0d35-48dc-9dde-c98ec106aef3,25
a1b2c3d4-e5f6-7890-1234-abcdef123456,100
f0e9d8c7-b6a5-4321-fedc-ba9876543210,15
12345678-90ab-cdef-1234-567890abcdef,77`}
              </pre>
            </div>
          </div>
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
