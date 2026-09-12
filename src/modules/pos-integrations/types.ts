export type PosProviderType = "TOAST" | "SQUARE" | "CLOVER";

export type PosIntegrationStatusType = "ACTIVE" | "NEEDS_REAUTH" | "DISCONNECTED" | "ERROR";

export type PosEnvironmentType = "PRODUCTION" | "SANDBOX";

export interface ProviderLocation {
  id: string;
  name: string;
  address?: string;
}

export interface ProviderCredentials {
  environment: PosEnvironmentType;
  // Square
  accessToken?: string;
  applicationId?: string;
  locationId?: string;
  // Toast
  clientId?: string;
  clientSecret?: string;
  restaurantGuid?: string;
  managementGroupGuid?: string;
  // Clover
  apiToken?: string;
  merchantId?: string;
  region?: "NA" | "EU";
}

export interface NormalizedOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  modifiers?: Array<{
    name: string;
    price: number;
    option?: string;
  }>;
}

export interface NormalizedOrder {
  provider: PosProviderType;
  providerOrderId: string;
  providerLocationId?: string;
  orderNumber: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
  totalAmount: number;
  taxAmount: number;
  tipAmount: number;
  discountAmount: number;
  refundAmount: number;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdAt: Date;
  rawPayload?: any;
  items: NormalizedOrderItem[];
}

export interface ProviderValidationResult {
  valid: boolean;
  error?: string;
  locations?: ProviderLocation[];
  providerMetadata?: Record<string, any>;
}

export interface ProviderFetchResult {
  orders: NormalizedOrder[];
  hasMore?: boolean;
  cursor?: string;
  recordsRequiringAttention?: number;
}

export interface PosProviderAdapter {
  provider: PosProviderType;
  displayName: string;
  validateCredentials(credentials: ProviderCredentials): Promise<ProviderValidationResult>;
  fetchOrders(
    credentials: ProviderCredentials,
    options: {
      locationId?: string;
      since?: Date;
      limit?: number;
    }
  ): Promise<ProviderFetchResult>;
}

export interface PosIntegrationSummary {
  id: string;
  restaurantId: string;
  outletId: string;
  outletName: string;
  provider: PosProviderType;
  status: PosIntegrationStatusType;
  environment: PosEnvironmentType;
  providerLocationId: string | null;
  providerLocationName: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  errorMessage: string | null;
  ordersImportedCount: number;
  createdAt: Date;
}
