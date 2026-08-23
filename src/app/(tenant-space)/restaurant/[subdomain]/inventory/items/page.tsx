"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { formatUnit } from "@/core/inventory/units";

interface Item {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  unitOfMeasure: string;
  reorderPoint: number;
  parLevel: number;
  costPerUnit: number;
  currentStock: number;
  isLowStock: boolean;
  category?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

const CULINARY_UOM_GROUPS = [
  {
    group: "Weight Formats",
    options: [
      { value: "LB", label: "Pounds (lb)" },
      { value: "OZ", label: "Ounces (oz)" },
      { value: "KG", label: "Kilograms (kg)" },
      { value: "G", label: "Grams (g)" },
    ],
  },
  {
    group: "Volume & Kitchen Scoops",
    options: [
      { value: "LADLE", label: "Ladle (4 oz / ~118 ml scoop)" },
      { value: "CUP", label: "Cup (8 fl oz / ~237 ml)" },
      { value: "FL_OZ", label: "Fluid Ounces (fl oz)" },
      { value: "TBSP", label: "Tablespoon (tbsp - 15 ml)" },
      { value: "TSP", label: "Teaspoon (tsp - 5 ml)" },
      { value: "GAL", label: "Gallon (gal)" },
      { value: "QT", label: "Quart (qt)" },
      { value: "PT", label: "Pint (pt)" },
      { value: "L", label: "Liter (L)" },
      { value: "ML", label: "Milliliter (ml)" },
    ],
  },
  {
    group: "Count & Meal Portions",
    options: [
      { value: "PIECES", label: "Pieces (pcs)" },
      { value: "DOZEN", label: "Dozen (doz)" },
      { value: "PORTION", label: "Portion / Serving" },
      { value: "BOX", label: "Box" },
      { value: "PACKET", label: "Packet" },
    ],
  },
];

// Simple & Robust CSV / Delimited Spreadsheet Parser
function parseCSV(text: string) {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseRow = (rowStr: string) => {
    const row: string[] = [];
    let insideQuotes = false;
    let currentCell = "";
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if ((char === "," || char === "\t" || char === ";") && !insideQuotes) {
        row.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    return row;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const dataRows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawCells = parseRow(lines[i]);
    if (rawCells.every((c) => !c)) continue;

    const rowObj: any = { rowNumber: i + 1 };
    headers.forEach((h, colIdx) => {
      const val = rawCells[colIdx] || "";
      if (h.includes("name") || h === "item") rowObj.name = val;
      else if (h.includes("sku") || h.includes("code")) rowObj.sku = val;
      else if (h.includes("cat") || h.includes("group")) rowObj.category = val;
      else if (h.includes("uom") || h.includes("unit")) rowObj.unitOfMeasure = val;
      else if (h.includes("cost") || h.includes("price")) rowObj.costPerUnit = val;
      else if (h.includes("reorder") || h.includes("min")) rowObj.reorderPoint = val;
      else if (h.includes("par") || h.includes("max")) rowObj.parLevel = val;
      else if (h.includes("desc") || h.includes("note")) rowObj.description = val;
    });

    if (rowObj.name || rowObj.sku) {
      dataRows.push(rowObj);
    }
  }

  return dataRows;
}

export default function InventoryItemsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bulk Import States
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{
    added: Array<{ row: number; name: string; sku?: string }>;
    skipped: Array<{ row: number; name: string; sku?: string; reason: string }>;
    failed: Array<{ row: number; name: string; reason: string }>;
  } | null>(null);
  const [reportTab, setReportTab] = useState<"added" | "skipped" | "failed">("added");

  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    categoryId: "",
    unitOfMeasure: "PIECES",
    reorderPoint: "",
    parLevel: "",
    costPerUnit: "",
  });

  const fetchData = async (s = search, cat = categoryFilter) => {
    try {
      const p = new URLSearchParams();
      if (s) p.set("search", s);
      if (cat) p.set("categoryId", cat);
      const [resItems, resCats] = await Promise.all([
        fetch(`/api/restaurant/inventory/items?${p}`),
        fetch("/api/restaurant/inventory/categories"),
      ]);
      if (resItems.ok) setItems((await resItems.json()).items || []);
      if (resCats.ok) setCategories((await resCats.json()).categories || []);
    } catch {
      setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchData(val, categoryFilter);
  };

  const handleCategoryFilter = (val: string) => {
    setCategoryFilter(val);
    fetchData(search, val);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError("Item name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          categoryId: form.categoryId || undefined,
          reorderPoint: Number(form.reorderPoint) || 0,
          parLevel: Number(form.parLevel) || 0,
          costPerUnit: Number(form.costPerUnit) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreate(false);
      setForm({
        name: "",
        sku: "",
        description: "",
        categoryId: "",
        unitOfMeasure: "PIECES",
        reorderPoint: "",
        parLevel: "",
        costPerUnit: "",
      });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to create item");
    } finally {
      setSubmitting(false);
    }
  };

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const headers = "Item Name,SKU Code,Category,Unit of Measure,Cost Per Unit,Reorder Point,Par Level,Description\n";
    const sampleRows = [
      'Chicken Breast,RAW-CHK-001,Meat & Poultry,LB,4.50,20,100,Fresh boneless skinless chicken breast',
      'Olive Oil Extra Virgin,CON-OIL-002,Pantry & Condiments,GAL,32.00,5,15,Extra virgin cold pressed olive oil',
      'Basmati Rice 10kg,DRY-RICE-003,Grains & Dry Goods,KG,2.80,50,200,Aromatic long grain basmati rice',
      'Fresh Whole Milk 3.25%,DAI-MLK-004,Dairy & Eggs,L,1.95,30,120,Whole fresh pasteurized milk',
      'Takeout Container 32oz,PKG-BOX-005,Packaging & Supplies,PIECES,0.35,200,1000,Microwavable 32oz food container',
    ].join("\n");

    const blob = new Blob([headers + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_items_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle File Upload & Processing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError("");
    setImportReport(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        throw new Error("The uploaded file contains no valid rows or readable item data.");
      }

      const res = await fetch("/api/restaurant/inventory/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process bulk import");

      setImportReport(data.report);
      if (data.report.added.length > 0) {
        setReportTab("added");
      } else if (data.report.failed.length > 0) {
        setReportTab("failed");
      } else {
        setReportTab("skipped");
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to parse or upload file.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const lowCount = items.filter((i) => i.isLowStock).length;

  return (
    <ModuleAccessGuard moduleKey="inventory" moduleName="Inventory Item Master">
      <div className={`min-h-screen ${isDark ? "bg-[#090B10]" : "bg-slate-50/50"}`}>
        <RestaurantNavbar activeSection="Catalog & SKUs" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header */}
          <div
            className={`p-6 rounded-3xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/restaurant/${subdomain}/inventory`)}
                  className={`text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  ← Inventory Hub
                </button>
                <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
                <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
                <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Catalog &amp; SKUs
                </span>
              </div>

              <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Inventory Item Master
              </h1>
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                {items.length} items total • {lowCount > 0 ? <span className="text-amber-500 font-semibold">{lowCount} low stock alerts</span> : "all inventory healthy"}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setImportReport(null);
                  setShowBulkModal(true);
                }}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
                  isDark
                    ? "bg-blue-500/10 border-blue-500/30 text-[#64B5FF] hover:bg-blue-500/20"
                    : "bg-blue-50 border-blue-200 text-[#0071E3] hover:bg-blue-100 shadow-2xs"
                }`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Upload via Excel</span>
              </button>

              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
              >
                + New Item
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
              {error}
            </div>
          )}

          {/* Filter Controls */}
          <div className="flex gap-3 flex-wrap">
            <input
              placeholder="Search items by name or SKU code..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className={`flex-1 min-w-56 px-4 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            />
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryFilter(e.target.value)}
              className={`px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Items Table */}
          {loading ? (
            <div className="py-20 text-center text-xs opacity-50">Loading inventory catalog...</div>
          ) : items.length === 0 ? (
            <div
              className={`p-12 rounded-3xl border text-center space-y-3 ${
                isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#0071E3] mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold">No inventory items found</h3>
              <p className={`text-xs max-w-sm mx-auto ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Click "+ New Item" or "Upload via Excel" to import ingredients or kitchen supplies into your catalog.
              </p>
            </div>
          ) : (
            <div
              className={`rounded-3xl border overflow-hidden shadow-sm ${
                isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${isDark ? "border-white/[0.08] text-[#8F95A3]" : "border-slate-200 text-slate-500 bg-slate-50/50"}`}>
                      <th className="py-3.5 px-4">Item &amp; SKU</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Unit of Measure</th>
                      <th className="py-3.5 px-4 text-right">Cost Per Unit</th>
                      <th className="py-3.5 px-4 text-right">Current Stock</th>
                      <th className="py-3.5 px-4 text-right">Par Level</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] text-xs">
                    {items.map((item) => (
                      <tr key={item.id} className={`transition ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50/80"}`}>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold">{item.name}</div>
                          {item.sku && <div className="text-[10px] font-mono opacity-50">SKU: {item.sku}</div>}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.category ? (
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-[#0071E3] dark:text-[#64B5FF] text-[11px] font-medium">
                              {item.category.name}
                            </span>
                          ) : (
                            <span className="opacity-40 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          {formatUnit(item.unitOfMeasure as any)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium">
                          ${Number(item.costPerUnit).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          {item.currentStock}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono opacity-60">
                          {item.parLevel}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {item.isLowStock ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold">
                              In Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* BULK IMPORT VIA EXCEL / CSV MODAL */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-2xl p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 ${
                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Bulk Import Inventory Items</h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Upload your item catalog via Excel spreadsheet or CSV file.
                  </p>
                </div>
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {!importReport ? (
                <div className="space-y-5">
                  {/* File Drag & Drop Box */}
                  <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition flex flex-col items-center justify-center space-y-3 relative ${
                      isDark
                        ? "border-white/10 hover:border-[#0071E3]/50 bg-[#090B10]/50"
                        : "border-slate-300 hover:border-[#0071E3] bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      disabled={importing}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3]">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {importing ? "Processing & importing items..." : "Click or drag & drop file to upload"}
                      </p>
                      <p className={`text-xs mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Supports .CSV, .XLSX, .XLS files (up to 1,000 rows)
                      </p>
                    </div>
                    {importing && <div className="text-xs text-[#0071E3] font-medium animate-pulse">Parsing file and validating rows...</div>}
                  </div>

                  {/* Sample Download Prompt */}
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                      isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-blue-50/50 border-blue-100"
                    }`}
                  >
                    <div>
                      <p className="font-semibold">Need the standard import format?</p>
                      <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Includes sample rows for Item Name, SKU, Category, UOM &amp; Cost.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="px-3.5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download Template</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* IMPORT REPORT SUMMARY (ADDED, SKIPPED, FAILED) */
                <div className="space-y-5">
                  {/* Summary Badges Header */}
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setReportTab("added")}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        reportTab === "added"
                          ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/40"
                          : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                        <span>Added</span>
                      </div>
                      <div className="text-xl font-extrabold text-emerald-500 mt-1">{importReport.added.length}</div>
                      <div className="text-[10px] opacity-60">Successfully created</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportTab("skipped")}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        reportTab === "skipped"
                          ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/40"
                          : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-amber-500 flex items-center gap-1">
                        <span>Skipped</span>
                      </div>
                      <div className="text-xl font-extrabold text-amber-500 mt-1">{importReport.skipped.length}</div>
                      <div className="text-[10px] opacity-60">Duplicates in catalog</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportTab("failed")}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        reportTab === "failed"
                          ? "bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/40"
                          : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-rose-500 flex items-center gap-1">
                        <span>Failed</span>
                      </div>
                      <div className="text-xl font-extrabold text-rose-500 mt-1">{importReport.failed.length}</div>
                      <div className="text-[10px] opacity-60">Validation errors</div>
                    </button>
                  </div>

                  {/* TAB DETAILED LIST */}
                  <div className={`p-4 rounded-2xl border text-xs max-h-64 overflow-y-auto ${isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                    {reportTab === "added" && (
                      <div className="space-y-2">
                        <div className="font-semibold text-emerald-500 mb-2">Successfully Added Items ({importReport.added.length})</div>
                        {importReport.added.length === 0 ? (
                          <p className="opacity-50">No new items were added in this import run.</p>
                        ) : (
                          importReport.added.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <span className="font-medium">Row {item.row}: {item.name}</span>
                              {item.sku && <span className="font-mono text-[10px] opacity-60">SKU: {item.sku}</span>}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {reportTab === "skipped" && (
                      <div className="space-y-2">
                        <div className="font-semibold text-amber-500 mb-2">Skipped Duplicate Items ({importReport.skipped.length})</div>
                        {importReport.skipped.length === 0 ? (
                          <p className="opacity-50">No duplicate items skipped.</p>
                        ) : (
                          importReport.skipped.map((item, idx) => (
                            <div key={idx} className="space-y-0.5 py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <div className="flex justify-between font-medium">
                                <span>Row {item.row}: {item.name}</span>
                                {item.sku && <span className="font-mono text-[10px] opacity-60">SKU: {item.sku}</span>}
                              </div>
                              <p className="text-[11px] text-amber-500/80">{item.reason}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {reportTab === "failed" && (
                      <div className="space-y-2">
                        <div className="font-semibold text-rose-500 mb-2">Failed Validation Rows ({importReport.failed.length})</div>
                        {importReport.failed.length === 0 ? (
                          <p className="opacity-50">No validation errors occurred!</p>
                        ) : (
                          importReport.failed.map((item, idx) => (
                            <div key={idx} className="space-y-0.5 py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <div className="font-medium">Row {item.row}: {item.name}</div>
                              <p className="text-[11px] text-rose-400">{item.reason}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setImportReport(null)}
                      className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
                    >
                      ← Upload Another File
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBulkModal(false)}
                      className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Done &amp; Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CREATE SINGLE ITEM MODAL */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 ${
                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Add New Inventory Item</h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Create a raw ingredient or stock SKU.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Boneless Chicken Breast"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      SKU Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. RAW-CHK-001"
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Category
                    </label>
                    <select
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="">No Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Unit of Measure
                    </label>
                    <select
                      value={form.unitOfMeasure}
                      onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      {CULINARY_UOM_GROUPS.map((g) => (
                        <optgroup key={g.group} label={g.group}>
                          {g.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Cost Per Unit ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.costPerUnit}
                      onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Reorder Alert Point
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 10"
                      value={form.reorderPoint}
                      onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Par Stock Level
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 50"
                      value={form.parLevel}
                      onChange={(e) => setForm({ ...form, parLevel: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes or supplier details..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Create Item"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
