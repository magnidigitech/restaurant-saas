"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RestaurantProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    applicationName: "",
    logoUrl: "",
    faviconUrl: "",
    primaryColor: "#0f172a",
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
          primaryColor: b.primaryColor || "#0f172a",
          secondaryColor: b.secondaryColor || "#3b82f6",
          supportEmail: b.supportEmail || "",
          supportPhone: b.supportPhone || "",
        });
      } else {
        setError(data.error || "Failed to load profile");
      }
    } catch (e) {
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
    } catch (err: any) {
      setError(err.message || "Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="p-8 bg-slate-950 text-slate-400 font-semibold min-h-screen">Loading profile...</main>;
  }

  const activeSub = restaurantData?.subscriptions?.[0];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 max-w-5xl mx-auto space-y-8 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-xs text-blue-400 hover:text-blue-300 mb-2 cursor-pointer">
            &larr; Back to Dashboard
          </button>
          <h2 className="text-3xl font-extrabold text-white">Restaurant Profile & Branding</h2>
          <p className="text-sm text-slate-400 mt-1">Manage brand identity, colors, support contacts, and view limits.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-950/50 border border-green-800 text-green-200 text-sm px-4 py-3 rounded-lg text-center font-medium">
          {success}
        </div>
      )}

      {/* Subscription Plan & Limits Overview */}
      {activeSub && (
        <div className="bg-slate-900/30 border border-slate-900 p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">Subscription & Plan Limits</h3>
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-950 text-blue-300 border border-blue-800 rounded-full">
              Plan: {activeSub.plan.name}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
              <span className="text-slate-500 block text-xs">Outlets Limit</span>
              <span className="font-bold text-slate-200 text-lg">{activeSub.plan.maxOutlets}</span>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
              <span className="text-slate-500 block text-xs">Employees Limit</span>
              <span className="font-bold text-slate-200 text-lg">{activeSub.plan.maxEmployees}</span>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
              <span className="text-slate-500 block text-xs">Admin Users Limit</span>
              <span className="font-bold text-slate-200 text-lg">{activeSub.plan.maxAdminUsers}</span>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
              <span className="text-slate-500 block text-xs">Storage Quota</span>
              <span className="font-bold text-slate-200 text-lg">{activeSub.plan.storageQuotaGb} GB</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900/20 border border-slate-900 p-6 rounded-2xl">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Restaurant Name</label>
            <input
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Application Display Name</label>
            <input
              value={formData.applicationName}
              onChange={(e) => setFormData((prev) => ({ ...prev, applicationName: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Logo URL</label>
            <input
              value={formData.logoUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))}
              placeholder="https://example.com/logo.png"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Favicon URL</label>
            <input
              value={formData.faviconUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, faviconUrl: e.target.value }))}
              placeholder="https://example.com/favicon.ico"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Primary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) => setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                className="w-10 h-10 rounded border border-slate-800 bg-slate-950 cursor-pointer"
              />
              <input
                value={formData.primaryColor}
                onChange={(e) => setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Secondary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.secondaryColor}
                onChange={(e) => setFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))}
                className="w-10 h-10 rounded border border-slate-800 bg-slate-950 cursor-pointer"
              />
              <input
                value={formData.secondaryColor}
                onChange={(e) => setFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm font-mono"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Support Email</label>
            <input
              type="email"
              value={formData.supportEmail}
              onChange={(e) => setFormData((prev) => ({ ...prev, supportEmail: e.target.value }))}
              placeholder="support@restaurant.com"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Support Phone</label>
            <input
              value={formData.supportPhone}
              onChange={(e) => setFormData((prev) => ({ ...prev, supportPhone: e.target.value }))}
              placeholder="+1 (555) 000-0000"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-white text-sm"
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving Changes..." : "Save Profile & Branding"}
          </button>
        </div>
      </form>
    </main>
  );
}
