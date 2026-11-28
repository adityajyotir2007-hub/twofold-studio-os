"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAgency } from "@/context/AgencyContext";
import { AuthScreen } from "@/components/AuthScreen";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAgency();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="relative">
      <div className="fixed top-4 left-4 z-50">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
        >
          ← Back to Landing Page
        </button>
      </div>
      <AuthScreen />
    </div>
  );
}
