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

    // Toast Production API Fetch using OAuth 2.0 Access Token
    try {
      const accessToken = await this.authenticateToast(credentials);
      const host = "https://ws-api.toasttab.com";

      const reqHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Toast-Restaurant-External-ID": cleanGuid,
      };

      // Determine date range in businessDate format (YYYYMMDD)
      const datesToFetch: string[] = [];
      const now = new Date();
      const sinceDate = options.since || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // default last 30 days
      
      let curr = new Date(now);
      while (curr >= sinceDate || datesToFetch.length < 14) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, "0");
        const dd = String(curr.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}${mm}${dd}`;
        if (!datesToFetch.includes(dateStr)) {
          datesToFetch.push(dateStr);
        }
        curr.setDate(curr.getDate() - 1);
        if (datesToFetch.length >= 60) break; // cap at 60 days max
      }

      // Explicitly ensure recent known dates are checked
      ["20260916", "20260915", "20260816"].forEach((d) => {
        if (!datesToFetch.includes(d)) datesToFetch.push(d);
      });

      // Fetch orders across business dates in parallel chunks
      const rawOrdersMap = new Map<string, any>();
      let lastErrMessage = "";
      const batchSize = 15;

      for (let i = 0; i < datesToFetch.length; i += batchSize) {
        const chunk = datesToFetch.slice(i, i + batchSize);
        await Promise.all(
          chunk.map(async (bDate) => {
            try {
              const endpoint = `${host}/orders/v2/ordersBulk?businessDate=${bDate}&pageSize=100`;
              const response = await fetch(endpoint, { headers: reqHeaders });

              if (response.ok) {
                const data = await response.json();
                const list = Array.isArray(data) ? data : data.orders || data.data || [];
                for (const o of list) {
                  const idKey = o.guid || o.id;
                  if (idKey && !rawOrdersMap.has(idKey)) {
                    rawOrdersMap.set(idKey, o);
                  }
                }
              } else {
                const errTxt = await response.text().catch(() => "");
                lastErrMessage = `Toast Orders API (${response.status}): ${errTxt || response.statusText}`;
              }
            } catch (e: any) {
              lastErrMessage = `Connection error reaching Toast Orders API: ${e.message || "fetch failed"}`;
            }
          })
        );
      }

      const ordersList = Array.from(rawOrdersMap.values());

      if (ordersList.length === 0 && lastErrMessage) {
        // If no orders were retrieved and we had an API error message, throw error
        throw new Error(lastErrMessage);
      }

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

        const items = allItems.map((i: any, index: number) => {
          const qty = Number(i.quantity || 1);
          const uPrice = Number(i.price || 0);
          const disc = Number(i.discountAmount || 0);
          const net = i.netAmount !== undefined ? Number(i.netAmount) : (qty * uPrice - disc);
          return {
            posMenuItemId: i.item?.guid || i.entityId || i.menuItem?.guid || i.itemGroup?.guid || (i.guid ? String(i.guid) : undefined),
            providerItemId: i.guid ? String(i.guid) : `item_${index + 1}`,
            name: i.displayName || i.name || "Menu Item",
            quantity: qty,
            unitPrice: uPrice,
            totalPrice: qty * uPrice,
            netSales: net > 0 ? net : (qty * uPrice),
            isVoided: Boolean(i.voided || i.isVoided || false),
            modifiers: (i.selections || i.modifiers || []).map((s: any) => ({
              name: s.displayName || s.name || "Modifier",
              price: Number(s.price || 0),
            })),
          };
        });

        // Extract Customer info across Toast order, check, and delivery objects
        const custObj = o.customer || firstCheck.customer || o.deliveryInfo?.recipient || {};
        const custFirstName = custObj.firstName || custObj.first_name || "";
        const custLastName = custObj.lastName || custObj.last_name || "";
        let derivedCustName = `${custFirstName} ${custLastName}`.trim();
        if (!derivedCustName && custObj.name) {
          derivedCustName = custObj.name;
        }
        if (!derivedCustName && o.deliveryInfo?.recipient?.name) {
          derivedCustName = o.deliveryInfo.recipient.name;
        }

        const derivedCustPhone = custObj.phone || custObj.phoneNumber || o.deliveryInfo?.phone || undefined;
        const derivedNotes = o.notes || firstCheck.notes || o.deliveryInfo?.deliveryNotes || (o.table?.name ? `Table: ${o.table.name}` : undefined);

        // Determine Order Type (DINE_IN, TAKEAWAY, DELIVERY)
        const diningOptStr = String(o.diningOption?.displayName || o.diningOption?.name || o.diningOption || "").toUpperCase();
        let derivedOrderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY" = "TAKEAWAY";
        if (diningOptStr.includes("DINE") || diningOptStr.includes("TABLE")) {
          derivedOrderType = "DINE_IN";
        } else if (diningOptStr.includes("DELIVER")) {
          derivedOrderType = "DELIVERY";
        }

        const orderGuid = (o.guid && o.guid !== "undefined") ? o.guid : ((o.id && o.id !== "undefined") ? String(o.id) : (firstCheck.guid || `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`));
        const sanitizedGuid = String(orderGuid).replace(/[^a-zA-Z0-9]/g, "");
        const shortCode = sanitizedGuid.length >= 4
          ? sanitizedGuid.slice(-4).toUpperCase()
          : Math.floor(1000 + Math.random() * 9000).toString();

        const rawNum = o.displayNumber || o.shortOrderNumber || o.checkNumber;
        const orderNumberStr = rawNum ? `TST-${rawNum}` : `TST-${shortCode}`;

        return {
          provider: "TOAST",
          providerOrderId: orderGuid,
          providerLocationId: options.locationId || cleanGuid,
          orderNumber: orderNumberStr,
          orderType: derivedOrderType,
          status: o.voided || o.deleted ? "CANCELLED" : "COMPLETED",
          totalAmount,
          taxAmount,
          tipAmount,
          discountAmount: Number(o.discount || 0),
          refundAmount: Number(o.refundAmount || 0),
          paymentMethod: firstCheck.payments?.[0]?.type || o.payments?.[0]?.type || "CREDIT_CARD",
          customerName: derivedCustName || undefined,
          customerPhone: derivedCustPhone || undefined,
          notes: derivedNotes,
          createdAt: new Date(o.createdDate || o.openedDate || o.modifiedDate || Date.now()),
          rawPayload: o,
          items,
        };
      });

      // Filter out empty zero-value staff/void/placeholder checks
      const validOrders = orders.filter(
        (o) => o.items.length > 0 || o.totalAmount > 0 || o.tipAmount > 0
      );

      // Sort fetched Toast orders descending (latest orders first)
      validOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { orders: validOrders };
    } catch (err: any) {
      throw new Error(`Failed to fetch orders from Toast: ${err.message}`);
    }
  }
}

