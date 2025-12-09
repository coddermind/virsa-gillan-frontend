"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { apiClient, Cuisine, ItemType, SubItem } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function EditSubItemPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id ? parseInt(params.id as string) : null;

  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [subItem, setSubItem] = useState<SubItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image: null as File | null,
    removeImage: false,
    price: "",
    item_type: "",
    cuisine: "",
    is_active: true,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasExistingImage, setHasExistingImage] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else if (id) {
      loadData();
    }
  }, [user, router, id]);

  const loadData = async () => {
    if (!id) return;

    try {
      const [cuisinesData, itemTypesData, subItemData] = await Promise.all([
        apiClient.getCuisines(),
        apiClient.getItemTypes(),
        apiClient.getSubItem(id),
      ]);
      
      setCuisines(Array.isArray(cuisinesData) ? cuisinesData : []);
      setItemTypes(Array.isArray(itemTypesData) ? itemTypesData : []);
      setSubItem(subItemData);

      // Pre-fill form with sub item data - ensure IDs are converted to strings
      if (subItemData) {
        const cuisineId = subItemData.cuisine !== undefined && subItemData.cuisine !== null
          ? String(subItemData.cuisine)
          : "";
        const itemTypeId = subItemData.item_type !== undefined && subItemData.item_type !== null
          ? String(subItemData.item_type)
          : "";
        const hasImage = !!subItemData.image_url;
        setHasExistingImage(hasImage);

        setFormData({
          name: subItemData.name || "",
          description: subItemData.description || "",
          image: null,
          removeImage: false,
          price: subItemData.price || "",
          item_type: itemTypeId,
          cuisine: cuisineId,
          is_active: subItemData.is_active ?? true,
        });
        setImagePreview(subItemData.image_url || null);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      setError("Failed to load sub item data");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, image: file, removeImage: false });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const shouldRemove = e.target.checked;
    setFormData({ ...formData, removeImage: shouldRemove, image: null });
    if (shouldRemove) {
      setImagePreview(null);
    } else if (subItem?.image_url) {
      setImagePreview(subItem.image_url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.cuisine || !formData.item_type) {
      setError("Please select both cuisine and item type");
      return;
    }

    if (!id) {
      setError("Invalid sub item ID");
      return;
    }

    setSubmitting(true);

    try {
      const submitData: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        item_type: parseInt(formData.item_type),
        cuisine: parseInt(formData.cuisine),
        is_active: formData.is_active,
      };

      if (formData.removeImage) {
        // Send null to remove the image
        submitData.image = null;
      } else if (formData.image) {
        // Send new image file
        submitData.image = formData.image;
      }
      // If neither removeImage nor new image, don't send image field (keeps existing)

      await apiClient.updateSubItem(id, submitData);
      router.push("/dashboard/sub-items");
    } catch (err: any) {
      setError(err.message || "Failed to update sub item");
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

  if (!subItem) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <p className="text-[var(--text-secondary)] mb-4">Menu not found</p>
            <Link
              href="/dashboard/sub-items"
              className="text-[var(--border)] hover:text-[var(--primary-dark)] font-medium transition-colors duration-200"
            >
              ← Back to Menues
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
            href="/dashboard/sub-items"
            className="text-[var(--border)] hover:text-[var(--primary-dark)] text-sm font-medium mb-4 inline-block transition-colors duration-200"
          >
            ← Back to Menues
          </Link>
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Edit Menu</h2>
          <p className="text-[var(--text-secondary)] transition-colors duration-300">Update menu details</p>
        </div>

        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300">
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border-2 border-red-500 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Cuisine *
                </label>
                <select
                  key={`cuisine-${formData.cuisine}`}
                  value={formData.cuisine}
                  onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200"
                >
                  <option value="">Select Cuisine</option>
                  {cuisines.map((cuisine) => (
                    <option key={cuisine.id} value={String(cuisine.id)}>
                      {cuisine.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Item Type *
                </label>
                <select
                  key={`item-type-${formData.item_type}`}
                  value={formData.item_type}
                  onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200"
                >
                  <option value="">Select Item Type</option>
                  {itemTypes.map((itemType) => (
                    <option key={itemType.id} value={String(itemType.id)}>
                      {itemType.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                placeholder="e.g., Mini Chicken Taquitos With Salsa Verde"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Image
                </label>
                {hasExistingImage && !formData.image && (
                  <div className="mb-3 p-3 bg-[var(--hover-bg)] border-2 border-[var(--border)] rounded-lg transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="checkbox"
                        id="removeImage"
                        checked={formData.removeImage}
                        onChange={handleRemoveImage}
                        className="w-4 h-4 text-red-500 border-[var(--border)] rounded focus:ring-red-500 bg-[var(--background)]"
                      />
                      <label htmlFor="removeImage" className="text-sm font-medium text-red-400 cursor-pointer">
                        Remove current image
                      </label>
                    </div>
                    {!formData.removeImage && imagePreview && (
                      <div className="mt-2">
                        <img
                          src={imagePreview}
                          alt="Current"
                          className="max-w-xs h-48 object-cover rounded-lg border-2 border-[var(--border)]"
                        />
                      </div>
                    )}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={formData.removeImage}
                  className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] disabled:bg-[var(--hover-bg)] disabled:cursor-not-allowed transition-colors duration-200"
                />
                {formData.image && !formData.removeImage && (
                  <div className="mt-4">
                    <p className="text-sm text-[var(--text-secondary)] mb-2">New image preview:</p>
                    <img
                      src={imagePreview || ""}
                      alt="Preview"
                      className="max-w-xs h-48 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-[var(--border)] border-[var(--border)] rounded focus:ring-[var(--border)] bg-[var(--background)]"
              />
              <label htmlFor="is_active" className="ml-2 text-sm font-medium text-[var(--text-primary)]">
                Active
              </label>
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
                href="/dashboard/sub-items"
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

