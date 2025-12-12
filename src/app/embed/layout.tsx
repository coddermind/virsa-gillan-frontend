"use client";

import type { Metadata } from "next";
import { useEffect } from "react";

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Ensure body and html fill the iframe height
    document.documentElement.style.height = "100%";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.body.style.height = "100%";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
  }, []);

  return (
    <div style={{ height: "100%", width: "100%", margin: 0, padding: 0, overflow: "hidden" }}>
      {children}
    </div>
  );
}

