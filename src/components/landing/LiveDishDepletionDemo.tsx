"use client";

import React, { useState } from "react";
import Card3D from "./Card3D";

interface Dish {
  id: string;
  name: string;
  course: string;
  price: number;
  cost: number;
  badge: string;
  ingredients: {
    name: string;
    perPortion: number;
    unit: string;
    inventoryStock: number;
  }[];
}

const DISHES: Dish[] = [
  {
    id: "biryani",
    name: "Royal Hyderabadi Dum Biryani",
    course: "Main Course & Rice",
    price: 18,
    cost: 5.5,
    badge: "Bestseller Dish",
    ingredients: [
      { name: "Aged Kohinoor Basmati Rice", perPortion: 0.25, unit: "KG", inventoryStock: 65.0 },
      { name: "Farm-Fresh Marinated Chicken", perPortion: 0.22, unit: "KG", inventoryStock: 48.0 },
      { name: "Pure Desi Cow Ghee", perPortion: 0.03, unit: "L", inventoryStock: 18.5 },
      { name: "Kashmiri Saffron & Shahi Masala", perPortion: 0.015, unit: "KG", inventoryStock: 4.8 },
    ],
  },
  {
    id: "chicken65",
    name: "Chicken 65 Starter",
    course: "Starters & Appetizers",
    price: 12,
    cost: 3.5,
    badge: "Hot Kitchen Pick",
    ingredients: [
      { name: "Boneless Tender Chicken Chunks", perPortion: 0.2, unit: "KG", inventoryStock: 35.0 },
      { name: "Organic Curry Leaves & Chillies", perPortion: 0.02, unit: "KG", inventoryStock: 6.5 },
      { name: "Cold-Pressed Groundnut Oil", perPortion: 0.04, unit: "L", inventoryStock: 25.0 },
      { name: "Red Pepper 65 Spice Marinade", perPortion: 0.03, unit: "KG", inventoryStock: 12.0 },
    ],
  },
  {
    id: "paneer",
    name: "Paneer Butter Masala",
    course: "Vegetarian Specialties",
    price: 14,
    cost: 4.0,
    badge: "Chef's Signature",
    ingredients: [
      { name: "Fresh Cream Malai Paneer", perPortion: 0.2, unit: "KG", inventoryStock: 24.0 },
      { name: "Rich Tomato & Cashew Gravy", perPortion: 0.15, unit: "L", inventoryStock: 30.0 },
      { name: "Amul Table Butter & Fresh Cream", perPortion: 0.04, unit: "KG", inventoryStock: 15.0 },
      { name: "Kasuri Methi & Green Cardamom", perPortion: 0.01, unit: "KG", inventoryStock: 3.2 },
    ],
  },
  {
    id: "lassi",
    name: "Fresh Mint Lassi Cooler",
    course: "Beverages & Refreshers",
    price: 5,
    cost: 1.2,
    badge: "76% Gross Margin",
    ingredients: [
      { name: "Farmhouse Thick Dairy Curd", perPortion: 0.2, unit: "KG", inventoryStock: 40.0 },
      { name: "Fresh Hydroponic Spearmint", perPortion: 0.02, unit: "KG", inventoryStock: 5.5 },
      { name: "Khand Syrup & Roasted Jeera", perPortion: 0.03, unit: "L", inventoryStock: 14.0 },
      { name: "Chilled Filtered Spring Water", perPortion: 0.1, unit: "L", inventoryStock: 100.0 },
    ],
  },
];

export default function LiveDishDepletionDemo() {
  const [selectedDishId, setSelectedDishId] = useState<string>("biryani");
  const [orderQuantity, setOrderQuantity] = useState<number>(10);
  const [depletionPing, setDepletionPing] = useState<boolean>(false);

  const selectedDish = DISHES.find((d) => d.id === selectedDishId) || DISHES[0];

  const totalRevenue = selectedDish.price * orderQuantity;
  const totalCost = selectedDish.cost * orderQuantity;
  const totalProfit = totalRevenue - totalCost;
  const marginPercent = Math.round(((totalRevenue - totalCost) / totalRevenue) * 100);

  const triggerDepletionEffect = () => {
    setDepletionPing(true);
    setTimeout(() => setDepletionPing(false), 800);
  };

  return (
    <section className="relative z-10 py-24 max-w-7xl mx-auto px-6 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
          <span>Bahubali Recipe Engine &bull; Automatic Stock Depletion</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-black text-[#1a120b] tracking-tight">
          Live POS Recipe Stock Depletion
        </h2>
        <p className="text-stone-600 text-base leading-relaxed">
          Select signature dishes from our Bahubali menu catalog. Watch how RestIQ automatically burns raw ingredients from central inventory stores whenever a POS ticket is billed.
        </p>
      </div>

      {/* Dish Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {DISHES.map((dish) => {
          const isSelected = dish.id === selectedDishId;
          return (
            <button
              key={dish.id}
              onClick={() => {
                setSelectedDishId(dish.id);
                triggerDepletionEffect();
              }}
              className={`p-4 rounded-2xl border text-left transition-all ${
                isSelected
                  ? "bg-white border-amber-600 shadow-lg ring-2 ring-amber-500/20"
                  : "bg-white/80 hover:bg-white border-[#E8DFC8] shadow-2xs"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase font-bold text-stone-400 font-mono tracking-wider">
                  {dish.course}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  {dish.badge}
                </span>
              </div>
              <h4 className="font-bold text-[#1a120b] text-sm">{dish.name}</h4>
              <div className="flex justify-between items-center mt-3 pt-2 border-t border-stone-100 text-xs">
                <span className="font-mono font-bold text-stone-900">${dish.price}.00</span>
                <span className="font-mono text-emerald-700 font-bold">
                  {Math.round(((dish.price - dish.cost) / dish.price) * 100)}% margin
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Interactive Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Quantity Scaler and Recipe Ingredients */}
        <div className="lg:col-span-7 bg-white p-7 rounded-3xl border border-[#E8DFC8] shadow-xl space-y-6">
          {/* Quantity Slider */}
          <div className="space-y-3 pb-6 border-b border-stone-100">
            <div className="flex justify-between items-center">
              <div>
                <label className="text-xs font-bold text-[#1a120b] uppercase tracking-wider block">
                  Simulate Order Volume (Plates Billed)
                </label>
                <span className="text-xs text-stone-500">
                  Adjust plate volume to simulate lunch rush vs catering banquet
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-mono font-black text-sm rounded-xl shadow-xs">
                  {orderQuantity} Portions
                </span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={orderQuantity}
              onChange={(e) => {
                setOrderQuantity(Number(e.target.value));
                triggerDepletionEffect();
              }}
              className="w-full h-2.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
            <div className="flex justify-between text-[11px] text-stone-400 font-mono">
              <span>1 portion (Table Dine-In)</span>
              <span>25 portions (Evening Rush)</span>
              <span>100 portions (Banquet Order)</span>
            </div>
          </div>

          {/* Ingredient Deduction List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#1a120b] uppercase tracking-wider">
                Recipe Bill-of-Materials Depletion
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold transition-all ${
                  depletionPing
                    ? "bg-orange-600 text-white scale-105"
                    : "bg-amber-100 text-amber-900 border border-amber-200"
                }`}
              >
                {depletionPing ? "BURNING INVENTORY..." : "LIVE SYNCED"}
              </span>
            </div>

            <div className="space-y-2.5">
              {selectedDish.ingredients.map((ing, idx) => {
                const totalDeduction = (ing.perPortion * orderQuantity).toFixed(2);
                const remainingStock = Math.max(
                  0,
                  ing.inventoryStock - Number(totalDeduction)
                ).toFixed(2);

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[#FCF9F5] border border-[#EFE7DC] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-[#FAF4EC] transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-[#1a120b] block">
                        {ing.name}
                      </span>
                      <span className="text-[11px] text-stone-500 font-mono">
                        Standard Yield: {ing.perPortion} {ing.unit}/plate &bull; Store balance:{" "}
                        {ing.inventoryStock} {ing.unit}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs font-mono">
                      <span className="px-2.5 py-1 bg-orange-100 text-orange-800 rounded-lg font-bold border border-orange-200">
                        -{totalDeduction} {ing.unit}
                      </span>
                      <span className="text-stone-600">
                        Remaining: <strong className="text-stone-900">{remainingStock}</strong> {ing.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Real-Time Financial Margin Summary */}
        <div className="lg:col-span-5 space-y-6">
          <Card3D maxTilt={8} scale={1.02}>
            <div className="p-7 bg-[#1a120b] text-white rounded-3xl shadow-2xl space-y-6 border border-[#3e2723]">
              <div className="flex justify-between items-center border-b border-stone-800 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono tracking-widest text-amber-400 block">
                    Financial Impact &bull; {orderQuantity} Portions
                  </span>
                  <h4 className="text-lg font-black text-amber-50 mt-0.5">
                    {selectedDish.name}
                  </h4>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 text-xs font-mono font-bold border border-emerald-800">
                  {marginPercent}% MARGIN
                </span>
              </div>

              {/* Financial Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[#261c14] rounded-2xl border border-stone-800">
                  <span className="text-[11px] text-stone-400 block">Gross Sales Revenue</span>
                  <span className="text-2xl font-black font-mono text-amber-400 mt-1 block">
                    ${totalRevenue.toLocaleString()}
                  </span>
                </div>
                <div className="p-4 bg-[#261c14] rounded-2xl border border-stone-800">
                  <span className="text-[11px] text-stone-400 block">Raw Material COGS</span>
                  <span className="text-2xl font-black font-mono text-orange-400 mt-1 block">
                    ${totalCost.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Profit Margin Meter */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-400">Net Food Margin Contribution</span>
                  <span className="font-mono font-bold text-emerald-400">
                    +${totalProfit.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-3 bg-stone-900 rounded-full overflow-hidden p-0.5 border border-stone-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${marginPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                  <span>Industry Par: 60%</span>
                  <span className="text-emerald-400 font-bold">Bahubali Realized: {marginPercent}%</span>
                </div>
              </div>

              {/* Automated Purchase Order Trigger */}
              <div className="p-4 bg-[#241710] rounded-2xl border border-amber-900/60 text-xs space-y-1">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Automated Purchase Order Pipeline</span>
                </div>
                <p className="text-stone-300 text-[11px] leading-relaxed">
                  When raw Basmati Rice or Dairy Paneer crosses safe minimum reorder levels, RestIQ automatically writes a supplier PO into <strong className="text-amber-300">Purchase Management</strong> for 1-click WhatsApp or email dispatch.
                </p>
              </div>
            </div>
          </Card3D>
        </div>
      </div>
    </section>
  );
}
