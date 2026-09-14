"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RESTO_BIRD_MODULES } from "@/lib/modulesData";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";

export default function ModulesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* 1. MINIMALIST APPLE/LINEAR LIGHT HEADER */}
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      {/* 2. PAGE CONTENT */}
      <main>{children}</main>

      {/* 3. MINIMALIST CLEAN LIGHT FOOTER */}
      <SiteFooter onOpenDemo={() => setIsDemoModalOpen(true)} />

      {/* 4. BOOK A DEMO MODAL */}
      <BookDemoModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />
    </div>
  );
}

