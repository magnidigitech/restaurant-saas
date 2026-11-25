"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { convertUnitCost, getUnitPricingMatrix, formatUnit, calculateGrossQuantity } from "@/core/inventory/units";
import {
  ArrowLeft,
  UtensilsCrossed,
  ChefHat,
  Plus,
  ClipboardPaste,
  FileSpreadsheet,
  Upload,
  Download,
  Check,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Search,
  Layers,
  ChevronDown,
  Sparkles,
  Info,
  ExternalLink,
  BookOpen,
  X,
} from "lucide-react";

interface Recipe {
  id: string;
  name: string;
  type: "DISH" | "SUB_RECIPE";
  description?: string;
  instructions?: string;
  yieldQuantity: number;
  yieldUnit: string;
  servingSize?: string;
  prepTimeMin?: number;
  sellingPrice: number;
  costPerUnit: number;
  totalCost: number;
  grossMarginPercent: number;
  targetFoodCostPercent?: number;
  isDraft: boolean;
  sourceType?: string;
  createdAt: string;
  _count?: { items: number; usedInRecipeItems: number };
}

interface PurchasePackSummary {
  id: string;
  name: string;
  packType: string;
  packUnit: string;
  conversionFactor: number;
  netQuantityPerPack: number;
}

interface InventoryItem {
  id: string;
  name: string;
  sku?: string | null;
  unitOfMeasure: string;
  costPerUnit: number;
  purchasePacks?: PurchasePackSummary[];
}

interface FormRecipeItem {
  id?: string;
  componentType: "INVENTORY_ITEM" | "SUB_RECIPE";
  inventoryItemId?: string;
  subRecipeId?: string;
  packId?: string;
  packQuantity?: string;
  quantity: string;
  unitOfMeasure: string;
  wastagePercent: string;
  notes?: string;
  originalText?: string;
  statedQuantityRaw?: string;
  isUnresolved: boolean;
  unresolvedReason?: string;
  ladleInfo?: string;
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
      { value: "LADLE", label: "Ladle (4 oz scoop / ~118 ml)" },
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

export default function RecipesDirectoryPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "DISH" | "SUB_RECIPE" | "DRAFTS">("ALL");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Modal / Workspace State
  const [activeModal, setActiveModal] = useState<"NONE" | "WORKSPACE" | "PASTE" | "EXCEL">("NONE");
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  // Paste Recipe State
  const [pasteText, setPasteText] = useState("");
  const [isParsingText, setIsParsingText] = useState(false);
  const [pasteError, setPasteError] = useState("");

  // Excel Import State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [excelError, setExcelError] = useState("");
  const [excelPreview, setExcelPreview] = useState<any | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<"CREATE_AS_DRAFT" | "UPDATE" | "SKIP">("CREATE_AS_DRAFT");

  // Form State
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"DISH" | "SUB_RECIPE">("DISH");
  const [formDescription, setFormDescription] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formYieldQty, setFormYieldQty] = useState("1");
  const [formYieldUnit, setFormYieldUnit] = useState("PORTION");
  const [formServingSize, setFormServingSize] = useState("");
  const [formPrepTimeMin, setFormPrepTimeMin] = useState("");
  const [formSellingPrice, setFormSellingPrice] = useState("0");
  const [targetFoodCostPercent, setTargetFoodCostPercent] = useState("28");
  const [formIsDraft, setFormIsDraft] = useState(false);
  const [formSourceType, setFormSourceType] = useState<"MANUAL" | "PASTED" | "EXCEL">("MANUAL");
  const [formItems, setFormItems] = useState<FormRecipeItem[]>([]);

  const fetchData = async () => {
    try {
      const [resRecipes, resItems] = await Promise.all([
        fetch("/api/restaurant/inventory/recipes"),
        fetch("/api/restaurant/inventory/items"),
      ]);
      if (resRecipes.ok) setRecipes((await resRecipes.json()).recipes || []);
      if (resItems.ok) setInventoryItems((await resItems.json()).items || []);
    } catch {
      setError("Failed to load recipes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (typeof window !== "undefined") {
      const editId = new URLSearchParams(window.location.search).get("edit");
      if (editId) {
        handleEditRecipe({ id: editId } as any);
      } else {
        setActiveModal("NONE");
      }
    }
  }, []);

  // Browser Back button integration: pressing Back closes open directory modal
  useEffect(() => {
    if (activeModal === "NONE") return;

    window.history.pushState({ directoryModalOpen: activeModal }, "");

    const handlePopState = () => {
      setEditingRecipeId(null);
      setActiveModal("NONE");
      setError("");
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [activeModal]);

  const subRecipesList = recipes.filter((r) => r.type === "SUB_RECIPE" && !r.isDraft);

  // Reset Workspace Form
  const resetWorkspace = () => {
    setEditingRecipeId(null);
    setFormName("");
    setFormType("DISH");
    setFormDescription("");
    setFormInstructions("");
    setFormYieldQty("1");
    setFormYieldUnit("PORTION");
    setFormServingSize("");
    setFormPrepTimeMin("");
    setFormSellingPrice("0");
    setTargetFoodCostPercent("28");
    setFormIsDraft(false);
    setFormSourceType("MANUAL");
    setFormItems([
      {
        componentType: "INVENTORY_ITEM",
        inventoryItemId: "",
        subRecipeId: "",
        quantity: "1",
        unitOfMeasure: "LB",
        wastagePercent: "0",
        isUnresolved: false,
      },
    ]);
    setActiveModal("NONE");
    setError("");

    // Clean up ?edit= from URL so it doesn't get stuck in the address bar
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("edit")) {
        url.searchParams.delete("edit");
        window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
      }
      if (window.history.state?.directoryModalOpen) {
        window.history.back();
      }
    }
  };

  // Start Manually Entry Point
  const handleStartManually = () => {
    resetWorkspace();
    setActiveModal("WORKSPACE");
  };

  // Open Edit for an existing recipe
  const handleEditRecipe = async (recipe: Recipe) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/restaurant/inventory/recipes/${recipe.id}`);
      const data = await res.json();
      if (res.ok && data.recipe) {
        const r = data.recipe;
        setEditingRecipeId(r.id);
        setFormName(r.name);
        setFormType(r.type);
        setFormDescription(r.description || "");
        setFormInstructions(r.instructions || "");
        setFormYieldQty(String(r.yieldQuantity || 1));
        setFormYieldUnit(r.yieldUnit || "PORTION");
        setFormServingSize(r.servingSize || "");
        setFormPrepTimeMin(r.prepTimeMin ? String(r.prepTimeMin) : "");
        setFormSellingPrice(String(r.sellingPrice || 0));
        setTargetFoodCostPercent(String(r.targetFoodCostPercent || 28));
        setFormIsDraft(r.isDraft);
        setFormSourceType((r.sourceType as any) || "MANUAL");

        if (r.items && r.items.length > 0) {
          setFormItems(
            r.items.map((i: any) => ({
              id: i.id,
              componentType: i.componentType,
              inventoryItemId: i.inventoryItemId || "",
              subRecipeId: i.subRecipeId || "",
              packId: i.packId || "",
              packQuantity: i.packQuantity ? String(i.packQuantity) : "",
              quantity: String(i.quantity || 1),
              unitOfMeasure: i.unitOfMeasure,
              wastagePercent: String(i.wastagePercent || 0),
              notes: i.notes || "",
              originalText: i.originalText || "",
              statedQuantityRaw: i.statedQuantityRaw || "",
              isUnresolved: i.isUnresolved,
              unresolvedReason: i.unresolvedReason || "",
            }))
          );
        } else {
          setFormItems([
            {
              componentType: "INVENTORY_ITEM",
              inventoryItemId: "",
              quantity: "1",
              unitOfMeasure: "LB",
              wastagePercent: "0",
              isUnresolved: false,
            },
          ]);
        }
        setActiveModal("WORKSPACE");
      }
    } catch {
      setError("Failed to open recipe editor");
    } finally {
      setLoading(false);
    }
  };

  // Process Pasted Recipe
  const handleParsePastedText = async () => {
    if (!pasteText.trim()) {
      setPasteError("Please paste recipe text to extract.");
      return;
    }

    setIsParsingText(true);
    setPasteError("");

    try {
      const res = await fetch("/api/restaurant/inventory/recipes/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: pasteText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse recipe");

      const doc = data.document;
      setEditingRecipeId(null);
      setFormName(doc.title || "Untitled Recipe");
      setFormType(doc.type || "DISH");
      setFormYieldQty(String(doc.yieldQuantity || 1));
      setFormYieldUnit(doc.yieldUnit || "PORTION");
      setFormPrepTimeMin(doc.prepTimeMin ? String(doc.prepTimeMin) : "");
      setFormInstructions(doc.instructions || "");
      setFormIsDraft(true); // Pasted recipes default to draft until reviewed
      setFormSourceType("PASTED");

      const mappedItems: FormRecipeItem[] = doc.ingredients.map((ing: any) => ({
        componentType: ing.matchedComponent?.componentType || "INVENTORY_ITEM",
        inventoryItemId:
          ing.matchedComponent?.componentType === "INVENTORY_ITEM"
            ? ing.matchedComponent.id
            : "",
        subRecipeId:
          ing.matchedComponent?.componentType === "SUB_RECIPE"
            ? ing.matchedComponent.id
            : "",
        packId: ing.matchedComponent?.selectedPackId || "",
        packQuantity: ing.matchedComponent?.packQuantity ? String(ing.matchedComponent.packQuantity) : "",
        quantity: ing.quantity !== null ? String(ing.quantity) : "1",
        unitOfMeasure: ing.unitOfMeasure || "PIECES",
        wastagePercent: String(ing.prepLossPercent || 0),
        notes: ing.prepNotes || "",
        originalText: ing.originalText,
        statedQuantityRaw: ing.statedQuantityRaw || "",
        isUnresolved: ing.isUnresolved || !ing.matchedComponent || !ing.matchedComponent.isUnitCompatible,
        unresolvedReason: ing.unresolvedReason || (!ing.matchedComponent ? `Unmatched item "${ing.name}". Link to inventory or sub-recipe.` : !ing.matchedComponent.isUnitCompatible ? ing.matchedComponent.unitCompatibilityError : ""),
        ladleInfo: ing.ladleInfo,
      }));

      setFormItems(mappedItems.length > 0 ? mappedItems : [
        {
          componentType: "INVENTORY_ITEM",
          quantity: "1",
          unitOfMeasure: "LB",
          wastagePercent: "0",
          isUnresolved: false,
        },
      ]);

      setActiveModal("WORKSPACE");
      setPasteText("");
    } catch (e: any) {
      setPasteError(e.message || "Failed to parse text");
    } finally {
      setIsParsingText(false);
    }
  };

  // Upload Excel Preview
  const handleUploadExcelFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) {
      setExcelError("Please select a file to upload");
      return;
    }

    setIsProcessingExcel(true);
    setExcelError("");

    try {
      const formData = new FormData();
      formData.append("file", excelFile);

      const res = await fetch("/api/restaurant/inventory/recipes/import-excel", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process Excel file");

      setExcelPreview(data.parseResult);
    } catch (e: any) {
      setExcelError(e.message || "Failed to parse Excel file");
    } finally {
      setIsProcessingExcel(false);
    }
  };

  // Commit Excel Import as Drafts
  const handleCommitExcelImport = async () => {
    if (!excelPreview || !excelPreview.groupedRecipes || excelPreview.groupedRecipes.length === 0) {
      return;
    }

    setIsProcessingExcel(true);
    setExcelError("");

    try {
      const res = await fetch("/api/restaurant/inventory/recipes/import-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipes: excelPreview.groupedRecipes,
          duplicateAction,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import recipes");

      setActiveModal("NONE");
      setExcelFile(null);
      setExcelPreview(null);
      fetchData();
    } catch (e: any) {
      setExcelError(e.message || "Import commit failed");
    } finally {
      setIsProcessingExcel(false);
    }
  };

  // Ingredient Line Row Operations
  const handleAddItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      {
        componentType: "INVENTORY_ITEM",
        inventoryItemId: "",
        subRecipeId: "",
        quantity: "1",
        unitOfMeasure: "OZ",
        wastagePercent: "0",
        isUnresolved: false,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemRowChange = (index: number, field: keyof FormRecipeItem, val: any) => {
    setFormItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };

      if (field === "inventoryItemId" && val) {
        const selected = inventoryItems.find((i) => i.id === val);
        if (selected) {
          copy[index].unitOfMeasure = selected.unitOfMeasure;
          copy[index].isUnresolved = false;
          copy[index].unresolvedReason = undefined;
          copy[index].packId = undefined;
        }
      } else if (field === "subRecipeId" && val) {
        const selected = subRecipesList.find((r) => r.id === val);
        if (selected) {
          copy[index].unitOfMeasure = selected.yieldUnit;
          copy[index].isUnresolved = false;
          copy[index].unresolvedReason = undefined;
        }
      }

      return copy;
    });
  };

  // Compute Live Row Costing & Shrinkage Math
  const computeFormRowCost = (row: FormRecipeItem) => {
    let usableQty = parseFloat(row.quantity) || 0;
    const waste = parseFloat(row.wastagePercent) || 0;

    let baseCost = 0;
    let baseUnit = "PIECES";
    let isPackUsed = false;
    let packMultiplier = 1;

    if (row.componentType === "INVENTORY_ITEM" && row.inventoryItemId) {
      const item = inventoryItems.find((i) => i.id === row.inventoryItemId);
      if (item) {
        baseCost = Number(item.costPerUnit);
        baseUnit = item.unitOfMeasure;

        // Check if packaging is selected
        if (row.packId && item.purchasePacks) {
          const pack = item.purchasePacks.find((p) => p.id === row.packId);
          if (pack) {
            isPackUsed = true;
            packMultiplier = Number(pack.netQuantityPerPack || pack.conversionFactor || 1);
            if (row.packQuantity && parseFloat(row.packQuantity) > 0) {
              usableQty = parseFloat(row.packQuantity) * packMultiplier;
            }
          }
        }
      }
    } else if (row.componentType === "SUB_RECIPE" && row.subRecipeId) {
      const sub = subRecipesList.find((r) => r.id === row.subRecipeId);
      if (sub) {
        baseCost = Number(sub.costPerUnit);
        baseUnit = sub.yieldUnit;
      }
    }

    // Exact culinary gross quantity: Usable ÷ (1 - Loss%)
    const grossQty = calculateGrossQuantity(usableQty, waste);
    const effectiveUnitCost = convertUnitCost(baseCost, baseUnit as any, row.unitOfMeasure as any);
    const lineTotal = grossQty * effectiveUnitCost;

    return {
      baseCost,
      baseUnit,
      effectiveUnitCost,
      usableQty,
      grossQty,
      lineTotal,
      isPackUsed,
      packMultiplier,
      hasMissingCost: baseCost <= 0,
    };
  };

  // Workspace Calculations
  const calculatedTotalBatchCost = formItems.reduce((acc, row) => {
    return acc + computeFormRowCost(row).lineTotal;
  }, 0);

  const yieldQtyNum = parseFloat(formYieldQty) || 1;
  const calculatedCostPerPortion = yieldQtyNum > 0 ? calculatedTotalBatchCost / yieldQtyNum : calculatedTotalBatchCost;
  const targetFoodCostNum = parseFloat(targetFoodCostPercent) || 28;
  const suggestedSellingPrice = targetFoodCostNum > 0 ? calculatedCostPerPortion / (targetFoodCostNum / 100) : 0;
  const currentSellingPriceNum = parseFloat(formSellingPrice) || 0;
  const currentGrossMargin = currentSellingPriceNum > 0 ? ((currentSellingPriceNum - calculatedCostPerPortion) / currentSellingPriceNum) * 100 : 0;

  // Count Unresolved Items
  const unresolvedItems = formItems.filter(
    (i) => i.isUnresolved || (!i.inventoryItemId && !i.subRecipeId)
  );

  const handleApplySuggestedPrice = () => {
    setFormSellingPrice(suggestedSellingPrice.toFixed(2));
  };

  // Save / Publish Recipe Action
  const handleSaveRecipe = async (asDraft: boolean) => {
    if (!formName.trim()) {
      setError("Recipe name is required");
      return;
    }

    if (!asDraft && unresolvedItems.length > 0) {
      setError(`Cannot publish recipe with ${unresolvedItems.length} unresolved issue(s). Resolve all issues or save as Draft.`);
      return;
    }

    const validItems = formItems.filter((i) =>
      i.componentType === "INVENTORY_ITEM" ? i.inventoryItemId || asDraft : i.subRecipeId || asDraft
    );

    if (validItems.length === 0) {
      setError("Please add at least one ingredient line");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        name: formName.trim(),
        type: formType,
        description: formDescription || null,
        instructions: formInstructions || null,
        yieldQuantity: parseFloat(formYieldQty) || 1,
        yieldUnit: formYieldUnit,
        servingSize: formServingSize || null,
        prepTimeMin: formPrepTimeMin ? parseInt(formPrepTimeMin, 10) : null,
        sellingPrice: formType === "DISH" ? parseFloat(formSellingPrice) || 0 : 0,
        targetFoodCostPercent: parseFloat(targetFoodCostPercent) || 28,
        isDraft: asDraft,
        sourceType: formSourceType,
        items: validItems.map((i) => ({
          componentType: i.componentType,
          inventoryItemId: i.componentType === "INVENTORY_ITEM" ? i.inventoryItemId || null : null,
          subRecipeId: i.componentType === "SUB_RECIPE" ? i.subRecipeId || null : null,
          packId: i.packId || null,
          packQuantity: i.packQuantity ? parseFloat(i.packQuantity) : null,
          quantity: parseFloat(i.quantity) || 1,
          unitOfMeasure: i.unitOfMeasure,
          wastagePercent: parseFloat(i.wastagePercent) || 0,
          notes: i.notes || null,
          originalText: i.originalText || null,
          statedQuantityRaw: i.statedQuantityRaw || null,
          isUnresolved: i.isUnresolved,
          unresolvedReason: i.unresolvedReason || null,
        })),
      };

      const url = editingRecipeId
        ? `/api/restaurant/inventory/recipes/${editingRecipeId}`
        : "/api/restaurant/inventory/recipes";
      const method = editingRecipeId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save recipe");

      resetWorkspace();
      fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to save recipe");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Recipes Directory
  const filteredRecipes = recipes.filter((r) => {
    if (typeFilter === "DISH" && r.type !== "DISH") return false;
    if (typeFilter === "SUB_RECIPE" && r.type !== "SUB_RECIPE") return false;
    if (typeFilter === "DRAFTS" && !r.isDraft) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <ModuleAccessGuard moduleKey="inventory" moduleName="Recipes">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Recipes" />

        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Executive Header Banner & Entry Points */}
          <div
            className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 ${
              isDark
                ? "bg-[#121622]/60 border-white/[0.06]"
                : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
            }`}
          >
            <div>
              <h1 className={`text-2xl font-bold tracking-tight flex items-center gap-2.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                <ChefHat className="w-6 h-6 text-[#0071E3] shrink-0" />
                <span>Recipe Builder & Food Costing</span>
              </h1>
            </div>

            {/* Three Primary Entry Points */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveModal("PASTE")}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-2xl border transition cursor-pointer ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.08]"
                    : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-xs"
                }`}
              >
                <ClipboardPaste className="w-4 h-4 text-[#0071E3]" />
                <span>Paste Recipe</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal("EXCEL")}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-2xl border transition cursor-pointer ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.08]"
                    : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-xs"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span>Upload Excel</span>
              </button>

              <button
                type="button"
                onClick={handleStartManually}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-2xl transition shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Start Manually</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Directory Toolbar & Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-black/[0.04] dark:bg-white/[0.04] rounded-2xl border border-black/[0.06] dark:border-white/[0.06]">
              {(["ALL", "DISH", "SUB_RECIPE", "DRAFTS"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTypeFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    typeFilter === tab
                      ? "bg-[#0071E3] text-white font-semibold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {tab === "ALL"
                    ? `All (${recipes.length})`
                    : tab === "DISH"
                    ? `Dishes (${recipes.filter((r) => r.type === "DISH").length})`
                    : tab === "SUB_RECIPE"
                    ? `Sub-Recipes (${recipes.filter((r) => r.type === "SUB_RECIPE").length})`
                    : `Drafts (${recipes.filter((r) => r.isDraft).length})`}
                </button>
              ))}
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search recipe by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-500"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>
          </div>

          {/* Recipes Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((r) => (
              <div
                key={r.id}
                onClick={() => {
                  setActiveModal("NONE");
                  setEditingRecipeId(null);
                  router.push(`/restaurant/${subdomain}/inventory/recipes/${r.id}`);
                }}
                className={`p-5 rounded-3xl border transition cursor-pointer flex flex-col justify-between gap-4 hover:border-[#0071E3] group ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06] hover:bg-[#121622]/90"
                    : "bg-white border-slate-200/80 shadow-xs hover:shadow-md"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        r.type === "SUB_RECIPE"
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {r.type === "SUB_RECIPE" ? "Sub-Recipe" : "Dish"}
                    </span>

                    {r.isDraft && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Draft
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#0071E3] transition">
                    {r.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {r.description || `Batch: ${r.yieldQuantity} ${formatUnit(r.yieldUnit as any)}`}
                  </p>
                </div>

                <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Portion Cost</span>
                    <span className="font-bold font-mono text-[#0071E3]">
                      ${Number(r.costPerUnit).toFixed(2)}
                    </span>
                  </div>

                  {r.type === "DISH" && (
                    <div>
                      <span className="text-[10px] text-slate-400 block">Selling Price</span>
                      <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                        ${Number(r.sellingPrice).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {r.type === "DISH" && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Gross Margin</span>
                      <span
                        className={`font-bold font-mono ${
                          Number(r.grossMarginPercent) >= 65 ? "text-emerald-500" : "text-amber-500"
                        }`}
                      >
                        {Number(r.grossMarginPercent).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredRecipes.length === 0 && !loading && (
            <div className="py-16 text-center text-slate-400 text-xs">
              No recipes found. Create one manually, paste recipe text, or import from Excel.
            </div>
          )}
        </main>

        {/* ========================================================================= */}
        {/* MODAL 1: PASTE RECIPE WORKFLOW                                            */}
        {/* ========================================================================= */}
        {activeModal === "PASTE" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div
              className={`w-full max-w-2xl rounded-3xl border shadow-2xl p-6 space-y-4 ${
                isDark ? "bg-[#0F131D] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="w-5 h-5 text-[#0071E3]" />
                  <h3 className="font-bold text-sm">Paste Kitchen Recipe</h3>
                </div>
                <button
                  onClick={() => setActiveModal("NONE")}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paste recipe text from messages, Word, web, or emails. The kitchen parser extracts title, yield, ingredients (fractions, metric/US units, ladles, cans), and notes.
              </p>

              {pasteError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                  {pasteError}
                </div>
              )}

              <textarea
                rows={10}
                placeholder={`Signature Truffle Burger\nYield: 4 servings\nPrep Time: 20 mins\n\nIngredients:\n- 1½ lb Roma tomatoes, diced\n- 2 x 400 g cans chopped tomatoes\n- 1 cup + 2 tbsp cream\n- 2 ladles house gravy\n- 2–3 cloves garlic\n- Salt to taste\n\nInstructions:\n1. Sear patties on high heat.\n2. Simmer sauce with garlic and gravy.`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className={`w-full p-3 font-mono text-xs rounded-2xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                  isDark
                    ? "bg-white/[0.03] border-white/[0.08] text-white placeholder-slate-600"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                }`}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal("NONE")}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isParsingText || !pasteText.trim()}
                  onClick={handleParsePastedText}
                  className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {isParsingText ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Parsing Recipe...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Extract into Workspace</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: EXCEL IMPORT WORKFLOW                                            */}
        {/* ========================================================================= */}
        {activeModal === "EXCEL" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div
              className={`w-full max-w-3xl rounded-3xl border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto ${
                isDark ? "bg-[#0F131D] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-sm">Upload Recipes from Excel or CSV</h3>
                </div>
                <button
                  onClick={() => {
                    setActiveModal("NONE");
                    setExcelFile(null);
                    setExcelPreview(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              {!excelPreview ? (
                <form onSubmit={handleUploadExcelFile} className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 text-xs">
                    <span className="text-[#0071E3] font-medium">
                      Need the standard column format? Download our Excel workbook template.
                    </span>
                    <a
                      href="/api/restaurant/inventory/recipes/template"
                      download
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0071E3] text-white rounded-xl font-semibold shadow-xs hover:bg-[#0077ED]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Template</span>
                    </a>
                  </div>

                  {excelError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                      {excelError}
                    </div>
                  )}

                  <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-center space-y-3">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="text-xs">
                      <label className="font-bold text-[#0071E3] hover:underline cursor-pointer">
                        Choose Excel (.xlsx) or CSV file
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                      <span className="text-slate-500 dark:text-slate-400 block mt-1">
                        {excelFile ? excelFile.name : "or drag and drop here"}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveModal("NONE")}
                      className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessingExcel || !excelFile}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      {isProcessingExcel ? "Processing..." : "Preview Import"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">
                      Parsed {excelPreview.groupedRecipes?.length || 0} Recipe(s) from sheet "{excelPreview.selectedSheet}"
                    </span>
                    <button
                      onClick={() => setExcelPreview(null)}
                      className="text-[#0071E3] hover:underline cursor-pointer"
                    >
                      Choose another file
                    </button>
                  </div>

                  {/* Duplicate Handling Selector */}
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                    <span>If recipe name already exists in restaurant:</span>
                    <select
                      value={duplicateAction}
                      onChange={(e) => setDuplicateAction(e.target.value as any)}
                      className="px-2.5 py-1 text-xs rounded-xl border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    >
                      <option value="CREATE_AS_DRAFT">Create as Draft Copy</option>
                      <option value="UPDATE">Update Existing</option>
                      <option value="SKIP">Skip Existing</option>
                    </select>
                  </div>

                  {/* Grouped Recipes Preview */}
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {excelPreview.groupedRecipes?.map((grp: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border ${
                          grp.isExisting
                            ? "bg-amber-500/[0.04] border-amber-500/30"
                            : isDark
                            ? "bg-white/[0.02] border-white/[0.06]"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">{grp.recipeName}</span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#0071E3]/10 text-[#0071E3]">
                              {grp.recipeType}
                            </span>
                            {grp.isExisting && (
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600">
                                Existing
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400">
                            {grp.rows?.length || 0} ingredient lines • Yield: {grp.batchYield} {grp.yieldUnit}
                          </span>
                        </div>

                        <div className="space-y-1">
                          {grp.rows?.map((r: any, rIdx: number) => (
                            <div
                              key={rIdx}
                              className="text-[11px] flex items-center justify-between py-0.5 border-b border-black/[0.04] dark:border-white/[0.04]"
                            >
                              <div className="flex items-center gap-2">
                                <span>{r.quantity} {formatUnit(r.unit as any)}</span>
                                <span className="font-medium">{r.ingredientNameOrSku}</span>
                                {r.prepLossPercent > 0 && (
                                  <span className="text-[10px] text-amber-500">(-{r.prepLossPercent}% loss)</span>
                                )}
                              </div>
                              <div>
                                {r.matchedComponent ? (
                                  <span className="text-emerald-500 text-[10px] flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>Matched: {r.matchedComponent.name}</span>
                                  </span>
                                ) : (
                                  <span className="text-amber-500 text-[10px]">Unmatched (Draft)</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveModal("NONE")}
                      className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingExcel}
                      onClick={handleCommitExcelImport}
                      className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
                    >
                      {isProcessingExcel ? "Importing Drafts..." : "Confirm & Import as Drafts"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: UNIFIED RECIPE WORKSPACE (EXPANSIVE STUDIO WITH FROZEN FOOTER)   */}
        {/* ========================================================================= */}
        {activeModal === "WORKSPACE" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 md:p-5 bg-black/70 backdrop-blur-md animate-in fade-in">
            <div
              className={`w-full h-full sm:h-[95vh] sm:max-w-6xl xl:max-w-7xl sm:rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden ${
                isDark ? "bg-[#090B10] text-white" : "bg-white text-slate-900"
              }`}
            >
              {/* Frozen Header */}
              <div className="shrink-0 px-4 sm:px-7 py-3.5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-white/95 dark:bg-[#090B10]/95 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base">
                        {editingRecipeId ? "Edit Recipe Formulation" : "Unified Recipe Workspace"}
                      </h3>
                      {formIsDraft ? (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Draft Mode
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Active Recipe
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                      Formula ingredients, kitchen shrinkage, and dynamic food costing.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetWorkspace}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                  title="Close Workspace"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-6">
                {/* Recipe Meta Details (Type, Name, Yield, Instructions) */}
                <div className="space-y-4">
                  {/* Type Selector Toggle */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormType("DISH")}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
                        formType === "DISH"
                          ? "bg-[#0071E3]/10 border-[#0071E3] text-[#0071E3] shadow-xs"
                          : isDark
                          ? "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/[0.12]"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <UtensilsCrossed className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Menu Dish</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Sold directly via POS & Catering with selling price & gross margin.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormType("SUB_RECIPE")}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition cursor-pointer ${
                        formType === "SUB_RECIPE"
                          ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400 shadow-xs"
                          : isDark
                          ? "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/[0.12]"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Layers className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Sub-Recipe (Prep Batch)</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Batch prep (sauces, marinades, doughs) reused inside dishes.
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Name, Yield & Units */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Recipe Title *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Signature Truffle Burger, Tikka Base Gravy"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                          isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white border-slate-200"
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Batch Yield Qty *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.1"
                        value={formYieldQty}
                        onChange={(e) => setFormYieldQty(e.target.value)}
                        className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                          isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white border-slate-200"
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Yield Unit *
                      </label>
                      <select
                        value={formYieldUnit}
                        onChange={(e) => setFormYieldUnit(e.target.value)}
                        className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                          isDark ? "bg-[#0F131D] border-white/[0.08]" : "bg-white border-slate-200"
                        }`}
                      >
                        {CULINARY_UOM_GROUPS.map((g) => (
                          <optgroup key={g.group} label={g.group}>
                            {g.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Serving Size (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 450g, 250ml, 2 pcs"
                        value={formServingSize}
                        onChange={(e) => setFormServingSize(e.target.value)}
                        className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                          isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white border-slate-200"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Instructions Collapsible Area */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Preparation Instructions (Method & Steps)
                    </label>
                    <textarea
                      rows={3}
                      placeholder={`1. Sear patties on high heat for 3 minutes.\n2. Simmer tomatoes with garlic and house gravy.`}
                      value={formInstructions}
                      onChange={(e) => setFormInstructions(e.target.value)}
                      className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                        isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white border-slate-200"
                      }`}
                    />
                  </div>
                </div>

                {/* Real-Time Costing & Food Cost Simulator */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200/90"
                  }`}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Batch Total Cost</span>
                      <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                        ${calculatedTotalBatchCost.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Cost per Portion</span>
                      <span className="text-base font-bold font-mono text-[#0071E3]">
                        ${calculatedCostPerPortion.toFixed(2)}
                      </span>
                    </div>

                    {formType === "DISH" && (
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Selling Price ($)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formSellingPrice}
                          onChange={(e) => setFormSellingPrice(e.target.value)}
                          className={`w-28 px-2 py-1 text-xs font-mono font-bold rounded-lg border mt-0.5 ${
                            isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white border-slate-200"
                          }`}
                        />
                      </div>
                    )}

                    {formType === "DISH" && (
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Gross Margin %</span>
                        <span
                          className={`text-base font-bold font-mono ${
                            currentGrossMargin >= 65 ? "text-emerald-500" : "text-amber-500"
                          }`}
                        >
                          {currentGrossMargin > 0 ? `${currentGrossMargin.toFixed(1)}%` : "0.0%"}
                        </span>
                      </div>
                    )}
                  </div>

                  {formType === "DISH" && (
                    <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px]">Target Food Cost %:</span>
                        <input
                          type="number"
                          min="5"
                          max="90"
                          value={targetFoodCostPercent}
                          onChange={(e) => setTargetFoodCostPercent(e.target.value)}
                          className="w-14 px-2 py-0.5 text-xs font-mono rounded-lg border text-center"
                        />
                        <span className="text-slate-400 text-[11px]">
                          ➔ Suggested Price: <strong className="text-slate-900 dark:text-white font-mono">${suggestedSellingPrice.toFixed(2)}</strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleApplySuggestedPrice}
                        className="px-3 py-1 bg-[#0071E3]/15 text-[#0071E3] font-semibold rounded-lg hover:bg-[#0071E3]/25 transition text-xs cursor-pointer"
                      >
                        Apply Suggested Price (${suggestedSellingPrice.toFixed(2)})
                      </button>
                    </div>
                  )}
                </div>

                {/* Unresolved Issues Alert Banner */}
                {unresolvedItems.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{unresolvedItems.length} Unresolved Line(s) in Recipe</span>
                    </div>
                    <p className="text-[11px] pl-6 text-amber-700/80 dark:text-amber-300/80">
                      Lines marked "to taste", ranges (e.g. 2–3), or unlinked stock items must be resolved with exact quantities before this recipe can be published. You can safely save as Draft at any time.
                    </p>
                  </div>
                )}

                {/* Ingredient Formulation Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Formula Ingredients & Kitchen Loss
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Define raw inventory components, linked prep sub-recipes, packaging, and yield loss.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white transition shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Ingredient</span>
                    </button>
                  </div>

                  {/* Desktop Table Column Header Bar */}
                  <div className="hidden md:grid grid-cols-12 gap-2.5 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-black/[0.04] dark:border-white/[0.04] items-center">
                    <div className="col-span-4">Stock Item / Sub-Recipe</div>
                    <div className="col-span-2">Purchase Pack</div>
                    <div className="col-span-1 text-center">Usable Qty</div>
                    <div className="col-span-2">Recipe Unit</div>
                    <div className="col-span-1 text-center">Loss %</div>
                    <div className="col-span-2 text-right">Gross Qty & Line Cost</div>
                  </div>

                  <div className="space-y-2.5">
                    {formItems.map((row, idx) => {
                      const rowCost = computeFormRowCost(row);
                      const matchedItem = row.inventoryItemId
                        ? inventoryItems.find((i) => i.id === row.inventoryItemId)
                        : null;
                      const availablePacks = matchedItem?.purchasePacks || [];

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-2xl border transition ${
                            row.isUnresolved
                              ? "bg-amber-500/[0.04] border-amber-500/30"
                              : isDark
                              ? "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]"
                              : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {/* Original Text / Warning Banner */}
                          {row.originalText && (
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pb-2 mb-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                              <span className="truncate">
                                Original text: <code className="text-[#0071E3] font-mono">{row.originalText}</code>
                              </span>
                              {row.isUnresolved && (
                                <span className="text-amber-500 font-semibold text-[10px] shrink-0 ml-2">
                                  {row.unresolvedReason || "Action required"}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                              {/* 1. Component Type & Link (4 cols) */}
                              <div className="md:col-span-4">
                                <label className="block md:hidden text-[10px] font-bold text-slate-500 mb-1">
                                  Stock Item / Sub-Recipe *
                                </label>
                                <div className="flex gap-1.5 items-center">
                                  <select
                                    value={row.componentType}
                                    onChange={(e) =>
                                      handleItemRowChange(idx, "componentType", e.target.value)
                                    }
                                    className={`w-20 shrink-0 px-2 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                                      isDark
                                        ? "bg-[#121622] border-white/[0.1] text-slate-200"
                                        : "bg-slate-50 border-slate-200 text-slate-700"
                                    }`}
                                  >
                                    <option value="INVENTORY_ITEM">Item</option>
                                    <option value="SUB_RECIPE">Sub-Rec</option>
                                  </select>

                                  {row.componentType === "INVENTORY_ITEM" ? (
                                    <select
                                      value={row.inventoryItemId || ""}
                                      onChange={(e) =>
                                        handleItemRowChange(idx, "inventoryItemId", e.target.value)
                                      }
                                      className={`flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] truncate ${
                                        isDark ? "bg-[#0F131D] border-white/[0.08]" : "bg-white border-slate-200"
                                      }`}
                                    >
                                      <option value="">Select inventory item...</option>
                                      {inventoryItems.map((inv) => (
                                        <option key={inv.id} value={inv.id}>
                                          {inv.name} ({inv.unitOfMeasure}) - ${Number(inv.costPerUnit).toFixed(2)}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <select
                                      value={row.subRecipeId || ""}
                                      onChange={(e) =>
                                        handleItemRowChange(idx, "subRecipeId", e.target.value)
                                      }
                                      className={`flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] truncate ${
                                        isDark ? "bg-[#0F131D] border-white/[0.08]" : "bg-white border-slate-200"
                                      }`}
                                    >
                                      <option value="">Select sub-recipe...</option>
                                      {subRecipesList.map((sub) => (
                                        <option key={sub.id} value={sub.id}>
                                          {sub.name} (Yield: {sub.yieldQuantity} {sub.yieldUnit}) - ${Number(sub.costPerUnit).toFixed(2)}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>

                              {/* 2. Purchase Pack Selector (2 cols) */}
                              <div className="md:col-span-2">
                                <label className="block md:hidden text-[10px] font-bold text-slate-500 mb-1">
                                  Purchase Pack
                                </label>
                                {row.componentType === "SUB_RECIPE" ? (
                                  <div className="w-full px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] truncate">
                                    Batch Yield Base
                                  </div>
                                ) : availablePacks.length > 0 ? (
                                  <select
                                    value={row.packId || ""}
                                    onChange={(e) => handleItemRowChange(idx, "packId", e.target.value)}
                                    className={`w-full px-2 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] truncate ${
                                      isDark ? "bg-[#0F131D] border-white/[0.08]" : "bg-white border-slate-200"
                                    }`}
                                  >
                                    <option value="">Base ({matchedItem?.unitOfMeasure})</option>
                                    {availablePacks.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} ({p.conversionFactor} {p.packUnit})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="w-full px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] truncate">
                                    Base ({matchedItem?.unitOfMeasure || "Unit"})
                                  </div>
                                )}
                              </div>

                              {/* 3. Usable Quantity (1 col) */}
                              <div className="md:col-span-1">
                                <label className="block md:hidden text-[10px] font-bold text-slate-500 mb-1">
                                  {row.packId ? "Packs" : "Usable Qty"}
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={row.packId ? row.packQuantity || "" : row.quantity}
                                  onChange={(e) =>
                                    handleItemRowChange(
                                      idx,
                                      row.packId ? "packQuantity" : "quantity",
                                      e.target.value
                                    )
                                  }
                                  className={`w-full px-2 py-1.5 text-xs font-mono font-semibold rounded-xl border text-center focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                                    isDark ? "bg-[#0F131D] border-white/[0.08]" : "bg-white border-slate-200"
                                  }`}
                                />
                              </div>

                              {/* 4. Unit of Measure (2 cols) */}
                              <div className="md:col-span-2">
                                <label className="block md:hidden text-[10px] font-bold text-slate-500 mb-1">
                                  Recipe Unit
                                </label>
                                <select
                                  value={row.unitOfMeasure}
                                  onChange={(e) =>
                                    handleItemRowChange(idx, "unitOfMeasure", e.target.value)
                                  }
                                  className={`w-full px-2 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] truncate ${
                                    isDark ? "bg-[#0F131D] border-white/[0.08]" : "bg-white border-slate-200"
                                  }`}
                                >
                                  {CULINARY_UOM_GROUPS.map((g) => (
                                    <optgroup key={g.group} label={g.group}>
                                      {g.options.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>

                              {/* 5. Prep Loss % (Shrinkage) (1 col) */}
                              <div className="md:col-span-1">
                                <label className="block md:hidden text-[10px] font-bold text-slate-500 mb-1 truncate">
                                  Loss %
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={row.wastagePercent}
                                  onChange={(e) =>
                                    handleItemRowChange(idx, "wastagePercent", e.target.value)
                                  }
                                  className={`w-full px-1.5 py-1.5 text-xs font-mono rounded-xl border text-center focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                                    isDark ? "bg-[#0F131D] border-white/[0.08]" : "bg-white border-slate-200"
                                  }`}
                                />
                              </div>

                              {/* 6. Gross Stock Quantity & Line Cost (2 cols) */}
                              <div className="md:col-span-2 text-right">
                                <span className="text-[10px] text-slate-400 block truncate font-mono">
                                  Gross: {rowCost.grossQty.toFixed(2)} {formatUnit(row.unitOfMeasure as any)}
                                </span>
                                <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                  ${rowCost.lineTotal.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Delete Action (Fixed right, never breaks row alignment) */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              disabled={formItems.length === 1}
                              title="Remove ingredient line"
                              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-20 cursor-pointer transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Ladle or Container Note */}
                          {row.ladleInfo && (
                            <div className="text-[10px] text-[#0071E3] mt-2 flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              <span>{row.ladleInfo}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Frozen / Fixed Action Footer (Save from anywhere!) */}
              <div className="shrink-0 px-4 sm:px-7 py-3.5 border-t border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-[#090B10]/95 backdrop-blur-md z-20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
                {/* Live Metrics & Status Banner */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] text-xs">
                    <span className="text-slate-500 text-[11px]">Batch:</span>
                    <strong className="font-mono text-slate-900 dark:text-white">
                      ${calculatedTotalBatchCost.toFixed(2)}
                    </strong>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-slate-500 text-[11px]">Portion:</span>
                    <strong className="font-mono text-[#0071E3]">
                      ${calculatedCostPerPortion.toFixed(2)}
                    </strong>
                    {formType === "DISH" && currentGrossMargin > 0 && (
                      <>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <span className="text-slate-500 text-[11px]">Margin:</span>
                        <strong
                          className={`font-mono ${
                            currentGrossMargin >= 65 ? "text-emerald-500" : "text-amber-500"
                          }`}
                        >
                          {currentGrossMargin.toFixed(1)}%
                        </strong>
                      </>
                    )}
                  </div>

                  <div className="text-xs">
                    {unresolvedItems.length > 0 ? (
                      <span className="text-amber-500 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{unresolvedItems.length} issue(s) remaining (Save as Draft available)</span>
                      </span>
                    ) : (
                      <span className="text-emerald-500 font-semibold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Ready to publish</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={resetWorkspace}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveRecipe(true)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    {submitting ? "Saving..." : "Save as Draft"}
                  </button>

                  <button
                    type="button"
                    disabled={submitting || unresolvedItems.length > 0}
                    onClick={() => handleSaveRecipe(false)}
                    className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
                  >
                    {submitting ? "Publishing..." : "Publish Recipe"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
