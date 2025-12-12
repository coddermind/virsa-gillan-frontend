"use client";

import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "next/navigation";
import DashboardSidebar from "./DashboardSidebar";
import { apiClient } from "@/lib/api";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState({
    cuisines: 0,
    itemTypes: 0,
    subItems: 0,
    events: 0,
    timeSlots: 0,
    pendingEvents: 0,
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // Load sidebar state
    const checkSidebarState = () => {
      const savedState = localStorage.getItem("sidebarCollapsed");
      setIsSidebarCollapsed(savedState === "true");
    };
    
    checkSidebarState();
    
    // Listen for sidebar toggle events
    window.addEventListener("sidebarToggle", checkSidebarState);
    // Also listen for storage changes (for cross-tab sync)
    window.addEventListener("storage", checkSidebarState);
    
    return () => {
      window.removeEventListener("sidebarToggle", checkSidebarState);
      window.removeEventListener("storage", checkSidebarState);
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user || user.user_type !== "manager") {
      setStats({ cuisines: 0, itemTypes: 0, subItems: 0, events: 0, timeSlots: 0, pendingEvents: 0 });
      return;
    }
    try {
      const [cuisines, itemTypes, subItems, events, timeSlots, pendingEvents] = await Promise.all([
        apiClient.getCuisines(),
        apiClient.getItemTypes(),
        apiClient.getSubItems(),
        apiClient.getEvents(),
        apiClient.getTimeSlots(),
        apiClient.getPendingEvents(),
      ]);
      setStats({
        cuisines: Array.isArray(cuisines) ? cuisines.length : 0,
        itemTypes: Array.isArray(itemTypes) ? itemTypes.length : 0,
        subItems: Array.isArray(subItems) ? subItems.length : 0,
        events: Array.isArray(events) ? events.length : 0,
        timeSlots: Array.isArray(timeSlots) ? timeSlots.length : 0,
        pendingEvents: Array.isArray(pendingEvents) ? pendingEvents.length : 0,
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
      setStats({ cuisines: 0, itemTypes: 0, subItems: 0, events: 0, timeSlots: 0, pendingEvents: 0 });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--border)] border-r-transparent"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Check if user is a manager
  const isManager = user.user_type === "manager";

  return (
    <div className="min-h-screen bg-[var(--background)] flex transition-colors duration-300">
      <DashboardSidebar stats={stats} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation */}
        <nav className="bg-[var(--card)] border-b-2 border-[var(--border)] flex-shrink-0 z-30 transition-colors duration-300">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex-1"></div>
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg border-2 border-[var(--border)] bg-[var(--card)] hover:bg-[var(--hover-bg)] transition-colors duration-200 flex items-center justify-center"
                  aria-label="Toggle theme"
                  title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                >
                  {theme === "dark" ? (
                    <span className="text-xl">☀️</span>
                  ) : (
                    <span className="text-xl">🌙</span>
                  )}
                </button>
                <span className="text-sm text-[var(--text-secondary)]">{user.email}</span>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)] border-2 border-[var(--border)] rounded-lg transition-colors duration-200 font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:px-8 bg-[var(--background)] transition-colors duration-300">{children}</main>
      </div>
    </div>
  );
}

