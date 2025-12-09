"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, Event } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { Clock, Check, X, DollarSign, Calendar, MapPin, Users } from "lucide-react";

export default function PendingEventsPage() {
  const { user } = useAuth();
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [serviceCharges, setServiceCharges] = useState<{ [key: number]: string }>({});
  const [extrasCharges, setExtrasCharges] = useState<{ [key: number]: { [extraIndex: number]: string } }>({});

  useEffect(() => {
    if (user && user.user_type === "manager") {
      loadPendingEvents();
    }
  }, [user]);

  const loadPendingEvents = async () => {
    try {
      setLoading(true);
      const events = await apiClient.getPendingEvents();
      setPendingEvents(Array.isArray(events) ? events : []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load pending events");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (eventId: number) => {
    try {
      setApprovingId(eventId);
      const charges = parseFloat(serviceCharges[eventId] || "0");
      
      // Get the event to access its extras
      const event = pendingEvents.find(e => e.id === eventId);
      let updatedExtras = event?.extras || [];
      
      // Update extras with charges if provided
      if (event && event.extras && event.extras.length > 0) {
        updatedExtras = event.extras.map((extra: any, index: number) => {
          const chargeValue = extrasCharges[eventId]?.[index];
          if (chargeValue !== undefined && chargeValue !== "") {
            return {
              ...extra,
              charges: parseFloat(chargeValue) || 0
            };
          }
          return extra;
        });
      }
      
      await apiClient.approveEvent(eventId, charges, updatedExtras);
      alert("Event approved successfully!");
      loadPendingEvents();
      setServiceCharges((prev) => {
        const newCharges = { ...prev };
        delete newCharges[eventId];
        return newCharges;
      });
      setExtrasCharges((prev) => {
        const newCharges = { ...prev };
        delete newCharges[eventId];
        return newCharges;
      });
    } catch (err: any) {
      alert(err.message || "Failed to approve event");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (eventId: number) => {
    if (!confirm("Are you sure you want to reject this event booking?")) {
      return;
    }
    try {
      setApprovingId(eventId);
      await apiClient.rejectEvent(eventId);
      alert("Event rejected.");
      loadPendingEvents();
    } catch (err: any) {
      alert(err.message || "Failed to reject event");
    } finally {
      setApprovingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (!user || user.user_type !== "manager") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border-2 border-red-500 rounded-lg p-6 text-center">
            <p className="text-red-400 text-lg font-semibold">Access Restricted</p>
            <p className="text-red-300 mt-2">
              You don't have permission to access this section. Only managers can approve events.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--border)] border-r-transparent"></div>
              <p className="mt-4 text-[var(--text-secondary)]">Loading pending events...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/events"
            prefetch={false}
            className="text-[var(--border)] hover:text-[var(--primary-dark)] text-sm font-medium mb-4 inline-block transition-colors duration-200"
          >
            ← Back to Events
          </Link>
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300 flex items-center gap-2">
            <Clock className="w-8 h-8" />
            Pending Event Approvals
          </h2>
          <p className="text-[var(--text-secondary)] transition-colors duration-300">
            Review and approve or reject event bookings
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {pendingEvents.length === 0 ? (
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center">
            <Clock className="w-16 h-16 mx-auto text-[var(--text-secondary)] mb-4" />
            <p className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              No Pending Events
            </p>
            <p className="text-[var(--text-secondary)]">
              All events have been processed. New bookings will appear here for approval.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingEvents.map((event) => (
              <div
                key={event.id}
                className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-yellow-500 p-6 transition-colors duration-300"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4">
                      {event.name}
                    </h3>
                    <div className="space-y-2 text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(event.date)}</span>
                        {event.start_time && event.end_time && (
                          <span>
                            {formatTime(event.start_time)} - {formatTime(event.end_time)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{event.number_of_persons} person(s)</span>
                      </div>
                      <div>
                        <span className="font-semibold">Customer:</span> {event.customer_name}
                      </div>
                      {event.customer_contact && (
                        <div>
                          <span className="font-semibold">Contact:</span> {event.customer_contact}
                        </div>
                      )}
                      {event.customer_address && (
                        <div>
                          <span className="font-semibold">Address:</span> {event.customer_address}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-4">
                      <h4 className="font-semibold text-[var(--text-primary)] mb-2">Charges Summary</h4>
                      <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                        <div className="flex justify-between">
                          <span>Menu Total:</span>
                          <span>${parseFloat(event.menu_total?.toString() || "0").toFixed(2)}</span>
                        </div>
                        {event.extras && event.extras.length > 0 && (
                          <div className="mt-3">
                            <h5 className="font-semibold text-[var(--text-primary)] mb-2 text-sm">Extras (Set Prices):</h5>
                            <div className="space-y-2">
                              {event.extras.map((extra: any, index: number) => (
                                <div key={index} className="flex items-center gap-2">
                                  <span className="flex-1 text-sm">{extra.name || `Extra ${index + 1}`}:</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={extrasCharges[event.id]?.[index] ?? (extra.charges || "")}
                                    onChange={(e) => {
                                      setExtrasCharges((prev) => ({
                                        ...prev,
                                        [event.id]: {
                                          ...(prev[event.id] || {}),
                                          [index]: e.target.value,
                                        },
                                      }));
                                    }}
                                    placeholder="0.00"
                                    className="w-24 px-2 py-1 bg-[var(--background)] border-2 border-[var(--border)] rounded text-[var(--text-primary)] text-sm focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between mt-2 pt-2 border-t border-[var(--border)]">
                              <span>Extras Total:</span>
                              <span>
                                $
                                {(
                                  event.extras.reduce((sum: number, extra: any, idx: number) => {
                                    const charge = extrasCharges[event.id]?.[idx];
                                    return sum + (charge ? parseFloat(charge) : (extra.charges || 0));
                                  }, 0)
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold text-[var(--text-primary)] border-t-2 border-[var(--border)] pt-2 mt-2">
                          <span>Total (Before Service Charges):</span>
                          <span>
                            $
                            {(
                              parseFloat(event.menu_total?.toString() || "0") +
                              (event.extras?.reduce((sum: number, extra: any, idx: number) => {
                                const charge = extrasCharges[event.id]?.[idx];
                                return sum + (charge ? parseFloat(charge) : (extra.charges || 0));
                              }, 0) || 0)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Service Charges (Optional)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={serviceCharges[event.id] || ""}
                        onChange={(e) =>
                          setServiceCharges({ ...serviceCharges, [event.id]: e.target.value })
                        }
                        placeholder="0.00"
                        className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)]"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(event.id)}
                        disabled={approvingId === event.id}
                        className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        {approvingId === event.id ? "Approving..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleReject(event.id)}
                        disabled={approvingId === event.id}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
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

