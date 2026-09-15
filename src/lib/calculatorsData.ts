export interface CalculatorInfo {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  heroBadge: string;
  seoTitle: string;
  seoDescription: string;
}

export const CALCULATORS_DATA: Record<string, CalculatorInfo> = {
  "food-cost-calculator": {
    slug: "food-cost-calculator",
    title: "Free Restaurant Food Cost & Dish Margin Calculator",
    subtitle: "Calculate your exact food cost percentage, cost-per-plate, and target menu pricing in seconds.",
    description: "Enter your raw recipe ingredient costs and target gross margin to discover optimal menu pricing and boost restaurant profitability.",
    heroBadge: "Interactive Financial Tool",
    seoTitle: "Free Restaurant Food Cost & Dish Margin Calculator | RestoBird",
    seoDescription: "Calculate cost-per-plate, food cost percentage, and optimal menu pricing with RestoBird's free interactive calculator."
  },
  "inventory-variance-calculator": {
    slug: "inventory-variance-calculator",
    title: "Free Restaurant Inventory Variance & Shrinkage Loss Calculator",
    subtitle: "Discover how much money your kitchen loses each month to over-portioning, unrecorded waste, and stock variance.",
    description: "Calculate annual profit loss caused by inventory shrinkage and see how much you can recover with RestoBird gram-level depletion.",
    heroBadge: "Interactive Loss Audit Tool",
    seoTitle: "Free Restaurant Inventory Variance & Shrinkage Calculator | RestoBird",
    seoDescription: "Audit your restaurant's monthly food waste, over-portioning, and inventory shrinkage with RestoBird."
  },
  "reorder-point-calculator": {
    slug: "reorder-point-calculator",
    title: "Free Restaurant Reorder Point & Safety Stock Calculator",
    subtitle: "Determine exact ingredient reorder points so your kitchen never runs out of key ingredients.",
    description: "Calculate optimal reorder quantities based on daily ingredient usage, supplier lead times, and safety buffer stock.",
    heroBadge: "Interactive Purchasing Tool",
    seoTitle: "Free Restaurant Reorder Point & Safety Stock Calculator | RestoBird",
    seoDescription: "Determine exact ingredient reorder points and safety stock limits for your kitchen with RestoBird."
  }
};
