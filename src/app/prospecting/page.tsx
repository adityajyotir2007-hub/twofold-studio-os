"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAgency } from "@/context/AgencyContext";
import { AuthScreen } from "@/components/AuthScreen";
import { ProspectingView } from "@/components/modules/ProspectingView";
import { Loader2 } from "lucide-react";

export default function ProspectingProductPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated, setActiveSection } = useAgency();
  const [showLogin, setShowLogin] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070709] text-neutral-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#e8c79c]" />
      </div>
    );
  }

  if (!isAuthenticated && showLogin) {
    return (
      <div className="relative">
        <div className="fixed top-4 left-4 z-50">
          <button
            type="button"
            onClick={() => setShowLogin(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
          >
            ← Back to Landing Page
          </button>
        </div>
        <AuthScreen />
      </div>
    );
  }

  return (
    <ProspectingView
      onOpenCrm={() => {
        if (!isAuthenticated) {
          setShowLogin(true);
        } else {
          setActiveSection("dashboard");
          router.push("/");
        }
      }}
      onOpenLogin={() => setShowLogin(true)}
    />
  );
}
