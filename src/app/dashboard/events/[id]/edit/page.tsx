"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { apiClient, Event, TimeSlot, Cuisine, ItemType, SubItem } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

interface SelectedMenu {
  id: number;
  name: string;
  price: string;
  cuisine_name: string;
  item_type_name: string;
}

export default function EditEventPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id ? parseInt(params.id as string) : null;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    date: "",
    time_slot: "",
    number_of_persons: "1",
    selected_menus: [] as SelectedMenu[],
    extras: [] as { name: string; charges: number }[],
    service_charges: "0",
    customer_name: "",
    customer_contact: "",
    customer_address: "",
  });
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [availableMenus, setAvailableMenus] = useState<SubItem[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [modalData, setModalData] = useState({
    cuisine: "",
    item_type: "",
    selected_menu_ids: [] as number[],
  });
  const [extrasModalData, setExtrasModalData] = useState({
    name: "",
    charges: "",
  });
  const [calculatedMenuTotal, setCalculatedMenuTotal] = useState(0);
  const [calculatedExtrasTotal, setCalculatedExtrasTotal] = useState(0);
  const [calculatedTotalCharges, setCalculatedTotalCharges] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else if (id) {
      loadEvent();
    }
  }, [user, router, id]);

  // Load cuisines and item types on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [cuisinesData, itemTypesData] = await Promise.all([
          apiClient.getCuisines(),
          apiClient.getItemTypes(),
        ]);
        setCuisines(Array.isArray(cuisinesData) ? cuisinesData : []);
        setItemTypes(Array.isArray(itemTypesData) ? itemTypesData : []);
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };
    if (user) {
      loadInitialData();
    }
  }, [user]);

  // Load time slots when date changes (but not on initial load)
  useEffect(() => {
    if (formData.date && event) {
      loadTimeSlotsForDate();
    }
  }, [formData.date]);

  // Load menus when modal cuisine and item_type change
  useEffect(() => {
    if (modalData.cuisine && modalData.item_type) {
      loadMenusForModal();
    } else {
      setAvailableMenus([]);
    }
  }, [modalData.cuisine, modalData.item_type]);

  // Calculate menu total when selected menus, number of persons, or cuisines change
  useEffect(() => {
    calculateMenuTotal();
  }, [formData.selected_menus, formData.number_of_persons, cuisines]);

  // Calculate extras total when extras change
  useEffect(() => {
    const total = formData.extras.reduce((sum, extra) => sum + (extra.charges || 0), 0);
    setCalculatedExtrasTotal(total);
  }, [formData.extras]);

  // Calculate total charges when menu total, extras total, or service charges change
  useEffect(() => {
    const menuTotal = calculatedMenuTotal;
    const extrasTotal = calculatedExtrasTotal;
    const serviceCharges = parseFloat(formData.service_charges) || 0;
    setCalculatedTotalCharges(menuTotal + extrasTotal + serviceCharges);
  }, [calculatedMenuTotal, calculatedExtrasTotal, formData.service_charges]);

  const loadEvent = async () => {
    if (!id) return;

    try {
      const data = await apiClient.getEvent(id);
      setEvent(data);
      
      const dateStr = data.date || (data.date_time ? data.date_time.split("T")[0] : "");
      
      // Convert selected_menus_details to SelectedMenu format
      const selectedMenus: SelectedMenu[] = (data.selected_menus_details || []).map((menu: any) => ({
        id: menu.id,
        name: menu.name,
        price: menu.price || "0.00",
        cuisine_name: menu.cuisine_name,
        item_type_name: menu.item_type_name,
      }));
      
      setFormData({
        name: data.name || "",
        location: data.location || "",
        date: dateStr,
        time_slot: data.time_slot ? String(data.time_slot) : "",
        number_of_persons: data.number_of_persons ? String(data.number_of_persons) : "1",
        selected_menus: selectedMenus,
        extras: (data.extras || []).map((extra: any) => ({
          name: extra.name || "",
          charges: typeof extra.charges === 'number' ? extra.charges : parseFloat(extra.charges || "0"),
        })),
        service_charges: data.additional_charges ? String(data.additional_charges) : "0",
        customer_name: data.customer_name || "",
        customer_contact: data.customer_contact || "",
        customer_address: data.customer_address || "",
      });
      
      if (dateStr) {
        await loadTimeSlotsForDateSync(dateStr, data.time_slot);
      }
    } catch (error) {
      console.error("Failed to load event:", error);
      setError("Failed to load event data");
    } finally {
      setLoading(false);
    }
  };

  const loadTimeSlotsForDateSync = async (dateStr: string, existingTimeSlotId?: number) => {
    if (!dateStr) return;
    
    setLoadingTimeSlots(true);
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const jsWeekday = date.getDay();
      const weekdayIndex = jsWeekday === 0 ? 6 : jsWeekday - 1;
      
      const slots = await apiClient.getTimeSlots(weekdayIndex);
      setAvailableTimeSlots(Array.isArray(slots) ? slots : []);
      
      if (existingTimeSlotId && slots.find((s: TimeSlot) => s.id === existingTimeSlotId)) {
        setFormData((prev) => ({ ...prev, time_slot: String(existingTimeSlotId) }));
      }
    } catch (err) {
      console.error("Failed to load time slots:", err);
      setAvailableTimeSlots([]);
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  const loadTimeSlotsForDate = async () => {
    if (!formData.date) {
      setAvailableTimeSlots([]);
      setFormData((prev) => ({ ...prev, time_slot: "" }));
      return;
    }
    
    setLoadingTimeSlots(true);
    try {
      const [year, month, day] = formData.date.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const jsWeekday = date.getDay();
      const weekdayIndex = jsWeekday === 0 ? 6 : jsWeekday - 1;
      
      const slots = await apiClient.getTimeSlots(weekdayIndex);
      setAvailableTimeSlots(Array.isArray(slots) ? slots : []);
    } catch (err) {
      console.error("Failed to load time slots:", err);
      setAvailableTimeSlots([]);
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  const loadMenusForModal = async () => {
    if (!modalData.cuisine || !modalData.item_type) {
      setAvailableMenus([]);
      return;
    }

    setLoadingMenus(true);
    try {
      const cuisineId = parseInt(modalData.cuisine);
      const itemTypeId = parseInt(modalData.item_type);
      const menus = await apiClient.getSubItems(cuisineId, itemTypeId);
      setAvailableMenus(Array.isArray(menus) ? menus : []);
    } catch (err) {
      console.error("Failed to load menus:", err);
      setAvailableMenus([]);
    } finally {
      setLoadingMenus(false);
    }
  };

  const calculateMenuTotal = () => {
    if (!formData.selected_menus.length || !formData.number_of_persons) {
      setCalculatedMenuTotal(0);
      return;
    }

    const numberOfPersons = parseInt(formData.number_of_persons) || 1;
    
    // Check if all menus belong to the same cuisine and if that cuisine has a price
    const firstMenu = formData.selected_menus[0];
    if (firstMenu && firstMenu.cuisine_name) {
      const cuisine = cuisines.find(c => c.name === firstMenu.cuisine_name);
      // Check if all menus belong to the same cuisine
      const allSameCuisine = formData.selected_menus.every(m => m.cuisine_name === firstMenu.cuisine_name);
      
      if (allSameCuisine && cuisine && cuisine.price) {
        // Use cuisine price per person
        const cuisinePrice = parseFloat(String(cuisine.price)) || 0;
        setCalculatedMenuTotal(cuisinePrice * numberOfPersons);
        return;
      }
    }
    
    // Fallback to individual menu prices
    let total = 0;
    formData.selected_menus.forEach((menu) => {
      if (menu.price) {
        total += parseFloat(menu.price) * numberOfPersons;
      }
    });

    setCalculatedMenuTotal(total);
  };

  const openMenuModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setModalData({
      cuisine: "",
      item_type: "",
      selected_menu_ids: [],
    });
    setShowMenuModal(true);
  };

  const closeMenuModal = () => {
    setShowMenuModal(false);
    setModalData({
      cuisine: "",
      item_type: "",
      selected_menu_ids: [],
    });
    setAvailableMenus([]);
  };

  const toggleMenuInModal = (menuId: number) => {
    setModalData((prev) => {
      const currentSelection = prev.selected_menu_ids;
      if (currentSelection.includes(menuId)) {
        return { ...prev, selected_menu_ids: currentSelection.filter((id) => id !== menuId) };
      } else {
        return { ...prev, selected_menu_ids: [...currentSelection, menuId] };
      }
    });
  };

  const addMenusFromModal = () => {
    if (modalData.selected_menu_ids.length === 0) {
      setError("Please select at least one menu.");
      return;
    }

    const newMenus: SelectedMenu[] = modalData.selected_menu_ids.map((menuId) => {
      const menu = availableMenus.find((m) => m.id === menuId);
      return {
        id: menu!.id,
        name: menu!.name,
        price: menu!.price || "0.00",
        cuisine_name: menu!.cuisine_name,
        item_type_name: menu!.item_type_name,
      };
    });

    setFormData((prev) => ({
      ...prev,
      selected_menus: [...prev.selected_menus, ...newMenus],
    }));

    closeMenuModal();
  };

  const removeMenu = (menuId: number) => {
    setFormData((prev) => ({
      ...prev,
      selected_menus: prev.selected_menus.filter((m) => m.id !== menuId),
    }));
  };

  const openExtrasModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setExtrasModalData({
      name: "",
      charges: "",
    });
    setShowExtrasModal(true);
  };

  const closeExtrasModal = () => {
    setShowExtrasModal(false);
    setExtrasModalData({
      name: "",
      charges: "",
    });
  };

  const addExtra = () => {
    if (!extrasModalData.name.trim() || !extrasModalData.charges) {
      setError("Please enter both extra name and charges.");
      return;
    }

    const charges = parseFloat(extrasModalData.charges);
    if (isNaN(charges) || charges < 0) {
      setError("Please enter a valid charges amount.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      extras: [...prev.extras, { name: extrasModalData.name.trim(), charges }],
    }));

    closeExtrasModal();
  };

  const removeExtra = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      extras: prev.extras.filter((_, i) => i !== index),
    }));
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    if (!id) {
      setError("Invalid event ID");
      setSubmitting(false);
      return;
    }

    if (!formData.time_slot) {
      setError("Please select a time slot.");
      setSubmitting(false);
      return;
    }

    if (formData.selected_menus.length === 0) {
      setError("Please add at least one menu.");
      setSubmitting(false);
      return;
    }

    try {
      const cleanedData: any = {
        name: formData.name.trim(),
        location: formData.location.trim(),
        date: formData.date,
        time_slot: parseInt(formData.time_slot),
        cuisine: formData.selected_menus[0] ? parseInt(cuisines.find(c => c.name === formData.selected_menus[0].cuisine_name)?.id.toString() || "0") : undefined,
        selected_menus: formData.selected_menus.map((m) => m.id),
        number_of_persons: parseInt(formData.number_of_persons) || 1,
        extras: formData.extras,
        additional_charges: parseFloat(formData.service_charges) || 0,
        customer_name: formData.customer_name.trim(),
        customer_contact: formData.customer_contact.trim() || undefined,
        customer_address: formData.customer_address.trim() || undefined,
      };

      await apiClient.updateEvent(id, cleanedData);
      router.push("/dashboard/events");
    } catch (err: any) {
      setError(err.message || "Failed to update event");
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

  if (!event) {
    return (
      <DashboardLayout>
        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
          <p className="text-[var(--text-secondary)] mb-4">Event not found.</p>
          <Link
            href="/dashboard/events"
            prefetch={false}
            className="text-[var(--border)] hover:underline"
          >
            Back to Events
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/events"
            prefetch={false}
            className="text-[var(--border)] hover:text-[var(--primary-dark)] text-sm font-medium mb-4 inline-block transition-colors duration-200"
          >
            ← Back to Events
          </Link>
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">Edit Event</h2>
          <p className="text-[var(--text-secondary)] transition-colors duration-300">Update event details</p>
        </div>

        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300">
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border-2 border-red-500 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Event Details Section */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)] border-b-2 border-[var(--border)] pb-2">
                Event Details
              </h3>
              
              {/* Row 1: Customer Name, Event Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="e.g., John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="e.g., Wedding Reception, Corporate Dinner"
                  />
                </div>
              </div>

              {/* Row 2: Customer Contact, Event Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Customer Contact
                  </label>
                  <input
                    type="text"
                    value={formData.customer_contact}
                    onChange={(e) => setFormData({ ...formData, customer_contact: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="e.g., +1 234-567-8900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Event Location *
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="e.g., Grand Ballroom, Hotel XYZ"
                  />
                </div>
              </div>

              {/* Row 3: Number of Persons, Event Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Number of Persons *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.number_of_persons}
                    onChange={(e) => setFormData({ ...formData, number_of_persons: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value, time_slot: "" })}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                  />
                </div>
              </div>

              {/* Row 4: Time Slots (three columns) */}
              {formData.date && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Time Slot *
                  </label>
                  {loadingTimeSlots ? (
                    <div className="p-4 text-center text-[var(--text-secondary)]">
                      Loading available time slots...
                    </div>
                  ) : availableTimeSlots.length === 0 ? (
                    <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500 rounded-lg text-yellow-500 text-sm">
                      No time slots available for this day. Please create time slots for this weekday first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {availableTimeSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, time_slot: slot.id.toString() })}
                          className={`p-4 rounded-lg border-2 transition-colors duration-200 text-left ${
                            formData.time_slot === slot.id.toString()
                              ? "bg-[var(--border)] text-[var(--background)] border-[var(--border)]"
                              : "bg-[var(--background)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                          }`}
                        >
                          <div className="font-semibold">{slot.name}</div>
                          <div className="text-sm opacity-80">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Row 5: Customer Address (full width) */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Customer Address
                </label>
                <textarea
                  value={formData.customer_address}
                  onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                  placeholder="Address (optional)"
                />
              </div>
            </div>

            {/* Menus and Extras Section */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)] border-b-2 border-[var(--border)] pb-2">
                Menus & Extras
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Menus Column */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Menus *
                  </label>
                  {formData.selected_menus.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {formData.selected_menus.map((menu) => (
                        <div
                          key={menu.id}
                          className="flex items-center justify-between p-3 bg-[var(--hover-bg)] border-2 border-[var(--border)] rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-[var(--text-primary)]">{menu.name}</div>
                            <div className="text-sm text-[var(--text-secondary)]">
                              {menu.cuisine_name} • {menu.item_type_name}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMenu(menu.id)}
                            className="ml-4 px-3 py-1 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors duration-200 border border-red-500"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openMenuModal();
                    }}
                    className="w-full p-4 border-2 border-dashed border-[var(--border)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <span className="text-2xl">+</span>
                    <span className="font-medium">Add Menu</span>
                  </button>
                </div>

                {/* Extras Column */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Extras
                  </label>
                  {formData.extras.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {formData.extras.map((extra, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-[var(--hover-bg)] border-2 border-[var(--border)] rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-[var(--text-primary)]">{extra.name}</div>
                            <div className="text-sm text-[var(--text-secondary)]">
                              ${extra.charges.toFixed(2)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExtra(index)}
                            className="ml-4 px-3 py-1 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors duration-200 border border-red-500"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openExtrasModal();
                    }}
                    className="w-full p-4 border-2 border-dashed border-[var(--border)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <span className="text-2xl">+</span>
                    <span className="font-medium">Add Extra</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Charges Section */}
            {formData.selected_menus.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-[var(--text-primary)] border-b-2 border-[var(--border)] pb-2">
                  Charges
                </h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-blue-500/10 border-2 border-blue-500 rounded-lg">
                    <p className="text-sm text-[var(--text-secondary)] mb-1">Menu Total (Calculated)</p>
                    <p className="text-2xl font-bold text-blue-500">
                      ${calculatedMenuTotal.toFixed(2)}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {formData.selected_menus.length} menu(s) × {formData.number_of_persons} person(s)
                    </p>
                  </div>

                  {formData.extras.length > 0 && (
                    <div className="p-4 bg-purple-500/10 border-2 border-purple-500 rounded-lg">
                      <p className="text-sm text-[var(--text-secondary)] mb-1">Extras Total</p>
                      <p className="text-2xl font-bold text-purple-500">
                        ${calculatedExtrasTotal.toFixed(2)}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {formData.extras.length} extra(s) added
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Service Charges
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.service_charges}
                      onChange={(e) => setFormData({ ...formData, service_charges: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="p-4 bg-green-500/10 border-2 border-green-500 rounded-lg">
                    <p className="text-sm text-[var(--text-secondary)] mb-1">Total Charges (Event Total Receivable)</p>
                    <p className="text-3xl font-bold text-green-500">
                      ${calculatedTotalCharges.toFixed(2)}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Menu Total + Extras Total + Service Charges
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-[var(--border)]"
              >
                {submitting ? "Updating..." : "Update Event"}
              </button>
              <Link
                href="/dashboard/events"
                prefetch={false}
                className="px-6 py-3 bg-[var(--hover-bg)] text-[var(--text-primary)] rounded-lg font-medium hover:bg-[var(--hover-bg)]/80 transition-colors duration-200 border-2 border-[var(--border)]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Menu Selection Modal */}
        {showMenuModal && typeof window !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeMenuModal();
              }
            }}
          >
            <div 
              className="bg-[var(--card)] rounded-xl shadow-lg border-2 border-[var(--border)] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', zIndex: 10000 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[var(--text-primary)]">Add Menu</h3>
                <button
                  type="button"
                  onClick={closeMenuModal}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Cuisine *
                    </label>
                    <select
                      value={modalData.cuisine}
                      onChange={(e) => setModalData({ ...modalData, cuisine: e.target.value, item_type: "", selected_menu_ids: [] })}
                      required
                      className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200"
                    >
                      <option value="">Select Cuisine</option>
                      {cuisines.map((cuisine) => (
                        <option key={cuisine.id} value={cuisine.id}>
                          {cuisine.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Menu *
                  </label>
                    <select
                      value={modalData.item_type}
                      onChange={(e) => setModalData({ ...modalData, item_type: e.target.value, selected_menu_ids: [] })}
                      required
                      disabled={!modalData.cuisine}
                      className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Menu</option>
                      {itemTypes.map((itemType) => (
                        <option key={itemType.id} value={itemType.id}>
                          {itemType.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {modalData.cuisine && modalData.item_type && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Select Menus * (Select one or more)
                    </label>
                    {loadingMenus ? (
                      <div className="p-4 text-center text-[var(--text-secondary)]">
                        Loading menus...
                      </div>
                    ) : availableMenus.length === 0 ? (
                      <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500 rounded-lg text-yellow-500 text-sm">
                        No menus available for the selected cuisine and menu item combination.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                        {availableMenus.map((menu) => (
                          <button
                            key={menu.id}
                            type="button"
                            onClick={() => toggleMenuInModal(menu.id)}
                            className={`p-4 rounded-lg border-2 transition-colors duration-200 text-left ${
                              modalData.selected_menu_ids.includes(menu.id)
                                ? "bg-[var(--border)] text-[var(--background)] border-[var(--border)]"
                                : "bg-[var(--background)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--hover-bg)]"
                            }`}
                          >
                            <div className="font-semibold">{menu.name}</div>
                            <div className="text-sm opacity-80">
                              {menu.cuisine_name} • {menu.item_type_name}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={addMenusFromModal}
                    disabled={modalData.selected_menu_ids.length === 0}
                    className="flex-1 px-4 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-[var(--border)]"
                  >
                    Add Selected Menus
                  </button>
                  <button
                    type="button"
                    onClick={closeMenuModal}
                    className="px-4 py-3 bg-[var(--hover-bg)] text-[var(--text-primary)] rounded-lg font-medium hover:bg-[var(--hover-bg)]/80 transition-colors duration-200 border-2 border-[var(--border)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Extras Modal */}
        {showExtrasModal && typeof window !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeExtrasModal();
              }
            }}
          >
            <div 
              className="bg-[var(--card)] rounded-xl shadow-lg border-2 border-[var(--border)] p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', zIndex: 10000 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[var(--text-primary)]">Add Extra</h3>
                <button
                  type="button"
                  onClick={closeExtrasModal}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Extra Name *
                  </label>
                  <input
                    type="text"
                    value={extrasModalData.name}
                    onChange={(e) => setExtrasModalData({ ...extrasModalData, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="e.g., Decoration, Photography"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Charges *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={extrasModalData.charges}
                    onChange={(e) => setExtrasModalData({ ...extrasModalData, charges: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={addExtra}
                    disabled={!extrasModalData.name.trim() || !extrasModalData.charges}
                    className="flex-1 px-4 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-[var(--border)]"
                  >
                    Add Extra
                  </button>
                  <button
                    type="button"
                    onClick={closeExtrasModal}
                    className="px-4 py-3 bg-[var(--hover-bg)] text-[var(--text-primary)] rounded-lg font-medium hover:bg-[var(--hover-bg)]/80 transition-colors duration-200 border-2 border-[var(--border)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </DashboardLayout>
  );
}
