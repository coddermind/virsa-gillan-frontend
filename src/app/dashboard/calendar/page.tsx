"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { apiClient, Event, TimeSlot } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { createPortal } from "react-dom";

export default function CalendarPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const isManager = user?.user_type === "manager";

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else if (isManager) {
      loadData();
    }
  }, [user, router, isManager]);

  useEffect(() => {
    if (isManager) {
      loadData();
    }
  }, [currentDate, isManager]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsData, timeSlotsData] = await Promise.all([
        apiClient.getEvents(),
        apiClient.getTimeSlots(),
      ]);
      setEvents(Array.isArray(eventsData) ? eventsData : []);
      setTimeSlots(Array.isArray(timeSlotsData) ? timeSlotsData : []);
    } catch (error) {
      console.error("Failed to load calendar data:", error);
      setEvents([]);
      setTimeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Convert Sunday (0) to be last (6) for Monday-first week
    const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < adjustedStartingDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDayStatus = (date: Date | null): "empty" | "partially-booked" | "fully-booked" => {
    if (!date) return "empty";
    
    const dateStr = formatDateLocal(date);
    const dayEvents = events.filter((e) => e.date === dateStr);
    
    if (dayEvents.length === 0) {
      return "empty";
    }
    
    // Get weekday index (0 = Monday, 6 = Sunday)
    const jsWeekday = date.getDay();
    const weekdayIndex = jsWeekday === 0 ? 6 : jsWeekday - 1;
    
    // Get time slots available for this weekday
    const availableTimeSlots = timeSlots.filter((slot) =>
      slot.weekdays.includes(weekdayIndex)
    );
    
    // Get time slots that are already booked
    const bookedTimeSlotIds = dayEvents
      .map((e) => e.time_slot)
      .filter((id): id is number => id !== undefined && id !== null);
    
    // Check if there are any available time slots left
    const availableSlotsLeft = availableTimeSlots.filter(
      (slot) => !bookedTimeSlotIds.includes(slot.id)
    );
    
    if (availableSlotsLeft.length === 0) {
      return "fully-booked";
    }
    
    return "partially-booked";
  };

  const getDayClassName = (status: "empty" | "partially-booked" | "fully-booked") => {
    switch (status) {
      case "fully-booked":
        return "bg-red-500/20 border-2 border-red-500 text-red-400";
      case "partially-booked":
        return "bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400";
      default:
        return "bg-[var(--background)] border-2 border-[var(--border)] text-[var(--text-primary)]";
    }
  };

  const getDayEvents = (date: Date | null) => {
    if (!date) return [];
    const dateStr = formatDateLocal(date);
    return events.filter((e) => e.date === dateStr);
  };

  const handleDateClick = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      setShowDayModal(true);
    }
  };

  const closeDayModal = () => {
    setShowDayModal(false);
    setSelectedDate(null);
  };

  const handleMonthChange = (month: number) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(month);
      return newDate;
    });
  };

  const handleYearChange = (year: number) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setFullYear(year);
      return newDate;
    });
  };

  const getAvailableTimeSlotsForDay = (date: Date) => {
    const jsWeekday = date.getDay();
    const weekdayIndex = jsWeekday === 0 ? 6 : jsWeekday - 1;
    
    return timeSlots.filter((slot) => slot.weekdays.includes(weekdayIndex));
  };

  const getBookedTimeSlotIds = (date: Date) => {
    const dateStr = formatDateLocal(date);
    const dayEvents = events.filter((e) => e.date === dateStr);
    return dayEvents
      .map((e) => e.time_slot)
      .filter((id): id is number => id !== undefined && id !== null);
  };

  const getEventForTimeSlot = (date: Date, timeSlotId: number): Event | null => {
    const dateStr = formatDateLocal(date);
    return events.find((e) => e.date === dateStr && e.time_slot === timeSlotId) || null;
  };

  const handleTimeSlotClick = (slot: TimeSlot, date: Date) => {
    const event = getEventForTimeSlot(date, slot.id);
    if (event) {
      // Redirect to event detail page
      router.push(`/dashboard/events/${event.id}`);
    } else {
      // Redirect to event creation page with pre-filled date and time slot
      const dateStr = formatDateLocal(date);
      router.push(`/dashboard/events/create?date=${dateStr}&time_slot=${slot.id}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (!isManager) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-12 text-center transition-colors duration-300">
            <p className="text-[var(--text-secondary)] mb-4">
              Access Restricted
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              You don't have permission to access this section. Only managers can view the calendar.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-[var(--text-secondary)]">Loading calendar...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const days = getDaysInMonth(currentDate);
  const monthName = monthNames[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            prefetch={false}
            className="text-[var(--border)] hover:text-[var(--primary-dark)] text-sm font-medium mb-4 inline-block transition-colors duration-200"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] transition-colors duration-300">
              Calendar View
            </h2>
            <div className="flex gap-3">
              <select
                value={currentDate.getMonth()}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg text-[var(--text-primary)] font-medium focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none transition-colors duration-200"
              >
                {monthNames.map((month, index) => (
                  <option key={index} value={index}>
                    {month}
                  </option>
                ))}
              </select>
              <select
                value={currentDate.getFullYear()}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="px-4 py-2 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg text-[var(--text-primary)] font-medium focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none transition-colors duration-200"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekdayNames.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-semibold text-[var(--text-primary)] py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((date, index) => {
              const status = getDayStatus(date);
              const dayNumber = date ? date.getDate() : "";

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleDateClick(date)}
                  disabled={!date}
                  className={`min-h-[60px] p-2 rounded-full transition-all duration-200 flex items-center justify-center ${getDayClassName(
                    status
                  )} ${date ? "hover:scale-110 cursor-pointer" : "opacity-30 cursor-not-allowed"}`}
                >
                  {date && (
                    <span className="font-semibold text-lg">{dayNumber}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-4 mt-6 transition-colors duration-300">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[var(--background)] border-2 border-[var(--border)] rounded-full"></div>
              <span className="text-sm text-[var(--text-secondary)]">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-500/20 border-2 border-yellow-500 rounded-full"></div>
              <span className="text-sm text-[var(--text-secondary)]">Partially Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500/20 border-2 border-red-500 rounded-full"></div>
              <span className="text-sm text-[var(--text-secondary)]">Fully Booked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      {showDayModal && selectedDate && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDayModal();
            }
          }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
        >
          <div
            className="bg-[var(--card)] rounded-xl shadow-lg border-2 border-[var(--border)] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', zIndex: 10000 }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">
                {formatDate(formatDateLocal(selectedDate))}
              </h3>
              <button
                type="button"
                onClick={closeDayModal}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl"
              >
                ×
              </button>
            </div>

            {/* Events for this day */}
            {(() => {
              const availableTimeSlots = getAvailableTimeSlotsForDay(selectedDate);
              const bookedTimeSlotIds = getBookedTimeSlotIds(selectedDate);

              const formatTime = (timeString: string) => {
                const [hours, minutes] = timeString.split(":");
                const hour = parseInt(hours);
                const ampm = hour >= 12 ? "PM" : "AM";
                const displayHour = hour % 12 || 12;
                return `${displayHour}:${minutes} ${ampm}`;
              };

              return (
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Time Slots
                  </h4>
                  {availableTimeSlots.length === 0 ? (
                    <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500 rounded-lg text-yellow-500 text-sm">
                      No time slots available for this day.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableTimeSlots.map((slot) => {
                        const isBooked = bookedTimeSlotIds.includes(slot.id);
                        const event = isBooked ? getEventForTimeSlot(selectedDate, slot.id) : null;

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => handleTimeSlotClick(slot, selectedDate)}
                            className={`w-full p-3 rounded-lg border-2 text-left transition-all duration-200 ${
                              isBooked
                                ? "bg-red-500/10 border-red-500 hover:bg-red-500/20 cursor-pointer"
                                : "bg-green-500/10 border-green-500 hover:bg-green-500/20 cursor-pointer"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-[var(--text-primary)]">
                                    {slot.name}
                                  </span>
                                  {event && (
                                    <>
                                      <span className="text-[var(--text-secondary)]">•</span>
                                      <span className="text-sm text-[var(--text-primary)] font-medium">
                                        {event.name}
                                      </span>
                                      <span className="text-[var(--text-secondary)]">•</span>
                                      <span className="text-sm text-[var(--text-secondary)]">
                                        {event.customer_name}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="text-sm text-[var(--text-secondary)] mt-1">
                                  {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                </div>
                              </div>
                              <span
                                className={`px-3 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                                  isBooked
                                    ? "bg-red-500/20 text-red-400 border border-red-500"
                                    : "bg-green-500/20 text-green-400 border border-green-500"
                                }`}
                              >
                                {isBooked ? "Booked" : "Free"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </DashboardLayout>
  );
}

