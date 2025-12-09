"use client";

import { useState, useEffect, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { apiClient, Event, TimeSlot, Cuisine, ItemType, SubItem } from "@/lib/api";
import { Calendar, Clock, MapPin, Users, UtensilsCrossed, Plus, X } from "lucide-react";

// Helper function to format date as YYYY-MM-DD in local timezone
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface SelectedMenu {
  id: number;
  name: string;
  price: string;
  cuisine_name: string;
  item_type_name: string;
}

function EmbedCalendarContent() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("user_id") || null;
  
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({
    customer_name: "",
    customer_contact: "",
    customer_address: "",
    event_name: "",
    location: "",
    date: "",
    time_slot: "",
    number_of_persons: "1",
    selected_menus: [] as SelectedMenu[],
    extras: [] as { name: string }[],
  });
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [modalData, setModalData] = useState({
    cuisine: "",
    item_type: "",
    selected_menu_ids: [] as number[],
  });
  const [availableMenus, setAvailableMenus] = useState<SubItem[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [extrasModalData, setExtrasModalData] = useState({
    name: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (userId) {
      loadCalendarData();
    } else {
      setError("Missing user_id parameter. Please use the embed code from your dashboard.");
      setLoading(false);
    }
  }, [userId]);

  const loadCalendarData = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const data = await apiClient.getPublicCalendar(userId);
      setEvents(Array.isArray(data.events) ? data.events : []);
      setTimeSlots(Array.isArray(data.time_slots) ? data.time_slots : []);
      setCuisines(Array.isArray(data.cuisines) ? data.cuisines : []);
      setItemTypes(Array.isArray(data.item_types) ? data.item_types : []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  };

  const loadMenusForModal = async () => {
    if (!userId || !modalData.cuisine || !modalData.item_type) {
      setAvailableMenus([]);
      return;
    }

    setLoadingMenus(true);
    try {
      const cuisineId = parseInt(modalData.cuisine);
      const itemTypeId = parseInt(modalData.item_type);
      const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;
      if (isNaN(cuisineId) || isNaN(itemTypeId) || isNaN(userIdNum)) {
        throw new Error("Invalid IDs provided");
      }
      const menus = await apiClient.getPublicMenus(userIdNum, cuisineId, itemTypeId);
      setAvailableMenus(Array.isArray(menus) ? menus : []);
    } catch (err) {
      console.error("Failed to load menus:", err);
      setError(err instanceof Error ? err.message : "Failed to load menus");
      setAvailableMenus([]);
    } finally {
      setLoadingMenus(false);
    }
  };

  useEffect(() => {
    if (modalData.cuisine && modalData.item_type && userId) {
      loadMenusForModal();
    } else {
      setAvailableMenus([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalData.cuisine, modalData.item_type, userId]);

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

    setBookingData((prev) => ({
      ...prev,
      selected_menus: [...prev.selected_menus, ...newMenus],
    }));

    closeMenuModal();
  };

  const removeMenu = (menuId: number) => {
    setBookingData((prev) => ({
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
    });
    setShowExtrasModal(true);
  };

  const closeExtrasModal = () => {
    setShowExtrasModal(false);
    setExtrasModalData({
      name: "",
    });
  };

  const addExtra = () => {
    if (!extrasModalData.name.trim()) {
      setError("Please enter an extra name.");
      return;
    }
    const newExtra = {
      name: extrasModalData.name.trim(),
    };
    setBookingData((prev) => ({
      ...prev,
      extras: [...prev.extras, newExtra],
    }));
    closeExtrasModal();
  };

  const removeExtra = (index: number) => {
    setBookingData((prev) => ({
      ...prev,
      extras: prev.extras.filter((_, i) => i !== index),
    }));
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getDayStatus = (date: Date | null): "empty" | "partially-booked" | "fully-booked" => {
    if (!date) return "empty";
    const dateStr = formatDateLocal(date);
    const dayEvents = events.filter((e) => e.date === dateStr);
    if (dayEvents.length === 0) return "empty";

    const jsWeekday = date.getDay();
    const weekdayIndex = jsWeekday === 0 ? 6 : jsWeekday - 1;
    const availableTimeSlots = timeSlots.filter((slot) => slot.weekdays.includes(weekdayIndex));
    const bookedTimeSlotIds = dayEvents.map((e) => e.time_slot).filter((id): id is number => id !== undefined && id !== null);
    const availableSlotsLeft = availableTimeSlots.filter((slot) => !bookedTimeSlotIds.includes(slot.id));

    if (availableSlotsLeft.length === 0) return "fully-booked";
    return "partially-booked";
  };

  const handleDateClick = (date: Date) => {
    const dateStr = formatDateLocal(date);
    const status = getDayStatus(date);
    
    // Don't allow booking if fully booked
    if (status === "fully-booked") {
      return;
    }
    
    setSelectedDate(date);
    setBookingData((prev) => ({ ...prev, date: dateStr }));
    
    // Load available time slots for this day
    const jsWeekday = date.getDay();
    const weekdayIndex = jsWeekday === 0 ? 6 : jsWeekday - 1;
    const slots = timeSlots.filter((slot) => slot.weekdays.includes(weekdayIndex));
    const bookedSlots = events.filter((e) => e.date === dateStr).map((e) => e.time_slot);
    const available = slots.filter((slot) => !bookedSlots.includes(slot.id));
    setAvailableTimeSlots(available);
    setShowBookingForm(true);
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); // Clear any previous errors
    
    if (!bookingData.time_slot) {
      setError("Please select a time slot.");
      return;
    }

    if (bookingData.selected_menus.length === 0) {
      setError("Please add at least one menu.");
      return;
    }

    setSubmitting(true);
    try {
      // Convert extras to include charges as 0 (admin will set charges)
      const extrasWithCharges = bookingData.extras.map(extra => ({
        name: extra.name,
        charges: 0 // Public users cannot set charges
      }));

      const bookingPayload = {
        customer_name: bookingData.customer_name,
        customer_contact: bookingData.customer_contact,
        customer_address: bookingData.customer_address,
        name: bookingData.event_name,
        location: bookingData.location,
        date: bookingData.date,
        time_slot: parseInt(bookingData.time_slot),
        number_of_persons: parseInt(bookingData.number_of_persons) || 1,
        selected_menus: bookingData.selected_menus.map(m => m.id),
        extras: extrasWithCharges,
        additional_charges: 0, // Public users cannot set service charges
        user_id: userId ? parseInt(userId) : undefined,
      };

      console.log("Submitting booking:", bookingPayload);
      const result = await apiClient.bookPublicEvent(bookingPayload);
      console.log("Booking result:", result);
      alert("Booking submitted successfully! It is pending approval.");
      setShowBookingForm(false);
      setSelectedDate(null);
      setBookingData({
        customer_name: "",
        customer_contact: "",
        customer_address: "",
        event_name: "",
        location: "",
        date: "",
        time_slot: "",
        number_of_persons: "1",
        selected_menus: [],
        extras: [],
      });
      loadCalendarData();
    } catch (err: any) {
      setError(err.message || "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = getDaysInMonth(currentDate);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Book Your Event</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border-2 border-yellow-500 shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              ← Prev
            </button>
            <h2 className="text-xl font-bold text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              Next →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center font-semibold text-gray-700 py-2">
                {day}
              </div>
            ))}
            {days.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square"></div>;
              }
              const status = getDayStatus(date);
              const isToday = formatDateLocal(date) === formatDateLocal(new Date());
              
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDateClick(date)}
                  className={`aspect-square rounded-lg border-2 transition-all duration-200 ${
                    status === "fully-booked"
                      ? "bg-red-500/20 border-red-500 text-red-700 cursor-not-allowed"
                      : status === "partially-booked"
                      ? "bg-yellow-500/20 border-yellow-500 text-yellow-700 hover:bg-yellow-500/30"
                      : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                  } ${isToday ? "ring-2 ring-yellow-500" : ""}`}
                  disabled={status === "fully-booked"}
                >
                  <div className="text-sm font-semibold">{date.getDate()}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex gap-4 justify-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-50 border-2 border-gray-300 rounded"></div>
              <span className="text-gray-700">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500/20 border-2 border-yellow-500 rounded"></div>
              <span className="text-gray-700">Partially Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500/20 border-2 border-red-500 rounded"></div>
              <span className="text-gray-700">Fully Booked</span>
            </div>
          </div>
        </div>

        {/* Booking Modal (Popup) */}
        {showBookingForm && (
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
            onClick={() => {
              setShowBookingForm(false);
              setSelectedDate(null);
            }}
          >
            <div 
              className="bg-white rounded-xl shadow-lg border-2 border-yellow-500 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              style={{ position: 'relative', zIndex: 10000 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Book Event</h3>
                <button
                  onClick={() => {
                    setShowBookingForm(false);
                    setSelectedDate(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Name *</label>
                    <input
                      type="text"
                      required
                      value={bookingData.customer_name}
                      onChange={(e) => setBookingData({ ...bookingData, customer_name: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact *</label>
                    <input
                      type="text"
                      required
                      value={bookingData.customer_contact}
                      onChange={(e) => setBookingData({ ...bookingData, customer_contact: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Name *</label>
                  <input
                    type="text"
                    required
                    value={bookingData.event_name}
                    onChange={(e) => setBookingData({ ...bookingData, event_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                  <input
                    type="text"
                    required
                    value={bookingData.location}
                    onChange={(e) => setBookingData({ ...bookingData, location: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of Persons *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={bookingData.number_of_persons}
                    onChange={(e) => setBookingData({ ...bookingData, number_of_persons: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time Slot *</label>
                  {availableTimeSlots.length === 0 ? (
                    <p className="text-red-600">No time slots available for this day.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {availableTimeSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setBookingData({ ...bookingData, time_slot: slot.id.toString() })}
                          className={`p-3 rounded-lg border-2 text-left transition-colors ${
                            bookingData.time_slot === slot.id.toString()
                              ? "bg-yellow-500 text-white border-yellow-500 font-semibold"
                              : "bg-white border-gray-400 text-gray-900 hover:bg-yellow-50 hover:border-yellow-400"
                          }`}
                        >
                          <div className={`font-semibold ${bookingData.time_slot === slot.id.toString() ? "text-white" : "text-gray-900"}`}>
                            {slot.name}
                          </div>
                          <div className={`text-sm ${bookingData.time_slot === slot.id.toString() ? "text-white opacity-95" : "text-gray-700"}`}>
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Menus Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Menus *</label>
                  {bookingData.selected_menus.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {bookingData.selected_menus.map((menu) => (
                        <div
                          key={menu.id}
                          className="flex items-center justify-between p-3 bg-gray-50 border-2 border-gray-300 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{menu.name}</div>
                            <div className="text-sm text-gray-600">
                              {menu.cuisine_name} • {menu.item_type_name} • ${menu.price} per person
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMenu(menu.id)}
                            className="ml-4 px-3 py-1 text-sm bg-red-500/20 text-red-600 rounded hover:bg-red-500/30 transition-colors border border-red-500"
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
                    className="w-full p-4 border-2 border-dashed border-gray-400 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Menu</span>
                  </button>
                </div>

                {/* Extras Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Extras (Optional)</label>
                  {bookingData.extras.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {bookingData.extras.map((extra, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 border-2 border-gray-300 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{extra.name}</div>
                            <div className="text-sm text-gray-600">Charges will be set by admin</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExtra(index)}
                            className="ml-4 px-3 py-1 text-sm bg-red-500/20 text-red-600 rounded hover:bg-red-500/30 transition-colors border border-red-500"
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
                    className="w-full p-4 border-2 border-dashed border-gray-400 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Extra</span>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address (Optional)</label>
                  <textarea
                    value={bookingData.customer_address}
                    onChange={(e) => setBookingData({ ...bookingData, customer_address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900 bg-white"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-6 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Submitting..." : "Submit Booking"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBookingForm(false);
                      setSelectedDate(null);
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Menu Selection Modal */}
        {showMenuModal && mounted && typeof window !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10001] p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10001 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeMenuModal();
              }
            }}
          >
            <div
              className="bg-white rounded-xl shadow-lg border-2 border-yellow-500 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', zIndex: 10002 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Add Menu</h3>
                <button
                  type="button"
                  onClick={closeMenuModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cuisine *</label>
                  <select
                    value={modalData.cuisine}
                    onChange={(e) => setModalData({ ...modalData, cuisine: e.target.value, item_type: "", selected_menu_ids: [] })}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900 bg-white"
                  >
                    <option value="">Select Cuisine</option>
                    {cuisines.map((cuisine) => (
                      <option key={cuisine.id} value={cuisine.id}>
                        {cuisine.name}
                      </option>
                    ))}
                  </select>
                </div>

                {modalData.cuisine && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Menu Item Type *</label>
                    <select
                      value={modalData.item_type}
                      onChange={(e) => setModalData({ ...modalData, item_type: e.target.value, selected_menu_ids: [] })}
                      required
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900 bg-white"
                    >
                      <option value="">Select Menu Item Type</option>
                      {itemTypes.map((itemType) => (
                        <option key={itemType.id} value={itemType.id}>
                          {itemType.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {modalData.cuisine && modalData.item_type && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Available Menus</label>
                    {loadingMenus ? (
                      <div className="p-4 text-center text-gray-600">Loading menus...</div>
                    ) : availableMenus.length === 0 ? (
                      <div className="p-4 bg-yellow-50 border-2 border-yellow-500 rounded-lg text-yellow-700 text-sm">
                        No menus available for this cuisine and item type.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {availableMenus.map((menu) => (
                          <button
                            key={menu.id}
                            type="button"
                            onClick={() => toggleMenuInModal(menu.id)}
                            className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
                              modalData.selected_menu_ids.includes(menu.id)
                                ? "bg-yellow-500 text-white border-yellow-500"
                                : "bg-white border-gray-400 text-gray-900 hover:bg-yellow-50 hover:border-yellow-400"
                            }`}
                          >
                            <div className="font-semibold">{menu.name}</div>
                            <div className={`text-sm ${modalData.selected_menu_ids.includes(menu.id) ? "text-white opacity-95" : "text-gray-700"}`}>
                              ${menu.price || "0.00"} per person
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={addMenusFromModal}
                    className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
                  >
                    Add Selected Menus
                  </button>
                  <button
                    type="button"
                    onClick={closeMenuModal}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
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
        {showExtrasModal && mounted && typeof window !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10001] p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10001 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeExtrasModal();
              }
            }}
          >
            <div
              className="bg-white rounded-xl shadow-lg border-2 border-yellow-500 p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', zIndex: 10002 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Add Extra Item</h3>
                <button
                  type="button"
                  onClick={closeExtrasModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={extrasModalData.name}
                    onChange={(e) => setExtrasModalData({ ...extrasModalData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-gray-900 bg-white"
                    placeholder="e.g., Decoration, DJ Service"
                  />
                  <p className="mt-1 text-xs text-gray-500">Charges will be set by the admin when approving your booking.</p>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={addExtra}
                    className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
                  >
                    Add Extra
                  </button>
                  <button
                    type="button"
                    onClick={closeExtrasModal}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
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
    </div>
  );
}

export default function EmbedCalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading calendar...</p>
        </div>
      </div>
    }>
      <EmbedCalendarContent />
    </Suspense>
  );
}

