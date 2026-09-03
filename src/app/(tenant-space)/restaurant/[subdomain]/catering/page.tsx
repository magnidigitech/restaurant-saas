"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import {
  CateringEventDetails,
  SmartMenuTemplate,
  LiveCounterAddon,
  MenuValidationReport,
  VersionedQuotation,
  EventCostBreakdown,
  TemplateCategoryRule,
  MenuItemOption,
} from "@/modules/catering/types";
import {
  SMART_MENU_TEMPLATES,
  LIVE_COUNTERS_MASTER,
  MENU_ITEMS_MASTER,
} from "@/modules/catering/templatesData";
import {
  analyzeAndValidateMenu,
  calculateTrueEventCost,
  buildVersionedQuotation,
} from "@/modules/catering/intelligenceEngine";

// Registered Event Interface for the Dashboard & Calendar
interface DashboardEvent {
  id: string; // e.g. "EVT-2026-001"
  eventName: string;
  eventType: string;
  eventDate: string; // "YYYY-MM-DD"
  eventTime: string;
  guestCount: number;
  venue: string;
  mealType: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  templateId: string;
  templateName: string;
  status: "LINK_SHARED" | "CUSTOMER_SUBMITTED" | "QUOTED" | "APPROVED" | "IN_PRODUCTION";
  selectedItemIds: string[];
  selectedAddonIds: string[];
  quotedAmount: number;
  perPaxRate: number;
  linkOpened: boolean;
  notes?: string;
}

export default function SmartCateringPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "bahubali";

  // Top-Level Dashboard Navigation Views
  type DashboardView = "OVERVIEW" | "CALENDAR" | "TEMPLATES" | "RECIPES" | "LINK_TRACKER" | "PIPELINE";
  const [activeView, setActiveView] = useState<DashboardView>("OVERVIEW");

  // Selected event for the detailed 7-stage pipeline
  const [selectedEventId, setSelectedEventId] = useState<string>("EVT-2026-001");

  // ---------------------------------------------------------------------------
  // 1. SEEDED CATERING EVENTS (CALENDAR & STATUS TRACKER)
  // ---------------------------------------------------------------------------
  const [eventsList, setEventsList] = useState<DashboardEvent[]>([
    {
      id: "EVT-2026-001",
      eventName: "Ravi Kumar's Daughter Wedding",
      eventType: "WEDDING",
      eventDate: "2026-11-20",
      eventTime: "12:30 PM",
      guestCount: 1000,
      venue: "Guntur Royal Convention Palace",
      mealType: "LUNCH",
      customerName: "Ravi Kumar Garu",
      customerPhone: "+91 98480 22338",
      customerEmail: "ravikumar.guntur@gmail.com",
      templateId: "wedding-lunch-premium",
      templateName: "Wedding Lunch – Premium Feast",
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
      quotedAmount: 1128750,
      perPaxRate: 1075,
      linkOpened: true,
      notes: "VIP guest count: 150 Pax. Ensure hot dum biryani batches at 1:15 PM sharp.",
    },
    {
      id: "EVT-2026-002",
      eventName: "Infosys Annual Leadership Gala",
      eventType: "CORPORATE",
      eventDate: "2026-11-24",
      eventTime: "07:30 PM",
      guestCount: 450,
      venue: "Novotel Ballroom, Vijayawada",
      mealType: "DINNER",
      customerName: "Srinivas Rao (HR VP)",
      customerPhone: "+91 99499 11002",
      customerEmail: "srinivas.r@infosys.com",
      templateId: "corporate-executive",
      templateName: "Corporate Executive Buffet",
      status: "CUSTOMER_SUBMITTED",
      selectedItemIds: [
        "wd-fruit-punch",
        "str-apollo-fish",
        "bir-mutton-dum",
        "cur-butter-chicken",
        "swt-gulab-jamun",
      ],
      selectedAddonIds: ["live-tawa-fish", "live-falooda"],
      quotedAmount: 495000,
      perPaxRate: 1100,
      linkOpened: true,
      notes: "Jain food counter needed for 40 executives.",
    },
    {
      id: "EVT-2026-003",
      eventName: "Dr. Ananya Sangeet & Reception",
      eventType: "RECEPTION",
      eventDate: "2026-11-28",
      eventTime: "08:00 PM",
      guestCount: 750,
      venue: "Grand Nagarjuna Lawns, Guntur",
      mealType: "DINNER",
      customerName: "Dr. K. Someswara Rao",
      customerPhone: "+91 94401 55667",
      customerEmail: "drsomesh@gmail.com",
      templateId: "wedding-lunch-premium",
      templateName: "Wedding Lunch – Premium Feast",
      status: "APPROVED",
      selectedItemIds: [
        "wd-badam-milk",
        "str-chicken-65",
        "bir-chicken-dum",
        "brd-butter-naan",
        "cur-butter-chicken",
        "swt-double-ka-meetha",
      ],
      selectedAddonIds: ["live-mandi", "live-dosa"],
      quotedAmount: 937500,
      perPaxRate: 1250,
      linkOpened: true,
      notes: "Contract signed, 40% advance received via RTGS.",
    },
    {
      id: "EVT-2026-004",
      eventName: "Prasad Family Gruhapravesam",
      eventType: "HOUSEWARMING",
      eventDate: "2026-11-15",
      eventTime: "11:30 AM",
      guestCount: 300,
      venue: "Amaravathi Enclave, Mangalagiri",
      mealType: "LUNCH",
      customerName: "V. Prasad Garu",
      customerPhone: "+91 98850 77889",
      templateId: "wedding-lunch-basic",
      templateName: "Wedding Lunch – Classic Traditional",
      status: "LINK_SHARED",
      selectedItemIds: ["rc-steamed-rice", "dal-tomato-pappu", "sam-andhra-sambar"],
      selectedAddonIds: [],
      quotedAmount: 180000,
      perPaxRate: 600,
      linkOpened: false,
      notes: "Pure Vegetarian Andhra traditional spread.",
    },
  ]);

  // Calendar State
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [calendarMonth, setCalendarMonth] = useState<number>(10); // 0-indexed: 10 = Nov
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>("2026-11-20");
  const [showCalendarDateModal, setShowCalendarDateModal] = useState<boolean>(false);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState<boolean>(true);

  // Quick Action Modal: Book New Event
  const [showNewEventModal, setShowNewEventModal] = useState<boolean>(false);
  const [newEventDate, setNewEventDate] = useState<string>("2026-11-25");
  const [newEventHost, setNewEventHost] = useState<string>("");
  const [newEventPhone, setNewEventPhone] = useState<string>("");
  const [newEventTitle, setNewEventTitle] = useState<string>("");
  const [newEventPax, setNewEventPax] = useState<number>(500);
  const [newEventType, setNewEventType] = useState<string>("WEDDING");
  const [newEventMeal, setNewEventMeal] = useState<string>("LUNCH");
  const [newEventVenue, setNewEventVenue] = useState<string>("Guntur Convention Center");
  const [newEventTemplateId, setNewEventTemplateId] = useState<string>("wedding-lunch-premium");

  // ---------------------------------------------------------------------------
  // 2. TEMPLATE STUDIO STATE (CRUD & EVENT TYPE MAPPING)
  // ---------------------------------------------------------------------------
  const [templates, setTemplates] = useState<SmartMenuTemplate[]>(SMART_MENU_TEMPLATES);
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<SmartMenuTemplate | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);

  // Template Form State
  const [templateFormName, setTemplateFormName] = useState<string>("");
  const [templateFormDesc, setTemplateFormDesc] = useState<string>("");
  const [templateFormBasePrice, setTemplateFormBasePrice] = useState<number>(850);
  const [templateFormEventTypes, setTemplateFormEventTypes] = useState<string[]>(["WEDDING"]);
  const [templateFormRules, setTemplateFormRules] = useState<TemplateCategoryRule[]>([]);

  // Category Recipe Assignment & Import State
  const [activeCategoryRuleIndex, setActiveCategoryRuleIndex] = useState<number | null>(null);

  // 1. Import from Recipe Module State
  const [showRecipePickerModal, setShowRecipePickerModal] = useState<boolean>(false);
  const [recipeCatalog, setRecipeCatalog] = useState<MenuItemOption[]>(Object.values(MENU_ITEMS_MASTER));
  const [recipeSearch, setRecipeSearch] = useState<string>("");
  const [recipeDietFilter, setRecipeDietFilter] = useState<"ALL" | "VEG" | "NON_VEG">("ALL");
  const [selectedRecipesToImport, setSelectedRecipesToImport] = useState<string[]>([]);

  // 2. Upload via Excel/CSV State
  const [showExcelUploadModal, setShowExcelUploadModal] = useState<boolean>(false);
  const [excelParsedItems, setExcelParsedItems] = useState<MenuItemOption[]>([]);
  const [excelFileName, setExcelFileName] = useState<string>("");

  // 3. Create Custom Item State
  const [showCreateItemModal, setShowCreateItemModal] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>("");
  const [newItemCategory, setNewItemCategory] = useState<string>("Starter");
  const [newItemDietary, setNewItemDietary] = useState<"VEG" | "NON_VEG">("VEG");
  const [newItemPortion, setNewItemPortion] = useState<number>(0.15);
  const [newItemUnit, setNewItemUnit] = useState<string>("kg");
  const [newItemCost, setNewItemCost] = useState<number>(45);
  const [newItemSpice, setNewItemSpice] = useState<"MILD" | "MEDIUM" | "SPICY">("MEDIUM");
  const [newItemDesc, setNewItemDesc] = useState<string>("");

  // 4. Recipe Catalog Tab Filters & States
  const [catalogSearch, setCatalogSearch] = useState<string>("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>("ALL");
  const [catalogDietFilter, setCatalogDietFilter] = useState<"ALL" | "VEG" | "NON_VEG">("ALL");

  // 5. Direct Dish Picker Modal (for Template Studio quick multi-select)
  const [showDirectDishPickerModal, setShowDirectDishPickerModal] = useState<boolean>(false);

  // 6. Template Builder Ajax Dish Autocomplete State
  const [dishSearchQueries, setDishSearchQueries] = useState<Record<number, string>>({});
  const [focusedRuleIndex, setFocusedRuleIndex] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // 3. PIPELINE STUDIO STATE (FOR THE ACTIVE EVENT)
  // ---------------------------------------------------------------------------
  const activeEvent = useMemo(() => {
    return eventsList.find((e) => e.id === selectedEventId) || eventsList[0];
  }, [eventsList, selectedEventId]);

  type PipelineStage =
    | "EVENT_SETUP"
    | "TEMPLATE_SELECTION"
    | "MENU_BUILDER"
    | "LIVE_COUNTERS"
    | "AI_VALIDATION"
    | "QUOTATION_STUDIO"
    | "PRODUCTION_BATCH";

  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("EVENT_SETUP");

  // Synchronized state for active event's pipeline
  const [eventDetails, setEventDetails] = useState<CateringEventDetails>({
    eventName: activeEvent.eventName,
    eventType: activeEvent.eventType,
    eventDate: activeEvent.eventDate,
    eventTime: activeEvent.eventTime,
    guestCount: activeEvent.guestCount,
    venue: activeEvent.venue,
    mealType: activeEvent.mealType as any,
    preference: "BOTH",
    serviceType: "FULL_CATERING",
    customer: {
      name: activeEvent.customerName,
      phone: activeEvent.customerPhone,
      email: activeEvent.customerEmail,
    },
    notes: activeEvent.notes,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<SmartMenuTemplate>(
    templates.find((t) => t.id === activeEvent.templateId) || templates[0]
  );
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(activeEvent.selectedItemIds);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(activeEvent.selectedAddonIds);
  const [isQuotationApproved, setIsQuotationApproved] = useState<boolean>(activeEvent.status === "APPROVED");
  const [currentQuotation, setCurrentQuotation] = useState<VersionedQuotation | null>(null);

  // Link copy feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Persistent Synchronization with Server Disk & LocalStorage
  useEffect(() => {
    // 1. Immediate restore from localStorage
    try {
      const savedEvs = localStorage.getItem(`bahubali_catering_events_${subdomain}`);
      if (savedEvs) {
        const parsed = JSON.parse(savedEvs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEventsList(parsed);
        }
      }
      const savedTmpls = localStorage.getItem(`bahubali_catering_templates_${subdomain}`);
      if (savedTmpls) {
        const parsed = JSON.parse(savedTmpls);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTemplates(parsed);
        }
      }
    } catch (e) {
      console.warn("Could not parse from localStorage:", e);
    }

    // 2. Sync with server-side persistent disk storage
    async function loadServerStorage() {
      try {
        const res = await fetch(`/api/restaurant/catering/events?subdomain=${subdomain}`);
        if (res.ok) {
          const data = await res.json();
          if (data.events && data.events.length > 0) {
            const mapped: DashboardEvent[] = data.events.map((e: any) => ({
              id: e.id,
              eventName: e.eventDetails.eventName,
              eventType: e.eventDetails.eventType,
              eventDate: e.eventDetails.eventDate,
              eventTime: e.eventDetails.eventTime || "12:30 PM",
              guestCount: e.eventDetails.guestCount,
              venue: e.eventDetails.venue,
              mealType: e.eventDetails.mealType,
              customerName: e.eventDetails.customer?.name || "Customer",
              customerPhone: e.eventDetails.customer?.phone || "",
              customerEmail: e.eventDetails.customer?.email,
              templateId: e.templateId,
              templateName: e.template?.name || "Standard Template",
              status: e.status || "LINK_SHARED",
              selectedItemIds: e.selectedItemIds || [],
              selectedAddonIds: e.selectedAddonIds || [],
              quotedAmount: (e.template?.basePricePerPax || 750) * e.eventDetails.guestCount,
              perPaxRate: e.template?.basePricePerPax || 750,
              linkOpened: true,
              notes: e.eventDetails.notes,
            }));

            setEventsList(mapped);
            try {
              localStorage.setItem(`bahubali_catering_events_${subdomain}`, JSON.stringify(mapped));
            } catch { }
          }

          if (data.templates && data.templates.length > 0) {
            setTemplates(data.templates);
            try {
              localStorage.setItem(`bahubali_catering_templates_${subdomain}`, JSON.stringify(data.templates));
            } catch { }
          }
        }
      } catch (err) {
        console.warn("Could not sync server events:", err);
      }
    }

    loadServerStorage();
  }, [subdomain]);

  // Sync event details when selectedEventId changes
  useEffect(() => {
    if (activeEvent) {
      setEventDetails({
        eventName: activeEvent.eventName,
        eventType: activeEvent.eventType,
        eventDate: activeEvent.eventDate,
        eventTime: activeEvent.eventTime,
        guestCount: activeEvent.guestCount,
        venue: activeEvent.venue,
        mealType: activeEvent.mealType as any,
        preference: "BOTH",
        serviceType: "FULL_CATERING",
        customer: {
          name: activeEvent.customerName,
          phone: activeEvent.customerPhone,
          email: activeEvent.customerEmail,
        },
        notes: activeEvent.notes,
      });
      setSelectedItemIds(activeEvent.selectedItemIds);
      setSelectedAddonIds(activeEvent.selectedAddonIds);
      setIsQuotationApproved(activeEvent.status === "APPROVED");
      const matched = templates.find((t) => t.id === activeEvent.templateId) || templates[0];
      setSelectedTemplate(matched);
    }
  }, [activeEvent, templates]);

  // AI Validation & Costing
  const validationReport: MenuValidationReport = useMemo(() => {
    return analyzeAndValidateMenu(selectedItemIds, eventDetails.guestCount, eventDetails);
  }, [selectedItemIds, eventDetails]);

  const costBreakdown: EventCostBreakdown = useMemo(() => {
    return calculateTrueEventCost(
      selectedItemIds,
      selectedAddonIds,
      eventDetails.guestCount,
      selectedTemplate.basePricePerPax
    );
  }, [selectedItemIds, selectedAddonIds, eventDetails.guestCount, selectedTemplate]);

  // Synchronize dynamic quotation
  useEffect(() => {
    const quote = buildVersionedQuotation(
      "QUO-2026-001",
      1,
      eventDetails.guestCount,
      selectedItemIds,
      selectedAddonIds,
      selectedTemplate.basePricePerPax,
      0,
      5,
      `Quotation for ${eventDetails.guestCount.toLocaleString()} Pax • ${selectedItemIds.length} Dishes • ${selectedAddonIds.length} Live Counters`
    );
    setCurrentQuotation(quote);
  }, [selectedItemIds, selectedAddonIds, eventDetails.guestCount, selectedTemplate]);

  // ---------------------------------------------------------------------------
  // CALENDAR COMPUTATION HELPERS
  // ---------------------------------------------------------------------------
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const daysInMonth = useMemo(() => {
    return new Date(calendarYear, calendarMonth + 1, 0).getDate();
  }, [calendarYear, calendarMonth]);

  const firstDayIndex = useMemo(() => {
    return new Date(calendarYear, calendarMonth, 1).getDay();
  }, [calendarYear, calendarMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, DashboardEvent[]> = {};
    eventsList.forEach((e) => {
      if (!map[e.eventDate]) {
        map[e.eventDate] = [];
      }
      map[e.eventDate].push(e);
    });
    return map;
  }, [eventsList]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return eventsByDate[selectedCalendarDate] || [];
  }, [eventsByDate, selectedCalendarDate]);

  // ---------------------------------------------------------------------------
  // HANDLERS FOR EVENT CREATION & LINK TRACKING
  // ---------------------------------------------------------------------------
  const handleCreateNewEvent = () => {
    if (!newEventHost || !newEventTitle) {
      alert("Please enter Host Name and Event Title.");
      return;
    }
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newId = `EVT-2026-${randomSuffix}`;
    const assignedTemplate =
      templates.find((t) => t.id === newEventTemplateId) ||
      templates.find((t) => t.applicableEventTypes.includes(newEventType)) ||
      templates[0];

    const newEv: DashboardEvent = {
      id: newId,
      eventName: newEventTitle,
      eventType: newEventType,
      eventDate: newEventDate,
      eventTime: "12:30 PM",
      guestCount: newEventPax,
      venue: newEventVenue,
      mealType: newEventMeal,
      customerName: newEventHost,
      customerPhone: newEventPhone || "+91 98480 12345",
      templateId: assignedTemplate.id,
      templateName: assignedTemplate.name,
      status: "LINK_SHARED",
      selectedItemIds: [
        "wd-fruit-punch",
        "str-chicken-65",
        "bir-chicken-dum",
        "brd-butter-naan",
        "cur-butter-chicken",
        "swt-gulab-jamun",
      ],
      selectedAddonIds: ["live-dosa"],
      quotedAmount: assignedTemplate.basePricePerPax * newEventPax,
      perPaxRate: assignedTemplate.basePricePerPax,
      linkOpened: false,
    };

    setEventsList([newEv, ...eventsList]);
    setSelectedCalendarDate(newEventDate);
    setShowNewEventModal(false);

    // Persist to store API
    fetch("/api/restaurant/catering/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REGISTER_EVENT",
        subdomain,
        token: newId,
        eventDetails: {
          eventName: newEventTitle,
          eventType: newEventType,
          eventDate: newEventDate,
          guestCount: newEventPax,
          venue: newEventVenue,
          mealType: newEventMeal,
          customer: { name: newEventHost, phone: newEventPhone },
        },
        template: assignedTemplate,
      }),
    }).catch(console.warn);

    alert(`Event "${newEventTitle}" registered successfully! Shareable Link Token: ${newId}`);
  };

  const getCustomerPortalUrl = (token: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/restaurant/${subdomain}/catering/portal/${token}`;
    }
    return `/restaurant/${subdomain}/catering/portal/${token}`;
  };

  const handleCopyLink = (token: string) => {
    const url = getCustomerPortalUrl(token);
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleWhatsAppReminder = (ev: DashboardEvent) => {
    const url = getCustomerPortalUrl(ev.id);
    const text = encodeURIComponent(
      `Namaste ${ev.customerName}! Here is your Bahubali Catering menu selection link for "${ev.eventName}" (${ev.guestCount.toLocaleString()} Guests):\n\n${url}\n\nPlease finalize your menu dishes!`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleReassignEventTemplate = (eventId: string, targetTemplateId: string) => {
    const targetTmpl = templates.find((t) => t.id === targetTemplateId);
    if (!targetTmpl) return;

    setEventsList((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          return {
            ...e,
            templateId: targetTmpl.id,
            templateName: targetTmpl.name,
            quotedAmount: targetTmpl.basePricePerPax * e.guestCount,
            perPaxRate: targetTmpl.basePricePerPax,
          };
        }
        return e;
      })
    );

    const ev = eventsList.find((e) => e.id === eventId);
    if (ev) {
      fetch("/api/restaurant/catering/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REGISTER_EVENT",
          subdomain,
          token: eventId,
          template: targetTmpl,
          eventDetails: {
            eventName: ev.eventName,
            eventType: ev.eventType,
            eventDate: ev.eventDate,
            guestCount: ev.guestCount,
            venue: ev.venue,
            mealType: ev.mealType,
            customer: { name: ev.customerName, phone: ev.customerPhone },
          },
        }),
      }).catch(console.warn);
    }

    alert(`Assigned Template for ${eventId} updated to "${targetTmpl.name}"!`);
  };

  // ---------------------------------------------------------------------------
  // TEMPLATE CRUD HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenCreateTemplate = () => {
    setSelectedTemplateForEdit(null);
    setTemplateFormName("");
    setTemplateFormDesc("");
    setTemplateFormBasePrice(800);
    setTemplateFormEventTypes(["WEDDING"]);
    setTemplateFormRules([
      {
        category: "Welcome Drink",
        minSelections: 1,
        maxSelections: 1,
        availableItems: [
          MENU_ITEMS_MASTER["wd-fruit-punch"],
          MENU_ITEMS_MASTER["wd-badam-milk"],
        ],
      },
      {
        category: "Starters",
        minSelections: 2,
        maxSelections: 2,
        availableItems: [
          MENU_ITEMS_MASTER["str-chicken-65"],
          MENU_ITEMS_MASTER["str-paneer-tikka"],
        ],
      },
      {
        category: "Biryani & Rice",
        minSelections: 1,
        maxSelections: 1,
        availableItems: [
          MENU_ITEMS_MASTER["bir-chicken-dum"],
          MENU_ITEMS_MASTER["rc-steamed-rice"],
        ],
      },
      {
        category: "Curries & Gravies",
        minSelections: 2,
        maxSelections: 2,
        availableItems: [
          MENU_ITEMS_MASTER["cur-butter-chicken"],
          MENU_ITEMS_MASTER["cur-kadai-paneer"],
        ],
      },
      {
        category: "Desserts & Sweets",
        minSelections: 1,
        maxSelections: 1,
        availableItems: [
          MENU_ITEMS_MASTER["swt-gulab-jamun"],
          MENU_ITEMS_MASTER["ice-malai-kulfi"],
        ],
      },
    ]);
    setIsEditingTemplate(true);
  };

  const handleOpenEditTemplate = (tmpl: SmartMenuTemplate) => {
    setSelectedTemplateForEdit(tmpl);
    setTemplateFormName(tmpl.name);
    setTemplateFormDesc(tmpl.description);
    setTemplateFormBasePrice(tmpl.basePricePerPax);
    setTemplateFormEventTypes(tmpl.applicableEventTypes);
    setTemplateFormRules([...tmpl.categoryRules]);
    setIsEditingTemplate(true);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm("Are you sure you want to delete this catering template?")) {
      const updated = templates.filter((t) => t.id !== templateId);
      setTemplates(updated);
      try {
        localStorage.setItem(`bahubali_catering_templates_${subdomain}`, JSON.stringify(updated));
      } catch { }
      alert("Template deleted successfully.");
    }
  };

  const handleSaveTemplateForm = () => {
    if (!templateFormName) {
      alert("Please enter a Template Name.");
      return;
    }

    let savedTemplate: SmartMenuTemplate;
    let updatedList: SmartMenuTemplate[];

    if (selectedTemplateForEdit) {
      savedTemplate = {
        ...selectedTemplateForEdit,
        name: templateFormName,
        description: templateFormDesc,
        basePricePerPax: templateFormBasePrice,
        applicableEventTypes: templateFormEventTypes,
        categoryRules: templateFormRules,
      };
      updatedList = templates.map((t) => (t.id === savedTemplate.id ? savedTemplate : t));
    } else {
      savedTemplate = {
        id: `tmpl-${Date.now()}`,
        name: templateFormName,
        description: templateFormDesc,
        basePricePerPax: templateFormBasePrice,
        applicableEventTypes: templateFormEventTypes,
        applicableMealTypes: ["LUNCH", "DINNER"],
        categoryRules: templateFormRules,
      };
      updatedList = [savedTemplate, ...templates];
    }

    setTemplates(updatedList);
    try {
      localStorage.setItem(`bahubali_catering_templates_${subdomain}`, JSON.stringify(updatedList));
    } catch { }

    // Persist to server disk storage
    fetch("/api/restaurant/catering/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SAVE_CUSTOM_TEMPLATE",
        template: savedTemplate,
      }),
    }).catch(console.warn);

    alert(`Template "${templateFormName}" saved successfully.`);
    setIsEditingTemplate(false);
  };

  // ---------------------------------------------------------------------------
  // RECIPE CATALOG & DISH MANAGEMENT HANDLERS
  // ---------------------------------------------------------------------------
  const handleSyncFromKitchenRecipes = async () => {
    try {
      const res = await fetch(`/api/restaurant/catering/recipes?subdomain=${subdomain}`);
      if (res.ok) {
        const data = await res.json();
        if (data.recipes && data.recipes.length > 0) {
          setRecipeCatalog(data.recipes);
          alert(`Successfully synced ${data.recipes.length} dishes from kitchen recipe master.`);
        }
      }
    } catch (e) {
      console.warn("Could not sync recipes:", e);
    }
  };

  const handleOpenCreateCatalogDish = () => {
    setNewItemName("");
    setNewItemCategory("Starter");
    setNewItemDietary("VEG");
    setNewItemPortion(0.15);
    setNewItemUnit("kg");
    setNewItemCost(45);
    setNewItemSpice("MEDIUM");
    setNewItemDesc("");
    setShowCreateItemModal(true);
  };

  const handleSaveCatalogDish = async () => {
    if (!newItemName.trim()) {
      alert("Please enter Dish Name");
      return;
    }
    const newDish: MenuItemOption = {
      id: `dish-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: newItemName.trim(),
      category: newItemCategory || "Starter",
      dietary: newItemDietary,
      basePortionPerPax: newItemPortion,
      portionUnit: newItemUnit,
      approxCostPerPax: newItemCost,
      spiceLevel: newItemSpice,
      description: newItemDesc || `Signature ${newItemName.trim()}`,
      tags: ["catalog-dish"],
    };

    setRecipeCatalog((prev) => [newDish, ...prev]);
    setShowCreateItemModal(false);

    await fetch("/api/restaurant/catering/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CREATE_RECIPE", recipe: newDish }),
    }).catch(console.warn);
  };

  const handleOpenExcelCatalogUpload = () => {
    setExcelParsedItems([]);
    setExcelFileName("");
    setShowExcelUploadModal(true);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) return;

      const parsed: MenuItemOption[] = [];
      const startIndex = lines[0].toLowerCase().includes("name") ? 1 : 0;
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        if (!parts[0]) continue;
        const name = parts[0];
        const dietaryRaw = (parts[1] || "VEG").toUpperCase();
        const dietary = dietaryRaw.includes("NON") ? "NON_VEG" : "VEG";
        const portion = parseFloat(parts[2]) || 0.15;
        const unit = parts[3] || "kg";
        const cost = parseFloat(parts[4]) || 40;
        const spiceRaw = (parts[5] || "MEDIUM").toUpperCase();
        const spiceLevel = spiceRaw.includes("SPIC") ? "SPICY" : spiceRaw.includes("MILD") ? "MILD" : "MEDIUM";
        const desc = parts[6] || `Freshly prepared ${name}`;

        parsed.push({
          id: `excel-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
          name,
          category: newItemCategory || "General",
          dietary,
          basePortionPerPax: portion,
          portionUnit: unit,
          approxCostPerPax: cost,
          spiceLevel,
          description: desc,
          tags: ["excel-imported"],
        });
      }

      setExcelParsedItems(parsed);
    };
    reader.readAsText(file);
  };

  const handleConfirmExcelCatalogUpload = async () => {
    if (excelParsedItems.length === 0) return;
    setRecipeCatalog((prev) => [...excelParsedItems, ...prev]);
    setShowExcelUploadModal(false);

    await fetch("/api/restaurant/catering/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "BULK_IMPORT", recipes: excelParsedItems }),
    }).catch(console.warn);
  };

  const handleDeleteCatalogDish = async (dishId: string) => {
    if (!confirm("Are you sure you want to remove this dish from the catering catalog?")) return;
    setRecipeCatalog((prev) => prev.filter((d) => d.id !== dishId));
    await fetch("/api/restaurant/catering/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_RECIPE", id: dishId }),
    }).catch(console.warn);
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      "Item Name,Dietary,Portion per Pax,Unit,Cost per Pax,Spice Level,Description\n" +
      "Chicken 65,NON_VEG,0.2,kg,65,SPICY,Fiery Andhra style starter\n" +
      "Paneer Tikka,VEG,0.15,kg,45,MEDIUM,Tandoori marinated cottage cheese\n" +
      "Gongura Mutton,NON_VEG,0.18,kg,90,SPICY,Traditional gongura infused goat curry\n" +
      "Gulab Jamun,VEG,2,pcs,25,MILD,Warm khoya dumplings in sugar syrup\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "catering_recipes_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Direct Dish Assignment Handlers for Template Studio
  const handleAddDishToTemplateCategory = (categoryIndex: number, dishId: string) => {
    if (!dishId) return;
    const foundDish = recipeCatalog.find((d) => d.id === dishId);
    if (!foundDish) return;
    setTemplateFormRules((prev) => {
      const copy = [...prev];
      const target = copy[categoryIndex];
      if (!target) return prev;
      if ((target.availableItems || []).some((it) => it.id === dishId)) return prev;
      target.availableItems = [...(target.availableItems || []), foundDish];
      return copy;
    });
  };

  const handleConfirmDirectDishPicker = () => {
    if (activeCategoryRuleIndex === null) return;
    const selectedDishes = recipeCatalog.filter((d) => selectedRecipesToImport.includes(d.id));
    setTemplateFormRules((prev) => {
      const copy = [...prev];
      if (!copy[activeCategoryRuleIndex]) return prev;
      copy[activeCategoryRuleIndex].availableItems = selectedDishes;
      return copy;
    });
    setShowDirectDishPickerModal(false);
  };

  const handleRemoveItemFromCategory = (categoryIndex: number, itemId: string) => {
    setTemplateFormRules((prev) => {
      const copy = [...prev];
      const target = copy[categoryIndex];
      if (!target) return prev;
      target.availableItems = (target.availableItems || []).filter((it) => it.id !== itemId);
      return copy;
    });
  };

  // ---------------------------------------------------------------------------
  // QUICK TOTALS FOR OVERVIEW KPIS
  // ---------------------------------------------------------------------------
  const totalPipelineRevenue = useMemo(() => {
    return eventsList.reduce((sum, e) => sum + e.quotedAmount, 0);
  }, [eventsList]);

  const totalGuestsCommitted = useMemo(() => {
    return eventsList.reduce((sum, e) => sum + e.guestCount, 0);
  }, [eventsList]);

  return (
    <ModuleAccessGuard moduleKey="catering" moduleName="Catering & Event Management" activeSection="catering">
      <div className="min-h-screen bg-[#FCF9F5] text-[#1a120b] flex flex-col font-sans selection:bg-amber-100">
        <RestaurantNavbar activeSection="catering" />

        {/* TOP COMMAND HEADER */}
        <header className="bg-white border-b border-[#E8DFC8] pt-8 pb-5 px-6 lg:px-10">
          <div className="max-w-7xl mx-auto space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                    Executive Catering Operations Suite
                  </span>
                  <span className="text-xs text-stone-500 font-mono">
                    Tenant: <strong>{subdomain.toUpperCase()}</strong>
                  </span>
                </div>
                <h1 className="text-3xl font-black text-[#1a120b] tracking-tight mt-1">
                  Catering Sales & Event Command Center
                </h1>
                <p className="text-stone-600 text-xs mt-0.5">
                  Calendar schedules, custom template builder, live invitation trackers, and kitchen production handoff.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowNewEventModal(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center space-x-2"
                >
                  <span>+ Register New Event</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center overflow-x-auto gap-2 pt-2 border-t border-stone-100">
              {[
                { id: "OVERVIEW", label: "Overview", tag: "KPIs" },
                { id: "CALENDAR", label: "Catering Calendar", tag: `${eventsList.length} Booked` },
                { id: "TEMPLATES", label: "Template Studio (CRUD)", tag: `${templates.length} Active` },
                { id: "RECIPES", label: "Recipe & Dish Catalog", tag: `${recipeCatalog.length} Dishes` },
                { id: "LINK_TRACKER", label: "Link Share Tracker", tag: "Audience" },
                { id: "PIPELINE", label: "Active Event Pipeline", tag: activeEvent.id },
              ].map((tab) => {
                const isActive = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveView(tab.id as DashboardView)}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 border ${isActive
                      ? "bg-[#1a120b] text-white border-[#1a120b] shadow-sm scale-102"
                      : "bg-white text-stone-700 hover:bg-stone-50 border-[#E8DFC8]"
                      }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${isActive
                        ? "bg-amber-500 text-white"
                        : "bg-stone-100 text-stone-600 border border-stone-200"
                        }`}
                    >
                      {tab.tag}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* MAIN BODY VIEWPORT */}
        <main className="max-w-7xl mx-auto px-6 lg:px-10 py-8 flex-1 w-full space-y-8">
          {/* ================================================================= */}
          {/* VIEW 1: EXECUTIVE OVERVIEW                                        */}
          {/* ================================================================= */}
          {activeView === "OVERVIEW" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* Metric KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="p-6 bg-white rounded-3xl border border-[#E8DFC8] shadow-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-stone-500">Pipeline Value</span>
                  <div className="text-3xl font-black text-amber-900 font-mono">
                    ₹{totalPipelineRevenue.toLocaleString()}
                  </div>
                  <p className="text-xs text-stone-600">Across {eventsList.length} active banquets</p>
                </div>

                <div className="p-6 bg-white rounded-3xl border border-[#E8DFC8] shadow-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-stone-500">Guests Committed</span>
                  <div className="text-3xl font-black text-emerald-800 font-mono">
                    {totalGuestsCommitted.toLocaleString()} Pax
                  </div>
                  <p className="text-xs text-stone-600">Avg {Math.round(totalGuestsCommitted / eventsList.length)} pax per banquet</p>
                </div>

                <div className="p-6 bg-white rounded-3xl border border-[#E8DFC8] shadow-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-stone-500">Custom Templates</span>
                  <div className="text-3xl font-black text-stone-900 font-mono">
                    {templates.length} Packages
                  </div>
                  <p className="text-xs text-stone-600">Mapped across 6 event types</p>
                </div>

                <div className="p-6 bg-white rounded-3xl border border-[#E8DFC8] shadow-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-stone-500">Link Share Response</span>
                  <div className="text-3xl font-black text-blue-900 font-mono">
                    75%
                  </div>
                  <p className="text-xs text-stone-600">3 of 4 clients opened selection link</p>
                </div>
              </div>

              {/* Quick Jump: Calendar Teaser & Recent Invitations */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Upcoming Events */}
                <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-[#1a120b]">Upcoming Banquet Schedules</h3>
                      <p className="text-xs text-stone-500">Click any event to launch full sales & production pipeline.</p>
                    </div>
                    <button
                      onClick={() => setActiveView("CALENDAR")}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800"
                    >
                      Open Calendar View &rarr;
                    </button>
                  </div>

                  <div className="space-y-3">
                    {eventsList.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setSelectedEventId(ev.id);
                          setActiveView("PIPELINE");
                        }}
                        className="p-4 rounded-2xl bg-[#FCF9F5] border border-[#EFE7DC] hover:border-amber-400 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-[#1a120b]">{ev.eventName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-stone-200 text-stone-800">
                              {ev.id}
                            </span>
                          </div>
                          <p className="text-xs text-stone-600">
                            Host: <strong>{ev.customerName}</strong> • {ev.guestCount.toLocaleString()} Guests • {ev.eventDate} ({ev.mealType})
                          </p>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <span
                            className={`text-[10px] px-3 py-1 rounded-full font-bold border ${ev.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                              : ev.status === "CUSTOMER_SUBMITTED"
                                ? "bg-blue-100 text-blue-900 border-blue-300"
                                : "bg-amber-100 text-amber-900 border-amber-300"
                              }`}
                          >
                            {ev.status.replace("_", " ")}
                          </span>
                          <span className="font-mono font-black text-amber-900 text-sm">
                            ₹{ev.quotedAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Quick Template Highlights */}
                <div className="lg:col-span-5 bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-[#1a120b]">Catering Templates</h3>
                      <p className="text-xs text-stone-500">Configured course quotas for guests.</p>
                    </div>
                    <button
                      onClick={() => setActiveView("TEMPLATES")}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800"
                    >
                      Manage Templates &rarr;
                    </button>
                  </div>

                  <div className="space-y-3">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        className="p-4 rounded-2xl bg-[#FCF9F5] border border-[#EFE7DC] flex items-center justify-between"
                      >
                        <div>
                          <h4 className="font-bold text-sm text-[#1a120b]">{t.name}</h4>
                          <span className="text-[11px] text-stone-500">
                            {t.categoryRules.length} Courses • {t.applicableEventTypes.join(", ")}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-amber-900 text-xs">
                          ₹{t.basePricePerPax} / Pax
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleOpenCreateTemplate}
                    className="w-full py-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs rounded-2xl transition-colors"
                  >
                    + Build New Custom Template
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 2: CALENDAR VIEW (COLLAPSED & EXPANDED ON CLICK)              */}
          {/* ================================================================= */}
          {activeView === "CALENDAR" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                {/* Month Selector & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                      Interactive Banquet Schedule
                    </span>
                    <h2 className="text-2xl font-black text-[#1a120b] tracking-tight">
                      {monthNames[calendarMonth]} {calendarYear} Catering Calendar
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Click any date to collapse or expand event details and customer portal links.
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        if (calendarMonth === 0) {
                          setCalendarMonth(11);
                          setCalendarYear(calendarYear - 1);
                        } else {
                          setCalendarMonth(calendarMonth - 1);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100"
                    >
                      &larr; Prev
                    </button>
                    <span className="font-bold text-xs text-stone-800 font-mono">
                      {monthNames[calendarMonth].slice(0, 3)} {calendarYear}
                    </span>
                    <button
                      onClick={() => {
                        if (calendarMonth === 11) {
                          setCalendarMonth(0);
                          setCalendarYear(calendarYear + 1);
                        } else {
                          setCalendarMonth(calendarMonth + 1);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100"
                    >
                      Next &rarr;
                    </button>

                    <button
                      onClick={() => {
                        setNewEventDate(selectedCalendarDate || "2026-11-20");
                        setShowNewEventModal(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs"
                    >
                      + Book Event
                    </button>
                  </div>
                </div>

                {/* Calendar Day Grid */}
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-stone-500 pb-2">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {/* Empty offset days */}
                  {Array.from({ length: firstDayIndex }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-24 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200 opacity-30" />
                  ))}

                  {/* Days of month */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    const dayEvents = eventsByDate[dateStr] || [];
                    const isSelected = selectedCalendarDate === dateStr;
                    const hasEvents = dayEvents.length > 0;

                    return (
                      <div
                        key={dateStr}
                        onClick={() => {
                          setSelectedCalendarDate(dateStr);
                          setShowCalendarDateModal(true);
                        }}
                        className={`h-24 p-2 rounded-2xl cursor-pointer transition-all border flex flex-col justify-between ${isSelected
                          ? "bg-amber-50/80 border-amber-600 shadow-sm ring-2 ring-amber-400/40"
                          : hasEvents
                            ? "bg-white border-amber-300 hover:border-amber-400"
                            : "bg-white/70 border-stone-200 hover:bg-stone-50"
                          }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-black ${isSelected ? "text-amber-900" : "text-stone-700"}`}>
                            {dayNum}
                          </span>
                          {hasEvents && (
                            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                          )}
                        </div>

                        {/* Event Tags */}
                        <div className="space-y-1 overflow-hidden">
                          {dayEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold truncate bg-amber-600 text-white shadow-2xs text-left"
                            >
                              {ev.guestCount}p • {ev.eventName}
                            </div>
                          ))}
                        </div>

                        <div className="text-[10px] text-right text-stone-400 font-mono">
                          {hasEvents ? `${dayEvents.length} Event` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CALENDAR DATE DETAILS POPUP MODAL */}
                {showCalendarDateModal && selectedCalendarDate && (
                  <div
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setShowCalendarDateModal(false);
                    }}
                    className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
                  >
                    <div className="bg-white rounded-3xl border-2 border-amber-500 max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[88vh] overflow-y-auto relative">
                      <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                        <div className="flex items-center space-x-3">
                          <span className="w-3.5 h-3.5 rounded-full bg-amber-600 animate-pulse" />
                          <div>
                            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                              Interactive Banquet Schedule
                            </span>
                            <h3 className="text-xl font-black text-[#1a120b]">
                              Banquet Details for: <span className="font-mono text-amber-900">{selectedCalendarDate}</span>
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => {
                              setNewEventDate(selectedCalendarDate || "2026-11-20");
                              setShowCalendarDateModal(false);
                              setShowNewEventModal(true);
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1"
                          >
                            <span>+ Book Event on this Date</span>
                          </button>
                          <button
                            onClick={() => setShowCalendarDateModal(false)}
                            className="text-stone-400 hover:text-stone-700 text-2xl font-bold px-2"
                          >
                            &times;
                          </button>
                        </div>
                      </div>

                      {selectedDateEvents.length === 0 ? (
                        <div className="p-12 text-center bg-[#FCF9F5] rounded-3xl border-2 border-dashed border-stone-300 text-stone-500 space-y-3">
                          <p className="text-sm font-bold text-stone-700">No catering banquets booked for {selectedCalendarDate}.</p>
                          <p className="text-xs text-stone-500">Reserve a catering banquet slot for your guests.</p>
                          <button
                            onClick={() => {
                              setNewEventDate(selectedCalendarDate || "2026-11-20");
                              setShowCalendarDateModal(false);
                              setShowNewEventModal(true);
                            }}
                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                          >
                            + Book Event Now
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {selectedDateEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className="p-6 bg-[#FCF9F5] rounded-3xl border border-[#EFE7DC] shadow-xs space-y-4 flex flex-col justify-between hover:border-amber-400 transition-all"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-200 text-stone-800 font-mono">
                                    Ref: {ev.id}
                                  </span>
                                  <span
                                    className={`text-[10px] px-3 py-0.5 rounded-full font-bold border ${ev.status === "APPROVED"
                                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                      : ev.status === "CUSTOMER_SUBMITTED"
                                        ? "bg-blue-100 text-blue-900 border-blue-300"
                                        : "bg-amber-100 text-amber-900 border-amber-300"
                                      }`}
                                  >
                                    {ev.status.replace("_", " ")}
                                  </span>
                                </div>

                                <h4 className="text-base font-black text-[#1a120b]">{ev.eventName}</h4>
                                <p className="text-xs text-stone-600">
                                  Host: <strong>{ev.customerName}</strong> ({ev.customerPhone}) &bull; {ev.guestCount.toLocaleString()} Guests &bull; {ev.mealType}
                                </p>
                                <p className="text-xs text-stone-500">Venue: {ev.venue}</p>

                                {/* Template Assignment Selector */}
                                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 text-[11px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-amber-900 font-bold block">Assigned Menu Template:</span>
                                    <span className="text-[10px] text-stone-500 font-mono">₹{ev.perPaxRate}/Pax</span>
                                  </div>
                                  <select
                                    value={ev.templateId}
                                    onChange={(e) => handleReassignEventTemplate(ev.id, e.target.value)}
                                    className="w-full px-2 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                                  >
                                    {templates.map((tmpl) => (
                                      <option key={tmpl.id} value={tmpl.id}>
                                        {tmpl.name} (₹{tmpl.basePricePerPax}/Pax • {tmpl.categoryRules.length} Courses)
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Customer Portal Link preview */}
                                <div className="p-3 bg-white rounded-xl border border-stone-200 text-[11px] space-y-1">
                                  <span className="text-stone-500 font-bold block">Customer Portal Link:</span>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-amber-900 truncate underline">
                                      {getCustomerPortalUrl(ev.id)}
                                    </span>
                                    <button
                                      onClick={() => handleCopyLink(ev.id)}
                                      className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded text-[10px] shrink-0"
                                    >
                                      {copiedToken === ev.id ? "✓ Copied" : "Copy"}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-4 border-t border-stone-200/80 flex items-center justify-between">
                                <button
                                  onClick={() => handleWhatsAppReminder(ev)}
                                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
                                >
                                  <span>💬 WhatsApp Host</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setShowCalendarDateModal(false);
                                    setSelectedEventId(ev.id);
                                    setActiveView("PIPELINE");
                                  }}
                                  className="px-4 py-2 bg-[#1a120b] hover:bg-stone-800 text-amber-300 font-bold text-xs rounded-xl shadow-xs transition-all"
                                >
                                  Open 7-Stage Pipeline &rarr;
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 3: TEMPLATE STUDIO (CREATE, UPDATE, EDIT, DELETE & ASSIGN)   */}
          {/* ================================================================= */}
          {activeView === "TEMPLATES" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                      Course Quotas & Menu Blueprint Studio
                    </span>
                    <h2 className="text-2xl font-black text-[#1a120b] tracking-tight">
                      Catering Template Manager (CRUD)
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Create, edit, delete, and assign templates to event types (Weddings, Receptions, Corporate, Housewarmings).
                    </p>
                  </div>

                  <button
                    onClick={handleOpenCreateTemplate}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 text-white font-bold text-xs rounded-2xl shadow-sm transition-all"
                  >
                    + Create New Template
                  </button>
                </div>

                {/* Templates Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="p-6 bg-[#FCF9F5] rounded-3xl border-2 border-[#EFE7DC] hover:border-amber-400 shadow-xs flex flex-col justify-between transition-all space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-200">
                            ₹{tmpl.basePricePerPax} / Pax Base
                          </span>
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => handleOpenEditTemplate(tmpl)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-stone-300 text-stone-700 hover:text-amber-800 font-bold text-[11px]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(tmpl.id)}
                              className="px-2 py-1 rounded-lg bg-white border border-stone-300 text-red-600 hover:text-red-800 font-bold text-[11px]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-black text-[#1a120b]">{tmpl.name}</h3>
                          <p className="text-xs text-stone-600 mt-1 leading-relaxed line-clamp-2">
                            {tmpl.description}
                          </p>
                        </div>

                        {/* Event Types Mapped */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                            Assigned Event Types:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {tmpl.applicableEventTypes.map((et) => (
                              <span
                                key={et}
                                className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 font-mono text-[10px] font-bold"
                              >
                                {et}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Category Quota Rules Summary */}
                        <div className="p-3.5 bg-white rounded-2xl border border-stone-200 text-xs space-y-1.5">
                          <span className="font-bold text-stone-700 block text-[11px]">
                            Course Quotas ({tmpl.categoryRules.length} Courses):
                          </span>
                          <div className="grid grid-cols-2 gap-1 text-[11px] text-stone-600 font-medium">
                            {tmpl.categoryRules.map((rule, idx) => (
                              <div key={idx} className="truncate">
                                • {rule.category}: <strong>{rule.maxSelections}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-stone-200 flex justify-between items-center">
                        <span className="text-[11px] text-stone-500">
                          Total Dishes: {tmpl.categoryRules.reduce((s, r) => s + r.availableItems.length, 0)}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedTemplate(tmpl);
                            setActiveView("PIPELINE");
                            setPipelineStage("MENU_BUILDER");
                          }}
                          className="text-xs font-bold text-amber-700 hover:text-amber-800"
                        >
                          Use in Pipeline &rarr;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CREATE / EDIT TEMPLATE POPUP MODAL */}
              {isEditingTemplate && (
                <div
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setIsEditingTemplate(false);
                  }}
                  className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
                >
                  <div className="bg-white rounded-3xl border-2 border-amber-500 max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[88vh] overflow-y-auto relative">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                          {selectedTemplateForEdit ? "Update Template" : "Create New Template"}
                        </span>
                        <h3 className="text-2xl font-black text-[#1a120b]">
                          {selectedTemplateForEdit ? `Edit "${selectedTemplateForEdit.name}"` : "Build Custom Catering Template"}
                        </h3>
                      </div>
                      <button
                        onClick={() => setIsEditingTemplate(false)}
                        className="text-stone-400 hover:text-stone-700 text-xl font-bold px-2"
                      >
                        &times;
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          Template Name *
                        </label>
                        <input
                          type="text"
                          value={templateFormName}
                          onChange={(e) => setTemplateFormName(e.target.value)}
                          placeholder="e.g. Royal Andhra Kalyanam Feast"
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold focus:outline-none focus:border-amber-600"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          Base Price Per Pax (₹) *
                        </label>
                        <input
                          type="number"
                          step={25}
                          value={templateFormBasePrice}
                          onChange={(e) => setTemplateFormBasePrice(parseInt(e.target.value) || 500)}
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm font-black text-amber-900 focus:outline-none focus:border-amber-600"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          Template Description
                        </label>
                        <input
                          type="text"
                          value={templateFormDesc}
                          onChange={(e) => setTemplateFormDesc(e.target.value)}
                          placeholder="Detailed banquet description..."
                          className="w-full px-4 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:border-amber-600"
                        />
                      </div>

                      {/* Assign to Event Types (Multi-checkbox) */}
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-bold text-stone-700 block">
                          Assign to Event Types:
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {["WEDDING", "RECEPTION", "ENGAGEMENT", "CORPORATE", "HOUSEWARMING", "BIRTHDAY", "CUSTOM"].map((type) => {
                            const isAssigned = templateFormEventTypes.includes(type);
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  if (isAssigned) {
                                    setTemplateFormEventTypes(templateFormEventTypes.filter((t) => t !== type));
                                  } else {
                                    setTemplateFormEventTypes([...templateFormEventTypes, type]);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${isAssigned
                                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                  : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50"
                                  }`}
                              >
                                {type} {isAssigned ? "✓" : "+"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Course Categories & Quota Rules */}
                    <div className="space-y-4 pt-4 border-t border-stone-100">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-black text-[#1a120b]">
                          Course Categories & Selection Quotas ({templateFormRules.length})
                        </h4>
                        <button
                          type="button"
                          onClick={() =>
                            setTemplateFormRules([
                              ...templateFormRules,
                              {
                                category: `New Course ${templateFormRules.length + 1}`,
                                minSelections: 1,
                                maxSelections: 1,
                                availableItems: [
                                  MENU_ITEMS_MASTER["str-corn-pepper"],
                                  MENU_ITEMS_MASTER["cur-dal-makhani"],
                                ],
                              },
                            ])
                          }
                          className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-xl"
                        >
                          + Add Course Category
                        </button>
                      </div>

                      <div className="space-y-4">
                        {templateFormRules.map((rule, idx) => (
                          <div
                            key={idx}
                            className="p-5 bg-[#FCF9F5] rounded-3xl border-2 border-[#EFE7DC] space-y-4 shadow-xs"
                          >
                            {/* Course Category Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/60 pb-3">
                              <div className="flex items-center space-x-2.5">
                                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold shrink-0">
                                  {idx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={rule.category}
                                  onChange={(e) => {
                                    const copy = [...templateFormRules];
                                    copy[idx].category = e.target.value;
                                    setTemplateFormRules(copy);
                                  }}
                                  placeholder="Course Name (e.g. Starters)"
                                  className="px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-black text-stone-900 bg-white focus:outline-none focus:border-amber-600"
                                />
                                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-200">
                                  {rule.availableItems?.length || 0} Dishes Assigned
                                </span>
                              </div>

                              <div className="flex items-center space-x-3 text-xs">
                                <span className="text-stone-500 font-medium">Customer Quota:</span>
                                <span className="font-semibold text-stone-700">Choose</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={15}
                                  value={rule.maxSelections}
                                  onChange={(e) => {
                                    const copy = [...templateFormRules];
                                    copy[idx].maxSelections = parseInt(e.target.value) || 1;
                                    setTemplateFormRules(copy);
                                  }}
                                  className="w-12 px-2 py-1 rounded-lg border border-stone-300 text-center font-black bg-white"
                                />
                                <span className="text-stone-500">dishes</span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setTemplateFormRules(templateFormRules.filter((_, i) => i !== idx))
                                  }
                                  className="text-red-500 hover:text-red-700 font-bold px-2 py-1 ml-2 text-xs"
                                >
                                  Delete Course
                                </button>
                              </div>
                            </div>

                            {/* ASSIGNED RECIPES & DISHES SECTION */}
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                                  Recipes &amp; Dishes in &quot;{rule.category}&quot; ({rule.availableItems?.length || 0}):
                                </span>
                              </div>

                              {/* Dishes List */}
                              {(!rule.availableItems || rule.availableItems.length === 0) ? (
                                <div className="p-4 rounded-2xl bg-white border border-dashed border-stone-300 text-stone-400 text-xs text-center">
                                  No dishes assigned to this course yet. Use the 3 options below to add recipes.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                  {rule.availableItems.map((item) => (
                                    <div
                                      key={item.id}
                                      className="p-2.5 bg-white rounded-xl border border-stone-200 flex items-center justify-between gap-2 shadow-2xs hover:border-amber-300 transition-all"
                                    >
                                      <div className="flex items-center space-x-2 min-w-0">
                                        <span
                                          className={`w-2 h-2 rounded-full shrink-0 ${item.dietary === "VEG" ? "bg-emerald-600" : "bg-red-600"
                                            }`}
                                        />
                                        <div className="min-w-0">
                                          <h5 className="font-bold text-xs text-stone-900 truncate">
                                            {item.name}
                                          </h5>
                                          <span className="text-[10px] text-stone-500 block">
                                            {item.basePortionPerPax} {item.portionUnit} • ₹{item.approxCostPerPax}/pax
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveItemFromCategory(idx, item.id)}
                                        className="text-stone-300 hover:text-red-600 font-bold text-base px-1.5"
                                        title="Remove dish"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* AJAX AUTOCOMPLETE ON TYPING DISH ASSIGNMENT */}
                              <div className="pt-2 border-t border-stone-200/60">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <div className="relative flex-1 min-w-0">
                                    <div className="relative">
                                      <span className="absolute left-3 top-2.5 text-stone-400 text-xs">
                                        🔍
                                      </span>
                                      <input
                                        type="text"
                                        value={dishSearchQueries[idx] || ""}
                                        onFocus={() => setFocusedRuleIndex(idx)}
                                        onBlur={() => {
                                          setTimeout(() => {
                                            setFocusedRuleIndex((current) => (current === idx ? null : current));
                                          }, 250);
                                        }}
                                        onChange={(e) => {
                                          setDishSearchQueries({
                                            ...dishSearchQueries,
                                            [idx]: e.target.value,
                                          });
                                          setFocusedRuleIndex(idx);
                                        }}
                                        placeholder={`Search & assign dish to ${rule.category} (e.g. Chicken, Paneer, Biryani)...`}
                                        className="w-full pl-9 pr-8 py-2 bg-white rounded-xl border border-stone-300 focus:border-amber-500 text-xs font-semibold text-stone-900 focus:outline-none transition-all shadow-2xs"
                                      />
                                      {dishSearchQueries[idx] && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDishSearchQueries({
                                              ...dishSearchQueries,
                                              [idx]: "",
                                            });
                                          }}
                                          className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-700 text-xs font-bold"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>

                                    {/* LIVE AJAX AUTOCOMPLETE FLOATING DROPDOWN */}
                                    {focusedRuleIndex === idx && (
                                      <div
                                        onMouseDown={(e) => e.preventDefault()}
                                        className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden max-h-56 overflow-y-auto divide-y divide-stone-100 animate-in fade-in zoom-in-95 duration-150"
                                      >
                                        {(() => {
                                          const q = (dishSearchQueries[idx] || "")
                                            .toLowerCase()
                                            .trim();
                                          const matches = recipeCatalog.filter((d) => {
                                            if (!q) {
                                              return (
                                                d.category
                                                  .toLowerCase()
                                                  .includes(rule.category.toLowerCase()) ||
                                                rule.category
                                                  .toLowerCase()
                                                  .includes(d.category.toLowerCase())
                                              );
                                            }
                                            return (
                                              d.name.toLowerCase().includes(q) ||
                                              d.category.toLowerCase().includes(q) ||
                                              d.dietary.toLowerCase().includes(q)
                                            );
                                          });

                                          if (matches.length === 0) {
                                            return (
                                              <div className="p-3 text-center text-xs text-stone-400">
                                                No dishes matching &quot;{q}&quot; in catalog.
                                              </div>
                                            );
                                          }

                                          return matches.map((d) => {
                                            const isAssigned = (
                                              rule.availableItems || []
                                            ).some((it) => it.id === d.id);

                                            return (
                                              <div
                                                key={d.id}
                                                onClick={() => {
                                                  if (!isAssigned) {
                                                    handleAddDishToTemplateCategory(
                                                      idx,
                                                      d.id
                                                    );
                                                    setDishSearchQueries({
                                                      ...dishSearchQueries,
                                                      [idx]: "",
                                                    });
                                                    setFocusedRuleIndex(null);
                                                  }
                                                }}
                                                className={`p-2.5 flex items-center justify-between gap-2 transition-all ${
                                                  isAssigned
                                                    ? "bg-stone-50/70 text-stone-400 cursor-default"
                                                    : "hover:bg-amber-50 cursor-pointer text-stone-900"
                                                }`}
                                              >
                                                <div className="flex items-center space-x-2.5 min-w-0">
                                                  <span
                                                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                                      d.dietary === "VEG"
                                                        ? "bg-emerald-600"
                                                        : "bg-red-600"
                                                    }`}
                                                  />
                                                  <div className="min-w-0">
                                                    <span className="font-bold text-xs truncate block">
                                                      {d.name}
                                                    </span>
                                                    <span className="text-[10px] text-stone-500">
                                                      {d.category} • {d.basePortionPerPax}{" "}
                                                      {d.portionUnit}
                                                    </span>
                                                  </div>
                                                </div>

                                                <div className="flex items-center space-x-2 shrink-0">
                                                  <span className="font-mono font-bold text-xs text-amber-900">
                                                    ₹{d.approxCostPerPax}/pax
                                                  </span>
                                                  <span
                                                    className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                                      isAssigned
                                                        ? "bg-stone-200 text-stone-600"
                                                        : "bg-amber-600 text-white shadow-2xs"
                                                    }`}
                                                  >
                                                    {isAssigned ? "✓ Assigned" : "+ Add"}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveCategoryRuleIndex(idx);
                                      setSelectedRecipesToImport(
                                        (rule.availableItems || []).map((it) => it.id)
                                      );
                                      setShowDirectDishPickerModal(true);
                                    }}
                                    className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all shrink-0 flex items-center space-x-1 shadow-2xs whitespace-nowrap"
                                  >
                                    <span>📋 Full List</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-stone-100 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsEditingTemplate(false)}
                        className="px-5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTemplateForm}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 text-white text-xs font-black rounded-xl shadow-sm"
                      >
                        Save Template &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: RECIPE & DISH CATALOG (CREATE, EXCEL UPLOAD, KITCHEN SYNC)  */}
          {/* ================================================================= */}
          {activeView === "RECIPES" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                {/* Catalog Header with Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                      Master Culinary Catalog
                    </span>
                    <h2 className="text-2xl font-black text-[#1a120b] tracking-tight">
                      Catering Recipes &amp; Dishes ({recipeCatalog.length})
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Create, import, and manage all dishes available for catering templates.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleSyncFromKitchenRecipes}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all flex items-center space-x-1.5 shadow-2xs"
                    >
                      <span>Sync Kitchen Recipes</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenExcelCatalogUpload}
                      className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 text-xs font-bold transition-all flex items-center space-x-1.5 shadow-2xs"
                    >
                      <span>Upload via Excel / CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenCreateCatalogDish}
                      className="px-4 py-2 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
                    >
                      <span>+</span>
                      <span>Create New Dish</span>
                    </button>
                  </div>
                </div>

                {/* Filters Bar */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <input
                        type="text"
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        placeholder="Search dishes by name or keyword..."
                        className="w-full px-4 py-2.5 rounded-2xl border border-stone-200 text-xs font-semibold focus:outline-none focus:border-amber-600 pl-9"
                      />
                      <span className="absolute left-3 top-2.5 text-stone-400 text-sm">🔍</span>
                    </div>

                    <div className="flex items-center space-x-1.5 w-full sm:w-auto">
                      {(["ALL", "VEG", "NON_VEG"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setCatalogDietFilter(d)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${catalogDietFilter === d
                              ? "bg-[#1a120b] text-white border-[#1a120b]"
                              : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                            }`}
                        >
                          {d === "ALL" ? "All Diets" : d === "VEG" ? "🟢 Pure Veg" : "🔴 Non-Veg"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {[
                      "ALL",
                      "Welcome Drink",
                      "Starter",
                      "Biryani",
                      "Curry",
                      "Breads",
                      "Rice & Sambar",
                      "Sweets",
                      "Ice Cream",
                    ].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCatalogCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${catalogCategoryFilter === cat
                            ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                            : "bg-[#FAF6F0] text-stone-700 border-[#E8DFC8] hover:bg-white"
                          }`}
                      >
                        {cat === "ALL" ? "All Categories" : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dishes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {recipeCatalog
                    .filter((dish) => {
                      const matchQuery =
                        dish.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                        dish.category.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                        (dish.description &&
                          dish.description.toLowerCase().includes(catalogSearch.toLowerCase()));
                      const matchDiet =
                        catalogDietFilter === "ALL" ? true : dish.dietary === catalogDietFilter;
                      const matchCategory =
                        catalogCategoryFilter === "ALL"
                          ? true
                          : dish.category.toLowerCase().includes(catalogCategoryFilter.toLowerCase());
                      return matchQuery && matchDiet && matchCategory;
                    })
                    .map((dish) => (
                      <div
                        key={dish.id}
                        className="p-4 bg-[#FCF9F5] rounded-2xl border border-[#EFE7DC] hover:border-amber-300 transition-all flex flex-col justify-between space-y-3 shadow-2xs group"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center space-x-2 min-w-0">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${dish.dietary === "VEG" ? "bg-emerald-600" : "bg-red-600"
                                  }`}
                              />
                              <h4 className="font-bold text-sm text-stone-900 truncate">{dish.name}</h4>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-bold shrink-0">
                              {dish.category}
                            </span>
                          </div>

                          <p className="text-xs text-stone-500 line-clamp-2">{dish.description}</p>
                        </div>

                        <div className="pt-2.5 border-t border-[#E8DFC8]/60 flex items-center justify-between text-xs">
                          <div className="space-x-2">
                            <span className="font-bold text-amber-950 font-mono">
                              ₹{dish.approxCostPerPax}/pax
                            </span>
                            <span className="text-stone-400">
                              • {dish.basePortionPerPax} {dish.portionUnit}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${dish.spiceLevel === "SPICY"
                                  ? "bg-red-100 text-red-800"
                                  : dish.spiceLevel === "MEDIUM"
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                            >
                              {dish.spiceLevel}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleDeleteCatalogDish(dish.id)}
                              className="text-stone-300 hover:text-red-600 transition-all font-bold text-sm px-1 opacity-60 group-hover:opacity-100"
                              title="Delete dish from catalog"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 4: LINK SHARE TRACKER (AUDIENCE SELECTION STATUS)            */}
          {/* ================================================================= */}
          {activeView === "LINK_TRACKER" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                    Audience Portal Monitoring
                  </span>
                  <h2 className="text-2xl font-black text-[#1a120b] tracking-tight">
                    Customer Link Shares & Selection Status
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Live status of invitation links sent to hosts. Track who has opened their link and who has submitted menu choices.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF6F0] text-stone-600 border-y border-[#E8DFC8]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Event & Token Ref</th>
                        <th className="py-3 px-4 font-bold">Customer Host</th>
                        <th className="py-3 px-4 font-bold">Date & Headcount</th>
                        <th className="py-3 px-4 font-bold">Assigned Template</th>
                        <th className="py-3 px-4 font-bold text-center">Link Opened?</th>
                        <th className="py-3 px-4 font-bold">Selection Status</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {eventsList.map((ev) => (
                        <tr key={ev.id} className="hover:bg-stone-50/60">
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-900">
                            <div>{ev.id}</div>
                            <span className="text-[11px] font-sans text-stone-800 font-semibold">{ev.eventName}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-stone-800">{ev.customerName}</div>
                            <span className="text-stone-500 font-mono text-[11px]">{ev.customerPhone}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-stone-800">{ev.eventDate}</div>
                            <span className="text-stone-500">{ev.guestCount.toLocaleString()} Guests ({ev.mealType})</span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-stone-700">
                            <select
                              value={ev.templateId}
                              onChange={(e) => handleReassignEventTemplate(ev.id, e.target.value)}
                              className="px-2 py-1 rounded-lg border border-stone-300 bg-white text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                            >
                              {templates.map((tmpl) => (
                                <option key={tmpl.id} value={tmpl.id}>
                                  {tmpl.name} (₹{tmpl.basePricePerPax}/Pax)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ev.linkOpened ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-stone-500"}`}>
                              {ev.linkOpened ? "✓ Opened" : "Pending"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-bold border ${ev.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                : ev.status === "CUSTOMER_SUBMITTED"
                                  ? "bg-blue-100 text-blue-900 border-blue-300"
                                  : "bg-amber-100 text-amber-900 border-amber-300"
                                }`}
                            >
                              {ev.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleCopyLink(ev.id)}
                              className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-[11px]"
                            >
                              {copiedToken === ev.id ? "✓ Copied" : "Copy Link"}
                            </button>
                            <button
                              onClick={() => handleWhatsAppReminder(ev)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px]"
                            >
                              WhatsApp
                            </button>
                            <button
                              onClick={() => {
                                setSelectedEventId(ev.id);
                                setActiveView("PIPELINE");
                              }}
                              className="px-3 py-1 rounded-lg bg-[#1a120b] hover:bg-stone-800 text-amber-300 font-bold text-[11px]"
                            >
                              Open Pipeline &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 5: FULL 7-STAGE PIPELINE STUDIO FOR ACTIVE EVENT              */}
          {/* ================================================================= */}
          {activeView === "PIPELINE" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Pipeline Ribbon */}
              <div className="bg-white rounded-3xl border border-[#E8DFC8] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-amber-900">{activeEvent.id}</span>
                    <span className="text-xs text-stone-400">•</span>
                    <span className="text-xs font-medium text-stone-600">{activeEvent.eventName}</span>
                  </div>
                  <h3 className="text-xl font-black text-[#1a120b]">
                    7-Stage Sales & Production Pipeline
                  </h3>
                </div>

                <div className="flex items-center space-x-2 overflow-x-auto">
                  {[
                    { id: "EVENT_SETUP", label: "1. Event Setup" },
                    { id: "TEMPLATE_SELECTION", label: "2. Template" },
                    { id: "MENU_BUILDER", label: "3. Menu Options" },
                    { id: "LIVE_COUNTERS", label: "4. Live Counters" },
                    { id: "AI_VALIDATION", label: "5. AI Validation" },
                    { id: "QUOTATION_STUDIO", label: "6. Quotation" },
                    { id: "PRODUCTION_BATCH", label: "7. Production" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setPipelineStage(s.id as PipelineStage)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${pipelineStage === s.id
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                        }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stage 1: Setup & Customer Link */}
              {pipelineStage === "EVENT_SETUP" && (
                <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                  <div className="p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/15 rounded-2xl border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-900 tracking-wider">
                        Customer Menu Selection Portal Link
                      </span>
                      <h4 className="font-black text-lg text-[#1a120b]">Share Link with Host</h4>
                      <p className="text-xs text-stone-600">
                        Zero password portal for {eventDetails.customer.name} to pick items within template quotas.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleCopyLink(activeEvent.id)}
                        className="px-4 py-2 bg-white border border-stone-300 hover:border-amber-500 text-stone-800 font-bold text-xs rounded-xl shadow-xs"
                      >
                        {copiedToken === activeEvent.id ? "✓ Copied" : "📋 Copy Link"}
                      </button>
                      <button
                        onClick={() => handleWhatsAppReminder(activeEvent)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        💬 WhatsApp
                      </button>
                      <a
                        href={getCustomerPortalUrl(activeEvent.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-[#1a120b] text-amber-300 font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1"
                      >
                        <span>Open Portal</span>
                        <span>↗</span>
                      </a>
                    </div>
                  </div>

                  {/* Form Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">Host Name</label>
                      <input
                        type="text"
                        value={eventDetails.customer.name}
                        onChange={(e) =>
                          setEventDetails({
                            ...eventDetails,
                            customer: { ...eventDetails.customer, name: e.target.value },
                          })
                        }
                        className="w-full px-4 py-2 rounded-xl border border-stone-300 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">Host Phone</label>
                      <input
                        type="text"
                        value={eventDetails.customer.phone}
                        onChange={(e) =>
                          setEventDetails({
                            ...eventDetails,
                            customer: { ...eventDetails.customer, phone: e.target.value },
                          })
                        }
                        className="w-full px-4 py-2 rounded-xl border border-stone-300 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">Guest Headcount (Pax)</label>
                      <input
                        type="number"
                        value={eventDetails.guestCount}
                        onChange={(e) =>
                          setEventDetails({
                            ...eventDetails,
                            guestCount: parseInt(e.target.value) || 100,
                          })
                        }
                        className="w-full px-4 py-2 rounded-xl border border-stone-300 text-sm font-black text-amber-900"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex justify-end">
                    <button
                      onClick={() => setPipelineStage("TEMPLATE_SELECTION")}
                      className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl"
                    >
                      Next: Template Selection &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Stage 2: Template Selection */}
              {pipelineStage === "TEMPLATE_SELECTION" && (
                <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-[#1a120b]">Assign Catering Template</h3>
                      <p className="text-xs text-stone-500">Pick a template matching {eventDetails.eventType}.</p>
                    </div>
                    <button
                      onClick={() => setActiveView("TEMPLATES")}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800"
                    >
                      + Create New Custom Template &rarr;
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {templates.map((t) => {
                      const isSelected = selectedTemplate.id === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTemplate(t)}
                          className={`p-6 rounded-3xl cursor-pointer transition-all border-2 flex flex-col justify-between ${isSelected ? "bg-white border-amber-600 shadow-md" : "bg-[#FCF9F5] border-[#EFE7DC] hover:border-amber-300"
                            }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-900">
                                ₹{t.basePricePerPax} / Pax
                              </span>
                              {isSelected && <span className="text-xs font-bold text-amber-700">✓ Active</span>}
                            </div>
                            <h4 className="text-base font-black text-[#1a120b]">{t.name}</h4>
                            <p className="text-xs text-stone-600 line-clamp-2">{t.description}</p>
                          </div>

                          <div className="pt-4 mt-4 border-t border-stone-200 flex justify-between items-center text-xs">
                            <span className="text-stone-500">{t.categoryRules.length} Courses</span>
                            <span className={`font-bold ${isSelected ? "text-amber-800" : "text-stone-600"}`}>
                              {isSelected ? "Selected" : "Select"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex justify-end">
                    <button
                      onClick={() => setPipelineStage("MENU_BUILDER")}
                      className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl"
                    >
                      Next: Menu Course Options &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Stage 3: Menu Builder */}
              {pipelineStage === "MENU_BUILDER" && (
                <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-[#1a120b]">Course Menu Selection</h3>
                      <p className="text-xs text-stone-500">Template limits enforced ({selectedItemIds.length} items chosen).</p>
                    </div>
                    <button
                      onClick={() => setPipelineStage("LIVE_COUNTERS")}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl"
                    >
                      Next: Live Counters ({selectedAddonIds.length}) &rarr;
                    </button>
                  </div>

                  <div className="space-y-6">
                    {selectedTemplate.categoryRules.map((rule) => {
                      const selectedInCat = selectedItemIds.filter(
                        (id) => MENU_ITEMS_MASTER[id]?.category === rule.category
                      );
                      return (
                        <div key={rule.category} className="p-5 bg-[#FCF9F5] rounded-2xl border border-[#EFE7DC] space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-black text-sm text-[#1a120b]">{rule.category}</h4>
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-white border border-stone-300">
                              {selectedInCat.length} / {rule.maxSelections} Chosen
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {rule.availableItems.map((item) => {
                              const isPicked = selectedItemIds.includes(item.id);
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    if (isPicked) {
                                      setSelectedItemIds(selectedItemIds.filter((id) => id !== item.id));
                                    } else {
                                      setSelectedItemIds([...selectedItemIds, item.id]);
                                    }
                                  }}
                                  className={`p-3 rounded-xl cursor-pointer border transition-all ${isPicked ? "bg-amber-50 border-amber-600 shadow-xs" : "bg-white border-stone-200"
                                    }`}
                                >
                                  <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className={item.dietary === "VEG" ? "text-emerald-700" : "text-red-700"}>
                                      {item.dietary}
                                    </span>
                                    {isPicked && <span className="text-amber-800">✓</span>}
                                  </div>
                                  <div className="font-bold text-xs text-[#1a120b] mt-1">{item.name}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stage 4: Live Counters */}
              {pipelineStage === "LIVE_COUNTERS" && (
                <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-[#1a120b]">Specialty Live Counters</h3>
                      <p className="text-xs text-stone-500">Live action culinary counters.</p>
                    </div>
                    <button
                      onClick={() => setPipelineStage("AI_VALIDATION")}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl"
                    >
                      Run AI Validation &rarr;
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {LIVE_COUNTERS_MASTER.map((addon) => {
                      const isPicked = selectedAddonIds.includes(addon.id);
                      return (
                        <div
                          key={addon.id}
                          onClick={() => {
                            if (isPicked) {
                              setSelectedAddonIds(selectedAddonIds.filter((id) => id !== addon.id));
                            } else {
                              setSelectedAddonIds([...selectedAddonIds, addon.id]);
                            }
                          }}
                          className={`p-5 rounded-2xl cursor-pointer border-2 transition-all ${isPicked ? "bg-amber-50/70 border-amber-600 shadow-sm" : "bg-[#FCF9F5] border-[#EFE7DC]"
                            }`}
                        >
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold uppercase text-stone-500">{addon.category.replace("_", " ")}</span>
                            <span className="font-black text-amber-900">+₹{addon.pricePerPax} / Pax</span>
                          </div>
                          <h4 className="font-black text-sm text-[#1a120b] mt-2">{addon.name}</h4>
                          <p className="text-xs text-stone-600 mt-1">{addon.description}</p>
                          <div className="pt-3 mt-3 border-t border-stone-200/70 flex justify-between text-xs font-bold">
                            <span className="text-stone-500">₹{(addon.pricePerPax * eventDetails.guestCount).toLocaleString()} Total</span>
                            <span className={isPicked ? "text-amber-800" : "text-stone-600"}>
                              {isPicked ? "✓ Added" : "+ Add"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stage 5: AI Validation */}
              {pipelineStage === "AI_VALIDATION" && (
                <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-[#1a120b]">AI Menu Validation & Advisories</h3>
                      <p className="text-xs text-stone-500">
                        Status: <strong className="text-amber-900">{validationReport.overallStatus}</strong> &bull; Variety: {validationReport.nutritionProfile?.varietyScore}/100
                      </p>
                    </div>
                    <button
                      onClick={() => setPipelineStage("QUOTATION_STUDIO")}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl"
                    >
                      Next: Quotation Studio &rarr;
                    </button>
                  </div>

                  <div className="space-y-4">
                    {validationReport.advisories.map((adv) => (
                      <div
                        key={adv.id}
                        className={`p-5 rounded-2xl border text-xs space-y-2 ${adv.level === "GREEN" ? "bg-emerald-50/60 border-emerald-300" : "bg-amber-50/70 border-amber-300"
                          }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{adv.title}</span>
                          <span className="text-[10px] uppercase font-mono">{adv.level}</span>
                        </div>
                        <p className="text-stone-700">{adv.message}</p>
                        {adv.suggestedReplacement && (
                          <div className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between">
                            <span>Swap {adv.suggestedReplacement.removeName} &rarr; <strong>{adv.suggestedReplacement.suggestedName}</strong></span>
                            <button
                              onClick={() => {
                                setSelectedItemIds((prev) =>
                                  prev.map((id) => (id === adv.suggestedReplacement!.removeId ? adv.suggestedReplacement!.suggestedId : id))
                                );
                              }}
                              className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg"
                            >
                              1-Click Swap
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stage 6: Quotation Studio */}
              {pipelineStage === "QUOTATION_STUDIO" && (
                <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
                    <div>
                      <h3 className="text-2xl font-black text-[#1a120b]">Quotation & True P&L Costing</h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Itemized operational expenditures for {eventDetails.guestCount.toLocaleString()} Guests.
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          setIsQuotationApproved(true);
                          setPipelineStage("PRODUCTION_BATCH");
                        }}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm"
                      >
                        ✓ Approve Quotation & Lock
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-3">
                      <h4 className="font-bold text-sm text-[#1a120b]">Direct Costing Ledger</h4>
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#FAF6F0] border-y border-stone-200 text-stone-600">
                          <tr>
                            <th className="py-2 px-3 font-bold">Category</th>
                            <th className="py-2 px-3 font-bold">Unit Rate</th>
                            <th className="py-2 px-3 font-bold text-right">Total Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {costBreakdown.costItems.map((ci, i) => (
                            <tr key={i}>
                              <td className="py-2 px-3 font-medium">{ci.name}</td>
                              <td className="py-2 px-3 font-mono text-stone-500">₹{ci.unitCost}</td>
                              <td className="py-2 px-3 font-mono font-bold text-right">₹{ci.totalCost.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t font-bold bg-[#FAF6F0]">
                          <tr>
                            <td colSpan={2} className="py-2.5 px-3">Total Direct Cost</td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-amber-900">
                              ₹{costBreakdown.totalDirectCost.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="p-6 bg-[#FCF9F5] rounded-3xl border border-[#EFE7DC] space-y-4">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Proposal Summary</span>
                      <div className="text-2xl font-black text-amber-900 font-mono">
                        ₹{currentQuotation?.finalTotalAmount.toLocaleString()}
                      </div>
                      <div className="text-xs font-bold text-emerald-800">
                        ₹{currentQuotation?.finalPricePerPax} / Guest
                      </div>
                      <div className="pt-4 border-t border-stone-200 text-xs space-y-2">
                        <div className="flex justify-between">
                          <span>Gross Margin:</span>
                          <strong className="text-emerald-700">{costBreakdown.targetMarginPercent}%</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Direct Profit:</span>
                          <strong className="font-mono">
                            ₹{((currentQuotation?.finalTotalAmount || 0) - costBreakdown.totalDirectCost).toLocaleString()}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 7: Kitchen Production Batch */}
              {pipelineStage === "PRODUCTION_BATCH" && (
                <div className="bg-white rounded-3xl border border-[#E8DFC8] p-7 shadow-xs space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-[#1a120b]">Kitchen Batch & Procurement Handoff</h3>
                      <p className="text-xs text-stone-500">Scaled recipe production sheet for {eventDetails.guestCount.toLocaleString()} guests.</p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 border border-stone-300 font-bold text-xs rounded-xl"
                    >
                      Print Prep Sheet
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="p-5 bg-[#FCF9F5] rounded-2xl border border-[#EFE7DC] space-y-2 text-xs">
                      <span className="text-[10px] font-bold uppercase text-amber-800 block">Biryani Station</span>
                      <h4 className="font-bold text-sm text-[#1a120b]">Dum Handi Prep</h4>
                      <p className="font-mono text-stone-700">Chicken Dum Biryani: <strong>120 kg (4 Handis)</strong></p>
                      <p className="font-mono text-stone-700">Steamed Rice: <strong>80 kg</strong></p>
                    </div>

                    <div className="p-5 bg-[#FCF9F5] rounded-2xl border border-[#EFE7DC] space-y-2 text-xs">
                      <span className="text-[10px] font-bold uppercase text-amber-800 block">Curry Station</span>
                      <h4 className="font-bold text-sm text-[#1a120b]">Large Pot Deghs</h4>
                      <p className="font-mono text-stone-700">Butter Chicken: <strong>150 kg (Degh 1)</strong></p>
                      <p className="font-mono text-stone-700">Veg Gravy: <strong>140 kg (Degh 2)</strong></p>
                    </div>

                    <div className="p-5 bg-[#FCF9F5] rounded-2xl border border-[#EFE7DC] space-y-2 text-xs">
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">Central Store</span>
                      <h4 className="font-bold text-sm text-[#1a120b]">Procurement Depletion</h4>
                      <p className="font-mono text-stone-700">Aged Basmati: <strong>140 kg</strong></p>
                      <p className="font-mono text-stone-700">Chicken / Meat: <strong>210 kg</strong></p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* =================================================================== */}
        {/* QUICK ACTION MODAL: BOOK NEW CATERING EVENT                        */}
        {/* =================================================================== */}
        {showNewEventModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border-2 border-amber-500 max-w-xl w-full p-7 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="text-xl font-black text-[#1a120b]">Register New Catering Event</h3>
                <button
                  onClick={() => setShowNewEventModal(false)}
                  className="text-stone-400 hover:text-stone-700 text-2xl font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Host / Customer Name *</label>
                  <input
                    type="text"
                    value={newEventHost}
                    onChange={(e) => setNewEventHost(e.target.value)}
                    placeholder="e.g. Ramesh Varma"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">WhatsApp / Phone *</label>
                  <input
                    type="text"
                    value={newEventPhone}
                    onChange={(e) => setNewEventPhone(e.target.value)}
                    placeholder="+91 98480 ..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">Event Title *</label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="e.g. Varma Family Reception Gala"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Event Date</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Guest Headcount (Pax)</label>
                  <input
                    type="number"
                    value={newEventPax}
                    onChange={(e) => setNewEventPax(parseInt(e.target.value) || 100)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-black text-amber-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Event Type</label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold bg-white"
                  >
                    <option value="WEDDING">Wedding Ceremony</option>
                    <option value="RECEPTION">Reception & Sangeet</option>
                    <option value="CORPORATE">Corporate Banquet</option>
                    <option value="HOUSEWARMING">Gruhapravesam</option>
                    <option value="BIRTHDAY">Birthday Gala</option>
                    <option value="CUSTOM">Custom Private Event</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Meal Slot</label>
                  <select
                    value={newEventMeal}
                    onChange={(e) => setNewEventMeal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold bg-white"
                  >
                    <option value="LUNCH">Afternoon Lunch</option>
                    <option value="DINNER">Night Dinner</option>
                    <option value="BREAKFAST">Morning Breakfast</option>
                    <option value="HIGH_TEA">High Tea</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Assign Catering Template to Customer *
                  </label>
                  <select
                    value={newEventTemplateId}
                    onChange={(e) => setNewEventTemplateId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-amber-400 text-xs font-bold text-stone-900 bg-amber-50/40 focus:outline-none focus:border-amber-600"
                  >
                    {templates.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name} (₹{tmpl.basePricePerPax}/Pax • {tmpl.categoryRules.length} Courses • {tmpl.applicableEventTypes.join(", ")})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-stone-500 mt-1">
                    The customer will select dishes according to this package&apos;s course limits.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-stone-700 block mb-1">Venue Location</label>
                  <input
                    type="text"
                    value={newEventVenue}
                    onChange={(e) => setNewEventVenue(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex justify-end space-x-3">
                <button
                  onClick={() => setShowNewEventModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNewEvent}
                  className="px-6 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-black rounded-xl shadow-sm"
                >
                  Register & Generate Portal Link &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
        {/* =================================================================== */}
        {/* MODAL 1: DIRECT DISH PICKER CHECKLIST (FOR TEMPLATE STUDIO)        */}
        {/* =================================================================== */}
        {showDirectDishPickerModal && activeCategoryRuleIndex !== null && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowDirectDishPickerModal(false);
            }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl border-2 border-amber-500 max-w-3xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                    Course Dish Assignment
                  </span>
                  <h3 className="text-xl font-black text-[#1a120b]">
                    Assign Dishes to &quot;{templateFormRules[activeCategoryRuleIndex]?.category}&quot;
                  </h3>
                </div>
                <button
                  onClick={() => setShowDirectDishPickerModal(false)}
                  className="text-stone-400 hover:text-stone-700 text-2xl font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  placeholder="Search dishes by name or category..."
                  className="w-full sm:flex-1 px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:border-amber-600"
                />
                <div className="flex items-center space-x-1.5 w-full sm:w-auto">
                  {(["ALL", "VEG", "NON_VEG"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setRecipeDietFilter(f)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        recipeDietFilter === f
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      {f === "ALL" ? "All Dishes" : f === "VEG" ? "🟢 Pure Veg" : "🔴 Non-Veg"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipe Checklist */}
              <div className="flex-1 overflow-y-auto space-y-2 border border-stone-200 rounded-2xl p-3 bg-stone-50/50 max-h-96">
                {recipeCatalog
                  .filter((r) => {
                    const matchQuery =
                      r.name.toLowerCase().includes(recipeSearch.toLowerCase()) ||
                      r.category.toLowerCase().includes(recipeSearch.toLowerCase());
                    const matchDiet =
                      recipeDietFilter === "ALL" ? true : r.dietary === recipeDietFilter;
                    return matchQuery && matchDiet;
                  })
                  .map((r) => {
                    const isSelected = selectedRecipesToImport.includes(r.id);

                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedRecipesToImport(
                              selectedRecipesToImport.filter((id) => id !== r.id)
                            );
                          } else {
                            setSelectedRecipesToImport([...selectedRecipesToImport, r.id]);
                          }
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-amber-50/80 border-amber-500 shadow-2xs"
                            : "bg-white border-stone-200 hover:border-amber-300"
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              r.dietary === "VEG" ? "bg-emerald-600" : "bg-red-600"
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <h5 className="font-bold text-xs text-stone-900 truncate">
                                {r.name}
                              </h5>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-mono">
                                {r.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-500 truncate">{r.description}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-stone-800 font-mono block">
                            ₹{r.approxCostPerPax}/pax
                          </span>
                          <span className="text-[10px] text-stone-400">
                            {r.basePortionPerPax} {r.portionUnit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-600">
                  {selectedRecipesToImport.length} dishes selected for &quot;{templateFormRules[activeCategoryRuleIndex]?.category}&quot;
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowDirectDishPickerModal(false)}
                    className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDirectDishPicker}
                    className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 text-white text-xs font-black rounded-xl shadow-xs transition-all"
                  >
                    Apply Selection ({selectedRecipesToImport.length}) &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 2: UPLOAD DISHES TO CATALOG VIA EXCEL / CSV                   */}
        {/* =================================================================== */}
        {showExcelUploadModal && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowExcelUploadModal(false);
            }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl border-2 border-blue-500 max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider">
                    Bulk Excel / CSV Importer
                  </span>
                  <h3 className="text-xl font-black text-[#1a120b]">
                    Upload Dishes to Catering Catalog
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExcelUploadModal(false)}
                  className="text-stone-400 hover:text-stone-700 text-2xl font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Sample Download banner */}
              <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-blue-900 block">Expected Columns:</span>
                  <span className="text-blue-700 font-mono text-[11px]">
                    Item Name, Dietary, Portion per Pax, Unit, Cost per Pax, Spice Level, Description
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="px-3 py-1.5 bg-white border border-blue-300 text-blue-800 hover:bg-blue-100 font-bold rounded-xl text-xs shrink-0 shadow-2xs"
                >
                  Download Sample CSV 📥
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-6 text-center bg-blue-50/20 cursor-pointer transition-all space-y-2">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsvFileUpload}
                  className="w-full text-xs font-medium text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
                <p className="text-[11px] text-stone-500">
                  Select your CSV/Excel spreadsheet to extract recipes automatically.
                </p>
                {excelFileName && (
                  <p className="text-xs font-bold text-blue-900 mt-1">
                    ✓ File selected: <strong>{excelFileName}</strong> ({excelParsedItems.length} items parsed)
                  </p>
                )}
              </div>

              {/* Parsed Items Preview */}
              {excelParsedItems.length > 0 && (
                <div className="flex-1 overflow-y-auto max-h-48 border border-stone-200 rounded-2xl p-2.5 bg-stone-50 space-y-1.5">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                    Parsed Preview ({excelParsedItems.length} dishes):
                  </span>
                  {excelParsedItems.map((item, i) => (
                    <div
                      key={i}
                      className="p-2 bg-white rounded-xl border border-stone-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.dietary === "VEG" ? "bg-emerald-600" : "bg-red-600"
                          }`}
                        />
                        <span className="font-bold text-stone-900">{item.name}</span>
                        <span className="text-stone-400">• {item.basePortionPerPax} {item.portionUnit}</span>
                      </div>
                      <span className="font-mono font-bold text-stone-700">₹{item.approxCostPerPax}/pax</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowExcelUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExcelCatalogUpload}
                  disabled={excelParsedItems.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition-all"
                >
                  Confirm &amp; Add ({excelParsedItems.length}) Dishes to Catalog &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 3: CREATE CUSTOM RECIPE / DISH FOR CATALOG                    */}
        {/* =================================================================== */}
        {showCreateItemModal && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreateItemModal(false);
            }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl border-2 border-amber-500 max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                    New Culinary Dish
                  </span>
                  <h3 className="text-xl font-black text-[#1a120b]">
                    Create Dish for Catering Catalog
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateItemModal(false)}
                  className="text-stone-400 hover:text-stone-700 text-2xl font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Item / Dish Name *</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g. Royyala Vepudu (Spicy Prawn Fry)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Category Course</label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold bg-white"
                    >
                      <option value="Welcome Drink">Welcome Drink</option>
                      <option value="Starter">Starter</option>
                      <option value="Biryani">Biryani</option>
                      <option value="Curry">Curry</option>
                      <option value="Breads">Breads</option>
                      <option value="Rice & Sambar">Rice & Sambar</option>
                      <option value="Sweets">Sweets</option>
                      <option value="Ice Cream">Ice Cream</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Spice Level</label>
                    <select
                      value={newItemSpice}
                      onChange={(e) => setNewItemSpice(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold bg-white"
                    >
                      <option value="MILD">MILD</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="SPICY">SPICY</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Dietary Preference</label>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setNewItemDietary("VEG")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                          newItemDietary === "VEG"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-stone-700 border-stone-300"
                        }`}
                      >
                        VEG
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewItemDietary("NON_VEG")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                          newItemDietary === "NON_VEG"
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-white text-stone-700 border-stone-300"
                        }`}
                      >
                        NON-VEG
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Approx Cost per Pax (₹)</label>
                    <input
                      type="number"
                      value={newItemCost}
                      onChange={(e) => setNewItemCost(parseFloat(e.target.value) || 40)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-black text-amber-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Base Portion per Pax</label>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        step={0.05}
                        value={newItemPortion}
                        onChange={(e) => setNewItemPortion(parseFloat(e.target.value) || 0.15)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold"
                      />
                      <select
                        value={newItemUnit}
                        onChange={(e) => setNewItemUnit(e.target.value)}
                        className="px-2 py-2 rounded-xl border border-stone-300 text-xs font-bold bg-white"
                      >
                        <option value="kg">kg</option>
                        <option value="L">L</option>
                        <option value="pcs">pcs</option>
                        <option value="portions">portions</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Short Description</label>
                    <input
                      type="text"
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      placeholder="Brief description..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateItemModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCatalogDish}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 text-white text-xs font-black rounded-xl shadow-xs transition-all"
                >
                  + Save Dish to Catalog
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
