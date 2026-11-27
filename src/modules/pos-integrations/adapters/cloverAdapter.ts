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

function classifyCloverTender(label?: string): NormalizedPaymentTender["tenderType"] {
  const t = String(label || "").toUpperCase();
  if (t.includes("CASH")) return "CASH";
  if (t.includes("CREDIT") || t.includes("DEBIT") || t.includes("CARD") || t.includes("EMV")) return "CARD";
  if (t.includes("GIFT")) return "GIFT_CARD";
  if (t.includes("ONLINE")) return "ONLINE";
  return "OTHER";
}

export class CloverAdapter implements PosProviderAdapter {
  provider = "CLOVER" as const;
  displayName = "Clover POS";

  async validateCredentials(credentials: ProviderCredentials): Promise<ProviderValidationResult> {
    const { apiToken, merchantId, environment, region } = credentials;
    const env = environment === "SANDBOX" ? "SANDBOX" : "PRODUCTION";

    if (!apiToken || !merchantId) {
      return {
        valid: false,
        error: "Clover API Token and Merchant ID (mId) are required.",
      };
    }

    if (env === "SANDBOX") {
      if (merchantId.length < 6) {
        return {
          valid: false,
          error: "Clover Merchant ID must be at least 6 alphanumeric characters.",
        };
      }

      return {
        valid: true,
        locations: [
          { id: merchantId, name: "Clover Prime Steakhouse & Bar (Sandbox)" },
          { id: `${merchantId}_station_02`, name: "Clover Station Solo - Front Counter" },
        ],
        providerMetadata: {
          cloverApiVersion: "v3",
          environment: "SANDBOX",
          region: region || "US",
        },
      };
    }

    const baseUrl = region === "EU" ? "https://api.eu.clover.com" : "https://api.clover.com";
    try {
      const response = await fetch(`${baseUrl}/v3/merchants/${merchantId}`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return {
          valid: false,
          error: `Clover API returned HTTP ${response.status}. Please check your Merchant ID and API token.`,
        };
      }

      const data = await response.json();
      return {
        valid: true,
        locations: [
          {
            id: merchantId,
            name: data.name || "Clover Primary Merchant Location",
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
        error: sanitizeProviderError(err),
      };
    }
  }

  async fetchOrders(
    credentials: ProviderCredentials,
    options: ProviderFetchOptions
  ): Promise<ProviderFetchResult> {
    const { environment, apiToken, merchantId, region } = credentials;
    const env = environment === "SANDBOX" ? "SANDBOX" : "PRODUCTION";
    const limit = Math.min(options.limit || 100, 1000);

    if (env === "SANDBOX") {
      const mockOrders: NormalizedOrder[] = [
        {
          provider: "CLOVER",
          providerOrderId: "clv_ord_3X9K0L",
          providerLocationId: options.locationId || merchantId || "clv_m123",
          orderNumber: "CLV-7041",
          orderType: "DINE_IN",
          status: "COMPLETED",
          currency: "USD",
          environment: "SANDBOX",
          totalAmount: 94.5,
          taxAmount: 7.56,
          tipAmount: 15.0,
          discountAmount: 0,
          serviceChargeAmount: 0,
          voidedAmount: 0,
          refundAmount: 0,
          paymentStatus: "PAID",
          paymentMethod: "CARD",
          payments: [
            { tenderType: "CARD", label: "Credit Card", amount: 94.5, tipAmount: 15.0 },
          ],
          refunds: [],
          customerName: "Elena Rostova",
          notes: "Server: Jessica R. (Clover Station Duo)",
          createdAt: new Date("2026-11-18T18:20:00.000Z"),
          providerUpdatedAt: new Date("2026-11-18T18:25:00.000Z"),
          providerVersion: "1",
          isPartialSnapshot: false,
          rawPayload: { device: "Clover Flex 3", orderTitle: "Table 4 Dinner" },
          items: [
            {
              posMenuItemId: "clv_item_seabass",
              providerItemId: "clv_li_1",
              name: "Grilled Chilean Sea Bass",
              quantity: 2,
              unitPrice: 38.0,
              totalPrice: 76.0,
              taxAmount: 6.5,
              discountAmount: 0,
              netSales: 76.0,
              modifiers: [{ name: "Lemon Herb Beurre Blanc", price: 0 }],
            },
            {
              posMenuItemId: "clv_item_fingerlings",
              providerItemId: "clv_li_2",
              name: "Rosemary Roasted Fingerlings",
              quantity: 1,
              unitPrice: 11.0,
              totalPrice: 11.0,
              taxAmount: 1.06,
              discountAmount: 0,
              netSales: 11.0,
            },
          ],
        },
        {
          provider: "CLOVER",
          providerOrderId: "clv_ord_5Y2M9P",
          providerLocationId: options.locationId || merchantId || "clv_m123",
          orderNumber: "CLV-7040",
          orderType: "TAKEAWAY",
          status: "COMPLETED",
          currency: "USD",
          environment: "SANDBOX",
          totalAmount: 28.0,
          taxAmount: 2.24,
          tipAmount: 3.5,
          discountAmount: 0,
          serviceChargeAmount: 0,
          voidedAmount: 0,
          refundAmount: 0,
          paymentStatus: "PAID",
          paymentMethod: "CASH",
          payments: [
            { tenderType: "CASH", label: "Cash", amount: 28.0, tipAmount: 3.5 },
          ],
          refunds: [],
          customerName: "Robert Taylor",
          customerPhone: "+1 (408) 555-0922",
          notes: "Clover Online Ordering Takeout",
          createdAt: new Date("2026-11-18T17:15:00.000Z"),
          providerUpdatedAt: new Date("2026-11-18T17:16:00.000Z"),
          providerVersion: "1",
          isPartialSnapshot: false,
          rawPayload: { device: "Clover Mini 2", orderTitle: "Curbside Pickup" },
          items: [
            {
              posMenuItemId: "clv_item_calamari",
              providerItemId: "clv_li_3",
              name: "Crispy Calamari Fritti",
              quantity: 1,
              unitPrice: 16.0,
              totalPrice: 16.0,
              taxAmount: 1.4,
              discountAmount: 0,
              netSales: 16.0,
              modifiers: [{ name: "Spicy Marinara Dip", price: 0 }],
            },
            {
              posMenuItemId: "clv_item_pellegrino",
              providerItemId: "clv_li_4",
              name: "Sparkling San Pellegrino 750ml",
              quantity: 1,
              unitPrice: 8.5,
              totalPrice: 8.5,
              taxAmount: 0.84,
              discountAmount: 0,
              netSales: 8.5,
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

    const baseUrl = region === "EU" ? "https://api.eu.clover.com" : "https://api.clover.com";
    const offset =
      options.cursor && options.cursor.startsWith("offset:")
        ? Math.max(0, parseInt(options.cursor.slice(7), 10) || 0)
        : 0;

    try {
      const url = new URL(`${baseUrl}/v3/merchants/${merchantId}/orders`);
      url.searchParams.set("expand", "lineItems,discounts,payments,refunds,serviceCharge");
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));

      if (options.since) {
        // Clover enforces a strict 90-day window for modifiedTime filters
        const ninetyDaysAgoMs = Date.now() - 89 * 24 * 60 * 60 * 1000;
        const sinceMs = Math.max(options.since.getTime(), ninetyDaysAgoMs);
        url.searchParams.set("filter", `modifiedTime>=${sinceMs}`);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Clover Orders API returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const elements = data.elements || [];
      const hasMore = elements.length >= limit;
      const nextCursor = hasMore ? `offset:${offset + elements.length}` : undefined;

      const orders: NormalizedOrder[] = elements.map((o: any) =>
        this.normalizeCloverOrder(o, options.locationId || merchantId || "", env)
      );

      return {
        orders,
        nextCursor,
        hasMore,
        isPartialSnapshot: false,
      };
    } catch (err: any) {
      throw new Error(sanitizeProviderError(err));
    }
  }

  private normalizeCloverOrder(
    o: any,
    locationId: string,
    environment: "SANDBOX" | "PRODUCTION"
  ): NormalizedOrder {
    const totalCents = Number(o.total || 0);
    const taxCents = Number(o.taxRemoved ? 0 : o.totalTax || 0);
    const serviceChargeCents = Number(o.serviceCharge?.amount || 0);

    const discountCents = (o.discounts?.elements || []).reduce(
      (acc: number, d: any) => acc + Math.abs(Number(d.amount || 0)),
      0
    );

    const payments: NormalizedPaymentTender[] = (o.payments?.elements || []).map((p: any) => ({
      tenderType: classifyCloverTender(p.tender?.label),
      label: p.tender?.label || "CLOVER_PAYMENT",
      amount: roundCents(Number(p.amount || 0) / 100),
      tipAmount: roundCents(Number(p.tipAmount || 0) / 100),
      cardBrand: p.cardTransaction?.cardType || undefined,
      last4: p.cardTransaction?.last4 || undefined,
      externalPaymentId: p.id || undefined,
    }));

    const tipCents = payments.reduce((acc, p) => acc + Math.round(p.tipAmount * 100), 0);

    const refunds: NormalizedRefund[] = (o.refunds?.elements || []).map((r: any, idx: number) => ({
      externalRefundId: r.id || `clv_ref_${idx + 1}`,
      amount: roundCents(Number(r.amount || 0) / 100),
      reason: r.reason || undefined,
      refundedAt: r.createdTime ? new Date(r.createdTime).toISOString() : undefined,
    }));
    const refundCents = refunds.reduce((acc, r) => acc + Math.round(r.amount * 100), 0);

    const uniqueTenders = Array.from(new Set(payments.map((p) => p.tenderType)));
    const paymentMethod =
      uniqueTenders.length > 1
        ? "SPLIT"
        : uniqueTenders[0] || o.payments?.elements?.[0]?.tender?.label || "CLOVER_PAYMENT";

    const paymentStatus: NormalizedOrder["paymentStatus"] =
      refundCents >= totalCents && refundCents > 0
        ? "REFUNDED"
        : refundCents > 0
          ? "PARTIAL"
          : o.state === "OPEN"
            ? "PENDING"
            : "PAID";

    return {
      provider: "CLOVER",
      providerOrderId: o.id,
      providerLocationId: locationId,
      orderNumber: `CLV-${String(o.id).slice(-4).toUpperCase()}`,
      orderType: o.title?.toLowerCase().includes("take") ? "TAKEAWAY" : "DINE_IN",
      status: o.state === "OPEN" ? "PENDING" : "COMPLETED",
      currency: o.currency || "USD",
      environment,
      totalAmount: roundCents(Math.max(0, totalCents + tipCents - refundCents) / 100),
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
      createdAt: new Date(o.clientCreatedTime || o.createdTime || Date.now()),
      providerUpdatedAt: o.modifiedTime ? new Date(o.modifiedTime) : undefined,
      providerVersion: o.modifiedTime ? String(o.modifiedTime) : undefined,
      isPartialSnapshot: false,
      rawPayload: o,
      items: (o.lineItems?.elements || []).map((li: any, idx: number) => {
        const uPrice = roundCents(Number(li.price || 0) / 100);
        const qty = Number(li.unitQty ? li.unitQty / 1000 : li.quantity || 1);
        const isRefunded = Boolean(li.refunded || li.isRefund || false);
        return {
          posMenuItemId: li.item?.id || `clv_menu_${idx + 1}`,
          providerItemId: li.id || `clv_li_${idx + 1}`,
          name: li.name || "Item",
          quantity: qty,
          unitPrice: uPrice,
          totalPrice: roundCents(qty * uPrice),
          taxAmount: 0,
          discountAmount: 0,
          netSales: isRefunded ? 0 : roundCents(qty * uPrice),
          isVoided: isRefunded,
        };
      }),
    };
  }

  verifyWebhookSignature(params: {
    rawBody: string;
    headers: Record<string, string | undefined>;
    secret: string;
  }): boolean {
    const sig = params.headers["x-clover-hmac-sha256"] || params.headers["x-clover-signature"];
    if (!sig || !params.secret) return false;
    const computedHex = crypto
      .createHmac("sha256", params.secret)
      .update(params.rawBody, "utf8")
      .digest("hex");
    const computedB64 = crypto
      .createHmac("sha256", params.secret)
      .update(params.rawBody, "utf8")
      .digest("base64");
    const sigBuf = Buffer.from(sig);
    return (
      (sigBuf.length === Buffer.byteLength(computedHex) &&
        crypto.timingSafeEqual(sigBuf, Buffer.from(computedHex))) ||
      (sigBuf.length === Buffer.byteLength(computedB64) &&
        crypto.timingSafeEqual(sigBuf, Buffer.from(computedB64)))
    );
  }
}
