"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  addItem,
  deleteItem,
  getAllItems,
  updateItem
} from "@/lib/api/items";
import { getUsersAndRoles, assignUserRole, getUserRole } from "@/lib/api/users";
import { getAuditLogs } from "@/lib/api/audit";
import { getItemTrends } from "@/lib/api/chart";
import { getMonthlyInventoryReport } from "@/lib/api/reports";

// --- PDF Generation Imports ---
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// --- End PDF Generation Imports ---

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

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("items");
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false); // <-- State for PDF generation status

  // Form states
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: 0,
    price: 0,
    category: ""
  });

  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingRole, setEditingRole] = useState("");

  // Trend Chart State
  const [selectedItemForTrend, setSelectedItemForTrend] = useState<
    string | null
  >(null);
  const [trendData, setTrendData] = useState<any>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.push("/sign-in");
        return;
      }

      try {
        const roleData = await getUserRole(
          session.user.id,
          session.access_token
        );

        if (!roleData || roleData.role !== "admin") {
          router.push("/protected");
        } else {
          await fetchItems(); // Fetch initial data if admin
        }
      } catch (err) {
        console.error("Error checking admin role:", err);
        router.push("/protected");
      } finally {
        setLoading(false); // Ensure loading is set to false after checks
      }
    };

    checkAdmin();
  }, [router, supabase]);

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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsersAndRoles();
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const data = await getAuditLogs();
      setAuditLogs(data?.data || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async () => {
    try {
      setReportLoading(true);
      setReport(null); // Clear previous report
      const data = await getMonthlyInventoryReport();
      setReport(data);
    } catch (error) {
      console.error("Error fetching report:", error);
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Reset specific loading states when changing tabs
    setTrendLoading(false);
    setReportLoading(false);
    setPdfGenerating(false);
    setSelectedItemForTrend(null); // Close trend modal if open

    // Fetch data for the selected tab
    if (tab === "items" && items.length === 0) fetchItems(); // Fetch only if not already loaded
    if (tab === "users" && users.length === 0) fetchUsers();
    if (tab === "audit" && auditLogs.length === 0) fetchAuditLogs();
    if (tab === "report" && !report) fetchReport(); // Fetch report only if not already loaded
  };

  // --- Form Handlers (Keep existing handlers: handleNewItemChange, handleAddItem, etc.) ---
  const handleNewItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewItem((prev) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "price" ? parseFloat(value) : value
    }));
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addItem(newItem);
      setNewItem({ name: "", quantity: 0, price: 0, category: "" });
      fetchItems(); // Refresh items list
    } catch (error) {
      console.error("Error adding item:", error);
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
  };

  const handleEditItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingItem((prev: any) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "price" ? parseFloat(value) : value
    }));
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await updateItem(editingItem.id, editingItem);
      setEditingItem(null);
      fetchItems(); // Refresh items list
    } catch (error) {
      console.error("Error updating item:", error);
    }
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await deleteItem(itemToDelete.id);
      fetchItems(); // Refresh items list
    } catch (error) {
      console.error("Error deleting item:", error);
    } finally {
      setItemToDelete(null);
    }
  };

  const promptDeleteItem = (item: any) => {
    setItemToDelete(item);
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setEditingRole(user.role);
  };

  const handleUpdateUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await assignUserRole(editingUser.user_id, { role: editingRole });
      setEditingUser(null);
      fetchUsers(); // Refresh users list
    } catch (error) {
      console.error("Error updating user role:", error);
    }
  };

  // --- Trend Chart Handlers (Keep existing handlers) ---
  const handleViewTrends = async (itemId: string) => {
    try {
      setTrendLoading(true);
      setSelectedItemForTrend(itemId);
      setTrendData(null);
      const data = await getItemTrends(itemId);
      const formattedData = {
        ...data,
        labels: data.labels.map((ts: string) =>
          new Date(ts).toLocaleDateString()
        )
      };
      setTrendData(formattedData);
    } catch (error) {
      console.error("Error fetching trends:", error);
      setTrendData(null);
    } finally {
      setTrendLoading(false);
    }
  };

  const handleCloseTrendModal = () => {
    setSelectedItemForTrend(null);
    setTrendData(null);
  };

  // --- Chart Configuration (Keep existing useMemo hooks) ---
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" as const },
        title: { display: true, text: "Quantity Over Time" }
      },
      scales: { y: { beginAtZero: true } }
    }),
    []
  );

  const chartData = useMemo(() => {
    if (!trendData || !trendData.labels || !trendData.quantities) {
      return { labels: [], datasets: [] };
    }
    return {
      labels: trendData.labels,
      datasets: [
        {
          label: "Quantity",
          data: trendData.quantities,
          borderColor: "rgb(54, 162, 235)",
          backgroundColor: "rgba(54, 162, 235, 0.5)"
        }
      ]
    };
  }, [trendData]);

  // --- PDF Download Handler ---
  const handleDownloadReportPDF = async () => {
    if (!report || !report.inventory_snapshot) {
      console.error("Report data is not available for PDF generation.");
      // Optionally show a user-friendly message here
      return;
    }

    setPdfGenerating(true); // Indicate PDF generation start

    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.height;
      let startY = 20; // Initial Y position for text

      // Title
      doc.setFontSize(18);
      doc.text("Monthly Inventory Report", 14, startY);
      startY += 10;

      // Report Metadata
      doc.setFontSize(10);
      doc.text(`Report Period: ${report.report_month}`, 14, startY);
      startY += 6;
      doc.text(
        `Generated: ${new Date(report.generated_at).toLocaleString()}`,
        14,
        startY
      );
      startY += 10; // Add space before summary

      // Summary Statistics
      doc.setFontSize(12);
      doc.text("Summary", 14, startY);
      startY += 7;
      doc.setFontSize(10);
      doc.text(
        `Total Inventory Value: $${report.total_inventory_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        14,
        startY
      );
      startY += 6;
      doc.text(
        `Total Units: ${report.total_units.toLocaleString()}`,
        14,
        startY
      );
      startY += 6;
      doc.text(
        `Distinct Items: ${report.total_distinct_items.toLocaleString()}`,
        14,
        startY
      );
      startY += 12; // Add more space before the table

      // Table Header
      const head = [
        [
          "Name",
          "Category",
          "Quantity",
          "Price ($)",
          "Total Value ($)"
        ]
      ];

      // Table Body
      const body = report.inventory_snapshot.map((item: any) => [
        item.name,
        item.category || "-",
        item.quantity.toLocaleString(),
        item.price.toFixed(2),
        (item.quantity * item.price).toFixed(2)
      ]);

      // Add Table using autoTable
      autoTable(doc, {
        head: head,
        body: body,
        startY: startY, // Start table below the text
        theme: "grid", // Optional: adds grid lines
        headStyles: { fillColor: [22, 160, 133] }, // Optional: header color
        didDrawPage: (data) => {
          // Optional: Footer on each page
          // doc.setFontSize(10);
          // doc.text('Page ' + doc.internal.pages.length, data.settings.margin.left, pageHeight - 10);
        }
      });

      // Save the PDF
      const fileName = `inventory-report-${report.report_month.replace(/ /g, "_")}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      // Optionally show a user-friendly error message
    } finally {
      setPdfGenerating(false); // Indicate PDF generation end
    }
  };
  // --- End PDF Download Handler ---

  // Main component loading state
  if (loading && !selectedItemForTrend && !reportLoading && !pdfGenerating) {
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
          <h1 className="font-semibold text-xl mb-2">Admin Dashboard</h1>
          <p>
            As an admin, you can manage inventory items, user roles, view audit
            logs, and access inventory reports.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2 flex-wrap">
        <Button
          variant={activeTab === "items" ? "default" : "outline"}
          onClick={() => handleTabChange("items")}
        >
          Manage Items
        </Button>
        <Button
          variant={activeTab === "users" ? "default" : "outline"}
          onClick={() => handleTabChange("users")}
        >
          Manage Users
        </Button>
        <Button
          variant={activeTab === "audit" ? "default" : "outline"}
          onClick={() => handleTabChange("audit")}
        >
          Audit Logs
        </Button>
        <Button
          variant={activeTab === "report" ? "default" : "outline"}
          onClick={() => handleTabChange("report")}
        >
          Inventory Report
        </Button>
      </div>

      {/* --- Tab Content --- */}

      {/* Items Management */}
      {activeTab === "items" && (
        <div className="space-y-6">
          {/* Add New Item Form */}
          <div className="border p-4 rounded-md">
            <h2 className="text-lg font-medium mb-3">Add New Item</h2>
            <form
              onSubmit={handleAddItem}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* Input fields... */}
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  name="name"
                  value={newItem.name}
                  onChange={handleNewItemChange}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <Input
                  name="category"
                  value={newItem.category}
                  onChange={handleNewItemChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Quantity
                </label>
                <Input
                  name="quantity"
                  type="number"
                  min="0"
                  value={newItem.quantity}
                  onChange={handleNewItemChange}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price</label>
                <Input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItem.price}
                  onChange={handleNewItemChange}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Add Item</Button>
              </div>
            </form>
          </div>

          {/* Items List */}
          <div>
            <h2 className="text-lg font-medium mb-3">Inventory Items</h2>
            {loading && items.length === 0 ? (
              <p>Loading items...</p>
            ) : items.length === 0 ? (
              <p>No items found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-300">
                  {/* Table Head */}
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
                            }
                          >
                            {trendLoading && selectedItemForTrend === item.id
                              ? "Loading..."
                              : "Trends"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditItem(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => promptDeleteItem(item)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Trends Modal */}
          {selectedItemForTrend && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-background p-6 rounded-lg w-full max-w-3xl shadow-lg">
                <h2 className="text-lg font-medium mb-4">
                  Inventory Trends for{" "}
                  {items.find((i) => i.id === selectedItemForTrend)?.name ||
                    "Item"}
                </h2>
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

          {/* Edit Item Modal */}
          {editingItem && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-background p-6 rounded-lg w-full max-w-md shadow-lg">
                <h2 className="text-lg font-medium mb-4">Edit Item</h2>
                <form onSubmit={handleUpdateItem} className="space-y-4">
                  {/* Form fields... */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Name
                    </label>
                    <Input
                      name="name"
                      value={editingItem.name}
                      onChange={handleEditItemChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Category
                    </label>
                    <Input
                      name="category"
                      value={editingItem.category || ""}
                      onChange={handleEditItemChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Quantity
                    </label>
                    <Input
                      name="quantity"
                      type="number"
                      min="0"
                      value={editingItem.quantity}
                      onChange={handleEditItemChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Price
                    </label>
                    <Input
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingItem.price}
                      onChange={handleEditItemChange}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingItem(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          {itemToDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-background p-6 rounded-lg w-full max-w-md shadow-lg">
                <h2 className="text-lg font-medium mb-4">Confirm Deletion</h2>
                <p className="mb-6">
                  Are you sure you want to delete the item "
                  {itemToDelete.name}"? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setItemToDelete(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={confirmDeleteItem}
                  >
                    Confirm Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users Management */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <h2 className="text-lg font-medium">User Role Management</h2>
          {loading && users.length === 0 ? (
            <p>Loading users...</p>
          ) : users.length === 0 ? (
            <p>No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                {/* Table Head */}
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User ID
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                {/* Table Body */}
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.user_id}>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {user.email}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">
                        {user.user_id}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap uppercase font-medium">
                        {user.role}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditUser(user)}
                        >
                          Change Role
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Edit User Role Modal */}
          {editingUser && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-background p-6 rounded-lg w-full max-w-md shadow-lg">
                <h2 className="text-lg font-medium mb-4">Change User Role</h2>
                <p>User: {editingUser.email}</p>
                <form
                  onSubmit={handleUpdateUserRole}
                  className="space-y-4 mt-4"
                >
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Select Role
                    </label>
                    <select
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingUser(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Logs */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Audit Logs</h2>
          {loading && auditLogs.length === 0 ? (
            <p>Loading audit logs...</p>
          ) : auditLogs.length === 0 ? (
            <p>No audit logs found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                {/* Table Head */}
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User ID
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Table
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Record ID
                    </th>
                  </tr>
                </thead>
                {/* Table Body */}
                <tbody className="divide-y divide-gray-200">
                  {auditLogs.map((log, index) => (
                    <tr key={index}>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">
                        {log.user_id}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {log.table_name || "-"}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">
                        {log.record_id || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inventory Report */}
      {activeTab === "report" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-lg font-medium">Monthly Inventory Report</h2>
            <div className="flex gap-2">
              {/* --- Download PDF Button --- */}
              <Button
                onClick={handleDownloadReportPDF}
                disabled={!report || reportLoading || pdfGenerating}
                variant="secondary" // Or another appropriate variant
              >
                {pdfGenerating ? "Generating PDF..." : "Download PDF"}
              </Button>
              {/* --- End Download PDF Button --- */}
              <Button onClick={fetchReport} disabled={reportLoading}>
                {reportLoading ? "Refreshing..." : "Refresh Report"}
              </Button>
            </div>
          </div>

          {reportLoading ? (
            <div className="flex justify-center items-center min-h-64">
              Loading Report...
            </div>
          ) : !report ? (
            <p>Click "Refresh Report" to load the latest inventory report.</p>
          ) : (
            <div className="space-y-6">
              {/* Report Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="border p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500">
                    Report Period
                  </h3>
                  <p className="text-2xl font-semibold">
                    {report.report_month}
                  </p>
                  <p className="text-xs text-gray-500">
                    Generated: {new Date(report.generated_at).toLocaleString()}
                  </p>
                </div>
                <div className="border p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500">
                    Total Inventory Value
                  </h3>
                  <p className="text-2xl font-semibold">
                    $
                    {report.total_inventory_value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {report.total_units.toLocaleString()} total units
                  </p>
                </div>
                <div className="border p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500">
                    Distinct Items
                  </h3>
                  <p className="text-2xl font-semibold">
                    {report.total_distinct_items.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    Unique inventory items
                  </p>
                </div>
              </div>

              {/* Inventory Snapshot Table */}
              {report.inventory_snapshot &&
                report.inventory_snapshot.length > 0 ? (
                <div>
                  <h3 className="text-lg font-medium mb-3">
                    Inventory Snapshot
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                      {/* Table Head */}
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
                            Total Value
                          </th>
                        </tr>
                      </thead>
                      {/* Table Body */}
                      <tbody className="divide-y divide-gray-200">
                        {report.inventory_snapshot.map((item: any) => (
                          <tr key={item.id}>
                            <td className="px-3 py-4 whitespace-nowrap">
                              {item.name}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              {item.category || "-"}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              {item.quantity.toLocaleString()}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              ${item.price.toFixed(2)}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              ${(item.quantity * item.price).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p>No inventory snapshot data available for this period.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Back Button */}
      <div className="mt-4">
        <Link href="/protected">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
