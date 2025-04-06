"use client";

import { useState, useEffect } from "react";
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

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true); // Start loading true
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Form states
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: 0,
    price: 0,
    category: ''
  });

  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingRole, setEditingRole] = useState('');

  useEffect(() => {
    console.log("AdminDashboard: useEffect triggered."); // Log effect start

    const checkAdmin = async () => {
      console.log("Admin Check: Starting checkAdmin function..."); // Log function start

      setLoading(true);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.push("/sign-in");
        return;
      }

      try {
        const roleData = await getUserRole(session.user.id, session.access_token);

        if (!roleData) {
          router.push("/protected");
          setLoading(false); // Set loading false before redirecting
          return; // Exit early
        }
        if (roleData.role !== "admin") {
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'items') fetchItems();
    if (tab === 'users') fetchUsers();
    if (tab === 'audit') fetchAuditLogs();
  };

  const handleNewItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewItem(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'price' ? parseFloat(value) : value
    }));
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addItem(newItem);
      setNewItem({ name: '', quantity: 0, price: 0, category: '' });
      fetchItems();
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
      [name]: name === 'quantity' || name === 'price' ? parseFloat(value) : value
    }));
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateItem(editingItem.id, editingItem);
      setEditingItem(null);
      fetchItems();
    } catch (error) {
      console.error("Error updating item:", error);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteItem(id);
        fetchItems();
      } catch (error) {
        console.error("Error deleting item:", error);
      }
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setEditingRole(user.role);
  };

  const handleUpdateUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await assignUserRole(editingUser.user_id, { role: editingRole });
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user role:", error);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-64">Loading...</div>;
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      <div className="w-full">
        <div className="bg-accent text-sm p-4 rounded-md text-foreground">
          <h1 className="font-semibold text-xl mb-2">Admin Dashboard</h1>
          <p>As an admin, you can manage inventory items, user roles, and view audit logs.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'items' ? 'default' : 'outline'}
          onClick={() => handleTabChange('items')}
        >
          Manage Items
        </Button>
        <Button
          variant={activeTab === 'users' ? 'default' : 'outline'}
          onClick={() => handleTabChange('users')}
        >
          Manage Users
        </Button>
        <Button
          variant={activeTab === 'audit' ? 'default' : 'outline'}
          onClick={() => handleTabChange('audit')}
        >
          Audit Logs
        </Button>
      </div>

      {/* Items Management */}
      {activeTab === 'items' && (
        <div className="space-y-6">
          {/* Add New Item Form */}
          <div className="border p-4 rounded-md">
            <h2 className="text-lg font-medium mb-3">Add New Item</h2>
            <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium mb-1">Category</label>
                <Input
                  name="category"
                  value={newItem.category}
                  onChange={handleNewItemChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
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
                          <Button size="sm" variant="outline" onClick={() => handleEditItem(item)}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteItem(item.id)}>Delete</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Edit Item Modal */}
          {editingItem && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-background p-6 rounded-lg w-full max-w-md">
                <h2 className="text-lg font-medium mb-4">Edit Item</h2>
                <form onSubmit={handleUpdateItem} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <Input
                      name="name"
                      value={editingItem.name}
                      onChange={handleEditItemChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <Input
                      name="category"
                      value={editingItem.category || ''}
                      onChange={handleEditItemChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
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
                    <label className="block text-sm font-medium mb-1">Price</label>
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
                    <Button type="button" variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users Management */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <h2 className="text-lg font-medium">User Role Management</h2>
          {users.length === 0 ? (
            <p>No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.user_id}>
                      <td className="px-3 py-4 whitespace-nowrap">{user.email}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{user.user_id}</td>
                      <td className="px-3 py-4 whitespace-nowrap uppercase font-medium">{user.role}</td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => handleEditUser(user)}>
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
              <div className="bg-background p-6 rounded-lg w-full max-w-md">
                <h2 className="text-lg font-medium mb-4">Change User Role</h2>
                <p>User: {editingUser.email}</p>
                <form onSubmit={handleUpdateUserRole} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Select Role</label>
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
                    <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Logs */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Audit Logs</h2>
          {auditLogs.length === 0 ? (
            <p>No audit logs found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditLogs.map((log, index) => (
                    <tr key={index}>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{log.user_id}</td>
                      <td className="px-3 py-4 whitespace-nowrap">{log.action}</td>
                      <td className="px-3 py-4 whitespace-nowrap">{log.table_name || '-'}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{log.record_id || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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