"use client";

import React, { useState, useMemo } from "react";
import {
  Package,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Layers,
  ChevronDown,
  Search,
  Scale,
} from "lucide-react";
import {
  COMMON_PACKAGING_TYPES,
  calculatePackDetailsAndFactor,
  UNIT_DEFINITIONS,
  UnitOfMeasure,
  formatUnit,
} from "@/core/inventory/units";

export interface ItemPurchasePackFormValue {
  id?: string;
  name: string;
  packType: string;
  customTypeLabel?: string;
  isNested: boolean;
  innerPackType?: string;
  innerCustomTypeLabel?: string;
  innerPackCount?: number;
  unitsPerInner?: number;
  unitsPerPack?: number; // for single pack
  packUnit: UnitOfMeasure;
  netQuantityPerPack: number;
  conversionFactor: number;
  previewString?: string;
  isVariableWeight: boolean;
  isActive: boolean;
}

interface ItemPackagingSectionProps {
  stockUnit: UnitOfMeasure;
  packs: ItemPurchasePackFormValue[];
  onChange: (packs: ItemPurchasePackFormValue[]) => void;
  isDark?: boolean;
  brandColor?: string;
}

export default function ItemPackagingSection({
  stockUnit,
  packs,
  onChange,
  isDark = false,
  brandColor = "#0071E3",
}: ItemPackagingSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Draft form state
  const [packName, setPackName] = useState("");
  const [packType, setPackType] = useState<string>("Box");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [isNested, setIsNested] = useState(false);
  const [innerPackType, setInnerPackType] = useState<string>("Bag");
  const [innerCustomTypeLabel, setInnerCustomTypeLabel] = useState("");
  const [innerPackCount, setInnerPackCount] = useState<number | "">(4);
  const [unitsPerInner, setUnitsPerInner] = useState<number | "">(5);
  const [unitsPerPack, setUnitsPerPack] = useState<number | "">(40);
  const [packUnit, setPackUnit] = useState<UnitOfMeasure>(stockUnit);
  const [isVariableWeight, setIsVariableWeight] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Search filter states for dropdowns
  const [outerSearch, setOuterSearch] = useState("");
  const [isOuterDropdownOpen, setIsOuterDropdownOpen] = useState(false);
  const [innerSearch, setInnerSearch] = useState("");
  const [isInnerDropdownOpen, setIsInnerDropdownOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);

  // Helper to format unit display label without duplicate short codes
  const formatUnitOption = (u: UnitOfMeasure) => {
    const def = UNIT_DEFINITIONS[u];
    if (!def) return u;
    const label = def.label;
    const short = def.shortLabel;
    if (label.toLowerCase().includes(`(${short.toLowerCase()})`)) {
      return label;
    }
    return `${label} (${short})`;
  };

  // Group compatible purchase units
  const compatibleUnitKeys = useMemo(() => {
    const stockCat = UNIT_DEFINITIONS[stockUnit]?.category;
    return (Object.keys(UNIT_DEFINITIONS) as UnitOfMeasure[]).filter(
      (u) => UNIT_DEFINITIONS[u].category === stockCat
    );
  }, [stockUnit]);

  // Filtered packaging types
  const filteredOuterTypes = useMemo(() => {
    return COMMON_PACKAGING_TYPES.filter((t) =>
      t.toLowerCase().includes(outerSearch.toLowerCase())
    );
  }, [outerSearch]);

  const filteredInnerTypes = useMemo(() => {
    return COMMON_PACKAGING_TYPES.filter((t) =>
      t.toLowerCase().includes(innerSearch.toLowerCase())
    );
  }, [innerSearch]);

  const filteredCompatibleUnits = useMemo(() => {
    const s = unitSearch.toLowerCase().trim();
    return compatibleUnitKeys.filter((u) => {
      const label = formatUnitOption(u).toLowerCase();
      return label.includes(s) || u.toLowerCase().includes(s);
    });
  }, [compatibleUnitKeys, unitSearch]);

  const filteredOtherUnits = useMemo(() => {
    const s = unitSearch.toLowerCase().trim();
    const allUnits = (Object.keys(UNIT_DEFINITIONS) as UnitOfMeasure[]).filter(
      (u) => !compatibleUnitKeys.includes(u)
    );
    return allUnits.filter((u) => {
      const label = formatUnitOption(u).toLowerCase();
      return label.includes(s) || u.toLowerCase().includes(s);
    });
  }, [compatibleUnitKeys, unitSearch]);

  // Compute live calculation
  const calcResult = useMemo(() => {
    return calculatePackDetailsAndFactor({
      packType,
      customTypeLabel,
      isNested,
      innerPackType,
      innerCustomTypeLabel,
      innerPackCount: typeof innerPackCount === "number" ? innerPackCount : 0,
      unitsPerInner: typeof unitsPerInner === "number" ? unitsPerInner : 0,
      unitsPerPack: typeof unitsPerPack === "number" ? unitsPerPack : 0,
      packUnit,
      stockUnit,
    });
  }, [
    packType,
    customTypeLabel,
    isNested,
    innerPackType,
    innerCustomTypeLabel,
    innerPackCount,
    unitsPerInner,
    unitsPerPack,
    packUnit,
    stockUnit,
  ]);

  const resetForm = () => {
    setPackName("");
    setPackType("Box");
    setCustomTypeLabel("");
    setIsNested(false);
    setInnerPackType("Bag");
    setInnerCustomTypeLabel("");
    setInnerPackCount(4);
    setUnitsPerInner(5);
    setUnitsPerPack(40);
    setPackUnit(stockUnit);
    setIsVariableWeight(false);
    setIsActive(true);
    setIsAdding(false);
    setEditingIndex(null);
    setOuterSearch("");
    setIsOuterDropdownOpen(false);
    setInnerSearch("");
    setIsInnerDropdownOpen(false);
    setUnitSearch("");
    setIsUnitDropdownOpen(false);
  };

  const handleStartEdit = (index: number) => {
    const p = packs[index];
    setPackName(p.name);
    setPackType(p.packType);
    setCustomTypeLabel(p.customTypeLabel || "");
    setIsNested(p.isNested);
    setInnerPackType(p.innerPackType || "Bag");
    setInnerCustomTypeLabel(p.innerCustomTypeLabel || "");
    setInnerPackCount(p.innerPackCount !== undefined ? p.innerPackCount : "");
    setUnitsPerInner(p.unitsPerInner !== undefined ? p.unitsPerInner : "");
    setUnitsPerPack(p.unitsPerPack !== undefined ? p.unitsPerPack : "");
    setPackUnit(p.packUnit);
    setIsVariableWeight(p.isVariableWeight);
    setIsActive(p.isActive);
    setEditingIndex(index);
    setIsAdding(true);
    setOuterSearch("");
    setIsOuterDropdownOpen(false);
    setInnerSearch("");
    setIsInnerDropdownOpen(false);
    setUnitSearch("");
    setIsUnitDropdownOpen(false);
  };

  const handleSavePack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcResult.isValid) return;

    const defaultName =
      packName.trim() ||
      `${calcResult.previewString}${isVariableWeight ? " (Catch-Weight)" : ""}`;

    const newPack: ItemPurchasePackFormValue = {
      id: editingIndex !== null ? packs[editingIndex].id : undefined,
      name: defaultName,
      packType,
      customTypeLabel: packType === "Custom" ? customTypeLabel.trim() : undefined,
      isNested,
      innerPackType: isNested ? innerPackType : undefined,
      innerCustomTypeLabel:
        isNested && innerPackType === "Custom" ? innerCustomTypeLabel.trim() : undefined,
      innerPackCount: isNested && typeof innerPackCount === "number" ? innerPackCount : undefined,
      unitsPerInner: isNested && typeof unitsPerInner === "number" ? unitsPerInner : undefined,
      unitsPerPack: !isNested && typeof unitsPerPack === "number" ? unitsPerPack : undefined,
      packUnit,
      netQuantityPerPack: calcResult.netQuantityPerPack,
      conversionFactor: calcResult.conversionFactor,
      previewString: calcResult.previewString,
      isVariableWeight,
      isActive,
    };

    if (editingIndex !== null) {
      const updated = [...packs];
      updated[editingIndex] = newPack;
      onChange(updated);
    } else {
      onChange([...packs, newPack]);
    }

    resetForm();
  };

  const handleRemovePack = (index: number) => {
    onChange(packs.filter((_, i) => i !== index));
    if (editingIndex === index) {
      resetForm();
    }
  };

  const handleToggleActive = (index: number) => {
    const updated = [...packs];
    updated[index].isActive = !updated[index].isActive;
    onChange(updated);
  };

  return (
    <div className="space-y-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[#0071E3] shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Purchase Packaging & Case Sizing
          </h4>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-white shadow-2xs transition hover:opacity-95 active:scale-[0.98] cursor-pointer"
            style={{ backgroundColor: brandColor }}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Add Purchase Pack</span>
          </button>
        )}
      </div>

      {/* Existing Packs List */}
      {packs.length > 0 && (
        <div className="space-y-2.5">
          {packs.map((p, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border transition ${
                p.isActive
                  ? isDark
                    ? "bg-[#090B10]/80 border-white/[0.08]"
                    : "bg-white border-slate-200/90 shadow-2xs"
                  : isDark
                  ? "bg-[#090B10]/30 border-white/[0.04] opacity-60"
                  : "bg-slate-50 border-slate-200/60 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {p.name}
                  </h5>
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                        p.isActive
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                      }`}
                    >
                      {p.isActive ? "Active for Purchasing" : "Inactive / Archived"}
                    </span>
                    {p.isVariableWeight && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Scale className="w-3 h-3" />
                        <span>Catch-Weight</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(idx)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      p.isActive ? "bg-emerald-500" : isDark ? "bg-white/20" : "bg-slate-300"
                    }`}
                    title={p.isActive ? "Active (click to deactivate)" : "Inactive (click to activate)"}
                    aria-label={p.isActive ? "Deactivate pack" : "Activate pack"}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                        p.isActive ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(idx)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.1] font-semibold transition cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemovePack(idx)}
                    className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                    title="Remove pack"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap pt-2 mt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {p.previewString ||
                    `1 pack = ${p.conversionFactor} ${formatUnit(stockUnit)}`}
                </span>
                <span>•</span>
                <span>
                  Multiplier:{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {p.conversionFactor}×
                  </strong>{" "}
                  stock {formatUnit(stockUnit)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Pack Drawer Form */}
      {isAdding && (
        <div
          className={`p-4 rounded-3xl border space-y-4 animate-in fade-in duration-150 relative ${
            isDark
              ? "bg-[#090B10] border-[#0071E3]/40 shadow-xl"
              : "bg-blue-50/30 border-blue-200 shadow-sm"
          }`}
        >
          {/* Backdrop for closing open custom dropdowns on outside click */}
          {(isOuterDropdownOpen || isInnerDropdownOpen || isUnitDropdownOpen) && (
            <div
              className="fixed inset-0 z-20"
              onClick={() => {
                setIsOuterDropdownOpen(false);
                setIsInnerDropdownOpen(false);
                setIsUnitDropdownOpen(false);
              }}
            />
          )}
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#0071E3]" />
              <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                {editingIndex !== null ? "Edit Purchase Packaging" : "Configure New Purchase Packaging"}
              </h5>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-4">
            {/* Packaging Hierarchy Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsNested(false)}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-start gap-3 ${
                  !isNested
                    ? isDark
                      ? "bg-[#0071E3]/15 border-[#0071E3] shadow-xs"
                      : "bg-blue-50/80 border-[#0071E3] shadow-xs"
                    : isDark
                    ? "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.05]"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl shrink-0 ${
                    !isNested
                      ? "bg-[#0071E3] text-white"
                      : isDark
                      ? "bg-white/[0.06] text-slate-400"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Package className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-xs font-bold ${
                      !isNested
                        ? "text-[#0071E3] dark:text-[#70B4FF]"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    Single Packaging
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    e.g. 40 lb Box, 25 lb Sack
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsNested(true)}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-start gap-3 ${
                  isNested
                    ? isDark
                      ? "bg-[#0071E3]/15 border-[#0071E3] shadow-xs"
                      : "bg-blue-50/80 border-[#0071E3] shadow-xs"
                    : isDark
                    ? "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.05]"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl shrink-0 ${
                    isNested
                      ? "bg-[#0071E3] text-white"
                      : isDark
                      ? "bg-white/[0.06] text-slate-400"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-xs font-bold ${
                      isNested
                        ? "text-[#0071E3] dark:text-[#70B4FF]"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    Nested Packaging
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    e.g. 1 Case × 4 Bags × 5 lb
                  </div>
                </div>
              </button>
            </div>

            {/* Packaging Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Pack Label / Display Name (Optional)
              </label>
              <input
                type="text"
                placeholder={
                  calcResult.isValid
                    ? calcResult.previewString
                    : "e.g. 40 lb Box, 20 Sleeve Case"
                }
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] text-white"
                    : "bg-white border-slate-200 text-slate-900"
                }`}
              />
            </div>

            {/* Container Dimensions Grid */}
            {!isNested ? (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Outer Container Type (Searchable) */}
                <div className="sm:col-span-4 relative">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
                    Packaging Container
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOuterDropdownOpen(!isOuterDropdownOpen);
                        setIsInnerDropdownOpen(false);
                        setIsUnitDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl border cursor-pointer ${
                        isDark
                          ? "bg-white/[0.04] border-white/[0.08] text-white"
                          : "bg-white border-slate-200 text-slate-900"
                      }`}
                    >
                      <span className="truncate">{packType}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1" />
                    </button>

                    {isOuterDropdownOpen && (
                      <div
                        className={`absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-2xl border shadow-xl p-1.5 ${
                          isDark ? "bg-[#141824] border-white/[0.1]" : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="px-2 py-1 sticky top-0 bg-inherit border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-1.5 mb-1 backdrop-blur-md">
                          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            placeholder="Search container..."
                            value={outerSearch}
                            onChange={(e) => setOuterSearch(e.target.value)}
                            className="w-full text-xs bg-transparent focus:outline-none"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-0.5">
                          {filteredOuterTypes.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setPackType(t);
                                setIsOuterDropdownOpen(false);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                packType === t
                                  ? "bg-[#0071E3] text-white font-bold"
                                  : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                              }`}
                            >
                              <span>{t}</span>
                              {packType === t && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {packType === "Custom" && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="e.g. Master Carton, Tote"
                        value={customTypeLabel}
                        onChange={(e) => setCustomTypeLabel(e.target.value)}
                        className={`w-full px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none ${
                          isDark
                            ? "bg-white/[0.04] border-white/[0.08] text-white"
                            : "bg-white border-slate-200"
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Single Pack: Units Per Pack */}
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
                    Units per {packType}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    placeholder="e.g. 40"
                    value={unitsPerPack}
                    onChange={(e) =>
                      setUnitsPerPack(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                      isDark
                        ? "bg-white/[0.04] border-white/[0.08] text-white"
                        : "bg-white border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                {/* Measurement Unit for Pack Contents (Searchable Dropdown) */}
                <div className="sm:col-span-5 relative">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
                    Contents Unit
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUnitDropdownOpen(!isUnitDropdownOpen);
                        setIsOuterDropdownOpen(false);
                        setIsInnerDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl border cursor-pointer ${
                        isDark
                          ? "bg-white/[0.04] border-white/[0.08] text-white"
                          : "bg-white border-slate-200 text-slate-900"
                      }`}
                    >
                      <span className="truncate">{formatUnitOption(packUnit)}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1" />
                    </button>

                    {isUnitDropdownOpen && (
                      <div
                        className={`absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-2xl border shadow-xl p-1.5 ${
                          isDark ? "bg-[#141824] border-white/[0.1]" : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="px-2 py-1 sticky top-0 bg-inherit border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-1.5 mb-1 backdrop-blur-md">
                          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            placeholder="Search unit..."
                            value={unitSearch}
                            onChange={(e) => setUnitSearch(e.target.value)}
                            className="w-full text-xs bg-transparent focus:outline-none"
                            autoFocus
                          />
                        </div>

                        <div className="space-y-1">
                          {filteredCompatibleUnits.length > 0 && (
                            <div>
                              <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                Compatible with Stock Unit
                              </div>
                              <div className="space-y-0.5">
                                {filteredCompatibleUnits.map((u) => (
                                  <button
                                    key={u}
                                    type="button"
                                    onClick={() => {
                                      setPackUnit(u);
                                      setIsUnitDropdownOpen(false);
                                      setUnitSearch("");
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                      packUnit === u
                                        ? "bg-[#0071E3] text-white font-bold"
                                        : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-slate-800 dark:text-slate-200"
                                    }`}
                                  >
                                    <span className="truncate">{formatUnitOption(u)}</span>
                                    {packUnit === u && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {filteredOtherUnits.length > 0 && (
                            <div>
                              <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                Other Units
                              </div>
                              <div className="space-y-0.5">
                                {filteredOtherUnits.map((u) => (
                                  <button
                                    key={u}
                                    type="button"
                                    onClick={() => {
                                      setPackUnit(u);
                                      setIsUnitDropdownOpen(false);
                                      setUnitSearch("");
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                      packUnit === u
                                        ? "bg-[#0071E3] text-white font-bold"
                                        : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-slate-800 dark:text-slate-200"
                                    }`}
                                  >
                                    <span className="truncate">{formatUnitOption(u)}</span>
                                    {packUnit === u && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {filteredCompatibleUnits.length === 0 && filteredOtherUnits.length === 0 && (
                            <div className="py-3 text-center text-xs text-slate-400">
                              No matching units found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Outer Container */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Outer Container
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOuterDropdownOpen(!isOuterDropdownOpen);
                          setIsInnerDropdownOpen(false);
                          setIsUnitDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl border cursor-pointer ${
                          isDark
                            ? "bg-white/[0.04] border-white/[0.08] text-white"
                            : "bg-white border-slate-200 text-slate-900"
                        }`}
                      >
                        <span className="truncate">{packType}</span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1" />
                      </button>

                      {isOuterDropdownOpen && (
                        <div
                          className={`absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-2xl border shadow-xl p-1.5 ${
                            isDark ? "bg-[#141824] border-white/[0.1]" : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="px-2 py-1 sticky top-0 bg-inherit border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-1.5 mb-1 backdrop-blur-md">
                            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              placeholder="Search container..."
                              value={outerSearch}
                              onChange={(e) => setOuterSearch(e.target.value)}
                              className="w-full text-xs bg-transparent focus:outline-none"
                              autoFocus
                            />
                          </div>
                          <div className="space-y-0.5">
                            {filteredOuterTypes.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  setPackType(t);
                                  setIsOuterDropdownOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                  packType === t
                                    ? "bg-[#0071E3] text-white font-bold"
                                    : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                                }`}
                              >
                                <span>{t}</span>
                                {packType === t && <Check className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {packType === "Custom" && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="e.g. Master Carton, Tote"
                          value={customTypeLabel}
                          onChange={(e) => setCustomTypeLabel(e.target.value)}
                          className={`w-full px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none ${
                            isDark
                              ? "bg-white/[0.04] border-white/[0.08] text-white"
                              : "bg-white border-slate-200"
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Inner Sub-Packs (Count + Container Type) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Inner Units / Sub-Packs
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Count"
                        value={innerPackCount}
                        onChange={(e) =>
                          setInnerPackCount(
                            e.target.value === "" ? "" : parseFloat(e.target.value)
                          )
                        }
                        className={`w-24 px-3 py-2 text-xs rounded-xl border focus:outline-none shrink-0 ${
                          isDark
                            ? "bg-white/[0.04] border-white/[0.08] text-white"
                            : "bg-white border-slate-200 text-slate-900"
                        }`}
                      />
                      <div className="relative flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            setIsInnerDropdownOpen(!isInnerDropdownOpen);
                            setIsOuterDropdownOpen(false);
                            setIsUnitDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl border cursor-pointer ${
                            isDark
                              ? "bg-white/[0.04] border-white/[0.08] text-white"
                              : "bg-white border-slate-200 text-slate-900"
                          }`}
                        >
                          <span className="truncate">{innerPackType}</span>
                          <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1" />
                        </button>

                        {isInnerDropdownOpen && (
                          <div
                            className={`absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-2xl border shadow-xl p-1.5 ${
                              isDark ? "bg-[#141824] border-white/[0.1]" : "bg-white border-slate-200"
                            }`}
                          >
                            <div className="px-2 py-1 sticky top-0 bg-inherit border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-1.5 mb-1 backdrop-blur-md">
                              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                placeholder="Search..."
                                value={innerSearch}
                                onChange={(e) => setInnerSearch(e.target.value)}
                                className="w-full text-xs bg-transparent focus:outline-none"
                                autoFocus
                              />
                            </div>
                            <div className="space-y-0.5">
                              {filteredInnerTypes.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => {
                                    setInnerPackType(t);
                                    setIsInnerDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                    innerPackType === t
                                      ? "bg-[#0071E3] text-white font-bold"
                                      : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                                  }`}
                                >
                                  <span>{t}</span>
                                  {innerPackType === t && <Check className="w-3.5 h-3.5" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {innerPackType === "Custom" && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Supplier label (e.g. #10 Can, Sachet)"
                          value={innerCustomTypeLabel}
                          onChange={(e) => setInnerCustomTypeLabel(e.target.value)}
                          className={`w-full px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none ${
                            isDark
                              ? "bg-white/[0.04] border-white/[0.08] text-white"
                              : "bg-white border-slate-200"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Qty per Inner Container */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
                      Qty per {innerPackType}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      placeholder="e.g. 5, 50, 102"
                      value={unitsPerInner}
                      onChange={(e) =>
                        setUnitsPerInner(
                          e.target.value === "" ? "" : parseFloat(e.target.value)
                        )
                      }
                      className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                        isDark
                          ? "bg-white/[0.04] border-white/[0.08] text-white"
                          : "bg-white border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  {/* Measurement Unit for Pack Contents (Searchable Dropdown) */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
                      Contents Unit
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUnitDropdownOpen(!isUnitDropdownOpen);
                          setIsOuterDropdownOpen(false);
                          setIsInnerDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl border cursor-pointer ${
                          isDark
                            ? "bg-white/[0.04] border-white/[0.08] text-white"
                            : "bg-white border-slate-200 text-slate-900"
                        }`}
                      >
                        <span className="truncate">{formatUnitOption(packUnit)}</span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1" />
                      </button>

                      {isUnitDropdownOpen && (
                        <div
                          className={`absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-2xl border shadow-xl p-1.5 ${
                            isDark ? "bg-[#141824] border-white/[0.1]" : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="px-2 py-1 sticky top-0 bg-inherit border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-1.5 mb-1 backdrop-blur-md">
                            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              placeholder="Search unit..."
                              value={unitSearch}
                              onChange={(e) => setUnitSearch(e.target.value)}
                              className="w-full text-xs bg-transparent focus:outline-none"
                              autoFocus
                            />
                          </div>

                          <div className="space-y-1">
                            {filteredCompatibleUnits.length > 0 && (
                              <div>
                                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                  Compatible with Stock Unit
                                </div>
                                <div className="space-y-0.5">
                                  {filteredCompatibleUnits.map((u) => (
                                    <button
                                      key={u}
                                      type="button"
                                      onClick={() => {
                                        setPackUnit(u);
                                        setIsUnitDropdownOpen(false);
                                        setUnitSearch("");
                                      }}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                        packUnit === u
                                          ? "bg-[#0071E3] text-white font-bold"
                                          : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-slate-800 dark:text-slate-200"
                                      }`}
                                    >
                                      <span className="truncate">{formatUnitOption(u)}</span>
                                      {packUnit === u && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {filteredOtherUnits.length > 0 && (
                              <div>
                                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                  Other Units
                                </div>
                                <div className="space-y-0.5">
                                  {filteredOtherUnits.map((u) => (
                                    <button
                                      key={u}
                                      type="button"
                                      onClick={() => {
                                        setPackUnit(u);
                                        setIsUnitDropdownOpen(false);
                                        setUnitSearch("");
                                      }}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                                        packUnit === u
                                          ? "bg-[#0071E3] text-white font-bold"
                                          : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-slate-800 dark:text-slate-200"
                                      }`}
                                    >
                                      <span className="truncate">{formatUnitOption(u)}</span>
                                      {packUnit === u && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {filteredCompatibleUnits.length === 0 && filteredOtherUnits.length === 0 && (
                              <div className="py-3 text-center text-xs text-slate-400">
                                No matching units found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Variable Weight Toggle Card */}
            <div
              onClick={() => setIsVariableWeight(!isVariableWeight)}
              className={`p-3 rounded-2xl border transition cursor-pointer select-none flex items-start gap-3 ${
                isVariableWeight
                  ? isDark
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                    : "bg-amber-50/80 border-amber-200/80 text-amber-900"
                  : isDark
                  ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                  : "bg-white border-slate-200 hover:bg-slate-50/80"
              }`}
            >
              <input
                type="checkbox"
                checked={isVariableWeight}
                onChange={(e) => {
                  e.stopPropagation();
                  setIsVariableWeight(e.target.checked);
                }}
                className="mt-0.5 w-4 h-4 rounded text-[#0071E3] focus:ring-0 cursor-pointer accent-[#0071E3]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800 dark:text-slate-200">
                  <Scale className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Variable-Weight Good (Catch-Weight)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Net weight varies on delivery (e.g. meat briskets, whole fish, produce crates). Staff will record exact scale weight upon receipt.
                </p>
              </div>
            </div>

            {/* Live Calculation & Preview Callout */}
            <div
              className={`p-3.5 rounded-2xl border transition ${
                calcResult.isValid
                  ? isDark
                    ? "bg-[#0071E3]/10 border-[#0071E3]/25 text-[#70B4FF]"
                    : "bg-blue-50/80 border-blue-200 text-[#0071E3]"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-500"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {calcResult.isValid ? (
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1">
                  <div className="font-bold text-xs">
                    {calcResult.isValid
                      ? `Live Sizing Preview: ${calcResult.previewString}`
                      : calcResult.error || "Please enter valid packaging dimensions."}
                  </div>
                  {calcResult.isValid && (
                    <div className="text-[11px] opacity-85">
                      Conversion to item stock unit:{" "}
                      <strong>
                        1 {calcResult.packTypeDisplay} = {calcResult.conversionFactor}{" "}
                        {formatUnit(stockUnit)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!calcResult.isValid}
                onClick={handleSavePack}
                className="px-5 py-1.5 text-xs font-semibold rounded-xl text-white shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: brandColor }}
              >
                {editingIndex !== null ? "Update Packaging" : "Save Packaging"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
