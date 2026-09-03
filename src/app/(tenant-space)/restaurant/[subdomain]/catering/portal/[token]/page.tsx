"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/navigation";
import {
  CateringEventDetails,
  SmartMenuTemplate,
  LiveCounterAddon,
  MenuValidationReport,
} from "@/modules/catering/types";
import {
  LIVE_COUNTERS_MASTER,
  MENU_ITEMS_MASTER,
} from "@/modules/catering/templatesData";
import { analyzeAndValidateMenu } from "@/modules/catering/intelligenceEngine";

export default function CustomerCateringPortalPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "bahubali";
  const token = (params?.token as string) || "EVT-2026-001";

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<any>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [clientNotes, setClientNotes] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch event details using public token
  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(
          `/api/restaurant/catering/events?token=${token}&subdomain=${subdomain}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.event) {
            setEventData(data.event);
            setSelectedItemIds(data.event.selectedItemIds || []);
            setSelectedAddonIds(data.event.selectedAddonIds || []);
            if (data.event.status === "CUSTOMER_SUBMITTED" || data.event.status === "APPROVED") {
              setIsSubmitted(true);
            }
          }
        }
      } catch (err) {
        console.error("Error loading event portal:", err);
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [token, subdomain]);

  const template: SmartMenuTemplate | null = eventData?.template || null;
  const eventDetails: CateringEventDetails | null = eventData?.eventDetails || null;

  // Toggle dish in category
  const toggleItem = (itemId: string, category: string, maxAllowed: number) => {
    if (isSubmitted) return;
    setSelectedItemIds((prev) => {
      const isSelected = prev.includes(itemId);
      if (isSelected) {
        return prev.filter((id) => id !== itemId);
      } else {
        const inCat = prev.filter(
          (id) => MENU_ITEMS_MASTER[id]?.category === category
        );
        if (inCat.length >= maxAllowed) {
          const remainingInCat = inCat.slice(1);
          const otherCats = prev.filter(
            (id) => MENU_ITEMS_MASTER[id]?.category !== category
          );
          return [...otherCats, ...remainingInCat, itemId];
        }
        return [...prev, itemId];
      }
    });
  };

  // Toggle Live Counter
  const toggleAddon = (addonId: string) => {
    if (isSubmitted) return;
    setSelectedAddonIds((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  };

  // 1-Click AI Replacement recommendation
  const handleApplyReplacement = (removeId: string, addId: string) => {
    setSelectedItemIds((prev) =>
      prev.map((id) => (id === removeId ? addId : id))
    );
  };

  // AI Validation Report
  const validationReport: MenuValidationReport = useMemo(() => {
    if (!eventDetails) {
      return {
        overallStatus: "GREEN",
        totalSelectedItems: selectedItemIds.length,
        summaryText: "Menu is balanced.",
        advisories: [],
      };
    }
    return analyzeAndValidateMenu(
      selectedItemIds,
      eventDetails.guestCount,
      eventDetails
    );
  }, [selectedItemIds, eventDetails]);

  // Price estimate
  const estimatedPricePerPax = useMemo(() => {
    const base = template?.basePricePerPax || 750;
    const addons = selectedAddonIds.reduce((sum, id) => {
      const ad = LIVE_COUNTERS_MASTER.find((a) => a.id === id);
      return sum + (ad?.pricePerPax || 0);
    }, 0);
    return base + addons;
  }, [template, selectedAddonIds]);

  const handleSubmitMenu = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/restaurant/catering/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CUSTOMER_SUBMIT_MENU",
          token,
          selectedItemIds,
          selectedAddonIds,
          clientNotes,
        }),
      });
      if (res.ok) {
        setIsSubmitted(true);
        try {
          const raw = localStorage.getItem(`bahubali_catering_events_${subdomain}`);
          if (raw) {
            const list = JSON.parse(raw);
            const idx = list.findIndex((e: any) => e.id === token);
            if (idx !== -1) {
              list[idx].status = "CUSTOMER_SUBMITTED";
              list[idx].selectedItemIds = selectedItemIds;
              list[idx].selectedAddonIds = selectedAddonIds;
              localStorage.setItem(`bahubali_catering_events_${subdomain}`, JSON.stringify(list));
            }
          }
        } catch {}
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        alert("Failed to submit menu. Please try again.");
      }
    } catch (err) {
      alert("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-600/10 border border-amber-600/30 flex items-center justify-center animate-pulse mb-4">
          <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-xl font-black text-[#1a120b]">Loading Catering Selection Portal...</h2>
        <p className="text-xs text-stone-500 mt-1">Preparing customized menu courses for you.</p>
      </div>
    );
  }

  if (!eventData || !eventDetails || !template) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md p-8 bg-white rounded-3xl border border-[#E8DFC8] shadow-sm space-y-4">
          <span className="text-3xl">🍽️</span>
          <h2 className="text-2xl font-black text-[#1a120b]">Invitation Link Not Found</h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            This catering menu link may have expired or is invalid. Please contact the Bahubali Catering team to request a new selection invitation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1a120b] font-sans selection:bg-amber-200 pb-20">
      {/* Brand Top Header */}
      <header className="bg-white border-b border-[#E8DFC8] sticky top-0 z-40 shadow-2xs">
        <div className="max-w-5xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-700 via-orange-600 to-amber-500 flex items-center justify-center text-white font-bold shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-[#1a120b] block leading-tight">
                Bahubali Catering
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-stone-500 font-semibold">
                Customer Selection Portal
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-700 font-semibold font-mono">
              Ref: {token}
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
              {eventDetails.guestCount.toLocaleString()} Guests
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 pt-8 space-y-8">
        {/* Welcome Host Hero Card */}
        <section className="bg-white rounded-3xl border border-[#E8DFC8] p-7 sm:p-9 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold mb-2">
                <span>Namaste, {eventDetails.customer.name} Garu</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-[#1a120b] tracking-tight">
                {eventDetails.eventName}
              </h1>
              <p className="text-stone-600 text-sm mt-1.5 leading-relaxed">
                Venue: <strong className="text-stone-900">{eventDetails.venue}</strong> • Date: <strong className="text-stone-900">{eventDetails.eventDate}</strong> • Slot: <strong className="text-stone-900">{eventDetails.mealType} ({eventDetails.eventTime || "12:30 PM"})</strong>
              </p>
            </div>

            {/* Price Preview Card */}
            <div className="p-4 bg-[#FCF9F5] rounded-2xl border border-[#EFE7DC] text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-stone-500 block">Estimated Proposal</span>
              <span className="text-2xl font-black text-amber-900 font-mono">
                ₹{estimatedPricePerPax} <span className="text-xs font-normal text-stone-500">/ Guest</span>
              </span>
              <span className="text-[11px] text-stone-500 block mt-0.5">
                Total: ₹{(estimatedPricePerPax * eventDetails.guestCount).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Submission Success Banner */}
          {isSubmitted && (
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-300 flex items-start space-x-3 text-xs">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                ✓
              </div>
              <div>
                <h4 className="font-bold text-emerald-950 text-sm">
                  Your Menu Selection is Submitted & Locked!
                </h4>
                <p className="text-emerald-900 mt-1 leading-relaxed">
                  Thank you! Our Executive Chef and Catering Director are preparing your finalized proposal and formal quotation. We will reach out to you shortly at <strong>{eventDetails.customer.phone}</strong>.
                </p>
              </div>
            </div>
          )}

          {!isSubmitted && (
            <div className="p-4 bg-[#FAF6F0] rounded-2xl border border-[#E8DFC8] text-xs text-stone-700 leading-relaxed">
              <strong>How it works:</strong> Browse through each course below and select your preferred dishes. The portal enforces the package limits (e.g. 1 Welcome Drink, 2 Starters, 1 Biryani, 2 Curries) so your meal is perfectly balanced. You can also add live specialty stations!
            </div>
          )}
        </section>

        {/* Course-by-Course Selection */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-[#1a120b] tracking-tight">
              Curate Your Menu Courses
            </h2>
            <span className="text-xs text-stone-500">
              Package: <strong>{template.name}</strong>
            </span>
          </div>

          <div className="space-y-6">
            {template.categoryRules.map((rule) => {
              const selectedInCat = selectedItemIds.filter(
                (id) => MENU_ITEMS_MASTER[id]?.category === rule.category
              );
              const isSatisfied = selectedInCat.length === rule.maxSelections;

              return (
                <div
                  key={rule.category}
                  className="bg-white rounded-3xl border border-[#E8DFC8] p-6 sm:p-7 space-y-4 shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div>
                      <h3 className="text-lg font-black text-[#1a120b]">
                        {rule.category}
                      </h3>
                      <span className="text-xs text-stone-500 font-medium">
                        Please choose <strong>{rule.maxSelections}</strong> dish{rule.maxSelections > 1 ? "es" : ""}
                      </span>
                    </div>

                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold border ${
                        isSatisfied
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
                      }`}
                    >
                      {selectedInCat.length} / {rule.maxSelections} Chosen
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rule.availableItems.map((item) => {
                      const isPicked = selectedItemIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.id, rule.category, rule.maxSelections)}
                          className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 border-2 flex flex-col justify-between ${
                            isPicked
                              ? "bg-amber-50/70 border-amber-600 shadow-sm"
                              : "bg-white border-stone-200 hover:border-amber-300 hover:bg-[#FAF6F0]"
                          } ${isSubmitted ? "pointer-events-none opacity-80" : ""}`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.dietary === "VEG"
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : "bg-red-100 text-red-900 border border-red-300"
                                }`}
                              >
                                {item.dietary === "VEG" ? "VEG" : "NON-VEG"}
                              </span>
                              {isPicked && (
                                <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
                                  ✓
                                </span>
                              )}
                            </div>

                            <h4 className="font-black text-sm text-[#1a120b] leading-snug">
                              {item.name}
                            </h4>
                            <p className="text-[11px] text-stone-600 leading-relaxed line-clamp-2">
                              {item.description}
                            </p>
                          </div>

                          <div className="pt-3 mt-3 border-t border-stone-100 flex items-center justify-between text-[11px] font-medium text-amber-900">
                            <span>{item.spiceLevel ? `Spice: ${item.spiceLevel}` : "Chef's Special"}</span>
                            <span>{isPicked ? "✓ Selected" : "+ Select"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Live Counters & Add-ons */}
        <section className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
          <div>
            <h2 className="text-2xl font-black text-[#1a120b] tracking-tight">
              Add Specialty Live Counters & Stalls
            </h2>
            <p className="text-stone-600 text-xs mt-1">
              Treat your guests to hot, live culinary performance stations. (Optional)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {LIVE_COUNTERS_MASTER.map((addon) => {
              const isPicked = selectedAddonIds.includes(addon.id);
              return (
                <div
                  key={addon.id}
                  onClick={() => toggleAddon(addon.id)}
                  className={`p-5 rounded-2xl cursor-pointer transition-all border-2 flex flex-col justify-between ${
                    isPicked
                      ? "bg-amber-50/70 border-amber-600 shadow-sm"
                      : "bg-white border-stone-200 hover:border-amber-300"
                  } ${isSubmitted ? "pointer-events-none opacity-80" : ""}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-stone-500">
                        {addon.category.replace("_", " ")}
                      </span>
                      <span className="text-xs font-black text-amber-900">
                        +₹{addon.pricePerPax} / Guest
                      </span>
                    </div>
                    <h4 className="font-black text-sm text-[#1a120b]">
                      {addon.name}
                    </h4>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      {addon.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-stone-500">
                      Total: ₹{(addon.pricePerPax * eventDetails.guestCount).toLocaleString()}
                    </span>
                    <span className={`font-bold ${isPicked ? "text-amber-800" : "text-stone-600"}`}>
                      {isPicked ? "✓ Added" : "+ Add"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* AI Menu Intelligence & Variety Recommendations */}
        <section className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#1a120b] tracking-tight">
                AI Menu Harmony & Variety Review
              </h2>
              <p className="text-stone-600 text-xs mt-0.5">
                Our chef recommendation engine reviews your dishes for flavor balance and digestion harmony.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              Variety: {validationReport.nutritionProfile?.varietyScore}/100
            </span>
          </div>

          <div className="space-y-3">
            {validationReport.advisories.map((adv) => (
              <div
                key={adv.id}
                className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  adv.level === "GREEN"
                    ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                    : "bg-amber-50/70 border-amber-200 text-amber-950"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center space-x-1.5">
                    <span>{adv.level === "GREEN" ? "✓" : "💡"}</span>
                    <span>{adv.title}</span>
                  </span>
                </div>
                <p className="text-stone-700 leading-relaxed">{adv.message}</p>

                {adv.suggestedReplacement && !isSubmitted && (
                  <div className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-3 mt-2">
                    <span className="text-[11px] text-stone-700">
                      Replace <strong>{adv.suggestedReplacement.removeName}</strong> with <strong className="text-amber-800">{adv.suggestedReplacement.suggestedName}</strong>.
                    </span>
                    <button
                      onClick={() =>
                        handleApplyReplacement(
                          adv.suggestedReplacement!.removeId,
                          adv.suggestedReplacement!.suggestedId
                        )
                      }
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0"
                    >
                      Apply 1-Click
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Submission & Notes Section */}
        {!isSubmitted && (
          <section className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-black text-[#1a120b] tracking-tight">
                Special Requests or Dietary Notes
              </h2>
              <p className="text-stone-600 text-xs mt-0.5">
                Any instructions for the executive chef (e.g. Jain food counters, spice levels, timing of desserts).
              </p>
            </div>

            <textarea
              rows={3}
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder="e.g. Please ensure less oil in curry dishes and provide 50 separate Jain meals for elderly guests."
              className="w-full px-4 py-3 rounded-2xl border border-stone-300 text-xs font-medium focus:outline-none focus:border-amber-600"
            />

            <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-stone-500">
                <span>Summary: <strong>{selectedItemIds.length} Dishes</strong> &bull; <strong>{selectedAddonIds.length} Live Stalls</strong> chosen for <strong>{eventDetails.guestCount.toLocaleString()} Guests</strong></span>
              </div>

              <button
                onClick={handleSubmitMenu}
                disabled={submitting || selectedItemIds.length === 0}
                className="px-8 py-3.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {submitting ? (
                  <span>Submitting Menu...</span>
                ) : (
                  <>
                    <span>Submit & Finalize Menu Selection</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
