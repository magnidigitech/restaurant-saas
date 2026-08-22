# Catering & Event Management Module Specification

## 1. Executive Summary

The **Catering & Event Management** module is an enterprise-grade extension designed for multi-outlet restaurant management, banquet halls, and commercial catering operators. It streamlines event order lifecycle tracking, per-guest (Pax) pricing, recipe ingredient scaling, deposit management, and client invoice generation.

This module functions in two flexible operational modes:
1. **Recipe-Integrated Mode**: Automatically links menu items to the `Recipe` master data catalog, dynamically calculating dish unit costs, selling prices, and bulk raw ingredient depletion requirements scaled to guest headcount (Pax).
2. **Independent / Standalone Mode**: Operates autonomously without pre-existing recipes, allowing event planners to input custom dishes, package pricing, equipment rentals, staffing fees, and logistics line items.

---

## 2. Core Operational Pillars

### 2.1 Event Order Lifecycle Management
- **Order Numbering**: Auto-generated unique format (e.g. `CAT-2026-0001`).
- **Status Workflow**:
  - `DRAFT`: Initial customer quote / menu draft.
  - `CONFIRMED`: Contract signed, deposit locked.
  - `IN_PREPARATION`: Kitchen prep & raw material procurement active.
  - `DELIVERED`: Event food dispatched / set up on-site.
  - `COMPLETED`: Event concluded & final invoice balance settled.
  - `CANCELLED`: Booking voided.
- **Event Metadata**: Event Name, Client CRM details (Name, Email, Phone), Event Date & Time, Event Type (`WEDDING`, `CORPORATE`, `BIRTHDAY`, `PRIVATE_DINING`, `BUFFET`, `PACKED_MEALS`, `OTHER`), Guest Pax Count, Venue Address.

### 2.2 Smart Item & Recipe Autofill Engine
- **Recipe Catalog Selection**: Direct lookup against tenant `Recipe` model.
- **Autofill Actions**:
  - Populates Dish Name, Unit Price, Category (`Starter`, `Main Course`, `Dessert`, `Beverage`, `Service`).
  - Stores `recipeId` reference for automated ingredient scaling.
- **Pax Ingredient Requirement Scaler**:
  - Calculates Pax Multiplier: `Multiplier = Guest Count / Recipe Yield Quantity`.
  - Aggregates raw inventory ingredients needed across all event items.
  - Generates kitchen shopping list (e.g. 50 kg Basmati Rice, 15 kg Chicken, 5L Cooking Oil).

### 2.3 Financial & Deposit Engine
- **Itemized Pricing**: Standard unit price multiplied by quantity (or Pax servings).
- **Tax & Discounts**: Configurable tax rate (%) and flat/percentage discounts.
- **Advance Deposit Tracking**: Logs advance payment (`advancePaid`), remaining balance (`balanceDue`).
- **Client Quote / Invoice Generator**: Professional printable document layout with restaurant branding, deposit summary, and terms.

---

## 3. Database Entity Architecture

```prisma
enum CateringEventType {
  WEDDING
  CORPORATE
  BIRTHDAY
  PRIVATE_DINING
  BUFFET
  PACKED_MEALS
  OTHER
}

enum CateringOrderStatus {
  DRAFT
  CONFIRMED
  IN_PREPARATION
  DELIVERED
  COMPLETED
  CANCELLED
}

model CateringOrder {
  id             String              @id @default(uuid())
  restaurantId   String              @map("restaurant_id")
  outletId       String?             @map("outlet_id")
  orderNumber    String              @map("order_number")
  eventName      String              @map("event_name")
  clientName     String              @map("client_name")
  clientEmail    String?             @map("client_email")
  clientPhone    String?             @map("client_phone")
  eventDate      DateTime            @map("event_date")
  eventTime      String?             @map("event_time")
  eventType      CateringEventType   @default(BUFFET) @map("event_type")
  guestCount     Int                 @default(50) @map("guest_count")
  venueAddress   String?             @map("venue_address")
  status         CateringOrderStatus @default(DRAFT)
  subtotal       Decimal             @default(0)
  taxAmount      Decimal             @default(0) @map("tax_amount")
  discountAmount Decimal             @default(0) @map("discount_amount")
  totalAmount    Decimal             @default(0) @map("total_amount")
  advancePaid    Decimal             @default(0) @map("advance_paid")
  balanceDue     Decimal             @default(0) @map("balance_due")
  notes          String?
  createdAt      DateTime            @default(now()) @map("created_at")
  updatedAt      DateTime            @updatedAt @map("updated_at")

  restaurant Restaurant        @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  outlet     RestaurantOutlet? @relation(fields: [outletId], references: [id], onDelete: SetNull)
  items      CateringOrderItem[]

  @@unique([restaurantId, orderNumber])
  @@index([restaurantId])
  @@index([eventDate])
  @@map("catering_orders")
}

model CateringOrderItem {
  id              String   @id @default(uuid())
  cateringOrderId String   @map("catering_order_id")
  recipeId        String?  @map("recipe_id")
  itemName        String   @map("item_name")
  category        String?  @default("Main Course")
  unitPrice       Decimal  @default(0) @map("unit_price")
  quantity        Decimal  @default(1)
  totalPrice      Decimal  @default(0) @map("total_price")
  notes           String?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  cateringOrder CateringOrder @relation(fields: [cateringOrderId], references: [id], onDelete: Cascade)
  recipe        Recipe?       @relation(fields: [recipeId], references: [id], onDelete: SetNull)

  @@index([cateringOrderId])
  @@index([recipeId])
  @@map("catering_order_items")
}
```

---

## 4. Security & Module Entitlement

- **Module Key**: `catering`
- **Permissions**:
  - `catering:view`: Access catering dashboard, event list, and invoices.
  - `catering:manage_orders`: Create, update, or cancel event orders.
  - `catering:manage_packages`: Add custom dishes & link recipes.
  - `catering:approve_deposit`: Record advance deposits and balance adjustments.

---

## 5. UI & User Experience Guidelines

- **Clean Vector Design**: Uses SVG icon system exclusively (`lucide` vector icons). No emojis.
- **Visual Hierarchy**: High-contrast status badges (Emerald for `CONFIRMED`, Slate for `DRAFT`, Blue for `IN_PREPARATION`, Amber for `DELIVERED`, Purple for `COMPLETED`, Red for `CANCELLED`).
- **Interactive Scaler Drawer**: Real-time view of kitchen raw material demands based on event guest count.
- **Client Document Generator**: Dedicated print/PDF-ready client proposal and tax invoice layout.
