"use client";

import React, { useState } from "react";
import { Sparkles, X, Check, Globe, Phone, Building2, Mail, User, Layers, ChevronDown, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import SearchableCountrySelect, { WORLDWIDE_COUNTRIES, CountryOption } from "../SearchableCountrySelect";

export { WORLDWIDE_COUNTRIES as COUNTRY_OPTIONS };
export type { CountryOption };


export interface BookDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOCUS_GOALS = [
  "Gram-Level Inventory Depletion",
  "Multi-Outlet Central Dashboard",
  "Shift Rosters & Buddy-Punching Prevention",
  "Automated Tip Pooling & Payroll",
  "POS System Order Sync",
  "Menu Engineering Margin Analytics",
];

const inputFieldStyles =
  "w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all text-xs font-medium [&:-webkit-autofill]:bg-white [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a]";

export default function BookDemoModal({ isOpen, onClose }: BookDemoModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [fullName, setFullName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(WORLDWIDE_COUNTRIES[0]);

  const [phone, setPhone] = useState("");
  const [outletCount, setOutletCount] = useState("1 Location");
  const [restaurantType, setRestaurantType] = useState("Casual / Fine Dining");
  const [currentPos, setCurrentPos] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCountryChange = (c: CountryOption) => {
    setSelectedCountry(c);
  };

  const toggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter((g) => g !== goal));
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const validateStep1 = () => {
    if (!fullName.trim() || !restaurantName.trim() || !email.trim()) {
      setErrorMsg("Please fill in your name, restaurant name, and work email.");
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const validateStep2 = () => {
    if (!phone.trim()) {
      setErrorMsg("Please enter your phone number.");
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    setErrorMsg("");
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!validateStep1() || !validateStep2()) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/book-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          restaurantName,
          email,
          country: `${selectedCountry.flag} ${selectedCountry.name}`,
          phone,
          outletCount,
          restaurantType,
          currentPos,
          goals: selectedGoals,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit demo request.");
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active,
        textarea:-webkit-autofill,
        select:-webkit-autofill {
          -webkit-box-shadow: 0 0 0px 1000px #ffffff inset !important;
          box-shadow: 0 0 0px 1000px #ffffff inset !important;
          -webkit-text-fill-color: #0f172a !important;
          color: #0f172a !important;
          background-color: #ffffff !important;
          transition: background-color 50000s ease-in-out 0s !important;
        }
      `}</style>
      <div className="bg-white rounded-3xl border border-slate-200/90 max-w-lg w-full shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* Clean Light Top Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between bg-white border-b border-slate-100 shrink-0">
          <img
            src="/resto-bird-logo.png"
            alt="Resto Bird"
            className="h-8 w-auto object-contain"
          />
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {submitted ? (
            <div className="py-8 text-center space-y-5 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">
                  Walkthrough Requested!
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Thank you <strong className="text-slate-900">{fullName}</strong>! We have dispatched your request for <strong className="text-slate-900">{restaurantName}</strong> directly to our team at <strong className="text-amber-700">getrestobird@gmail.com</strong>.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left max-w-md mx-auto text-xs space-y-2">
                <div className="font-bold text-slate-900 border-b border-slate-200 pb-2 flex justify-between items-center">
                  <span>Summary of Submission</span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">RECEIVED</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div><strong>Email:</strong> {email}</div>
                  <div><strong>Phone:</strong> {phone}</div>
                  <div><strong>Locations:</strong> {outletCount}</div>
                  <div><strong>Concept:</strong> {restaurantType}</div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={`mailto:getrestobird@gmail.com?subject=Demo%20Follow-up%20-%20${encodeURIComponent(restaurantName)}`}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2"
                >
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>Email getrestobird@gmail.com</span>
                </a>
                <a
                  href="tel:8184974588"
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-2"
                >
                  <Phone className="w-4 h-4 text-slate-600" />
                  <span>Call 8184974588</span>
                </a>
              </div>

              <button
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-700 underline transition-colors pt-2 block mx-auto"
              >
                Close Window
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Step Progress Bar Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-xs font-bold font-mono">
                    {currentStep}
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {currentStep === 1 && "Step 1 of 3: Contact Information"}
                    {currentStep === 2 && "Step 2 of 3: Location & Operations"}
                    {currentStep === 3 && "Step 3 of 3: Systems & Preferences"}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${currentStep >= 1 ? 'w-5 bg-amber-500' : 'w-2 bg-slate-200'}`} />
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${currentStep >= 2 ? 'w-5 bg-amber-500' : 'w-2 bg-slate-200'}`} />
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${currentStep >= 3 ? 'w-5 bg-amber-500' : 'w-2 bg-slate-200'}`} />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* STEP 1: CONTACT DETAILS */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Full Name *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rahul Sharma / John Smith"
                      className={inputFieldStyles}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Restaurant / Business Name *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="e.g. Spice Route Bistro"
                      className={inputFieldStyles}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>Work Email Address *</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@yourrestaurant.com"
                      className={inputFieldStyles}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-98 flex items-center justify-center space-x-1.5 mt-4"
                  >
                    <span>Next: Location & Operations</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>
              )}

              {/* STEP 2: LOCATION & OPERATIONS (Equal 4-column 2x2 grid layout, country name only) */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* 1. Country (Searchable AJAX-style combobox on typing) */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        <span>Country *</span>
                      </label>
                      <SearchableCountrySelect
                        value={selectedCountry}
                        onChange={handleCountryChange}
                      />
                    </div>


                    {/* 2. Phone */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>Phone / WhatsApp Number *</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={`e.g. ${selectedCountry.dialCode} 8184974588`}
                        className={`${inputFieldStyles} font-mono`}
                      />
                    </div>

                    {/* 3. Outlets */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>Number of Outlets *</span>
                      </label>
                      <select
                        value={outletCount}
                        onChange={(e) => setOutletCount(e.target.value)}
                        className={inputFieldStyles}
                      >
                        <option value="1 Location">1 Single Location</option>
                        <option value="2 - 5 Locations">2 - 5 Locations</option>
                        <option value="6 - 15 Locations">6 - 15 Locations</option>
                        <option value="15+ Enterprise Outlets">15+ Enterprise Outlets</option>
                      </select>
                    </div>

                    {/* 4. Concept */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Restaurant Concept *
                      </label>
                      <select
                        value={restaurantType}
                        onChange={(e) => setRestaurantType(e.target.value)}
                        className={inputFieldStyles}
                      >
                        <option value="Casual / Fine Dining">Casual / Fine Dining</option>
                        <option value="Quick Service (QSR) / Fast Food">Quick Service (QSR) / Fast Food</option>
                        <option value="Cloud Kitchen / Ghost Kitchen">Cloud Kitchen / Ghost Kitchen</option>
                        <option value="Cafe, Bakery & Bistro">Cafe, Bakery & Bistro</option>
                        <option value="Bar, Pub & Brewery">Bar, Pub & Brewery</option>
                        <option value="Catering & Banquets">Catering & Banquets</option>
                        <option value="Hotel & Resort Outlets">Hotel & Resort Outlets</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-2/3 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-98 flex items-center justify-center space-x-1.5"
                    >
                      <span>Next: POS & Goals</span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: SYSTEMS & GOALS */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Current POS System (Optional)
                    </label>
                    <select
                      value={currentPos}
                      onChange={(e) => setCurrentPos(e.target.value)}
                      className={inputFieldStyles}
                    >
                      <option value="">Select current POS system if applicable...</option>
                      <option value="Toast POS">Toast POS</option>
                      <option value="Square POS">Square POS</option>
                      <option value="Clover POS">Clover POS</option>
                      <option value="Petpooja">Petpooja</option>
                      <option value="Lightspeed">Lightspeed</option>
                      <option value="TouchBistro">TouchBistro</option>
                      <option value="Excel / Paper Registers">Excel / Paper Registers</option>
                      <option value="Other System">Other POS System</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Primary Goals & Focus Areas (Select all that apply)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {FOCUS_GOALS.map((goal) => {
                        const isSelected = selectedGoals.includes(goal);
                        return (
                          <button
                            type="button"
                            key={goal}
                            onClick={() => toggleGoal(goal)}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center space-x-1.5 border ${
                              isSelected
                                ? "bg-amber-50 text-amber-900 border-amber-300 font-semibold shadow-xs"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {isSelected ? (
                              <Check className="w-3 h-3 text-amber-600" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            )}
                            <span>{goal}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Preferred Time / Special Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Available tomorrow at 3:00 PM EST..."
                      className={inputFieldStyles}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-2/3 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-98 flex items-center justify-center space-x-1.5 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Dispatched Request...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span>Confirm Walkthrough →</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom email text */}
              <div className="text-right text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-100">
                getrestobird@gmail.com
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
