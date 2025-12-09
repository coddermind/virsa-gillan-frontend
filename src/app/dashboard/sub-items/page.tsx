"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { apiClient, SubItem, Cuisine, ItemType } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function SubItemsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const isManager = user?.user_type === "manager";
  const [filters, setFilters] = useState({
    cuisine: "",
    item_type: "",
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      loadData();
    }
  }, [user, router]);

  useEffect(() => {
    if (user) {
      loadSubItems();
    }
  }, [filters, user]);

  const loadData = async () => {
    try {
      const [cuisinesData, itemTypesData] = await Promise.all([
        apiClient.getCuisines(),
        apiClient.getItemTypes(),
      ]);
      setCuisines(Array.isArray(cuisinesData) ? cuisinesData : []);
      setItemTypes(Array.isArray(itemTypesData) ? itemTypesData : []);
      await loadSubItems();
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubItems = async () => {
    try {
      const cuisineId = filters.cuisine ? parseInt(filters.cuisine) : undefined;
      const itemTypeId = filters.item_type ? parseInt(filters.item_type) : undefined;
      const data = await apiClient.getSubItems(cuisineId, itemTypeId);
      setSubItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load sub items:", error);
      setSubItems([]);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this sub item?")) return;

    try {
      await apiClient.deleteSubItem(id);
      loadSubItems();
    } catch (err: any) {
      alert(err.message || "Failed to delete sub item");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--border)] border-r-transparent"></div>
            <p className="mt-4 text-[var(--text-secondary)]">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isManager) {
    return (
      <DashboardLayout>
        <div>
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Menues</h2>
              <p className="text-[var(--text-secondary)] transition-colors duration-300">Manage cuisine-specific menu items</p>
            </div>
          </div>
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Access Restricted</h3>
              <p className="text-[var(--text-secondary)] mb-6">
                Only managers can access this section. Please contact your administrator to be assigned manager privileges.
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Menues</h2>
            <p className="text-[var(--text-secondary)] transition-colors duration-300">Manage cuisine-specific menu items</p>
          </div>
          <Link
            href="/dashboard/sub-items/create"
            className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 border-2 border-[var(--border)]"
          >
            Add Menu
          </Link>
        </div>

        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-4 mb-6 transition-colors duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Filter by Cuisine
              </label>
              <select
                value={filters.cuisine}
                onChange={(e) => setFilters({ ...filters, cuisine: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200"
              >
                <option value="">All Cuisines</option>
                {cuisines.map((cuisine) => (
                  <option key={cuisine.id} value={cuisine.id}>
                    {cuisine.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Filter by Item Type
              </label>
              <select
                value={filters.item_type}
                onChange={(e) => setFilters({ ...filters, item_type: e.target.value })}
                className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200"
              >
                <option value="">All Item Types</option>
                {itemTypes.map((itemType) => (
                  <option key={itemType.id} value={itemType.id}>
                    {itemType.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {subItems.length === 0 ? (
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <p className="text-[var(--text-secondary)] mb-4">
              {filters.cuisine || filters.item_type
                ? "No menus found with the selected filters."
                : "No menus yet. Create your first menu to get started."}
            </p>
            <Link
              href="/dashboard/sub-items/create"
              className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 inline-block border-2 border-[var(--border)]"
            >
              Add Menu
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subItems.map((subItem) => (
              <div
                key={subItem.id}
                className={`bg-[var(--card)] rounded-xl shadow-sm border-2 ${
                  subItem.is_active ? "border-[var(--border)]" : "border-[var(--border)] opacity-75"
                } overflow-hidden hover:shadow-md transition-all duration-300`}
              >
                {subItem.image_url && (
                  <div className="h-48 bg-[var(--hover-bg)] overflow-hidden">
                    <img
                      src={subItem.image_url}
                      alt={subItem.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-semibold text-[var(--text-primary)] flex-1">{subItem.name}</h3>
                    {!subItem.is_active && (
                      <span className="ml-2 px-2 py-1 text-xs bg-[var(--hover-bg)] text-[var(--text-secondary)] rounded border border-[var(--border)]">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-1 bg-[var(--border)]/20 text-[var(--border)] rounded border border-[var(--border)]">
                      {subItem.cuisine_name}
                    </span>
                    <span className="text-xs px-2 py-1 bg-[var(--border)]/20 text-[var(--border)] rounded border border-[var(--border)]">
                      {subItem.item_type_name}
                    </span>
                  </div>
                  {subItem.description && (
                    <p className="text-[var(--text-secondary)] text-sm mb-3 line-clamp-2">{subItem.description}</p>
                  )}
                  {subItem.price && (
                    <p className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                      ${parseFloat(subItem.price).toFixed(2)}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/sub-items/${subItem.id}/edit`}
                      className="flex-1 px-4 py-2 bg-[var(--border)]/20 text-[var(--border)] rounded-lg font-medium hover:bg-[var(--border)]/30 transition-colors duration-200 text-sm text-center border border-[var(--border)]"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(subItem.id)}
                      className="flex-1 px-4 py-2 bg-red-900/20 text-red-400 rounded-lg font-medium hover:bg-red-900/30 transition-colors duration-200 text-sm border border-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
