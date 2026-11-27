import crypto from "crypto";
import {
  PosProviderAdapter,
  ProviderCredentials,
  ProviderValidationResult,
  ProviderFetchOptions,
  ProviderFetchResult,
  NormalizedOrder,
  NormalizedPaymentTender,
  NormalizedRefund,
} from "../types";
import { sanitizeProviderError } from "../crypto";

function roundCents(val: number): number {
  return Math.round(val * 100) / 100;
}

function classifySquareTenderType(rawType?: string): NormalizedPaymentTender["tenderType"] {
  const t = String(rawType || "").toUpperCase();
  if (t === "CASH") return "CASH";
  if (t === "CARD" || t === "SQUARE_GIFT_CARD") return t === "SQUARE_GIFT_CARD" ? "GIFT_CARD" : "CARD";
  if (t === "WALLET" || t === "ONLINE") return "ONLINE";
  return "OTHER";
}

export class SquareAdapter implements PosProviderAdapter {
  provider = "SQUARE" as const;
  displayName = "Square POS";

  async validateCredentials(credentials: ProviderCredentials): Promise<ProviderValidationResult> {
    const { accessToken, environment } = credentials;
    const env = environment === "SANDBOX" ? "SANDBOX" : "PRODUCTION";

    if (!accessToken) {
      return {
        valid: false,
        error: "Square Access Token is required. Obtain this from Square Developer Portal.",
      };
    }

    if (env === "SANDBOX") {
      if (!accessToken.startsWith("EAAA") && !accessToken.includes("sandbox")) {
        return {
          valid: false,
          error: "Square Sandbox Access Tokens typically start with 'EAAA' or contain sandbox markers.",
        };
      }

      return {
        valid: true,
        locations: [
          { id: "sq_loc_main_downtown", name: "Downtown Coffee & Bistro (Square)" },
          { id: "sq_loc_kiosk_terminal", name: "Express Kiosk - Terminal 2" },
        ],
        providerMetadata: {
          squareApiVersion: "2024-08-21",
          environment: "SANDBOX",
        },
      };
    }

    try {
      const response = await fetch("https://connect.squareup.com/v2/locations", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-08-21",
        },
      });

      if (!response.ok) {
        return {
          valid: false,
          error: `Square API returned HTTP ${response.status}. Please check your access token permissions.`,
        };
      }

      const data = await response.json();
      const locations = (data.locations || []).map((loc: any) => ({
        id: loc.id,
        name: loc.name || "Main Location",
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
        error: sanitizeProviderError(err),
      };
    }
  }

  async fetchOrders(
    credentials: ProviderCredentials,
    options: ProviderFetchOptions
  ): Promise<ProviderFetchResult> {
    const { environment, accessToken } = credentials;
    const env = environment === "SANDBOX" ? "SANDBOX" : "PRODUCTION";
    const limit = Math.min(options.limit || 100, 100);

    if (env === "SANDBOX") {
      const mockOrders: NormalizedOrder[] = [
        {
          provider: "SQUARE",
          providerOrderId: "sq_ord_09bf1a",
          providerLocationId: options.locationId || "sq_loc_main_downtown",
          orderNumber: "SQ-8910",
          orderType: "TAKEAWAY",
          status: "COMPLETED",
          currency: "USD",
          environment: "SANDBOX",
          totalAmount: 22.85,
          taxAmount: 1.85,
          tipAmount: 3.0,
          discountAmount: 2.0,
          serviceChargeAmount: 0,
          voidedAmount: 0,
          refundAmount: 0,
          paymentStatus: "PAID",
          paymentMethod: "CARD",
          payments: [
            {
              tenderType: "CARD",
              label: "VISA *4242",
              amount: 22.85,
              tipAmount: 3.0,
              cardBrand: "VISA",
              last4: "4242",
            },
          ],
          refunds: [],
          customerName: "Chloe Davenport",
          customerPhone: "+1 (415) 555-0819",
          notes: "Square Stand Terminal Counter",
          createdAt: new Date("2026-11-18T18:15:00.000Z"),
          providerUpdatedAt: new Date("2026-11-18T18:16:00.000Z"),
          providerVersion: "2",
          isPartialSnapshot: false,
          rawPayload: { source: "Square Register", state: "COMPLETED" },
          items: [
            {
              posMenuItemId: "sq_cat_flatwhite",
              providerItemId: "sq_li_1",
              name: "Oat Milk Flat White 12oz",
              quantity: 2,
              unitPrice: 5.75,
              totalPrice: 11.5,
              taxAmount: 1.15,
              discountAmount: 0,
              netSales: 11.5,
              modifiers: [
                { name: "Milk Choice", price: 0.75, option: "Oat Milk" },
                { name: "Extra Shot", price: 1.0 },
              ],
            },
            {
              posMenuItemId: "sq_cat_croissant",
              providerItemId: "sq_li_2",
              name: "Almond Croissant",
              quantity: 1,
              unitPrice: 6.5,
              totalPrice: 6.5,
              taxAmount: 0.7,
              discountAmount: 2.0,
              netSales: 4.5,
              modifiers: [{ name: "Warmed Up", price: 0 }],
            },
          ],
        },
        {
          provider: "SQUARE",
          providerOrderId: "sq_ord_84cd02",
          providerLocationId: options.locationId || "sq_loc_main_downtown",
          orderNumber: "SQ-8909",
          orderType: "DINE_IN",
          status: "COMPLETED",
          currency: "USD",
          environment: "SANDBOX",
          totalAmount: 48.2,
          taxAmount: 4.1,
          tipAmount: 7.5,
          discountAmount: 0,
          serviceChargeAmount: 0,
          voidedAmount: 0,
          refundAmount: 0,
          paymentStatus: "PAID",
          paymentMethod: "SPLIT",
          payments: [
            { tenderType: "CARD", label: "MASTERCARD", amount: 30.2, tipAmount: 5.0 },
            { tenderType: "CASH", label: "Cash", amount: 18.0, tipAmount: 2.5 },
          ],
          refunds: [],
          customerName: "Liam O'Connor",
          notes: "Table 8 - QR Code Order & Pay",
          createdAt: new Date("2026-11-18T17:45:00.000Z"),
          providerUpdatedAt: new Date("2026-11-18T17:50:00.000Z"),
          providerVersion: "1",
          isPartialSnapshot: false,
          rawPayload: { source: "Square Order & Pay", state: "COMPLETED" },
          items: [
            {
              posMenuItemId: "sq_cat_avotoast",
              providerItemId: "sq_li_3",
              name: "Avocado Toast with Poached Egg",
              quantity: 2,
              unitPrice: 16.5,
              totalPrice: 33.0,
              taxAmount: 3.1,
              discountAmount: 0,
              netSales: 33.0,
              modifiers: [{ name: "Add Smoked Salmon", price: 5.0 }],
            },
            {
              posMenuItemId: "sq_cat_oj",
              providerItemId: "sq_li_4",
              name: "Cold Pressed Orange Juice",
              quantity: 2,
              unitPrice: 5.1,
              totalPrice: 10.2,
              taxAmount: 1.0,
              discountAmount: 0,
              netSales: 10.2,
            },
          ],
        },
      ];

      return {
        orders: mockOrders.slice(0, limit),
        hasMore: false,
        isPartialSnapshot: false,
        recordsRequiringAttention: 0,
      };
    }

    try {
      const body: any = {
        location_ids: options.locationId ? [options.locationId] : [],
        limit,
        query: {
          sort: {
            sort_field: "UPDATED_AT",
            sort_order: "ASC",
          },
        },
      };

      if (options.cursor) {
        body.cursor = options.cursor;
      }

      if (options.since || options.until) {
        body.query.filter = {
          date_time_filter: {
            updated_at: {
              ...(options.since ? { start_at: options.since.toISOString() } : {}),
              ...(options.until ? { end_at: options.until.toISOString() } : {}),
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
        throw new Error(`Square API responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      const orders: NormalizedOrder[] = (data.orders || []).map((o: any) =>
        this.normalizeSquareOrder(o, env)
      );

      return {
        orders,
        nextCursor: data.cursor || undefined,
        hasMore: Boolean(data.cursor),
        isPartialSnapshot: false,
      };
    } catch (err: any) {
      throw new Error(sanitizeProviderError(err));
    }
  }

  private normalizeSquareOrder(
    o: any,
    environment: "SANDBOX" | "PRODUCTION"
  ): NormalizedOrder {
    const currency = o.total_money?.currency || "USD";
    const totalCents = Number(o.total_money?.amount || 0);
    const taxCents = Number(o.total_tax_money?.amount || 0);
    const tipCents = Number(o.total_tip_money?.amount || 0);
    const discountCents = Number(o.total_discount_money?.amount || 0);
    const serviceChargeCents = Number(o.total_service_charge_money?.amount || 0);

    const refunds: NormalizedRefund[] = (o.refunds || []).map((r: any, idx: number) => ({
      externalRefundId: r.id || `sq_ref_${idx + 1}`,
      amount: roundCents(Number(r.amount_money?.amount || 0) / 100),
      reason: r.reason || undefined,
      refundedAt: r.created_at || undefined,
    }));
    const refundCents = refunds.reduce(
      (acc, r) => acc + Math.round(r.amount * 100),
      0
    );

    const payments: NormalizedPaymentTender[] = (o.tenders || []).map((t: any) => ({
      tenderType: classifySquareTenderType(t.type),
      label: t.card_details?.card?.card_brand
        ? `${t.card_details.card.card_brand} *${t.card_details.card.last_4 || ""}`
        : t.type || "SQUARE_PAYMENT",
      amount: roundCents(Number(t.amount_money?.amount || 0) / 100),
      tipAmount: roundCents(Number(t.tip_money?.amount || 0) / 100),
      cardBrand: t.card_details?.card?.card_brand || undefined,
      last4: t.card_details?.card?.last_4 || undefined,
      externalPaymentId: t.id || undefined,
    }));

    const uniqueTenders = Array.from(new Set(payments.map((p) => p.tenderType)));
    const paymentMethod =
      uniqueTenders.length > 1
        ? "SPLIT"
        : uniqueTenders[0] || o.tenders?.[0]?.type || "SQUARE_PAYMENT";

    const paymentStatus: NormalizedOrder["paymentStatus"] =
      refundCents >= totalCents && refundCents > 0
        ? "REFUNDED"
        : refundCents > 0
          ? "PARTIAL"
          : o.state === "OPEN"
            ? "PENDING"
            : "PAID";

    return {
      provider: "SQUARE",
      providerOrderId: o.id,
      providerLocationId: o.location_id,
      orderNumber: `SQ-${String(o.id).slice(-4).toUpperCase()}`,
      orderType: o.fulfillments?.[0]?.type === "PICKUP" ? "TAKEAWAY" : "DINE_IN",
      status:
        o.state === "COMPLETED"
          ? "COMPLETED"
          : o.state === "CANCELED"
            ? "CANCELLED"
            : "PENDING",
      currency,
      environment,
      totalAmount: roundCents(Math.max(0, totalCents - refundCents) / 100),
      taxAmount: roundCents(taxCents / 100),
      tipAmount: roundCents(tipCents / 100),
      discountAmount: roundCents(discountCents / 100),
      serviceChargeAmount: roundCents(serviceChargeCents / 100),
      voidedAmount: 0,
      refundAmount: roundCents(refundCents / 100),
      paymentStatus,
      paymentMethod,
      payments,
      refunds,
      createdAt: new Date(o.created_at || Date.now()),
      providerUpdatedAt: o.updated_at ? new Date(o.updated_at) : undefined,
      providerVersion: o.version !== undefined ? String(o.version) : undefined,
      isPartialSnapshot: false,
      rawPayload: o,
      items: (o.line_items || []).map((li: any, idx: number) => {
        const qty = Number(li.quantity || 1);
        const uPrice = roundCents(Number(li.base_price_money?.amount || 0) / 100);
        const gross = roundCents(Number(li.gross_sales_money?.amount || 0) / 100);
        const disc = roundCents(Number(li.total_discount_money?.amount || 0) / 100);
        const tax = roundCents(Number(li.total_tax_money?.amount || 0) / 100);
        const net = gross > 0 ? roundCents(gross - disc) : roundCents(qty * uPrice - disc);

        return {
          posMenuItemId: li.catalog_object_id || li.item_id || `sq_menu_${idx + 1}`,
          providerItemId: li.uid || `sq_li_${idx + 1}`,
          externalVariantId: li.variation_name || li.catalog_object_id || undefined,
          name: li.name || "Item",
          quantity: qty,
          unitPrice: uPrice,
          totalPrice: gross > 0 ? gross : roundCents(qty * uPrice),
          taxAmount: tax,
          discountAmount: disc,
          netSales: Math.max(0, net),
          isVoided: false,
          modifiers: (li.modifiers || []).map((m: any) => ({
            name: m.name,
            price: roundCents(Number(m.base_price_money?.amount || 0) / 100),
          })),
        };
      }),
    };
  }

  verifyWebhookSignature(params: {
    rawBody: string;
    headers: Record<string, string | undefined>;
    secret: string;
    notificationUrl?: string;
  }): boolean {
    const sig = params.headers["x-square-hmacsha256-signature"];
    if (!sig || !params.secret || !params.notificationUrl) return false;
    const payload = `${params.notificationUrl}${params.rawBody}`;
    const computed = crypto
      .createHmac("sha256", params.secret)
      .update(payload, "utf8")
      .digest("base64");
    const a = Buffer.from(sig);
    const b = Buffer.from(computed);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
