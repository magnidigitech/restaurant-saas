"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface DishMetric {
  recipeId: string;
  name: string;
  sellingPrice: number;
  costPerUnit: number;
  contributionMargin: number;
  foodCostPercent: number;
  totalQuantitySold: number;
  totalRevenue: number;
  totalCostOfGoods: number;
  totalGrossProfit: number;
  salesMixPercent: number;
  profitabilityScore: "HIGH" | "LOW";
  popularityScore: "HIGH" | "LOW";
  classification: "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";
  recommendation: string;
}

interface MenuEngineeringData {
  totalDishesCount: number;
  totalUnitsSold: number;
  totalRevenue: number;
  totalGrossProfit: number;
  averageContributionMargin: number;
  averagePopularityThreshold: number;
  averageFoodCostPercent: number;
  stars: DishMetric[];
  plowhorses: DishMetric[];
  puzzles: DishMetric[];
  dogs: DishMetric[];
  allDishes: DishMetric[];
}

interface VarianceItem {
  itemId: string;
  name: string;
  unitOfMeasure: string;
  costPerUnit: number;
  theoreticalUsage: number;
  actualUsage: number;
  varianceQuantity: number;
  varianceCost: number;
  variancePercent: number;
  riskLevel: "CRITICAL" | "WARNING" | "NORMAL";
  explanation: string;
}

interface VarianceData {
  totalTheoreticalCost: number;
  totalActualCost: number;
  netVarianceCost: number;
  netVariancePercent: number;
  criticalLeakItemsCount: number;
  items: VarianceItem[];
}

interface Outlet {
  id: string;
  name: string;
}

export default function MenuEngineeringPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<"MATRIX" | "VARIANCE">("MATRIX");
  const [matrixData, setMatrixData] = useState<MenuEngineeringData | null>(null);
  const [varianceData, setVarianceData] = useState<VarianceData | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [dateRange, setDateRange] = useState<"ALL" | "30D" | "7D" | "TODAY">("ALL");

  const [selectedDish, setSelectedDish] = useState<DishMetric | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      let query = `?dateRange=${dateRange}`;
      if (selectedOutlet) query += `&outletId=${selectedOutlet}`;

      const [resMatrix, resVariance, resOutlets] = await Promise.all([
        fetch(`/api/restaurant/analytics/menu-engineering${query}`),
        fetch(`/api/restaurant/analytics/food-cost-variance${query}`),
        fetch("/api/restaurant/outlets"),
      ]);

      if (resMatrix.ok) setMatrixData(await resMatrix.json());
      if (resVariance.ok) setVarianceData(await resVariance.json());
      if (resOutlets.ok) {
        const outList = (await resOutlets.json()).outlets || [];
        setOutlets(outList);
      }
    } catch {
      setError("Failed to load profitability analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedOutlet, dateRange]);

  if (loading && !matrixData) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Analyzing Menu Performance & Variances...</p>
      </div>
    );
  }

  return (
    <ModuleAccessGuard moduleKey="analytics" moduleName="Analytics & Menu Engineering" activeSection="Analytics">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Analytics" />

      <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive Header Banner */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Executive Profitability Suite
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Menu Engineering & Food Cost Variance
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Kasavana-Smith Profitability Matrix (Stars, Plowhorses, Puzzles, Dogs) and Theoretical vs. Actual inventory variance analysis.
            </p>
          </div>

          {/* Controls: Outlet & Date Range */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-xl border font-semibold cursor-pointer ${
                isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-100 border-slate-200 text-slate-900"
              }`}
            >
              <option value="">All Outlets</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>

            <div className="flex items-center bg-black/[0.04] dark:bg-white/[0.04] p-1 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
              {(["ALL", "30D", "7D", "TODAY"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    dateRange === r
                      ? "bg-[#0071E3] text-white shadow-xs"
                      : isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {r === "ALL" ? "All Time" : r === "30D" ? "30 Days" : r === "7D" ? "7 Days" : "Today"}
                </button>
              ))}
            </div>

            <button
              onClick={() => router.push(`/restaurant/${subdomain}/inventory/recipes`)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                  : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-xs"
              }`}
            >
              Recipe Studio →
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Top Executive KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Total Gross Profit
            </span>
            <p className={`text-2xl font-bold font-mono tracking-tight mt-1 text-emerald-500`}>
              ${Number(matrixData?.totalGrossProfit || 0).toFixed(2)}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Revenue: ${Number(matrixData?.totalRevenue || 0).toFixed(2)}
            </p>
          </div>

          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Overall Food Cost %
            </span>
            <p className={`text-2xl font-bold font-mono tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              {Number(matrixData?.averageFoodCostPercent || 0).toFixed(1)}%
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Target: ~28-32%
            </p>
          </div>

          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Avg. Contribution Margin
            </span>
            <p className={`text-2xl font-bold font-mono tracking-tight mt-1 text-[#0071E3]`}>
              ${Number(matrixData?.averageContributionMargin || 0).toFixed(2)}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Profitability benchmark
            </p>
          </div>

          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Inventory Shrinkage Variance
            </span>
            <p className={`text-2xl font-bold font-mono tracking-tight mt-1 ${
              Number(varianceData?.netVarianceCost || 0) > 0 ? "text-rose-500" : "text-emerald-500"
            }`}>
              {Number(varianceData?.netVarianceCost || 0) > 0 ? `-$${varianceData?.netVarianceCost}` : `$0.00`}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              {varianceData?.criticalLeakItemsCount || 0} critical ingredient leaks
            </p>
          </div>
        </div>

        {/* Tab Navigation: Menu Engineering Matrix vs. Food Cost Variance */}
        <div className="flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
          <button
            onClick={() => setActiveTab("MATRIX")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "MATRIX"
                ? "bg-[#0071E3] text-white shadow-xs"
                : isDark
                ? "text-[#8F95A3] hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Kasavana-Smith 2x2 Matrix ({matrixData?.allDishes.length || 0} Dishes)
          </button>
          <button
            onClick={() => setActiveTab("VARIANCE")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "VARIANCE"
                ? "bg-[#0071E3] text-white shadow-xs"
                : isDark
                ? "text-[#8F95A3] hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Theoretical vs. Actual (TvA) Variances</span>
            {(varianceData?.criticalLeakItemsCount || 0) > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                {varianceData?.criticalLeakItemsCount}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: KASAVANA-SMITH 2x2 MATRIX */}
        {activeTab === "MATRIX" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quadrant 1: STARS (High Profit, High Popularity) */}
              <div
                className={`p-5 rounded-3xl border transition space-y-3 ${
                  isDark ? "bg-[#121622]/80 border-emerald-500/30" : "bg-emerald-50/40 border-emerald-300 shadow-xs"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌟</span>
                    <div>
                      <h3 className={`text-sm font-bold ${isDark ? "text-emerald-300" : "text-emerald-900"}`}>
                        Stars ({matrixData?.stars.length || 0})
                      </h3>
                      <p className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-emerald-700"}`}>
                        High Profit • High Popularity
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    PROTECT & PROMOTE
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {matrixData?.stars.length === 0 ? (
                    <p className={`text-xs py-4 text-center ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      No star dishes in this timeframe.
                    </p>
                  ) : (
                    matrixData?.stars.map((dish) => (
                      <div
                        key={dish.recipeId}
                        onClick={() => setSelectedDish(dish)}
                        className={`p-3 rounded-2xl border cursor-pointer transition hover:scale-[1.01] ${
                          isDark ? "bg-[#0A0C12] border-white/[0.06] hover:border-emerald-500/50" : "bg-white border-emerald-200 hover:border-emerald-400 shadow-xs"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{dish.name}</h4>
                            <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                              Sold: {dish.totalQuantitySold} • Margin: ${dish.contributionMargin.toFixed(2)}/portion
                            </span>
                          </div>
                          <span className="font-mono font-bold text-xs text-emerald-500">
                            +${dish.totalGrossProfit.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quadrant 2: PUZZLES (High Profit, Low Popularity) */}
              <div
                className={`p-5 rounded-3xl border transition space-y-3 ${
                  isDark ? "bg-[#121622]/80 border-purple-500/30" : "bg-purple-50/40 border-purple-300 shadow-xs"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🧩</span>
                    <div>
                      <h3 className={`text-sm font-bold ${isDark ? "text-purple-300" : "text-purple-900"}`}>
                        Puzzles ({matrixData?.puzzles.length || 0})
                      </h3>
                      <p className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-purple-700"}`}>
                        High Profit • Low Popularity
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                    REPOSITION & UPSELL
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {matrixData?.puzzles.length === 0 ? (
                    <p className={`text-xs py-4 text-center ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      No puzzle dishes in this timeframe.
                    </p>
                  ) : (
                    matrixData?.puzzles.map((dish) => (
                      <div
                        key={dish.recipeId}
                        onClick={() => setSelectedDish(dish)}
                        className={`p-3 rounded-2xl border cursor-pointer transition hover:scale-[1.01] ${
                          isDark ? "bg-[#0A0C12] border-white/[0.06] hover:border-purple-500/50" : "bg-white border-purple-200 hover:border-purple-400 shadow-xs"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{dish.name}</h4>
                            <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                              Sold: {dish.totalQuantitySold} • High Margin: ${dish.contributionMargin.toFixed(2)}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-xs text-purple-400">
                            +${dish.totalGrossProfit.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quadrant 3: PLOWHORSES (Low Profit, High Popularity) */}
              <div
                className={`p-5 rounded-3xl border transition space-y-3 ${
                  isDark ? "bg-[#121622]/80 border-amber-500/30" : "bg-amber-50/40 border-amber-300 shadow-xs"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🐴</span>
                    <div>
                      <h3 className={`text-sm font-bold ${isDark ? "text-amber-300" : "text-amber-900"}`}>
                        Plowhorses ({matrixData?.plowhorses.length || 0})
                      </h3>
                      <p className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-amber-700"}`}>
                        Low Profit • High Popularity
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    RE-ENGINEER / RAISE PRICE
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {matrixData?.plowhorses.length === 0 ? (
                    <p className={`text-xs py-4 text-center ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      No plowhorse dishes in this timeframe.
                    </p>
                  ) : (
                    matrixData?.plowhorses.map((dish) => (
                      <div
                        key={dish.recipeId}
                        onClick={() => setSelectedDish(dish)}
                        className={`p-3 rounded-2xl border cursor-pointer transition hover:scale-[1.01] ${
                          isDark ? "bg-[#0A0C12] border-white/[0.06] hover:border-amber-500/50" : "bg-white border-amber-200 hover:border-amber-400 shadow-xs"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{dish.name}</h4>
                            <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                              High Sales: {dish.totalQuantitySold} sold • Cost: ${dish.costPerUnit.toFixed(2)}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-xs text-amber-500">
                            +${dish.totalGrossProfit.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quadrant 4: DOGS (Low Profit, Low Popularity) */}
              <div
                className={`p-5 rounded-3xl border transition space-y-3 ${
                  isDark ? "bg-[#121622]/80 border-rose-500/30" : "bg-rose-50/40 border-rose-300 shadow-xs"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🐕</span>
                    <div>
                      <h3 className={`text-sm font-bold ${isDark ? "text-rose-300" : "text-rose-900"}`}>
                        Dogs ({matrixData?.dogs.length || 0})
                      </h3>
                      <p className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-rose-700"}`}>
                        Low Profit • Low Popularity
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">
                    REMOVE / REINVENT
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {matrixData?.dogs.length === 0 ? (
                    <p className={`text-xs py-4 text-center ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      No dog dishes in this timeframe.
                    </p>
                  ) : (
                    matrixData?.dogs.map((dish) => (
                      <div
                        key={dish.recipeId}
                        onClick={() => setSelectedDish(dish)}
                        className={`p-3 rounded-2xl border cursor-pointer transition hover:scale-[1.01] ${
                          isDark ? "bg-[#0A0C12] border-white/[0.06] hover:border-rose-500/50" : "bg-white border-rose-200 hover:border-rose-400 shadow-xs"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{dish.name}</h4>
                            <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                              Sold: {dish.totalQuantitySold} • Margin: ${dish.contributionMargin.toFixed(2)}
                            </span>
                          </div>
                          <span className={`font-mono text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                            +${dish.totalGrossProfit.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Complete Menu Dishes Performance Table */}
            <div
              className={`p-6 rounded-3xl border transition space-y-4 ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                Comprehensive Menu Ranking & Recommendations
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                      isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                    }`}>
                      <th className="pb-3 px-3">Dish Name</th>
                      <th className="pb-3 px-3">Class</th>
                      <th className="pb-3 px-3">Price</th>
                      <th className="pb-3 px-3">Cost / Unit</th>
                      <th className="pb-3 px-3">Margin ($)</th>
                      <th className="pb-3 px-3">Food Cost %</th>
                      <th className="pb-3 px-3">Units Sold</th>
                      <th className="pb-3 px-3">Total Profit</th>
                      <th className="pb-3 px-3">Action Strategy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {matrixData?.allDishes.map((dish) => (
                      <tr
                        key={dish.recipeId}
                        onClick={() => router.push(`/restaurant/${subdomain}/inventory/recipes/${dish.recipeId}`)}
                        className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer group"
                      >
                        <td className={`py-3.5 px-3 font-semibold group-hover:text-[#0071E3] ${isDark ? "text-white" : "text-slate-900"}`}>
                          {dish.name}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            dish.classification === "STAR"
                              ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : dish.classification === "PUZZLE"
                              ? isDark ? "bg-purple-500/15 text-purple-300 border-purple-500/30" : "bg-purple-100 text-purple-800 border-purple-200"
                              : dish.classification === "PLOWHORSE"
                              ? isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-amber-100 text-amber-800 border-amber-200"
                              : isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/30" : "bg-rose-100 text-rose-800 border-rose-200"
                          }`}>
                            {dish.classification}
                          </span>
                        </td>
                        <td className={`py-3.5 px-3 font-mono ${isDark ? "text-white" : "text-slate-900"}`}>
                          ${dish.sellingPrice.toFixed(2)}
                        </td>
                        <td className={`py-3.5 px-3 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                          ${dish.costPerUnit.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-[#0071E3]">
                          ${dish.contributionMargin.toFixed(2)}
                        </td>
                        <td className={`py-3.5 px-3 font-mono ${dish.foodCostPercent > 35 ? "text-rose-500 font-bold" : ""}`}>
                          {dish.foodCostPercent.toFixed(1)}%
                        </td>
                        <td className={`py-3.5 px-3 font-mono ${isDark ? "text-white" : "text-slate-900"}`}>
                          {dish.totalQuantitySold}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-extrabold text-emerald-500">
                          ${dish.totalGrossProfit.toFixed(2)}
                        </td>
                        <td className={`py-3.5 px-3 text-[11px] max-w-xs truncate ${isDark ? "text-[#BAC0CD]" : "text-slate-600"}`}>
                          {dish.recommendation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: THEORETICAL VS ACTUAL (TvA) FOOD COST VARIANCES */}
        {activeTab === "VARIANCE" && (
          <div className="space-y-6">
            <div
              className={`p-6 rounded-3xl border transition space-y-4 ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                    Theoretical vs. Actual (TvA) Ingredient Consumption Breakdown
                  </h3>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Calculates variance between recipe specifications and physical stock ledger movements.
                  </p>
                </div>
              </div>

              {varianceData?.items.length === 0 ? (
                <div className={`p-12 text-center text-xs space-y-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  <p className="font-semibold">No stock variance recorded</p>
                  <p className="opacity-75">All inventory usage matches POS recipe theoretical specifications.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                        isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                      }`}>
                        <th className="pb-3 px-3">Inventory Ingredient</th>
                        <th className="pb-3 px-3">Unit Cost</th>
                        <th className="pb-3 px-3">Theoretical (POS)</th>
                        <th className="pb-3 px-3">Actual (Ledger)</th>
                        <th className="pb-3 px-3">Variance Qty</th>
                        <th className="pb-3 px-3">Variance %</th>
                        <th className="pb-3 px-3">Dollar Loss ($)</th>
                        <th className="pb-3 px-3">Audit Analysis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {varianceData?.items.map((v) => (
                        <tr key={v.itemId} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                          <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                            {v.name}
                          </td>
                          <td className={`py-3.5 px-3 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            ${v.costPerUnit.toFixed(2)} / {v.unitOfMeasure}
                          </td>
                          <td className={`py-3.5 px-3 font-mono ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                            {v.theoreticalUsage} {v.unitOfMeasure}
                          </td>
                          <td className={`py-3.5 px-3 font-mono ${isDark ? "text-white" : "text-slate-900"}`}>
                            {v.actualUsage} {v.unitOfMeasure}
                          </td>
                          <td className={`py-3.5 px-3 font-mono font-bold ${
                            v.varianceQuantity > 0 ? "text-rose-500" : v.varianceQuantity < 0 ? "text-amber-500" : "text-emerald-500"
                          }`}>
                            {v.varianceQuantity > 0 ? `+${v.varianceQuantity}` : v.varianceQuantity} {v.unitOfMeasure}
                          </td>
                          <td className={`py-3.5 px-3 font-mono font-bold ${
                            v.variancePercent > 15 ? "text-rose-500" : v.variancePercent > 5 ? "text-amber-500" : "text-emerald-500"
                          }`}>
                            {v.variancePercent > 0 ? `+${v.variancePercent}%` : `${v.variancePercent}%`}
                          </td>
                          <td className={`py-3.5 px-3 font-mono font-extrabold ${
                            v.varianceCost > 0 ? "text-rose-500" : "text-emerald-500"
                          }`}>
                            {v.varianceCost > 0 ? `-$${v.varianceCost.toFixed(2)}` : `$0.00`}
                          </td>
                          <td className={`py-3.5 px-3 text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                            {v.explanation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Dish Strategy Recommendation Modal */}
      {selectedDish && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                  selectedDish.classification === "STAR"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : selectedDish.classification === "PUZZLE"
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                    : selectedDish.classification === "PLOWHORSE"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                }`}>
                  {selectedDish.classification} CLASSIFICATION
                </span>
                <h2 className="text-lg font-bold tracking-tight mt-1.5">{selectedDish.name}</h2>
              </div>
              <button onClick={() => setSelectedDish(null)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            {/* Performance Stats */}
            <div className={`p-4 rounded-2xl border text-xs grid grid-cols-3 gap-2 ${
              isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
            }`}>
              <div>
                <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Selling Price:</span>
                <p className="font-mono font-bold text-sm mt-0.5">${selectedDish.sellingPrice.toFixed(2)}</p>
              </div>
              <div>
                <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Cost / Unit:</span>
                <p className="font-mono font-bold text-sm mt-0.5">${selectedDish.costPerUnit.toFixed(2)}</p>
              </div>
              <div>
                <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Profit Margin:</span>
                <p className="font-mono font-bold text-sm text-[#0071E3] mt-0.5">${selectedDish.contributionMargin.toFixed(2)}</p>
              </div>
            </div>

            {/* Actionable Strategy Advice */}
            <div className="space-y-1.5 pt-1">
              <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                Culinary & Menu Engineering Strategy
              </span>
              <p className={`text-xs leading-relaxed p-3.5 rounded-2xl border ${
                isDark ? "bg-[#0071E3]/10 border-[#0071E3]/20 text-[#BAC0CD]" : "bg-blue-50/70 border-blue-200 text-blue-900"
              }`}>
                {selectedDish.recommendation}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                onClick={() => setSelectedDish(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedDish(null);
                  router.push(`/restaurant/${subdomain}/inventory/recipes/${selectedDish.recipeId}`);
                }}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Open Recipe Dossier →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ModuleAccessGuard>
  );
}
