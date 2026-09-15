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
    const { clientId, clientSecret, restaurantGuid } = credentials;

    if (!clientId || !clientSecret) {
      return {
        valid: false,
        error: "Missing required Toast API credentials: Client ID and Client Secret are required.",
      };
    }

    if (!restaurantGuid || !restaurantGuid.trim()) {
      return {
        valid: false,
        error: "Toast Restaurant External GUID is required. Please provide your Toast Restaurant External GUID.",
      };
    }

    const effectiveGuid = restaurantGuid.trim();

    // Toast Production API authentication test
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
    const { restaurantGuid } = credentials;
    const cleanGuid = restaurantGuid?.trim().replace(/^["']|["']$/g, "");

    if (!cleanGuid) {
      throw new Error(
        "Toast Restaurant External GUID is required to fetch orders. Please edit your Toast connection and enter your Restaurant External GUID."
      );
    }

    const maxPageSize = options.limit || 1000;

    // Toast Production API Fetch using OAuth 2.0 Access Token
    try {
      const accessToken = await this.authenticateToast(credentials);
      const host = "https://ws-api.toasttab.com";
      const pathSuffixes = ["/orders/v2/ordersBulk", "/orders/v2/orders"];

      let rawOrders: any = null;
      let lastErrMessage = "";

      const endDateStr = new Date().toISOString();
      const startDateStr = options.since
        ? options.since.toISOString()
        : new Date(new Date().getFullYear(), 0, 1).toISOString();

      const reqHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Toast-Restaurant-External-ID": cleanGuid,
      };

      for (const suffix of pathSuffixes) {
        try {
          const endpoint = `${host}${suffix}?startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}&pageSize=${maxPageSize}`;

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
      const targetList = options.limit ? ordersList.slice(0, options.limit) : ordersList;

      const orders: NormalizedOrder[] = targetList.map((o: any) => {
        const firstCheck = o.checks?.[0] || {};
        const totalAmount = Number(firstCheck.amount || o.total || o.amount || 0);
        const taxAmount = Number(firstCheck.taxAmount || o.tax || 0);
        const tipAmount = Number(firstCheck.payments?.[0]?.tipAmount || o.tip || 0);

        // Extract items across all checks if available
        let allItems: any[] = [];
        if (Array.isArray(o.checks)) {
          o.checks.forEach((chk: any) => {
            if (Array.isArray(chk.items) && chk.items.length > 0) {
              allItems.push(...chk.items);
            }
            if (Array.isArray(chk.selections) && chk.selections.length > 0) {
              allItems.push(...chk.selections);
            }
          });
        }
        if (allItems.length === 0 && Array.isArray(o.items)) {
          allItems.push(...o.items);
        }
        if (allItems.length === 0 && Array.isArray(o.selections)) {
          allItems.push(...o.selections);
        }

        const items = allItems.map((i: any) => ({
          name: i.displayName || i.name || "Menu Item",
          quantity: Number(i.quantity || 1),
          unitPrice: Number(i.price || 0),
          modifiers: (i.selections || i.modifiers || []).map((s: any) => ({
            name: s.displayName || s.name || "Modifier",
            price: Number(s.price || 0),
          })),
        }));

        const orderGuid = (o.guid && o.guid !== "undefined") ? o.guid : ((o.id && o.id !== "undefined") ? String(o.id) : (firstCheck.guid || `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`));
        const sanitizedGuid = String(orderGuid).replace(/[^a-zA-Z0-9]/g, "");
        const shortCode = sanitizedGuid.length >= 4
          ? sanitizedGuid.slice(-4).toUpperCase()
          : Math.floor(1000 + Math.random() * 9000).toString();

        const orderNumberStr = o.displayNumber || o.shortOrderNumber || (o.checkNumber ? `#${o.checkNumber}` : `TST-${shortCode}`);

        return {
          provider: "TOAST",
          providerOrderId: orderGuid,
          providerLocationId: options.locationId || cleanGuid,
          orderNumber: orderNumberStr,
          orderType: o.diningOption?.displayName === "Dine In" || o.diningOption === "Dine In" ? "DINE_IN" : "TAKEAWAY",
          status: o.voided || o.deleted ? "CANCELLED" : "COMPLETED",
          totalAmount,
          taxAmount,
          tipAmount,
          discountAmount: Number(o.discount || 0),
          refundAmount: Number(o.refundAmount || 0),
          paymentMethod: firstCheck.payments?.[0]?.type || o.payments?.[0]?.type || "CREDIT_CARD",
          customerName: fullName || o.customer?.name || undefined,
          customerPhone: o.customer?.phone || undefined,
          createdAt: new Date(o.createdDate || o.openedDate || Date.now()),
          rawPayload: o,
          items,
        };
      });

      return { orders };
    } catch (err: any) {
      throw new Error(`Failed to fetch orders from Toast: ${err.message}`);
    }
  }
}

