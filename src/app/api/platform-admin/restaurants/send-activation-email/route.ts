import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import { sendTenantActivationEmail } from "@/core/mail";

// POST /api/platform-admin/restaurants/send-activation-email
// On-demand trigger to send tenant activation email with confirmation
export async function POST(req: NextRequest) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized platform admin access" }, { status: 401 });
    }

    const body = await req.json();
    const { restaurantId, token: inputToken, adminEmail: inputEmail, adminName: inputName } = body;

    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId is required" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        invitations: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        memberships: {
          include: { user: true },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const latestInvitation = restaurant.invitations[0];
    const targetEmail =
      inputEmail ||
      latestInvitation?.email ||
      restaurant.memberships[0]?.user?.email;

    if (!targetEmail) {
      return NextResponse.json({ error: "No administrator email found for this restaurant" }, { status: 400 });
    }

    const adminUser = restaurant.memberships.find((m) => m.user?.email === targetEmail)?.user;
    const adminName = inputName || adminUser?.name || `${restaurant.name} Administrator`;
    const token = inputToken || body.invitationToken;

    if (!token) {
      return NextResponse.json(
        { error: "No activation token found. Please generate an invite first." },
        { status: 400 }
      );
    }

    // Determine base URL with subdomain
    const rawProto = req.headers.get("x-forwarded-proto") || "https";
    const proto = rawProto.split(",")[0].trim();
    const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const host = rawHost.split(",")[0].trim();

    let tenantBaseUrl: string;
    if (host.startsWith("admin.")) {
      tenantBaseUrl = `${proto}://${host.replace(/^admin\./, `${restaurant.subdomain}.`)}`;
    } else if (host.includes("localhost") || host.includes("127.0.0.1")) {
      const port = host.includes(":") ? `:${host.split(":")[1]}` : "";
      tenantBaseUrl = `${proto}://${restaurant.subdomain}.localhost${port}`;
    } else {
      tenantBaseUrl = `https://${restaurant.subdomain}.restobird.com`;
    }

    const emailResult = await sendTenantActivationEmail({
      adminName,
      adminEmail: targetEmail,
      restaurantName: restaurant.name,
      subdomain: restaurant.subdomain,
      activationToken: token,
      expiresAt: latestInvitation?.expiresAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      baseUrl: tenantBaseUrl,
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        restaurantId: restaurant.id,
        userId: session.userId,
        userEmail: session.email,
        action: "TENANT_ACTIVATION_EMAIL_MANUAL_TRIGGER",
        entityType: "StaffInvitation",
        entityId: latestInvitation?.id || restaurant.id,
        newValues: JSON.stringify({
          recipientEmail: targetEmail,
          emailSent: emailResult?.success ?? false,
          error: emailResult?.error,
          triggeredBy: session.email,
        }),
      },
    });

    if (!emailResult?.success) {
      return NextResponse.json(
        {
          success: false,
          error: emailResult?.error || "Failed to dispatch email via SMTP server",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email: targetEmail,
      recipient: targetEmail,
    });
  } catch (error: any) {
    console.error("Manual Activation Email Error:", error);
    return NextResponse.json({ error: error.message || "Failed to send activation email" }, { status: 500 });
  }
}
