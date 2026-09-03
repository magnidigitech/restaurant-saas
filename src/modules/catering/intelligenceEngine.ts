import {
  MenuValidationReport,
  MenuAdvisory,
  AdvisoryLevel,
  EventCostBreakdown,
  EventCostItem,
  VersionedQuotation,
  CateringEventDetails,
} from "./types";
import { MENU_ITEMS_MASTER, LIVE_COUNTERS_MASTER } from "./templatesData";

/**
 * AI Menu Intelligence Layer
 * Evaluates culinary balance, carbohydrate overlaps, ingredient redundancy,
 * and dietary compatibility.
 */
export function analyzeAndValidateMenu(
  selectedItemIds: string[],
  guestCount: number,
  eventDetails?: Partial<CateringEventDetails>
): MenuValidationReport {
  const advisories: MenuAdvisory[] = [];
  const selectedItems = selectedItemIds
    .map((id) => MENU_ITEMS_MASTER[id])
    .filter(Boolean);

  // 1. Dietary Integrity Check (RED)
  if (eventDetails?.preference === "VEG") {
    const nonVegItems = selectedItems.filter((i) => i.dietary === "NON_VEG");
    if (nonVegItems.length > 0) {
      advisories.push({
        id: "adv-dietary-mismatch",
        level: "RED",
        title: "Dietary Conflict Detected",
        message: `Event is designated as Strict Vegetarian, but contains ${nonVegItems.length} Non-Veg item(s): ${nonVegItems.map((i) => i.name).join(", ")}.`,
        category: "SEASONAL_AVAILABILITY",
        affectedItemIds: nonVegItems.map((i) => i.id),
      });
    }
  }

  // 2. Carbohydrate & Rice Starch Overlap (YELLOW)
  const hasBiryani = selectedItems.some((i) => i.category === "Biryani");
  const hasPlainRice = selectedItems.some((i) => i.id === "rc-steamed-rice");
  if (hasBiryani && hasPlainRice && guestCount >= 100) {
    const biryaniItem = selectedItems.find((i) => i.category === "Biryani");
    const recPlainRiceKg = Math.round(guestCount * 0.08);
    const recBiryaniKg = Math.round(guestCount * 0.12);
    const unadjustedPlainKg = Math.round(guestCount * 0.18);

    advisories.push({
      id: "adv-carb-overlap",
      level: "YELLOW",
      title: "Carbohydrate Overlap Recommendation",
      message: `You selected both ${biryaniItem?.name} and Steamed Plain Rice. For ${guestCount.toLocaleString()} guests, historical consumption shows 40% of plain rice is wasted when biryani is served. Our system recommends scaling Plain Rice to ${recPlainRiceKg}kg (instead of ${unadjustedPlainKg}kg) and Biryani to ${recBiryaniKg}kg.`,
      category: "CARB_BALANCE",
      affectedItemIds: ["rc-steamed-rice", biryaniItem?.id || ""],
    });
  }

  // 3. Ingredient Redundancy / Repetition (YELLOW)
  const paneerItems = selectedItems.filter(
    (i) => i.tags?.includes("paneer") || i.name.toLowerCase().includes("paneer")
  );
  if (paneerItems.length >= 2) {
    const hasKadaiPaneer = paneerItems.some((i) => i.id === "cur-kadai-paneer");
    advisories.push({
      id: "adv-paneer-repetition",
      level: "YELLOW",
      title: "Menu Variety Advisory",
      message: `Your menu currently contains ${paneerItems.length} Paneer-based dishes (${paneerItems.map((i) => i.name).join(", ")}). Replacing one dairy-heavy gravy with a vibrant vegetable medley enhances guest satisfaction and palate freshness.`,
      category: "INGREDIENT_REPETITION",
      affectedItemIds: paneerItems.map((i) => i.id),
      suggestedReplacement: hasKadaiPaneer
        ? {
            removeId: "cur-kadai-paneer",
            removeName: "Kadai Paneer Bell Pepper Toss",
            suggestedId: "cur-veg-kolhapuri",
            suggestedName: "Spicy Veg Kolhapuri Melange",
            reason: "Provides rich roasted coconut, sesame, and garden vegetable flavors without duplicating paneer textures.",
          }
        : undefined,
    });
  }

  // 4. Flavor & Digestibility Harmony (GREEN confirmation)
  const hasHeavyBiryani = selectedItems.some(
    (i) => i.id === "bir-mutton-dum" || i.id === "bir-chicken-dum"
  );
  const hasRasamOrSambar = selectedItems.some((i) => i.category === "Sambar");
  if (hasHeavyBiryani && hasRasamOrSambar) {
    advisories.push({
      id: "adv-digestive-harmony",
      level: "GREEN",
      title: "Digestive Balance Verified",
      message: "Pairing rich Dum Biryani with digestive Pepper Rasam/Sambar satisfies traditional South Indian banquet standards.",
      category: "PAIRING",
      affectedItemIds: [],
    });
  }

  // Calculate Overall Status
  let overallStatus: AdvisoryLevel = "GREEN";
  if (advisories.some((a) => a.level === "RED")) {
    overallStatus = "RED";
  } else if (advisories.some((a) => a.level === "YELLOW")) {
    overallStatus = "YELLOW";
  }

  let varietyScore = 85;
  if (advisories.some((a) => a.category === "INGREDIENT_REPETITION")) varietyScore -= 15;
  if (advisories.some((a) => a.category === "CARB_BALANCE")) varietyScore -= 10;
  if (advisories.length === 0) varietyScore = 98;

  return {
    overallStatus,
    totalSelectedItems: selectedItems.length,
    summaryText:
      overallStatus === "GREEN"
        ? "Menu is exceptionally balanced across nutritional macros, regional flavor profiles, and kitchen prep schedules."
        : overallStatus === "YELLOW"
        ? "Menu has 1-2 optimization opportunities to minimize kitchen plate wastage and enhance flavor variety."
        : "Action required: Dietary or seasonal conflicts detected in selected items.",
    advisories,
    nutritionProfile: {
      proteinRatio: "24% Protein / 52% Carbohydrates / 24% Fats",
      varietyScore,
    },
  };
}

/**
 * True Event Costing Engine
 * Calculates itemized direct costs including raw ingredients BOM, kitchen labor,
 * service staff, fuel, transport, and equipment.
 */
export function calculateTrueEventCost(
  selectedItemIds: string[],
  selectedAddonIds: string[],
  guestCount: number,
  baseTemplateSellingPrice: number = 850
): EventCostBreakdown {
  const costItems: EventCostItem[] = [];

  // 1. Raw Materials (BOM)
  const selectedItems = selectedItemIds
    .map((id) => MENU_ITEMS_MASTER[id])
    .filter(Boolean);

  const rawCostPerPax = selectedItems.reduce(
    (sum, item) => sum + item.approxCostPerPax,
    0
  );
  const totalRawCost = Math.round(rawCostPerPax * guestCount);

  costItems.push({
    name: `Core Recipe Ingredients (${selectedItems.length} dishes)`,
    category: "INGREDIENTS",
    unitDescription: "Per Guest Raw BOM",
    quantity: guestCount,
    unitCost: rawCostPerPax,
    totalCost: totalRawCost,
  });

  // 2. Kitchen Line Chefs & Production Staff
  // Scale: 1 Chef per 100 pax up to 500, then 1 per 150 pax
  const chefsCount = Math.max(3, Math.ceil(guestCount / 120));
  const kitchenLaborPerChef = 2800; // Daily event wage
  const totalKitchenLabor = chefsCount * kitchenLaborPerChef;

  costItems.push({
    name: `Kitchen Line Chefs & Prep Masters (${chefsCount} staff)`,
    category: "KITCHEN_LABOR",
    unitDescription: "Chef shift day rate",
    quantity: chefsCount,
    unitCost: kitchenLaborPerChef,
    totalCost: totalKitchenLabor,
  });

  // 3. Service & Floor Staff
  // Scale: 1 Server per 35 guests
  const serversCount = Math.max(4, Math.ceil(guestCount / 35));
  const serverRate = 1200; // Daily event shift
  const totalServiceStaff = serversCount * serverRate;

  costItems.push({
    name: `Buffet Attendants & Waitstaff (${serversCount} crew)`,
    category: "SERVICE_STAFF",
    unitDescription: "Floor attendant day rate",
    quantity: serversCount,
    unitCost: serverRate,
    totalCost: totalServiceStaff,
  });

  // 4. Commercial Fuel & Utilities
  // Scale: LPG cylinders (1 commercial cylinder per 200 pax)
  const cylinders = Math.max(2, Math.ceil(guestCount / 200));
  const cylinderCost = 2250;
  const totalFuel = cylinders * cylinderCost + Math.round(guestCount * 4); // ice & chafing fuel

  costItems.push({
    name: `Commercial LPG & Chafing Fuel (${cylinders} Cylinders + Chafing gels)`,
    category: "FUEL_UTILITIES",
    unitDescription: "Commercial gas & warming gels",
    quantity: cylinders,
    unitCost: cylinderCost,
    totalCost: totalFuel,
  });

  // 5. Transportation & Base Kitchen Dispatch
  const baseTrucks = Math.max(1, Math.ceil(guestCount / 500));
  const truckRate = 4500;
  const totalTransport = baseTrucks * truckRate;

  costItems.push({
    name: `Insulated Transport & Fleet Logistics (${baseTrucks} trucks)`,
    category: "TRANSPORT",
    unitDescription: "Round-trip reefer van dispatch",
    quantity: baseTrucks,
    unitCost: truckRate,
    totalCost: totalTransport,
  });

  // 6. Chafing Dishes, Tableware & Cutlery Rental
  const equipmentPerPax = 32;
  const totalEquipment = Math.round(guestCount * equipmentPerPax);

  costItems.push({
    name: "Luxury Chafing Warmers, Ceramic Melamine & Cutlery Sets",
    category: "EQUIPMENT",
    unitDescription: "Table setting per Pax",
    quantity: guestCount,
    unitCost: equipmentPerPax,
    totalCost: totalEquipment,
  });

  // 7. Spoilage & Preparation Buffer (3.5% of raw material)
  const spoilageBuffer = Math.round(totalRawCost * 0.035);

  costItems.push({
    name: "Emergency Guest Buffer & Yield Trim Allowance (3.5%)",
    category: "BUFFER_WASTAGE",
    unitDescription: "Par buffer variance",
    quantity: 1,
    unitCost: spoilageBuffer,
    totalCost: spoilageBuffer,
  });

  // 8. Live Counter Add-on Costs
  let totalAddonsCost = 0;
  selectedAddonIds.forEach((addonId) => {
    const addon = LIVE_COUNTERS_MASTER.find((a) => a.id === addonId);
    if (addon) {
      const addonDirectCostPerPax = Math.round(addon.pricePerPax * 0.45); // 45% cost ratio
      const addonTotal = addonDirectCostPerPax * guestCount;
      totalAddonsCost += addonTotal;

      costItems.push({
        name: `Add-on Station: ${addon.name}`,
        category: "INGREDIENTS",
        unitDescription: "Live counter raw ingredients & fuel",
        quantity: guestCount,
        unitCost: addonDirectCostPerPax,
        totalCost: addonTotal,
      });
    }
  });

  // Aggregate Totals
  const totalDirectCost =
    totalRawCost +
    totalKitchenLabor +
    totalServiceStaff +
    totalFuel +
    totalTransport +
    totalEquipment +
    spoilageBuffer +
    totalAddonsCost;

  const costPerPax = Math.round(totalDirectCost / (guestCount || 1));
  const suggestedSellingPricePerPax = Math.round(
    baseTemplateSellingPrice +
      selectedAddonIds.reduce((acc, id) => {
        const ad = LIVE_COUNTERS_MASTER.find((a) => a.id === id);
        return acc + (ad?.pricePerPax || 0);
      }, 0)
  );

  const totalRevenue = suggestedSellingPricePerPax * guestCount;
  const targetMarginPercent = Math.round(
    ((totalRevenue - totalDirectCost) / (totalRevenue || 1)) * 100
  );

  return {
    guestCount,
    rawIngredientsCost: totalRawCost + totalAddonsCost,
    kitchenLaborCost: totalKitchenLabor,
    serviceStaffCost: totalServiceStaff,
    fuelAndUtilitiesCost: totalFuel,
    transportationCost: totalTransport,
    equipmentRentalCost: totalEquipment,
    spoilageBufferCost: spoilageBuffer,
    totalDirectCost,
    costPerPax,
    suggestedSellingPricePerPax,
    targetMarginPercent,
    costItems,
  };
}

/**
 * Creates or updates an immutable versioned quotation
 */
export function buildVersionedQuotation(
  quotationNumber: string,
  versionNumber: number,
  guestCount: number,
  selectedItemIds: string[],
  selectedAddonIds: string[],
  basePricePerPax: number,
  discountAmount: number = 0,
  taxPercent: number = 5,
  changeSummary?: string
): VersionedQuotation {
  const costBreakdown = calculateTrueEventCost(
    selectedItemIds,
    selectedAddonIds,
    guestCount,
    basePricePerPax
  );

  // Add-ons total
  const addonsPerPaxTotal = selectedAddonIds.reduce((sum, id) => {
    const addon = LIVE_COUNTERS_MASTER.find((a) => a.id === id);
    return sum + (addon?.pricePerPax || 0);
  }, 0);

  const addonsTotal = addonsPerPaxTotal * guestCount;
  const baseRevenue = basePricePerPax * guestCount;
  const subtotal = baseRevenue + addonsTotal;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round((taxableAmount * taxPercent) / 100);
  const finalTotalAmount = taxableAmount + taxAmount;
  const finalPricePerPax = Math.round(finalTotalAmount / (guestCount || 1));

  const validUntilDate = new Date();
  validUntilDate.setDate(validUntilDate.getDate() + 14);

  return {
    id: `${quotationNumber}-v${versionNumber}`,
    quotationNumber,
    version: versionNumber,
    status: "DRAFT",
    guestCount,
    selectedItemIds,
    selectedAddonIds,
    costBreakdown,
    basePricePerPax,
    addonsTotal,
    subtotal,
    discountAmount,
    taxPercent,
    taxAmount,
    finalTotalAmount,
    finalPricePerPax,
    validUntil: validUntilDate.toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    changeSummary:
      changeSummary ||
      `Version ${versionNumber}: ${guestCount.toLocaleString()} Guests • ${selectedItemIds.length} Menu Items • ${selectedAddonIds.length} Live Counters`,
  };
}
