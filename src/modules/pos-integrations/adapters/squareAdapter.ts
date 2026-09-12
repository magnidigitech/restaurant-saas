import {
  PosProviderAdapter,
  ProviderCredentials,
  ProviderValidationResult,
  ProviderFetchResult,
  NormalizedOrder,
} from "../types";

export class SquareAdapter implements PosProviderAdapter {
  provider = "SQUARE" as const;
  displayName = "Square POS";

  async validateCredentials(credentials: ProviderCredentials): Promise<ProviderValidationResult> {
    const { accessToken, applicationId, environment } = credentials;

    if (!accessToken) {
      return {
        valid: false,
        error: "Square Access Token is required. Obtain this from Square Developer Portal.",
      };
    }

    if (environment === "SANDBOX") {
      if (!accessToken.startsWith("EAAA") && !accessToken.includes("sandbox")) {
        return {
          valid: false,
          error: "Square Sandbox Access Tokens typically start with 'EAAA' or contain sandbox markers. Please check your developer credentials.",
        };
      }

      return {
        valid: true,
        locations: [
          {
            id: "sq_loc_main_downtown",
            name: "Downtown Coffee & Bistro (Square)",
            address: "1455 Market St, San Francisco, CA",
          },
          {
            id: "sq_loc_kiosk_terminal",
            name: "Express Kiosk - SFO Terminal 2",
            address: "San Francisco International Airport",
          },
        ],
        providerMetadata: {
          squareApiVersion: "2024-08-21",
          environment: "SANDBOX",
          applicationId: applicationId || "sq0idp-mock-app-sandbox",
        },
      };
    }

    // Square Production API validation: GET /v2/locations
    try {
      const response = await fetch("https://connect.squareup.com/v2/locations", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-08-21",
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        return {
          valid: false,
          error: `Square API error (${response.status}): ${errJson.errors?.[0]?.detail || "Invalid access token or expired permissions."}`,
        };
      }

      const data = await response.json();
      const locations = (data.locations || []).map((loc: any) => ({
        id: loc.id,
        name: loc.name || "Main Location",
        address: loc.address ? `${loc.address.address_line_1 || ""}, ${loc.address.locality || ""}` : undefined,
      }));

      return {
        valid: true,
        locations,
        providerMetadata: {
          squareApiVersion: "2024-08-21",
          environment: "PRODUCTION",
        },
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Failed to contact Square Connect API: ${err.message}`,
      };
    }
  }

  async fetchOrders(
    credentials: ProviderCredentials,
    options: { locationId?: string; since?: Date; limit?: number }
  ): Promise<ProviderFetchResult> {
    const { environment, accessToken } = credentials;
    const limit = options.limit || 25;

    if (environment === "SANDBOX") {
      const mockOrders: NormalizedOrder[] = [
        {
          provider: "SQUARE",
          providerOrderId: `sq_ord_09bf1a_${Date.now() - 300000}`,
          providerLocationId: options.locationId || "sq_loc_main_downtown",
          orderNumber: "SQ-8910",
          orderType: "TAKEAWAY",
          status: "COMPLETED",
          totalAmount: 22.85,
          taxAmount: 1.85,
          tipAmount: 3.0,
          discountAmount: 2.0,
          refundAmount: 0,
          paymentMethod: "SQUARE_READER",
          customerName: "Chloe Davenport",
          customerPhone: "+1 (415) 555-0819",
          notes: "Square Stand Terminal Counter",
          createdAt: new Date(Date.now() - 15 * 60 * 1000),
          rawPayload: {
            source: "Square Register",
            state: "COMPLETED",
            tenders: [{ type: "CARD", card_details: { card: { brand: "VISA", last_4: "4242" } } }],
          },
          items: [
            {
              name: "Oat Milk Flat White 12oz",
              quantity: 2,
              unitPrice: 5.75,
              modifiers: [
                { name: "Milk Choice", price: 0.75, option: "Oat Milk" },
                { name: "Extra Shot", price: 1.0 },
              ],
            },
            {
              name: "Almond Croissant",
              quantity: 1,
              unitPrice: 6.5,
              modifiers: [{ name: "Warmed Up", price: 0 }],
            },
          ],
        },
        {
          provider: "SQUARE",
          providerOrderId: `sq_ord_84cd02_${Date.now() - 1800000}`,
          providerLocationId: options.locationId || "sq_loc_main_downtown",
          orderNumber: "SQ-8909",
          orderType: "DINE_IN",
          status: "COMPLETED",
          totalAmount: 48.2,
          taxAmount: 4.1,
          tipAmount: 7.5,
          discountAmount: 0,
          refundAmount: 0,
          paymentMethod: "CONTACTLESS",
          customerName: "Liam O'Connor",
          notes: "Table 8 - QR Code Order & Pay",
          createdAt: new Date(Date.now() - 55 * 60 * 1000),
          rawPayload: {
            source: "Square Order & Pay",
            state: "COMPLETED",
          },
          items: [
            {
              name: "Avocado Toast with Poached Egg",
              quantity: 2,
              unitPrice: 16.5,
              modifiers: [{ name: "Add Smoked Salmon", price: 5.0 }],
            },
            {
              name: "Cold Pressed Orange Juice",
              quantity: 2,
              unitPrice: 5.1,
            },
          ],
        },
      ];

      return {
        orders: mockOrders.slice(0, limit),
        recordsRequiringAttention: 0,
      };
    }

    // Square Production API: POST /v2/orders/search
    try {
      const body: any = {
        location_ids: options.locationId ? [options.locationId] : [],
        limit,
        query: {
          sort: {
            sort_field: "CREATED_AT",
            sort_order: "DESC",
          },
        },
      };

      if (options.since) {
        body.query.filter = {
          date_time_filter: {
            created_at: {
              start_at: options.since.toISOString(),
            },
          },
        };
      }

      const response = await fetch("https://connect.squareup.com/v2/orders/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-08-21",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Square API responded with ${response.status}`);
      }

      const data = await response.json();
      const orders: NormalizedOrder[] = (data.orders || []).map((o: any) => {
        const totalCents = Number(o.total_money?.amount || 0);
        const taxCents = Number(o.total_tax_money?.amount || 0);
        const tipCents = Number(o.total_tip_money?.amount || 0);
        const discountCents = Number(o.total_discount_money?.amount || 0);

        return {
          provider: "SQUARE",
          providerOrderId: o.id,
          providerLocationId: o.location_id,
          orderNumber: `SQ-${o.id.slice(-4).toUpperCase()}`,
          orderType: o.fulfillments?.[0]?.type === "PICKUP" ? "TAKEAWAY" : "DINE_IN",
          status: o.state === "COMPLETED" ? "COMPLETED" : o.state === "CANCELED" ? "CANCELLED" : "PENDING",
          totalAmount: totalCents / 100,
          taxAmount: taxCents / 100,
          tipAmount: tipCents / 100,
          discountAmount: discountCents / 100,
          refundAmount: Number(o.refunds?.reduce((acc: number, r: any) => acc + Number(r.amount_money?.amount || 0), 0) || 0) / 100,
          paymentMethod: o.tenders?.[0]?.type || "SQUARE_PAYMENT",
          createdAt: new Date(o.created_at || Date.now()),
          rawPayload: o,
          items: (o.line_items || []).map((li: any) => ({
            name: li.name || "Item",
            quantity: Number(li.quantity || 1),
            unitPrice: Number(li.base_price_money?.amount || 0) / 100,
            modifiers: (li.modifiers || []).map((m: any) => ({
              name: m.name,
              price: Number(m.base_price_money?.amount || 0) / 100,
            })),
          })),
        };
      });

      return { orders };
    } catch (err: any) {
      throw new Error(`Failed to fetch Square orders: ${err.message}`);
    }
  }
}
