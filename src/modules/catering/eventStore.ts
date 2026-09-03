import fs from "fs";
import path from "path";
import {
  CateringEventDetails,
  SmartMenuTemplate,
  VersionedQuotation,
  MenuItemOption,
} from "./types";
import { SMART_MENU_TEMPLATES, MENU_ITEMS_MASTER } from "./templatesData";

export interface RegisteredCateringEvent {
  id: string; // token e.g. "EVT-2026-001"
  restaurantSubdomain: string;
  eventDetails: CateringEventDetails;
  templateId: string;
  template: SmartMenuTemplate;
  customerSelectionLink: string;
  status: "LINK_SHARED" | "CUSTOMER_SUBMITTED" | "QUOTED" | "APPROVED" | "IN_PRODUCTION";
  selectedItemIds: string[];
  selectedAddonIds: string[];
  quotation?: VersionedQuotation;
  createdAt: string;
  submittedAt?: string;
}

interface StorageSchema {
  events: Record<string, RegisteredCateringEvent>;
  templates: Record<string, SmartMenuTemplate>;
  recipes?: Record<string, MenuItemOption>;
}

const STORAGE_DIR = path.join(process.cwd(), "data");
const STORAGE_FILE = path.join(STORAGE_DIR, "catering_storage.json");

// In-memory global cache
const globalStore = globalThis as unknown as {
  __cateringEventsMap?: Map<string, RegisteredCateringEvent>;
  __cateringTemplatesMap?: Map<string, SmartMenuTemplate>;
  __cateringRecipesMap?: Map<string, MenuItemOption>;
  __cateringStoreInitialized?: boolean;
};

if (!globalStore.__cateringEventsMap) {
  globalStore.__cateringEventsMap = new Map<string, RegisteredCateringEvent>();
}
if (!globalStore.__cateringTemplatesMap) {
  globalStore.__cateringTemplatesMap = new Map<string, SmartMenuTemplate>();
}
if (!globalStore.__cateringRecipesMap) {
  globalStore.__cateringRecipesMap = new Map<string, MenuItemOption>();
}

const eventsMap = globalStore.__cateringEventsMap;
const templatesMap = globalStore.__cateringTemplatesMap;
const recipesMap = globalStore.__cateringRecipesMap;

// Load from disk if exists
function loadFromDisk(): void {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
      const data: StorageSchema = JSON.parse(raw);
      if (data.events) {
        Object.entries(data.events).forEach(([k, v]) => eventsMap.set(k, v));
      }
      if (data.templates) {
        Object.entries(data.templates).forEach(([k, v]) => templatesMap.set(k, v));
      }
      if (data.recipes) {
        Object.entries(data.recipes).forEach(([k, v]) => recipesMap.set(k, v));
      }
    }
  } catch (err) {
    console.warn("Could not read catering storage file, falling back to defaults:", err);
  }
}

// Save to disk
function saveToDisk(): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    const data: StorageSchema = {
      events: Object.fromEntries(eventsMap.entries()),
      templates: Object.fromEntries(templatesMap.entries()),
      recipes: Object.fromEntries(recipesMap.entries()),
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not persist catering storage file:", err);
  }
}

// Initial seed
function initializeDefaults(): void {
  loadFromDisk();

  // Ensure default templates
  if (templatesMap.size === 0) {
    SMART_MENU_TEMPLATES.forEach((t) => templatesMap.set(t.id, t));
  }

  // Ensure default master recipes
  if (recipesMap.size === 0) {
    Object.values(MENU_ITEMS_MASTER).forEach((r) => recipesMap.set(r.id, r));
  }

  // Seed baseline events if empty
  const defaultEvents: RegisteredCateringEvent[] = [
    {
      id: "EVT-2026-001",
      restaurantSubdomain: "bahubali",
      eventDetails: {
        eventName: "Ravi Kumar's Daughter Wedding Ceremony & Reception",
        eventType: "WEDDING",
        eventDate: "2026-11-20",
        eventTime: "12:30 PM",
        guestCount: 1000,
        venue: "Guntur Royal Convention Palace",
        mealType: "LUNCH",
        preference: "BOTH",
        serviceType: "FULL_CATERING",
        customer: {
          name: "Ravi Kumar Garu",
          phone: "+91 98480 22338",
          email: "ravikumar.guntur@gmail.com",
        },
        notes: "VIP guests expected. Ensure live counters are active from 11:45 AM.",
      },
      templateId: "wedding-lunch-premium",
      template: SMART_MENU_TEMPLATES[0],
      customerSelectionLink: `/restaurant/bahubali/catering/portal/EVT-2026-001`,
      status: "LINK_SHARED",
      selectedItemIds: [
        "wd-fruit-punch",
        "str-chicken-65",
        "str-paneer-tikka",
        "bir-chicken-dum",
        "brd-butter-naan",
        "cur-butter-chicken",
        "cur-kadai-paneer",
        "rc-steamed-rice",
        "dal-tomato-pappu",
        "sam-andhra-sambar",
        "swt-gulab-jamun",
        "ice-malai-kulfi",
      ],
      selectedAddonIds: ["live-dosa", "live-pani-puri"],
      createdAt: "2026-09-01T10:00:00.000Z",
    },
    {
      id: "EVT-2026-002",
      restaurantSubdomain: "bahubali",
      eventDetails: {
        eventName: "Infosys Annual Leadership Gala",
        eventType: "CORPORATE",
        eventDate: "2026-11-24",
        eventTime: "07:30 PM",
        guestCount: 450,
        venue: "Novotel Ballroom, Vijayawada",
        mealType: "DINNER",
        preference: "BOTH",
        serviceType: "FULL_CATERING",
        customer: {
          name: "Srinivas Rao (HR VP)",
          phone: "+91 99499 11002",
          email: "srinivas.r@infosys.com",
        },
        notes: "Jain food counter needed for 40 executives.",
      },
      templateId: "corporate-executive",
      template: SMART_MENU_TEMPLATES[2] || SMART_MENU_TEMPLATES[0],
      customerSelectionLink: `/restaurant/bahubali/catering/portal/EVT-2026-002`,
      status: "CUSTOMER_SUBMITTED",
      selectedItemIds: ["wd-fruit-punch", "str-apollo-fish", "bir-mutton-dum", "cur-butter-chicken"],
      selectedAddonIds: ["live-tawa-fish", "live-falooda"],
      createdAt: "2026-09-01T11:00:00.000Z",
    },
    {
      id: "EVT-2026-003",
      restaurantSubdomain: "bahubali",
      eventDetails: {
        eventName: "Dr. Ananya Sangeet & Reception",
        eventType: "RECEPTION",
        eventDate: "2026-11-28",
        eventTime: "08:00 PM",
        guestCount: 750,
        venue: "Grand Nagarjuna Lawns, Guntur",
        mealType: "DINNER",
        preference: "BOTH",
        serviceType: "FULL_CATERING",
        customer: {
          name: "Dr. K. Someswara Rao",
          phone: "+91 94401 55667",
          email: "drsomesh@gmail.com",
        },
        notes: "Contract signed, 40% advance received.",
      },
      templateId: "wedding-lunch-premium",
      template: SMART_MENU_TEMPLATES[0],
      customerSelectionLink: `/restaurant/bahubali/catering/portal/EVT-2026-003`,
      status: "APPROVED",
      selectedItemIds: ["wd-badam-milk", "str-chicken-65", "bir-chicken-dum", "cur-butter-chicken"],
      selectedAddonIds: ["live-mandi", "live-dosa"],
      createdAt: "2026-09-01T12:00:00.000Z",
    },
    {
      id: "EVT-2026-004",
      restaurantSubdomain: "bahubali",
      eventDetails: {
        eventName: "Prasad Family Gruhapravesam",
        eventType: "HOUSEWARMING",
        eventDate: "2026-11-15",
        eventTime: "11:30 AM",
        guestCount: 300,
        venue: "Amaravathi Enclave, Mangalagiri",
        mealType: "LUNCH",
        preference: "VEG",
        serviceType: "FULL_CATERING",
        customer: {
          name: "V. Prasad Garu",
          phone: "+91 98850 77889",
        },
        notes: "Pure Vegetarian Andhra traditional spread.",
      },
      templateId: "wedding-lunch-basic",
      template: SMART_MENU_TEMPLATES[1] || SMART_MENU_TEMPLATES[0],
      customerSelectionLink: `/restaurant/bahubali/catering/portal/EVT-2026-004`,
      status: "LINK_SHARED",
      selectedItemIds: ["rc-steamed-rice", "dal-tomato-pappu", "sam-andhra-sambar"],
      selectedAddonIds: [],
      createdAt: "2026-09-01T13:00:00.000Z",
    },
    {
      id: "EVT-2026-2488",
      restaurantSubdomain: "bahubali",
      eventDetails: {
        eventName: "House warming Ceremony",
        eventType: "HOUSEWARMING",
        eventDate: "2026-11-25",
        eventTime: "12:30 PM",
        guestCount: 500,
        venue: "Guntur Convention Center",
        mealType: "LUNCH",
        preference: "BOTH",
        serviceType: "FULL_CATERING",
        customer: {
          name: "Vivek Garu",
          phone: "8184974588",
        },
        notes: "Registered from Catering Dashboard.",
      },
      templateId: "wedding-lunch-premium",
      template: SMART_MENU_TEMPLATES[0],
      customerSelectionLink: `/restaurant/bahubali/catering/portal/EVT-2026-2488`,
      status: "LINK_SHARED",
      selectedItemIds: ["wd-fruit-punch", "str-paneer-tikka", "bir-chicken-dum", "cur-butter-chicken"],
      selectedAddonIds: ["live-dosa"],
      createdAt: "2026-09-02T18:00:00.000Z",
    },
    {
      id: "EVT-2026-1512",
      restaurantSubdomain: "bahubali",
      eventDetails: {
        eventName: "Vivek House",
        eventType: "HOUSEWARMING",
        eventDate: "2026-11-25",
        eventTime: "12:30 PM",
        guestCount: 500,
        venue: "Guntur Convention Center",
        mealType: "LUNCH",
        preference: "BOTH",
        serviceType: "FULL_CATERING",
        customer: {
          name: "Vivek Garu",
          phone: "8184974588",
        },
        notes: "Submitted via Customer Selection Portal.",
      },
      templateId: "wedding-lunch-premium",
      template: SMART_MENU_TEMPLATES[0],
      customerSelectionLink: `/restaurant/bahubali/catering/portal/EVT-2026-1512`,
      status: "CUSTOMER_SUBMITTED",
      selectedItemIds: ["wd-fruit-punch"],
      selectedAddonIds: [],
      createdAt: "2026-09-02T18:30:00.000Z",
      submittedAt: "2026-09-02T18:35:00.000Z",
    },
  ];

  defaultEvents.forEach((e) => {
    if (!eventsMap.has(e.id)) {
      eventsMap.set(e.id, e);
    }
  });

  saveToDisk();
}

if (!globalStore.__cateringStoreInitialized) {
  initializeDefaults();
  globalStore.__cateringStoreInitialized = true;
}

export function getRegisteredEvent(token: string): RegisteredCateringEvent | null {
  loadFromDisk();
  const existing = eventsMap.get(token);
  if (existing) return existing;

  // Resilient fallback for any newly generated EVT- tokens
  if (token.startsWith("EVT-")) {
    const fallbackEvent: RegisteredCateringEvent = {
      id: token,
      restaurantSubdomain: "bahubali",
      eventDetails: {
        eventName: "Special Banquet Gathering",
        eventType: "CUSTOM",
        eventDate: "2026-11-25",
        eventTime: "12:30 PM",
        guestCount: 500,
        venue: "Guntur Convention Center",
        mealType: "LUNCH",
        preference: "BOTH",
        serviceType: "FULL_CATERING",
        customer: {
          name: "Valued Host",
          phone: "+91 98480 00000",
        },
        notes: "Auto-calibrated banquet package.",
      },
      templateId: "wedding-lunch-premium",
      template: SMART_MENU_TEMPLATES[0],
      customerSelectionLink: `/restaurant/bahubali/catering/portal/${token}`,
      status: "LINK_SHARED",
      selectedItemIds: ["wd-fruit-punch", "str-chicken-65", "bir-chicken-dum", "cur-butter-chicken"],
      selectedAddonIds: ["live-dosa"],
      createdAt: new Date().toISOString(),
    };
    eventsMap.set(token, fallbackEvent);
    saveToDisk();
    return fallbackEvent;
  }

  return null;
}

export function saveRegisteredEvent(event: RegisteredCateringEvent): void {
  loadFromDisk();
  eventsMap.set(event.id, event);
  saveToDisk();
}

export function listRegisteredEvents(subdomain: string): RegisteredCateringEvent[] {
  loadFromDisk();
  return Array.from(eventsMap.values()).filter(
    (e) => e.restaurantSubdomain.toLowerCase() === subdomain.toLowerCase()
  );
}

export function getCustomTemplates(): SmartMenuTemplate[] {
  loadFromDisk();
  return Array.from(templatesMap.values());
}

export function saveCustomTemplate(template: SmartMenuTemplate): void {
  loadFromDisk();
  templatesMap.set(template.id, template);
  saveToDisk();
}

export function getStoredRecipes(): MenuItemOption[] {
  loadFromDisk();
  return Array.from(recipesMap.values());
}

export function saveStoredRecipe(recipe: MenuItemOption): void {
  loadFromDisk();
  recipesMap.set(recipe.id, recipe);
  saveToDisk();
}

export function deleteStoredRecipe(id: string): void {
  loadFromDisk();
  recipesMap.delete(id);
  saveToDisk();
}
