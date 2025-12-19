"use client";

import { useState, useEffect, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { apiClient, Event, TimeSlot, Cuisine, ItemType, SubItem } from "@/lib/api";
import { Calendar, Clock, MapPin, Users, UtensilsCrossed, Plus, X, Mic } from "lucide-react";
import VoiceChat from "@/components/VoiceChat";

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
  item_type_id?: number;
}

function EmbedCalendarContent() {
  const searchParams = useSearchParams();
  const embedToken = searchParams?.get("token") || null;
  
  // Get customizable styling from URL parameters (for backward compatibility) or use defaults
  // Note: Data attributes on iframe can't be read due to cross-origin restrictions,
  // but they're shown in embed code for easy editing. Users should update URL params if needed.
  const borderRadius = searchParams?.get("borderRadius") || "8px";
  const borderColor = searchParams?.get("borderColor") || "#fbbf24";
  const borderWidth = searchParams?.get("borderWidth") || "2px";
  const containerBg = searchParams?.get("containerBg") || "#ffffff";
  const inputBg = searchParams?.get("inputBg") || "#ffffff";
  const fontSize = searchParams?.get("fontSize") || "16px";
  const fontFamily = searchParams?.get("fontFamily") || "inherit";
  const textColor = searchParams?.get("textColor") || "#111827";
  
  // Day status colors
  const availableDayBg = searchParams?.get("availableDayBg") || "#f9fafb";
  const availableDayBorder = searchParams?.get("availableDayBorder") || "#e5e7eb";
  const partialDayBg = searchParams?.get("partialDayBg") || "#fef3c7";
  const partialDayBorder = searchParams?.get("partialDayBorder") || "#fbbf24";
  const fullDayBg = searchParams?.get("fullDayBg") || "#fee2e2";
  const fullDayBorder = searchParams?.get("fullDayBorder") || "#f87171";
  const todayRing = searchParams?.get("todayRing") || "#fbbf24";
  
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [eventLocation, setEventLocation] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({
    customer_name: "",
    customer_contact: "",
    customer_email: "",
    customer_address: "",
    event_name: "",
    date: "",
    time_slot: "",
    number_of_persons: "1",
    selected_menus: [] as SelectedMenu[],
    extras: [] as { name: string }[],
    cuisine: "",
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
  // Track selections per menu type to preserve when switching chips
  // Store both menu ID and menu data for easy retrieval
  const [selectionsByMenuType, setSelectionsByMenuType] = useState<Record<number, { id: number; menu: SubItem }>>({});
  const [availableMenus, setAvailableMenus] = useState<SubItem[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [extrasModalData, setExtrasModalData] = useState({
    name: "",
  });
  const [calculatedMenuTotal, setCalculatedMenuTotal] = useState(0);
  const [showVoiceChat, setShowVoiceChat] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (embedToken) {
      loadCalendarData();
    } else {
      setError("Missing token parameter. Please use the embed code from your dashboard.");
      setLoading(false);
    }
  }, [embedToken]);

  const loadCalendarData = async () => {
    if (!embedToken) return;
    
    try {
      setLoading(true);
      const data = await apiClient.getPublicCalendar(embedToken);
      setEvents(Array.isArray(data.events) ? data.events : []);
      setTimeSlots(Array.isArray(data.time_slots) ? data.time_slots : []);
      const loadedCuisines = Array.isArray(data.cuisines) ? data.cuisines : [];
      const loadedItemTypes = Array.isArray(data.item_types) ? data.item_types : [];
      setCuisines(loadedCuisines);
      setItemTypes(loadedItemTypes);
      // Set event location if available
      if (data.event_location) {
        setEventLocation(data.event_location);
      }
      
      // Fetch all subItems (menu items) for all cuisines and item types
      const allSubItems: SubItem[] = [];
      for (const cuisine of loadedCuisines) {
        for (const itemType of loadedItemTypes) {
          try {
            const menus = await apiClient.getPublicMenus(embedToken, cuisine.id, itemType.id);
            if (Array.isArray(menus)) {
              allSubItems.push(...menus);
            }
          } catch (err) {
            // Continue if one fetch fails
            console.warn(`Failed to fetch menus for cuisine ${cuisine.id}, itemType ${itemType.id}:`, err);
          }
        }
      }
      setSubItems(allSubItems);
      
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  };

  const loadMenusForModal = async () => {
    if (!embedToken || !bookingData.cuisine || !modalData.item_type) {
      setAvailableMenus([]);
      return;
    }

    setLoadingMenus(true);
    try {
      const cuisineId = parseInt(bookingData.cuisine);
      const itemTypeId = parseInt(modalData.item_type);
      const menus = await apiClient.getPublicMenus(embedToken, cuisineId, itemTypeId);
      setAvailableMenus(Array.isArray(menus) ? menus : []);

      // Restore selection for this menu type from persistent state
      const savedSelection = selectionsByMenuType[itemTypeId];
      if (savedSelection) {
        setModalData((prev) => ({
          ...prev,
          selected_menu_ids: [savedSelection.id],
        }));
      } else {
        // Fallback to bookingData.selected_menus if not in persistent state
        const existing = bookingData.selected_menus.find(
          (m) => m.item_type_id === itemTypeId
        );
        if (existing) {
          // Try to find the menu in availableMenus to get full data
          const menuInList = menus.find((m) => m.id === existing.id);
          if (menuInList) {
            setModalData((prev) => ({
              ...prev,
              selected_menu_ids: [existing.id],
            }));
            // Also save to persistent state with full menu data
            setSelectionsByMenuType((prev) => ({
              ...prev,
              [itemTypeId]: { id: existing.id, menu: menuInList },
            }));
          } else {
            setModalData((prev) => ({
              ...prev,
              selected_menu_ids: [existing.id],
            }));
          }
        } else {
          setModalData((prev) => ({
            ...prev,
            selected_menu_ids: [],
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load menus:", err);
      setError(err instanceof Error ? err.message : "Failed to load menus");
      setAvailableMenus([]);
    } finally {
      setLoadingMenus(false);
    }
  };

  useEffect(() => {
    if (bookingData.cuisine && modalData.item_type && embedToken) {
      loadMenusForModal();
    } else {
      setAvailableMenus([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingData.cuisine, modalData.item_type, embedToken]);


  // Calculate menu total with cuisine pricing override (matches manager portal)
  useEffect(() => {
    calculateMenuTotal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingData.selected_menus, bookingData.number_of_persons, cuisines, bookingData.cuisine]);

  const calculateMenuTotal = () => {
    if (!bookingData.selected_menus.length || !bookingData.number_of_persons) {
      setCalculatedMenuTotal(0);
      return;
    }

    const numberOfPersons = parseInt(bookingData.number_of_persons) || 1;

    // If all menus share a cuisine and that cuisine has a price, use cuisine price per person
    const firstMenu = bookingData.selected_menus[0];
    if (firstMenu && firstMenu.cuisine_name) {
      const cuisine = cuisines.find((c) => c.name === firstMenu.cuisine_name);
      const allSameCuisine = bookingData.selected_menus.every((m) => m.cuisine_name === firstMenu.cuisine_name);

      if (allSameCuisine && cuisine && cuisine.price) {
        const cuisinePrice = parseFloat(String(cuisine.price)) || 0;
        setCalculatedMenuTotal(cuisinePrice * numberOfPersons);
        return;
      }
    }

    // Otherwise, sum individual menu prices per person
    let total = 0;
    bookingData.selected_menus.forEach((menu) => {
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
    if (!bookingData.cuisine) {
      setError("Please select a cuisine first.");
      return;
    }
    // Find first menu type with a selection (from persistent state or bookingData)
    let firstItemType = "";
    let firstSelection: number | undefined = undefined;
    
    for (const itemType of itemTypes) {
      const savedSelection = selectionsByMenuType[itemType.id];
      const existing = bookingData.selected_menus.find((m) => m.item_type_id === itemType.id);
      if (savedSelection || existing) {
        firstItemType = String(itemType.id);
        firstSelection = savedSelection?.id || existing?.id;
        break;
      }
    }
    
    setModalData((prev) => ({
      ...prev,
      cuisine: bookingData.cuisine,
      item_type: firstItemType,
      selected_menu_ids: firstSelection ? [firstSelection] : [],
    }));
    setShowMenuModal(true);
  };

  const closeMenuModal = () => {
    setShowMenuModal(false);
    setModalData({
      cuisine: bookingData.cuisine || "",
      item_type: "",
      selected_menu_ids: [],
    });
    setAvailableMenus([]);
  };

  const toggleMenuInModal = (menuId: number) => {
    const itemTypeId = parseInt(modalData.item_type);
    const menu = availableMenus.find((m) => m.id === menuId);
    if (!menu) return;
    
    // Check if already selected - toggle behavior
    const isCurrentlySelected = modalData.selected_menu_ids.includes(menuId);
    
    if (isCurrentlySelected) {
      // Deselect - remove from selection
      setModalData((prev) => ({
        ...prev,
        selected_menu_ids: [],
      }));
      // Remove from persistent state
      setSelectionsByMenuType((prev) => {
        const updated = { ...prev };
        delete updated[itemTypeId];
        return updated;
      });
    } else {
      // Select - single selection per menu type
      setModalData((prev) => ({
        ...prev,
        selected_menu_ids: [menuId],
      }));
      // Save to persistent state for this menu type with full menu data
      setSelectionsByMenuType((prev) => ({
        ...prev,
        [itemTypeId]: { id: menuId, menu },
      }));
    }
  };

  const addMenusFromModal = () => {
    // Check if there are any selections in persistent state
    const hasAnySelections = Object.keys(selectionsByMenuType).length > 0;
    if (!hasAnySelections && modalData.selected_menu_ids.length === 0) {
      setError("Please select at least one menu.");
      return;
    }

    // Add all selections from all chips
    const newMenus: SelectedMenu[] = [];
    let firstCuisineId: string | null = null;
    
    // Check if there are existing menus and get their cuisine ID
    const existingCuisineId = bookingData.selected_menus.length > 0 
      ? (() => {
          // Find the cuisine ID from the first existing menu's cuisine_name
          const firstMenu = bookingData.selected_menus[0];
          const cuisine = cuisines.find(c => c.name === firstMenu.cuisine_name);
          return cuisine ? String(cuisine.id) : null;
        })()
      : null;
    
    // Process all selections from persistent state
    for (const [itemTypeIdStr, selection] of Object.entries(selectionsByMenuType)) {
      const itemTypeId = parseInt(itemTypeIdStr);
      const menu = selection.menu;
      const menuCuisineId = String(menu.cuisine);
      
      // Enforce single cuisine selection to align with cuisine pricing
      if (!firstCuisineId) {
        firstCuisineId = menuCuisineId;
      } else if (firstCuisineId !== menuCuisineId) {
        setError("You can only add menus from one cuisine per booking. Please ensure all selected menus belong to the same cuisine.");
        return;
      }
      
      // Check against existing menus if any
      if (existingCuisineId && menuCuisineId !== existingCuisineId) {
        setError("You can only add menus from one cuisine per booking. Please remove existing menus or choose the same cuisine.");
        return;
      }
      
      const newMenu: SelectedMenu = {
        id: menu.id,
        name: menu.name,
        price: menu.price || "0.00",
        cuisine_name: menu.cuisine_name,
        item_type_name: menu.item_type_name,
        item_type_id: menu.item_type ?? itemTypeId,
      };
      newMenus.push(newMenu);
    }

    setBookingData((prev) => {
      let filtered = prev.selected_menus;
      // Remove all menus that match any of the new menu types
      newMenus.forEach((newMenu) => {
        filtered = filtered.filter((m) => m.item_type_id !== newMenu.item_type_id);
      });
      return {
        ...prev,
        selected_menus: [...filtered, ...newMenus],
        cuisine: prev.cuisine || bookingData.cuisine,
      };
    });

    closeMenuModal();
  };

  const removeMenu = (menuId: number) => {
    setBookingData((prev) => ({
      ...prev,
      selected_menus: prev.selected_menus.filter((m) => m.id !== menuId),
      // If no menus left, clear cuisine to allow a different cuisine selection next time
      cuisine: prev.selected_menus.filter((m) => m.id !== menuId).length === 0 ? "" : prev.cuisine,
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
        customer_email: bookingData.customer_email,
        customer_address: bookingData.customer_address,
        name: bookingData.event_name,
        date: bookingData.date,
        time_slot: parseInt(bookingData.time_slot),
        number_of_persons: parseInt(bookingData.number_of_persons) || 1,
        selected_menus: bookingData.selected_menus.map(m => m.id),
        extras: extrasWithCharges,
        additional_charges: 0, // Public users cannot set service charges
        cuisine: bookingData.cuisine ? parseInt(bookingData.cuisine) : undefined,
        embed_token: embedToken || undefined,
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
        customer_email: "",
        customer_address: "",
        event_name: "",
        date: "",
        time_slot: "",
        number_of_persons: "1",
        selected_menus: [],
        extras: [],
        cuisine: "",
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
      <div className="h-full min-h-0 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading calendar...</p>
        </div>
      </div>
    );
  }

  // Create base style object for the container
  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    border: `${borderWidth} solid ${borderColor}`,
    borderRadius: borderRadius,
    backgroundColor: containerBg,
    fontSize: fontSize,
    fontFamily: fontFamily,
    color: textColor,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden", // Always fill, no internal scrolling
    position: "relative"
  };

  // Base text style with fontSize applied
  const textStyle: React.CSSProperties = {
    fontSize: fontSize,
    fontFamily: fontFamily,
    color: textColor
  };

  return (
    <div 
      className="shadow-md p-4 flex flex-col"
      style={containerStyle}
    >
        <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold flex-1 text-center" style={{ ...textStyle, fontSize: `calc(${fontSize} * 1.5)` }}>Book Your Event</h1>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowVoiceChat(true);
          }}
          className="p-2 rounded-full hover:bg-black/10 transition-colors flex-shrink-0 cursor-pointer"
          style={{ color: textColor }}
          title="Voice Assistant"
          type="button"
        >
          <Mic className="w-6 h-6" />
        </button>
      </div>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-center items-center gap-3 mb-3 flex-shrink-0">
            <select
              value={currentDate.getMonth()}
              onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))}
              className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
              style={{ ...textStyle, fontSize: `calc(${fontSize} * 1.125)`, cursor: "pointer", color: textColor, backgroundColor: containerBg }}
            >
              {monthNames.map((month, index) => (
                <option key={index} value={index} style={{ backgroundColor: containerBg, color: textColor }}>{month}</option>
              ))}
            </select>
            <select
              value={currentDate.getFullYear()}
              onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))}
              className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
              style={{ ...textStyle, fontSize: `calc(${fontSize} * 1.125)`, cursor: "pointer", color: textColor, backgroundColor: containerBg }}
            >
              {Array.from({ length: 15 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return (
                  <option key={year} value={year} style={{ backgroundColor: containerBg, color: textColor }}>{year}</option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0" style={{ gridTemplateRows: 'auto repeat(6, 1fr)' }}>
            {dayNames.map((day) => (
              <div key={day} className="text-center font-semibold py-1.5 flex-shrink-0" style={textStyle}>
                {day}
              </div>
            ))}
            {days.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="min-h-0"></div>;
              }
              const status = getDayStatus(date);
              
              // Determine day cell styling based on status
              let dayStyle: React.CSSProperties = { ...textStyle };
              let dayClassName = "rounded-md border transition-all duration-200 flex items-center justify-center min-h-0";
              
              if (status === "fully-booked") {
                dayStyle.backgroundColor = fullDayBg;
                dayStyle.borderColor = fullDayBorder;
                dayClassName += " cursor-not-allowed";
              } else if (status === "partially-booked") {
                dayStyle.backgroundColor = partialDayBg;
                dayStyle.borderColor = partialDayBorder;
                dayClassName += " hover:opacity-80";
              } else {
                dayStyle.backgroundColor = availableDayBg;
                dayStyle.borderColor = availableDayBorder;
                dayClassName += " hover:opacity-80";
              }
              
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDateClick(date)}
                  className={dayClassName}
                  style={dayStyle}
                  disabled={status === "fully-booked"}
                >
                  <div className="font-semibold" style={{ fontSize: fontSize }}>{date.getDate()}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-3 justify-center flex-shrink-0" style={{ fontSize: `calc(${fontSize} * 0.75)` }}>
            <div className="flex items-center gap-2">
              <div 
                className="w-3.5 h-3.5 rounded border" 
                style={{ backgroundColor: availableDayBg, borderColor: availableDayBorder }}
              ></div>
              <span style={textStyle}>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-3.5 h-3.5 rounded border" 
                style={{ backgroundColor: partialDayBg, borderColor: partialDayBorder }}
              ></div>
              <span style={textStyle}>Partially Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-3.5 h-3.5 rounded border" 
                style={{ backgroundColor: fullDayBg, borderColor: fullDayBorder }}
              ></div>
              <span style={textStyle}>Fully Booked</span>
            </div>
          </div>

        {/* Booking Modal (Popup) */}
        {showBookingForm && (
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3" 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
            onClick={() => {
              setShowBookingForm(false);
              setSelectedDate(null);
            }}
          >
            <div 
              className="rounded-lg shadow-lg border border-yellow-500 p-4 max-w-xl w-full max-h-[90vh] overflow-y-auto"
              style={{ position: 'relative', zIndex: 10000, backgroundColor: containerBg }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold" style={{ color: textColor }}>Book Event</h3>
                <button
                  onClick={() => {
                    setShowBookingForm(false);
                    setSelectedDate(null);
                  }}
                  className="text-xl font-bold hover:opacity-70 transition-opacity"
                  style={{ color: textColor }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-3">
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: textColor }}>Your Name *</label>
                    <input
                      type="text"
                      required
                      value={bookingData.customer_name}
                      onChange={(e) => setBookingData({ ...bookingData, customer_name: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                      style={{ color: textColor, backgroundColor: inputBg }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: textColor }}>Contact *</label>
                    <input
                      type="text"
                      required
                      value={bookingData.customer_contact}
                      onChange={(e) => setBookingData({ ...bookingData, customer_contact: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                      style={{ color: textColor, backgroundColor: inputBg }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: textColor }}>Event Name *</label>
                  <input
                    type="text"
                    required
                    value={bookingData.event_name}
                    onChange={(e) => setBookingData({ ...bookingData, event_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                    style={{ color: textColor, backgroundColor: inputBg }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: textColor }}>Customer Email *</label>
                  <input
                    type="email"
                    required
                    value={bookingData.customer_email}
                    onChange={(e) => setBookingData({ ...bookingData, customer_email: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                    style={{ color: textColor, backgroundColor: inputBg }}
                    placeholder="customer@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: textColor }}>Number of Persons *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={bookingData.number_of_persons}
                    onChange={(e) => setBookingData({ ...bookingData, number_of_persons: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                    style={{ color: textColor, backgroundColor: inputBg }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: textColor }}>Time Slot *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cuisine *</label>
                  <select
                    value={bookingData.cuisine}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBookingData((prev) => ({
                        ...prev,
                        cuisine: value,
                        selected_menus: [],
                      }));
                      setModalData({
                        cuisine: value,
                        item_type: "",
                        selected_menu_ids: [],
                      });
                    }}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                    style={{ color: textColor, backgroundColor: inputBg }}
                  >
                    <option value="" style={{ backgroundColor: inputBg, color: textColor }}>Select Cuisine</option>
                    {cuisines.map((cuisine) => (
                      <option key={cuisine.id} value={cuisine.id} style={{ backgroundColor: inputBg, color: textColor }}>
                        {cuisine.name}
                      </option>
                    ))}
                  </select>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Menu Item *</label>
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
                                {menu.cuisine_name} • {menu.item_type_name}
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
                      disabled={!bookingData.cuisine}
                      className="w-full p-4 border-2 border-dashed border-gray-400 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="font-medium">Add Menu Item</span>
                    </button>

                    {bookingData.selected_menus.length > 0 && (
                      <div className="mt-3 p-4 bg-yellow-50 border-2 border-yellow-500 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-yellow-800 mb-1">Menu Total (real-time)</p>
                            <p className="text-2xl font-bold text-yellow-700">
                              ${calculatedMenuTotal.toFixed(2)}
                            </p>
                            <p className="text-xs text-yellow-800 mt-1">
                              {bookingData.selected_menus.length} menu(s) × {bookingData.number_of_persons} person(s)
                            </p>
                          </div>
                          <div className="text-xs text-yellow-800 text-right">
                            If this cuisine has a price, it overrides individual menu prices.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                    style={{ color: textColor, backgroundColor: inputBg }}
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
              className="rounded-xl shadow-lg border-2 border-yellow-500 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', zIndex: 10002, backgroundColor: containerBg }}
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
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Cuisine:</span>{" "}
                  {bookingData.cuisine
                    ? cuisines.find((c) => String(c.id) === bookingData.cuisine)?.name || "Selected"
                    : "None selected"}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Menus</label>
                  <div className="flex flex-wrap gap-2">
                    {itemTypes.map((itemType) => {
                      const active = modalData.item_type === String(itemType.id);
                      // Check persistent state first, then fallback to bookingData
                      const savedSelection = selectionsByMenuType[itemType.id];
                      const existing = bookingData.selected_menus.find((m) => m.item_type_id === itemType.id);
                      const selectionId = savedSelection?.id || existing?.id;
                      return (
                        <button
                          key={itemType.id}
                          type="button"
                          onClick={() => {
                            const newItemType = String(itemType.id);
                            setModalData({
                              ...modalData,
                              item_type: newItemType,
                              selected_menu_ids: selectionId ? [selectionId] : [],
                            });
                          }}
                          disabled={!bookingData.cuisine}
                          className={`px-3 py-2 rounded-full border text-sm ${
                            active
                              ? "bg-yellow-500 text-white border-yellow-500"
                              : "bg-white border-gray-400 text-gray-900 hover:bg-yellow-50 hover:border-yellow-400"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {itemType.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {bookingData.cuisine && modalData.item_type && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Available Menu Items (single selection)</label>
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
                              {menu.cuisine_name} • {menu.item_type_name}
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
                    disabled={Object.keys(selectionsByMenuType).length === 0}
                    className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Menu Item
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
              className="rounded-xl shadow-lg border-2 border-yellow-500 p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', zIndex: 10002, backgroundColor: containerBg }}
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
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                    style={{ color: textColor, backgroundColor: inputBg }}
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

      {/* Voice Chat Modal */}
      {showVoiceChat && mounted && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3" 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
          onClick={() => {
            setShowVoiceChat(false);
          }}
        >
          <VoiceChat
            key={showVoiceChat ? 'voice-chat-open' : 'voice-chat-closed'}
            onClose={() => {
              setShowVoiceChat(false);
            }}
            containerBg={containerBg}
            textColor={textColor}
            embedToken={embedToken}
            events={events}
            timeSlots={timeSlots}
            cuisines={cuisines}
            itemTypes={itemTypes}
            subItems={subItems}
            currentMonth={currentDate}
            eventLocation={eventLocation}
          />
        </div>
      )}
    </div>
  );
}

export default function EmbedCalendarPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-white">
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

