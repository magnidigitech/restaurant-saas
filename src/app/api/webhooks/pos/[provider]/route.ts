import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { executeSync, getProviderAdapter } from "@/modules/pos-integrations/service";
import {
  decryptPosCredentials,
  decryptWebhookSecret,
  sanitizeProviderError,
} from "@/modules/pos-integrations/crypto";
import { PosProviderType } from "@/modules/pos-integrations/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const upperProvider = provider.toUpperCase() as PosProviderType;
    if (!["TOAST", "SQUARE", "CLOVER"].includes(upperProvider)) {
      return NextResponse.json({ error: "Unsupported POS provider" }, { status: 400 });
    }

    const rawBody = await req.text();

    // Clover URL verification challenge
    if (upperProvider === "CLOVER") {
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed.verificationCode) {
          return NextResponse.json({ received: true, challenge: true });
        }
      } catch {
        // non-JSON or regular payload
      }
    }

    const headers: Record<string, string | undefined> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const integrations = await prisma.posIntegration.findMany({
      where: {
        provider: upperProvider,
        status: "ACTIVE",
        webhookSecretEncrypted: { not: null },
      },
    });

    const adapter = getProviderAdapter(upperProvider);
    if (!adapter.verifyWebhookSignature) {
      return NextResponse.json({ error: "Webhook verification not supported" }, { status: 400 });
    }

    const matched = [];
    for (const integration of integrations) {
      if (!integration.webhookSecretEncrypted) continue;
      const secret = decryptWebhookSecret(integration.webhookSecretEncrypted);
      let notificationUrl: string | undefined;
      if (integration.credentialsEncrypted) {
        try {
          const creds = decryptPosCredentials(integration.credentialsEncrypted);
          notificationUrl = creds.webhookNotificationUrl || req.url;
        } catch {
          notificationUrl = req.url;
        }
      }

      const valid = adapter.verifyWebhookSignature({
        rawBody,
        headers,
        secret,
        notificationUrl,
      });
      if (valid) {
        matched.push(integration);
      }
    }

    if (matched.length === 0) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const synced = [];
    for (const integration of matched) {
      try {
        const res = await executeSync(integration.restaurantId, integration.id, {
          runType: "WEBHOOK",
          maxPages: 2,
        });
        synced.push({ integrationId: integration.id, status: res.status });
      } catch (err: any) {
        synced.push({
          integrationId: integration.id,
          status: "QUEUED_OR_CONFLICT",
          detail: sanitizeProviderError(err),
        });
      }
    }

    return NextResponse.json({ received: true, synced });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeProviderError(error) },
      { status: 500 }
    );
  }
}
