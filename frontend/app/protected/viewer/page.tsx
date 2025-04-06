"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { getAllItems, getItemById } from "@/lib/api/items";
import { getMonthlyInventoryReport } from "@/lib/api/reports";

export default function ViewerDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        router.push("/sign-in");
        return;
      }
      
      // We don't need to check the role for viewers since everyone can view
      fetchItems();
      setLoading(false);
    };
    
    checkUser();
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(items.map(item => item.category).filter(Boolean))
      );
      setCategories(uniqueCategories as string[]);
      
      // Apply filters
      let filtered = [...items];
      
      // Apply search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(item => 
          item.name.toLowerCase().includes(term)
        );
      }
      
      // Apply category filter
      if (filterCategory) {
        filtered = filtered.filter(item => 
          item.category === filterCategory
        );
      }
      
      setFilteredItems(filtered);
    }
  }, [items, searchTerm, filterCategory]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await getAllItems();
      setItems(data || []);
      setFilteredItems(data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await getMonthlyInventoryReport();
      setReport(data);
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'inventory') fetchItems();
    if (tab === 'report') fetchReport();
  };

  const handleViewDetails = async (itemId: string) => {
    try {
      const item = await getItemById(itemId);
      setSelectedItem(item);
    } catch (error) {
      console.error("Error fetching item details:", error);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterCategory('');
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-64">Loading...</div>;
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      <div className="w-full">
        <div className="bg-accent text-sm p-4 rounded-md text-foreground">
          <h1 className="font-semibold text-xl mb-2">Inventory Viewer</h1>
          <p>Browse and search inventory items, view details, and access inventory reports.</p>
        </div>
      </div>
      
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={activeTab === 'inventory' ? 'default' : 'outline'}
          onClick={() => handleTabChange('inventory')}
        >
          Browse Inventory
        </Button>
        <Button 
          variant={activeTab === 'report' ? 'default' : 'outline'}
          onClick={() => handleTabChange('report')}
        >
          Inventory Report
        </Button>
      </div>
      
      {/* Inventory Browser */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="space-y-4 border p-4 rounded-md">
            <h2 className="text-lg font-medium">Search and Filter</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Search by Name</label>
                <Input 
                  type="text" 
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Filter by Category</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
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
            {filteredItems.length === 0 ? (
              <p>No items found matching the filters</p>
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
                    {filteredItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-4 whitespace-nowrap">{item.name}</td>
                        <td className="px-3 py-4 whitespace-nowrap">{item.category || '-'}</td>
                        <td className="px-3 py-4 whitespace-nowrap">{item.quantity}</td>
                        <td className="px-3 py-4 whitespace-nowrap">${item.price.toFixed(2)}</td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <Button size="sm" variant="outline" onClick={() => handleViewDetails(item.id)}>
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
              <div className="bg-background p-6 rounded-lg w-full max-w-lg">
                <h2 className="text-lg font-medium mb-4">Item Details</h2>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Name</p>
                      <p>{selectedItem.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Category</p>
                      <p>{selectedItem.category || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Quantity</p>
                      <p>{selectedItem.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Price</p>
                      <p>${selectedItem.price.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Value</p>
                      <p>${(selectedItem.quantity * selectedItem.price).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Item ID</p>
                      <p className="text-xs">{selectedItem.id}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end mt-6">
                  <Button onClick={() => setSelectedItem(null)}>Close</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Inventory Report */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Monthly Inventory Report</h2>
            <Button onClick={fetchReport}>Refresh Report</Button>
          </div>
          
          {!report ? (
            <p>Click "Refresh Report" to load the latest inventory report.</p>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="border p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500">Report Period</h3>
                  <p className="text-2xl font-semibold">{report.report_month}</p>
                  <p className="text-xs text-gray-500">Generated: {new Date(report.generated_at).toLocaleString()}</p>
                </div>
                
                <div className="border p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500">Total Inventory Value</h3>
                  <p className="text-2xl font-semibold">${report.total_inventory_value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{report.total_units.toLocaleString()} total units</p>
                </div>
                
                <div className="border p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-500">Distinct Items</h3>
                  <p className="text-2xl font-semibold">{report.total_distinct_items.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Unique inventory items</p>
                </div>
              </div>
              
              {report.inventory_snapshot && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Inventory Snapshot</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead>
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {report.inventory_snapshot.map((item: any) => (
                          <tr key={item.id}>
                            <td className="px-3 py-4 whitespace-nowrap">{item.name}</td>
                            <td className="px-3 py-4 whitespace-nowrap">{item.category || '-'}</td>
                            <td className="px-3 py-4 whitespace-nowrap">{item.quantity}</td>
                            <td className="px-3 py-4 whitespace-nowrap">${item.price.toFixed(2)}</td>
                            <td className="px-3 py-4 whitespace-nowrap">${(item.quantity * item.price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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