"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { apiClient, Cuisine } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function EditCuisinePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id ? parseInt(params.id as string) : null;

  const [cuisine, setCuisine] = useState<Cuisine | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    image: null as File | null,
    removeImage: false,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasExistingImage, setHasExistingImage] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else if (id) {
      loadCuisine();
    }
  }, [user, router, id]);

  const loadCuisine = async () => {
    if (!id) return;

    try {
      const data = await apiClient.getCuisine(id);
      setCuisine(data);
      const hasImage = !!data.image_url;
      setHasExistingImage(hasImage);
      setFormData({
        name: data.name || "",
        description: data.description || "",
        price: data.price ? String(data.price) : "",
        image: null,
        removeImage: false,
      });
      setImagePreview(data.image_url || null);
    } catch (error) {
      console.error("Failed to load cuisine:", error);
      setError("Failed to load cuisine data");
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
    } else if (cuisine?.image_url) {
      setImagePreview(cuisine.image_url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!id) {
      setError("Invalid cuisine ID");
      return;
    }

    setSubmitting(true);

    try {
      const cleanedData: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };

      if (formData.price && formData.price.trim() !== "") {
        cleanedData.price = parseFloat(formData.price);
      } else {
        cleanedData.price = null; // Allow clearing the price
      }

      if (formData.removeImage) {
        // Send null to remove the image
        cleanedData.image = null;
      } else if (formData.image) {
        // Send new image file
        cleanedData.image = formData.image;
      }
      // If neither removeImage nor new image, don't send image field (keeps existing)

      await apiClient.updateCuisine(id, cleanedData);
      router.push("/dashboard/cuisines");
    } catch (err: any) {
      setError(err.message || "Failed to update cuisine");
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

  if (!cuisine) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <p className="text-[var(--text-secondary)] mb-4">Cuisine not found</p>
            <Link
              href="/dashboard/cuisines"
              className="text-[var(--border)] hover:text-[var(--primary-dark)] font-medium transition-colors duration-200"
            >
              ← Back to Cuisines
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
            href="/dashboard/cuisines"
            className="text-[var(--border)] hover:text-[var(--primary-dark)] text-sm font-medium mb-4 inline-block transition-colors duration-200"
          >
            ← Back to Cuisines
          </Link>
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Edit Cuisine</h2>
          <p className="text-[var(--text-secondary)] transition-colors duration-300">Update cuisine details</p>
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
                placeholder="e.g., Italian, Asian, Mexican"
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

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Price Per Person (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                placeholder="e.g., 1000.00 (overrides individual menu prices)"
              />
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                If set, this price per person will override individual menu item prices when this cuisine is selected for an event.
              </p>
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
                    className="max-w-xs h-48 object-cover rounded-lg border-2 border-[var(--border)]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-[var(--border)]"
              >
                {submitting ? "Updating..." : "Update Cuisine"}
              </button>
              <Link
                href="/dashboard/cuisines"
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

