"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { apiClient, AdminSettings } from "@/lib/api";
import { Settings, Save, Mail, MapPin } from "lucide-react";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settings, setSettings] = useState<AdminSettings>({
    event_location: "",
    email_host: "",
    email_port: 587,
    email_username: "",
    email_password: "",
    email_from: "",
    email_to_list: "",
  });

  useEffect(() => {
    if (user && user.user_type === "manager") {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiClient.getAdminSettings();
      setSettings(data);
    } catch (err: any) {
      // If settings don't exist yet, that's okay - use defaults
      if (err.message && !err.message.includes("404")) {
        setError(err.message || "Failed to load settings");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      // Validate email to list format
      if (settings.email_to_list) {
        const emails = settings.email_to_list.split(",").map((e) => e.trim());
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of emails) {
          if (email && !emailRegex.test(email)) {
            throw new Error(`Invalid email format: ${email}`);
          }
        }
      }

      // Validate email_from
      if (settings.email_from) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(settings.email_from)) {
          throw new Error("Invalid 'From' email format");
        }
      }

      if (settings.id) {
        await apiClient.updateAdminSettings(settings);
      } else {
        await apiClient.createAdminSettings(settings);
      }

      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.user_type !== "manager") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border-2 border-red-500 rounded-lg p-6 text-center">
            <p className="text-red-400 text-lg font-semibold">
              Access Restricted
            </p>
            <p className="text-red-300 mt-2">
              You don't have permission to access this section. Only managers can configure admin settings.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-500 border-r-transparent"></div>
              <p className="mt-4 text-[var(--text-secondary)]">Loading settings...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            prefetch={false}
            className="text-[var(--border)] hover:text-[var(--primary-dark)] text-sm font-medium mb-4 inline-block transition-colors duration-200"
          >
            ← Back to Dashboard
          </Link>
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300 flex items-center gap-2">
            <Settings className="w-8 h-8" />
            Admin Settings
          </h2>
          <p className="text-[var(--text-secondary)] transition-colors duration-300">
            Configure event location and email settings for booking notifications
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border-2 border-red-500 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border-2 border-green-500 rounded-lg text-green-400">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Location Section */}
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Event Location
            </h3>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Hall/Venue Name *
              </label>
              <input
                type="text"
                required
                value={settings.event_location}
                onChange={(e) => setSettings({ ...settings, event_location: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                placeholder="e.g., Grand Ballroom, Hotel XYZ"
              />
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                This location will be used for all events booked through the embed calendar.
              </p>
            </div>
          </div>

          {/* Email Configuration Section */}
          <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Configuration
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Email Host (SMTP) *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.email_host}
                    onChange={(e) => setSettings({ ...settings, email_host: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="e.g., smtp.gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Email Port *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="65535"
                    value={settings.email_port}
                    onChange={(e) => setSettings({ ...settings, email_port: parseInt(e.target.value) || 587 })}
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Email Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.email_username}
                    onChange={(e) => setSettings({ ...settings, email_username: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Email Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={settings.email_password}
                    onChange={(e) => setSettings({ ...settings, email_password: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                    placeholder="Your email password or app password"
                  />
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    For Gmail, use an App Password instead of your regular password.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  From Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={settings.email_from}
                  onChange={(e) => setSettings({ ...settings, email_from: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                  placeholder="noreply@yourdomain.com"
                />
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  This email will appear as the sender in booking confirmation emails.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  To Email List *
                </label>
                <textarea
                  required
                  value={settings.email_to_list}
                  onChange={(e) => setSettings({ ...settings, email_to_list: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--border)] focus:border-[var(--border)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-200"
                  placeholder="admin@example.com, manager@example.com"
                />
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  Comma-separated list of email addresses that will receive booking notifications.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-[var(--border)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--primary-dark)] transition-colors duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

