"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, TimeSlot } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

const WEEKDAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

export default function EditTimeSlotPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    start_time: "",
    end_time: "",
    weekdays: [] as number[],
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && user.user_type === "manager") {
      loadTimeSlot();
    }
  }, [user, id]);

  const loadTimeSlot = async () => {
    try {
      const data = await apiClient.getTimeSlot(id);
      setTimeSlot(data);
      setFormData({
        name: data.name,
        start_time: data.start_time,
        end_time: data.end_time,
        weekdays: data.weekdays,
      });
    } catch (err: any) {
      setError(err.message || "Failed to load time slot");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    if (!formData.name || !formData.start_time || !formData.end_time || formData.weekdays.length === 0) {
      setError("Please fill in all fields and select at least one weekday.");
      setSubmitting(false);
      return;
    }

    if (formData.start_time >= formData.end_time) {
      setError("End time must be after start time.");
      setSubmitting(false);
      return;
    }

    try {
      await apiClient.updateTimeSlot(id, formData);
      router.push("/dashboard/time-slots");
    } catch (err: any) {
      setError(err.message || "Failed to update time slot");
      setSubmitting(false);
    }
  };

  const toggleWeekday = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day],
    }));
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

  if (!user || user.user_type !== "manager") {
    return (
      <DashboardLayout>
        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Access Restricted</h3>
            <p className="text-[var(--text-secondary)] mb-6">Only managers can access this section.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!timeSlot) {
    return (
      <DashboardLayout>
        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
          <p className="text-[var(--text-secondary)]">Time slot not found.</p>
          <Link
            href="/dashboard/time-slots"
            prefetch={false}
            className="mt-4 inline-block text-[var(--border)] hover:underline"
          >
            Back to Time Slots
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <div className="mb-8">
          <Link
            href="/dashboard/time-slots"
            prefetch={false}
            className="text-[var(--border)] hover:underline mb-4 inline-block"
          >
            ← Back to Time Slots
          </Link>
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Edit Time Slot</h2>
          <p className="text-[var(--text-secondary)] transition-colors duration-300">Update time slot details</p>
        </div>

        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border-2 border-red-500 rounded-lg text-red-500 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Time Slot Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border-2 border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border)] transition-colors duration-300"
                placeholder="e.g., Morning, Afternoon, Evening"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border)] transition-colors duration-300"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  End Time *
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border)] transition-colors duration-300"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Available Weekdays *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekday(day.value)}
                    className={`px-4 py-2 rounded-lg border-2 transition-colors duration-200 ${
                      formData.weekdays.includes(day.value)
                        ? "bg-[var(--border)] text-[var(--background)] border-[var(--border)]"
                        : "bg-[var(--background)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {formData.weekdays.length === 0 && (
                <p className="mt-2 text-sm text-red-500">Please select at least one weekday</p>
              )}
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:opacity-90 transition-opacity duration-200 border-2 border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Updating..." : "Update Time Slot"}
              </button>
              <Link
                href="/dashboard/time-slots"
                prefetch={false}
                className="px-6 py-3 text-center text-[var(--text-primary)] hover:bg-[var(--hover-bg)] border-2 border-[var(--border)] rounded-lg font-medium transition-colors duration-200"
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

