export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: "pos" | "inventory" | "workforce" | "analytics" | "operations";
  categoryLabel: string;
  publishDate: string;
  readTime: string;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  featuredImage: string;
  keywords: string[];
  content: {
    intro: string;
    sections: {
      heading: string;
      body: string;
      callout?: string;
      bulletPoints?: string[];
    }[];
    conclusion: string;
  };
}

export const BLOG_CATEGORIES = [
  { id: "all", label: "All Articles" },
  { id: "pos", label: "POS Integrations" },
  { id: "inventory", label: "Inventory & Recipe Depletion" },
  { id: "workforce", label: "Shifts & Payroll" },
  { id: "analytics", label: "Menu Engineering" },
  { id: "operations", label: "Hospitality Operations" },
];

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-prevent-inventory-leakage-and-recipe-depletion",
    title: "How Multi-Outlet Restaurants Eliminate Gram-Level Inventory Leakage",
    excerpt:
      "Discover how leading restaurant groups track ingredient depletion in real time directly from POS ticket streams, cutting food costs by 8.4%.",
    category: "inventory",
    categoryLabel: "Inventory & Recipe Depletion",
    publishDate: "September 14, 2026",
    readTime: "6 min read",
    author: {
      name: "Resto Bird Culinary Ops Team",
      role: "Hospitality Inventory Specialist",
      avatar: "/resto-bird-flaticon.png",
    },
    featuredImage: "/resto-bird-logo.png",
    keywords: [
      "getrestobird",
      "Resto Bird inventory",
      "recipe depletion software",
      "restaurant food cost reduction",
      "gram level inventory depletion",
      "multi outlet inventory software",
    ],
    content: {
      intro:
        "Food waste and raw ingredient variance are two of the largest silent profit killers in hospitality. For multi-outlet restaurant operators, tracking raw protein, dairy, and produce variance across locations using spreadsheet logs is nearly impossible. Resto Bird (@getrestobird) changes this by connecting your front-of-house POS directly to gram-level recipe Bill of Materials (BOM).",
      sections: [
        {
          heading: "The Root Cause of Food Variance in Modern Dining",
          body: "Most restaurant POS systems only count sold dish quantities — they don't calculate raw ingredient weight. When a line cook over-portions steaks by 1.5 ounces or spills heavy cream during rush hour, conventional software shows zero anomaly until end-of-month stock counts reveal a $4,000 deficit.",
          callout: "Did you know? Over-portioning by just 0.5 oz per plate across 400 daily covers accumulates to over $18,000 in unaccounted annual loss for a single location.",
          bulletPoints: [
            "Manual Excel counts lag behind actual kitchen depletion by 7 to 30 days.",
            "Lack of real-time itemized waste logs hides line kitchen spoilage.",
            "Static vendor pricing models fail to account for daily market inflation.",
          ],
        },
        {
          heading: "Real-Time POS Ticket Deconstruction",
          body: "Resto Bird breaks down every ordered ticket instantly. When an order for 'Truffle Wagyu Burger' passes through Toast, Square, or Clover POS, Resto Bird deconstructs the item into exact recipe components: 220g Wagyu Beef, 1 Brioche Bun, 15g Truffle Butter, and 30g Aged Cheddar. Stock balances adjust automatically down to the gram.",
        },
        {
          heading: "Automated Purchase Orders & Par-Level Alerts",
          body: "When ingredient levels drop below minimum operating thresholds, Resto Bird generates formatted Purchase Orders (POs) sent straight to your preferred vendors via email or EDI, eliminating emergency morning runs.",
        },
      ],
      conclusion:
        "By enforcing automated gram-level recipe depletion, Resto Bird enables restaurant managers to control margins, eliminate stockouts, and boost operating profit by over 8%.",
    },
  },
  {
    slug: "connecting-toast-square-clover-pos-into-unified-kds",
    title: "Connecting Toast, Square & Clover POS into One Unified Kitchen Stream",
    excerpt:
      "Learn how unifying front-of-house order streams from Toast, Square, and Clover speeds up ticket fulfillment to sub-second response times.",
    category: "pos",
    categoryLabel: "POS Integrations",
    publishDate: "September 12, 2026",
    readTime: "5 min read",
    author: {
      name: "Resto Bird Tech Lead",
      role: "POS Integration Engineer",
      avatar: "/resto-bird-flaticon.png",
    },
    featuredImage: "/resto-bird-logo.png",
    keywords: [
      "getrestobird pos",
      "Resto Bird POS integration",
      "unified kitchen display system",
      "Toast Square Clover KDS",
      "sub second KDS routing",
    ],
    content: {
      intro:
        "Operating multiple POS terminals or third-party delivery tablets in the same kitchen creates ticket bottlenecks, miscommunication, and slow table turn times. Resto Bird (@getrestobird) solves this by routing all order channels into one sub-second Kitchen Display System (KDS).",
      sections: [
        {
          heading: "The Pitfalls of Dual-Screen Kitchen Operations",
          body: "When line cooks have to monitor separate displays for dine-in orders, online pickup, and catering orders, ticket completion times increase by an average of 4.2 minutes per order.",
          bulletPoints: [
            "Conflicting station routing leads to cold appetizers and delayed mains.",
            "Double-entry errors when staff manually re-enter delivery orders into the register.",
            "Higher printer paper costs and misplaced paper tickets.",
          ],
        },
        {
          heading: "Sub-Second Webhook Ticket Sync",
          body: "Resto Bird receives incoming order webhooks in under 200 milliseconds. Tickets are automatically categorized by preparation station (Grill, Fryer, Cold Line, Bar) with color-coded timers indicating table urgency.",
        },
      ],
      conclusion:
        "Unifying your front-of-house registers into Resto Bird's KDS ensures fast ticket turnaround times, happier guests, and higher seating capacity per shift.",
    },
  },
  {
    slug: "eliminating-buddy-punching-and-automated-tip-pooling",
    title: "Eliminating Buddy Punching & Automating Tip Pools for Shift Staff",
    excerpt:
      "Streamline hospitality workforce operations with PIN & camera-verified tablet clocking, automated shift swaps, and 1-click tip distribution.",
    category: "workforce",
    categoryLabel: "Shifts & Payroll",
    publishDate: "September 10, 2026",
    readTime: "7 min read",
    author: {
      name: "Resto Bird Workforce Team",
      role: "People & Labor Specialist",
      avatar: "/resto-bird-flaticon.png",
    },
    featuredImage: "/resto-bird-logo.png",
    keywords: [
      "getrestobird shifts",
      "Resto Bird payroll",
      "restaurant buddy punching prevention",
      "automated tip pooling software",
      "time clock kiosk tablet",
    ],
    content: {
      intro:
        "Managing hourly hospitality staff is notoriously complex due to late shift trades, overtime compliance, and end-of-night tip pool disputes. Resto Bird (@getrestobird) unifies time tracking, scheduling, and tip distribution into a single seamless portal.",
      sections: [
        {
          heading: "Preventing Buddy Punching with Kiosk Verification",
          body: "Traditional punch clocks or unverified tablet PINs make buddy punching easy. Resto Bird's clocking kiosk verifies team member clock-ins with high-speed PIN entry and optional camera snapshots, eliminating unworked labor hours.",
          callout: "Labor cost leaks account for nearly 5% of total restaurant payroll when unverified clock-ins and early punches go unchecked.",
        },
        {
          heading: "Automated Shift Swaps & Peer Trade Board",
          body: "Instead of managing shift changes through frantic group text messages, employees submit shift trades directly through Resto Bird. Managers approve trades with one tap, automatically updating the master roster.",
        },
        {
          heading: "Fair & Compliant Tip Distribution",
          body: "Resto Bird calculates points-based or hours-worked tip pools automatically from daily POS revenue feeds, generating transparent tip payouts ready for payroll disbursement.",
        },
      ],
      conclusion:
        "Automating shift rosters and tip distribution eliminates manager administrative headaches while building trust across front and back of house staff.",
    },
  },
  {
    slug: "menu-engineering-analytics-for-maximum-margin",
    title: "Menu Engineering Analytics: How to Increase Profit Margins by 14%",
    excerpt:
      "Learn how classifying menu items into Stars, Plowhorses, Puzzles, and Dogs helps you optimize pricing and double dish profitability.",
    category: "analytics",
    categoryLabel: "Menu Engineering",
    publishDate: "September 08, 2026",
    readTime: "8 min read",
    author: {
      name: "Resto Bird Financial Analytics Team",
      role: "Menu Engineering Specialist",
      avatar: "/resto-bird-logo.png",
    },
    featuredImage: "/resto-bird-logo.png",
    keywords: [
      "getrestobird analytics",
      "Resto Bird menu engineering",
      "restaurant profit margin optimization",
      "menu matrix stars plowhorses puzzles dogs",
    ],
    content: {
      intro:
        "Every item on your restaurant menu contributes differently to your bottom line. Resto Bird's Menu Engineering Matrix classifies dishes based on popularity and contribution margin, giving operators data-driven pricing intelligence.",
      sections: [
        {
          heading: "Understanding the Four Menu Matrix Quadrants",
          body: "By evaluating exact recipe cost against transaction volume, Resto Bird categorizes every dish automatically:",
          bulletPoints: [
            "⭐ Stars: High Profit, High Popularity — Highlight these dishes prominently on your floor menu.",
            "🐎 Plowhorses: Low Profit, High Popularity — Slightly adjust portioning or price to increase margins.",
            "🧩 Puzzles: High Profit, Low Popularity — Redescribe or reposition these high-margin items.",
            "🐕 Dogs: Low Profit, Low Popularity — Replace or revamp underperforming dishes.",
          ],
        },
        {
          heading: "Dynamic Margin Adjustments",
          body: "Resto Bird monitors vendor ingredient price shifts in real time. If butter or salmon prices spike, Resto Bird alerts you which menu items are dropping out of profit thresholds before month-end financial statements.",
        },
      ],
      conclusion:
        "Applying continuous menu engineering data ensures your menu remains profitable, relevant, and optimized for maximum yield.",
    },
  },
];
