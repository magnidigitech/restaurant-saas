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

function classifyToastPaymentType(rawType?: string): NormalizedPaymentTender["tenderType"] {
  const t = String(rawType || "").toUpperCase();
  if (t.includes("CASH")) return "CASH";
  if (t.includes("CREDIT") || t.includes("DEBIT") || t.includes("CARD") || t.includes("EMV")) return "CARD";
  if (t.includes("GIFT")) return "GIFT_CARD";
  if (t.includes("ONLINE") || t.includes("WEB")) return "ONLINE";
  return "OTHER";
}

export class ToastAdapter implements PosProviderAdapter {
  provider = "TOAST" as const;
  displayName = "Toast POS";

  private async authenticateToast(credentials: ProviderCredentials): Promise<string> {
    const { clientId, clientSecret, environment } = credentials;
    if (!clientId || !clientSecret) {
      throw new Error("Client ID and Client Secret are required for Toast authentication.");
    }

    const host =
      environment === "SANDBOX"
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

          if (token) return token;
        } else {
          const errDetail =
            data.message ||
            data.error_description ||
            data.error ||
            (res.status === 401
              ? "Unauthorized. Please check your Toast Client ID and Client Secret."
              : `HTTP ${res.status}`);

          lastError = `Toast API Auth (${res.status}): ${errDetail}`;
          if (res.status === 401 || res.status === 403) break;
        }
      } catch (e: any) {
        if (!lastError) {
          lastError = sanitizeProviderError(e);
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

    if (!restaurantGuid || !restaurantGuid.trim()) {
      return {
        valid: false,
        error: "Toast Restaurant External GUID is required.",
      };
    }

    const effectiveGuid = restaurantGuid.trim();
    const env = environment === "SANDBOX" ? "SANDBOX" : "PRODUCTION";

    if (env === "SANDBOX" && clientId.startsWith("sandbox_")) {
      return {
        valid: true,
        locations: [{ id: effectiveGuid, name: "Toast Sandbox Restaurant" }],
        providerMetadata: {
          tokenType: "Bearer",
          environment: "SANDBOX",
          authenticatedAt: new Date().toISOString(),
        },
      };
    }

    try {
      await this.authenticateToast(credentials);
      return {
        valid: true,
        locations: [
          {
            id: effectiveGuid,
            name: env === "SANDBOX" ? "Toast Sandbox Restaurant" : "Toast Production Restaurant",
          },
        ],
        providerMetadata: {
          tokenType: "Bearer",
          environment: env,
          authenticatedAt: new Date().toISOString(),
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
    const { restaurantGuid, environment, clientId } = credentials;
    const cleanGuid = restaurantGuid?.trim().replace(/^["']|["']$/g, "");
    const env = environment === "SANDBOX" ? "SANDBOX" : "PRODUCTION";

    if (!cleanGuid) {
      throw new Error("Toast Restaurant External GUID is required to fetch orders.");
    }

    // Deterministic sandbox fixture when using sandbox_* test credentials
    if (env === "SANDBOX" && clientId?.startsWith("sandbox_")) {
      const mockOrders: NormalizedOrder[] = [
        {
          provider: "TOAST",
          providerOrderId: "tst_ord_sbx_1001",
          providerLocationId: options.locationId || cleanGuid,
          orderNumber: "TST-1001",
          orderType: "DINE_IN",
          status: "COMPLETED",
          currency: "USD",
          environment: "SANDBOX",
          totalAmount: 112.4,
          taxAmount: 8.4,
          tipAmount: 18.0,
          discountAmount: 0,
          serviceChargeAmount: 4.0,
          voidedAmount: 0,
          refundAmount: 0,
          paymentStatus: "PAID",
          paymentMethod: "SPLIT",
          payments: [
            { tenderType: "CARD", label: "VISA Credit", amount: 72.4, tipAmount: 12.0, cardBrand: "VISA", last4: "4242" },
            { tenderType: "CASH", label: "Cash", amount: 40.0, tipAmount: 6.0 },
          ],
          refunds: [],
          customerName: "Maya Lin",
          notes: "Table 12",
          createdAt: new Date("2026-11-20T18:30:00.000Z"),
          providerUpdatedAt: new Date("2026-11-20T19:05:00.000Z"),
          providerVersion: "v1",
          isPartialSnapshot: false,
          items: [
            {
              posMenuItemId: "tst_item_ribeye",
              providerItemId: "tst_li_1001_1",
              name: "Prime Ribeye Steak",
              quantity: 2,
              unitPrice: 41.0,
              totalPrice: 82.0,
              taxAmount: 6.56,
              discountAmount: 0,
              netSales: 82.0,
              isVoided: false,
              modifiers: [{ name: "Medium Rare", price: 0 }],
            },
            {
              posMenuItemId: "tst_item_salad",
              providerItemId: "tst_li_1001_2",
              name: "Truffle Caesar Salad",
              quantity: 1,
              unitPrice: 18.0,
              totalPrice: 18.0,
              taxAmount: 1.84,
              discountAmount: 0,
              netSales: 18.0,
              isVoided: false,
            },
          ],
        },
      ];
      return {
        orders: mockOrders.slice(0, options.limit || 100),
        hasMore: false,
        isPartialSnapshot: false,
      };
    }

    try {
      const accessToken = await this.authenticateToast(credentials);
      const host =
        env === "SANDBOX"
          ? "https://ws-sandbox-api.toasttab.com"
          : "https://ws-api.toasttab.com";

      const reqHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Toast-Restaurant-External-ID": cleanGuid,
      };

      const pageSize = Math.min(options.limit || 100, 100);
      const currentPage = options.cursor && options.cursor.startsWith("page:")
        ? Math.max(1, parseInt(options.cursor.slice(5), 10) || 1)
        : 1;

      const url = new URL(`${host}/orders/v2/ordersBulk`);
      if (options.businessDate) {
        url.searchParams.set("businessDate", options.businessDate.replace(/-/g, ""));
      } else {
        const endDate = options.until || new Date();
        const startDate =
          options.since || new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        url.searchParams.set("startDate", startDate.toISOString());
        url.searchParams.set("endDate", endDate.toISOString());
      }
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("page", String(currentPage));

      const response = await fetch(url.toString(), { headers: reqHeaders });
      if (!response.ok) {
        throw new Error(`Toast Orders API returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const list = Array.isArray(data) ? data : data.orders || data.data || [];
      const hasMore = list.length >= pageSize;
      const nextCursor = hasMore ? `page:${currentPage + 1}` : undefined;

      const orders: NormalizedOrder[] = list.map((o: any) =>
        this.normalizeToastOrder(o, options.locationId || cleanGuid, env)
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

  private normalizeToastOrder(
    o: any,
    locationId: string,
    environment: "SANDBOX" | "PRODUCTION"
  ): NormalizedOrder {
    const checks = Array.isArray(o.checks) ? o.checks : [];
    const firstCheck = checks[0] || {};

    let taxCents = 0;
    let tipCents = 0;
    let discountCents = 0;
    let serviceChargeCents = 0;
    let refundCents = 0;
    let voidedCents = 0;
    let grossCents = 0;

    const payments: NormalizedPaymentTender[] = [];
    const refunds: NormalizedRefund[] = [];
    const allSelections: any[] = [];

    for (const chk of checks) {
      taxCents += Math.round(Number(chk.taxAmount || 0) * 100);

      for (const sc of chk.appliedServiceCharges || []) {
        serviceChargeCents += Math.round(Number(sc.chargeAmount || 0) * 100);
      }
      for (const disc of chk.appliedDiscounts || []) {
        discountCents += Math.round(Number(disc.discountAmount || 0) * 100);
      }

      const chkSelections = chk.selections || chk.items || [];
      for (const sel of chkSelections) {
        allSelections.push(sel);
        const qty = Number(sel.quantity || 1);
        const linePriceCents = Math.round(Number(sel.preDiscountPrice ?? (qty * Number(sel.price || 0))) * 100);
        if (sel.voided || sel.isVoided) {
          voidedCents += linePriceCents;
        } else {
          grossCents += linePriceCents;
          discountCents += Math.round(Number(sel.discountAmount || 0) * 100);
        }
      }

      for (const p of chk.payments || []) {
        const pAmt = Number(p.amount || 0);
        const pTip = Number(p.tipAmount || 0);
        tipCents += Math.round(pTip * 100);
        payments.push({
          tenderType: classifyToastPaymentType(p.type || p.cardType),
          label: p.type || p.cardType || "PAYMENT",
          amount: roundCents(pAmt),
          tipAmount: roundCents(pTip),
          cardBrand: p.cardType || undefined,
          last4: p.last4Digits || undefined,
          externalPaymentId: p.guid || undefined,
        });

        if (p.refund && Number(p.refund.refundAmount || 0) > 0) {
          const rAmt = Number(p.refund.refundAmount || 0);
          refundCents += Math.round(rAmt * 100);
          refunds.push({
            externalRefundId: p.refund.guid || `${p.guid || "ref"}_r`,
            amount: roundCents(rAmt),
            tipRefundAmount: roundCents(Number(p.refund.tipRefundAmount || 0)),
            refundedAt: p.refund.refundDate || undefined,
          });
        }
      }
    }

    if (allSelections.length === 0 && Array.isArray(o.items)) {
      allSelections.push(...o.items);
    }

    const items = allSelections.map((i: any, index: number) => {
      const qty = Number(i.quantity || 1);
      const uPrice = Number(i.price || 0);
      const disc = Number(i.discountAmount || 0);
      const tax = Number(i.tax || 0);
      const isVoided = Boolean(i.voided || i.isVoided || false);
      const net = isVoided
        ? 0
        : i.netAmount !== undefined
          ? Number(i.netAmount)
          : roundCents(qty * uPrice - disc);

      return {
        posMenuItemId:
          i.item?.guid ||
          i.entityId ||
          i.menuItem?.guid ||
          i.itemGroup?.guid ||
          (i.guid ? String(i.guid) : undefined),
        providerItemId: i.guid ? String(i.guid) : `item_${index + 1}`,
        externalVariantId: i.itemGroup?.guid || undefined,
        name: i.displayName || i.name || "Menu Item",
        quantity: qty,
        unitPrice: uPrice,
        totalPrice: roundCents(qty * uPrice),
        taxAmount: roundCents(tax),
        discountAmount: roundCents(disc),
        netSales: net,
        isVoided,
        modifiers: (i.selections || i.modifiers || []).map((s: any) => ({
          name: s.displayName || s.name || "Modifier",
          price: Number(s.price || 0),
        })),
      };
    });

    const netCents = Math.max(0, grossCents - discountCents);
    const totalCollectedCents = Math.max(
      0,
      netCents + taxCents + serviceChargeCents + tipCents - refundCents
    );

    const custObj = o.customer || firstCheck.customer || o.deliveryInfo?.recipient || {};
    const custName =
      `${custObj.firstName || ""} ${custObj.lastName || ""}`.trim() ||
      custObj.name ||
      undefined;

    const diningOptStr = String(
      o.diningOption?.displayName || o.diningOption?.name || o.diningOption || ""
    ).toUpperCase();
    let derivedOrderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "UNKNOWN" = "UNKNOWN";
    if (diningOptStr.includes("DINE") || diningOptStr.includes("TABLE")) {
      derivedOrderType = "DINE_IN";
    } else if (diningOptStr.includes("DELIVER")) {
      derivedOrderType = "DELIVERY";
    } else if (
      diningOptStr.includes("TAKE") ||
      diningOptStr.includes("PICK") ||
      diningOptStr.includes("CARRY") ||
      diningOptStr.includes("TOGO") ||
      diningOptStr.includes("TO GO") ||
      diningOptStr.includes("COUNTER")
    ) {
      derivedOrderType = "TAKEAWAY";
    }

    const orderGuid =
      o.guid && o.guid !== "undefined"
        ? String(o.guid)
        : o.id
          ? String(o.id)
          : String(firstCheck.guid || `tst_${Date.now()}`);
    const rawNum = o.displayNumber || o.shortOrderNumber || o.checkNumber;
    const shortCode = orderGuid.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "0000";

    const uniqueTenderTypes = Array.from(new Set(payments.map((p) => p.tenderType)));
    const paymentMethod =
      uniqueTenderTypes.length > 1
        ? "SPLIT"
        : uniqueTenderTypes[0] || o.paymentMethod || "TOAST_PAYMENT";

    const paymentStatus: NormalizedOrder["paymentStatus"] =
      refundCents >= totalCollectedCents && refundCents > 0
        ? "REFUNDED"
        : refundCents > 0
          ? "PARTIAL"
          : "PAID";

    return {
      provider: "TOAST",
      providerOrderId: orderGuid,
      providerLocationId: locationId,
      orderNumber: rawNum ? `TST-${rawNum}` : `TST-${shortCode}`,
      orderType: derivedOrderType,
      status: o.voided || o.deleted ? "CANCELLED" : "COMPLETED",
      currency: o.currency || "",
      environment,
      totalAmount: roundCents(
        totalCollectedCents > 0 ? totalCollectedCents / 100 : Number(firstCheck.totalAmount || o.total || 0)
      ),
      taxAmount: roundCents(taxCents / 100),
      tipAmount: roundCents(tipCents / 100),
      discountAmount: roundCents(discountCents / 100),
      serviceChargeAmount: roundCents(serviceChargeCents / 100),
      voidedAmount: roundCents(voidedCents / 100),
      refundAmount: roundCents(refundCents / 100),
      paymentStatus,
      paymentMethod,
      payments,
      refunds,
      customerName: custName,
      customerPhone: custObj.phone || custObj.phoneNumber || undefined,
      notes: o.notes || firstCheck.notes || (o.table?.name ? `Table: ${o.table.name}` : undefined),
      createdAt: new Date(o.openedDate || o.createdDate || Date.now()),
      providerUpdatedAt: o.modifiedDate ? new Date(o.modifiedDate) : undefined,
      providerVersion: o.modifiedDate ? String(o.modifiedDate) : undefined,
      businessDate: o.businessDate ? String(o.businessDate) : undefined,
      isPartialSnapshot: false,
      rawPayload: o,
      items,
    };
  }

  verifyWebhookSignature(params: {
    rawBody: string;
    headers: Record<string, string | undefined>;
    secret: string;
  }): boolean {
    const sig = params.headers["toast-signature"];
    if (!sig || !params.secret) return false;
    const timestamp = params.headers["toast-timestamp"] || "";
    const payload = timestamp ? `${params.rawBody}${timestamp}` : params.rawBody;
    const computed = crypto
      .createHmac("sha256", params.secret)
      .update(payload, "utf8")
      .digest("base64");
    const a = Buffer.from(sig);
    const b = Buffer.from(computed);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
