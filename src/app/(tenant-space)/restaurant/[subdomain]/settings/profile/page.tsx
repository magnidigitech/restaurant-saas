"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

export default function RestaurantProfilePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    applicationName: "",
    logoUrl: "",
    faviconUrl: "",
    primaryColor: "#0071E3",
    secondaryColor: "#3b82f6",
    supportEmail: "",
    supportPhone: "",
  });

  const [restaurantData, setRestaurantData] = useState<any>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/restaurant/profile");
      const data = await res.json();
      if (res.ok && data.restaurant) {
        const r = data.restaurant;
        const b = r.branding || {};
        setRestaurantData(r);
        setFormData({
          name: r.name || "",
          applicationName: b.applicationName || r.name || "",
          logoUrl: b.logoUrl || "",
          faviconUrl: b.faviconUrl || "",
          primaryColor: b.primaryColor || "#0071E3",
          secondaryColor: b.secondaryColor || "#3b82f6",
          supportEmail: b.supportEmail || "",
          supportPhone: b.supportPhone || "",
        });
      } else {
        setError(data.error || "Failed to load profile");
      }
    } catch {
      setError("Network error loading profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/restaurant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.details?.fieldErrors) {
          const firstField = Object.keys(data.details.fieldErrors)[0];
          const firstMsg = data.details.fieldErrors[firstField]?.[0];
          throw new Error(`Validation Error (${firstField}): ${firstMsg}`);
        }
        throw new Error(data.error || "Failed to update profile");
      }

      setSuccess("Restaurant profile and branding updated successfully!");
      fetchProfile();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Restaurant Profile...</p>
      </div>
    );
  }

  const activeSub = restaurantData?.subscriptions?.[0];

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Profile & Branding" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive Header Banner */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/dashboard`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← Dashboard
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Administration
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Restaurant Profile & Branding
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Manage brand identity, theme accent colors, support contacts, and subscription limits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono uppercase px-3 py-1 rounded-full border ${
              isDark ? "bg-white/[0.04] text-[#BAC0CD] border-white/[0.08]" : "bg-slate-100 text-slate-700 border-slate-200"
            }`}>
              Domain: {subdomain}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl">
            {success}
          </div>
        )}

        {/* Subscription Plan & Limits Overview */}
        {activeSub && (
          <div
            className={`p-6 rounded-3xl border transition space-y-4 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                Active Subscription Plan
              </h2>
              <span className="text-xs font-bold uppercase px-3 py-1 bg-[#0071E3]/15 text-[#58A6FF] border border-[#0071E3]/25 rounded-full">
                Plan: {activeSub.plan.name}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                <span className={`block text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Outlets Capacity
                </span>
                <span className={`font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>
                  {activeSub.plan.maxOutlets}
                </span>
              </div>
              <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                <span className={`block text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Staff Limit
                </span>
                <span className={`font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>
                  {activeSub.plan.maxEmployees}
                </span>
              </div>
              <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                <span className={`block text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Admin Logins
                </span>
                <span className={`font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>
                  {activeSub.plan.maxAdminUsers}
                </span>
              </div>
              <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                <span className={`block text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Cloud Storage
                </span>
                <span className={`font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>
                  {activeSub.plan.storageQuotaGb} GB
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Profile Settings Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div
            className={`p-6 sm:p-7 rounded-3xl border transition space-y-5 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
              General Identity & Branding
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Organization Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Application Display Name
                </label>
                <input
                  type="text"
                  value={formData.applicationName}
                  onChange={(e) => setFormData({ ...formData, applicationName: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Logo Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Favicon URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/favicon.ico"
                  value={formData.faviconUrl}
                  onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Brand Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-10 h-10 p-0 border-0 rounded-xl cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className={`flex-1 px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Secondary Tone
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="w-10 h-10 p-0 border-0 rounded-xl cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className={`flex-1 px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Support Email
                </label>
                <input
                  type="email"
                  value={formData.supportEmail}
                  onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Support Phone
                </label>
                <input
                  type="tel"
                  value={formData.supportPhone}
                  onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {saving ? "Saving Changes..." : "Save Profile & Branding"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
