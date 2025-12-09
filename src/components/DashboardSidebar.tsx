"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard,
  UtensilsCrossed,
  FileText,
  Menu,
  Clock,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Code,
} from "lucide-react";

interface DashboardSidebarProps {
  stats?: {
    cuisines: number;
    itemTypes: number;
    subItems: number;
    events: number;
    timeSlots: number;
  };
}

export default function DashboardSidebar({ stats }: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const { theme } = useTheme();

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    if (savedState !== null) {
      setIsCollapsed(savedState === "true");
    }
  }, []);

  // Save sidebar state to localStorage
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", newState.toString());
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event("sidebarToggle"));
  };

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      count: null,
    },
    {
      href: "/dashboard/cuisines",
      label: "Cuisines",
      icon: UtensilsCrossed,
      count: stats?.cuisines,
      color: "indigo",
    },
    {
      href: "/dashboard/item-types",
      label: "Menu Items",
      icon: FileText,
      count: stats?.itemTypes,
      color: "purple",
    },
    {
      href: "/dashboard/sub-items",
      label: "Menues",
      icon: Menu,
      count: stats?.subItems,
      color: "pink",
    },
    {
      href: "/dashboard/time-slots",
      label: "Time Slots",
      icon: Clock,
      count: stats?.timeSlots,
      color: "orange",
    },
    {
      href: "/dashboard/events",
      label: "Events",
      icon: Calendar,
      count: stats?.events,
      color: "blue",
    },
    {
      href: "/dashboard/events/pending",
      label: "Pending Approvals",
      icon: Clock,
      count: null,
      color: "yellow",
    },
    {
      href: "/dashboard/calendar",
      label: "Calendar",
      icon: CalendarDays,
      count: null,
      color: "green",
    },
    {
      href: "/dashboard/embed",
      label: "Embed Code",
      icon: Code,
      count: null,
      color: "indigo",
    },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`bg-[var(--card)] border-r-2 border-[var(--border)] transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      } flex-shrink-0 h-screen z-40 flex flex-col hidden md:flex`}
    >
      {/* Header */}
      <div className="h-16 border-b-2 border-[var(--border)] flex items-center justify-between px-4">
        {!isCollapsed && (
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Event Manager</h2>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-[var(--hover-bg)] rounded-lg transition-colors duration-200 text-[var(--text-primary)] border border-[var(--border)] flex items-center justify-center"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const colorClasses = {
              indigo: theme === "dark" 
                ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]" 
                : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]",
              purple: theme === "dark"
                ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]"
                : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]",
              pink: theme === "dark"
                ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]"
                : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]",
              blue: theme === "dark"
                ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]"
                : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]",
              green: theme === "dark"
                ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]"
                : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]",
              orange: theme === "dark"
                ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]"
                : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]",
            };

            const IconComponent = item.icon;
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    active
                      ? item.color
                        ? colorClasses[item.color as keyof typeof colorClasses]
                        : theme === "dark"
                        ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]"
                        : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]"
                      : theme === "dark"
                      ? "text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--border)] hover:border border-[var(--border)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-yellow-800 hover:border border-[var(--border)]"
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <IconComponent 
                    className="flex-shrink-0 transition-all duration-200"
                    size={20}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 font-medium">{item.label}</span>
                      {item.count !== null && item.count !== undefined && (
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full border border-[var(--border)] transition-colors duration-200 ${
                            active
                              ? "bg-[var(--border)] text-[var(--background)]"
                              : theme === "dark"
                              ? "bg-[var(--hover-bg)] text-[var(--border)]"
                              : "bg-yellow-50 text-yellow-800"
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

