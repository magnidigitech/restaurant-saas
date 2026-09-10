"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import {
  ArrowLeft,
  FolderTree,
  Layers,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Package,
  ArrowRight,
  ExternalLink,
  CheckSquare,
  Square,
  AlertCircle,
  Sparkles,
  Upload,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  sortOrder: number;
  children?: Category[];
  _count?: { items: number };
}

interface InventoryItem {
  id: string;
  name: string;
  sku?: string | null;
  categoryId?: string | null;
  unitOfMeasure: string;
  costPerUnit: number;
  currentStock: number;
  reorderPoint?: number;
  parLevel?: number;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
}

// Simple & Robust CSV / Delimited Spreadsheet Parser for Categories
function parseCategoryCSV(text: string) {
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
      if (h === "categoryname" || h === "name" || h === "category" || h.includes("categoryname")) {
        rowObj.name = val;
      } else if (h === "parentcategory" || h === "parent" || h.includes("parent")) {
        rowObj.parentCategory = val;
      } else if (h.includes("desc") || h.includes("note") || h.includes("detail")) {
        rowObj.description = val;
      }
    });

    if (rowObj.name) {
      dataRows.push(rowObj);
    }
  }

  return dataRows;
}

export default function InventoryCategoriesPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Category creation & editing
  const [showCreate, setShowCreate] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmArchiveCategory, setConfirmArchiveCategory] = useState<Category | null>(null);

  const [form, setForm] = useState({ name: "", description: "", parentId: "" });
  const [editForm, setEditForm] = useState({ name: "", description: "", parentId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Accordion expanded categories state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Overflowing 3-dots action menu popover state
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Multi-select items per category for inline bulk move
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [inlineTargetCategory, setInlineTargetCategory] = useState<string>("");
  const [movingInline, setMovingInline] = useState(false);

  // Global Transfer / Move Items Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState<string>("");
  const [transferDestId, setTransferDestId] = useState<string>("");
  const [transferSelectedItems, setTransferSelectedItems] = useState<Set<string>>(new Set());
  const [transferring, setTransferring] = useState(false);

  // BULK IMPORT VIA EXCEL / CSV STATES
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isBulkFullScreen, setIsBulkFullScreen] = useState(true);
  const [previewFile, setPreviewFile] = useState<{ name: string; size: number } | null>(null);
  const [parsedCategoryRows, setParsedCategoryRows] = useState<any[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [categoryImportReport, setCategoryImportReport] = useState<{
    added: Array<{ row: number; name: string; parentCategory?: string }>;
    skipped: Array<{ row: number; name: string; reason: string }>;
    failed: Array<{ row: number; name: string; reason: string }>;
  } | null>(null);
  const [categoryReportTab, setCategoryReportTab] = useState<"added" | "skipped" | "failed">("added");

  // Fetch categories and items
  const fetchData = async () => {
    try {
      const [catRes, itemRes] = await Promise.all([
        fetch("/api/restaurant/inventory/categories"),
        fetch("/api/restaurant/inventory/items"),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        setItems(itemData.items || []);
      }
    } catch {
      setError("Failed to load category data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Flash message helper
  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  // Toggle Category Accordion Expansion
  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // Create Category
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Category name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          parentId: form.parentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create category");
      setShowCreate(false);
      setForm({ name: "", description: "", parentId: "" });
      flashSuccess(`Category "${form.name}" created successfully`);
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to create category");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setEditForm({
      name: cat.name,
      description: cat.description || "",
      parentId: cat.parentId || "",
    });
  };

  // Update Category
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editForm.name.trim()) {
      setError("Category name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/inventory/categories/${editingCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || undefined,
          parentId: editForm.parentId ? editForm.parentId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update category");
      setEditingCategory(null);
      flashSuccess(`Category "${editForm.name}" updated successfully`);
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to update category");
    } finally {
      setSubmitting(false);
    }
  };

  // Archive / Delete Category
  const handleArchive = async () => {
    if (!confirmArchiveCategory) return;
    setArchiving(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/inventory/categories/${confirmArchiveCategory.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to archive category");
      }
      flashSuccess(`Category "${confirmArchiveCategory.name}" archived`);
      setConfirmArchiveCategory(null);
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to archive category");
    } finally {
      setArchiving(false);
    }
  };

  // Move items API handler
  const executeMoveItems = async (itemIds: string[], targetCategoryId: string | null) => {
    setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/categories/move-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds,
          targetCategoryId: targetCategoryId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to move items");
      return true;
    } catch (e: any) {
      setError(e.message || "Failed to move items");
      return false;
    }
  };

  // Inline single item quick move
  const handleSingleItemMove = async (itemId: string, newCategoryId: string) => {
    const success = await executeMoveItems([itemId], newCategoryId ? newCategoryId : null);
    if (success) {
      flashSuccess("Item moved to new category successfully");
      await fetchData();
    }
  };

  // Inline bulk move of selected items
  const handleInlineBulkMove = async () => {
    if (selectedItemIds.size === 0 || !inlineTargetCategory) return;
    setMovingInline(true);
    const success = await executeMoveItems(
      Array.from(selectedItemIds),
      inlineTargetCategory === "unassigned" ? null : inlineTargetCategory
    );
    if (success) {
      flashSuccess(`Moved ${selectedItemIds.size} item(s) to selected category`);
      setSelectedItemIds(new Set());
      setInlineTargetCategory("");
      await fetchData();
    }
    setMovingInline(false);
  };

  // Open Global Transfer Modal
  const openTransferModal = (defaultSourceCatId?: string, defaultDestCatId?: string) => {
    const src = defaultSourceCatId || (categories[0]?.id ?? "");
    setTransferSourceId(src);
    const dest = defaultDestCatId || (categories.find((c) => c.id !== src)?.id ?? "");
    setTransferDestId(dest);

    const itemsInSource = src === "unassigned"
      ? unassignedItems
      : items.filter((i) => i.categoryId === src);
    setTransferSelectedItems(new Set(itemsInSource.map((i) => i.id)));
    setShowTransferModal(true);
  };

  // Handle Transfer Submit
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferSelectedItems.size === 0) {
      setError("Please select at least one item to transfer");
      return;
    }
    if (transferSourceId === transferDestId) {
      setError("Source and destination categories must be different");
      return;
    }

    setTransferring(true);
    const success = await executeMoveItems(
      Array.from(transferSelectedItems),
      transferDestId === "unassigned" ? null : transferDestId
    );

    if (success) {
      const destName = categories.find((c) => c.id === transferDestId)?.name || "Unassigned";
      flashSuccess(`Successfully transferred ${transferSelectedItems.size} item(s) to ${destName}`);
      setShowTransferModal(false);
      setTransferSelectedItems(new Set());
      await fetchData();
    }
    setTransferring(false);
  };

  // Handle Category Template Download
  const handleDownloadCategoryTemplate = () => {
    const csvContent =
      "Category Name,Parent Category,Description\r\n" +
      "Dairy & Eggs,,Fresh dairy products, milk, cheeses, butter and yogurts\r\n" +
      "Cheeses,Dairy & Eggs,Artisanal and commercial cheeses\r\n" +
      "Meat & Poultry,,Fresh beef, poultry and pork cuts\r\n" +
      "Grains & Dry Goods,,Flour, rice, pasta, grains and dried goods\r\n" +
      "Packaging & Supplies,,Takeout containers, bags, cups and cutlery\r\n" +
      "Pantry & Condiments,,Oils, sauces, spices and bulk seasonings\r\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_categories_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle Category File Select & Local Parsing
  const handleCategoryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setCategoryImportReport(null);

    try {
      const text = await file.text();
      const rows = parseCategoryCSV(text);
      if (rows.length === 0) {
        throw new Error("The uploaded file contains no readable category rows.");
      }

      setParsedCategoryRows(rows);
      setPreviewFile({ name: file.name, size: file.size });
    } catch (err: any) {
      setError(err.message || "Failed to parse category spreadsheet.");
    } finally {
      e.target.value = "";
    }
  };

  // Confirm Category Bulk Import
  const handleConfirmCategoryImport = async () => {
    if (!parsedCategoryRows || parsedCategoryRows.length === 0) return;

    setBulkImporting(true);
    setError("");

    try {
      const res = await fetch("/api/restaurant/inventory/categories/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: parsedCategoryRows }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process bulk import");

      setCategoryImportReport(data.report);
      setPreviewFile(null);
      if (data.report.added.length > 0) {
        setCategoryReportTab("added");
      } else if (data.report.failed.length > 0) {
        setCategoryReportTab("failed");
      } else {
        setCategoryReportTab("skipped");
      }
      flashSuccess(`Import complete! Created ${data.report.added.length} categories.`);
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to import categories.");
    } finally {
      setBulkImporting(false);
    }
  };

  // Get all flattened categories for parent selection & destination dropdowns
  const getAllCategoriesFlat = (cats: Category[]): Category[] => {
    let result: Category[] = [];
    cats.forEach((c) => {
      result.push(c);
      if (c.children && c.children.length > 0) {
        result = result.concat(getAllCategoriesFlat(c.children));
      }
    });
    return result;
  };

  const flatCategories = getAllCategoriesFlat(categories);
  const rootCategories = categories.filter((c) => !c.parentId);

  // Group items by categoryId
  const getItemsForCategory = (catId: string) => {
    return items.filter((item) => item.categoryId === catId);
  };

  // Unassigned items (items with no categoryId)
  const unassignedItems = items.filter((item) => !item.categoryId);

  // Category Row Component (Recursive with expandable items drawer & overflowing action card)
  const CategoryRow = ({ cat, depth = 0 }: { cat: Category; depth?: number }) => {
    const categoryItems = getItemsForCategory(cat.id);
    const itemCount = categoryItems.length || (cat._count?.items ?? 0);
    const childrenList = cat.children || [];
    const isExpanded = expandedCategories.has(cat.id);

    // Items in this category that are checked
    const categoryCheckedItemIds = categoryItems
      .map((i) => i.id)
      .filter((id) => selectedItemIds.has(id));
    const isAllChecked =
      categoryItems.length > 0 && categoryCheckedItemIds.length === categoryItems.length;

    const toggleSelectAllCategory = () => {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        if (isAllChecked) {
          categoryItems.forEach((i) => next.delete(i.id));
        } else {
          categoryItems.forEach((i) => next.add(i.id));
        }
        return next;
      });
    };

    const toggleSelectItem = (id: string) => {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    return (
      <div className="space-y-2">
        {/* Category Header Card */}
        <div
          className={`rounded-2xl border transition-all ${
            depth > 0 ? "ml-3 sm:ml-6" : ""
          } ${
            isDark
              ? "bg-[#121622]/80 border-white/[0.08] hover:border-white/[0.14]"
              : "bg-white border-slate-200/90 shadow-xs hover:border-slate-300"
          } ${isExpanded ? (isDark ? "ring-1 ring-[#0071E3]/40" : "ring-1 ring-blue-500/30") : ""}`}
        >
          <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
            {/* Left: Expand toggle, Dot, Category Name */}
            <div
              onClick={() => toggleCategory(cat.id)}
              className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 cursor-pointer select-none"
            >
              <button
                type="button"
                className={`p-1 rounded-lg transition shrink-0 ${
                  isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[#0071E3]" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              <div
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                  depth === 0 ? "bg-[#0071E3]" : "bg-purple-500"
                }`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`font-bold text-sm sm:text-base tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {cat.name}
                  </h3>
                  {childrenList.length > 0 && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                      {childrenList.length} sub
                    </span>
                  )}
                </div>
                {cat.description && (
                  <p className={`text-[11px] mt-0.5 line-clamp-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {cat.description}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Items Count Badge & 3-Dots Action Popover */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Items Count Badge */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                title="Click to view assigned items"
                className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                  isExpanded
                    ? isDark
                      ? "bg-[#0071E3]/20 text-[#64B5FF] border-[#0071E3]/40 ring-1 ring-[#0071E3]/30"
                      : "bg-blue-100 text-[#0071E3] border-blue-300"
                    : isDark
                    ? "bg-white/[0.04] text-[#58A6FF] border-white/[0.08] hover:bg-white/[0.08]"
                    : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100/70"
                }`}
              >
                <Package className="w-3 h-3" />
                <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
              </button>

              {/* OVERFLOWING ACTION MENU (3-dots icon) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenActionMenuId(openActionMenuId === cat.id ? null : cat.id);
                  }}
                  className={`p-1.5 sm:p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                    openActionMenuId === cat.id
                      ? isDark
                        ? "bg-[#0071E3]/20 border-[#0071E3]/50 text-white shadow-sm"
                        : "bg-blue-100 border-blue-300 text-[#0071E3] shadow-sm"
                      : isDark
                      ? "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.08]"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  title="Category actions"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>

                {/* Floating Overflowing Action Card */}
                {openActionMenuId === cat.id && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenActionMenuId(null);
                      }}
                    />
                    <div
                      className={`absolute right-0 top-full mt-2 w-56 rounded-2xl border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                        isDark
                          ? "bg-[#141A29] border-white/[0.12] text-white shadow-black/60"
                          : "bg-white border-slate-200 text-slate-900 shadow-slate-300/60"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-3 py-2 border-b border-black/[0.04] dark:border-white/[0.06] mb-1">
                        <p className="text-xs font-bold truncate">{cat.name}</p>
                        <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {itemCount} assigned items
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          openTransferModal(cat.id);
                        }}
                        className={`w-full px-3 py-2 text-xs rounded-xl flex items-center gap-2.5 transition cursor-pointer ${
                          isDark ? "hover:bg-white/[0.06] text-slate-200" : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <ArrowRight className="w-4 h-4 text-[#0071E3] shrink-0" />
                        <div className="text-left">
                          <div className="font-semibold">Move Items</div>
                          <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Transfer to another category
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          openEditModal(cat);
                        }}
                        className={`w-full px-3 py-2 text-xs rounded-xl flex items-center gap-2.5 transition cursor-pointer ${
                          isDark ? "hover:bg-white/[0.06] text-slate-200" : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <Edit2 className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="text-left">
                          <div className="font-semibold">Edit Category</div>
                          <div className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Change name, parent, notes
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setConfirmArchiveCategory(cat);
                        }}
                        className={`w-full px-3 py-2 text-xs rounded-xl flex items-center gap-2.5 transition cursor-pointer ${
                          isDark ? "hover:bg-rose-500/10 text-rose-400" : "hover:bg-rose-50 text-rose-600"
                        }`}
                      >
                        <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                        <div className="text-left">
                          <div className="font-semibold">Archive Category</div>
                          <div className={`text-[10px] ${isDark ? "text-rose-400/70" : "text-rose-500/80"}`}>
                            Remove from catalog tree
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* EXPANDABLE ITEMS LIST / DRAWER */}
          {isExpanded && (
            <div className={`border-t p-4 sm:p-5 space-y-4 animate-in slide-in-from-top-2 duration-150 ${
              isDark ? "bg-[#090B10]/70 border-white/[0.06]" : "bg-slate-50/70 border-slate-200/80"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#0071E3]" />
                  <span className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Assigned Items ({categoryItems.length})
                  </span>
                  <span className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    &bull; Items classified under {cat.name}
                  </span>
                </div>

                {/* Bulk Move Action Bar when items are selected */}
                {categoryCheckedItemIds.length > 0 && (
                  <div className={`p-2 px-3 rounded-xl border flex items-center gap-2.5 flex-wrap ${
                    isDark ? "bg-[#141A29] border-blue-500/30" : "bg-blue-50 border-blue-200"
                  }`}>
                    <span className="text-xs font-bold text-[#0071E3] dark:text-[#64B5FF]">
                      {categoryCheckedItemIds.length} selected
                    </span>

                    <span className="text-slate-400">→</span>

                    <select
                      value={inlineTargetCategory}
                      onChange={(e) => setInlineTargetCategory(e.target.value)}
                      className={`text-xs px-2.5 py-1 rounded-lg border focus:outline-none ${
                        isDark ? "bg-[#0A0C12] border-white/20 text-white" : "bg-white border-slate-300 text-slate-800"
                      }`}
                    >
                      <option value="">Choose Target Category...</option>
                      {flatCategories
                        .filter((c) => c.id !== cat.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      <option value="unassigned">Unassigned (Remove Category)</option>
                    </select>

                    <button
                      type="button"
                      disabled={!inlineTargetCategory || movingInline}
                      onClick={handleInlineBulkMove}
                      className="px-3 py-1 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      {movingInline ? "Moving..." : "Move Items"}
                    </button>
                  </div>
                )}
              </div>

              {/* Items Table / List */}
              {categoryItems.length === 0 ? (
                <div className={`p-8 text-center rounded-xl border border-dashed text-xs space-y-2 ${
                  isDark ? "border-white/10 text-slate-400 bg-white/[0.02]" : "border-slate-300 text-slate-500 bg-white"
                }`}>
                  <p className="font-semibold">No items currently assigned to this category.</p>
                  <p className="text-[11px] opacity-75">
                    You can easily transfer items here from other categories or create new items.
                  </p>
                  <button
                    type="button"
                    onClick={() => openTransferModal(undefined, cat.id)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    <span>Transfer Items to {cat.name}</span>
                  </button>
                </div>
              ) : (
                <div className={`rounded-xl border overflow-hidden ${
                  isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
                }`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                      <thead>
                        <tr className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                          isDark ? "bg-[#161B29] border-white/[0.08] text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
                        }`}>
                          <th className="py-2.5 px-3 w-8 text-center">
                            <button
                              type="button"
                              onClick={toggleSelectAllCategory}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                              {isAllChecked ? (
                                <CheckSquare className="w-4 h-4 text-[#0071E3]" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </th>
                          <th className="py-2.5 px-3">Item Name</th>
                          <th className="py-2.5 px-3">SKU</th>
                          <th className="py-2.5 px-3">Unit</th>
                          <th className="py-2.5 px-3 text-right">Cost</th>
                          <th className="py-2.5 px-3 text-right">Stock</th>
                          <th className="py-2.5 px-3 text-right">Move to Category</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                        {categoryItems.map((item) => {
                          const isChecked = selectedItemIds.has(item.id);
                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${
                                isChecked
                                  ? isDark ? "bg-blue-500/10" : "bg-blue-50/70"
                                  : isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleSelectItem(item.id)}
                                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                >
                                  {isChecked ? (
                                    <CheckSquare className="w-4 h-4 text-[#0071E3]" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 font-semibold">
                                <button
                                  type="button"
                                  onClick={() => router.push(`/restaurant/${subdomain}/inventory/items/${item.id}`)}
                                  className="hover:underline flex items-center gap-1.5 text-slate-900 dark:text-white group text-left cursor-pointer"
                                >
                                  <span>{item.name}</span>
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                                </button>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] opacity-70">
                                {item.sku || "—"}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px]">
                                {item.unitOfMeasure}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-medium">
                                ${Number(item.costPerUnit || 0).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                                  item.isOutOfStock
                                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                    : item.isLowStock
                                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                    : isDark ? "bg-white/5 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                                }`}>
                                  {item.currentStock} {item.unitOfMeasure}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <select
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleSingleItemMove(item.id, e.target.value);
                                      e.target.value = "";
                                    }
                                  }}
                                  className={`text-[11px] px-2 py-1 rounded-lg border transition cursor-pointer focus:outline-none ${
                                    isDark
                                      ? "bg-[#0A0C12] border-white/10 hover:border-white/25 text-slate-300"
                                      : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700"
                                  }`}
                                >
                                  <option value="" disabled>Move to...</option>
                                  {flatCategories
                                    .filter((c) => c.id !== cat.id)
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  <option value="unassigned">Unassigned</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recursive subcategories */}
        {childrenList.map((child) => (
          <CategoryRow key={child.id} cat={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Categories &amp; Items...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Categories" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive Header Banner */}
        <div
          className={`p-4 sm:p-5 rounded-2xl border transition relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 ${
            isDark
              ? "bg-gradient-to-br from-[#121829] via-[#0E1320] to-[#0A0D14] border-white/[0.08] shadow-xl shadow-black/20"
              : "bg-gradient-to-br from-blue-50/80 via-indigo-50/25 to-white border-blue-100/80 shadow-sm shadow-blue-500/5"
          }`}
        >
          {/* Ambient Glow Orbs */}
          <div className="absolute -right-16 -top-16 w-72 h-72 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-1/3 -bottom-16 w-60 h-60 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span>Catalog Structure</span>
              </span>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0 border border-white/20">
                <FolderTree className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className={`text-base sm:text-xl font-extrabold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                  Category Hierarchy
                </h1>
                <p className={`text-[10px] sm:text-xs mt-0.5 truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Hierarchical classification of ingredients, kitchen supplies, and bar products.
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
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Taxonomy Active
                  </span>
                </div>
                <span className={`text-[10px] font-medium block mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {categories.length} Tree Categories &bull; {items.length} Items
                </span>
              </div>
            </div>

            {/* Transfer Items Button */}
            <button
              onClick={() => openTransferModal()}
              className={`px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                isDark
                  ? "bg-white/[0.06] border-white/[0.1] hover:bg-white/[0.12] text-white"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800 shadow-2xs"
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>Transfer Items</span>
            </button>

            {/* Bulk Import Categories via Excel/CSV Button */}
            <button
              onClick={() => {
                setShowBulkModal(true);
                setPreviewFile(null);
                setParsedCategoryRows([]);
                setCategoryImportReport(null);
              }}
              className={`px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                isDark
                  ? "bg-white/[0.06] border-white/[0.1] hover:bg-white/[0.12] text-white"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800 shadow-2xs"
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-emerald-500" />
              <span>Import via Excel</span>
            </button>

            {/* New Category Button */}
            <button
              onClick={() => setShowCreate(true)}
              className="px-3.5 py-1.5 sm:py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer whitespace-nowrap"
            >
              + New Category
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-xs rounded-2xl flex items-center gap-2 animate-in fade-in duration-200">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert Banner */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError("")} className="text-xs font-bold hover:underline cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Unassigned Items Banner (if any exist) */}
        {unassignedItems.length > 0 && (
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50/70 border-amber-200"
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  {unassignedItems.length} Uncategorized {unassignedItems.length === 1 ? "Item" : "Items"} Found
                </h4>
                <p className="text-[11px] text-amber-600/90 dark:text-amber-400/80">
                  These items are currently not assigned to any category. You can reassign them anytime.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openTransferModal("unassigned")}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl transition cursor-pointer shrink-0"
            >
              Assign Categories
            </button>
          </div>
        )}

        {/* Categories Tree */}
        <div
          className={`p-4 sm:p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Taxonomy Hierarchy &bull; Click to Expand Items
            </div>
            <div className="text-[11px] text-slate-400">
              {flatCategories.length} Total Categories
            </div>
          </div>

          {rootCategories.length === 0 ? (
            <div className={`p-12 text-center text-xs space-y-2 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              <FolderTree className="w-10 h-10 mx-auto opacity-30 text-[#0071E3]" />
              <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">No categories created yet</p>
              <p className="opacity-75">Click &quot;+ New Category&quot; or &quot;Import via Excel&quot; to build your inventory classification tree.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rootCategories.map((c) => (
                <CategoryRow key={c.id} cat={c} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* NEW CATEGORY MODAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border shadow-2xl space-y-4 max-h-[88vh] md:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200 ${
              isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-1 md:hidden" />

            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Create Inventory Category</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Add a top-level classification or nested subcategory.
                </p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dairy / Dry Goods / Beverages"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Parent Category (Optional)
                </label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="">Top Level (Root Category)</option>
                  {flatCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or details about this category..."
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
                  {submitting ? "Creating..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CATEGORY MODAL */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border shadow-2xl space-y-4 max-h-[88vh] md:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200 ${
              isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-1 md:hidden" />

            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Edit Inventory Category</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Update classification name, parent category, or description.
                </p>
              </div>
              <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Parent Category
                </label>
                <select
                  value={editForm.parentId}
                  onChange={(e) => setEditForm({ ...editForm, parentId: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="">Top Level (Root Category)</option>
                  {flatCategories
                    .filter((c) => c.id !== editingCategory.id) // Avoid self-parenting
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
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
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER / MOVE ITEMS BETWEEN CATEGORIES MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-xl p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200 ${
              isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-1 md:hidden" />

            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">Transfer Items Between Categories</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Reassign inventory items from one category to another in bulk.
                </p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Source Category */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Source Category *
                  </label>
                  <select
                    value={transferSourceId}
                    onChange={(e) => {
                      const newSrc = e.target.value;
                      setTransferSourceId(newSrc);
                      const itemsInSrc = newSrc === "unassigned"
                        ? unassignedItems
                        : items.filter((i) => i.categoryId === newSrc);
                      setTransferSelectedItems(new Set(itemsInSrc.map((i) => i.id)));
                    }}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    {flatCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({getItemsForCategory(c.id).length} items)
                      </option>
                    ))}
                    {unassignedItems.length > 0 && (
                      <option value="unassigned">
                        Unassigned Items ({unassignedItems.length} items)
                      </option>
                    )}
                  </select>
                </div>

                {/* Destination Category */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Destination Category *
                  </label>
                  <select
                    value={transferDestId}
                    onChange={(e) => setTransferDestId(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="" disabled>Select destination category...</option>
                    {flatCategories
                      .filter((c) => c.id !== transferSourceId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    {transferSourceId !== "unassigned" && (
                      <option value="unassigned">Unassigned (Remove Category)</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Items in Source Category Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Select Items to Move ({transferSelectedItems.size} selected)
                  </label>

                  {/* Select All Toggle */}
                  {(() => {
                    const sourceItems = transferSourceId === "unassigned"
                      ? unassignedItems
                      : items.filter((i) => i.categoryId === transferSourceId);
                    const allSelected = sourceItems.length > 0 && sourceItems.every((i) => transferSelectedItems.has(i.id));

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (allSelected) {
                            setTransferSelectedItems(new Set());
                          } else {
                            setTransferSelectedItems(new Set(sourceItems.map((i) => i.id)));
                          }
                        }}
                        className="text-xs font-medium text-[#0071E3] hover:underline cursor-pointer"
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </button>
                    );
                  })()}
                </div>

                <div className={`p-2 rounded-2xl border max-h-56 overflow-y-auto space-y-1.5 ${
                  isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                }`}>
                  {(() => {
                    const sourceItems = transferSourceId === "unassigned"
                      ? unassignedItems
                      : items.filter((i) => i.categoryId === transferSourceId);

                    if (sourceItems.length === 0) {
                      return (
                        <div className="py-6 text-center text-xs opacity-50">
                          No items found in the selected source category.
                        </div>
                      );
                    }

                    return sourceItems.map((item) => {
                      const isChecked = transferSelectedItems.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setTransferSelectedItems((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs cursor-pointer transition select-none ${
                            isChecked
                              ? isDark ? "bg-blue-500/15 border-blue-500/40 text-white" : "bg-blue-50 border-blue-300 text-blue-900"
                              : isDark ? "bg-[#121622]/60 border-white/[0.04] text-slate-300 hover:bg-white/[0.04]" : "bg-white border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-[#0071E3] shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold truncate block">{item.name}</span>
                              {item.sku && <span className="font-mono text-[10px] opacity-60">SKU: {item.sku}</span>}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-medium text-[11px]">
                              {item.currentStock} {item.unitOfMeasure}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring || transferSelectedItems.size === 0 || !transferDestId}
                  className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {transferring ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Transferring...</span>
                    </>
                  ) : (
                    <span>Transfer ({transferSelectedItems.size}) Items</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK IMPORT CATEGORIES VIA EXCEL / CSV MODAL (Full Screen / Adaptive Modal) */}
      {showBulkModal && (
        <div className={`fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-150 ${
          isBulkFullScreen || previewFile || categoryImportReport ? "p-0 md:p-3 lg:p-4" : "p-0 md:p-4 items-end md:items-center"
        }`}>
          <div
            className={`w-full flex flex-col shadow-2xl animate-in duration-200 ${
              isBulkFullScreen || previewFile || categoryImportReport
                ? "h-full md:h-[96vh] md:max-w-[98vw] rounded-none md:rounded-3xl border md:border p-4 sm:p-6 lg:p-7 overflow-hidden"
                : "max-w-2xl p-6 sm:p-8 rounded-t-[32px] md:rounded-3xl border-t md:border max-h-[88vh] md:max-h-[90vh] overflow-y-auto space-y-6"
            } ${
              isDark ? "bg-[#121622] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-center shrink-0 mb-4 gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                    {previewFile
                      ? "Preview Categories to Import"
                      : categoryImportReport
                      ? "Category Import Summary"
                      : "Bulk Import Categories via Spreadsheet"}
                  </h2>
                  {previewFile && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3] dark:text-[#58A6FF] border border-[#0071E3]/20">
                      {parsedCategoryRows.length} {parsedCategoryRows.length === 1 ? "Category" : "Categories"} Detected
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {previewFile
                    ? `Review parsed categories from ${previewFile.name} before confirming import.`
                    : categoryImportReport
                    ? "Summary of added, skipped, and failed category rows."
                    : "Upload your classification hierarchy via Excel spreadsheet or CSV file."}
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0h4m-4 0v4m6 6l5 5m0 0h-4m4 0v-4M9 15l-5 5m0 0h4m-4 0v-4m11-6l5-5m0 0h-4m4 0v4" />
                    </svg>
                  ) : (
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
                    setParsedCategoryRows([]);
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
            {!previewFile && !categoryImportReport && (
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
                    onChange={handleCategoryFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3]">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-base font-semibold">Click or drag &amp; drop category spreadsheet to upload</p>
                    <p className={`text-xs mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Supports .CSV, .XLSX, .XLS files (Hierarchical categories &amp; descriptions)
                    </p>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                    isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-blue-50/50 border-blue-100"
                  }`}
                >
                  <div>
                    <p className="font-semibold">Need the standard category import format?</p>
                    <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Includes sample columns for Category Name, Parent Category, and Description.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadCategoryTemplate}
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

            {/* STEP 2: PREVIEW DATA TABLE & CONFIRMATION */}
            {previewFile && !categoryImportReport && (
              <div className="flex-1 min-h-0 flex flex-col space-y-3 sm:space-y-4">
                {/* File Info Banner */}
                <div className={`p-3 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 ${isDark ? "bg-[#090B10] border-white/[0.08]" : "bg-blue-50/60 border-blue-100"}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3] shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-bold truncate text-slate-900 dark:text-white">{previewFile.name}</h3>
                        <span className="text-[11px] font-mono opacity-50 shrink-0">({(previewFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <p className={`text-[11px] sm:text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Detected <span className="font-bold text-[#0071E3] dark:text-[#58A6FF]">{parsedCategoryRows.length} categories</span> ready for import.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFile(null);
                      setParsedCategoryRows([]);
                    }}
                    className={`w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer text-center shrink-0 ${
                      isDark ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-300" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    Re-select File
                  </button>
                </div>

                {/* DESKTOP/MOBILE PREVIEW TABLE */}
                <div className={`flex-1 min-h-0 rounded-2xl border overflow-x-auto overflow-y-auto text-xs ${isDark ? "bg-[#090B10] border-white/[0.08]" : "bg-white border-slate-200"}`}>
                  <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
                    <thead className="sticky top-0 z-20">
                      <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? "bg-[#161B29] border-white/[0.08] text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"}`}>
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4 min-w-[220px]">Category Name</th>
                        <th className="py-3 px-4 min-w-[200px]">Parent Category</th>
                        <th className="py-3 px-4 min-w-[280px]">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {parsedCategoryRows.map((row, idx) => (
                        <tr key={idx} className={`transition-colors ${isDark ? "hover:bg-white/[0.03]" : "hover:bg-slate-50"}`}>
                          <td className="py-2.5 px-4 font-mono opacity-50 text-[11px] text-center">{row.rowNumber || idx + 1}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                            {row.name || <span className="text-rose-500 font-normal">Missing Name</span>}
                          </td>
                          <td className="py-2.5 px-4">
                            {row.parentCategory ? (
                              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-medium">
                                {row.parentCategory}
                              </span>
                            ) : (
                              <span className="opacity-40 font-mono text-[11px]">Top Level (Root)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 opacity-80 truncate max-w-xs">
                            {row.description || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFile(null);
                      setParsedCategoryRows([]);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer text-center ${
                      isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Showing all <span className="font-semibold text-slate-900 dark:text-white">{parsedCategoryRows.length}</span> categories
                    </span>
                    <button
                      type="button"
                      disabled={bulkImporting}
                      onClick={handleConfirmCategoryImport}
                      className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {bulkImporting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <span>Confirm &amp; Import ({parsedCategoryRows.length} Categories)</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: IMPORT REPORT RESULTS SUMMARY */}
            {categoryImportReport && (
              <div className="flex-1 min-h-0 flex flex-col space-y-4">
                <div className="grid grid-cols-3 gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCategoryReportTab("added")}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      categoryReportTab === "added"
                        ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/40"
                        : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                      <span>Added</span>
                    </div>
                    <div className="text-xl font-extrabold text-emerald-500 mt-1">{categoryImportReport.added.length}</div>
                    <div className="text-[10px] opacity-60">Successfully created</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategoryReportTab("skipped")}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      categoryReportTab === "skipped"
                        ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/40"
                        : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="text-xs font-bold text-amber-500 flex items-center gap-1">
                      <span>Skipped</span>
                    </div>
                    <div className="text-xl font-extrabold text-amber-500 mt-1">{categoryImportReport.skipped.length}</div>
                    <div className="text-[10px] opacity-60">Duplicates in catalog</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategoryReportTab("failed")}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      categoryReportTab === "failed"
                        ? "bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/40"
                        : isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="text-xs font-bold text-rose-500 flex items-center gap-1">
                      <span>Failed</span>
                    </div>
                    <div className="text-xl font-extrabold text-rose-500 mt-1">{categoryImportReport.failed.length}</div>
                    <div className="text-[10px] opacity-60">Validation errors</div>
                  </button>
                </div>

                <div className={`p-4 rounded-2xl border text-xs flex-1 min-h-0 overflow-y-auto ${isDark ? "bg-[#090B10] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
                  {categoryReportTab === "added" && (
                    <div className="space-y-2">
                      <div className="font-semibold text-emerald-500 mb-2">Successfully Created Categories ({categoryImportReport.added.length})</div>
                      {categoryImportReport.added.length === 0 ? (
                        <p className="opacity-50">No new categories were added.</p>
                      ) : (
                        categoryImportReport.added.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                            <span className="font-medium">Row {item.row}: {item.name}</span>
                            {item.parentCategory && (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 font-medium">
                                Parent: {item.parentCategory}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {categoryReportTab === "skipped" && (
                    <div className="space-y-2">
                      <div className="font-semibold text-amber-500 mb-2">Skipped Categories ({categoryImportReport.skipped.length})</div>
                      {categoryImportReport.skipped.length === 0 ? (
                        <p className="opacity-50">No duplicate categories skipped.</p>
                      ) : (
                        categoryImportReport.skipped.map((item, idx) => (
                          <div key={idx} className="space-y-0.5 py-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                            <div className="font-medium">Row {item.row}: {item.name}</div>
                            <p className="text-[11px] text-amber-500/80">{item.reason}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {categoryReportTab === "failed" && (
                    <div className="space-y-2">
                      <div className="font-semibold text-rose-500 mb-2">Failed Validation Rows ({categoryImportReport.failed.length})</div>
                      {categoryImportReport.failed.length === 0 ? (
                        <p className="opacity-50">No validation errors occurred!</p>
                      ) : (
                        categoryImportReport.failed.map((item, idx) => (
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
                      setCategoryImportReport(null);
                      setPreviewFile(null);
                      setParsedCategoryRows([]);
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
                      setCategoryImportReport(null);
                      setPreviewFile(null);
                      setParsedCategoryRows([]);
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

      {/* ARCHIVE CATEGORY MODAL */}
      {confirmArchiveCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <h2 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  Archive Category
                </h2>
                <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Are you sure you want to archive{" "}
                  <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {confirmArchiveCategory.name}
                  </span>
                  ? Items in this category will become unassigned and remain safe in your inventory.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                disabled={archiving}
                onClick={() => setConfirmArchiveCategory(null)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isDark
                    ? "bg-white/[0.04] text-[#8F95A3] hover:text-white hover:bg-white/[0.08]"
                    : "bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={archiving}
                onClick={handleArchive}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {archiving ? "Archiving..." : "Archive Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
