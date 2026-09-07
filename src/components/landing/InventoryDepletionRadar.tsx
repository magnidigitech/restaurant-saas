"use client";

import React, { useState } from "react";
import Image from "next/image";

interface Ingredient {
  id: string;
  name: string;
  category: string;
  percent: number;
  remainingQty: string;
  parLevelQty: string;
  unit: string;
  burnPerOrder: string;
  isLow: boolean;
}

export default function InventoryDepletionRadar() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    {
      id: "paneer",
      name: "Malai Paneer",
      category: "Dairy & Fresh",
      percent: 82,
      remainingQty: "16.4",
      parLevelQty: "5.0",
      unit: "kg",
      burnPerOrder: "1.2 kg",
      isLow: false,
    },
    {
      id: "chicken",
      name: "Fresh Farm Chicken",
      category: "Poultry & Meat",
      percent: 64,
      remainingQty: "32.0",
      parLevelQty: "10.0",
      unit: "kg",
      burnPerOrder: "2.5 kg",
      isLow: false,
    },
    {
      id: "rice",
      name: "Basmati Aged Rice",
      category: "Dry Grains",
      percent: 38,
      remainingQty: "19.0",
      parLevelQty: "15.0",
      unit: "kg",
      burnPerOrder: "1.8 kg",
      isLow: false,
    },
    {
      id: "oil",
      name: "Pure Desi Ghee & Oil",
      category: "Oils & Fats",
      percent: 21,
      remainingQty: "6.3",
      parLevelQty: "8.0",
      unit: "L",
      burnPerOrder: "0.6 L",
      isLow: true,
    },
  ]);

  const [billCount, setBillCount] = useState<number>(0);
  const [lastBilledDish, setLastBilledDish] = useState<string | null>(null);

  const simulateOrderBill = (
    dishName: string,
    burns: { paneer?: number; chicken?: number; rice?: number; oil?: number; ghee?: number }
  ) => {
    setBillCount((prev) => prev + 1);
    setLastBilledDish(dishName);

    setIngredients((prev) =>
      prev.map((item) => {
        let burnAmount = 0;
        if (item.id === "paneer" && burns.paneer) burnAmount = burns.paneer;
        if (item.id === "chicken" && burns.chicken) burnAmount = burns.chicken;
        if (item.id === "rice" && burns.rice) burnAmount = burns.rice;
        if (item.id === "oil" && (burns.oil || burns.ghee)) burnAmount = burns.oil || burns.ghee || 0;

        const newRemaining = Math.max(0.5, parseFloat(item.remainingQty) - burnAmount);
        const newPercent = Math.max(8, Math.round((newRemaining / (parseFloat(item.remainingQty) / (item.percent / 100))) * 100));
        const isNowLow = newPercent < 22;

        return {
          ...item,
          remainingQty: newRemaining.toFixed(1),
          percent: newPercent,
          isLow: isNowLow,
        };
      })
    );
  };

  const resetInventory = () => {
    setIngredients([
      {
        id: "paneer",
        name: "Malai Paneer",
        category: "Dairy & Fresh",
        percent: 82,
        remainingQty: "16.4",
        parLevelQty: "5.0",
        unit: "kg",
        burnPerOrder: "1.2 kg",
        isLow: false,
      },
      {
        id: "chicken",
        name: "Fresh Farm Chicken",
        category: "Poultry & Meat",
        percent: 64,
        remainingQty: "32.0",
        parLevelQty: "10.0",
        unit: "kg",
        burnPerOrder: "2.5 kg",
        isLow: false,
      },
      {
        id: "rice",
        name: "Basmati Aged Rice",
        category: "Dry Grains",
        percent: 38,
        remainingQty: "19.0",
        parLevelQty: "15.0",
        unit: "kg",
        burnPerOrder: "1.8 kg",
        isLow: false,
      },
      {
        id: "oil",
        name: "Pure Desi Ghee & Oil",
        category: "Oils & Fats",
        percent: 21,
        remainingQty: "6.3",
        parLevelQty: "8.0",
        unit: "L",
        burnPerOrder: "0.6 L",
        isLow: true,
      },
    ]);
    setLastBilledDish(null);
  };

  return (
    <section id="inventory-intelligence" className="py-28 bg-[#080909] text-white border-t border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono uppercase tracking-widest text-amber-400 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Bill of Materials Engine</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Know What&apos;s Moving Down to the Gram.
            </h2>
            <p className="text-stone-400 text-sm sm:text-base mt-2 max-w-2xl font-normal">
              Every dish billed at POS burns raw store ingredients in real time. When stock reaches par levels, Resto Bird automatically initiates purchase orders.
            </p>
          </div>

          <div className="shrink-0 flex items-center space-x-3">
            <button
              onClick={() => simulateOrderBill("3x Chicken Biryani + Paneer Tikka", { chicken: 1.5, rice: 1.2, ghee: 0.4, paneer: 1.0 })}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-full font-mono text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
            >
              Bill 3 Biryanis at POS
            </button>
            <button
              onClick={resetInventory}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white rounded-full font-mono text-xs uppercase transition-all"
            >
              Reset Stock
            </button>
          </div>
        </div>

        {/* Real-time Depletion Radar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Visual Storage Racks Render (5 cols) */}
          <div className="lg:col-span-5 relative aspect-square rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-stone-950">
            <Image
              src="/images/resto-bird/scene-storage.jpg"
              alt="Storage & Ingredients 3D"
              fill
              className="object-cover contrast-110 brightness-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080909] via-transparent to-transparent opacity-80" />

            {/* Floating Live Par Alert */}
            <div className="absolute top-6 left-6 right-6 space-y-2">
              {ingredients.filter((i) => i.isLow).map((lowItem) => (
                <div
                  key={lowItem.id}
                  className="p-3.5 rounded-xl glass-panel-amber border border-rose-500/50 bg-rose-950/60 backdrop-blur-xl flex items-center justify-between animate-float-slow"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                    <div>
                      <div className="text-[10px] font-mono text-rose-300 font-bold uppercase tracking-wider">
                        LOW STOCK ALERT
                      </div>
                      <div className="text-xs font-mono text-white font-semibold">
                        {lowItem.name} → {lowItem.percent}% remaining ({lowItem.remainingQty} {lowItem.unit})
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Auto-PO Ready
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom Status */}
            <div className="absolute bottom-6 left-6 right-6 p-3 rounded-xl glass-panel-dark border border-white/10 text-[11px] font-mono text-stone-300 flex items-center justify-between">
              <span>BOM Depletion: Active</span>
              <span className="text-amber-400">{billCount} Live Burns Logged</span>
            </div>
          </div>

          {/* Raw Materials Depletion Matrix (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 rounded-2xl glass-panel-dark border border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-stone-400 uppercase tracking-widest">
                RAW MATERIALS SURVEILLANCE
              </span>
              {lastBilledDish && (
                <span className="text-amber-400 font-semibold animate-pulse">
                  Last Deducted: {lastBilledDish}
                </span>
              )}
            </div>

            {/* Ingredient Gauge Cards */}
            <div className="space-y-3">
              {ingredients.map((ing) => (
                <div
                  key={ing.id}
                  className={`p-5 rounded-2xl glass-panel-dark border transition-all ${
                    ing.isLow
                      ? "border-rose-500/40 bg-rose-950/10"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-bold text-white font-mono">
                          {ing.name}
                        </span>
                        {ing.isLow && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            LOW STOCK
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-stone-400">
                        {ing.category} • Par Level: {ing.parLevelQty} {ing.unit}
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      <div className={`text-xl font-black ${ing.isLow ? "text-rose-400" : "text-amber-400"}`}>
                        {ing.percent}%
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {ing.remainingQty} {ing.unit} left
                      </div>
                    </div>
                  </div>

                  {/* Visual Depletion Progress Bar */}
                  <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        ing.isLow
                          ? "bg-gradient-to-r from-rose-600 to-amber-500"
                          : "bg-gradient-to-r from-amber-600 to-amber-400"
                      }`}
                      style={{ width: `${ing.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-stone-400">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Zero unexplained shrinkage variance</span>
              </div>
              <div className="text-stone-300">
                Gross recipe yield accounted for: 100%
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
