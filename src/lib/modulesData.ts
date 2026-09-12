export interface ModuleFeature {
  title: string;
  description: string;
  badge?: string;
  iconName: string;
}

export interface ModuleFAQ {
  question: string;
  answer: string;
}

export interface ModuleData {
  slug: string;
  name: string;
  shortName: string;
  category: "front-of-house" | "back-of-house" | "workforce" | "financials";
  categoryLabel: string;
  tagline: string;
  heroBadge: string;
  seoTitle?: string;
  description: string;
  primaryStat: string;
  primaryStatLabel: string;
  secondaryStat: string;
  secondaryStatLabel: string;
  accentColor: string;
  accentLightBg: string;
  accentBorder: string;
  accentText: string;
  features: ModuleFeature[];
  beforeRestoBird: string[];
  withRestoBird: string[];
  techSpecs: { label: string; value: string }[];
  faqs: ModuleFAQ[];
  quote: {
    text: string;
    author: string;
    role: string;
    restaurant: string;
  };
}

export const RESTO_BIRD_MODULES: Record<string, ModuleData> = {
  pos: {
    slug: "pos",
    name: "Point of Sale & Kitchen Display System",
    shortName: "POS & KDS",
    category: "front-of-house",
    categoryLabel: "Front of House",
    tagline: "Sub-second order routing with peer-to-peer offline mesh resilience.",
    heroBadge: "OFFLINE MESH & KDS DISPATCH",
    seoTitle: "Restaurant POS Software & Kitchen Display System",
    description:
      "A blazing-fast, crash-proof floor management and billing engine. Resto Bird POS keeps your dining room turning tables faster, splits checks seamlessly, and fires tickets to kitchen stations in under 45 milliseconds—even when your internet connection cuts out completely.",
    primaryStat: "< 45ms",
    primaryStatLabel: "Sub-second KDS dispatch latency",
    secondaryStat: "100%",
    secondaryStatLabel: "Offline mesh continuity during ISP outages",
    accentColor: "amber",
    accentLightBg: "bg-amber-50",
    accentBorder: "border-amber-200",
    accentText: "text-amber-700",
    features: [
      {
        title: "Peer-to-Peer Offline Mesh",
        description:
          "Terminals sync directly over the local Wi-Fi without cloud reliance. If your fiber cuts mid-dinner rush, tables continue firing and receipts keep printing without a hitch.",
        badge: "Zero Downtime",
        iconName: "WifiOff",
      },
      {
        title: "Sub-Second KDS Routing",
        description:
          "Automatic course separation and station routing. Starters route to fry and cold stations; entrees route to grill and curry lines with precise prep pacing.",
        badge: "< 45ms Speed",
        iconName: "Flame",
      },
      {
        title: "Visual Dynamic Floor Map",
        description:
          "Color-coded live floor plans showing elapsed seating times, course statuses, open checks, and server section load balancing in real time.",
        badge: "Floor Radar",
        iconName: "LayoutGrid",
      },
      {
        title: "Flexible Bill Splitting",
        description:
          "Split checks by seat, by dish, by equal percentage, or custom amounts across cash, cards, UPI, and room charges in just two taps.",
        badge: "Fast Checkout",
        iconName: "CreditCard",
      },
      {
        title: "Custom Modifiers & Allergy Flags",
        description:
          "Tiered modifiers, mandatory temperature selections, and bold high-visibility allergy alerts printed directly onto kitchen chits.",
        badge: "Guest Safety",
        iconName: "AlertTriangle",
      },
      {
        title: "Dual Hardware Compatibility",
        description:
          "Runs natively on iPads, Android commercial POS terminals, standard ESC/POS 80mm thermal printers, and Bluetooth customer-facing displays.",
        badge: "Hardware Agnostic",
        iconName: "MonitorSmartphone",
      },
    ],
    beforeRestoBird: [
      "Internet drop causes entire billing system to freeze; servers write paper chits.",
      "Handwritten tickets get lost between dining floor and hot kitchen station.",
      "Complicated bill splits take 5-10 minutes, backing up the server queue.",
      "Kitchen cooks cold apps and hot steaks simultaneously, ruining course pacing.",
    ],
    withRestoBird: [
      "Offline mesh guarantees 100% uninterrupted table billing and printing.",
      "Tickets route to dedicated kitchen displays in 45 milliseconds with visual timers.",
      "Split checks by seat or item in two quick taps with instant invoice printing.",
      "Automated hold-and-fire rules ensure appetizers and mains hit tables piping hot.",
    ],
    techSpecs: [
      { label: "Offline Protocol", value: "Local P2P WebSocket & IndexedDB Mesh" },
      { label: "Dispatch Latency", value: "< 45ms Local LAN / Sub-100ms Cloud" },
      { label: "Printer Support", value: "ESC/POS TCP/IP, USB & Bluetooth (80mm / 58mm)" },
      { label: "Hardware Support", value: "Apple iPadOS, Android 10+, ChromeOS, Windows 11" },
      { label: "Cash Drawer", value: "RJ11 / RJ12 24V Kick Pulse" },
      { label: "Payment Gateways", value: "Stripe Terminal, Square, Razorpay, PhonePe UPI" },
    ],
    faqs: [
      {
        question: "What happens if our restaurant internet completely drops during Friday night rush?",
        answer:
          "Resto Bird switches instantly and transparently to Local Offline Mesh mode. All tablets communicate directly over your local router. Orders fire to KDS, thermal printers print, and tables close normally. Once connection restores, encrypted ledgers sync seamlessly to the cloud.",
      },
      {
        question: "Can we use our existing thermal receipt printers and cash drawers?",
        answer:
          "Yes. Resto Bird supports standard industry ESC/POS network (LAN/Ethernet), Wi-Fi, USB, and Bluetooth printers from Epson, Star Micronics, Citizen, and generic manufacturers.",
      },
      {
        question: "Does Resto Bird support multi-course pacing?",
        answer:
          "Yes. Servers can tag dishes as Drinks, Starters, Mains, and Desserts with one tap, or hold courses and fire them with single-touch kitchen notifications.",
      },
    ],
    quote: {
      text: "Resto Bird POS cut our table turnaround time by 8 minutes on peak weekends. The offline mesh mode saved us during a severe storm when our main ISP line got knocked out.",
      author: "Chef Marcus Vance",
      role: "Managing Partner",
      restaurant: "L'Aura Bistro & Bar (3 Outlets)",
    },
  },

  inventory: {
    slug: "inventory",
    name: "Inventory Management & Recipe BOM",
    shortName: "Inventory & BOM",
    category: "back-of-house",
    categoryLabel: "Back of House",
    tagline: "Every billed dish depletes raw stock down to the gram.",
    heroBadge: "CENTRAL STORE & GRAM-LEVEL DEPLETION",
    seoTitle: "Restaurant Inventory & Recipe Costing Software",
    description:
      "Transform your walk-in cooler from a black box into a live financial ledger. Resto Bird links your POS menu items directly to multi-level Bills of Materials (BOM). Track raw proteins, dairy, produce, and dry goods down to grams and milliliters, while automated par-levels prevent embarrassing 86'd dishes.",
    primaryStat: "99.8%",
    primaryStatLabel: "Recipe yield precision",
    secondaryStat: "-22%",
    secondaryStatLabel: "Average reduction in unexplained shrinkage",
    accentColor: "emerald",
    accentLightBg: "bg-emerald-50",
    accentBorder: "border-emerald-200",
    accentText: "text-emerald-700",
    features: [
      {
        title: "Gram-Level Recipe Depletion",
        description:
          "Every time a dish or cocktail is punched, Resto Bird automatically subtracts raw ingredients—from 180g ribeye cuts to 15ml truffle oil—from the store ledger.",
        badge: "Live Deductions",
        iconName: "Scale",
      },
      {
        title: "Automated Par-Level PO Triggers",
        description:
          "Set minimum safe par thresholds. Resto Bird monitors stock levels and pre-populates purchase orders to approved vendors before peak weekend prep.",
        badge: "Auto Reorders",
        iconName: "ShoppingCart",
      },
      {
        title: "Central Store & Inter-Branch Transfers",
        description:
          "Maintain a centralized commissary or mother kitchen. Dispatch ingredients to satellite outlets with transfer challans and variance approvals.",
        badge: "Multi-Store",
        iconName: "Boxes",
      },
      {
        title: "Real-Time Food Cost Variance",
        description:
          "Cross-reference theoretical food usage against actual physical audits. Pinpoint exact portions lost to over-portioning, spillage, or theft.",
        badge: "Shrinkage Radar",
        iconName: "TrendingDown",
      },
      {
        title: "Yield & Prep Batching",
        description:
          "Manage sub-recipes like demi-glace, marinades, and stocks. Track raw weight input versus finished yield percentage with automated unit conversion.",
        badge: "Sub-Recipes",
        iconName: "Layers",
      },
      {
        title: "Supplier Price Trend Tracking",
        description:
          "Log vendor invoices and watch unit price volatility. Resto Bird flags unexpected supplier price hikes before they erode your dish profit margins.",
        badge: "Margin Guard",
        iconName: "ShieldAlert",
      },
    ],
    beforeRestoBird: [
      "Head chefs spend 3 hours late at night doing manual pencil-and-paper cooler counts.",
      "High-margin menu items get unexpectedly 86'd midway through Friday dinner rush.",
      "Unexplained inventory shrinkage of 5-8% disappears between delivery and plating.",
      "Vendor price increases go unnoticed for months until quarterly P&L meetings.",
    ],
    withRestoBird: [
      "Real-time stock balance calculated automatically with every POS ticket punched.",
      "Predictive par-level alerts notify managers to order replenishments 48 hours early.",
      "Theoretical vs actual variance reports immediately isolate waste and over-portioning.",
      "Vendor price tracking sounds instant alerts when ingredient wholesale costs rise.",
    ],
    techSpecs: [
      { label: "Unit Conversions", value: "Metric (g, kg, ml, L) and Imperial (oz, lb, fl oz, gal)" },
      { label: "Depletion Resolution", value: "Down to 0.01 grams / 0.1 milliliters" },
      { label: "Audit Modes", value: "Full Wall-to-Wall, Spot Audit, Category Cycle Count" },
      { label: "Barcode Scanning", value: "Camera & USB / Bluetooth Barcode Scanners (EAN/UPC)" },
      { label: "Vendor Management", value: "Direct PDF PO generation, Email dispatch & WhatsApp notes" },
      { label: "Stock Valuation", value: "Weighted Average Cost (WAC) & FIFO support" },
    ],
    faqs: [
      {
        question: "How complex is setting up recipes with prep items like sauces and gravies?",
        answer:
          "Resto Bird supports nested multi-tier sub-recipes. You can define a 10-liter batch of Master Marinade with its raw spices and oils, and then attach 150ml of that marinade to your finished grilled chicken dish.",
      },
      {
        question: "Can we track wastage separately from sales depletion?",
        answer:
          "Yes. Chefs can log kitchen drops, spoiled dairy, or burnt prep with one tap on the kitchen tablet, tagging specific reasons (spoilage, training, test batch, or customer return).",
      },
      {
        question: "Does Resto Bird support multi-location commissary kitchens?",
        answer:
          "Yes. You can manage a central storage facility that transfers stock to satellite dining outlets, complete with digital dispatch slips, receipt acknowledgments, and transit logs.",
      },
    ],
    quote: {
      text: "Within 60 days of implementing Resto Bird's gram-level depletion, our food cost dropped from 32.4% to 28.1%. That saved our restaurant over $4,200 every single month.",
      author: "Priya Sundaram",
      role: "Operations Director",
      restaurant: "Spice & Saffron Hospitality Group",
    },
  },

  catering: {
    slug: "catering",
    name: "Catering & Banquet Management",
    shortName: "Catering & Banquets",
    category: "front-of-house",
    categoryLabel: "Front of House",
    tagline: "Scale 500-guest banquets and bulk raw material purchase orders in seconds.",
    heroBadge: "BANQUETS & PAX SCALING",
    seoTitle: "Catering & Banquet Management Software",
    description:
      "Eliminate spreadsheet chaos for large events. Manage wedding receptions, corporate galas, and banquet halls with per-pax tiered packages, automated raw ingredient multipliers, milestone deposit invoicing, and professional BEO (Banquet Event Order) printing.",
    primaryStat: "10x",
    primaryStatLabel: "Faster quotation & bulk BOM scaling",
    secondaryStat: "100%",
    secondaryStatLabel: "Advance deposit tracking compliance",
    accentColor: "sky",
    accentLightBg: "bg-sky-50",
    accentBorder: "border-sky-200",
    accentText: "text-sky-700",
    features: [
      {
        title: "Per-Pax Package Builder",
        description:
          "Create custom 3, 5, or 7-course catering menus with flexible per-head pricing, live tasting notes, and complimentary item options.",
        badge: "Tiered Menus",
        iconName: "Sparkles",
      },
      {
        title: "Automated Bulk BOM Multiplier",
        description:
          "Change guest count from 150 to 450 pax and Resto Bird instantly scales the required raw poultry, produce, and rice needed in the commissary.",
        badge: "Instant Math",
        iconName: "Calculator",
      },
      {
        title: "Deposit & Payment Milestones",
        description:
          "Track 25% booking advance, 50% tasting deposit, and final settlement with automated digital invoice receipts and payment reminder alerts.",
        badge: "Cashflow First",
        iconName: "BadgeDollarSign",
      },
      {
        title: "Banquet Event Order (BEO) Sheets",
        description:
          "Generate standardized, elegant BEO sheets for the kitchen line, banquet captain, bar team, and audio-visual crew with a single click.",
        badge: "Print Ready",
        iconName: "FileText",
      },
      {
        title: "Live Event Day Timeline",
        description:
          "Schedule welcome drinks, buffet unveil, toast timings, and dessert stations with visual countdowns for floor captains and executive chefs.",
        badge: "Floor Schedule",
        iconName: "Clock",
      },
      {
        title: "Equipment & Linen Rentals",
        description:
          "Track chafing dishes, cocktail tables, chinaware sets, and linen counts assigned to specific halls to prevent rental loss.",
        badge: "Asset Control",
        iconName: "Armchair",
      },
    ],
    beforeRestoBird: [
      "Event managers recalculate 400-person recipe bulk orders by hand on scratch paper.",
      "Kitchen runs short on expensive proteins during weddings, creating panic.",
      "Customer deposits are tracked in disjointed spreadsheets; final balances get delayed.",
      "Kitchen and banquet captains work off mismatched versions of the event schedule.",
    ],
    withRestoBird: [
      "1-click PAX multiplier calculates exact bulk ingredient purchase orders automatically.",
      "BOM scaling prevents costly over-buying while ensuring generous guest buffet portions.",
      "Automated milestone invoices guarantee 100% of deposits are collected before event day.",
      "Synchronized digital BEOs ensure every department operates from the exact same master sheet.",
    ],
    techSpecs: [
      { label: "Guest Capacity", value: "Supports 10 to 5,000+ PAX event sizing" },
      { label: "Document Formats", value: "PDF BEO, Client Proposal, Kitchen Prep Sheet" },
      { label: "BOM Integration", value: "Direct 1-click PO dispatch into Central Store" },
      { label: "Payment Reminders", value: "Automated SMS, Email & WhatsApp notifications" },
      { label: "Multi-Hall Scheduling", value: "Overlap conflict detection across rooms and venues" },
      { label: "Staff Allocation", value: "Direct link to Workforce shift rosters per event" },
    ],
    faqs: [
      {
        question: "Can our executive chef see the raw material requirements for next weekend's banquets?",
        answer:
          "Yes. The catering module aggregates all confirmed upcoming events and displays a unified raw-material shopping list, allowing chefs to negotiate bulk vendor discounts days in advance.",
      },
      {
        question: "How are last-minute guest count changes handled?",
        answer:
          "Simply adjust the PAX number on the event dashboard. Resto Bird immediately recalculates the contract price, adjusts ingredient requirements, and updates the BEO sheet.",
      },
      {
        question: "Does it support custom tasting menus and dietary exclusions?",
        answer:
          "Yes. You can add client-specific dish modifications, vegan/halal/gluten-free headcounts, and custom per-plate upcharges.",
      },
    ],
    quote: {
      text: "We booked 68 weddings this season. Resto Bird eliminated our recipe calculation errors and made our BEOs look ultra-professional to clients.",
      author: "Samantha Sterling",
      role: "Director of Catering & Banquets",
      restaurant: "The Grand Pavilion & Estate",
    },
  },

  shifts: {
    slug: "shifts",
    name: "Shift Rosters & Staff Scheduling",
    shortName: "Shift Rosters",
    category: "workforce",
    categoryLabel: "Workforce & HR",
    tagline: "Auto-balance overtime and let staff swap shifts in two taps.",
    heroBadge: "AI SCHEDULING & ROSTERS",
    seoTitle: "Restaurant Staff Scheduling Software",
    description:
      "Say goodbye to messy WhatsApp scheduling groups. Build conflict-free weekly rosters in minutes, respect employee availability, enforce statutory overtime limits, and empower servers and line cooks to trade shifts peer-to-peer with one-tap manager approvals.",
    primaryStat: "0%",
    primaryStatLabel: "Uncovered rush shifts",
    secondaryStat: "-75%",
    secondaryStatLabel: "Time managers spend building weekly schedules",
    accentColor: "indigo",
    accentLightBg: "bg-indigo-50",
    accentBorder: "border-indigo-200",
    accentText: "text-indigo-700",
    features: [
      {
        title: "Conflict-Free Visual Roster",
        description:
          "Drag-and-drop shift scheduling with instant warnings for double bookings, leave conflicts, and unavailability requests.",
        badge: "Smart Grid",
        iconName: "Calendar",
      },
      {
        title: "Peer-to-Peer Shift Swaps",
        description:
          "Staff can offer shifts to qualified peers on mobile. Managers review and approve trades in seconds without phone tag.",
        badge: "Staff Self-Serve",
        iconName: "Repeat",
      },
      {
        title: "Overtime Fatigue Guardrails",
        description:
          "Automated flags alert managers before an employee breaches statutory 40-hour weekly thresholds or clopening shifts.",
        badge: "Compliance",
        iconName: "ShieldCheck",
      },
      {
        title: "Labor Cost vs Sales Forecasting",
        description:
          "Overlay scheduled labor expense directly against anticipated hourly POS revenue to keep labor cost percentages under control.",
        badge: "Labor % Target",
        iconName: "LineChart",
      },
      {
        title: "Role & Station Qualifications",
        description:
          "Tag staff by certified station (Lead Bartender, Sauté Cook, Expediter) to guarantee critical stations are always staffed with certified talent.",
        badge: "Skill Matching",
        iconName: "UserCheck",
      },
      {
        title: "Instant Push & SMS Publishing",
        description:
          "Publish shifts with one click. Staff receive instant mobile notifications and can sync shifts directly to Apple or Google Calendar.",
        badge: "Fast Alerts",
        iconName: "Bell",
      },
    ],
    beforeRestoBird: [
      "Managers spend 4-6 hours every Sunday juggling handwritten notes and WhatsApp chats.",
      "Staff call out 30 minutes before Saturday rush; managers scramble to find covers.",
      "Employees accidentally hit 15 hours of unbudgeted overtime, ballooning payroll.",
      "Servers and cooks show up on wrong shifts due to confusing photo attachments of paper schedules.",
    ],
    withRestoBird: [
      "Managers publish complete, balanced weekly schedules in under 20 minutes.",
      "Open shift board lets pre-qualified staff claim vacant shifts within minutes.",
      "Overtime warnings stop expensive scheduling mistakes before rosters are published.",
      "Staff access live, synchronized schedules on their personal smartphones 24/7.",
    ],
    techSpecs: [
      { label: "Scheduling Intervals", value: "15-minute, 30-minute, and custom shift blocks" },
      { label: "Compliance Checks", value: "Overtime, Clopening (minimum rest hours), Minor labor laws" },
      { label: "Calendar Sync", value: "iCal, Google Calendar, Apple Calendar subscription feeds" },
      { label: "Notifications", value: "Mobile Push, SMS, and Email shift change alerts" },
      { label: "Template Library", value: "Save & re-apply recurring high-season / low-season templates" },
      { label: "Export Formats", value: "Printable PDF Wall Roster, Excel & CSV export" },
    ],
    faqs: [
      {
        question: "Can an employee trade a shift without manager approval?",
        answer:
          "No. When a staff member accepts a swap request, the manager receives an instant notification showing both employees' total hours for the week. The shift only transfers once approved.",
      },
      {
        question: "Does Resto Bird support split shifts for lunch and dinner services?",
        answer:
          "Yes. You can easily schedule split shifts (e.g. 11:00 - 15:00 and 18:00 - 23:00) with independent break rules and wage calculations.",
      },
      {
        question: "How does it help keep our restaurant labor cost target below 30%?",
        answer:
          "As you build your weekly schedule, Resto Bird continuously calculates the projected labor dollar amount and compares it to your projected POS sales for the week.",
      },
    ],
    quote: {
      text: "Our managers used to dread Sunday schedule creation. Resto Bird cut that to 15 minutes and our staff love being able to trade shifts from their phones.",
      author: "Julian Rossi",
      role: "General Manager",
      restaurant: "Trattoria Della Nonna",
    },
  },

  attendance: {
    slug: "attendance",
    name: "Attendance & Kiosk Time Clock",
    shortName: "Attendance & Kiosk",
    category: "workforce",
    categoryLabel: "Workforce & HR",
    tagline: "PIN-verified terminal punch with live floor attendance board.",
    heroBadge: "PIN & KIOSK CLOCK-IN",
    seoTitle: "Restaurant Time Clock & Attendance Software",
    description:
      "Eliminate buddy punching and time theft permanently. Resto Bird turns any budget tablet into a sleek, tamper-proof time clock kiosk with secure 4-digit PIN verification, photo audit verification, geofenced mobile check-ins, and a live manager floor presence board.",
    primaryStat: "100%",
    primaryStatLabel: "Buddy punching elimination",
    secondaryStat: "< 3s",
    secondaryStatLabel: "Average clock-in punch duration",
    accentColor: "purple",
    accentLightBg: "bg-purple-50",
    accentBorder: "border-purple-200",
    accentText: "text-purple-700",
    features: [
      {
        title: "Dedicated Tablet Kiosk Mode",
        description:
          "Locks down any iPad or Android tablet into a secure punch station mounted near the staff entrance or back office.",
        badge: "Tamper Proof",
        iconName: "Tablet",
      },
      {
        title: "4-Digit PIN & Quick Audit Photo",
        description:
          "Staff punch in using their personal PIN. An optional fast camera snapshot verifies the correct employee is physically present.",
        badge: "Zero Time Theft",
        iconName: "Shield",
      },
      {
        title: "Live Manager Floor Board",
        description:
          "See who is on the floor, who is on break, who is running late, and who is absent in real time directly from your phone.",
        badge: "Live Presence",
        iconName: "Users",
      },
      {
        title: "Break Tracking & Compliance",
        description:
          "Track paid vs unpaid breaks, meal intervals, and automated reminders for employees approaching mandatory rest periods.",
        badge: "Break Compliance",
        iconName: "Coffee",
      },
      {
        title: "Geofenced Mobile Clock-In",
        description:
          "For off-site catering or valet teams, allow GPS-verified clock-in strictly within 50 meters of the event venue perimeter.",
        badge: "GPS Fencing",
        iconName: "MapPin",
      },
      {
        title: "Direct Payroll Timecard Sync",
        description:
          "Verified punch hours flow directly into Resto Bird Payroll with no manual re-typing, timesheet recalculation, or human rounding error.",
        badge: "1-Click Payroll",
        iconName: "CheckCircle2",
      },
    ],
    beforeRestoBird: [
      "Staff clock each other in ('buddy punching') while friends are stuck in morning traffic.",
      "Paper timesheets get stained with food oils and are illegible by payroll cutoff.",
      "General managers have no idea if the opening prep cook actually arrived on time.",
      "End-of-month manual timesheet auditing takes 10+ agonizing hours of manager time.",
    ],
    withRestoBird: [
      "PIN + photo verification eliminates buddy punching and fraudulent hours completely.",
      "Digital punch logs record exact seconds with zero rounding disputes.",
      "Live floor board displays immediate green/yellow/red presence status for all staff.",
      "Timesheets sync directly into payroll calculations with a single click.",
    ],
    techSpecs: [
      { label: "Hardware Support", value: "iPad, iPad Mini, Samsung Galaxy Tab, Fire HD Tablet" },
      { label: "Verification Modes", value: "4-Digit Encrypted PIN, Photo Snapshot, QR Badge Scan" },
      { label: "Offline Punch Queue", value: "Stores punches locally and syncs automatically when online" },
      { label: "Grace Period Rules", value: "Configurable early clock-in buffers (e.g. 5 min before shift)" },
      { label: "Rounding Rules", value: "Exact minute or standard 5/10/15-minute rounding rules" },
      { label: "Timesheet Approvals", value: "Shift supervisor and general manager multi-tier sign-off" },
    ],
    faqs: [
      {
        question: "Do we need to buy expensive proprietary biometric hardware?",
        answer:
          "No. Resto Bird runs on standard consumer tablets you already own, like an entry-level iPad or Samsung Galaxy tablet, saving you thousands on specialized punch clocks.",
      },
      {
        question: "Can employees clock in early and rack up unapproved hours?",
        answer:
          "No. You can configure early clock-in lockouts (e.g., staff can only clock in within 7 minutes of their scheduled shift start unless authorized by a manager).",
      },
      {
        question: "What happens if our internet goes offline during shift change?",
        answer:
          "The kiosk records punches locally in an encrypted offline queue. As soon as the tablet re-establishes connectivity, punches sync seamlessly with accurate timestamps.",
      },
    ],
    quote: {
      text: "The tablet kiosk paid for itself in the first two weeks. We caught 12 hours of buddy punching and eliminated our messy manual paper time cards entirely.",
      author: "David Chang",
      role: "Operations Manager",
      restaurant: "Urban Wok Asian Kitchen",
    },
  },

  payroll: {
    slug: "payroll",
    name: "Payroll & Dynamic Tip Pooling",
    shortName: "Payroll & Tips",
    category: "financials",
    categoryLabel: "Financials & HR",
    tagline: "Fair tip pool distribution and 1-click monthly salary disbursements.",
    heroBadge: "AUTOMATED PAYROLL & TIPS",
    seoTitle: "Restaurant Payroll & Tip Pooling Software",
    description:
      "Automate your most sensitive operational workflow. Calculate fair, transparent front-of-house and back-of-house tip pools based on hours or points, automate statutory tax and benefit deductions, and disburse staff salaries with 1-click payslip generation.",
    primaryStat: "1-Click",
    primaryStatLabel: "Salary calculation & payslip generation",
    secondaryStat: "100%",
    secondaryStatLabel: "Tip distribution transparency score",
    accentColor: "rose",
    accentLightBg: "bg-rose-50",
    accentBorder: "border-rose-200",
    accentText: "text-rose-700",
    features: [
      {
        title: "Dynamic Tip Pooling Rules",
        description:
          "Split credit card and digital tips by hours worked, shift points, or role percentages between servers, bussers, bartenders, and line cooks.",
        badge: "Fair Distribution",
        iconName: "Coins",
      },
      {
        title: "Automated Timesheet Ingestion",
        description:
          "Pulls verified attendance hours, overtime multiples, and approved leaves automatically without manual data entry.",
        badge: "Zero Manual Input",
        iconName: "FileSpreadsheet",
      },
      {
        title: "Statutory Tax & Deductions",
        description:
          "Automatically calculates local withholding taxes, social security, pension/PF, health insurance, and staff meal advances.",
        badge: "Tax Compliant",
        iconName: "Landmark",
      },
      {
        title: "1-Click Digital Payslips",
        description:
          "Generates branded, downloadable PDF payslips with itemized base pay, overtime, tips, and deductions delivered directly to staff phones.",
        badge: "Paperless",
        iconName: "Receipt",
      },
      {
        title: "Direct Bank Payout Files",
        description:
          "Generates standardized NACHA / NEFT / SEPA bank payout files ready for immediate batch upload to commercial banking portals.",
        badge: "Instant Bank Run",
        iconName: "Banknote",
      },
      {
        title: "Complete Audit Trail",
        description:
          "Every wage adjustment, bonus, tip split, and deduction is permanently logged with timestamps and manager signatures.",
        badge: "Audit Ready",
        iconName: "FileCheck",
      },
    ],
    beforeRestoBird: [
      "Managers spend hours every Monday arguing with staff over tip jar math on sticky notes.",
      "Payroll preparation takes 3 full days of cross-referencing timesheets and wage rates.",
      "Calculation errors lead to staff distrust and high turnover among skilled servers.",
      "Tax filing deductions are prone to human formula errors in complex Excel sheets.",
    ],
    withRestoBird: [
      "POS credit card tips split mathematically according to pre-approved rules in seconds.",
      "Payroll runs from raw clock hours to final payslips in less than 3 minutes.",
      "Staff view detailed tip breakdown on their phones, building total team trust.",
      "Automated tax rules guarantee 100% compliance with local labor regulations.",
    ],
    techSpecs: [
      { label: "Tip Pooling Models", value: "Hours-Weighted, Points System, Direct Server, Category Split" },
      { label: "Wage Types", value: "Hourly, Monthly Salary, Shift Rate, Commission / Performance Bonus" },
      { label: "Overtime Rules", value: "Daily >8 hrs, Weekly >40 hrs, Double-time, Rest day multiples" },
      { label: "Banking Formats", value: "NACHA (US), NEFT/RTGS (India), BACS (UK), SEPA (EU)" },
      { label: "Payslip Delivery", value: "Encrypted PDF download, Email & Staff Portal access" },
      { label: "Finance Integration", value: "Direct ledger post into Resto Bird Finance P&L" },
    ],
    faqs: [
      {
        question: "Can we share tips with back-of-house kitchen staff?",
        answer:
          "Yes. Resto Bird supports customizable tip pool percentage allocations (e.g. 70% FOH servers and bartenders, 30% BOH line cooks and dishwashers), compliant with your local jurisdiction's tip regulations.",
      },
      {
        question: "Does it support staff wage advances and loan repayments?",
        answer:
          "Yes. You can record employee advances or equipment deposits. Resto Bird will deduct scheduled installments automatically during monthly payroll runs.",
      },
      {
        question: "Can staff view their tip earnings on their phones after each shift?",
        answer:
          "Yes. Staff can log in to their personal portal and view their daily tip allocation and hours worked with complete transparency.",
      },
    ],
    quote: {
      text: "Tip pooling used to create constant drama between front and back of house. Resto Bird made the entire math transparent and automated. Everyone loves it.",
      author: "Chantal Monet",
      role: "Co-Owner & Beverage Director",
      restaurant: "Bar Verre Wine & Tapas",
    },
  },

  finance: {
    slug: "finance",
    name: "Finance, P&L & Expense Tracker",
    shortName: "Finance & P&L",
    category: "financials",
    categoryLabel: "Financials",
    tagline: "Automated expense aggregation with zero manual bookkeeping.",
    heroBadge: "REAL-TIME EBITDA & BILL REMINDERS",
    seoTitle: "Restaurant Expense Tracking & P&L Software",
    description:
      "Stop waiting for an accountant to tell you how last month went. Resto Bird unifies daily POS sales, food supplier purchase orders, utility bills, and labor payroll into a live, real-time Profit & Loss statement with predictive EBITDA visibility.",
    primaryStat: "Real-time",
    primaryStatLabel: "EBITDA & net operating margin visibility",
    secondaryStat: "15",
    secondaryStatLabel: "Pre-configured restaurant accounting categories",
    accentColor: "amber",
    accentLightBg: "bg-amber-50",
    accentBorder: "border-amber-200",
    accentText: "text-amber-800",
    features: [
      {
        title: "Live EBITDA & Net Margin",
        description:
          "Watch revenue minus real-time COGS, labor, and overhead update every hour. Know your exact profitability mid-month, not 30 days later.",
        badge: "Live P&L",
        iconName: "TrendingUp",
      },
      {
        title: "Automated POS Revenue Sync",
        description:
          "Sales from dining room, takeout, Swiggy, Zomato, UberEats, and DoorDash aggregate automatically with net deductions.",
        badge: "Unified Sales",
        iconName: "Wallet",
      },
      {
        title: "Vendor Invoice Ledger",
        description:
          "Snap a photo or upload vendor invoices. Track accounts payable, payment due dates, and pending supplier credits.",
        badge: "Accounts Payable",
        iconName: "ReceiptText",
      },
      {
        title: "Recurring Bill & License Alerts",
        description:
          "Never miss a liquor license renewal, health permit, commercial rent payment, or waste management invoice.",
        badge: "Compliance Alerts",
        iconName: "AlertCircle",
      },
      {
        title: "Prime Cost Monitoring",
        description:
          "Continuously calculates Prime Cost (COGS + Labor). Alerts managers immediately if Prime Cost crosses the safe 60% industry threshold.",
        badge: "Prime Cost Guard",
        iconName: "Gauge",
      },
      {
        title: "Cash Drawer Reconciliation",
        description:
          "Reconcile daily closing cash drops against POS register reports to flag discrepancies, cash shortages, or overages instantly.",
        badge: "Cash Control",
        iconName: "DollarSign",
      },
    ],
    beforeRestoBird: [
      "Restaurant owners wait 3-4 weeks after month-end for an external CPA to deliver outdated numbers.",
      "Unexpected license renewal fees or utility bills incur penalties and shutdown risks.",
      "Food cost spikes by 6% over two weeks without anyone noticing until profits evaporate.",
      "Aggregator commission deductions remain an unmonitored financial black box.",
    ],
    withRestoBird: [
      "Real-time P&L displays exact operational profitability at any point during the month.",
      "Automated calendar alerts guarantee licenses, leases, and utility bills are paid on time.",
      "Instant Prime Cost alarms sound the moment food and labor costs breach your budget.",
      "Aggregator net payouts are reconciled directly against platform commission fees.",
    ],
    techSpecs: [
      { label: "Accounting Standards", value: "Restaurant Uniform System of Accounts (USAR)" },
      { label: "Cost Monitoring", value: "Prime Cost (COGS + Total Labor) live gauge" },
      { label: "Export Formats", value: "QuickBooks Online, Xero, Tally XML, CSV & PDF" },
      { label: "Tax Classification", value: "Configurable sales tax, GST, VAT and municipal cess" },
      { label: "Expense Categories", value: "COGS, Front Labor, Kitchen Labor, Rent, Utilities, Marketing, etc." },
      { label: "Role Permissions", value: "Restricted visibility: Owner, GM, and Accountant access tiers" },
    ],
    faqs: [
      {
        question: "Can our external accountant get access without seeing sensitive operational settings?",
        answer:
          "Yes. You can invite your accountant with an 'Auditor / Accountant' role that grants read-only access to financial reports, bills, and tax exports without access to operational recipes or passwords.",
      },
      {
        question: "Can we export data into QuickBooks, Xero, or Tally?",
        answer:
          "Yes. Resto Bird provides pre-formatted 1-click exports compatible with QuickBooks Online, Xero, and Tally, saving your bookkeeper hours of manual journal entry.",
      },
      {
        question: "How does the Prime Cost alert protect our bottom line?",
        answer:
          "Prime Cost (Total Food & Beverage Cost + Total Labor Cost) should ideally stay between 55% and 60% for a profitable restaurant. If spikes in beef prices or overtime push this above 60%, Resto Bird notifies you immediately.",
      },
    ],
    quote: {
      text: "Resto Bird Finance gave me total peace of mind. I can look at my phone at 11 PM and see our exact net EBITDA for the day across all four of our locations.",
      author: "Kavita Nair",
      role: "Managing Director",
      restaurant: "Heritage Hospitality Group",
    },
  },

  vault: {
    slug: "vault",
    name: "Secrets Vault & 2FA Authenticator",
    shortName: "Secrets Vault",
    category: "financials",
    categoryLabel: "Security & Ops",
    tagline: "Enterprise zero-knowledge security for aggregator & banking credentials.",
    heroBadge: "ZERO-KNOWLEDGE CREDENTIAL VAULT",
    seoTitle: "Restaurant Password Vault & Access Management",
    description:
      "Protect your restaurant from catastrophic account takeovers. Securely store and share delivery aggregator logins (UberEats, DoorDash, Swiggy, Zomato), banking portals, POS admin keys, and Wi-Fi credentials with client-side AES-256 zero-knowledge encryption and built-in 2FA TOTP code generation.",
    primaryStat: "AES-256",
    primaryStatLabel: "Client-side zero-knowledge encryption",
    secondaryStat: "30s",
    secondaryStatLabel: "Integrated TOTP 2FA code generator",
    accentColor: "teal",
    accentLightBg: "bg-teal-50",
    accentBorder: "border-teal-200",
    accentText: "text-teal-800",
    features: [
      {
        title: "Zero-Knowledge Encryption",
        description:
          "Passwords are encrypted on your local browser using AES-256 before hitting the database. Even Resto Bird engineers cannot read your credentials.",
        badge: "Bank Grade",
        iconName: "Lock",
      },
      {
        title: "Built-In TOTP 2FA Authenticator",
        description:
          "Store your UberEats, DoorDash, or banking 2FA secret keys in the vault. Staff can generate 6-digit rolling OTPs without texting the owner's personal phone.",
        badge: "No Phone Tag",
        iconName: "KeyRound",
      },
      {
        title: "Role-Based Access Control",
        description:
          "Grant store managers access to delivery tablet logins while keeping commercial banking and tax portal credentials strictly locked to owners.",
        badge: "Least Privilege",
        iconName: "ShieldAlert",
      },
      {
        title: "1-Click Credential Copy",
        description:
          "Staff can copy usernames and auto-copied passwords without revealing plain text on the screen, preventing shoulder surfing.",
        badge: "Shoulder Surf Safe",
        iconName: "Copy",
      },
      {
        title: "Audit Logs & Access History",
        description:
          "Every credential reveal, TOTP generation, and modification is permanently recorded with user, IP address, and timestamp.",
        badge: "Full Forensics",
        iconName: "History",
      },
      {
        title: "Store Wi-Fi & Device Keyring",
        description:
          "Keep guest Wi-Fi, staff Wi-Fi, POS router gateways, and kitchen printer IP configs safely documented in one centralized secure location.",
        badge: "Device Network",
        iconName: "Wifi",
      },
    ],
    beforeRestoBird: [
      "Critical aggregator passwords are written on post-it notes stuck to POS tablets.",
      "Store managers call the restaurant owner at 10 PM demanding a 2FA SMS code to open UberEats.",
      "Disgruntled former managers retain access to delivery portals and sabotage menu listings.",
      "Staff use the same weak password across all restaurant tools and banking sites.",
    ],
    withRestoBird: [
      "Credentials are encrypted with bank-grade AES-256 zero-knowledge security.",
      "Built-in TOTP allows shift managers to generate 2FA codes without bothering the owner.",
      "Revoking access to a departing manager terminates access across all stored credentials in one tap.",
      "Full audit logs show exactly who viewed or copied a credential and when.",
    ],
    techSpecs: [
      { label: "Encryption Cipher", value: "AES-256-GCM with PBKDF2 Key Derivation" },
      { label: "Key Storage", value: "Client-side master key derivation (Zero-Knowledge Architecture)" },
      { label: "2FA TOTP Support", value: "RFC 6238 compliant 6-digit / 8-digit rolling authenticator" },
      { label: "Audit Resolution", value: "Timestamped user ID, IP address, user-agent, and event payload" },
      { label: "Sharing Scopes", value: "Granular outlet-level, role-level, and user-level permissions" },
      { label: "Compliance", value: "SOC2 Type II and GDPR data privacy compliant" },
    ],
    faqs: [
      {
        question: "How does the built-in 2FA authenticator stop managers from calling the owner for OTPs?",
        answer:
          "When you set up 2FA on UberEats or DoorDash, paste the secret setup seed into Resto Bird Vault. Authorized shift managers can view the rolling 6-digit code directly from their dashboard—ending late-night phone calls completely.",
      },
      {
        question: "Can Resto Bird support or developers see our passwords?",
        answer:
          "No. All credentials are encrypted on your local device before transmission using AES-256-GCM. We never possess the decryption key, adhering strictly to zero-knowledge security principles.",
      },
      {
        question: "What happens when a manager leaves our restaurant?",
        answer:
          "Simply deactivate their employee profile. Their access to every password and 2FA code in the vault is revoked immediately.",
      },
    ],
    quote: {
      text: "The built-in 2FA alone saved my sanity. My managers used to text me three times a night for DoorDash and Swiggy verification codes while I was trying to sleep.",
      author: "Rajiv Malhotra",
      role: "Multi-Unit Franchisee",
      restaurant: "Curry Express (6 Outlets)",
    },
  },

  analytics: {
    slug: "analytics",
    name: "Menu Engineering & BCG Profit Analytics",
    shortName: "Menu Analytics",
    category: "back-of-house",
    categoryLabel: "Intelligence",
    tagline: "Identify Stars, Plowhorses, Puzzles, and Dogs in real time.",
    heroBadge: "BCG MATRIX & PROFIT EXPANSION",
    seoTitle: "Menu Engineering & Food Cost Analytics",
    description:
      "Transform your menu into a high-margin profit engine. Resto Bird cross-references live POS sales volume against raw ingredient recipe costs to map every dish on the classic BCG Boston Consulting Group matrix: Stars, Plowhorses, Puzzles, and Dogs.",
    primaryStat: "+14.8%",
    primaryStatLabel: "Average gross margin expansion achieved",
    secondaryStat: "Real-time",
    secondaryStatLabel: "Continuous margin variance detection",
    accentColor: "amber",
    accentLightBg: "bg-amber-50",
    accentBorder: "border-amber-200",
    accentText: "text-amber-700",
    features: [
      {
        title: "Live BCG Matrix Categorization",
        description:
          "Automatically slots every item into Stars (High Vol / High Margin), Plowhorses (High Vol / Low Margin), Puzzles, and Dogs.",
        badge: "Menu Science",
        iconName: "Grid2X2",
      },
      {
        title: "Ingredient Cost Margin Correlation",
        description:
          "As wholesale supplier prices shift, Resto Bird recalculates each dish's contribution margin in real time to prevent profit leakage.",
        badge: "Margin Guard",
        iconName: "TrendingUp",
      },
      {
        title: "AI Price Adjustment Recommendations",
        description:
          "Identifies popular dishes (Plowhorses) that can absorb a $1.50 or $2.00 price bump without damaging sales velocity.",
        badge: "Revenue Lift",
        iconName: "Sparkles",
      },
      {
        title: "Hourly Revenue & Speed Heatmaps",
        description:
          "Identify peak dining room rush hours, table dwell times, and kitchen bottleneck periods with color-coded heatmaps.",
        badge: "Speed of Service",
        iconName: "Flame",
      },
      {
        title: "Server Sales Performance & Upsell Radar",
        description:
          "Rank servers by average check size, beverage attachment rate, and dessert upselling to reward top performers and train others.",
        badge: "Staff Coaching",
        iconName: "Award",
      },
      {
        title: "Multi-Outlet Margin Comparison",
        description:
          "Compare dish sales performance across branches to discover regional customer preferences and optimize regional pricing.",
        badge: "Chain Telemetry",
        iconName: "Compass",
      },
    ],
    beforeRestoBird: [
      "Menu pricing is set by guesswork and copying what the competitor down the street charges.",
      "Best-selling dishes quietly lose money because rising dairy and meat costs were never calculated.",
      "Unpopular 'Dog' dishes clutter the kitchen line and waste prep time without generating profit.",
      "General managers have no idea which servers are actually driving high-margin cocktail sales.",
    ],
    withRestoBird: [
      "Data-driven menu engineering plots exact contribution margin and popularity for every dish.",
      "Targeted 5-8% price adjustments on inelastic Plowhorse items yield immediate profit jumps.",
      "Unpopular, high-waste dishes are identified and phased out to streamline kitchen prep lines.",
      "Server upsell leaderboards drive friendly team competition and higher check averages.",
    ],
    techSpecs: [
      { label: "Matrix Model", value: "Classic Kasavana & Smith Menu Engineering / BCG Quadrants" },
      { label: "Margin Basis", value: "Contribution Margin (Selling Price minus Raw BOM Ingredient Cost)" },
      { label: "Reporting Windows", value: "Real-time, Last 7 Days, Last 30 Days, Year-over-Year" },
      { label: "Segmentation", value: "By Category (Appetizers, Mains, Cocktails, Desserts, Banquets)" },
      { label: "Predictive Modeling", value: "Simulates revenue impact of price adjustments (+5%, +10%)" },
      { label: "Data Export", value: "Executive PDF presentations, CSV, and automated email digests" },
    ],
    faqs: [
      {
        question: "What is the difference between a Star and a Plowhorse on our menu?",
        answer:
          "A Star has both high sales volume and high contribution margin (e.g. signature cocktails or Dum Biryani). A Plowhorse is extremely popular with guests but has a low profit margin (e.g. Butter Naan or prime steaks). Resto Bird recommends keeping Plowhorses but slightly increasing prices or adjusting portion specs.",
      },
      {
        question: "How does Resto Bird know our dish costs?",
        answer:
          "Because Resto Bird connects directly to your Recipe BOM and Inventory module, it automatically knows the exact cost of every gram of meat, dairy, and produce in the dish.",
      },
      {
        question: "How quickly do restaurants see profit improvements?",
        answer:
          "Most restaurants achieve an immediate 8% to 15% increase in gross profit margins within the first 30 days simply by following Resto Bird's pricing recommendations for their top 5 Plowhorse items.",
      },
    ],
    quote: {
      text: "Resto Bird showed us that our most popular pasta dish was actually losing us $1.80 per plate due to rising cream and cheese costs. We tweaked the pricing and gained $6,800 that quarter.",
      author: "Enzo Moretti",
      role: "Chef Patron",
      restaurant: "Osteria Del Sole",
    },
  },
};

export const MODULE_CATEGORIES = [
  { id: "all", label: "All Modules" },
  { id: "front-of-house", label: "Front of House" },
  { id: "back-of-house", label: "Back of House & Kitchen" },
  { id: "workforce", label: "Workforce & HR" },
  { id: "financials", label: "Financials & Security" },
];
