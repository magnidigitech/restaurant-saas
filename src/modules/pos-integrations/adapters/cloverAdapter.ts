import {
  PosProviderAdapter,
  ProviderCredentials,
  ProviderValidationResult,
  ProviderFetchResult,
  NormalizedOrder,
} from "../types";

export class CloverAdapter implements PosProviderAdapter {
  provider = "CLOVER" as const;
  displayName = "Clover POS";

  async validateCredentials(credentials: ProviderCredentials): Promise<ProviderValidationResult> {
    const { apiToken, merchantId, environment, region } = credentials;

    if (!apiToken || !merchantId) {
      return {
        valid: false,
        error: "Clover API Token (E-Commerce or REST API token) and Merchant ID (mId) are required.",
      };
    }

    if (environment === "SANDBOX") {
      if (merchantId.length < 6) {
        return {
          valid: false,
          error: "Clover Merchant ID must be at least 6 alphanumeric characters.",
        };
      }

      return {
        valid: true,
        locations: [
          {
            id: merchantId,
            name: "Clover Prime Steakhouse & Bar (Sandbox)",
            address: "123 Main St, Sunnyvale, CA",
          },
          {
            id: `${merchantId}_station_02`,
            name: "Clover Station Solo - Front Counter",
            address: "123 Main St, Sunnyvale, CA",
          },
        ],
        providerMetadata: {
          cloverApiVersion: "v3",
          environment: "SANDBOX",
          region: region || "NA",
        },
      };
    }

    // Clover Production API: GET https://api.clover.com/v1/merchants/{mId}
    const baseUrl = region === "EU" ? "https://api.eu.clover.com" : "https://api.clover.com";
    try {
      const response = await fetch(`${baseUrl}/v1/merchants/${merchantId}`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return {
          valid: false,
          error: `Clover API returned status ${response.status}. Please check your Merchant ID and API token permissions.`,
        };
      }

      const data = await response.json();
      return {
        valid: true,
        locations: [
          {
            id: merchantId,
            name: data.name || "Clover Primary Merchant Location",
            address: data.address?.address1,
          },
        ],
        providerMetadata: {
          cloverApiVersion: "v3",
          environment: "PRODUCTION",
        },
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Failed to connect to Clover API: ${err.message}`,
      };
    }
  }

  async fetchOrders(
    credentials: ProviderCredentials,
    options: { locationId?: string; since?: Date; limit?: number }
  ): Promise<ProviderFetchResult> {
    const { environment, apiToken, merchantId, region } = credentials;
    const limit = options.limit || 25;

    if (environment === "SANDBOX") {
      const mockOrders: NormalizedOrder[] = [
        {
          provider: "CLOVER",
          providerOrderId: `clv_ord_3X9K0L_${Date.now() - 420000}`,
          providerLocationId: options.locationId || merchantId || "clv_m123",
          orderNumber: "CLV-7041",
          orderType: "DINE_IN",
          status: "COMPLETED",
          totalAmount: 94.5,
          taxAmount: 7.56,
          tipAmount: 15.0,
          discountAmount: 0,
          refundAmount: 0,
          paymentMethod: "CLOVER_FLEX",
          customerName: "Elena Rostova",
          notes: "Server: Jessica R. (Clover Station Duo)",
          createdAt: new Date(Date.now() - 20 * 60 * 1000),
          rawPayload: {
            device: "Clover Flex 3",
            orderTitle: "Table 4 Dinner",
          },
          items: [
            {
              name: "Grilled Chilean Sea Bass",
              quantity: 2,
              unitPrice: 38.0,
              modifiers: [{ name: "Lemon Herb Beurre Blanc", price: 0 }],
            },
            {
              name: "Rosemary Roasted Fingerlings",
              quantity: 1,
              unitPrice: 11.0,
            },
          ],
        },
        {
          provider: "CLOVER",
          providerOrderId: `clv_ord_5Y2M9P_${Date.now() - 2100000}`,
          providerLocationId: options.locationId || merchantId || "clv_m123",
          orderNumber: "CLV-7040",
          orderType: "TAKEAWAY",
          status: "COMPLETED",
          totalAmount: 28.0,
          taxAmount: 2.24,
          tipAmount: 3.5,
          discountAmount: 0,
          refundAmount: 0,
          paymentMethod: "CLOVER_MINI",
          customerName: "Robert Taylor",
          customerPhone: "+1 (408) 555-0922",
          notes: "Clover Online Ordering Takeout",
          createdAt: new Date(Date.now() - 85 * 60 * 1000),
          rawPayload: {
            device: "Clover Mini 2",
            orderTitle: "Curbside Pickup",
          },
          items: [
            {
              name: "Crispy Calamari Fritti",
              quantity: 1,
              unitPrice: 16.0,
              modifiers: [{ name: "Spicy Marinara Dip", price: 0 }],
            },
            {
              name: "Sparkling San Pellegrino 750ml",
              quantity: 1,
              unitPrice: 8.5,
            },
          ],
        },
      ];

      return {
        orders: mockOrders.slice(0, limit),
        recordsRequiringAttention: 0,
      };
    }

    // Clover Production API: GET /v1/merchants/{mId}/orders?expand=lineItems,discounts,payments
    const baseUrl = region === "EU" ? "https://api.eu.clover.com" : "https://api.clover.com";
    try {
      const url = new URL(`${baseUrl}/v1/merchants/${merchantId}/orders`);
      url.searchParams.set("expand", "lineItems,discounts,payments,refunds");
      url.searchParams.set("limit", String(limit));
      if (options.since) {
        url.searchParams.set("filter", `clientCreatedTime>=${options.since.getTime()}`);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Clover Orders API error: ${response.status}`);
      }

      const data = await response.json();
      const orders: NormalizedOrder[] = (data.elements || []).map((o: any) => {
        const totalCents = Number(o.total || 0);
        return {
          provider: "CLOVER",
          providerOrderId: o.id,
          providerLocationId: options.locationId || merchantId,
          orderNumber: `CLV-${o.id.slice(-4).toUpperCase()}`,
          orderType: o.title?.toLowerCase().includes("take") ? "TAKEAWAY" : "DINE_IN",
          status: o.state === "OPEN" ? "PENDING" : "COMPLETED",
          totalAmount: totalCents / 100,
          taxAmount: Number(o.taxRemoved ? 0 : o.totalTax || 0) / 100,
          tipAmount: Number(o.payments?.elements?.[0]?.tipAmount || 0) / 100,
          discountAmount: 0,
          refundAmount: Number(o.refunds?.elements?.[0]?.amount || 0) / 100,
          paymentMethod: o.payments?.elements?.[0]?.tender?.label || "CLOVER_PAYMENT",
          createdAt: new Date(o.clientCreatedTime || o.createdTime || Date.now()),
          rawPayload: o,
          items: (o.lineItems?.elements || []).map((li: any) => ({
            name: li.name || "Item",
            quantity: 1,
            unitPrice: Number(li.price || 0) / 100,
          })),
        };
      });

      return { orders };
    } catch (err: any) {
      throw new Error(`Failed to fetch Clover orders: ${err.message}`);
    }
  }
}
