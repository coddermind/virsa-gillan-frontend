"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { apiClient, TimeSlot } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function TimeSlotsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const isManager = user?.user_type === "manager";

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      loadTimeSlots();
    }
  }, [user, router]);

  const loadTimeSlots = async () => {
    try {
      const data = await apiClient.getTimeSlots();
      setTimeSlots(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load time slots:", error);
      setTimeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this time slot?")) return;

    try {
      await apiClient.deleteTimeSlot(id);
      loadTimeSlots();
    } catch (err: any) {
      alert(err.message || "Failed to delete time slot");
    }
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
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
              <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Time Slots</h2>
              <p className="text-[var(--text-secondary)] transition-colors duration-300">Manage available time slots for events</p>
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
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Time Slots</h2>
            <p className="text-[var(--text-secondary)] transition-colors duration-300">Manage available time slots for events</p>
          </div>
          <Link
            href="/dashboard/time-slots/create"
            prefetch={false}
            className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:opacity-90 transition-opacity duration-200 border-2 border-[var(--border)]"
          >
            + Create Time Slot
          </Link>
        </div>

        {timeSlots.length === 0 ? (
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <p className="text-[var(--text-secondary)] mb-4">No time slots found.</p>
            <Link
              href="/dashboard/time-slots/create"
              prefetch={false}
              className="inline-block px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:opacity-90 transition-opacity duration-200 border-2 border-[var(--border)]"
            >
              Create Your First Time Slot
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {timeSlots.map((slot) => (
              <div
                key={slot.id}
                className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300 hover:shadow-md"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{slot.name}</h3>
                    <p className="text-[var(--text-secondary)] text-sm">
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    </p>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Available on:</p>
                  <div className="flex flex-wrap gap-2">
                    {slot.weekday_names.map((day, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs font-medium rounded bg-[var(--border)]/20 text-[var(--border)] border border-[var(--border)]"
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/time-slots/${slot.id}/edit`}
                    prefetch={false}
                    className="flex-1 px-4 py-2 text-center text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--hover-bg)] border-2 border-[var(--border)] rounded-lg transition-colors duration-200"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(slot.id)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 border-2 border-red-500 rounded-lg transition-colors duration-200"
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

