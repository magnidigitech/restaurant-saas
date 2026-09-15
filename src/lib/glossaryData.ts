export interface GlossaryTerm {
  slug: string;
  term: string;
  definition: string;
  category: string;
  explanation: string;
  keyFormula?: string;
  whyItMatters: string;
  howRestoBirdHelps: string;
  faqs: { question: string; answer: string }[];
  seoTitle: string;
  seoDescription: string;
}

export const GLOSSARY_DATA: Record<string, GlossaryTerm> = {
  "restaurant-inventory-variance": {
    slug: "restaurant-inventory-variance",
    term: "Restaurant Inventory Variance",
    category: "Inventory & Costing",
    definition: "Inventory Variance is the dollar or unit difference between theoretical inventory (what should be in stock based on POS sales) and actual physical inventory counted in the restaurant.",
    explanation: "When theoretical stock counts differ from physical counts, the gap represents unaccounted inventory variance. Common causes include over-portioning on the kitchen line, unrecorded food waste, spillage, theft, or supplier short-shipments.",
    keyFormula: "Inventory Variance = Theoretical Ending Stock - Actual Physical Stock Count",
    whyItMatters: "High inventory variance directly erodes gross profit margins. Uncontrolled variance of even 3% to 5% can reduce a restaurant's annual net profit by tens of thousands of dollars.",
    howRestoBirdHelps: "RestoBird tracks real-time recipe depletion directly from POS tickets, automatically calculating theoretical usage down to the gram so operators can pinpoint exact variance sources immediately.",
    faqs: [
      { question: "What is an acceptable inventory variance percentage in restaurants?", answer: "Industry benchmark for food inventory variance is under 1.5% to 2%. Variance exceeding 3% indicates serious portion control or waste logging issues." }
    ],
    seoTitle: "What is Restaurant Inventory Variance? Definition & Formula | RestoBird",
    seoDescription: "Learn the definition, formula, and reduction strategies for restaurant inventory variance with RestoBird."
  },
  "recipe-costing-bom": {
    slug: "recipe-costing-bom",
    term: "Recipe Costing & Bill of Materials (BOM)",
    category: "Menu Engineering",
    definition: "A Recipe Bill of Materials (BOM) is an itemized breakdown of every raw ingredient, portion weight, and sub-recipe required to prepare a specific menu item, along with its calculated cost.",
    explanation: "By assigning current vendor purchase unit costs to every ingredient gram in a recipe BOM, restaurant operators can determine the exact cost-per-plate and set profitable menu prices.",
    keyFormula: "Plate Cost = Sum of (Ingredient Quantity × Unit Purchase Price)",
    whyItMatters: "Without accurate recipe BOM costing, restaurant owners risk underpricing popular dishes, eroding gross margins whenever food supplier prices rise.",
    howRestoBirdHelps: "RestoBird updates recipe BOM costs in real time as vendor invoices are processed, alerting management whenever a dish's food cost percentage exceeds target limits.",
    faqs: [
      { question: "Why is a recipe BOM important for restaurant management?", answer: "A recipe BOM ensures portion consistency across kitchen staff and provides precise cost data required to price menu items profitably." }
    ],
    seoTitle: "What is a Recipe Bill of Materials (BOM)? Definition & Costing | RestoBird",
    seoDescription: "Understand recipe Bill of Materials (BOM), recipe costing formulas, and menu pricing strategies with RestoBird."
  },
  "kitchen-display-system-kds": {
    slug: "kitchen-display-system-kds",
    term: "Kitchen Display System (KDS)",
    category: "Kitchen Operations",
    definition: "A Kitchen Display System (KDS) is a digital screen setup that replaces traditional paper kitchen tickets, routing incoming customer orders from POS registers directly to prep stations in real time.",
    explanation: "KDS units categorize orders by prep station (Grill, Fryer, Salad, Bar), color-coding orders by table urgency and tracking fulfillment speed to streamline kitchen workflow.",
    whyItMatters: "KDS units eliminate lost paper tickets, reduce kitchen communication errors, speed up table turn times, and provide executive analytics on ticket fulfillment speed.",
    howRestoBirdHelps: "RestoBird KDS synchronizes orders from Toast, Square, Clover, and online delivery apps in under 200 milliseconds, featuring offline resilience so kitchen lines never stall.",
    faqs: [
      { question: "How does a KDS improve kitchen ticket times?", answer: "A KDS organizes orders automatically by station, color-codes overdue tickets, and eliminates legibility issues caused by handwritten paper slips." }
    ],
    seoTitle: "What is a Kitchen Display System (KDS)? Definition & Benefits | RestoBird",
    seoDescription: "Learn how Kitchen Display Systems (KDS) replace paper tickets, speed up order fulfillment, and optimize kitchen lines with RestoBird."
  },
  "food-cost-percentage": {
    slug: "food-cost-percentage",
    term: "Food Cost Percentage",
    category: "Financial Analytics",
    definition: "Food Cost Percentage is the ratio of total raw ingredient cost to the total revenue generated by selling those dishes, expressed as a percentage.",
    explanation: "Food Cost % measures how efficiently a restaurant converts raw ingredients into sales revenue. A lower food cost percentage indicates higher dish profitability.",
    keyFormula: "Food Cost % = (Total Cost of Ingredients Used ÷ Total Dish Sales Revenue) × 100",
    whyItMatters: "Controlling food cost % is vital for restaurant survival. A shift from 28% to 34% can wipe out a restaurant's entire net operating profit.",
    howRestoBirdHelps: "RestoBird calculates food cost percentage continuously by combining live POS sales data with automated recipe inventory depletion.",
    faqs: [
      { question: "What is a good food cost percentage for a restaurant?", answer: "A healthy restaurant food cost percentage typically ranges between 28% and 32%, depending on restaurant concept and service model." }
    ],
    seoTitle: "What is Food Cost Percentage? Definition & Formula | RestoBird",
    seoDescription: "Learn how to calculate and optimize restaurant food cost percentage with RestoBird."
  },
  "prime-cost": {
    slug: "prime-cost",
    term: "Restaurant Prime Cost",
    category: "Financial Analytics",
    definition: "Prime Cost is the combined total of a restaurant's Cost of Goods Sold (COGS) and total labor expenses (hourly wages, salaries, payroll taxes, and benefits).",
    explanation: "Prime cost represents the largest controllable expenses in restaurant operations. Because managers can influence ingredient usage and labor shift scheduling daily, prime cost is the single most important metric for operational health.",
    keyFormula: "Prime Cost = Cost of Goods Sold (COGS) + Total Labor Costs",
    whyItMatters: "Successful restaurant operators aim to keep Prime Cost under 55% to 60% of total revenue. Exceeding 65% leaves insufficient margin to cover rent, utilities, and debt service.",
    howRestoBirdHelps: "RestoBird tracks both COGS (via recipe depletion) and labor expenses (via kiosk clock-ins and payroll export) in a single real-time dashboard.",
    faqs: [
      { question: "What percentage of revenue should restaurant prime cost be?", answer: "Target prime cost should ideally remain between 55% and 60% of total revenue." }
    ],
    seoTitle: "What is Restaurant Prime Cost? Definition & Target Formula | RestoBird",
    seoDescription: "Understand restaurant prime cost, COGS plus labor formulas, and target benchmarks with RestoBird."
  },
  "par-level": {
    slug: "par-level",
    term: "Inventory Par Level",
    category: "Purchasing & Inventory",
    definition: "An Inventory Par Level is the minimum quantity of a specific ingredient or supply item that a restaurant must maintain in stock to meet expected guest demand until the next vendor delivery.",
    explanation: "Par levels account for daily consumption rates, safety buffer stock, supplier lead time, and delivery frequency. When inventory drops to par level, a purchase order must be placed.",
    keyFormula: "Par Level = (Daily Ingredient Usage × Vendor Delivery Lead Time) + Safety Buffer Stock",
    whyItMatters: "Setting accurate par levels prevents both stockouts (running out of key menu items) and over-purchasing (which leads to food spoilage and tied-up cash flow).",
    howRestoBirdHelps: "RestoBird monitors stock depletion velocity automatically, alerting managers when items reach par levels and generating 1-click vendor POs.",
    faqs: [
      { question: "How often should restaurant par levels be reviewed?", answer: "Par levels should be reviewed seasonally or whenever sales volume, vendor lead times, or menu offerings change significantly." }
    ],
    seoTitle: "What is an Inventory Par Level? Definition & Formula | RestoBird",
    seoDescription: "Learn how to calculate ingredient par levels and prevent stockouts with RestoBird."
  }
};
