"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { formatUnit } from "@/core/inventory/units";
import { ArrowLeft, Package, Boxes, Upload } from "lucide-react";

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
  isOutOfStock?: boolean;
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
      if (h === "itemname" || h === "name" || h === "item" || (h.includes("name") && !h.includes("category"))) {
        rowObj.name = val;
      } else if (h === "skucode" || h === "sku" || h === "code" || h.includes("sku")) {
        rowObj.sku = val;
      } else if (h === "category" || h === "cat" || h.includes("category") || h.includes("group")) {
        rowObj.category = val;
      } else if (h.includes("cost") || h.includes("price") || h === "costperunit" || h === "unitcost") {
        rowObj.costPerUnit = val;
      } else if (h.includes("reorder") || h.includes("minstock") || h === "reorderpoint") {
        rowObj.reorderPoint = val;
      } else if (h.includes("par") || h.includes("maxstock") || h === "parlevel") {
        rowObj.parLevel = val;
      } else if (h.includes("unitofmeasure") || h === "uom" || h === "unit" || h.includes("measure") || h.includes("unitof")) {
        rowObj.unitOfMeasure = val;
      } else if (h.includes("desc") || h.includes("note")) {
        rowObj.description = val;
      }
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
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Bulk Import States
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isBulkFullScreen, setIsBulkFullScreen] = useState(true);
  const [previewFile, setPreviewFile] = useState<{ name: string; size: number } | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [previewFilterTab, setPreviewFilterTab] = useState<"all" | "update" | "new" | "identical">("all");
  const [expandedDiffRowIdx, setExpandedDiffRowIdx] = useState<number | null>(null);
  const [importReport, setImportReport] = useState<{
    added: Array<{ row: number; name: string; sku?: string }>;
    updated: Array<{
      row: number;
      name: string;
      sku?: string;
      overrides: Array<{ field: string; label: string; oldValue: string; newValue: string }>;
    }>;
    skipped: Array<{ row: number; name: string; sku?: string; reason: string }>;
    failed: Array<{ row: number; name: string; reason: string }>;
  } | null>(null);
  const [reportTab, setReportTab] = useState<"updated" | "added" | "skipped" | "failed">("updated");

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

  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    description: "",
    categoryId: "",
    unitOfMeasure: "PIECES",
    reorderPoint: "",
    parLevel: "",
    costPerUnit: "",
  });

  // Quick Category Creation States
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [quickCategoryError, setQuickCategoryError] = useState("");

  const handleQuickCreateCategory = async (target: "create" | "edit" = "create") => {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    setQuickCategoryError("");
    try {
      const res = await fetch("/api/restaurant/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create category");

      const newCat: Category = data.category;
      setCategories((prev) => [...prev, newCat]);
      if (target === "create") {
        setForm((prev) => ({ ...prev, categoryId: newCat.id }));
      } else {
        setEditForm((prev) => ({ ...prev, categoryId: newCat.id }));
      }
      setNewCategoryName("");
      setShowQuickCategory(false);
    } catch (err: any) {
      setQuickCategoryError(err.message || "Failed to create category");
    } finally {
      setCreatingCategory(false);
    }
  };

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

  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      sku: item.sku || "",
      description: item.description || "",
      categoryId: item.category?.id || "",
      unitOfMeasure: item.unitOfMeasure || "PIECES",
      reorderPoint: String(item.reorderPoint ?? 0),
      parLevel: String(item.parLevel ?? 0),
      costPerUnit: String(item.costPerUnit ?? 0),
    });
    setError("");
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editForm.name) {
      setError("Item name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/inventory/items/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          sku: editForm.sku || undefined,
          description: editForm.description || undefined,
          categoryId: editForm.categoryId || null,
          unitOfMeasure: editForm.unitOfMeasure,
          reorderPoint: Number(editForm.reorderPoint) || 0,
          parLevel: Number(editForm.parLevel) || 0,
          costPerUnit: Number(editForm.costPerUnit) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingItem(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to update item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!editingItem) return;
    if (!confirm(`Are you sure you want to remove '${editingItem.name}' from your catalog?`)) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/inventory/items/${editingItem.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete item");
      }
      setEditingItem(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to delete item");
    } finally {
      setDeleting(false);
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

  // Step 1: Handle File Selection & Local Parsing with Multi-Field Diffing across all 8 fields
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setImportReport(null);
    setExpandedDiffRowIdx(null);
    setPreviewFilterTab("all");

    try {
      const text = await file.text();
      const rawRows = parseCSV(text);
      if (rawRows.length === 0) {
        throw new Error("The uploaded file contains no valid rows or readable item data.");
      }

      // Fetch fresh items catalog to ensure accurate matching and diffing
      let catalog = items;
      try {
        const iRes = await fetch("/api/restaurant/inventory/items");
        if (iRes.ok) {
          const iData = await iRes.json();
          if (iData.items) catalog = iData.items;
        }
      } catch {
        // Fallback to current items state
      }

      // Compute diff across all 8 fields for every row
      const processedRows = rawRows.map((row: any, idx: number) => {
        const rowSku = (row.sku || "").trim().toLowerCase();
        const rowName = (row.name || "").trim().toLowerCase();

        // Match existing item: by SKU first, then by Name
        let matched: Item | undefined = undefined;
        if (rowSku) {
          matched = catalog.find((i) => (i.sku || "").trim().toLowerCase() === rowSku);
        }
        if (!matched && rowName) {
          matched = catalog.find((i) => (i.name || "").trim().toLowerCase() === rowName);
        }

        const overrides: Array<{ field: string; label: string; oldValue: string; newValue: string }> = [];

        if (matched) {
          // 1. Name
          const cName = (matched.name || "").trim();
          const nName = (row.name || "").trim();
          if (nName && nName !== cName) {
            overrides.push({ field: "name", label: "Item Name", oldValue: cName || "—", newValue: nName });
          }

          // 2. SKU
          const cSku = (matched.sku || "").trim();
          const nSku = (row.sku || "").trim();
          if (nSku && nSku !== cSku) {
            overrides.push({ field: "sku", label: "SKU Code", oldValue: cSku || "—", newValue: nSku });
          }

          // 3. Category
          const cCat = (matched.category?.name || "").trim();
          const nCat = (row.category || "").trim();
          if (nCat && nCat.toLowerCase() !== cCat.toLowerCase()) {
            overrides.push({ field: "category", label: "Category", oldValue: cCat || "—", newValue: nCat });
          }

          // 4. Unit of Measure
          const cUom = (matched.unitOfMeasure || "PIECES").trim().toUpperCase();
          const nUom = (row.unitOfMeasure || "PIECES").trim().toUpperCase();
          if (nUom && nUom !== cUom) {
            overrides.push({ field: "unitOfMeasure", label: "Unit of Measure", oldValue: cUom || "—", newValue: nUom });
          }

          // 5. Cost per unit
          if (row.costPerUnit !== undefined && row.costPerUnit !== "") {
            const cCost = Number(matched.costPerUnit || 0);
            const nCost = Number(row.costPerUnit || 0);
            if (!isNaN(nCost) && Math.abs(nCost - cCost) > 0.001) {
              overrides.push({
                field: "costPerUnit",
                label: "Cost Per Unit",
                oldValue: `$${cCost.toFixed(2)}`,
                newValue: `$${nCost.toFixed(2)}`,
              });
            }
          }

          // 6. Reorder Point
          if (row.reorderPoint !== undefined && row.reorderPoint !== "") {
            const cReorder = Number(matched.reorderPoint || 0);
            const nReorder = Number(row.reorderPoint || 0);
            if (!isNaN(nReorder) && Math.abs(nReorder - cReorder) > 0.001) {
              overrides.push({
                field: "reorderPoint",
                label: "Reorder Point",
                oldValue: `${cReorder}`,
                newValue: `${nReorder}`,
              });
            }
          }

          // 7. Par Level
          if (row.parLevel !== undefined && row.parLevel !== "") {
            const cPar = Number(matched.parLevel || 0);
            const nPar = Number(row.parLevel || 0);
            if (!isNaN(nPar) && Math.abs(nPar - cPar) > 0.001) {
              overrides.push({
                field: "parLevel",
                label: "Par Level",
                oldValue: `${cPar}`,
                newValue: `${nPar}`,
              });
            }
          }

          // 8. Description
          const cDesc = (matched.description || "").trim();
          const nDesc = (row.description || "").trim();
          if (nDesc && nDesc !== cDesc) {
            overrides.push({ field: "description", label: "Description", oldValue: cDesc || "—", newValue: nDesc });
          }

          const isUpdate = overrides.length > 0;
          return {
            ...row,
            rowNumber: row.rowNumber || idx + 1,
            matchType: isUpdate ? "UPDATE" : "IDENTICAL",
            matchedItemId: matched.id,
            matchedItemName: matched.name,
            overrides,
            selected: isUpdate, // Default checked if there are overrides to apply
          };
        } else {
          return {
            ...row,
            rowNumber: row.rowNumber || idx + 1,
            matchType: "NEW",
            matchedItemId: undefined,
            matchedItemName: undefined,
            overrides: [],
            selected: true, // Default checked for new items
          };
        }
      });

      setParsedRows(processedRows);
      setPreviewFile({ name: file.name, size: file.size });
    } catch (err: any) {
      setError(err.message || "Failed to parse spreadsheet file.");
    } finally {
      e.target.value = "";
    }
  };

  // Row selection helpers
  const toggleSelectRow = (rowNumber: number) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, selected: !r.selected } : r))
    );
  };

  const setAllSelection = (selected: boolean, filterType?: "UPDATE" | "NEW") => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (filterType && r.matchType !== filterType) return r;
        return { ...r, selected };
      })
    );
  };

  // Step 2: Confirm & Execute Bulk Import API
  const handleConfirmImport = async () => {
    const selectedRows = parsedRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setError("Please select at least one item row to import or update.");
      return;
    }

    setImporting(true);
    setError("");

    try {
      const payload = {
        items: selectedRows.map((r) => ({
          rowNumber: r.rowNumber,
          name: r.name,
          sku: r.sku,
          category: r.category,
          unitOfMeasure: r.unitOfMeasure,
          costPerUnit: r.costPerUnit,
          reorderPoint: r.reorderPoint,
          parLevel: r.parLevel,
          description: r.description,
          action: r.matchType === "UPDATE" ? "UPDATE" : "CREATE",
          existingItemId: r.matchedItemId,
        })),
        updateExisting: true,
      };

      const res = await fetch("/api/restaurant/inventory/items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process bulk import");

      setImportReport(data.report);
      setPreviewFile(null);
      if (data.report.updated && data.report.updated.length > 0) {
        setReportTab("updated");
      } else if (data.report.added && data.report.added.length > 0) {
        setReportTab("added");
      } else if (data.report.failed && data.report.failed.length > 0) {
        setReportTab("failed");
      } else {
        setReportTab("skipped");
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to import items.");
    } finally {
      setImporting(false);
    }
  };

  const lowCount = items.filter((i) => i.isLowStock).length;
  const outCount = items.filter((i) => (i.currentStock ?? 0) <= 0).length;

  return (
    <ModuleAccessGuard moduleKey="inventory" moduleName="Inventory Item Master">
      <div className={`min-h-screen ${isDark ? "bg-[#090B10]" : "bg-slate-50/50"}`}>
        <RestaurantNavbar activeSection="Catalog & SKUs" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Executive Header Banner */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border transition relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 ${
              isDark
                ? "bg-gradient-to-br from-[#121829] via-[#0E1320] to-[#0A0D14] border-white/[0.08] shadow-xl shadow-black/20"
                : "bg-gradient-to-br from-blue-50/80 via-indigo-50/25 to-white border-blue-100/80 shadow-sm shadow-blue-500/5"
            }`}
          >
            {/* Ambient Glow Orbs */}
            <div className="absolute -right-16 -top-16 w-72 h-72 bg-blue-500/10 dark:bg-[#0071E3]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute right-1/3 -bottom-16 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

            {/* Left: Nav & Title */}
            <div className="relative z-10 space-y-2 sm:space-y-2.5 w-full md:w-auto min-w-0">
              <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                <button
                  onClick={() => router.push(`/restaurant/${subdomain}/inventory`)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                    isDark
                      ? "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                      : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs"
                  }`}
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Inventory</span>
                </button>
                <span className="hidden sm:inline text-slate-300 dark:text-white/20">•</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-[#0071E3] dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] animate-pulse" />
                  <span>Catalog &amp; SKUs</span>
                </span>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#0071E3] via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 border border-white/20">
                  <Package className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className={`text-base sm:text-xl font-extrabold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                    Inventory Item Master
                  </h1>
                  <p className={`text-[10px] sm:text-xs mt-0.5 truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {items.length} items total • {outCount > 0 ? <span className="text-rose-500 font-semibold">{outCount} out of stock</span> : lowCount > 0 ? <span className="text-amber-500 font-semibold">{lowCount} low stock</span> : "all inventory healthy"}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Actions & Status Capsule */}
            <div className="relative z-10 flex flex-wrap items-center gap-2.5 shrink-0">
              <div className={`hidden lg:flex p-2.5 px-3 rounded-xl border items-center gap-2.5 ${
                isDark
                  ? "bg-[#141A29]/80 border-white/[0.08] shadow-sm"
                  : "bg-white/90 backdrop-blur-xs border-slate-200/80 shadow-xs"
              }`}>
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Catalog Active
                    </span>
                  </div>
                  <span className={`text-[10px] font-medium block mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {items.length} Items • {categories.length} Categories
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setImportReport(null);
                    setPreviewFile(null);
                    setParsedRows([]);
                    setShowBulkModal(true);
                  }}
                  className={`px-3.5 py-1.5 sm:py-2 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
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
                  className="px-3.5 py-1.5 sm:py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
                >
                  + New Item
                </button>
              </div>
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

          {/* Items Display: Cards on Mobile, Table on Desktop */}
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
            <>
              {/* MOBILE CARDS VIEW (block md:hidden) */}
              <div className="block md:hidden space-y-3">
                {items.map((item) => {
                  const stock = Number(item.currentStock ?? 0);
                  const reorder = Number(item.reorderPoint ?? 0);
                  const isOutOfStock = stock <= 0;
                  const isLowStock = stock > 0 && stock <= reorder;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border shadow-2xs space-y-3 transition ${
                        isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
                      }`}
                    >
                      {/* Card Top: Title, SKU, Category, Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.sku && (
                              <span className="font-mono text-[11px] opacity-60">
                                SKU: {item.sku}
                              </span>
                            )}
                            {item.category && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-[#0071E3] dark:text-[#64B5FF] text-[10px] font-semibold whitespace-nowrap">
                                {item.category.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isOutOfStock ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-bold whitespace-nowrap">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold whitespace-nowrap">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold whitespace-nowrap">
                              In Stock
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Metrics Grid: UOM, Cost, Current Stock, Par Level */}
                      <div
                        className={`grid grid-cols-4 gap-2 p-2.5 rounded-xl border text-center ${
                          isDark ? "bg-[#090B10]/60 border-white/[0.04]" : "bg-slate-50/80 border-slate-100"
                        }`}
                      >
                        <div>
                          <div className="text-[10px] font-medium opacity-50 uppercase tracking-wider">UNIT</div>
                          <div className="font-mono text-xs font-semibold mt-0.5">
                            {formatUnit(item.unitOfMeasure as any)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-medium opacity-50 uppercase tracking-wider">Cost</div>
                          <div className="font-mono text-xs font-semibold mt-0.5">
                            ${Number(item.costPerUnit).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-medium opacity-50 uppercase tracking-wider">Stock</div>
                          <div className={`font-mono text-xs font-bold mt-0.5 ${isOutOfStock ? "text-rose-500" : isLowStock ? "text-amber-500" : ""}`}>
                            {stock}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-medium opacity-50 uppercase tracking-wider">Par</div>
                          <div className="font-mono text-xs font-semibold mt-0.5 opacity-70">
                            {item.parLevel}
                          </div>
                        </div>
                      </div>

                      {/* Card Action Button: Full Width Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className={`w-full py-2 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          isDark
                            ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.1] text-slate-200"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Edit Item</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW (hidden md:block) */}
              <div
                className={`hidden md:block rounded-3xl border overflow-hidden shadow-sm ${
                  isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
                }`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap ${isDark ? "border-white/[0.08] text-[#8F95A3]" : "border-slate-200 text-slate-500 bg-slate-50/50"}`}>
                        <th className="py-3.5 px-4">Item &amp; SKU</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Unit</th>
                        <th className="py-3.5 px-4 text-right">Cost Per Unit</th>
                        <th className="py-3.5 px-4 text-right">Current Stock</th>
                        <th className="py-3.5 px-4 text-right">Par Level</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] text-xs whitespace-nowrap">
                      {items.map((item) => {
                        const stock = Number(item.currentStock ?? 0);
                        const reorder = Number(item.reorderPoint ?? 0);
                        const isOutOfStock = stock <= 0;
                        const isLowStock = stock > 0 && stock <= reorder;

                        return (
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
                              <span className={isOutOfStock ? "text-rose-500" : isLowStock ? "text-amber-500" : ""}>
                                {stock}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono opacity-60">
                              {item.parLevel}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {isOutOfStock ? (
                                <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-bold">
                                  Out of Stock
                                </span>
                              ) : isLowStock ? (
                                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold">
                                  In Stock
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                                  isDark
                                    ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.1] text-slate-200"
                                    : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700 shadow-2xs"
                                }`}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>

        {/* EDIT ITEM MODAL / BOTTOM SHEET */}
        {editingItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border shadow-2xl space-y-4 max-h-[88vh] md:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200 ${
                isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {/* Mobile Drag Indicator */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-1 md:hidden" />

              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Edit Inventory Item</h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Update details or cost for {editingItem.name}.
                  </p>
                </div>
                <button
                  onClick={() => setEditingItem(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateItem} className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Boneless Chicken Breast"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
                      value={editForm.sku}
                      onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className={`block text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        Category
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickCategory((prev) => !prev);
                          setQuickCategoryError("");
                        }}
                        className="text-[11px] font-semibold text-[#0071E3] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        {showQuickCategory ? "✕ Cancel" : "+ New Category"}
                      </button>
                    </div>

                    {showQuickCategory ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Category name..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleQuickCreateCategory("edit");
                              }
                            }}
                            className={`flex-1 px-3 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                              isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                            }`}
                          />
                          <button
                            type="button"
                            disabled={creatingCategory || !newCategoryName.trim()}
                            onClick={() => handleQuickCreateCategory("edit")}
                            className="px-3 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {creatingCategory ? "Adding..." : "Add"}
                          </button>
                        </div>
                        {quickCategoryError && (
                          <p className="text-[10px] text-rose-500 font-medium">{quickCategoryError}</p>
                        )}
                      </div>
                    ) : (
                      <select
                        value={editForm.categoryId}
                        onChange={(e) => {
                          if (e.target.value === "__NEW__") {
                            setShowQuickCategory(true);
                            setQuickCategoryError("");
                          } else {
                            setEditForm({ ...editForm, categoryId: e.target.value });
                          }
                        }}
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
                        <option value="__NEW__" className="text-[#0071E3] font-semibold">
                          + Add new category...
                        </option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Unit
                    </label>
                    <select
                      value={editForm.unitOfMeasure}
                      onChange={(e) => setEditForm({ ...editForm, unitOfMeasure: e.target.value })}
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
                      value={editForm.costPerUnit}
                      onChange={(e) => setEditForm({ ...editForm, costPerUnit: e.target.value })}
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
                      value={editForm.reorderPoint}
                      onChange={(e) => setEditForm({ ...editForm, reorderPoint: e.target.value })}
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
                      value={editForm.parLevel}
                      onChange={(e) => setEditForm({ ...editForm, parLevel: e.target.value })}
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
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDeleteItem}
                    className="px-3.5 py-2 text-rose-500 hover:bg-rose-500/10 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    {deleting ? "Removing..." : "Remove Item"}
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingItem(null)}
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
                      {submitting ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* BULK IMPORT VIA EXCEL / CSV MODAL (Full Screen / Adaptive Modal) */}
        {showBulkModal && (
          <div className={`fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-150 ${
            isBulkFullScreen || previewFile || importReport ? "p-0 md:p-3 lg:p-4" : "p-0 md:p-4 items-end md:items-center"
          }`}>
            <div
              className={`w-full flex flex-col shadow-2xl animate-in duration-200 ${
                isBulkFullScreen || previewFile || importReport
                  ? "h-full md:h-[96vh] md:max-w-[98vw] rounded-none md:rounded-3xl border md:border p-4 sm:p-6 lg:p-7 overflow-hidden"
                  : "max-w-2xl p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border max-h-[88vh] md:max-h-[90vh] overflow-y-auto space-y-6"
              } ${
                isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {/* Mobile Drag Indicator (only for bottom sheet mode when not full screen) */}
              {!(isBulkFullScreen || previewFile || importReport) && (
                <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-1 md:hidden" />
              )}

              <div className="flex justify-between items-center shrink-0 mb-4 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                      {previewFile ? "Preview Data to Import" : importReport ? "Import Results Summary" : "Bulk Import Inventory Items"}
                    </h2>
                    {previewFile && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3] dark:text-[#58A6FF] border border-[#0071E3]/20">
                        {parsedRows.length} {parsedRows.length === 1 ? "Item" : "Items"} Detected
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {previewFile
                      ? `Review detected items from ${previewFile.name} before confirming import.`
                      : importReport
                      ? "Summary of added, skipped, and failed rows."
                      : "Upload your item catalog via Excel spreadsheet or CSV file."}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Fullscreen Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsBulkFullScreen((prev) => !prev)}
                    title={isBulkFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                      isDark
                        ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.1] text-slate-300 hover:text-white"
                        : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {isBulkFullScreen ? (
                      /* Compress / Exit Fullscreen icon */
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0h4m-4 0v4m6 6l5 5m0 0h-4m4 0v-4M9 15l-5 5m0 0h4m-4 0v-4m11-6l5-5m0 0h-4m4 0v4" />
                      </svg>
                    ) : (
                      /* Expand / Fullscreen icon */
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 0l-5-5" />
                      </svg>
                    )}
                  </button>

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkModal(false);
                      setPreviewFile(null);
                      setParsedRows([]);
                    }}
                    title="Close"
                    className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                      isDark
                        ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.1] text-slate-400 hover:text-white"
                        : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* STEP 1: FILE UPLOAD DROP BOX */}
              {!previewFile && !importReport && (
                <div className={`flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full space-y-5 ${isBulkFullScreen ? "py-8" : ""}`}>
                  <div
                    className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition flex flex-col items-center justify-center space-y-4 relative cursor-pointer ${
                      isDark
                        ? "border-white/10 hover:border-[#0071E3]/50 bg-[#090B10]/50"
                        : "border-slate-300 hover:border-[#0071E3] bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3]">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-semibold">Click or drag &amp; drop spreadsheet to upload</p>
                      <p className={`text-xs mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Supports .CSV, .XLSX, .XLS files (up to 1,000 rows)
                      </p>
                    </div>
                  </div>

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
              )}

              {/* STEP 2: PREVIEW DATA TABLE, OVERRIDES & CONFIRMATION */}
              {previewFile && !importReport && (() => {
                const totalRows = parsedRows.length;
                const updateRows = parsedRows.filter((r) => r.matchType === "UPDATE");
                const newRows = parsedRows.filter((r) => r.matchType === "NEW");
                const identicalRows = parsedRows.filter((r) => r.matchType === "IDENTICAL");

                const filteredRows = parsedRows.filter((r) => {
                  if (previewFilterTab === "update") return r.matchType === "UPDATE";
                  if (previewFilterTab === "new") return r.matchType === "NEW";
                  if (previewFilterTab === "identical") return r.matchType === "IDENTICAL";
                  return true;
                });

                const selectedCount = parsedRows.filter((r) => r.selected).length;
                const selectedUpdates = updateRows.filter((r) => r.selected).length;
                const selectedNew = newRows.filter((r) => r.selected).length;
                const isAllFilteredSelected = filteredRows.length > 0 && filteredRows.every((r) => r.selected);

                return (
                  <div className="flex-1 min-h-0 flex flex-col space-y-3 sm:space-y-4">
                    {/* File Info & Intelligence Summary Banner */}
                    <div className={`p-3 sm:p-4 rounded-2xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 shrink-0 ${isDark ? "bg-[#090B10] border-white/[0.08]" : "bg-blue-50/60 border-blue-100"}`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3] shrink-0">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs sm:text-sm font-bold truncate text-slate-900 dark:text-white">{previewFile.name}</h3>
                            <span className="text-[11px] font-mono opacity-50 shrink-0">({(previewFile.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <p className={`text-[11px] sm:text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            Analyzed <span className="font-semibold text-slate-900 dark:text-white">{totalRows} items</span>: detected{" "}
                            <span className="font-bold text-amber-500">{updateRows.length} with field updates</span>,{" "}
                            <span className="font-bold text-emerald-500">{newRows.length} new items</span>, and{" "}
                            <span className="opacity-60">{identicalRows.length} already up-to-date</span>.
                          </p>
                        </div>
                      </div>

                      {/* Quick Select & Filter Buttons */}
                      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
                        {updateRows.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAllSelection(true, "UPDATE")}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                          >
                            ✓ Select All Overrides ({updateRows.length})
                          </button>
                        )}
                        {newRows.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAllSelection(true, "NEW")}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer"
                          >
                            + Select All New ({newRows.length})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewFile(null);
                            setParsedRows([]);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                            isDark ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-300" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          Re-select File
                        </button>
                      </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto shrink-0 pb-1">
                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab("all")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                          previewFilterTab === "all"
                            ? "bg-[#0071E3] text-white shadow-xs"
                            : isDark ? "bg-white/[0.04] text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        All Items ({totalRows})
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab("update")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          previewFilterTab === "update"
                            ? "bg-amber-500 text-white shadow-xs"
                            : isDark ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        <span>⚡ Overrides / Updates</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                          {updateRows.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab("new")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          previewFilterTab === "new"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : isDark ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        <span>+ New Items</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                          {newRows.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewFilterTab("identical")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          previewFilterTab === "identical"
                            ? "bg-slate-600 text-white shadow-xs"
                            : isDark ? "bg-white/[0.04] text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <span>✓ Identical (No changes)</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                          {identicalRows.length}
                        </span>
                      </button>
                    </div>

                    {/* MOBILE PREVIEW CARDS (block sm:hidden) */}
                    <div className="block sm:hidden space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
                      {filteredRows.map((row) => {
                        const isExpanded = expandedDiffRowIdx === row.rowNumber;
                        const overridesMap = new Map<string, any>((row.overrides || []).map((o: any) => [o.field, o]));

                        return (
                          <div
                            key={row.rowNumber}
                            className={`p-3 rounded-xl border space-y-2 text-xs ${
                              row.selected
                                ? isDark ? "bg-[#090B10] border-[#0071E3]/40" : "bg-blue-50/40 border-blue-200"
                                : isDark ? "bg-[#090B10] border-white/[0.06] opacity-60" : "bg-slate-50/70 border-slate-200 opacity-60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={row.selected}
                                  onChange={() => toggleSelectRow(row.rowNumber)}
                                  className="mt-0.5 rounded cursor-pointer accent-[#0071E3]"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-slate-900 dark:text-white truncate">
                                    <span className="opacity-50 font-mono text-[10px] mr-1.5">#{row.rowNumber}</span>
                                    {row.name || <span className="text-rose-500 font-normal">Missing Name</span>}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {row.sku && (
                                      <span className="font-mono text-[10px] opacity-60">
                                        SKU: {row.sku}
                                      </span>
                                    )}
                                    {row.category && (
                                      <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-[#0071E3] dark:text-[#64B5FF] text-[10px] font-semibold">
                                        {row.category}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {row.matchType === "UPDATE" && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedDiffRowIdx(isExpanded ? null : row.rowNumber)}
                                  className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 shrink-0 cursor-pointer"
                                >
                                  ⚡ {row.overrides.length} Diff{row.overrides.length === 1 ? "" : "s"}
                                </button>
                              )}
                              {row.matchType === "NEW" && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0">
                                  + New
                                </span>
                              )}
                              {row.matchType === "IDENTICAL" && (
                                <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-500 text-[10px] font-medium border border-slate-500/20 shrink-0">
                                  ✓ Same
                                </span>
                              )}
                            </div>

                            {/* Collapsible Diff Drawer for Mobile */}
                            {isExpanded && row.overrides && row.overrides.length > 0 && (
                              <div className={`p-2 rounded-lg border space-y-1.5 ${isDark ? "bg-[#151B2B] border-amber-500/30" : "bg-amber-50/50 border-amber-200"}`}>
                                <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                  Target: {row.matchedItemName}
                                </div>
                                <div className="space-y-1">
                                  {row.overrides.map((ov: any, oIdx: number) => (
                                    <div key={oIdx} className="text-[11px] flex items-center justify-between gap-2 border-b border-black/[0.04] dark:border-white/[0.04] pb-1">
                                      <span className="opacity-70">{ov.label}:</span>
                                      <div className="flex items-center gap-1.5 text-right font-mono">
                                        <del className="line-through text-rose-500 opacity-60 text-[10px]">{ov.oldValue}</del>
                                        <span className="opacity-40">→</span>
                                        <ins className="text-emerald-500 font-bold no-underline">{ov.newValue}</ins>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div
                              className={`grid grid-cols-4 gap-1.5 p-2 rounded-lg border text-center ${
                                isDark ? "bg-[#121622] border-white/[0.04]" : "bg-white border-slate-200"
                              }`}
                            >
                              <div>
                                <div className="text-[9px] font-medium opacity-50 uppercase">Unit</div>
                                <div className="font-mono text-[11px] font-semibold mt-0.5 truncate">
                                  {row.unitOfMeasure || "PIECES"}
                                </div>
                              </div>
                              <div>
                                <div className="text-[9px] font-medium opacity-50 uppercase">Cost</div>
                                <div className="font-mono text-[11px] font-semibold mt-0.5">
                                  ${Number(row.costPerUnit || 0).toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[9px] font-medium opacity-50 uppercase">Par</div>
                                <div className="font-mono text-[11px] font-semibold mt-0.5 opacity-70">
                                  {row.parLevel || 0}
                                </div>
                              </div>
                              <div>
                                <div className="text-[9px] font-medium opacity-50 uppercase">Reorder</div>
                                <div className="font-mono text-[11px] font-semibold mt-0.5 opacity-70">
                                  {row.reorderPoint || "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* DESKTOP PREVIEW TABLE WITH BIDIRECTIONAL SCROLL */}
                    <div className={`hidden sm:block flex-1 min-h-0 rounded-2xl border overflow-x-auto overflow-y-auto text-xs ${isDark ? "bg-[#090B10] border-white/[0.08]" : "bg-white border-slate-200"}`}>
                      <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1050px]">
                        <thead className="sticky top-0 z-20">
                          <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? "bg-[#161B29] border-white/[0.08] text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"}`}>
                            <th className="py-3 px-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={isAllFilteredSelected}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  const rowNums = new Set(filteredRows.map((r) => r.rowNumber));
                                  setParsedRows((prev) =>
                                    prev.map((r) => (rowNums.has(r.rowNumber) ? { ...r, selected: val } : r))
                                  );
                                }}
                                className="rounded cursor-pointer accent-[#0071E3]"
                                title="Toggle All Visible"
                              />
                            </th>
                            <th className="py-3 px-3 w-12 text-center">#</th>
                            <th className="py-3 px-4 min-w-[160px]">Action / Status</th>
                            <th className="py-3 px-4 min-w-[200px]">Item Name</th>
                            <th className="py-3 px-4 min-w-[130px]">SKU Code</th>
                            <th className="py-3 px-4 min-w-[150px]">Category</th>
                            <th className="py-3 px-4 min-w-[110px]">Unit</th>
                            <th className="py-3 px-4 min-w-[120px] text-right">Cost Per Unit</th>
                            <th className="py-3 px-4 min-w-[110px] text-right">Par Level</th>
                            <th className="py-3 px-4 min-w-[120px] text-right">Reorder Pt</th>
                            <th className="py-3 px-4 min-w-[180px]">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                          {filteredRows.map((row) => {
                            const isExpanded = expandedDiffRowIdx === row.rowNumber;
                            const overridesMap = new Map<string, any>((row.overrides || []).map((o: any) => [o.field, o]));

                            return (
                              <React.Fragment key={row.rowNumber}>
                                <tr className={`transition-colors ${
                                  row.selected
                                    ? isDark ? "bg-white/[0.02]" : "bg-blue-50/20"
                                    : "opacity-60"
                                } ${isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"}`}>
                                  {/* Checkbox */}
                                  <td className="py-2.5 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={row.selected}
                                      onChange={() => toggleSelectRow(row.rowNumber)}
                                      className="rounded cursor-pointer accent-[#0071E3]"
                                    />
                                  </td>

                                  {/* Row # */}
                                  <td className="py-2.5 px-3 font-mono opacity-50 text-[11px] text-center">{row.rowNumber}</td>

                                  {/* Action / Match badge */}
                                  <td className="py-2.5 px-4">
                                    {row.matchType === "UPDATE" && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedDiffRowIdx(isExpanded ? null : row.rowNumber)}
                                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer flex items-center gap-1.5"
                                      >
                                        <span>⚡ Override ({row.overrides.length})</span>
                                        <span className="text-[9px] opacity-70">{isExpanded ? "▲" : "▼"}</span>
                                      </button>
                                    )}
                                    {row.matchType === "NEW" && (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                                        + New Item
                                      </span>
                                    )}
                                    {row.matchType === "IDENTICAL" && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-500 text-[10px] font-medium border border-slate-500/20">
                                        ✓ Identical
                                      </span>
                                    )}
                                  </td>

                                  {/* Item Name */}
                                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                                    {overridesMap.has("name") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("name")?.oldValue}</div>
                                        <div className="text-emerald-500 font-bold">{row.name}</div>
                                      </div>
                                    ) : (
                                      row.name || <span className="text-rose-500 font-normal">Missing Name</span>
                                    )}
                                  </td>

                                  {/* SKU Code */}
                                  <td className="py-2.5 px-4 font-mono text-[11px]">
                                    {overridesMap.has("sku") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("sku")?.oldValue}</div>
                                        <div className="text-emerald-500 font-bold">{row.sku}</div>
                                      </div>
                                    ) : (
                                      <span className="opacity-70">{row.sku || "—"}</span>
                                    )}
                                  </td>

                                  {/* Category */}
                                  <td className="py-2.5 px-4">
                                    {overridesMap.has("category") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("category")?.oldValue}</div>
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[11px] font-bold">
                                          {row.category}
                                        </span>
                                      </div>
                                    ) : row.category ? (
                                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-[#0071E3] dark:text-[#64B5FF] text-[11px] font-medium">
                                        {row.category}
                                      </span>
                                    ) : (
                                      <span className="opacity-40">—</span>
                                    )}
                                  </td>

                                  {/* Unit */}
                                  <td className="py-2.5 px-4 font-mono text-[11px]">
                                    {overridesMap.has("unitOfMeasure") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("unitOfMeasure")?.oldValue}</div>
                                        <div className="text-emerald-500 font-bold">{row.unitOfMeasure}</div>
                                      </div>
                                    ) : (
                                      <span>{row.unitOfMeasure || "PIECES"}</span>
                                    )}
                                  </td>

                                  {/* Cost */}
                                  <td className="py-2.5 px-4 text-right font-mono">
                                    {overridesMap.has("costPerUnit") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("costPerUnit")?.oldValue}</div>
                                        <div className="text-emerald-500 font-bold">${Number(row.costPerUnit || 0).toFixed(2)}</div>
                                      </div>
                                    ) : (
                                      <span className="font-semibold">${Number(row.costPerUnit || 0).toFixed(2)}</span>
                                    )}
                                  </td>

                                  {/* Par Level */}
                                  <td className="py-2.5 px-4 text-right font-mono">
                                    {overridesMap.has("parLevel") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("parLevel")?.oldValue}</div>
                                        <div className="text-emerald-500 font-bold">{row.parLevel}</div>
                                      </div>
                                    ) : (
                                      <span className="opacity-70">{row.parLevel || 0}</span>
                                    )}
                                  </td>

                                  {/* Reorder Point */}
                                  <td className="py-2.5 px-4 text-right font-mono">
                                    {overridesMap.has("reorderPoint") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px]">{overridesMap.get("reorderPoint")?.oldValue}</div>
                                        <div className="text-emerald-500 font-bold">{row.reorderPoint}</div>
                                      </div>
                                    ) : (
                                      <span className="opacity-70">{row.reorderPoint || "—"}</span>
                                    )}
                                  </td>

                                  {/* Description */}
                                  <td className="py-2.5 px-4 max-w-[200px] truncate">
                                    {overridesMap.has("description") ? (
                                      <div className="space-y-0.5">
                                        <div className="line-through text-rose-500 opacity-60 text-[10px] truncate">{overridesMap.get("description")?.oldValue}</div>
                                        <div className="text-emerald-500 font-bold truncate">{row.description}</div>
                                      </div>
                                    ) : (
                                      <span className="opacity-70 truncate">{row.description || "—"}</span>
                                    )}
                                  </td>
                                </tr>

                                {/* Collapsible Row-Level Diff Drawer */}
                                {isExpanded && row.overrides && row.overrides.length > 0 && (
                                  <tr className={isDark ? "bg-[#141A29]" : "bg-amber-50/40"}>
                                    <td colSpan={11} className="py-3 px-6 border-b border-black/[0.06] dark:border-white/[0.06]">
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                            <span>⚡ Overriding Existing Item:</span>
                                            <span className="underline font-semibold">{row.matchedItemName}</span>
                                            <span className="text-[10px] opacity-60 font-mono">({row.matchedItemId})</span>
                                          </div>
                                          <span className="text-[11px] opacity-60">
                                            {row.overrides.length} field{row.overrides.length === 1 ? "" : "s"} will be updated
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                          {row.overrides.map((ov: any, oIdx: number) => (
                                            <div
                                              key={oIdx}
                                              className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                                                isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-white border-amber-200"
                                              }`}
                                            >
                                              <span className="font-semibold opacity-70">{ov.label}:</span>
                                              <div className="flex items-center gap-2 font-mono">
                                                <del className="line-through text-rose-500 opacity-60 text-[10px]">{ov.oldValue}</del>
                                                <span className="opacity-40">→</span>
                                                <ins className="text-emerald-500 font-bold no-underline">{ov.newValue}</ins>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Actions (shrink-0) */}
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFile(null);
                          setParsedRows([]);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer text-center ${
                          isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Cancel
                      </button>

                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-wrap">
                        <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredRows.length}</span> of {totalRows} items &bull;{" "}
                          <span className="font-bold text-[#0071E3] dark:text-[#58A6FF]">{selectedCount}</span> selected
                        </span>

                        <button
                          type="button"
                          disabled={importing || selectedCount === 0}
                          onClick={handleConfirmImport}
                          className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {importing ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Importing...</span>
                            </>
                          ) : (
                            <span>Confirm &amp; Import ({selectedCount} Selected)</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* STEP 3: IMPORT REPORT RESULTS SUMMARY */}
              {importReport && (
                <div className="flex-1 min-h-0 flex flex-col space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setReportTab("updated")}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        reportTab === "updated"
                          ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/40"
                          : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-amber-500 flex items-center gap-1">
                        <span>⚡ Updated</span>
                      </div>
                      <div className="text-xl font-extrabold text-amber-500 mt-1">{importReport.updated?.length || 0}</div>
                      <div className="text-[10px] opacity-60">Overridden existing</div>
                    </button>

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
                        <span>+ Added</span>
                      </div>
                      <div className="text-xl font-extrabold text-emerald-500 mt-1">{importReport.added.length}</div>
                      <div className="text-[10px] opacity-60">Successfully created</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportTab("skipped")}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        reportTab === "skipped"
                          ? "bg-slate-500/10 border-slate-500/40 ring-1 ring-slate-500/40"
                          : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <span>Skipped</span>
                      </div>
                      <div className="text-xl font-extrabold text-slate-500 mt-1">{importReport.skipped.length}</div>
                      <div className="text-[10px] opacity-60">Identical / unselected</div>
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

                  <div className={`p-4 rounded-2xl border text-xs flex-1 min-h-0 overflow-y-auto ${isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                    {reportTab === "updated" && (
                      <div className="space-y-3">
                        <div className="font-semibold text-amber-500 mb-2">Updated Existing Items ({importReport.updated?.length || 0})</div>
                        {(!importReport.updated || importReport.updated.length === 0) ? (
                          <p className="opacity-50">No existing items were updated in this import run.</p>
                        ) : (
                          importReport.updated.map((item, idx) => (
                            <div key={idx} className="space-y-1.5 py-2.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <div className="flex justify-between font-medium">
                                <span className="font-bold">Row {item.row}: {item.name}</span>
                                {item.sku && <span className="font-mono text-[10px] opacity-60">SKU: {item.sku}</span>}
                              </div>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {item.overrides.map((ov, oIdx) => (
                                  <span
                                    key={oIdx}
                                    className="px-2 py-0.5 rounded-md text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-mono"
                                  >
                                    <span className="font-sans font-semibold opacity-75">{ov.label}:</span>{" "}
                                    <del className="line-through text-rose-500 opacity-60 text-[10px]">{ov.oldValue}</del> →{" "}
                                    <ins className="text-emerald-500 font-bold no-underline">{ov.newValue}</ins>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {reportTab === "added" && (
                      <div className="space-y-2">
                        <div className="font-semibold text-emerald-500 mb-2">Successfully Added Items ({importReport.added.length})</div>
                        {importReport.added.length === 0 ? (
                          <p className="opacity-50">No new items were added in this import run.</p>
                        ) : (
                          importReport.added.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <span className="font-medium">Row {item.row}: {item.name}</span>
                              {item.sku && <span className="font-mono text-[10px] opacity-60">SKU: {item.sku}</span>}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {reportTab === "skipped" && (
                      <div className="space-y-2">
                        <div className="font-semibold text-slate-500 mb-2">Skipped Records ({importReport.skipped.length})</div>
                        {importReport.skipped.length === 0 ? (
                          <p className="opacity-50">No items skipped.</p>
                        ) : (
                          importReport.skipped.map((item, idx) => (
                            <div key={idx} className="space-y-0.5 py-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <div className="flex justify-between font-medium">
                                <span>Row {item.row}: {item.name}</span>
                                {item.sku && <span className="font-mono text-[10px] opacity-60">SKU: {item.sku}</span>}
                              </div>
                              <p className="text-[11px] opacity-60">{item.reason}</p>
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
                            <div key={idx} className="space-y-0.5 py-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <div className="font-medium">Row {item.row}: {item.name}</div>
                              <p className="text-[11px] text-rose-400">{item.reason}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-black/[0.06] dark:border-white/[0.06] shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setImportReport(null);
                        setPreviewFile(null);
                        setParsedRows([]);
                      }}
                      className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      <span>Upload Another File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkModal(false);
                        setImportReport(null);
                        setPreviewFile(null);
                        setParsedRows([]);
                      }}
                      className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Done &amp; Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CREATE SINGLE ITEM MODAL / BOTTOM SHEET */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border shadow-2xl space-y-4 max-h-[88vh] md:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200 ${
                isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {/* Mobile Drag Indicator */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-1 md:hidden" />

              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Add New Inventory Item</h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Create a raw ingredient or stock SKU.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer p-1"
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
                    <div className="flex justify-between items-center mb-1.5">
                      <label className={`block text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        Category
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickCategory((prev) => !prev);
                          setQuickCategoryError("");
                        }}
                        className="text-[11px] font-semibold text-[#0071E3] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        {showQuickCategory ? "✕ Cancel" : "+ New Category"}
                      </button>
                    </div>

                    {showQuickCategory ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Category name..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleQuickCreateCategory("create");
                              }
                            }}
                            className={`flex-1 px-3 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                              isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                            }`}
                          />
                          <button
                            type="button"
                            disabled={creatingCategory || !newCategoryName.trim()}
                            onClick={() => handleQuickCreateCategory("create")}
                            className="px-3 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {creatingCategory ? "Adding..." : "Add"}
                          </button>
                        </div>
                        {quickCategoryError && (
                          <p className="text-[10px] text-rose-500 font-medium">{quickCategoryError}</p>
                        )}
                      </div>
                    ) : (
                      <select
                        value={form.categoryId}
                        onChange={(e) => {
                          if (e.target.value === "__NEW__") {
                            setShowQuickCategory(true);
                            setQuickCategoryError("");
                          } else {
                            setForm({ ...form, categoryId: e.target.value });
                          }
                        }}
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
                        <option value="__NEW__" className="text-[#0071E3] font-semibold">
                          + Add new category...
                        </option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Unit
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
