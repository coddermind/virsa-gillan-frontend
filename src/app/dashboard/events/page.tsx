"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { apiClient, Event } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function EventsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const isManager = user?.user_type === "manager";

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      loadEvents();
    }
  }, [user, router]);

  const loadEvents = async () => {
    try {
      const data = await apiClient.getEvents();
      const approvedOnly = Array.isArray(data) ? data.filter((e) => e.status === "approved") : [];
      setEvents(approvedOnly);
    } catch (error) {
      console.error("Failed to load events:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this event? All budget entries will also be deleted.")) return;

    try {
      await apiClient.deleteEvent(id);
      loadEvents();
    } catch (err: any) {
      alert(err.message || "Failed to delete event");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "";
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDateTimeRange = (event: Event) => {
    const dateStr = formatDate(event.date);
    if (event.start_time && event.end_time) {
      return `${dateStr}, ${formatTime(event.start_time)} - ${formatTime(event.end_time)}`;
    } else if (event.time_slot_display) {
      // Fallback to time_slot_display if times not available
      return `${dateStr}, ${event.time_slot_display}`;
    } else if (event.date_time) {
      // Fallback to date_time if nothing else available
      const date = new Date(event.date_time);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return dateStr;
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
              <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Approved Events</h2>
              <p className="text-[var(--text-secondary)] transition-colors duration-300">Manage your approved events and budgets</p>
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
                <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Approved Events</h2>
                <p className="text-[var(--text-secondary)] transition-colors duration-300">Manage your approved events and budgets</p>
              </div>
          <Link
            href="/dashboard/events/create"
            prefetch={false}
            className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 border-2 border-[var(--border)]"
          >
            Add Event
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <p className="text-[var(--text-secondary)] mb-4">No events yet. Create your first event to get started.</p>
            <Link
              href="/dashboard/events/create"
              prefetch={false}
              className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 inline-block border-2 border-[var(--border)]"
            >
              Add Event
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const pendingCharges = event.pending_charges ?? (parseFloat(event.total_charges.toString()) - parseFloat(event.total_payments_received.toString()));
              
              return (
                <div
                  key={event.id}
                  className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-semibold text-[var(--text-primary)] flex-1">{event.name}</h3>
                    <Link
                      href={`/dashboard/events/${event.id}`}
                      prefetch={false}
                      className="text-[var(--border)] hover:text-[var(--primary-dark)] text-sm font-medium transition-colors duration-200"
                    >
                      View
                    </Link>
                  </div>
                  
                  <div className="space-y-2 mb-4 text-sm text-[var(--text-secondary)]">
                    <p><span className="font-medium">Location:</span> {event.location}</p>
                    <p><span className="font-medium">Date:</span> {formatDateTimeRange(event)}</p>
                    <p><span className="font-medium">Customer:</span> {event.customer_name}</p>
                  </div>

                  <div className="border-t-2 border-[var(--border)] pt-4 mb-4">
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <p className="text-[var(--text-secondary)]">Total Charges</p>
                        <p className="font-semibold text-[var(--border)]">${parseFloat(event.total_charges.toString()).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[var(--text-secondary)]">Payments Received</p>
                        <p className="font-semibold text-green-500">${parseFloat(event.total_payments_received.toString()).toFixed(2)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[var(--text-secondary)]">Pending Charges</p>
                        <p className={`font-semibold text-lg ${pendingCharges > 0 ? "text-[var(--border)]" : "text-[var(--text-secondary)]"}`}>
                          ${pendingCharges.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="pt-3 border-t-2 border-[var(--border)]">
                      <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Expenses</p>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <p className="text-[var(--text-secondary)]">Payable</p>
                          <p className="font-semibold text-red-500">${parseFloat(event.total_payable.toString()).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-secondary)]">Paid</p>
                          <p className="font-semibold text-green-500">${parseFloat(event.total_paid.toString()).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t-2 border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Profit</p>
                        <p className={`font-bold text-lg ${(parseFloat(event.total_charges.toString()) - (parseFloat(event.total_payable.toString()) + parseFloat(event.total_paid.toString()))) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          ${(parseFloat(event.total_charges.toString()) - (parseFloat(event.total_payable.toString()) + parseFloat(event.total_paid.toString()))).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/events/${event.id}/edit`}
                      prefetch={false}
                      className="flex-1 px-4 py-2 bg-[var(--border)]/20 text-[var(--border)] rounded-lg font-medium hover:bg-[var(--border)]/30 transition-colors duration-200 text-sm text-center border border-[var(--border)]"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="flex-1 px-4 py-2 bg-red-900/20 text-red-400 rounded-lg font-medium hover:bg-red-900/30 transition-colors duration-200 text-sm border border-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

