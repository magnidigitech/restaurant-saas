export type CateringMealType = "BREAKFAST" | "LUNCH" | "HIGH_TEA" | "DINNER";
export type CateringFoodPreference = "VEG" | "NON_VEG" | "BOTH";

export interface CateringCustomer {
  name: string;
  phone: string;
  email?: string;
  organization?: string;
  address?: string;
}

export interface CateringEventDetails {
  id?: string;
  eventName: string; // e.g. "Daughter's Wedding", "Annual Tech Summit"
  eventType: string; // "WEDDING", "ENGAGEMENT", "RECEPTION", "CORPORATE", "BIRTHDAY", "HOUSEWARMING", "CUSTOM"
  eventDate: string;
  eventTime?: string;
  guestCount: number; // e.g. 1000
  venue: string; // e.g. "Guntur Royal Palace"
  mealType: CateringMealType;
  preference: CateringFoodPreference;
  serviceType: "FULL_CATERING" | "BUFFET_ONLY" | "DELIVERY_ONLY" | "LIVE_STATIONS_ONLY";
  customer: CateringCustomer;
  notes?: string;
}

export interface MenuItemOption {
  id: string;
  name: string;
  category: string; // "Welcome Drink", "Starter", "Biryani", "Curry", "Rice", "Dal", "Sambar", "Sweet", "Ice Cream", etc.
  dietary: "VEG" | "NON_VEG";
  description?: string;
  internalRecipeId?: string;
  basePortionPerPax: number; // e.g. 0.25 kg or 0.15 L
  portionUnit: string; // "kg", "L", "pcs", "portions"
  approxCostPerPax: number; // raw material cost estimation
  spiceLevel?: "MILD" | "MEDIUM" | "SPICY";
  tags?: string[]; // e.g. ["paneer", "carb-heavy", "signature", "traditional"]
}

export interface TemplateCategoryRule {
  category: string;
  minSelections: number;
  maxSelections: number;
  availableItems: MenuItemOption[];
}

export interface SmartMenuTemplate {
  id: string;
  name: string; // e.g. "Wedding Lunch – Premium"
  description: string;
  applicableEventTypes: string[]; // ["WEDDING", "RECEPTION"]
  applicableMealTypes: CateringMealType[];
  basePricePerPax: number;
  categoryRules: TemplateCategoryRule[];
}

export interface LiveCounterAddon {
  id: string;
  name: string; // e.g. "Live Dosa Counter", "Pani Puri Station", "Arabian Mandi"
  category: "LIVE_STATION" | "DESSERT_BAR" | "BEVERAGE_BAR" | "SPECIAL_DISH";
  pricePerPax: number; // e.g. ₹60 / pax or fixed fee
  isFixedPrice?: boolean;
  fixedCost?: number;
  minPax?: number;
  description: string;
  equipmentNeeded: string[];
  dietary: "VEG" | "NON_VEG" | "BOTH";
}

export type AdvisoryLevel = "GREEN" | "YELLOW" | "RED";

export interface MenuAdvisory {
  id: string;
  level: AdvisoryLevel;
  title: string;
  message: string;
  category: "CARB_BALANCE" | "INGREDIENT_REPETITION" | "PAIRING" | "SEASONAL_AVAILABILITY" | "PORTION_OVERLAP";
  affectedItemIds: string[];
  suggestedReplacement?: {
    removeId: string;
    removeName: string;
    suggestedId: string;
    suggestedName: string;
    reason: string;
  };
}

export interface MenuValidationReport {
  overallStatus: AdvisoryLevel;
  totalSelectedItems: number;
  summaryText: string;
  advisories: MenuAdvisory[];
  nutritionProfile?: {
    proteinRatio: string;
    varietyScore: number; // 0 - 100
  };
}

export interface EventCostItem {
  name: string;
  category: "INGREDIENTS" | "KITCHEN_LABOR" | "SERVICE_STAFF" | "FUEL_UTILITIES" | "TRANSPORT" | "EQUIPMENT" | "BUFFER_WASTAGE";
  unitDescription: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface EventCostBreakdown {
  guestCount: number;
  rawIngredientsCost: number;
  kitchenLaborCost: number;
  serviceStaffCost: number;
  fuelAndUtilitiesCost: number;
  transportationCost: number;
  equipmentRentalCost: number;
  spoilageBufferCost: number; // e.g. 4%
  totalDirectCost: number;
  costPerPax: number;
  suggestedSellingPricePerPax: number;
  targetMarginPercent: number;
  costItems: EventCostItem[];
}

export interface VersionedQuotation {
  id: string;
  quotationNumber: string; // e.g. "QUO-2026-001"
  version: number; // 1, 2, 3...
  status: "DRAFT" | "SENT_TO_CLIENT" | "CLIENT_MODIFIED" | "APPROVED" | "REJECTED";
  guestCount: number;
  selectedItemIds: string[];
  selectedAddonIds: string[];
  costBreakdown: EventCostBreakdown;
  basePricePerPax: number;
  addonsTotal: number;
  subtotal: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  finalTotalAmount: number;
  finalPricePerPax: number;
  validUntil: string;
  notes?: string;
  createdAt: string;
  approvedAt?: string;
  changeSummary?: string; // e.g. "Increased pax from 800 to 1000, added Live Dosa Counter"
}
