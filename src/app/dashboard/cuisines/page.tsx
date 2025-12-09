"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { apiClient, Cuisine } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function CuisinesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [loading, setLoading] = useState(true);
  const isManager = user?.user_type === "manager";

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      loadCuisines();
    }
  }, [user, router]);

  const loadCuisines = async () => {
    try {
      const data = await apiClient.getCuisines();
      setCuisines(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load cuisines:", error);
      setCuisines([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this cuisine?")) return;

    try {
      await apiClient.deleteCuisine(id);
      loadCuisines();
    } catch (err: any) {
      alert(err.message || "Failed to delete cuisine");
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
              <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Cuisines</h2>
              <p className="text-[var(--text-secondary)] transition-colors duration-300">Manage your cuisines (Italian, Asian, etc.)</p>
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
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Cuisines</h2>
            <p className="text-[var(--text-secondary)] transition-colors duration-300">Manage your cuisines (Italian, Asian, etc.)</p>
          </div>
          <Link
            href="/dashboard/cuisines/create"
            className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 border-2 border-[var(--border)]"
          >
            Add Cuisine
          </Link>
        </div>

        {cuisines.length === 0 ? (
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <p className="text-[var(--text-secondary)] mb-4">No cuisines yet. Create your first cuisine to get started.</p>
            <Link
              href="/dashboard/cuisines/create"
              className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 inline-block border-2 border-[var(--border)]"
            >
              Add Cuisine
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cuisines.map((cuisine) => (
              <div
                key={cuisine.id}
                className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] overflow-hidden hover:shadow-md transition-all duration-300"
              >
                {cuisine.image_url && (
                  <div className="h-48 bg-[var(--hover-bg)] overflow-hidden">
                    <img
                      src={cuisine.image_url}
                      alt={cuisine.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{cuisine.name}</h3>
                  {cuisine.description && (
                    <p className="text-[var(--text-secondary)] text-sm mb-4 line-clamp-2">{cuisine.description}</p>
                  )}
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    {cuisine.sub_items_count} menu item{cuisine.sub_items_count !== 1 ? "s" : ""}
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/cuisines/${cuisine.id}/edit`}
                      className="flex-1 px-4 py-2 bg-[var(--border)]/20 text-[var(--border)] rounded-lg font-medium hover:bg-[var(--border)]/30 transition-colors duration-200 text-sm text-center border border-[var(--border)]"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(cuisine.id)}
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
