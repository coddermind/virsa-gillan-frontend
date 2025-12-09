"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { apiClient, Event, BudgetEntry, EventPayment } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function EventDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id ? parseInt(params.id as string) : null;

  const [event, setEvent] = useState<Event | null>(null);
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>([]);
  const [eventPayments, setEventPayments] = useState<EventPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);
  const [editingPayment, setEditingPayment] = useState<EventPayment | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "payable" as "payable" | "paid",
    amount: "",
    date: new Date().toISOString().split("T")[0], // Default to today
  });
  const [paymentFormData, setPaymentFormData] = useState({
    amount: "",
    payment_method: "cash" as "cash" | "credit_card" | "debit_card" | "bank_transfer" | "check" | "paypal" | "venmo" | "zelle" | "other",
    payment_date: new Date().toISOString().split("T")[0], // Default to today
    notes: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else if (id) {
      loadEvent();
    }
  }, [user, router, id]);

  const loadEvent = async () => {
    if (!id) return;

    try {
      const data = await apiClient.getEvent(id);
      setEvent(data);
      setBudgetEntries(data.budget_entries || []);
      setEventPayments(data.event_payments || []);
    } catch (error) {
      console.error("Failed to load event:", error);
      setError("Failed to load event data");
    } finally {
      setLoading(false);
    }
  };

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!id) {
      setError("Invalid event ID");
      return;
    }

    try {
      const submitData: any = {
        event: id,
        name: formData.name.trim(),
        type: formData.type,
        amount: parseFloat(formData.amount),
        date: formData.date,
      };

      if (editingEntry) {
        await apiClient.updateBudgetEntry(editingEntry.id, submitData);
      } else {
        await apiClient.createBudgetEntry(submitData);
      }

      setShowBudgetForm(false);
      setEditingEntry(null);
      setFormData({
        name: "",
        type: "payable",
        amount: "",
        date: new Date().toISOString().split("T")[0],
      });
      loadEvent(); // Reload to get updated totals
    } catch (err: any) {
      setError(err.message || "Failed to save budget entry");
    }
  };

  const handleEdit = (entry: BudgetEntry) => {
    setEditingEntry(entry);
    setFormData({
      name: entry.name,
      type: entry.type,
      amount: entry.amount,
      date: entry.date,
    });
    setShowBudgetForm(true);
  };

  const handleDelete = async (entryId: number) => {
    if (!confirm("Are you sure you want to delete this budget entry?")) return;

    try {
      await apiClient.deleteBudgetEntry(entryId);
      loadEvent();
    } catch (err: any) {
      alert(err.message || "Failed to delete budget entry");
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!id) {
      setError("Invalid event ID");
      return;
    }

    try {
      const submitData: any = {
        event: id,
        amount: parseFloat(paymentFormData.amount),
        payment_method: paymentFormData.payment_method,
        payment_date: paymentFormData.payment_date,
        notes: paymentFormData.notes.trim() || undefined,
      };

      if (editingPayment) {
        await apiClient.updateEventPayment(editingPayment.id, submitData);
      } else {
        await apiClient.createEventPayment(submitData);
      }

      setShowPaymentForm(false);
      setEditingPayment(null);
      setPaymentFormData({
        amount: "",
        payment_method: "cash",
        payment_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      loadEvent(); // Reload to get updated totals
    } catch (err: any) {
      setError(err.message || "Failed to save payment");
    }
  };

  const handleEditPayment = (payment: EventPayment) => {
    setEditingPayment(payment);
    setPaymentFormData({
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      notes: payment.notes || "",
    });
    setShowPaymentForm(true);
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;

    try {
      await apiClient.deleteEventPayment(paymentId);
      loadEvent();
    } catch (err: any) {
      alert(err.message || "Failed to delete payment");
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
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-[var(--text-secondary)]">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!event) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <p className="text-[var(--text-secondary)] mb-4">Event not found</p>
            <Link
              href="/dashboard/events"
              prefetch={false}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Events
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const pendingCharges = event.pending_charges ?? (parseFloat(event.total_charges.toString()) - parseFloat(event.total_payments_received.toString()));

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
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">{event.name}</h2>
              <p className="text-[var(--text-secondary)] transition-colors duration-300">{event.location} • {formatDateTimeRange(event)}</p>
            </div>
            <Link
              href={`/dashboard/events/${event.id}/edit`}
              prefetch={false}
              className="px-4 py-2 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 text-sm border-2 border-[var(--border)]"
            >
              Edit Event
            </Link>
          </div>
        </div>

        {/* Event Details */}
        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 mb-6 transition-colors duration-300">
          <h3 className="text-xl font-bold text-[var(--text-primary)] border-b-2 border-[var(--border)] pb-2 mb-6">
            Event Details
          </h3>
          
          <div className="space-y-6">
            {/* Row 1: Customer Name, Event Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Customer Name</p>
                <p className="font-semibold text-[var(--text-primary)] text-lg">{event.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Event Name</p>
                <p className="font-semibold text-[var(--text-primary)] text-lg">{event.name}</p>
              </div>
            </div>

            {/* Row 2: Customer Contact, Event Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Customer Contact</p>
                <p className="font-medium text-[var(--text-primary)]">
                  {event.customer_contact || <span className="text-[var(--text-secondary)] italic">Not provided</span>}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Event Location</p>
                <p className="font-medium text-[var(--text-primary)]">{event.location}</p>
              </div>
            </div>

            {/* Row 3: Number of Persons, Event Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Number of Persons</p>
                <p className="font-medium text-[var(--text-primary)]">{event.number_of_persons || 1}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Event Date & Time</p>
                <p className="font-medium text-[var(--text-primary)]">{formatDateTimeRange(event)}</p>
              </div>
            </div>

            {/* Row 4: Time Slot */}
            {event.time_slot_display && (
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Time Slot</p>
                <p className="font-medium text-[var(--text-primary)]">{event.time_slot_display}</p>
              </div>
            )}

            {/* Row 5: Customer Address (full width) */}
            {event.customer_address && (
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Customer Address</p>
                <p className="font-medium text-[var(--text-primary)]">{event.customer_address}</p>
              </div>
            )}

            {/* Menus Section */}
            {event.selected_menus_details && event.selected_menus_details.length > 0 && (
              <div className="pt-4 border-t-2 border-[var(--border)]">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Selected Menus</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {event.selected_menus_details.map((menu: any) => (
                    <div
                      key={menu.id}
                      className="p-3 bg-[var(--hover-bg)] border-2 border-[var(--border)] rounded-lg"
                    >
                      <p className="font-semibold text-[var(--text-primary)]">{menu.name}</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {menu.cuisine_name} • {menu.item_type_name}
                      </p>
                      <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                        ${parseFloat(menu.price || "0").toFixed(2)} per person
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extras Section */}
            {event.extras && event.extras.length > 0 && (
              <div className="pt-4 border-t-2 border-[var(--border)]">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Extras</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {event.extras.map((extra: any, index: number) => (
                    <div
                      key={index}
                      className="p-3 bg-[var(--hover-bg)] border-2 border-[var(--border)] rounded-lg"
                    >
                      <p className="font-semibold text-[var(--text-primary)]">{extra.name}</p>
                      <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                        ${parseFloat(extra.charges || "0").toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charges Breakdown */}
            <div className="pt-4 border-t-2 border-[var(--border)]">
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Charges Breakdown</p>
              <div className="space-y-2">
                {event.menu_total && parseFloat(event.menu_total.toString()) > 0 && (
                  <div className="flex justify-between items-center p-2 bg-blue-500/10 rounded-lg">
                    <span className="text-sm text-[var(--text-secondary)]">Menu Total</span>
                    <span className="font-semibold text-blue-500">
                      ${parseFloat(event.menu_total.toString()).toFixed(2)}
                    </span>
                  </div>
                )}
                {event.extras && event.extras.length > 0 && (
                  <div className="flex justify-between items-center p-2 bg-purple-500/10 rounded-lg">
                    <span className="text-sm text-[var(--text-secondary)]">Extras Total</span>
                    <span className="font-semibold text-purple-500">
                      ${event.extras.reduce((sum: number, extra: any) => sum + parseFloat(extra.charges || "0"), 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {event.additional_charges && parseFloat(event.additional_charges.toString()) > 0 && (
                  <div className="flex justify-between items-center p-2 bg-orange-500/10 rounded-lg">
                    <span className="text-sm text-[var(--text-secondary)]">Service Charges</span>
                    <span className="font-semibold text-orange-500">
                      ${parseFloat(event.additional_charges.toString()).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border-2 border-green-500 mt-3">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Total Charges</span>
                  <span className="text-xl font-bold text-green-500">
                    ${parseFloat(event.total_charges.toString()).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charges Summary */}
        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 mb-6 transition-colors duration-300">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Charges & Payments</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[var(--border)]/10 rounded-lg border-2 border-[var(--border)] transition-colors duration-300">
              <p className="text-sm text-[var(--text-secondary)] mb-1">Total Charges</p>
              <p className="text-2xl font-bold text-[var(--border)]">
                ${parseFloat(event.total_charges.toString()).toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg border-2 border-green-500 transition-colors duration-300">
              <p className="text-sm text-[var(--text-secondary)] mb-1">Payments Received</p>
              <p className="text-2xl font-bold text-green-500">
                ${parseFloat(event.total_payments_received.toString()).toFixed(2)}
              </p>
            </div>
            <div className={`p-4 rounded-lg border-2 transition-colors duration-300 ${pendingCharges > 0 ? "bg-[var(--border)]/10 border-[var(--border)]" : "bg-[var(--hover-bg)] border-[var(--border)]"}`}>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Pending Charges</p>
              <p className={`text-2xl font-bold ${pendingCharges > 0 ? "text-[var(--border)]" : "text-[var(--text-secondary)]"}`}>
                ${pendingCharges.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Expenses Summary */}
        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 mb-6 transition-colors duration-300">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Expenses</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-red-500/10 rounded-lg border-2 border-red-500 transition-colors duration-300">
              <p className="text-sm text-[var(--text-secondary)] mb-1">Total Payable</p>
              <p className="text-2xl font-bold text-red-500">
                ${parseFloat(event.total_payable.toString()).toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg border-2 border-green-500 transition-colors duration-300">
              <p className="text-sm text-[var(--text-secondary)] mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-green-500">
                ${parseFloat(event.total_paid.toString()).toFixed(2)}
              </p>
            </div>
          </div>
          <div className="pt-4 border-t-2 border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Profit</p>
            <p className={`text-3xl font-bold ${(parseFloat(event.total_charges.toString()) - (parseFloat(event.total_payable.toString()) + parseFloat(event.total_paid.toString()))) >= 0 ? "text-green-500" : "text-red-500"}`}>
              ${(parseFloat(event.total_charges.toString()) - (parseFloat(event.total_payable.toString()) + parseFloat(event.total_paid.toString()))).toFixed(2)}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Total Charges - (Payable + Paid)</p>
          </div>
        </div>

        {/* Budget Entries */}
        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Budget Entries</h3>
            <button
              onClick={() => {
                setShowBudgetForm(true);
                setEditingEntry(null);
                setFormData({
                  name: "",
                  type: "payable",
                  amount: "",
                  date: new Date().toISOString().split("T")[0],
                });
              }}
              className="px-4 py-2 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 text-sm border-2 border-[var(--border)]"
            >
              Add Entry
            </button>
          </div>

          {showBudgetForm && (
            <div className="mb-6 p-4 bg-[var(--hover-bg)] rounded-lg border-2 border-[var(--border)] transition-colors duration-300">
              <h4 className="font-semibold text-[var(--text-primary)] mb-4 transition-colors duration-300">
                {editingEntry ? "Edit Budget Entry" : "Add Budget Entry"}
              </h4>
              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border-2 border-red-500 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleBudgetSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200"
                      placeholder="e.g., Employee David, Fruits"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      required
                      className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200"
                    >
                      <option value="payable">Payable</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 text-sm border-2 border-[var(--border)]"
                  >
                    {editingEntry ? "Update" : "Add"} Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBudgetForm(false);
                      setEditingEntry(null);
                      setFormData({
                        name: "",
                        type: "payable",
                        amount: "",
                        date: new Date().toISOString().split("T")[0],
                      });
                    }}
                    className="px-4 py-2 bg-[var(--hover-bg)] text-[var(--text-primary)] rounded-lg font-medium hover:bg-[var(--hover-bg)]/80 transition-colors duration-200 text-sm border-2 border-[var(--border)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {budgetEntries.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              <p>No budget entries yet. Add your first entry to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[var(--border)]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">Type</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">Date</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetEntries.map((entry) => {
                    const typeColors: { [key: string]: string } = {
                      payable: "bg-red-500/20 text-red-400 border border-red-500",
                      paid: "bg-green-500/20 text-green-400 border border-green-500",
                    };
                    return (
                      <tr key={entry.id} className="border-b border-[var(--border)] hover:bg-[var(--hover-bg)] transition-colors duration-200">
                        <td className="py-3 px-4 text-sm text-[var(--text-primary)]">{entry.name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${typeColors[entry.type]}`}>
                            {entry.type_display}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-[var(--text-primary)] text-right">
                          ${parseFloat(entry.amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{formatDate(entry.date)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(entry)}
                              className="px-3 py-1 text-xs bg-[var(--border)]/20 text-[var(--border)] rounded hover:bg-[var(--border)]/30 transition-colors duration-200 border border-[var(--border)]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors duration-200 border border-red-500"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Event Payments */}
        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 mt-6 transition-colors duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Payments Received</h3>
            <button
              onClick={() => {
                setShowPaymentForm(true);
                setEditingPayment(null);
                setPaymentFormData({
                  amount: "",
                  payment_method: "cash",
                  payment_date: new Date().toISOString().split("T")[0],
                  notes: "",
                });
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors duration-200 text-sm border-2 border-green-500"
            >
              Add Payment
            </button>
          </div>

          {showPaymentForm && (
            <div className="mb-6 p-4 bg-[var(--hover-bg)] rounded-lg border-2 border-[var(--border)] transition-colors duration-300">
              <h4 className="font-semibold text-[var(--text-primary)] mb-4 transition-colors duration-300">
                {editingPayment ? "Edit Payment" : "Add Payment"}
              </h4>
              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border-2 border-red-500 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentFormData.amount}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                      required
                      min="0"
                      className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Payment Method *
                    </label>
                    <select
                      value={paymentFormData.payment_method}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value as any })}
                      required
                      className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    >
                      <option value="cash">Cash</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="debit_card">Debit Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="check">Check</option>
                      <option value="paypal">PayPal</option>
                      <option value="venmo">Venmo</option>
                      <option value="zelle">Zelle</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      value={paymentFormData.payment_date}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                      required
                      className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={paymentFormData.notes}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                      className="w-full px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors duration-200 text-sm border-2 border-green-500"
                  >
                    {editingPayment ? "Update" : "Add"} Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentForm(false);
                      setEditingPayment(null);
                      setPaymentFormData({
                        amount: "",
                        payment_method: "cash",
                        payment_date: new Date().toISOString().split("T")[0],
                        notes: "",
                      });
                    }}
                    className="px-4 py-2 bg-[var(--hover-bg)] text-[var(--text-primary)] rounded-lg font-medium hover:bg-[var(--hover-bg)]/80 transition-colors duration-200 text-sm border-2 border-[var(--border)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {eventPayments.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              <p>No payments recorded yet. Add your first payment to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[var(--border)]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">Payment Method</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">Notes</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {eventPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-[var(--border)] hover:bg-[var(--hover-bg)] transition-colors duration-200">
                      <td className="py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">
                        ${parseFloat(payment.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 border border-green-500">
                          {payment.payment_method_display}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{formatDate(payment.payment_date)}</td>
                      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{payment.notes || "-"}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditPayment(payment)}
                            className="px-3 py-1 text-xs bg-[var(--border)]/20 text-[var(--border)] rounded hover:bg-[var(--border)]/30 transition-colors duration-200 border border-[var(--border)]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePayment(payment.id)}
                            className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors duration-200 border border-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

