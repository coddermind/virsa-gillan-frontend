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
  ChevronDown,
  ChevronUp,
  Settings,
} from "lucide-react";

interface DashboardSidebarProps {
  stats?: {
    cuisines: number;
    itemTypes: number;
    subItems: number;
    events: number;
    timeSlots: number;
    pendingEvents?: number;
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

  const groupedNav = [
    {
      label: "Cuisine Management",
      icon: UtensilsCrossed,
      key: "cuisine",
      children: [
        { href: "/dashboard/cuisines", label: "Cuisines", icon: UtensilsCrossed, count: stats?.cuisines, color: "indigo" },
        { href: "/dashboard/item-types", label: "Menus", icon: FileText, count: stats?.itemTypes, color: "purple" },
        { href: "/dashboard/sub-items", label: "Menu Items", icon: Menu, count: stats?.subItems, color: "pink" },
      ],
    },
    {
      label: "Event Management",
      icon: Calendar,
      key: "events",
      children: [
        { href: "/dashboard/events", label: "Approved Events", icon: Calendar, count: stats?.events, color: "blue" },
        { href: "/dashboard/events/pending", label: "Pending Events", icon: Clock, count: stats?.pendingEvents, color: "yellow" },
      ],
    },
    {
      label: "Calendar Management",
      icon: CalendarDays,
      key: "calendar",
      children: [
        { href: "/dashboard/time-slots", label: "Time Slots", icon: Clock, count: stats?.timeSlots, color: "orange" },
        { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays, count: null, color: "green" },
        { href: "/dashboard/embed", label: "Embed Code", icon: Code, count: null, color: "indigo" },
      ],
    },
    {
      label: "Admin Management",
      icon: Settings,
      key: "admin",
      children: [
        { href: "/dashboard/admin/settings", label: "Settings", icon: Settings, count: null, color: "gray" },
      ],
    },
  ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    cuisine: false,
    events: false,
    calendar: false,
    admin: false,
  });

  const normalizePath = (path: string) => (path !== "/" ? path.replace(/\/+$/, "") : "/");
  const current = normalizePath(pathname);

  const isActive = (href: string) => {
    const target = normalizePath(href);
    return current === target;
  };

  const isGroupActive = (children: { href: string }[]) => {
    return children.some((child) => isActive(child.href));
  };

  // Auto-open the group containing the current route
  useEffect(() => {
    setOpenGroups((prev) => {
      const updated = { ...prev };
      groupedNav.forEach((group) => {
        updated[group.key] = isGroupActive(group.children);
      });
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
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
        <ul className="space-y-2 px-2">
          <li>
            <Link
              href="/dashboard"
              prefetch={false}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive("/dashboard")
                  ? theme === "dark"
                    ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]"
                    : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]"
                  : theme === "dark"
                  ? "text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--border)] hover:border border-[var(--border)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-yellow-800 hover:border border-[var(--border)]"
              }`}
              title={isCollapsed ? "Dashboard" : undefined}
            >
              <LayoutDashboard className="flex-shrink-0" size={20} />
              {!isCollapsed && <span className="flex-1 font-medium">Dashboard</span>}
            </Link>
          </li>

          {groupedNav.map((group) => {
            const groupActive = isGroupActive(group.children);
            const open = openGroups[group.key];
            const colorClasses = (color?: string) => ({
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
              yellow: theme === "dark"
                ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]"
                : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]",
            }[color || "indigo"]);

            return (
              <li key={group.key}>
                <button
                  onClick={() => toggleGroup(group.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    groupActive
                      ? theme === "dark"
                        ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]"
                        : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]"
                      : theme === "dark"
                      ? "text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--border)] hover:border border-[var(--border)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-yellow-800 hover:border border-[var(--border)]"
                  }`}
                  title={isCollapsed ? group.label : undefined}
                >
                  <group.icon className="flex-shrink-0" size={20} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis" title={group.label}>
                        {group.label}
                      </span>
                      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </>
                  )}
                </button>

                {!isCollapsed && open && (
                  <ul className="mt-1 space-y-1 pl-3">
                    {group.children.map((item) => {
                      const active = isActive(item.href);
                      const IconComponent = item.icon;
                      const cls = active
                        ? item.color
                          ? colorClasses(item.color)
                          : theme === "dark"
                          ? "bg-[var(--hover-bg)] text-[var(--border)] border-2 border-[var(--border)]"
                          : "bg-yellow-50 text-yellow-800 border-2 border-[var(--border)]"
                        : theme === "dark"
                        ? "text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--border)] hover:border border-[var(--border)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-yellow-800 hover:border border-[var(--border)]";

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            prefetch={false}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${cls}`}
                            title={item.label}
                          >
                            <IconComponent className="flex-shrink-0" size={18} strokeWidth={active ? 2.5 : 2} />
                            <span className="flex-1 text-sm font-medium">{item.label}</span>
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
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

