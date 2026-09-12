import {
  PosProviderAdapter,
  ProviderCredentials,
  ProviderValidationResult,
  ProviderFetchResult,
  NormalizedOrder,
} from "../types";

export class ToastAdapter implements PosProviderAdapter {
  provider = "TOAST" as const;
  displayName = "Toast POS";

  async validateCredentials(credentials: ProviderCredentials): Promise<ProviderValidationResult> {
    const { clientId, clientSecret, restaurantGuid, environment } = credentials;

    if (!clientId || !clientSecret || !restaurantGuid) {
      return {
        valid: false,
        error: "Missing required Toast API credentials: Client ID, Client Secret, and Restaurant GUID are required.",
      };
    }

    if (environment === "SANDBOX") {
      // Toast Partner Sandbox validation
      if (!restaurantGuid.startsWith("toast-") && restaurantGuid.length < 8) {
        return {
          valid: false,
          error: "Invalid Toast Restaurant GUID format for Sandbox. Please verify your developer portal GUID.",
        };
      }

      return {
        valid: true,
        locations: [
          {
            id: restaurantGuid,
            name: "Toast Main Dining & Bar (Sandbox)",
            address: "401 Park Dr, Boston, MA",
          },
          {
            id: `${restaurantGuid}-patio`,
            name: "Toast Patio & Takeout (Sandbox)",
            address: "401 Park Dr Suite 800, Boston, MA",
          },
        ],
        providerMetadata: {
          toastVersion: "Orders API v2 (Bulk)",
          environment: "SANDBOX",
          authenticatedAt: new Date().toISOString(),
        },
      };
    }

    // Production Toast API authentication
    try {
      const authEndpoint = "https://toast-api.toasttab.com/authentication/v1/authentication/login";
      const response = await fetch(authEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userType: "INTEGRATION",
          clientId,
          clientSecret,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          valid: false,
          error: `Toast API authentication failed (${response.status}): ${errText || "Invalid credentials or unauthorized integration partner"}`,
        };
      }

      const data = await response.json();
      return {
        valid: true,
        locations: [
          {
            id: restaurantGuid,
            name: "Toast Production Restaurant",
          },
        ],
        providerMetadata: {
          tokenType: data.tokenType || "Bearer",
          environment: "PRODUCTION",
        },
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Could not reach Toast API: ${err.message || "Network error. Please check your credentials or test mode."}`,
      };
    }
  }

  async fetchOrders(
    credentials: ProviderCredentials,
    options: { locationId?: string; since?: Date; limit?: number }
  ): Promise<ProviderFetchResult> {
    const { environment, restaurantGuid } = credentials;
    const limit = options.limit || 25;

    if (environment === "SANDBOX") {
      const mockOrders: NormalizedOrder[] = [
        {
          provider: "TOAST",
          providerOrderId: `tst_ord_98a412_${Date.now() - 120000}`,
          providerLocationId: options.locationId || restaurantGuid || "toast-loc-01",
          orderNumber: "TST-4102",
          orderType: "DINE_IN",
          status: "COMPLETED",
          totalAmount: 68.5,
          taxAmount: 5.48,
          tipAmount: 10.0,
          discountAmount: 0,
          refundAmount: 0,
          paymentMethod: "CREDIT_CARD",
          customerName: "Alex Rivera",
          customerPhone: "+1 (617) 555-0142",
          notes: "Table 14 - Toast Handheld Terminal",
          createdAt: new Date(Date.now() - 25 * 60 * 1000),
          rawPayload: {
            source: "Toast Go 2 Handheld",
            server: "Marcus L.",
            diningOption: "Dine In",
            guid: "8a1e-450f-90c1-392bf",
          },
          items: [
            {
              name: "Dry-Aged Ribeye 12oz",
              quantity: 1,
              unitPrice: 42.0,
              modifiers: [
                { name: "Temperature", price: 0, option: "Medium Rare" },
                { name: "Truffle Butter Glaze", price: 3.5 },
              ],
            },
            {
              name: "Smoked Gouda Mac & Cheese",
              quantity: 1,
              unitPrice: 12.0,
              modifiers: [{ name: "Crispy Bacon Topping", price: 2.5 }],
            },
            {
              name: "Local Craft IPA",
              quantity: 1,
              unitPrice: 8.5,
            },
          ],
        },
        {
          provider: "TOAST",
          providerOrderId: `tst_ord_82c901_${Date.now() - 900000}`,
          providerLocationId: options.locationId || restaurantGuid || "toast-loc-01",
          orderNumber: "TST-4101",
          orderType: "TAKEAWAY",
          status: "COMPLETED",
          totalAmount: 34.2,
          taxAmount: 2.74,
          tipAmount: 4.5,
          discountAmount: 5.0,
          refundAmount: 0,
          paymentMethod: "APPLE_PAY",
          customerName: "Sarah Jenkins",
          customerPhone: "+1 (617) 555-0198",
          notes: "Toast Online Ordering (Takeout)",
          createdAt: new Date(Date.now() - 75 * 60 * 1000),
          rawPayload: {
            source: "Toast Online Ordering",
            guid: "772f-110a-33c8-112df",
          },
          items: [
            {
              name: "Artisan Wood-Fired Margherita",
              quantity: 1,
              unitPrice: 18.0,
              modifiers: [{ name: "Extra Fresh Mozzarella", price: 2.0 }],
            },
            {
              name: "Classic Caesar Salad",
              quantity: 1,
              unitPrice: 14.0,
              modifiers: [{ name: "Grilled Chicken", price: 4.5 }],
            },
          ],
        },
        {
          provider: "TOAST",
          providerOrderId: `tst_ord_77f433_${Date.now() - 3600000}`,
          providerLocationId: options.locationId || restaurantGuid || "toast-loc-01",
          orderNumber: "TST-4098",
          orderType: "DELIVERY",
          status: "REFUNDED",
          totalAmount: 45.0,
          taxAmount: 3.6,
          tipAmount: 0,
          discountAmount: 0,
          refundAmount: 45.0,
          paymentMethod: "CREDIT_CARD",
          customerName: "David Kim",
          customerPhone: "+1 (617) 555-0312",
          notes: "Customer cancelled - item out of stock",
          createdAt: new Date(Date.now() - 180 * 60 * 1000),
          rawPayload: {
            source: "Toast Third-Party Delivery Integration",
            refundReason: "Customer Request",
          },
          items: [
            {
              name: "Double Smash Burger Combo",
              quantity: 2,
              unitPrice: 18.5,
              modifiers: [{ name: "Gluten-Free Bun", price: 1.5 }],
            },
          ],
        },
      ];

      return {
        orders: mockOrders.slice(0, limit),
        recordsRequiringAttention: 1,
      };
    }

    // Toast Production API Fetch: /orders/v2/ordersBulk
    try {
      const endpoint = `https://toast-api.toasttab.com/orders/v2/ordersBulk?restaurantGuid=${restaurantGuid}&pageSize=${limit}`;
      const response = await fetch(endpoint, {
        headers: {
          "Toast-Restaurant-External-ID": restaurantGuid || "",
          Authorization: `Bearer ${credentials.clientId}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Toast Orders API responded with HTTP ${response.status}`);
      }

      const rawOrders = await response.json();
      const orders: NormalizedOrder[] = (rawOrders || []).map((o: any) => ({
        provider: "TOAST",
        providerOrderId: o.guid || String(o.id),
        providerLocationId: options.locationId || restaurantGuid,
        orderNumber: o.displayNumber || `TST-${o.id?.slice(0, 4)}`,
        orderType: o.diningOption === "Dine In" ? "DINE_IN" : "TAKEAWAY",
        status: o.voided ? "CANCELLED" : "COMPLETED",
        totalAmount: Number(o.total || 0),
        taxAmount: Number(o.tax || 0),
        tipAmount: Number(o.tip || 0),
        discountAmount: Number(o.discount || 0),
        refundAmount: Number(o.refundAmount || 0),
        paymentMethod: o.payments?.[0]?.type || "CREDIT_CARD",
        customerName: o.customer?.name || undefined,
        customerPhone: o.customer?.phone || undefined,
        createdAt: new Date(o.openedDate || o.createdDate || Date.now()),
        rawPayload: o,
        items: (o.checks?.[0]?.items || []).map((i: any) => ({
          name: i.name || "Item",
          quantity: i.quantity || 1,
          unitPrice: Number(i.price || 0),
          modifiers: (i.selections || []).map((s: any) => ({
            name: s.name,
            price: Number(s.price || 0),
          })),
        })),
      }));

      return { orders };
    } catch (err: any) {
      throw new Error(`Failed to fetch orders from Toast: ${err.message}`);
    }
  }
}
