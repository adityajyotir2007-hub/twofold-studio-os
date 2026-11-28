"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAgency } from "@/context/AgencyContext";
import { AuthScreen } from "@/components/AuthScreen";
import { ProspectingView } from "@/components/modules/ProspectingView";
import { Loader2 } from "lucide-react";

export default function ProspectingProductPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated, setActiveSection } = useAgency();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070709] text-neutral-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#e8c79c]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <ProspectingView
      onOpenCrm={() => {
        setActiveSection("dashboard");
        router.push("/");
      }}
    />
  );
}
