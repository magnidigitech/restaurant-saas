export interface UseCaseItem {
  slug: string;
  title: string;
  subtitle: string;
  problemSummary: string;
  restobirdApproach: string;
  heroBadge: string;
  keyStats: { value: string; label: string }[];
  problemDetails: { title: string; description: string }[];
  solutionFeatures: { title: string; description: string; icon: string }[];
  stepByStepProcess: { step: string; title: string; description: string }[];
  faqs: { question: string; answer: string }[];
  seoTitle: string;
  seoDescription: string;
}

export const USE_CASES_DATA: Record<string, UseCaseItem> = {
  "reduce-food-waste": {
    slug: "reduce-food-waste",
    title: "How to Reduce Restaurant Food Waste & Kitchen Spoilage",
    subtitle: "Stop throwing food waste into trash bins. Track ingredient depletion down to the gram and eliminate over-portioning.",
    problemSummary: "Food waste accounts for up to 10% of total restaurant raw ingredient purchases due to over-portioning, expired stock, and unrecorded prep spoilage.",
    restobirdApproach: "RestoBird links front-of-house POS order tickets directly to recipe ingredient Bill of Materials (BOM), monitoring live stock usage and raising alerts before perishable items expire.",
    heroBadge: "Food Waste Reduction Guide",
    keyStats: [
      { value: "8.4%", label: "Average Food Cost Savings" },
      { value: "35%", label: "Reduction in Prep Spoilage" },
      { value: "100%", label: "Gram-Level Waste Tracking" }
    ],
    problemDetails: [
      { title: "Unrecorded Kitchen Waste", description: "Line cooks throwing burnt or over-cooked proteins away without logging itemized waste tickets." },
      { title: "Over-Portioning on the Line", description: "Serving 0.5 oz extra meat per burger accumulates thousands in unearned food cost every month." },
      { title: "Poor FIFO Rotation", description: "Older inventory sitting behind new deliveries until product passes expiration limits." }
    ],
    solutionFeatures: [
      { title: "Real-Time Recipe Depletion", description: "Every order ring-up reduces exact ingredient weights from inventory ledgers.", icon: "Boxes" },
      { title: "Itemized Waste Logging", description: "Line cooks log spilled or expired ingredients on kitchen kiosks in seconds.", icon: "CheckCircle2" },
      { title: "Expiration & FIFO Alerts", description: "Alert managers when perishable items reach target shelf-life thresholds.", icon: "Clock" }
    ],
    stepByStepProcess: [
      { step: "01", title: "Map Recipe BOM", description: "Input exact ingredient gram weights for every dish." },
      { step: "02", title: "Stream Live POS Tickets", description: "Deduct stock automatically with every customer transaction." },
      { step: "03", title: "Review Weekly Waste Audits", description: "Identify high-variance ingredients and retrain kitchen line staff." }
    ],
    faqs: [
      { question: "How does RestoBird calculate recipe food waste?", answer: "RestoBird compares expected recipe ingredient usage against actual stock counts, highlighting variance caused by over-portioning, prep waste, or unrecorded spoilage." }
    ],
    seoTitle: "How to Reduce Restaurant Food Waste | RestoBird",
    seoDescription: "Eliminate kitchen food waste, control portioning, and track ingredient depletion with RestoBird."
  },
  "control-food-costs": {
    slug: "control-food-costs",
    title: "How to Control Restaurant Food Costs & Recipe Margins",
    subtitle: "Protect dish profitability against vendor price inflation with real-time recipe costing and margin alerts.",
    problemSummary: "Rapidly fluctuating food supplier prices cause dish margins to erode secretly without managers noticing until month-end P&L statements arrive.",
    restobirdApproach: "RestoBird monitors vendor invoice price changes continuously, recalculating recipe dish margins in real time and alerting operators to price spikes.",
    heroBadge: "Food Cost Optimization",
    keyStats: [
      { value: "14%", label: "Margin Improvement" },
      { value: "Real-Time", label: "Recipe Cost Updates" },
      { value: "< 1%", label: "Vendor Price Variance Allowed" }
    ],
    problemDetails: [
      { title: "Silent Supplier Price Inflation", description: "Vendors increasing unit prices on poultry, dairy, or oil without alerting restaurant buyers." },
      { title: "Outdated Menu Pricing", description: "Selling dishes based on ingredient costs calculated 6 months prior." }
    ],
    solutionFeatures: [
      { title: "Live Recipe Margin Matrix", description: "Automatically calculate exact cost-per-plate and gross margin percentage.", icon: "LineChart" },
      { title: "Vendor Invoice Price Alerts", description: "Flag unit price increases on incoming vendor delivery invoices instantly.", icon: "Receipt" }
    ],
    stepByStepProcess: [
      { step: "01", title: "Import Vendor Invoices", description: "Scan or upload supplier invoices directly into RestoBird." },
      { step: "02", title: "Audit Recipe Margins", description: "Identify menu items dropping below target gross margin thresholds." }
    ],
    faqs: [
      { question: "How does RestoBird protect against vendor price hikes?", answer: "RestoBird audits incoming vendor invoices against contracted purchase rates, alerting management whenever unit prices increase." }
    ],
    seoTitle: "How to Control Restaurant Food Costs & Margins | RestoBird",
    seoDescription: "Calculate recipe costs, track vendor price inflation, and protect restaurant profit margins with RestoBird."
  },
  "prevent-stockouts": {
    slug: "prevent-stockouts",
    title: "How to Prevent Restaurant Stockouts & Emergency Buying",
    subtitle: "Never run out of key ingredients during peak weekend rush hours.",
    problemSummary: "Running out of signature ingredients during Friday dinner rush forces kitchen teams into emergency grocery runs or turning away paying guests.",
    restobirdApproach: "RestoBird maintains dynamic par levels based on historical sales velocity, generating automated purchase orders before stock hits critical levels.",
    heroBadge: "Stockout Prevention Engine",
    keyStats: [
      { value: "0", label: "Emergency Store Runs" },
      { value: "Auto", label: "Par-Level PO Generation" },
      { value: "99.8%", label: "Menu Availability" }
    ],
    problemDetails: [
      { title: "Manual Clipboard Inventory Counts", description: "Counting stock manually on paper leads to missed reorder points." },
      { title: "Unpredictable Sales Spikes", description: "Unexpected catering or dinner rushes exhausting key proteins unexpectedly." }
    ],
    solutionFeatures: [
      { title: "Dynamic Par-Level Alerts", description: "Trigger reorder alerts based on real-time depletion rates and vendor lead times.", icon: "Bell" },
      { title: "Automated Purchase Orders", description: "Generate formatted POs sent directly to food suppliers with one click.", icon: "FileText" }
    ],
    stepByStepProcess: [
      { step: "01", title: "Configure Minimum Par Levels", description: "Set safety stock levels for high-turnover ingredients." },
      { step: "02", title: "Receive Low Stock Warnings", description: "Get instant notifications on desktop or mobile when ingredients hit reorder limits." }
    ],
    faqs: [
      { question: "Can RestoBird automatically generate purchase orders for suppliers?", answer: "Yes! When inventory drops below safety par levels, RestoBird drafts formatted POs ready to send to your preferred vendors." }
    ],
    seoTitle: "How to Prevent Restaurant Stockouts & Emergency Buying | RestoBird",
    seoDescription: "Automate inventory par levels, generate vendor purchase orders, and eliminate menu item stockouts with RestoBird."
  },
  "manage-restaurant-purchasing": {
    slug: "manage-restaurant-purchasing",
    title: "How to Streamline Restaurant Procurement & Vendor Purchasing",
    subtitle: "Centralize supplier management, purchase orders, and accounts payable reconciliation into one clean ledger.",
    problemSummary: "Managing multiple food vendors across phone calls, text messages, and paper invoices causes purchasing chaos and duplicate billing.",
    restobirdApproach: "RestoBird unifies supplier catalogs, purchase order dispatches, receiving logs, and invoice audit workflows into a centralized procurement hub.",
    heroBadge: "Procurement & Purchasing Hub",
    keyStats: [
      { value: "100%", label: "Supplier Ledger Audit" },
      { value: "1-Click", label: "Vendor PO Generation" },
      { value: "Zero", label: "Duplicate Billing Errors" }
    ],
    problemDetails: [
      { title: "Unorganized Supplier Orders", description: "Head chefs texting supplier reps orders without official purchase records." },
      { title: "Unverified Receiving", description: "Kitchen staff signing delivery slips without checking box counts or item condition." }
    ],
    solutionFeatures: [
      { title: "Centralized Supplier Directory", description: "Maintain supplier contact cards, delivery schedules, and order cut-off times.", icon: "Users" },
      { title: "Three-Way Invoice Matching", description: "Verify POs, receiving slips, and invoices match before approving payment.", icon: "ShieldCheck" }
    ],
    stepByStepProcess: [
      { step: "01", title: "Draft Vendor PO", description: "Select ingredients and send POs to suppliers." },
      { step: "02", title: "Log Receiving Slip", description: "Verify quantities delivered at the loading dock upon arrival." }
    ],
    faqs: [
      { question: "Does RestoBird support three-way invoice matching for restaurant AP?", answer: "Yes! RestoBird matches the original Purchase Order, the dock receiving report, and the supplier invoice to ensure billing accuracy before payment approval." }
    ],
    seoTitle: "How to Streamline Restaurant Procurement & Purchasing | RestoBird",
    seoDescription: "Centralize food supplier orders, automate purchase orders, and audit vendor AP invoices with RestoBird."
  },
  "track-multiple-locations": {
    slug: "track-multiple-locations",
    title: "How to Manage Inventory & Operations Across Multiple Restaurant Outlets",
    subtitle: "Gain complete visibility across store outlets, central commissaries, and inter-store stock transfers.",
    problemSummary: "Managing multi-outlet restaurant chains with separate spreadsheets creates operational silos and prevents executive benchmarking.",
    restobirdApproach: "RestoBird consolidates all outlet POS order feeds, ingredient stock ledgers, shift rosters, and store financial metrics into a single multi-unit portal.",
    heroBadge: "Multi-Outlet Chain Governance",
    keyStats: [
      { value: "Multi-Unit", label: "Central Dashboard" },
      { value: "Real-Time", label: "Inter-Store Transfers" },
      { value: "100%", label: "Consolidated Visibility" }
    ],
    problemDetails: [
      { title: "Lack of Store Comparison Data", description: "Inability to compare food cost percentage or labor efficiency between store locations in real time." },
      { title: "Untracked Inter-Store Transfers", description: "Moving expensive steaks or alcohol between stores without digital transfer logs." }
    ],
    solutionFeatures: [
      { title: "Executive Multi-Unit Dashboard", description: "Compare daily sales, food cost %, and labor efficiency across all store locations.", icon: "PieChart" },
      { title: "Inter-Store Transfer Tracking", description: "Log ingredient dispatches and receiving confirmations between outlets automatically.", icon: "Boxes" }
    ],
    stepByStepProcess: [
      { step: "01", title: "Add Store Outlets", description: "Group store locations under your organization." },
      { step: "02", title: "Monitor Store Rankings", description: "Identify top-performing locations and optimize underperforming outlets." }
    ],
    faqs: [
      { question: "Can RestoBird compare sales and food costs across 10+ restaurant locations?", answer: "Yes! RestoBird provides executive dashboards where operators can view consolidated multi-store analytics or filter metrics by individual location." }
    ],
    seoTitle: "How to Manage Multiple Restaurant Outlets & Chains | RestoBird",
    seoDescription: "Manage multi-outlet inventory, inter-store transfers, and multi-unit financial reporting with RestoBird."
  }
};
