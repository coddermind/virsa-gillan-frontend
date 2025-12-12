"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { Copy, Check, Code } from "lucide-react";

export default function EmbedCodePage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user || user.user_type !== "manager") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border-2 border-red-500 rounded-lg p-6 text-center">
            <p className="text-red-400 text-lg font-semibold">
              Access Restricted
            </p>
            <p className="text-red-300 mt-2">
              You don't have permission to access this section. Only managers can generate embed codes.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Get the current origin for the embed URL with token parameter
  const token = user.embed_token;
  const borderColor = "#fbbf24"; // Default border color
  const borderWidth = "2px"; // Default border width
  const borderRadius = "8px"; // Default border radius
  const containerBg = "#ffffff"; // Default container background color
  const inputBg = "#ffffff"; // Default input background color
  const fontSize = "16px"; // Default font size
  const fontFamily = "inherit"; // Default font family
  const textColor = "#111827"; // Default text color
  
  // Day status colors
  const availableDayBg = "#f9fafb"; // Default available day background
  const availableDayBorder = "#e5e7eb"; // Default available day border
  const partialDayBg = "#fef3c7"; // Default partially booked day background
  const partialDayBorder = "#fbbf24"; // Default partially booked day border
  const fullDayBg = "#fee2e2"; // Default fully booked day background
  const fullDayBorder = "#f87171"; // Default fully booked day border
  const todayRing = "#fbbf24"; // Default today ring color
  
  // Generate unique ID for this iframe instance
  const iframeId = `calendar-widget-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get the base URL for the embed (frontend URL)
  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
    if (siteUrl) {
      return siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    }
    return '';
  };
  
  const baseUrl = getBaseUrl();
  
  const embedCode = `<div id="${iframeId}-wrapper" style="width: 100%;">
<iframe 
  id="${iframeId}"
  width="100%" 
  height="800" 
  frameborder="0"
  data-token="${token || ""}"
  data-base-url="${baseUrl}"
  data-align="left"
  data-container-bg="${containerBg}"
  data-input-bg="${inputBg}"
  data-text-color="${textColor}"
  data-font-size="${fontSize}"
  data-font-family="${fontFamily}"
  data-border-color="${borderColor}"
  data-border-width="${borderWidth}"
  data-border-radius="${borderRadius}"
  data-available-day-bg="${availableDayBg}"
  data-available-day-border="${availableDayBorder}"
  data-partial-day-bg="${partialDayBg}"
  data-partial-day-border="${partialDayBorder}"
  data-full-day-bg="${fullDayBg}"
  data-full-day-border="${fullDayBorder}"
  data-today-ring="${todayRing}"
  style="
    border: ${borderWidth} solid ${borderColor};
    border-radius: ${borderRadius};
    display: block;
  ">
</iframe>
</div>
<script>
(function() {
  const iframe = document.getElementById('${iframeId}');
  if (!iframe) return;
  
  const wrapper = document.getElementById('${iframeId}-wrapper');
  if (!wrapper) return;
  
  // Apply alignment
  const align = iframe.dataset.align || 'left';
  if (align === 'center') {
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
  } else if (align === 'right') {
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'flex-end';
  } else {
    // left (default)
    wrapper.style.display = 'block';
  }
  
  // Use data-base-url if provided and valid, otherwise fall back to window.location.origin
  let baseUrl = iframe.dataset.baseUrl;
  if (!baseUrl || baseUrl === '' || baseUrl.startsWith('file://')) {
    // If data-base-url is empty or file:// protocol, use window.location.origin
    // But if window.location.origin is also file://, we need a manual base URL
    if (window.location.protocol === 'file:') {
      console.error('Calendar Widget: Please set data-base-url attribute to your frontend URL (e.g., http://localhost:3001 or https://yourdomain.com)');
      return;
    }
    baseUrl = window.location.origin;
  }
  
  const params = new URLSearchParams({
    token: iframe.dataset.token || '',
    containerBg: iframe.dataset.containerBg || '#ffffff',
    inputBg: iframe.dataset.inputBg || '#ffffff',
    textColor: iframe.dataset.textColor || '#111827',
    fontSize: iframe.dataset.fontSize || '16px',
    fontFamily: iframe.dataset.fontFamily || 'inherit',
    borderColor: iframe.dataset.borderColor || '#fbbf24',
    borderWidth: iframe.dataset.borderWidth || '2px',
    borderRadius: iframe.dataset.borderRadius || '8px',
    availableDayBg: iframe.dataset.availableDayBg || '#f9fafb',
    availableDayBorder: iframe.dataset.availableDayBorder || '#e5e7eb',
    partialDayBg: iframe.dataset.partialDayBg || '#fef3c7',
    partialDayBorder: iframe.dataset.partialDayBorder || '#fbbf24',
    fullDayBg: iframe.dataset.fullDayBg || '#fee2e2',
    fullDayBorder: iframe.dataset.fullDayBorder || '#f87171',
    todayRing: iframe.dataset.todayRing || '#fbbf24'
  });
  
  iframe.src = baseUrl + '/embed/calendar?' + params.toString();
})();
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 transition-colors duration-300">
            Embed Calendar Widget
          </h2>
          <p className="text-[var(--text-secondary)] transition-colors duration-300">
            Generate embed code to add your booking calendar to any website
          </p>
        </div>

        <div className="bg-[var(--card)] rounded-xl shadow-sm border-2 border-[var(--border)] p-6 transition-colors duration-300 space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Code className="w-5 h-5" />
              Embed Code
            </h3>
            <p className="text-[var(--text-secondary)] mb-4">
              Copy the code below and paste it into your website's HTML where you want the calendar to appear.
            </p>
            
            <div className="relative">
              <pre className="bg-[var(--background)] border-2 border-[var(--border)] rounded-lg p-4 overflow-x-auto text-sm text-[var(--text-primary)]">
                <code>{embedCode}</code>
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-4 right-4 px-4 py-2 bg-[var(--border)] text-[var(--background)] rounded-lg hover:bg-[var(--primary-dark)] transition-colors duration-200 flex items-center gap-2 border-2 border-[var(--border)]"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Code
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="border-t-2 border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
              How to Use
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-[var(--text-secondary)]">
              <li>Copy the embed code above</li>
              <li>Paste it into your website's HTML editor or page builder</li>
              <li>The calendar will appear on your website</li>
              <li>Visitors can click on available dates to book events</li>
              <li>Bookings will be submitted as "pending approval"</li>
              <li>You can approve or reject bookings from the dashboard</li>
            </ol>
          </div>

          <div className="border-t-2 border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
              Customization
            </h3>
            <p className="text-[var(--text-secondary)] mb-2">
              You can customize the iframe dimensions by modifying the <code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">width</code> and <code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">height</code> attributes.
            </p>
            <p className="text-[var(--text-secondary)] mb-2">
              Example: <code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">width="600" height="600"</code>
            </p>
            <p className="text-[var(--text-secondary)] mb-2">
              <strong>Alignment:</strong> You can control the calendar alignment by changing the <code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">data-align</code> attribute. Valid values are:
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] mb-2 space-y-1">
              <li><code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">data-align="left"</code> - Aligns calendar to the left (default)</li>
              <li><code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">data-align="center"</code> - Centers the calendar</li>
              <li><code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">data-align="right"</code> - Aligns calendar to the right</li>
            </ul>
            <p className="text-[var(--text-secondary)] mb-2 mt-4">
              <strong>Input Background Color:</strong> You can customize the background color of input fields in the booking popup using the <code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">data-input-bg</code> attribute.
            </p>
            <p className="text-[var(--text-secondary)] text-sm">
              Example: <code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">data-input-bg="#f9fafb"</code>
            </p>
            <p className="text-[var(--text-secondary)] mt-4">
              <strong>Note:</strong> If you're testing locally or embedding on a different domain, you may need to manually set the <code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">data-base-url</code> attribute to your frontend URL (e.g., <code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">data-base-url="http://localhost:3001"</code> or <code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">data-base-url="https://yourdomain.com"</code>).
            </p>
          </div>

          <div className="bg-yellow-500/10 border-2 border-yellow-500 rounded-lg p-4">
            <p className="text-yellow-400 font-semibold mb-2">⚠️ Important Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-yellow-300 text-sm">
              <li>Only approved events will be visible on the public calendar</li>
              <li>Bookings made through the embed will require your approval</li>
              <li>You can add service charges when approving bookings</li>
              <li>The calendar automatically checks for booking conflicts</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

