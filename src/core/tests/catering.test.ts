import { prisma } from "../database/client";
import {
  createCateringOrder,
  listCateringOrders,
  calculateEventIngredients,
} from "../../modules/catering/service";

async function runCateringTest() {
  console.log("Starting Catering Module Automated Verification...");

  // 1. Fetch or create a test restaurant
  let restaurant = await prisma.restaurant.findFirst();
  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: "Test Catering Restaurant",
        subdomain: `test-catering-${Date.now()}`,
        status: "ACTIVE",
      },
    });
  }

  // 2. Create a test ingredient & recipe if needed
  let invItem = await prisma.inventoryItem.findFirst({
    where: { restaurantId: restaurant.id },
  });
  if (!invItem) {
    invItem = await prisma.inventoryItem.create({
      data: {
        restaurantId: restaurant.id,
        name: "Basmati Rice",
        costPerUnit: 2.5,
        unitOfMeasure: "KG",
      },
    });
  }

  let recipe = await prisma.recipe.findFirst({
    where: { restaurantId: restaurant.id },
  });
  if (!recipe) {
    recipe = await prisma.recipe.create({
      data: {
        restaurantId: restaurant.id,
        name: "Royal Hyderabadi Biryani",
        yieldQuantity: 10,
        yieldUnit: "PIECES",
        sellingPrice: 15.0,
        costPerUnit: 5.0,
        totalCost: 50.0,
        items: {
          create: [
            {
              componentType: "INVENTORY_ITEM",
              inventoryItemId: invItem.id,
              quantity: 2.5, // 2.5 kg for 10 portions
              unitOfMeasure: "KG",
              unitCost: 2.5,
              totalCost: 6.25,
            },
          ],
        },
      },
    });
  }

  // 3. Create a Catering Event Order linking to the recipe
  console.log("Creating test catering event order...");
  const newOrder = await createCateringOrder(restaurant.id, {
    eventName: "Tech Summit Gala Dinner",
    clientName: "Acme Innovations Inc",
    clientEmail: "events@acme.com",
    clientPhone: "+1 555-0199",
    eventDate: new Date(),
    eventTime: "19:00",
    eventType: "CORPORATE",
    guestCount: 100, // 100 Pax (10x multiplier over recipe yield of 10)
    venueAddress: "Convention Center Hall A",
    taxRatePercent: 5,
    discountAmount: 50,
    advancePaid: 500,
    items: [
      {
        recipeId: recipe.id,
        itemName: recipe.name,
        category: "Main Course",
        unitPrice: 15.0,
        quantity: 100,
      },
      {
        itemName: "Custom Welcome Cocktail",
        category: "Beverage",
        unitPrice: 5.0,
        quantity: 100,
      },
    ],
  });

  console.log("Created Order:", newOrder.orderNumber, "Status:", newOrder.status);
  console.log("Subtotal:", newOrder.subtotal, "Total Amount:", newOrder.totalAmount, "Balance Due:", newOrder.balanceDue);

  // 4. Test listing orders
  const listResult = await listCateringOrders(restaurant.id);
  console.log("Total Orders Count:", listResult.metrics.totalOrders);
  console.log("Active Bookings Count:", listResult.metrics.activeOrders);

  // 5. Test ingredient requirement scaling calculation
  console.log("Calculating raw ingredient requirement report...");
  const report = await calculateEventIngredients(restaurant.id, newOrder.id);
  console.log("Report Event Name:", report.eventName);
  console.log("Guest Count Pax:", report.guestCount);
  console.log("Raw Material Ingredients Needed:", report.rawMaterials);

  // Verification checks
  if (report.rawMaterials.length === 0) {
    throw new Error("Expected raw material requirements for recipe-linked item!");
  }
  const riceReq = report.rawMaterials.find((r) => r.name === "Basmati Rice");
  if (!riceReq || riceReq.requiredQuantity < 20) {
    throw new Error("Expected scaled Basmati Rice quantity to be ~25kg for 100 Pax!");
  }

  console.log("Catering Module Automated Verification Passed Successfully!");
}

runCateringTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Catering Verification Failed:", err);
    process.exit(1);
  });
