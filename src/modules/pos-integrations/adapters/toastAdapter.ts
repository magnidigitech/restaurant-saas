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

  /**
   * Helper method to authenticate against Toast API with machine client or partner credentials
   * Tries ws-api.toasttab.com with userAccessType: TOAST_MACHINE_CLIENT as required by Toast API
   */
  private async authenticateToast(credentials: ProviderCredentials): Promise<string> {
    const { clientId, clientSecret, environment } = credentials;
    if (!clientId || !clientSecret) {
      throw new Error("Client ID and Client Secret are required for Toast authentication.");
    }

    const host = environment === "SANDBOX"
      ? "https://ws-sandbox-api.toasttab.com"
      : "https://ws-api.toasttab.com";

    const userAccessTypes = ["TOAST_MACHINE_CLIENT", "INTEGRATION"];
    let lastError = "";

    for (const userAccessType of userAccessTypes) {
      try {
        const res = await fetch(`${host}/authentication/v1/authentication/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAccessType,
            clientId,
            clientSecret,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          const token =
            data.token?.accessToken ||
            data.token?.token ||
            (typeof data.token === "string" ? data.token : null) ||
            data.accessToken;

          if (token) {
            return token;
          }
        } else {
          const errDetail =
            data.message ||
            data.error_description ||
            data.error ||
            (res.status === 401 ? "Unauthorized. Please check your Toast Client ID and Client Secret." : `HTTP ${res.status}`);
          
          // Store meaningful HTTP status error without overwriting with generic network errors
          lastError = `Toast API Auth (${res.status}): ${errDetail}`;
          if (res.status === 401 || res.status === 403) {
            // Early break on authentication rejection
            break;
          }
        }
      } catch (e: any) {
        if (!lastError) {
          lastError = e.message || "Network connection error reaching Toast API.";
        }
      }
    }

    throw new Error(
      lastError || "Toast API Authentication failed. Please verify your Client ID and Client Secret."
    );
  }

  async validateCredentials(credentials: ProviderCredentials): Promise<ProviderValidationResult> {
    const { clientId, clientSecret, restaurantGuid, environment } = credentials;

    if (!clientId || !clientSecret) {
      return {
        valid: false,
        error: "Missing required Toast API credentials: Client ID and Client Secret are required.",
      };
    }

    if (environment === "PRODUCTION" && (!restaurantGuid || !restaurantGuid.trim())) {
      return {
        valid: false,
        error: "Toast Restaurant External GUID is required for Production integration. Please provide your Toast Restaurant External GUID.",
      };
    }

    const effectiveGuid = restaurantGuid?.trim() || "toast-restaurant-main";

    if (environment === "SANDBOX") {
      return {
        valid: true,
        locations: [
          {
            id: effectiveGuid,
            name: "Toast Main Dining & Bar (Sandbox)",
            address: "401 Park Dr, Boston, MA",
          },
          {
            id: `${effectiveGuid}-patio`,
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

    // Production Toast API authentication test
    try {
      const accessToken = await this.authenticateToast(credentials);

      return {
        valid: true,
        locations: [
          {
            id: effectiveGuid,
            name: "Toast Production Restaurant",
          },
        ],
        providerMetadata: {
          tokenType: "Bearer",
          environment: "PRODUCTION",
          authenticatedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return {
        valid: false,
        error: err.message || "Could not reach or authenticate with Toast API. Please check your Client ID and Client Secret.",
      };
    }
  }

  async fetchOrders(
    credentials: ProviderCredentials,
    options: { locationId?: string; since?: Date; limit?: number }
  ): Promise<ProviderFetchResult> {
    const { environment, restaurantGuid } = credentials;
    const limit = Math.min(options.limit || 30, 30); // Restrict to maximum 30 orders

    if (environment === "SANDBOX") {
      const mockOrders: NormalizedOrder[] = [
        {
          provider: "TOAST",
          providerOrderId: "tst_ord_98a412",
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
          createdAt: new Date("2026-09-15T18:09:08.000Z"),
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
          providerOrderId: "tst_ord_82c901",
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
          createdAt: new Date("2026-09-15T17:25:00.000Z"),
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
          providerOrderId: "tst_ord_77f433",
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
          createdAt: new Date("2026-09-15T15:10:00.000Z"),
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

    if (!restaurantGuid || !restaurantGuid.trim()) {
      throw new Error(
        "Toast Restaurant External GUID is required to fetch orders. Please edit your Toast connection and enter your Restaurant External GUID."
      );
    }

    const cleanGuid = restaurantGuid.trim();

    // Toast Production API Fetch using OAuth 2.0 Access Token
    try {
      const accessToken = await this.authenticateToast(credentials);
      const host = "https://ws-api.toasttab.com";
      const pathSuffixes = ["/orders/v2/ordersBulk", "/orders/v2/orders"];

      let rawOrders: any = null;
      let lastErrMessage = "";

      const reqHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Toast-Restaurant-External-ID": cleanGuid,
        "toast-restaurant-external-id": cleanGuid,
      };

      for (const suffix of pathSuffixes) {
        try {
          const endpoint = `${host}${suffix}?pageSize=${limit}&restaurantGuid=${encodeURIComponent(cleanGuid)}`;

          const response = await fetch(endpoint, {
            headers: reqHeaders,
          });

          if (response.ok) {
            rawOrders = await response.json();
            break;
          } else {
            const errTxt = await response.text().catch(() => "");
            let parsedDetail = "";
            try {
              const parsed = JSON.parse(errTxt);
              parsedDetail = parsed.message || parsed.error_description || parsed.error || "";
            } catch {}
            lastErrMessage = `Toast Orders API (${response.status}): ${parsedDetail || errTxt || response.statusText || "Request rejected"}`;
          }
        } catch (e: any) {
          if (!lastErrMessage) {
            lastErrMessage = `Connection error reaching Toast Orders API: ${e.message || "fetch failed"}`;
          }
        }
      }

      if (!rawOrders) {
        throw new Error(lastErrMessage || "Unable to reach Toast Orders API.");
      }

      const ordersList = Array.isArray(rawOrders) ? rawOrders : rawOrders.orders || rawOrders.data || [];
      const limitedList = ordersList.slice(0, limit);

      const orders: NormalizedOrder[] = limitedList.map((o: any) => ({
        provider: "TOAST",
        providerOrderId: o.guid || String(o.id),
        providerLocationId: options.locationId || cleanGuid,
        orderNumber: o.displayNumber || `TST-${String(o.id || o.guid || "").slice(-4).toUpperCase()}`,
        orderType: o.diningOption === "Dine In" ? "DINE_IN" : "TAKEAWAY",
        status: o.voided ? "CANCELLED" : "COMPLETED",
        totalAmount: Number(o.total || o.amount || 0),
        taxAmount: Number(o.tax || 0),
        tipAmount: Number(o.tip || 0),
        discountAmount: Number(o.discount || 0),
        refundAmount: Number(o.refundAmount || 0),
        paymentMethod: o.payments?.[0]?.type || "CREDIT_CARD",
        customerName: o.customer?.name || (o.customer?.firstName ? `${o.customer.firstName || ""} ${o.customer.lastName || ""}`.trim() : undefined),
        customerPhone: o.customer?.phone || undefined,
        createdAt: new Date(o.openedDate || o.createdDate || Date.now()),
        rawPayload: o,
        items: (o.checks?.[0]?.items || o.items || []).map((i: any) => ({
          name: i.name || "Item",
          quantity: Number(i.quantity || 1),
          unitPrice: Number(i.price || 0),
          modifiers: (i.selections || i.modifiers || []).map((s: any) => ({
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

