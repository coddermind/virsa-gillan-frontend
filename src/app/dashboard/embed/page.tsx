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
  const getEmbedUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/embed/calendar?token=${token}`;
    }
    // Fallback for SSR: use environment variable or default
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
    if (siteUrl) {
      const baseUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
      return `${baseUrl}/embed/calendar?token=${token}`;
    }
    // Last resort fallback (should not happen in production)
    return `/embed/calendar?token=${token}`;
  };
  const embedUrl = getEmbedUrl();

  const embedCode = `<iframe 
  src="${embedUrl}" 
  width="100%" 
  height="800" 
  frameborder="0" 
  style="border: 2px solid #fbbf24; border-radius: 8px;">
</iframe>`;

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
            <p className="text-[var(--text-secondary)]">
              Example: <code className="bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">width="600" height="600"</code>
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

