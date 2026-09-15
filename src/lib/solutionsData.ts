export interface SolutionItem {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  heroBadge: string;
  targetAudience: string;
  stats: { value: string; label: string }[];
  keyChallenges: { problem: string; description: string }[];
  restobirdSolutions: { title: string; description: string; icon: string }[];
  workflowSteps: { step: string; title: string; description: string }[];
  faqs: { question: string; answer: string }[];
  seoTitle: string;
  seoDescription: string;
}

export const SOLUTIONS_DATA: Record<string, SolutionItem> = {
  "restaurants": {
    slug: "restaurants",
    title: "Restaurant Management Software for Fine & Casual Dining",
    subtitle: "Deliver exceptional table service while controlling food costs and kitchen timing.",
    description: "RestoBird connects table seating, POS ordering streams, recipe ingredient depletion, and staff shifts into one unified platform built for high-volume dining rooms.",
    heroBadge: "Full-Service Dining Solution",
    targetAudience: "Independent & Multi-Location Full-Service Restaurants",
    stats: [
      { value: "8.4%", label: "Average Food Cost Reduction" },
      { value: "< 200ms", label: "Ticket Sync Speed" },
      { value: "100%", label: "Recipe Depletion Accuracy" }
    ],
    keyChallenges: [
      { problem: "Kitchen Bottlenecks During Rush", description: "Orders arriving from multiple server terminals overload cooks and cause delayed appetizers." },
      { problem: "Untracked Plate Variance", description: "Inconsistent portioning by kitchen staff eats directly into dish profit margins." },
      { problem: "Complex Shift Rostering", description: "Managing server tip pools and shift trades manually consumes hours of management time every week." }
    ],
    restobirdSolutions: [
      { title: "Sub-Second KDS Routing", description: "Direct order dispatch to station-specific kitchen display screens based on dish category.", icon: "MonitorSmartphone" },
      { title: "Gram-Level Recipe Depletion", description: "Every order automatically reduces raw protein, produce, and dairy stock levels.", icon: "Boxes" },
      { title: "Automated Tip Pooling", description: "Calculate transparent point-based or hours-worked tip payouts straight from POS sales.", icon: "Receipt" }
    ],
    workflowSteps: [
      { step: "01", title: "Connect FOH POS", description: "Sync Toast, Square, or Clover terminals with RestoBird in minutes." },
      { step: "02", title: "Map Recipe BOM", description: "Define exact ingredient weights for appetizers, mains, and cocktails." },
      { step: "03", title: "Monitor Real-Time Margin", description: "Watch stock balances and shift labor costs adjust automatically with every ticket." }
    ],
    faqs: [
      { question: "How does RestoBird help fine dining restaurants?", answer: "RestoBird provides real-time recipe costing, table-by-table kitchen fulfillment timing, and automated par-level purchasing so operators can maintain strict quality standards while protecting margins." },
      { question: "Can we use our existing POS registers?", answer: "Yes! RestoBird integrates seamlessly with Toast, Square, Clover, and major cloud POS platforms." }
    ],
    seoTitle: "Restaurant Management Software for Fine & Casual Dining | RestoBird",
    seoDescription: "Streamline dining room service, automate ingredient depletion, and control labor costs with RestoBird."
  },
  "cafes": {
    slug: "cafes",
    title: "Cafe & Bakery Management Software",
    subtitle: "Speed up counter service, manage espresso bean inventory, and streamline daily pastry baking.",
    description: "Built for fast-paced coffee shops and bakeries needing quick line fulfillment, real-time dairy and syrup depletion tracking, and automated shift rostering.",
    heroBadge: "Coffee & Bakery Operations",
    targetAudience: "Artisanal Cafes, Coffee Roasters & Bakery Chains",
    stats: [
      { value: "4.2x", label: "Faster Line Fulfillment" },
      { value: "12%", label: "Dairy & Coffee Cost Savings" },
      { value: "0", label: "Morning Stockout Delays" }
    ],
    keyChallenges: [
      { problem: "Morning Rush Queue Delays", description: "Long customer queues at counter registers slow down order fulfillment and create order errors." },
      { problem: "Milk & Syrup Spoilage", description: "Perishable dairy and specialty beans spoil fast when par levels aren't monitored continuously." }
    ],
    restobirdSolutions: [
      { title: "Rapid Counter Order Routing", description: "Instant ticket printing and screen dispatch to espresso and kitchen prep stations.", icon: "Coffee" },
      { title: "Ingredient & Batch Tracking", description: "Track espresso bean yield, milk volume, and baked pastry batches down to the gram.", icon: "Boxes" }
    ],
    workflowSteps: [
      { step: "01", title: "Sync Counter Registers", description: "Connect register stations for instant order capture." },
      { step: "02", title: "Set Par Levels", description: "Automate low-stock alerts for specialty beans, oat milk, and bakery supplies." }
    ],
    faqs: [
      { question: "Can RestoBird handle high-speed morning coffee rushes?", answer: "Yes! RestoBird processes ticket order webhooks under 200 milliseconds, routing drink tickets directly to barista screens." }
    ],
    seoTitle: "Cafe & Bakery Management Software | RestoBird",
    seoDescription: "Optimize counter ordering, track espresso bean and dairy inventory, and manage barista shifts with RestoBird."
  },
  "quick-service-restaurants": {
    slug: "quick-service-restaurants",
    title: "QSR & Fast Casual Operations Software",
    subtitle: "Maximize ticket throughput and enforce ingredient portioning across high-volume locations.",
    description: "RestoBird equips Quick Service Restaurants (QSR) with high-speed order routing, kitchen prep screens, and automated inventory depletion.",
    heroBadge: "QSR Throughput Engine",
    targetAudience: "QSR Franchises & Fast-Casual Chains",
    stats: [
      { value: "3.5 min", label: "Average Window Time" },
      { value: "99.4%", label: "Order Ticket Accuracy" },
      { value: "14%", label: "Labor Efficiency Gain" }
    ],
    keyChallenges: [
      { problem: "High Ticket Volume Bottlenecks", description: "Rush hours require rapid order dispatch without dropping order modifications or side items." },
      { problem: "High Employee Turnover", description: "Constant hiring requires intuitive time-clock kiosks and simple scheduling tools." }
    ],
    restobirdSolutions: [
      { title: "Station-Based KDS Dispatch", description: "Separate orders instantly onto Grill, Fryer, Assembly, and Pickup screens.", icon: "MonitorSmartphone" },
      { title: "Kiosk Time Tracking", description: "PIN-verified shift clocking to prevent buddy punching across hourly teams.", icon: "Clock" }
    ],
    workflowSteps: [
      { step: "01", title: "Deploy KDS Hardware", description: "Set up station screens in assembly lines." },
      { step: "02", title: "Automate Inventory Reorders", description: "Trigger vendor POs automatically when stock hits minimum operating thresholds." }
    ],
    faqs: [
      { question: "Is RestoBird optimized for high-volume QSR chains?", answer: "Yes! RestoBird handles thousands of daily tickets per location with sub-second kitchen display response times." }
    ],
    seoTitle: "QSR & Fast Casual Operations Software | RestoBird",
    seoDescription: "Speed up ticket fulfillment, reduce drive-thru wait times, and control ingredient costs with RestoBird."
  },
  "cloud-kitchens": {
    slug: "cloud-kitchens",
    title: "Cloud & Ghost Kitchen Management Software",
    subtitle: "Manage multiple virtual brands from a single kitchen prep line and unified order stream.",
    description: "RestoBird consolidates third-party delivery channels, virtual brand menus, and centralized commissary inventory into a single operational hub.",
    heroBadge: "Ghost Kitchen Multi-Brand OS",
    targetAudience: "Virtual Restaurant Groups & Delivery Hubs",
    stats: [
      { value: "100%", label: "Delivery Channel Sync" },
      { value: "4 font", label: "Virtual Brands on 1 Screen" },
      { value: "18%", label: "Margin Improvement" }
    ],
    keyChallenges: [
      { problem: "Tablet Hell in Kitchen", description: "Juggling multiple delivery tablets leads to missed orders, wrong items, and driver delays." },
      { problem: "Shared Ingredient Depletion", description: "Tracking raw chicken or rice used across 5 different virtual brands leads to unexpected stockouts." }
    ],
    restobirdSolutions: [
      { title: "Unified Delivery Stream", description: "Consolidate DoorDash, UberEats, and online orders into one kitchen screen.", icon: "Zap" },
      { title: "Multi-Brand Recipe Depletion", description: "Automatically deduct shared ingredients from central stock regardless of which brand sold the item.", icon: "Boxes" }
    ],
    workflowSteps: [
      { step: "01", title: "Consolidate Order Feeds", description: "Route all third-party channels into RestoBird." },
      { step: "02", title: "Track Unified Stock", description: "Monitor real-time raw ingredient levels across all virtual brand sales." }
    ],
    faqs: [
      { question: "Can RestoBird track inventory shared between multiple virtual brands?", answer: "Yes! RestoBird maps shared raw ingredients to a single master inventory ledger, depleting stock in real time regardless of which virtual menu sold the item." }
    ],
    seoTitle: "Cloud & Ghost Kitchen Management Software | RestoBird",
    seoDescription: "Consolidate delivery channels, track shared ingredient inventory, and streamline virtual brand operations with RestoBird."
  },
  "bars-and-pubs": {
    slug: "bars-and-pubs",
    title: "Bar, Pub & Nightclub Operations Software",
    subtitle: "Track liquor depletion by the ounce, prevent bartender spill variance, and manage late-night shifts.",
    description: "RestoBird provides precise liquor inventory depletion, pour-cost analytics, fast bar tab processing, and late-night shift labor management.",
    heroBadge: "Beverage & Bar Operations",
    targetAudience: "Bars, Nightclubs, Craft Breweries & Taprooms",
    stats: [
      { value: "15%", label: "Pour Cost Savings" },
      { value: "Ounce-Level", label: "Spirits & Wine Depletion" },
      { value: "100%", label: "Tab Reconciliation" }
    ],
    keyChallenges: [
      { problem: "Unrecorded Free Pours & Spills", description: "Over-pouring, unrecorded giveaways, and spills erode beverage profit margins fast." },
      { problem: "High-Volume Bar Tab Management", description: "Slow bar POS terminals cause customer friction during peak weekend shifts." }
    ],
    restobirdSolutions: [
      { title: "Ounce-Level Spirits Tracking", description: "Deduct exact shot and cocktail volumes from bottle inventory with every ring-up.", icon: "Boxes" },
      { title: "Beverage Pour Analytics", description: "Identify variance between expected spirit usage and actual bottle stock counts.", icon: "LineChart" }
    ],
    workflowSteps: [
      { step: "01", title: "Connect Bar POS", description: "Sync bar registers and handheld devices." },
      { step: "02", title: "Log Cocktail Recipes", description: "Set exact fluid ounce specifications for signatures and wells." }
    ],
    faqs: [
      { question: "Does RestoBird track liquor variance by the ounce?", answer: "Yes! RestoBird converts drink orders into fluid ounce deductions, allowing bar managers to pinpoint over-pouring and unrecorded spills." }
    ],
    seoTitle: "Bar & Nightclub Management Software | RestoBird",
    seoDescription: "Track liquor depletion by the ounce, reduce pour costs, and optimize bar shift scheduling with RestoBird."
  },
  "franchises": {
    slug: "franchises",
    title: "Franchise Restaurant Management System",
    subtitle: "Standardize recipes, centralize vendor purchasing, and enforce operational compliance across franchise networks.",
    description: "RestoBird equips franchisors and multi-unit franchisees with enterprise recipe master controls, vendor contract rate enforcement, and multi-store reporting.",
    heroBadge: "Franchise Enterprise Platform",
    targetAudience: "Restaurant Franchisors & Regional Master Franchisees",
    stats: [
      { value: "100%", label: "Recipe Standard Compliance" },
      { value: "Centralized", label: "Vendor Rate Enforcement" },
      { value: "Multi-Store", label: "Executive Benchmarking" }
    ],
    keyChallenges: [
      { problem: "Inconsistent Recipe Execution", description: "Franchise locations altering recipe portions damages brand standards and customer trust." },
      { problem: "Vendor Price Slippage", description: "Individual outlets paying higher ingredient prices due to uncoordinated vendor purchasing." }
    ],
    restobirdSolutions: [
      { title: "Master Recipe Controls", description: "Lock core recipe specifications centrally across all franchise locations.", icon: "ShieldCheck" },
      { title: "Vendor AP Rate Auditing", description: "Ensure every franchisee receives contracted vendor pricing on approved ingredients.", icon: "Receipt" }
    ],
    workflowSteps: [
      { step: "01", title: "Deploy Master Hierarchy", description: "Set up central corporate templates and grant store-level access." },
      { step: "02", title: "Monitor Franchise Metrics", description: "Compare food cost variance, sales volume, and labor efficiency across all units." }
    ],
    faqs: [
      { question: "Can corporate managers lock recipe specs across all franchise locations?", answer: "Yes! RestoBird allows central brand managers to publish immutable master recipes that sync across all franchisee systems." }
    ],
    seoTitle: "Franchise Restaurant Management System | RestoBird",
    seoDescription: "Enforce recipe standards, centralize vendor procurement, and benchmark multi-unit franchise performance with RestoBird."
  },
  "multi-location-restaurants": {
    slug: "multi-location-restaurants",
    title: "Multi-Location Restaurant Chain Management",
    subtitle: "Gain complete bird's-eye visibility across all store locations, central commissaries, and inventory transfers.",
    description: "RestoBird enables multi-outlet restaurant groups to manage inter-store inventory transfers, consolidated supplier purchasing, and comparative P&L performance.",
    heroBadge: "Multi-Outlet Executive System",
    targetAudience: "Multi-Unit Restaurant Groups (2 to 100+ Outlets)",
    stats: [
      { value: "Centralized", label: "Multi-Store Control" },
      { value: "Real-Time", label: "Stock Transfers" },
      { value: "Consolidated", label: "Executive Analytics" }
    ],
    keyChallenges: [
      { problem: "Inter-Store Stock Invisibility", description: "Transferring ingredients between locations without clear ledger logs leads to inventory discrepancies." },
      { problem: "Fragmented Financial Reporting", description: "Waiting until month-end accounting to compare store profitability delays critical business decisions." }
    ],
    restobirdSolutions: [
      { title: "Inter-Store Stock Transfers", description: "Log ingredient movements between outlets with automated receiving confirmations.", icon: "Boxes" },
      { title: "Consolidated Executive Analytics", description: "View sales, food costs, labor %, and prime cost metrics across all stores in real time.", icon: "PieChart" }
    ],
    workflowSteps: [
      { step: "01", title: "Connect Multi-Store Outlets", description: "Unify store POS registers under a single master organization." },
      { step: "02", title: "Manage Central Commissary", description: "Process bulk central prep orders and dispatch stock to satellite outlets." }
    ],
    faqs: [
      { question: "How does RestoBird manage stock transfers between outlets?", answer: "RestoBird logs transfer dispatches and receipts in real time, updating inventory balances for both sending and receiving locations automatically." }
    ],
    seoTitle: "Multi-Location Restaurant Chain Management | RestoBird",
    seoDescription: "Manage multi-outlet restaurant inventory, inter-store transfers, and consolidated financial reporting with RestoBird."
  }
};
