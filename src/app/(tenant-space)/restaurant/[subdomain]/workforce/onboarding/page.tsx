"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";

export default function OnboardingRedirectPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  useEffect(() => {
    router.replace(`/restaurant/${subdomain}/workforce/employees?tab=onboarding`);
  }, [router, subdomain]);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-xs font-medium">Redirecting to HR Onboarding...</p>
    </div>
  );
}
