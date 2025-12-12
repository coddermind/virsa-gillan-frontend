"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { apiClient, ItemType } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function ItemTypesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const isManager = user?.user_type === "manager";

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      loadItemTypes();
    }
  }, [user, router]);

  const loadItemTypes = async () => {
    try {
      const data = await apiClient.getItemTypes();
      setItemTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load item types:", error);
      setItemTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this item type?")) return;

    try {
      await apiClient.deleteItemType(id);
      loadItemTypes();
    } catch (err: any) {
      alert(err.message || "Failed to delete item type");
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
              <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Menus</h2>
              <p className="text-[var(--text-secondary)] transition-colors duration-300">Organize items into types (APPETIZERS, SALAD, etc.)</p>
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
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Menus</h2>
            <p className="text-[var(--text-secondary)] transition-colors duration-300">Organize items into types (APPETIZERS, SALAD, etc.)</p>
          </div>
          <Link
            href="/dashboard/item-types/create"
            className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 border-2 border-[var(--border)]"
          >
            Add Menu
          </Link>
        </div>

        {itemTypes.length === 0 ? (
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <p className="text-[var(--text-secondary)] mb-4">No menu items yet. Create your first menu item to get started.</p>
            <Link
              href="/dashboard/item-types/create"
              className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 inline-block border-2 border-[var(--border)]"
            >
              Add Menu
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {itemTypes.map((itemType) => (
              <div
                key={itemType.id}
                className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 hover:shadow-md transition-all duration-300"
              >
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{itemType.name}</h3>
                {itemType.description && (
                  <p className="text-[var(--text-secondary)] text-sm mb-4 line-clamp-2">{itemType.description}</p>
                )}
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  {itemType.sub_items_count} menu item{itemType.sub_items_count !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/item-types/${itemType.id}/edit`}
                    className="flex-1 px-4 py-2 bg-[var(--border)]/20 text-[var(--border)] rounded-lg font-medium hover:bg-[var(--border)]/30 transition-colors duration-200 text-sm text-center border border-[var(--border)]"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(itemType.id)}
                    className="flex-1 px-4 py-2 bg-red-900/20 text-red-400 rounded-lg font-medium hover:bg-red-900/30 transition-colors duration-200 text-sm border border-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
