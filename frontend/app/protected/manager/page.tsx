"use client";

import { useState, useEffect, useRef } from "react";
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
import { getItemTrends } from "@/lib/api/chart";
import { getUserRole } from "@/lib/api/users";

export default function ManagerDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');
  const [items, setItems] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState<any>(null);
  const [editingQuantity, setEditingQuantity] = useState<any>(null);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [selectedItemForTrend, setSelectedItemForTrend] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<any>(null);

  useEffect(() => {
    const checkManager = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.push("/sign-in");
        return;
      }

      try {
        // Fetch the user's role
        const roleData = await getUserRole(session.user.id, session.access_token);

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
          setLoading(false); // Set loading false ONLY if admin check passes and initial data is loaded
        }
      } catch (err) {
        router.push("/protected");
        setLoading(false); // Ensure loading is set false even on unexpected errors
      }
    };

    checkManager();
  }, []);

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
    if (tab === 'inventory') fetchItems();
    if (tab === 'alerts') fetchAlerts();
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
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    try {
      await updateItemQuantity(editingQuantity.id, { quantity: newQuantity });
      setEditingQuantity(null);
      fetchItems();
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  const handleViewTrends = async (itemId: string) => {
    try {
      setLoading(true);
      const data = await getItemTrends(itemId);
      setTrendData(data);
      setSelectedItemForTrend(itemId);
    } catch (error) {
      console.error("Error fetching trends:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-64">Loading...</div>;
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      <div className="w-full">
        <div className="bg-accent text-sm p-4 rounded-md text-foreground">
          <h1 className="font-semibold text-xl mb-2">Manager Dashboard</h1>
          <p>As a manager, you can update inventory quantities, generate low-stock alerts, and upload bulk updates.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'inventory' ? 'default' : 'outline'}
          onClick={() => handleTabChange('inventory')}
        >
          Inventory
        </Button>
        <Button
          variant={activeTab === 'alerts' ? 'default' : 'outline'}
          onClick={() => handleTabChange('alerts')}
        >
          Low Stock Alerts
        </Button>
        <Button
          variant={activeTab === 'bulk' ? 'default' : 'outline'}
          onClick={() => handleTabChange('bulk')}
        >
          Bulk Update
        </Button>
      </div>

      {/* Inventory Management */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <h2 className="text-lg font-medium">Update Inventory Quantities</h2>
          {items.length === 0 ? (
            <p>No items found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-4 whitespace-nowrap">{item.name}</td>
                      <td className="px-3 py-4 whitespace-nowrap">{item.category || '-'}</td>
                      <td className="px-3 py-4 whitespace-nowrap">{item.quantity}</td>
                      <td className="px-3 py-4 whitespace-nowrap">${item.price.toFixed(2)}</td>
                      <td className="px-3 py-4 whitespace-nowrap space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditQuantity(item)}>Update Quantity</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleViewTrends(item.id)}>View Trends</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  <label className="block text-sm font-medium mb-1">New Quantity</label>
                  <Input
                    type="number"
                    min="0"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(parseInt(e.target.value))}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button type="button" variant="outline" onClick={() => setEditingQuantity(null)}>Cancel</Button>
                  <Button type="button" onClick={handleUpdateQuantity}>Save Changes</Button>
                </div>
              </div>
            </div>
          )}

          {/* Trends Modal */}
          {selectedItemForTrend && trendData && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-background p-6 rounded-lg w-full max-w-3xl">
                <h2 className="text-lg font-medium mb-4">
                  Inventory Trends for {items.find(i => i.id === selectedItemForTrend)?.name}
                </h2>
                <div className="h-64 mb-4 bg-gray-100 rounded-lg flex items-center justify-center">
                  {/* This is where you would add a chart component */}
                  <p className="text-gray-600">
                    Trend data would be visualized here using a chart library like Chart.js
                  </p>
                </div>
                <div className="mt-4">
                  <p>Raw trend data:</p>
                  <pre className="bg-gray-100 p-3 rounded-lg text-xs max-h-32 overflow-auto">
                    {JSON.stringify(trendData, null, 2)}
                  </pre>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={() => setSelectedItemForTrend(null)}>Close</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Low Stock Alerts */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Low Stock Alerts</h2>
            <Button onClick={() => fetchAlerts()}>Refresh Alerts</Button>
          </div>

          {alerts.length === 0 ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-md">
              <p className="font-medium">No low stock alerts</p>
              <p className="text-sm">All items are above the low stock threshold</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Quantity</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {alerts.map((item) => (
                    <tr key={item.id} className="">
                      <td className="px-3 py-4 whitespace-nowrap">{item.name}</td>
                      <td className="px-3 py-4 whitespace-nowrap">{item.category || '-'}</td>
                      <td className="px-3 py-4 whitespace-nowrap font-medium text-red-600">{item.quantity}</td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => handleEditQuantity(item)}>Update Quantity</Button>
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
      {activeTab === 'bulk' && (
        <div className="space-y-4">
          <div className="border p-4 rounded-md">
            <h2 className="text-lg font-medium mb-3">Bulk Update Quantities via CSV</h2>
            <p className="text-sm mb-4">
              Upload a CSV file with columns: <code>item_id</code> and <code>new_quantity</code>
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
                    hover:file:bg-primary/90"
                />
              </div>

              <Button
                onClick={handleBulkUpdate}
                disabled={!selectedFile}
              >
                Upload and Process
              </Button>

              {bulkUpdateStatus && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Upload Result:</h3>
                  <pre className="bg-gray-100 p-3 rounded-lg text-xs max-h-48 overflow-auto">
                    {JSON.stringify(bulkUpdateStatus, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6">
              <h3 className="font-medium mb-2">CSV Format Example:</h3>
              <pre className="border p-3 rounded-lg text-xs">
                item_id,new_quantity
                c5531d6e-63fa-4c8b-989d-f8134968c588,50
                71a5c67e-0d35-48dc-9dde-c98ec106aef3,25
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