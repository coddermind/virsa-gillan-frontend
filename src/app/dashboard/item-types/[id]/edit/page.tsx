"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { apiClient, ItemType } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function EditItemTypePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id ? parseInt(params.id as string) : null;

  const [itemType, setItemType] = useState<ItemType | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else if (id) {
      loadItemType();
    }
  }, [user, router, id]);

  const loadItemType = async () => {
    if (!id) return;

    try {
      const data = await apiClient.getItemType(id);
      setItemType(data);
      setFormData({
        name: data.name || "",
        description: data.description || "",
      });
    } catch (error) {
      console.error("Failed to load item type:", error);
      setError("Failed to load item type data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!id) {
      setError("Invalid item type ID");
      return;
    }

    setSubmitting(true);

    try {
      const cleanedData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };

      await apiClient.updateItemType(id, cleanedData);
      router.push("/dashboard/item-types");
    } catch (err: any) {
      setError(err.message || "Failed to update item type");
      setSubmitting(false);
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

  if (!itemType) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <p className="text-[var(--text-secondary)] mb-4">Menu item not found</p>
            <Link
              href="/dashboard/item-types"
              className="text-[var(--border)] hover:text-[var(--primary-dark)] font-medium transition-colors duration-200"
            >
            ← Back to Menus
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/item-types"
            className="text-[var(--border)] hover:text-[var(--primary-dark)] text-sm font-medium mb-4 inline-block transition-colors duration-200"
          >
            ← Back to Menus
          </Link>
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Edit Menu</h2>
          <p className="text-[var(--text-secondary)] transition-colors duration-300">Update menu item details</p>
        </div>

        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300">
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border-2 border-red-500 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                placeholder="e.g., APPETIZERS, SALAD, MAIN COURSE"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                placeholder="Optional description"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-[var(--border)]"
              >
                {submitting ? "Updating..." : "Update Menu"}
              </button>
              <Link
                href="/dashboard/item-types"
                className="px-6 py-3 bg-[var(--hover-bg)] text-[var(--text-primary)] rounded-lg font-medium hover:bg-[var(--hover-bg)]/80 transition-colors duration-200 border-2 border-[var(--border)]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

