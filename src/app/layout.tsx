import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import RemoveNextJSWatermark from "@/components/RemoveNextJSWatermark";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Event Manager",
  description: "Manage your event cuisines, item types, and menu items",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            a[href*="vercel.com"],
            a[href*="nextjs.org"],
            a[href*="vercel.com/new"] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
              position: absolute !important;
              left: -9999px !important;
              width: 0 !important;
              height: 0 !important;
            }
            *[class*="nextjs"],
            *[id*="nextjs"],
            *[class*="vercel"],
            *[id*="vercel"] {
              display: none !important;
            }
          `
        }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function removeWatermark() {
                  try {
                    // Remove all vercel/nextjs links
                    if (typeof document !== 'undefined') {
                      document.querySelectorAll('a[href*="vercel"], a[href*="nextjs"]').forEach(function(el) {
                        el.style.display = 'none';
                        el.style.visibility = 'hidden';
                        el.remove();
                      });
                      
                      // Remove elements in bottom corners
                      document.querySelectorAll('*').forEach(function(el) {
                        if (el.style && (el.style.position === 'fixed' || el.style.position === 'absolute')) {
                          var rect = el.getBoundingClientRect();
                          if (rect.bottom > window.innerHeight - 100 && (rect.left < 200 || rect.right > window.innerWidth - 200)) {
                            var text = el.textContent || '';
                            var html = el.innerHTML || '';
                            if (text.includes('vercel') || text.includes('nextjs') || text.includes('Deploy') || html.includes('vercel') || html.includes('nextjs')) {
                              el.remove();
                            }
                          }
                        }
                      });
                    }
                  } catch (e) {
                    // Silently fail
                  }
                }
                
                // Run when DOM is ready
                if (typeof document !== 'undefined') {
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function() {
                      removeWatermark();
                      setInterval(removeWatermark, 500);
                    });
                  } else {
                    removeWatermark();
                    setInterval(removeWatermark, 500);
                  }
                  
                  // Watch for new elements only if body exists
                  if (document.body) {
                    try {
                      var observer = new MutationObserver(removeWatermark);
                      observer.observe(document.body, { childList: true, subtree: true });
                    } catch (e) {
                      // Fallback to interval only
                    }
                  }
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <RemoveNextJSWatermark />
        {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
