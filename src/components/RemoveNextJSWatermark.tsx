"use client";

import { useEffect } from "react";

export default function RemoveNextJSWatermark() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    // Remove Next.js watermark links
    const removeWatermark = () => {
      try {
        // Remove all links containing vercel or nextjs
        const allLinks = document.querySelectorAll("a");
        allLinks.forEach((link) => {
          const href = link.getAttribute("href") || "";
          const text = link.textContent || "";
          
          if (
            href.includes("vercel.com") ||
            href.includes("nextjs.org") ||
            text.includes("Powered by") ||
            text.includes("Deploy") ||
            (href.includes("vercel.com/new") && text.toLowerCase().includes("deploy"))
          ) {
            link.style.display = "none";
            link.style.visibility = "hidden";
            link.remove();
          }
        });

        // Remove fixed/absolute positioned elements in bottom corners
        const allElements = document.querySelectorAll("*");
        allElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            try {
              const style = window.getComputedStyle(el);
              const position = style.position;
              
              if (position === "fixed" || position === "absolute") {
                const rect = el.getBoundingClientRect();
                const isInBottomLeft = rect.bottom > window.innerHeight - 100 && rect.left < 200;
                const isInBottomRight = rect.bottom > window.innerHeight - 100 && rect.right > window.innerWidth - 200;
                
                if (isInBottomLeft || isInBottomRight) {
                  const text = el.textContent || "";
                  const innerHTML = el.innerHTML || "";
                  
                  if (
                    text.includes("Next.js") ||
                    text.includes("Vercel") ||
                    text.includes("Deploy") ||
                    innerHTML.includes("vercel.com") ||
                    innerHTML.includes("nextjs.org") ||
                    el.querySelector('a[href*="vercel"]') ||
                    el.querySelector('a[href*="nextjs"]')
                  ) {
                    el.remove();
                  }
                }
              }
            } catch (e) {
              // Skip if element is not accessible
            }
          }
        });
      } catch (error) {
        // Silently handle errors
      }
    };

    // Wait for body to be available
    const init = () => {
      if (!document.body) {
        setTimeout(init, 100);
        return;
      }

      removeWatermark();
      
      // Use MutationObserver only if body exists
      let observer: MutationObserver | null = null;
      try {
        observer = new MutationObserver(removeWatermark);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      } catch (error) {
        // Observer failed, use interval only
      }

      // Also run periodically as backup
      const interval = setInterval(removeWatermark, 1000);

      return () => {
        if (observer) {
          observer.disconnect();
        }
        clearInterval(interval);
      };
    };

    const cleanup = init();
    return cleanup;
  }, []);

  return null;
}

