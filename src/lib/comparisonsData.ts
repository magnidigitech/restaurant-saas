export interface ComparisonItem {
  slug: string;
  title: string;
  subtitle: string;
  heroBadge: string;
  verdictSummary: string;
  bestSuitedFor: { restobird: string; competitor: string };
  comparisonMatrix: { feature: string; restobird: string; competitor: string; category: string }[];
  keyDifferences: { title: string; restobirdWay: string; competitorWay: string }[];
  faqs: { question: string; answer: string }[];
  seoTitle: string;
  seoDescription: string;
}

export const COMPARISONS_DATA: Record<string, ComparisonItem> = {
  "restobird-vs-spreadsheets": {
    slug: "restobird-vs-spreadsheets",
    title: "RestoBird vs Manual Excel Spreadsheets for Restaurant Inventory",
    subtitle: "An honest, feature-by-feature comparison of automated inventory software versus Excel spreadsheets.",
    heroBadge: "Software vs Spreadsheet Comparison",
    verdictSummary: "While Excel spreadsheets are free and familiar, manual data entry leads to lag times, missing recipe depletion, and human error. RestoBird automates stock deduction directly from POS sales, saving 12+ hours per week and cutting food costs by up to 8.4%.",
    bestSuitedFor: {
      restobird: "Growing single-outlet & multi-location restaurants wanting real-time recipe depletion, automated vendor POs, and live margin alerts.",
      competitor: "Very small single-concept kiosks or pop-up stands with under 10 menu items and minimal inventory complexity."
    },
    comparisonMatrix: [
      { category: "Automation", feature: "Real-Time POS Recipe Depletion", restobird: "Automated via sub-second webhooks", competitor: "Manual daily/weekly typing" },
      { category: "Automation", feature: "Automated Purchase Order Generation", restobird: "1-Click PO generation based on par levels", competitor: "Manual formula recalculation & manual emails" },
      { category: "Accuracy", feature: "Gram-Level Ingredient Tracking", restobird: "Exact weight calculations from recipe BOM", competitor: "Prone to formula errors & broken cell references" },
      { category: "Cost Control", feature: "Vendor Invoice Price Inflation Alerts", restobird: "Automatic line-item price variance alerts", competitor: "Requires manual auditing of every paper invoice" },
      { category: "Usability", feature: "Multi-Location Centralized Ledger", restobird: "Built-in multi-store hierarchy", competitor: "Complex nested workbooks prone to corruption" },
      { category: "Usability", feature: "Mobile Kiosk Clocking & Shift Swaps", restobird: "Integrated tablet kiosk with PIN/2FA", competitor: "Separate paper sign-in sheets" }
    ],
    keyDifferences: [
      {
        title: "Real-Time Depletion vs 30-Day Lag",
        restobirdWay: "Ingredients deplete automatically down to the gram as orders pass through your POS.",
        competitorWay: "Stock counts are updated manually once a week or month, delaying loss visibility by weeks."
      },
      {
        title: "Recipe Portion Control & Costing",
        restobirdWay: "Live cost-per-plate updates dynamically whenever vendor ingredient prices change.",
        competitorWay: "Formula cells break easily, leaving managers relying on outdated cost estimates."
      }
    ],
    faqs: [
      { question: "Why move from Excel to RestoBird?", answer: "RestoBird eliminates manual data entry, connects directly to POS registers, automates stock deduction, and alerts you to vendor price hikes instantly." }
    ],
    seoTitle: "RestoBird vs Excel Spreadsheets for Restaurant Inventory",
    seoDescription: "Compare RestoBird automated inventory software with manual Excel spreadsheets for restaurant cost control."
  },
  "restobird-vs-legacy-pos": {
    slug: "restobird-vs-legacy-pos",
    title: "RestoBird vs Traditional Legacy POS Hardware Systems",
    subtitle: "See how modern cloud-connected operating software compares with legacy closed POS hardware.",
    heroBadge: "Cloud OS vs Legacy Hardware",
    verdictSummary: "Legacy POS hardware systems lock restaurants into clunky, proprietary hardware with expensive maintenance contracts. RestoBird provides a modern cloud operating system that connects Toast, Square, Clover, and existing hardware into one high-speed platform.",
    bestSuitedFor: {
      restobird: "Modern restaurant operators seeking open integrations, sub-second KDS screens, and deep inventory depletion.",
      competitor: "Legacy operations heavily locked into proprietary legacy hardware contracts with no desire to modernize."
    },
    comparisonMatrix: [
      { category: "Architecture", feature: "Cloud & Offline Network Resilience", restobird: "Hybrid cloud with local mesh offline routing", competitor: "Local server reliant or rigid proprietary box" },
      { category: "Integrations", feature: "Multi-POS Order Stream Integration", restobird: "Unified streams from Toast, Square, Clover & Delivery", competitor: "Siloed system rejecting third-party integration" },
      { category: "Inventory", feature: "Gram-Level Bill of Materials (BOM)", restobird: "Deep recipe depletion & vendor PO automation", competitor: "Basic item count without raw weight tracking" },
      { category: "Workforce", feature: "PIN & Camera Clocking Kiosk", restobird: "Built-in kiosk with automated tip pooling", competitor: "Basic timeclock with no buddy punching prevention" }
    ],
    keyDifferences: [
      {
        title: "Open Ecosystem vs Proprietary Lock-In",
        restobirdWay: "Seamlessly connect your favorite POS, delivery apps, and hardware in minutes.",
        competitorWay: "Expensive hardware upgrades and locked API ecosystems."
      }
    ],
    faqs: [
      { question: "Can I keep my current POS while using RestoBird?", answer: "Yes! RestoBird integrates with Toast, Square, Clover, and leading registers, layering powerful inventory, KDS, and workforce management on top of your existing setup." }
    ],
    seoTitle: "RestoBird vs Legacy POS Hardware Systems | Comparison",
    seoDescription: "Compare RestoBird unified restaurant operating software with legacy proprietary POS hardware."
  }
};
