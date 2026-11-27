export type PosProviderType = "TOAST" | "SQUARE" | "CLOVER";

export interface ProviderCredentials {
  clientId?: string;
  clientSecret?: string;
  restaurantGuid?: string;
  apiToken?: string;
  accessToken?: string;
  merchantId?: string;
  locationId?: string;
  webhookSecret?: string;
  webhookNotificationUrl?: string;
  environment?: "SANDBOX" | "PRODUCTION";
  region?: "US" | "EU";
}

export interface NormalizedPaymentTender {
  tenderType: "CASH" | "CARD" | "GIFT_CARD" | "ONLINE" | "OTHER";
  label: string;
  amount: number;
  tipAmount: number;
  cardBrand?: string;
  last4?: string;
  externalPaymentId?: string;
}

export interface NormalizedRefund {
  externalRefundId: string;
  amount: number;
  tipRefundAmount?: number;
  reason?: string;
  refundedAt?: string;
}

export interface NormalizedOrderItem {
  posMenuItemId?: string;
  providerItemId?: string;
  externalVariantId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  taxAmount?: number;
  discountAmount?: number;
  netSales?: number;
  refundedQuantity?: number;
  isVoided?: boolean;
  modifiers?: Array<{ name: string; price: number; option?: string }>;
  notes?: string;
}

export interface NormalizedOrder {
  provider: PosProviderType;
  providerOrderId: string;
  providerLocationId?: string;
  orderNumber: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  status: "COMPLETED" | "CANCELLED" | "PENDING";
  currency: string;
  environment: "SANDBOX" | "PRODUCTION";
  totalAmount: number;
  taxAmount: number;
  tipAmount: number;
  discountAmount: number;
  serviceChargeAmount: number;
  voidedAmount: number;
  refundAmount: number;
  paymentStatus?: "PAID" | "PARTIAL" | "REFUNDED" | "PENDING" | "FAILED";
  paymentMethod?: string;
  payments?: NormalizedPaymentTender[];
  refunds?: NormalizedRefund[];
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdAt: Date;
  providerUpdatedAt?: Date;
  providerVersion?: string;
  businessDate?: string;
  isPartialSnapshot?: boolean;
  rawPayload?: any;
  items: NormalizedOrderItem[];
}

export interface ProviderValidationResult {
  valid: boolean;
  locations?: Array<{ id: string; name: string }>;
  error?: string;
  providerMetadata?: Record<string, any>;
}

export interface ProviderFetchOptions {
  locationId?: string;
  businessDate?: string;
  since?: Date;
  until?: Date;
  cursor?: string;
  limit?: number;
  mode?: "BACKFILL" | "INCREMENTAL" | "WEBHOOK" | "MANUAL";
}

export interface ProviderFetchResult {
  orders: NormalizedOrder[];
  nextCursor?: string;
  hasMore?: boolean;
  isPartialSnapshot?: boolean;
  recordsRequiringAttention?: number;
}

export interface PosProviderAdapter {
  provider: PosProviderType;
  validateCredentials(credentials: ProviderCredentials): Promise<ProviderValidationResult>;
  fetchOrders(
    credentials: ProviderCredentials,
    options: ProviderFetchOptions
  ): Promise<ProviderFetchResult>;
  verifyWebhookSignature?(params: {
    rawBody: string;
    headers: Record<string, string | undefined>;
    secret: string;
    notificationUrl?: string;
  }): boolean;
}

/**
 * Normalized accounting definitions per POS provider.
 * All money math uses integer minor units (cents) before persisting Decimal(12,2).
 */
export const PROVIDER_AMOUNT_DEFINITIONS: Record<
  PosProviderType,
  {
    grossSales: string;
    discounts: string;
    refunds: string;
    netSales: string;
    tax: string;
    tips: string;
    serviceCharges: string;
    totalCollected: string;
  }
> = {
  TOAST: {
    grossSales: "Sum of non-voided check selection pre-discount prices",
    discounts: "Sum of check.appliedDiscounts + selection.discountAmount",
    refunds: "Sum of check.payments[].refund.refundAmount (or check.refundAmount)",
    netSales: "grossSales - discounts - voidedAmount",
    tax: "Sum of check.taxAmount",
    tips: "Sum of check.payments[].tipAmount",
    serviceCharges: "Sum of check.appliedServiceCharges[].chargeAmount",
    totalCollected: "netSales + tax + serviceCharges + tips - refunds",
  },
  SQUARE: {
    grossSales: "Sum of line_items[].gross_sales_money.amount",
    discounts: "total_discount_money.amount",
    refunds: "Sum of refunds[].amount_money.amount",
    netSales: "grossSales - discounts",
    tax: "total_tax_money.amount",
    tips: "total_tip_money.amount",
    serviceCharges: "total_service_charge_money.amount",
    totalCollected: "total_money.amount - refunds",
  },
  CLOVER: {
    grossSales: "Sum of non-refunded lineItems[].price * quantity (or unitQty/1000)",
    discounts: "Sum of order.discounts[].amount or lineItem.discounts",
    refunds: "Sum of refunds.elements[].amount",
    netSales: "grossSales - discounts",
    tax: "order.totalTax (0 if order.taxRemoved)",
    tips: "Sum of payments.elements[].tipAmount",
    serviceCharges: "order.serviceCharge.amount (if present)",
    totalCollected: "order.total + tips - refunds",
  },
};
