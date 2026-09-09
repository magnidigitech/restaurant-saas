"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function RestaurantOutletsRedirectPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);

  useEffect(() => {
    const isSubdomain =
      typeof window !== "undefined" &&
      (window.location.host.startsWith(`${subdomain}.`) ||
        (window.location.host.includes(".localhost") && !window.location.host.startsWith("admin.")));
    const target = isSubdomain
      ? "/settings/profile?tab=outlets"
      : `/restaurant/${subdomain}/settings/profile?tab=outlets`;
    router.replace(target);
  }, [subdomain, router]);

  return (
    <div className="min-h-screen flex items-center justify-center font-sans text-xs text-slate-400">
      Redirecting to Branch Outlets...
    </div>
  );
}
