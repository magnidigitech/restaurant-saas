"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  sortOrder: number;
  children?: Category[];
  _count?: { items: number };
}

export default function InventoryCategoriesPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", parentId: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/restaurant/inventory/categories");
      if (res.ok) setCategories((await res.json()).categories || []);
    } catch { setError("Failed to load categories"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async () => {
    if (!form.name) { setError("Category name is required"); return; }
    setSubmitting(true); setError("");
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
    } catch (e: any) { setError(e.message || "Failed to create category"); }
    finally { setSubmitting(false); }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Archive category "${name}"?`)) return;
    try {
      await fetch(`/api/restaurant/inventory/categories/${id}`, { method: "DELETE" });
      fetchCategories();
    } catch { setError("Failed to archive category"); }
  };

  const rootCategories = categories.filter((c) => !c.parentId);

  const CategoryRow = ({ cat, depth = 0 }: { cat: Category; depth?: number }) => {
    const itemCount = cat._count?.items ?? 0;
    const childrenList = cat.children || [];

    return (
      <div className="space-y-2">
        <div className={`flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 shadow-sm transition-all ${depth > 0 ? "ml-6" : ""}`}>
          <div className={`w-2.5 h-2.5 rounded-full ${depth === 0 ? "bg-indigo-600" : "bg-gray-400"}`} />
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-sm">{cat.name}</h3>
            {cat.description && <p className="text-xs text-gray-500">{cat.description}</p>}
          </div>
          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
            {itemCount} items
          </span>
          {childrenList.length > 0 && (
            <span className="text-xs text-gray-500 font-semibold">{childrenList.length} subcategories</span>
          )}
          <button
            onClick={() => handleArchive(cat.id, cat.name)}
            className="text-xs font-bold text-gray-400 hover:text-red-600 cursor-pointer transition-colors p-1"
          >
            ✕
          </button>
        </div>
        {childrenList.map((child) => (
          <CategoryRow key={child.id} cat={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">Loading categories...</main>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 font-semibold transition-colors cursor-pointer text-sm">
            ← Back
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Inventory Categories</h1>
            <p className="text-xs text-gray-500">Organize items into a category hierarchy</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
        >
          + New Category
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-semibold">{error}</div>}

        {rootCategories.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-300 bg-white rounded-2xl space-y-2">
            <p className="text-gray-900 font-bold text-lg">No Categories Created</p>
            <p className="text-gray-500 text-xs">Create categories to organize your inventory items.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rootCategories.map((cat) => <CategoryRow key={cat.id} cat={cat} />)}
          </div>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div>
              <h2 className="text-xl font-bold text-gray-900">New Category</h2>
              <p className="text-xs text-gray-500 mt-0.5">Create root or sub-category</p>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-xl font-semibold">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Category Name *</label>
                <input
                  placeholder="e.g. Vegetables, Dairy, Spices"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Description (Optional)</label>
                <input
                  placeholder="Category description..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Parent Category</label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">No Parent (Root Category)</option>
                  {categories.filter((c) => !c.parentId).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowCreate(false); setError(""); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-all cursor-pointer">Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm">{submitting ? "Creating..." : "Create Category"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
