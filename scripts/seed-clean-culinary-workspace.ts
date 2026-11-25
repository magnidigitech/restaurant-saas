import { prisma } from "../src/core/database/client";
import { syncRecipeCosting } from "../src/core/inventory/recipeCosting";
import { UnitOfMeasure } from "@prisma/client";

async function seed() {
  console.log("=========================================================");
  console.log("  CULINARY WORKSPACE: CLEANUP & INGREDIENT/RECIPE SEEDING");
  console.log("=========================================================");

  const bahubali = await prisma.restaurant.findUnique({
    where: { subdomain: "bahubali" },
    include: { outlets: true },
  });

  if (!bahubali) {
    throw new Error("Restaurant 'bahubali' not found!");
  }

  const restaurantId = bahubali.id;
  const outletId = bahubali.outlets[0]?.id;
  console.log(`Target Restaurant: ${bahubali.name} (${restaurantId})`);
  console.log(`Primary Outlet: ${bahubali.outlets[0]?.name} (${outletId})`);

  // ---------------------------------------------------------------------------
  // STEP 1: CLEAN UP TEMPORARY TEST TENANTS & TEST ITEMS
  // ---------------------------------------------------------------------------
  console.log("\n[1/5] Cleaning up test data & temporary test restaurants...");

  // Delete temporary test restaurants
  const testTenants = await prisma.restaurant.findMany({
    where: { name: { contains: "Test Kitchen Studio" } },
    select: { id: true, name: true },
  });
  if (testTenants.length > 0) {
    console.log(`Found ${testTenants.length} temporary test studio restaurants. Deleting...`);
    for (const t of testTenants) {
      try {
        await prisma.restaurant.delete({ where: { id: t.id } });
      } catch (err: any) {
        console.warn(`Could not delete tenant ${t.name}:`, err.message);
      }
    }
  }

  // Delete test items and their references in Bahubali
  const testItems = await prisma.inventoryItem.findMany({
    where: {
      restaurantId,
      OR: [
        { name: { contains: "Test" } },
        { name: { contains: "test" } },
        { sku: null },
      ],
    },
    select: { id: true, name: true },
  });

  console.log(`Found ${testItems.length} test/untracked items in Bahubali.`);
  const testIds = testItems.map((t) => t.id);

  if (testIds.length > 0) {
    // Delete relations first
    await prisma.stockLedger.deleteMany({ where: { itemId: { in: testIds } } });
    await prisma.purchaseOrderReceipt.deleteMany({ where: { itemId: { in: testIds } } });
    await prisma.purchaseOrderItem.deleteMany({ where: { itemId: { in: testIds } } });
    await prisma.vendorItem.deleteMany({ where: { itemId: { in: testIds } } });
    await prisma.itemPurchasePack.deleteMany({ where: { itemId: { in: testIds } } });
    await prisma.recipeItem.deleteMany({ where: { inventoryItemId: { in: testIds } } });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: testIds } } });
    console.log("Successfully removed all test inventory items and related records.");
  }

  // Clean up any test POs without items
  await prisma.purchaseOrder.deleteMany({
    where: {
      restaurantId,
      items: { none: {} },
    },
  });

  // ---------------------------------------------------------------------------
  // STEP 2: CATEGORIES SETUP
  // ---------------------------------------------------------------------------
  console.log("\n[2/5] Ensuring clean culinary categories...");

  const categoryNames = [
    "Fresh Produce",
    "Meat & Poultry",
    "Dairy & Eggs",
    "Grains & Dry Goods",
    "Pantry & Spices",
    "Packaging & Supplies",
  ];

  const categoryMap = new Map<string, string>();

  for (const name of categoryNames) {
    let cat = await prisma.inventoryCategory.findFirst({
      where: { restaurantId, name },
    });
    if (!cat) {
      cat = await prisma.inventoryCategory.create({
        data: {
          restaurantId,
          name,
        },
      });
      console.log(`Created category: ${name}`);
    }
    categoryMap.set(name, cat.id);
  }

  // Map legacy 'Pantry & Condiments' if needed
  const legacyPantry = await prisma.inventoryCategory.findFirst({
    where: { restaurantId, name: "Pantry & Condiments" },
  });
  if (legacyPantry) {
    categoryMap.set("Pantry & Spices", legacyPantry.id);
  }

  // ---------------------------------------------------------------------------
  // STEP 3: SEED PROFESSIONAL CULINARY INVENTORY ITEMS
  // ---------------------------------------------------------------------------
  console.log("\n[3/5] Seeding realistic restaurant ingredients with purchase packs...");

  interface IngredientSeed {
    name: string;
    sku: string;
    category: string;
    unit: UnitOfMeasure;
    cost: number;
    initialStock: number;
    pack?: {
      name: string;
      container: string;
      unitsPerPack: number;
      price: number;
    };
  }

  const ingredients: IngredientSeed[] = [
    // Fresh Produce
    {
      name: "Roma Tomatoes",
      sku: "PRD-TOM-001",
      category: "Fresh Produce",
      unit: "LB",
      cost: 1.25,
      initialStock: 80,
      pack: { name: "40 lb Box", container: "Box", unitsPerPack: 40, price: 50.0 },
    },
    {
      name: "Yellow Cooking Onions",
      sku: "PRD-ONN-001",
      category: "Fresh Produce",
      unit: "LB",
      cost: 0.65,
      initialStock: 100,
      pack: { name: "50 lb Sack", container: "Sack", unitsPerPack: 50, price: 32.5 },
    },
    {
      name: "Fresh Garlic Cloves",
      sku: "PRD-GAR-001",
      category: "Fresh Produce",
      unit: "LB",
      cost: 2.4,
      initialStock: 20,
      pack: { name: "5 lb Bag", container: "Bag", unitsPerPack: 5, price: 12.0 },
    },
    {
      name: "Fresh Ginger Root",
      sku: "PRD-GIN-001",
      category: "Fresh Produce",
      unit: "LB",
      cost: 2.5,
      initialStock: 25,
      pack: { name: "10 lb Box", container: "Box", unitsPerPack: 10, price: 25.0 },
    },
    {
      name: "Fresh Mint & Cilantro Leaves",
      sku: "PRD-MNT-001",
      category: "Fresh Produce",
      unit: "LB",
      cost: 3.2,
      initialStock: 15,
      pack: { name: "1 lb Bunch", container: "Bag", unitsPerPack: 1, price: 3.2 },
    },
    {
      name: "Green Birdseye Chillies",
      sku: "PRD-CHL-001",
      category: "Fresh Produce",
      unit: "LB",
      cost: 3.5,
      initialStock: 10,
      pack: { name: "5 lb Box", container: "Box", unitsPerPack: 5, price: 17.5 },
    },
    {
      name: "Yukon Gold Potatoes",
      sku: "PRD-POT-001",
      category: "Fresh Produce",
      unit: "LB",
      cost: 0.8,
      initialStock: 100,
      pack: { name: "50 lb Sack", container: "Sack", unitsPerPack: 50, price: 40.0 },
    },

    // Meat & Poultry
    {
      name: "Boneless Skinless Chicken Thigh",
      sku: "RAW-CHK-002",
      category: "Meat & Poultry",
      unit: "LB",
      cost: 3.6,
      initialStock: 120,
      pack: { name: "40 lb Case", container: "Case", unitsPerPack: 40, price: 144.0 },
    },
    {
      name: "Chicken Breast",
      sku: "RAW-CHK-001",
      category: "Meat & Poultry",
      unit: "LB",
      cost: 4.5,
      initialStock: 80,
      pack: { name: "40 lb Case", container: "Case", unitsPerPack: 40, price: 180.0 },
    },
    {
      name: "Bone-in Mutton / Goat Curry Cut",
      sku: "RAW-MUT-001",
      category: "Meat & Poultry",
      unit: "LB",
      cost: 7.5,
      initialStock: 60,
      pack: { name: "30 lb Box", container: "Box", unitsPerPack: 30, price: 225.0 },
    },

    // Dairy & Eggs
    {
      name: "Fresh Malai Paneer",
      sku: "DAI-PAN-001",
      category: "Dairy & Eggs",
      unit: "KG",
      cost: 9.0,
      initialStock: 30,
      pack: { name: "5 kg Tub", container: "Box", unitsPerPack: 5, price: 45.0 },
    },
    {
      name: "Pure Desi Ghee",
      sku: "DAI-GHE-001",
      category: "Dairy & Eggs",
      unit: "KG",
      cost: 13.5,
      initialStock: 45,
      pack: { name: "15 kg Tin", container: "Case", unitsPerPack: 15, price: 202.5 },
    },
    {
      name: "Salted Butter 82%",
      sku: "DAI-BUT-001",
      category: "Dairy & Eggs",
      unit: "KG",
      cost: 8.5,
      initialStock: 50,
      pack: { name: "25 kg Block", container: "Case", unitsPerPack: 25, price: 212.5 },
    },
    {
      name: "Heavy Whipping Cream 35%",
      sku: "DAI-CRM-001",
      category: "Dairy & Eggs",
      unit: "L",
      cost: 4.5,
      initialStock: 40,
      pack: { name: "4 L Jug", container: "Case", unitsPerPack: 4, price: 18.0 },
    },
    {
      name: "Whole Milk Plain Yogurt",
      sku: "DAI-YOG-001",
      category: "Dairy & Eggs",
      unit: "KG",
      cost: 2.2,
      initialStock: 50,
      pack: { name: "10 kg Bucket", container: "Case", unitsPerPack: 10, price: 22.0 },
    },
    {
      name: "Fresh Whole Milk 3.25%",
      sku: "DAI-MLK-004",
      category: "Dairy & Eggs",
      unit: "L",
      cost: 1.95,
      initialStock: 32,
      pack: { name: "4 L Jug", container: "Case", unitsPerPack: 4, price: 7.8 },
    },

    // Grains & Dry Goods
    {
      name: "Royal Aged Basmati Rice",
      sku: "DRY-RICE-001",
      category: "Grains & Dry Goods",
      unit: "KG",
      cost: 2.6,
      initialStock: 100,
      pack: { name: "20 kg Bag", container: "Bag", unitsPerPack: 20, price: 52.0 },
    },
    {
      name: "Raw Whole Cashew Nuts",
      sku: "DRY-CSH-001",
      category: "Grains & Dry Goods",
      unit: "KG",
      cost: 11.5,
      initialStock: 25,
      pack: { name: "10 kg Box", container: "Box", unitsPerPack: 10, price: 115.0 },
    },
    {
      name: "All-Purpose Flour (Maida)",
      sku: "DRY-FLR-001",
      category: "Grains & Dry Goods",
      unit: "KG",
      cost: 1.1,
      initialStock: 50,
      pack: { name: "25 kg Sack", container: "Sack", unitsPerPack: 25, price: 27.5 },
    },

    // Pantry & Spices
    {
      name: "Kashmiri Red Chilli Powder",
      sku: "SP-KCH-001",
      category: "Pantry & Spices",
      unit: "KG",
      cost: 15.0,
      initialStock: 15,
      pack: { name: "1 kg Pkt", container: "Bag", unitsPerPack: 1, price: 15.0 },
    },
    {
      name: "Royal Shahi Garam Masala",
      sku: "SP-GMS-001",
      category: "Pantry & Spices",
      unit: "KG",
      cost: 22.0,
      initialStock: 10,
      pack: { name: "1 kg Pkt", container: "Bag", unitsPerPack: 1, price: 22.0 },
    },
    {
      name: "Hyderabadi Biryani Masala",
      sku: "SP-BRY-001",
      category: "Pantry & Spices",
      unit: "KG",
      cost: 24.0,
      initialStock: 10,
      pack: { name: "1 kg Pkt", container: "Bag", unitsPerPack: 1, price: 24.0 },
    },
    {
      name: "Kasuri Methi (Fenugreek)",
      sku: "SP-KSM-001",
      category: "Pantry & Spices",
      unit: "KG",
      cost: 18.0,
      initialStock: 8,
      pack: { name: "1 kg Box", container: "Box", unitsPerPack: 1, price: 18.0 },
    },
    {
      name: "Whole Spices (Cardamom, Cloves, Cinnamon)",
      sku: "SP-WHL-001",
      category: "Pantry & Spices",
      unit: "KG",
      cost: 36.0,
      initialStock: 6,
      pack: { name: "1 kg Bag", container: "Bag", unitsPerPack: 1, price: 36.0 },
    },
    {
      name: "Fine Cooking Salt",
      sku: "CON-SLT-001",
      category: "Pantry & Spices",
      unit: "KG",
      cost: 0.6,
      initialStock: 50,
      pack: { name: "25 kg Bag", container: "Bag", unitsPerPack: 25, price: 15.0 },
    },
    {
      name: "Canola Frying Oil",
      sku: "CON-OIL-003",
      category: "Pantry & Spices",
      unit: "GAL",
      cost: 20.0,
      initialStock: 25,
      pack: { name: "35 lb / 4.6 Gal Jug", container: "Case", unitsPerPack: 4.6, price: 92.0 },
    },
    {
      name: "Olive Oil Extra Virgin",
      sku: "CON-OIL-002",
      category: "Pantry & Spices",
      unit: "GAL",
      cost: 32.0,
      initialStock: 10,
    },

    // Packaging & Supplies
    {
      name: "Takeout Container 32oz",
      sku: "PKG-BOX-005",
      category: "Packaging & Supplies",
      unit: "PIECES",
      cost: 0.35,
      initialStock: 500,
      pack: { name: "250 ct Case", container: "Case", unitsPerPack: 250, price: 87.5 },
    },
    {
      name: "Biryani Handi Foil Container",
      sku: "PKG-HND-001",
      category: "Packaging & Supplies",
      unit: "PIECES",
      cost: 0.45,
      initialStock: 400,
      pack: { name: "200 ct Case", container: "Case", unitsPerPack: 200, price: 90.0 },
    },
  ];

  const itemMap = new Map<string, string>(); // name -> itemId

  for (const ing of ingredients) {
    const categoryId = categoryMap.get(ing.category) || null;

    let item = await prisma.inventoryItem.findFirst({
      where: { restaurantId, name: ing.name },
    });

    if (item) {
      item = await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          sku: ing.sku,
          categoryId,
          unitOfMeasure: ing.unit,
          costPerUnit: ing.cost,
          archivedAt: null,
        },
      });
    } else {
      item = await prisma.inventoryItem.create({
        data: {
          restaurantId,
          categoryId,
          name: ing.name,
          sku: ing.sku,
          unitOfMeasure: ing.unit,
          costPerUnit: ing.cost,
        },
      });
    }

    itemMap.set(ing.name, item.id);

    // Create or update purchase pack
    if (ing.pack) {
      const existingPack = await prisma.itemPurchasePack.findFirst({
        where: { itemId: item.id, name: ing.pack.name },
      });
      if (!existingPack) {
        await prisma.itemPurchasePack.create({
          data: {
            restaurantId,
            itemId: item.id,
            name: ing.pack.name,
            packType: ing.pack.container,
            packUnit: ing.unit,
            netQuantityPerPack: ing.pack.unitsPerPack,
            conversionFactor: ing.pack.unitsPerPack,
            isActive: true,
          },
        });
      }
    }

    // Ensure baseline opening stock in primary outlet
    if (outletId && ing.initialStock > 0) {
      const hasStock = await prisma.stockLedger.findFirst({
        where: { restaurantId, outletId, itemId: item.id },
      });
      if (!hasStock) {
        await prisma.stockLedger.create({
          data: {
            restaurantId,
            outletId,
            itemId: item.id,
            movementType: "PURCHASE",
            quantity: ing.initialStock,
            notes: "Opening culinary stock baseline",
            recordedBy: "Kitchen Seed Setup",
          },
        });
      }
    }
  }

  console.log(`Successfully verified ${ingredients.length} professional kitchen ingredients.`);

  // ---------------------------------------------------------------------------
  // STEP 4: BUILD 3 AUTHENTIC, COMPLETE RECIPES
  // ---------------------------------------------------------------------------
  console.log("\n[4/5] Formulating 3 professional restaurant recipes...");

  // Clear existing items in Bahubali recipes before rebuilding
  await prisma.recipeItem.deleteMany({
    where: { recipe: { restaurantId } },
  });

  // RECIPE 1: House Makhani Gravy Base (Prep Sub-Recipe)
  console.log("-> Building Recipe 1: House Makhani Gravy Base (Sub-Recipe)...");
  let makhaniRecipe = await prisma.recipe.findFirst({
    where: { restaurantId, name: "House Makhani Gravy Base" },
  });

  const makhaniData = {
    restaurantId,
    name: "House Makhani Gravy Base",
    type: "SUB_RECIPE" as const,
    yieldQuantity: 5,
    yieldUnit: "L" as UnitOfMeasure,
    sellingPrice: 0,
    costPerUnit: 0,
    totalCost: 0,
    targetFoodCostPercent: null,
    isDraft: false,
    description: "Velvety, slow-simmered tomato and cashew reduction infused with butter, cream, and aromatic fenugreek. Used as the foundation for butter curries.",
    instructions: `1. Blanch Roma tomatoes, remove skins, and blend into a fine puree.
2. In a large brass pot, melt half the butter and sauté ginger-garlic paste until fragrant (3-4 mins).
3. Add tomato puree, Kashmiri chilli powder, and salt. Simmer over medium-low heat for 35 mins until oil separates.
4. Grind soaked cashew nuts into a silky paste and stir into the simmering tomato reduction.
5. Finish with remaining butter, heavy cream, shahi garam masala, and rubbed kasuri methi.
6. Pass through a fine chinois strainer for a mirror-smooth glaze. Cool and portion into 5 L cambros.`,
  };

  if (makhaniRecipe) {
    makhaniRecipe = await prisma.recipe.update({
      where: { id: makhaniRecipe.id },
      data: makhaniData,
    });
  } else {
    makhaniRecipe = await prisma.recipe.create({
      data: makhaniData,
    });
  }

  const makhaniItems = [
    { name: "Roma Tomatoes", qty: 4.0, uom: "LB" as UnitOfMeasure, loss: 10, notes: "Blanched & deseeded" },
    { name: "Fresh Ginger Root", qty: 0.25, uom: "LB" as UnitOfMeasure, loss: 15, notes: "Peeled paste" },
    { name: "Fresh Garlic Cloves", qty: 0.25, uom: "LB" as UnitOfMeasure, loss: 10, notes: "Peeled paste" },
    { name: "Raw Whole Cashew Nuts", qty: 0.40, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Soaked & pureed" },
    { name: "Salted Butter 82%", qty: 0.35, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Cultured table butter" },
    { name: "Heavy Whipping Cream 35%", qty: 0.40, uom: "L" as UnitOfMeasure, loss: 0, notes: "Cream reduction" },
    { name: "Kashmiri Red Chilli Powder", qty: 0.05, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Bright red color" },
    { name: "Royal Shahi Garam Masala", qty: 0.03, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Aromatic blend" },
    { name: "Kasuri Methi (Fenugreek)", qty: 0.02, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Toasted & crushed" },
    { name: "Fine Cooking Salt", qty: 0.04, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Seasoning" },
  ];

  for (const item of makhaniItems) {
    const invId = itemMap.get(item.name);
    if (!invId) throw new Error(`Ingredient not found: ${item.name}`);
    await prisma.recipeItem.create({
      data: {
        recipeId: makhaniRecipe.id,
        componentType: "INVENTORY_ITEM",
        inventoryItemId: invId,
        quantity: item.qty,
        unitOfMeasure: item.uom,
        wastagePercent: item.loss,
        notes: item.notes,
      },
    });
  }

  await syncRecipeCosting(makhaniRecipe.id);
  console.log("   ✓ Makhani Gravy Base formulated and cost-synced.");

  // RECIPE 2: Paneer Butter Masala (Menu Dish)
  console.log("-> Building Recipe 2: Paneer Butter Masala (Menu Dish)...");
  let pbmRecipe = await prisma.recipe.findFirst({
    where: { restaurantId, name: "Paneer Butter Masala" },
  });

  const pbmData = {
    restaurantId,
    name: "Paneer Butter Masala",
    type: "DISH" as const,
    yieldQuantity: 10,
    yieldUnit: "PORTION" as UnitOfMeasure,
    sellingPrice: 15.5,
    targetFoodCostPercent: 28,
    isDraft: false,
    description: "Char-seared cottage cheese cubes simmered in velvety House Makhani Gravy, finished with cultured butter and heavy whipping cream.",
    instructions: `1. Dice fresh malai paneer into uniform 2.5 cm cubes.
2. In a heavy-bottomed handi or skillet, bring 2.5 L of House Makhani Gravy Base to a gentle simmer.
3. Gently fold in the paneer cubes, allowing them to warm through and absorb the rich sauce for 4-5 mins without breaking.
4. Mount the sauce with chilled butter knobs and swirl heavy cream off the flame.
5. Garnish each portion with crushed roasted kasuri methi and fresh cilantro.
6. Portion equally into 10 servings (approx. 200g paneer + 250ml gravy per portion).`,
  };

  if (pbmRecipe) {
    pbmRecipe = await prisma.recipe.update({
      where: { id: pbmRecipe.id },
      data: pbmData,
    });
  } else {
    pbmRecipe = await prisma.recipe.create({
      data: pbmData,
    });
  }

  // Items for Paneer Butter Masala (including sub-recipe link!)
  await prisma.recipeItem.create({
    data: {
      recipeId: pbmRecipe.id,
      componentType: "SUB_RECIPE",
      subRecipeId: makhaniRecipe.id,
      quantity: 2.5,
      unitOfMeasure: "L",
      wastagePercent: 0,
      notes: "House simmered gravy base",
    },
  });

  const pbmIngredients = [
    { name: "Fresh Malai Paneer", qty: 2.0, uom: "KG" as UnitOfMeasure, loss: 5, notes: "Cubed 2.5cm" },
    { name: "Salted Butter 82%", qty: 0.20, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Finishing mount" },
    { name: "Heavy Whipping Cream 35%", qty: 0.20, uom: "L" as UnitOfMeasure, loss: 0, notes: "Garnish swirl" },
    { name: "Kasuri Methi (Fenugreek)", qty: 0.015, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Toasted garnish" },
    { name: "Fresh Mint & Cilantro Leaves", qty: 0.05, uom: "LB" as UnitOfMeasure, loss: 0, notes: "Fresh chopped herbs" },
    { name: "Takeout Container 32oz", qty: 10, uom: "PIECES" as UnitOfMeasure, loss: 0, notes: "Packaging" },
  ];

  for (const item of pbmIngredients) {
    const invId = itemMap.get(item.name);
    if (!invId) throw new Error(`Ingredient not found: ${item.name}`);
    await prisma.recipeItem.create({
      data: {
        recipeId: pbmRecipe.id,
        componentType: "INVENTORY_ITEM",
        inventoryItemId: invId,
        quantity: item.qty,
        unitOfMeasure: item.uom,
        wastagePercent: item.loss,
        notes: item.notes,
      },
    });
  }

  await syncRecipeCosting(pbmRecipe.id);
  console.log("   ✓ Paneer Butter Masala formulated and cost-synced.");

  // RECIPE 3: Royal Hyderabadi Dum Biryani (Menu Dish)
  console.log("-> Building Recipe 3: Royal Hyderabadi Dum Biryani (Menu Dish)...");
  let biryaniRecipe = await prisma.recipe.findFirst({
    where: { restaurantId, name: "Royal Hyderabadi Dum Biryani" },
  });

  const biryaniData = {
    restaurantId,
    name: "Royal Hyderabadi Dum Biryani",
    type: "DISH" as const,
    yieldQuantity: 10,
    yieldUnit: "PORTION" as UnitOfMeasure,
    sellingPrice: 18.5,
    targetFoodCostPercent: 27,
    isDraft: false,
    description: "Authentic kacchi yakhni dum biryani with marinated tender chicken thighs, 2-year aged basmati, saffron, fried onions (birishta), and pure desi ghee.",
    instructions: `1. Marinate chicken thigh cuts in plain yogurt, ginger-garlic paste, slit green chillies, Hyderabadi biryani masala, half the ghee, and salt for a minimum of 4 hours.
2. Thinly slice yellow onions and fry in canola oil until deep golden-brown (birishta); drain and crush lightly.
3. Parboil soaked aged basmati rice with whole spices (cardamom, cloves, cinnamon) in salted boiling water to exactly 70% doneness (al dente grain with a slight bite).
4. In a heavy copper lagan or sealed pot, spread the raw marinated chicken (kacchi yakhni) evenly at the base.
5. Layer the parboiled aromatic rice over the meat, followed by layers of golden birishta, chopped mint, cilantro, and warm desi ghee.
6. Seal the pot hermetically with dough and cover with a tight-fitting lid.
7. Cook on high heat for 12 mins to build steam pressure, then transfer to a low flame on a hot tawa for 35 mins gentle dum.
8. Rest for 15 mins before gently opening from the side to preserve long, unbroken rice grains.`,
  };

  if (biryaniRecipe) {
    biryaniRecipe = await prisma.recipe.update({
      where: { id: biryaniRecipe.id },
      data: biryaniData,
    });
  } else {
    biryaniRecipe = await prisma.recipe.create({
      data: biryaniData,
    });
  }

  const biryaniIngredients = [
    { name: "Boneless Skinless Chicken Thigh", qty: 5.0, uom: "LB" as UnitOfMeasure, loss: 6, notes: "Curry cut trimmed" },
    { name: "Royal Aged Basmati Rice", qty: 2.5, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Aged long grain" },
    { name: "Whole Milk Plain Yogurt", qty: 0.75, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Yakhni marinade base" },
    { name: "Yellow Cooking Onions", qty: 3.0, uom: "LB" as UnitOfMeasure, loss: 18, notes: "Sliced for crispy birishta" },
    { name: "Pure Desi Ghee", qty: 0.35, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Aroma drizzle" },
    { name: "Fresh Ginger Root", qty: 0.15, uom: "LB" as UnitOfMeasure, loss: 15, notes: "Fresh paste" },
    { name: "Fresh Garlic Cloves", qty: 0.15, uom: "LB" as UnitOfMeasure, loss: 10, notes: "Fresh paste" },
    { name: "Green Birdseye Chillies", qty: 0.08, uom: "LB" as UnitOfMeasure, loss: 0, notes: "Slit length-wise" },
    { name: "Hyderabadi Biryani Masala", qty: 0.12, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Secret house spice blend" },
    { name: "Whole Spices (Cardamom, Cloves, Cinnamon)", qty: 0.04, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Rice pot infusion" },
    { name: "Fresh Mint & Cilantro Leaves", qty: 0.30, uom: "LB" as UnitOfMeasure, loss: 0, notes: "Herbal layers" },
    { name: "Fine Cooking Salt", qty: 0.08, uom: "KG" as UnitOfMeasure, loss: 0, notes: "Seasoning" },
    { name: "Biryani Handi Foil Container", qty: 10, uom: "PIECES" as UnitOfMeasure, loss: 0, notes: "Handi containers" },
  ];

  for (const item of biryaniIngredients) {
    const invId = itemMap.get(item.name);
    if (!invId) throw new Error(`Ingredient not found: ${item.name}`);
    await prisma.recipeItem.create({
      data: {
        recipeId: biryaniRecipe.id,
        componentType: "INVENTORY_ITEM",
        inventoryItemId: invId,
        quantity: item.qty,
        unitOfMeasure: item.uom,
        wastagePercent: item.loss,
        notes: item.notes,
      },
    });
  }

  await syncRecipeCosting(biryaniRecipe.id);
  console.log("   ✓ Royal Hyderabadi Dum Biryani formulated and cost-synced.");

  // ---------------------------------------------------------------------------
  // STEP 5: VERIFY FINAL DATA INTEGRITY
  // ---------------------------------------------------------------------------
  console.log("\n[5/5] Auditing final recipe financials & cost breakdown...");

  const allThree = [makhaniRecipe.id, pbmRecipe.id, biryaniRecipe.id];

  for (const rid of allThree) {
    const r = await prisma.recipe.findUnique({
      where: { id: rid },
      include: {
        items: {
          include: { inventoryItem: true, subRecipe: true },
        },
      },
    });

    if (!r) continue;

    console.log(`\n---------------------------------------------------------`);
    console.log(`RECIPE: ${r.name} [${r.type}]`);
    console.log(`Yield: ${r.yieldQuantity} ${r.yieldUnit}`);
    console.log(`Items count: ${r.items.length}`);
    console.log(`Batch Food Cost: $${Number(r.totalCost).toFixed(2)}`);
    console.log(`Unit Cost: $${Number(r.costPerUnit).toFixed(2)} / ${r.yieldUnit}`);
    if (r.type === "DISH") {
      const price = Number(r.sellingPrice);
      const unitCost = Number(r.costPerUnit);
      const foodCostPct = (unitCost / price) * 100;
      const marginPct = ((price - unitCost) / price) * 100;
      const profit = price - unitCost;
      console.log(`Selling Price: $${price.toFixed(2)}`);
      console.log(`Food Cost %: ${foodCostPct.toFixed(1)}%`);
      console.log(`Gross Margin %: ${marginPct.toFixed(1)}%`);
      console.log(`Gross Profit / Serving: $${profit.toFixed(2)}`);
    }
  }

  console.log("\n=========================================================");
  console.log("  CULINARY SEEDING COMPLETED SUCCESSFULLY!");
  console.log("=========================================================");
}

seed()
  .catch((e) => {
    console.error("Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
