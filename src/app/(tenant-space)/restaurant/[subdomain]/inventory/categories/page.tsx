"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  sortOrder: number;
  children?: Category[];
  _count?: { items: number };
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [confirmArchiveCategory, setConfirmArchiveCategory] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", description: "", parentId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/restaurant/inventory/categories");
      if (res.ok) setCategories((await res.json()).categories || []);
    } catch {
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError("Category name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, description: form.description, parentId: form.parentId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreate(false);
      setForm({ name: "", description: "", parentId: "" });
      fetchCategories();
    } catch (e: any) {
      setError(e.message || "Failed to create category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!confirmArchiveCategory) return;
    setArchiving(true);
    try {
      await fetch(`/api/restaurant/inventory/categories/${confirmArchiveCategory.id}`, { method: "DELETE" });
      setConfirmArchiveCategory(null);
      fetchCategories();
    } catch {
      setError("Failed to archive category");
    } finally {
      setArchiving(false);
    }
  };

  const rootCategories = categories.filter((c) => !c.parentId);

  const CategoryRow = ({ cat, depth = 0 }: { cat: Category; depth?: number }) => {
    const itemCount = cat._count?.items ?? 0;
    const childrenList = cat.children || [];

    return (
      <div className="space-y-2">
        <div
          className={`flex items-center justify-between gap-3 p-4 rounded-2xl border transition ${
            depth > 0 ? "ml-6" : ""
          } ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
              : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${depth === 0 ? "bg-[#0071E3]" : "bg-slate-400"}`} />
            <div className="min-w-0 flex-1">
              <h3 className={`font-bold text-xs tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                {cat.name}
              </h3>
              {cat.description && (
                <p className={`text-[11px] truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {cat.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isDark ? "bg-white/[0.04] text-[#58A6FF] border-white/[0.08]" : "bg-blue-50 text-blue-800 border-blue-200"
            }`}>
              {itemCount} items
            </span>

            {childrenList.length > 0 && (
              <span className={`text-[11px] font-medium hidden sm:inline-block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                {childrenList.length} subcategories
              </span>
            )}

            <button
              onClick={() => setConfirmArchiveCategory(cat)}
              className={`p-1 rounded-lg text-xs transition cursor-pointer ${
                isDark ? "text-[#8F95A3] hover:text-rose-400 hover:bg-rose-500/10" : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              }`}
              title="Archive Category"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

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
        <p className="text-xs font-medium">Loading Categories...</p>
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
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
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
                Catalog Structure
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Category Hierarchy
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Hierarchical classification of ingredients, kitchen supplies, and bar products.
            </p>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
          >
            + New Category
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Categories Tree */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          {rootCategories.length === 0 ? (
            <div className={`p-12 text-center text-xs space-y-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              <p className="font-semibold text-sm">No categories created yet</p>
              <p className="opacity-75">Click &quot;+ New Category&quot; to build your inventory classification tree.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {rootCategories.map((c) => (
                <CategoryRow key={c.id} cat={c} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New Category Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Create Inventory Category</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Add a top-level classification or nested subcategory.
                </p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white cursor-pointer">
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
                  <option value="">Top Level (Root)</option>
                  {categories.map((c) => (
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

      {/* Archive Category Modal */}
      {confirmArchiveCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
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
                  ? Items in this category will become unassigned.
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
