import { getAppBaseUrl } from "./mailer";

export interface TenantActivationEmailParams {
  adminName: string;
  adminEmail: string;
  restaurantName: string;
  subdomain: string;
  activationToken: string;
  expiresAt?: Date;
  baseUrl?: string;
}

/**
 * 1. TENANT ACTIVATION EMAIL TEMPLATE (RESTO BIRD EXECUTIVE ONBOARDING)
 */
export function generateTenantActivationEmail(params: TenantActivationEmailParams) {
  const baseUrl = (params.baseUrl || getAppBaseUrl()).replace(/\/$/, "");
  const activationUrl = `${baseUrl}/activate?token=${params.activationToken}&subdomain=${params.subdomain}&email=${encodeURIComponent(params.adminEmail)}`;
  const expirationText = params.expiresAt
    ? params.expiresAt.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "7 days";

  const subject = `Welcome to Resto Bird | Activate Your Restaurant Account: ${params.restaurantName}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <style>
    /* Client-specific Resets */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #06080d; }
    @media only screen and (max-width: 620px) {
      .email-wrapper { width: 100% !important; border-radius: 0 !important; }
      .content-padding { padding: 24px 20px !important; }
      .header-padding { padding: 28px 20px 22px 20px !important; }
      .cta-button { width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #06080d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1;">
  <div style="background-color: #06080d; padding: 32px 12px;">
    <!-- Main Email Container -->
    <table align="center" border="0" cellpadding="0" cellspacing="0" class="email-wrapper" style="max-width: 600px; width: 100%; background-color: #0c1017; border: 1px solid #1f2738; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
      
      <!-- Brand Header -->
      <tr>
        <td align="center" class="header-padding" style="background-color: #090d14; border-bottom: 1px solid #1a2233; padding: 36px 32px 28px 32px;">
          <!-- Resto Bird Logo -->
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <img src="https://restobird.com/resto-bird-logo.png" alt="Resto Bird" width="160" style="display: block; width: 160px; max-width: 160px; height: auto; margin-bottom: 8px;" />
              </td>
            </tr>
          </table>
          <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 500; letter-spacing: 0.4px;">
            See your restaurant differently
          </p>
          <div style="display: inline-block; margin-top: 16px; padding: 5px 14px; border-radius: 9999px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); color: #fbbf24; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
            ADMINISTRATIVE ONBOARDING INVITATION
          </div>
        </td>
      </tr>

      <!-- Body Content -->
      <tr>
        <td class="content-padding" style="padding: 36px 32px;">
          <h1 style="margin: 0 0 14px 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.4px; line-height: 1.3;">
            Your Restaurant Operations Console is Ready
          </h1>
          
          <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Hello <strong style="color: #ffffff;">${params.adminName}</strong>,
          </p>

          <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Your restaurant organization <strong style="color: #f1f5f9;">${params.restaurantName}</strong> has been provisioned on the Resto Bird Intelligent Operating System. You have been designated as the primary administrator with full permissions to configure menus, floor layouts, shift scheduling, inventory depletion, and staff access.
          </p>

          <!-- Specifications Card -->
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #111723; border: 1px solid #1e293b; border-radius: 14px; margin-bottom: 28px;">
            <tr>
              <td style="padding: 18px 20px;">
                <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 7px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Organization</td>
                    <td align="right" style="padding: 7px 0; color: #ffffff; font-size: 13px; font-weight: 700;">${params.restaurantName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 7px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #1b2434;">Assigned Subdomain</td>
                    <td align="right" style="padding: 7px 0; color: #f59e0b; font-size: 13px; font-weight: 700; font-family: ui-monospace, monospace; border-top: 1px solid #1b2434;">${params.subdomain}.restobird.com</td>
                  </tr>
                  <tr>
                    <td style="padding: 7px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #1b2434;">Administrator ID</td>
                    <td align="right" style="padding: 7px 0; color: #ffffff; font-size: 13px; font-weight: 600; border-top: 1px solid #1b2434;">${params.adminEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding: 7px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #1b2434;">Role Scope</td>
                    <td align="right" style="padding: 7px 0; color: #10b981; font-size: 13px; font-weight: 700; border-top: 1px solid #1b2434;">Master Administrator</td>
                  </tr>
                  <tr>
                    <td style="padding: 7px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #1b2434;">Invitation Expiry</td>
                    <td align="right" style="padding: 7px 0; color: #fbbf24; font-size: 13px; font-weight: 600; border-top: 1px solid #1b2434;">Valid until ${expirationText}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Primary CTA Button -->
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin: 30px 0 32px 0;">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="border-radius: 12px; background: #f59e0b;">
                      <a href="${activationUrl}" target="_blank" class="cta-button" style="display: inline-block; padding: 16px 36px; font-size: 14px; font-weight: 700; color: #000000; text-decoration: none; border-radius: 12px; letter-spacing: 0.3px; background-color: #f59e0b;">
                        Activate Restaurant &amp; Set Password &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Onboarding Checklist -->
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #0d121c; border: 1px solid #1a2233; border-radius: 12px; margin-bottom: 26px;">
            <tr>
              <td style="padding: 20px;">
                <div style="color: #f8fafc; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;">
                  3-Step Onboarding Checklist
                </div>
                <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td valign="top" style="padding-bottom: 12px; width: 28px;">
                      <div style="width: 20px; height: 20px; border-radius: 50%; background: #1e293b; color: #f59e0b; text-align: center; font-size: 11px; line-height: 20px; font-weight: 700;">1</div>
                    </td>
                    <td style="padding-bottom: 12px; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                      <strong style="color: #f1f5f9;">Establish Master Credentials:</strong> Click the activation button above to set your password and initialize your account.
                    </td>
                  </tr>
                  <tr>
                    <td valign="top" style="padding-bottom: 12px; width: 28px;">
                      <div style="width: 20px; height: 20px; border-radius: 50%; background: #1e293b; color: #f59e0b; text-align: center; font-size: 11px; line-height: 20px; font-weight: 700;">2</div>
                    </td>
                    <td style="padding-bottom: 12px; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                      <strong style="color: #f1f5f9;">Configure Outlets &amp; Floor:</strong> Set up your dining areas, point-of-sale stations, and kitchen display screen (KDS) feeds.
                    </td>
                  </tr>
                  <tr>
                    <td valign="top" style="width: 28px;">
                      <div style="width: 20px; height: 20px; border-radius: 50%; background: #1e293b; color: #f59e0b; text-align: center; font-size: 11px; line-height: 20px; font-weight: 700;">3</div>
                    </td>
                    <td style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
                      <strong style="color: #f1f5f9;">Grant Team Access:</strong> Invite kitchen managers, floor staff, and inventory controllers with granular permissions.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Fallback Direct Link -->
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; line-height: 1.4;">
            If the button does not work in your email client, copy and paste this link into your browser:
          </p>
          <div style="background-color: #090d14; border: 1px solid #1e293b; border-radius: 8px; padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #f59e0b; word-break: break-all; line-height: 1.5; margin-bottom: 22px;">
            ${activationUrl}
          </div>

          <!-- Security Notice Box -->
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px;">
            <tr>
              <td style="padding: 12px 16px; color: #d97706; font-size: 11px; line-height: 1.5;">
                <strong>Security Guard:</strong> This activation link is cryptographically signed and valid for single use within 7 days. If you did not request this invitation, please notify <a href="mailto:info@restobird.com" style="color: #f59e0b; text-decoration: underline;">info@restobird.com</a>.
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td align="center" style="background-color: #090d14; border-top: 1px solid #1a2233; padding: 26px 32px; color: #64748b; font-size: 12px; line-height: 1.6;">
          <p style="margin: 0 0 6px 0; color: #94a3b8; font-weight: 600;">
            Resto Bird &bull; Intelligent Restaurant Operating System
          </p>
          <p style="margin: 0 0 10px 0; font-size: 11px; color: #64748b;">
            See your restaurant differently &bull; <a href="https://restobird.com" style="color: #94a3b8; text-decoration: none;">restobird.com</a>
          </p>
          <p style="margin: 0; font-size: 11px; color: #475569;">
            &copy; ${new Date().getFullYear()} Resto Bird Inc. All rights reserved. Intended exclusively for ${params.adminEmail}.
          </p>
        </td>
      </tr>

    </table>
  </div>
</body>
</html>
`;

  const text = `
================================================================================
RESTO BIRD - RESTAURANT ONBOARDING INVITATION
See your restaurant differently
================================================================================

Hello ${params.adminName},

Welcome to Resto Bird. Your restaurant organization "${params.restaurantName}" has been provisioned on the Resto Bird Intelligent Operating System.

You have been granted Master Administrator credentials to oversee kitchen operations, shift rosters, inventory depletion, and live floor telemetry.

ORGANIZATION DETAILS:
--------------------------------------------------------------------------------
- Restaurant Entity:    ${params.restaurantName}
- Assigned Subdomain:   ${params.subdomain}.restobird.com
- Administrator Email:  ${params.adminEmail}
- Access Scope:         Master Administrator (Owner)
- Validity:             Valid until ${expirationText}

ACTIVATE YOUR ACCOUNT & SET MASTER PASSWORD:
--------------------------------------------------------------------------------
Click or open the following activation link in your browser:
${activationUrl}

3-STEP ONBOARDING CHECKLIST:
1. Establish Master Credentials: Open the link above to define your master password.
2. Configure Outlets & Floor: Set up your dining sections, POS, and KDS stations.
3. Grant Team Access: Invite kitchen managers, floor staff, and inventory controllers.

SECURITY NOTICE:
This invitation link is cryptographically signed and expires in 7 days. If you did not expect this invitation, please contact info@restobird.com.

================================================================================
(c) ${new Date().getFullYear()} Resto Bird Inc. | https://restobird.com | info@restobird.com
`;

  return { subject, html, text };
}

export interface EmployeeOnboardingEmailParams {
  employeeName: string;
  employeeCode: string;
  personalEmail: string;
  restaurantName: string;
  accessToken: string;
  designation?: string | null;
  department?: string | null;
  branding?: {
    applicationName?: string;
    primaryColor?: string;
    logoUrl?: string | null;
    supportEmail?: string | null;
  } | null;
}

/**
 * 2. EMPLOYEE ONBOARDING EMAIL TEMPLATE (WITH RESTAURANT BRANDING)
 */
export function generateEmployeeOnboardingEmail(params: EmployeeOnboardingEmailParams) {
  const baseUrl = getAppBaseUrl();
  const portalUrl = `${baseUrl}/onboarding/portal/${params.accessToken}`;

  const primaryColor = params.branding?.primaryColor || "#0f172a";
  const appName = params.branding?.applicationName || params.restaurantName;
  const logoUrl = params.branding?.logoUrl;
  const supportEmail = params.branding?.supportEmail || "support@bahubali.com";

  const subject = `Welcome to ${params.restaurantName}! Complete your employee onboarding`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
    }
    .wrapper {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: ${primaryColor};
      padding: 35px 30px;
      text-align: center;
      color: #ffffff;
    }
    .brand-logo {
      max-height: 50px;
      margin-bottom: 12px;
    }
    .initials-logo {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.18);
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: #ffffff;
      font-size: 20px;
      font-weight: 900;
      line-height: 52px;
      margin: 0 auto 12px auto;
      text-align: center;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      margin: 0 0 6px 0;
      color: #ffffff;
    }
    .subtitle {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.85);
      margin: 0;
    }
    .content {
      padding: 35px;
      line-height: 1.6;
    }
    .welcome-text {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
    }
    .badge-card {
      background: #f1f5f9;
      border-radius: 16px;
      padding: 20px;
      margin: 24px 0;
      border: 1px solid #e2e8f0;
    }
    .checklist-card {
      background: #f8fafc;
      border-left: 4px solid ${primaryColor};
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 0 12px 12px 0;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 24px 0;
    }
    .btn {
      display: inline-block;
      background-color: ${primaryColor};
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 36px;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.3px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);
    }
    .fallback-link {
      font-size: 11px;
      color: #64748b;
      word-break: break-all;
      background: #f1f5f9;
      padding: 12px;
      border-radius: 8px;
      margin-top: 15px;
      font-family: monospace;
    }
    .footer {
      background: #f8fafc;
      padding: 25px 35px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      ${
        logoUrl
          ? `<img src="${logoUrl}" alt="${appName}" class="brand-logo" />`
          : `<div class="initials-logo">${appName.substring(0, 2).toUpperCase()}</div>`
      }
      <h1 class="title">${appName}</h1>
      <p class="subtitle">Official Employee Onboarding &amp; Profile Setup</p>
    </div>

    <div class="content">
      <h2 class="welcome-text">Hi ${params.employeeName}, welcome to the team! 👋</h2>
      <p style="color: #334155; font-size: 14px;">
        We are thrilled to welcome you to <strong>${params.restaurantName}</strong>. Your employee account has been created in our workforce management portal. Please complete your digital onboarding profile to finalize your joining documents and access your work schedules.
      </p>

      <div class="badge-card">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;">Employee ID:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #0f172a; font-size: 13px; font-family: monospace;">${params.employeeCode}</td>
          </tr>
          ${
            params.designation
              ? `<tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;">Designation / Role:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a; font-size: 13px;">${params.designation}</td>
          </tr>`
              : ""
          }
          ${
            params.department
              ? `<tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;">Department:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a; font-size: 13px;">${params.department}</td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 600;">Registered Email:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #334155; font-size: 13px;">${params.personalEmail}</td>
          </tr>
        </table>
      </div>

      <div class="checklist-card">
        <p style="margin: 0 0 8px 0; font-weight: 700; font-size: 13px; color: #0f172a;">What you'll complete in the portal:</p>
        <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #475569; line-height: 1.6;">
          <li>Verify your personal details &amp; emergency contacts</li>
          <li>Upload identification (Aadhaar / PAN / Photo ID)</li>
          <li>Review workplace health, safety, and operational standards</li>
          <li>Digital signature on employment acknowledgement</li>
        </ul>
      </div>

      <div class="btn-container">
        <a href="${portalUrl}" class="btn">
          Start Your Onboarding &rarr;
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; margin-bottom: 5px;">
        Direct link to your personalized onboarding session:
      </p>
      <div class="fallback-link">${portalUrl}</div>
    </div>

    <div class="footer">
      Need assistance? Contact our HR &amp; Operations desk at <a href="mailto:${supportEmail}" style="color: ${primaryColor}; font-weight: 600;">${supportEmail}</a>.<br>
      &copy; ${new Date().getFullYear()} ${params.restaurantName}. Powered by Resto Bird Intelligent Restaurant Operating System.
    </div>
  </div>
</body>
</html>
`;

  const text = `
Welcome to ${params.restaurantName}!

Hi ${params.employeeName},

Your employee profile has been created at ${params.restaurantName}.

Employee ID: ${params.employeeCode}
Role: ${params.designation || "Staff Member"}
Department: ${params.department || "Operations"}
Email: ${params.personalEmail}

Please access the link below to complete your digital onboarding tasks:
${portalUrl}

If you have questions, please contact ${supportEmail}.
`;

  return { subject, html, text };
}

/**
 * 3. STAFF USER ACCESS & PASSWORD SETUP INVITATION TEMPLATE
 */
export interface StaffAccessEmailParams {
  recipientName: string;
  recipientEmail: string;
  restaurantName: string;
  subdomain: string;
  roleName: string;
  roleDescription?: string | null;
  permissions?: string[];
  outletName?: string | null;
  activationToken: string;
  expiresAt?: Date;
  baseUrl?: string;
}

export interface RoleCapabilityItem {
  title: string;
  description: string;
}

export function resolveRoleCapabilities(
  roleName: string,
  permissions?: string[],
  roleDescription?: string | null
): RoleCapabilityItem[] {
  const items: RoleCapabilityItem[] = [];

  // Step 1: Password setup is universally required for account activation
  items.push({
    title: "Define Secure Password",
    description: "Establish your private master password to activate your personal credentials.",
  });

  const rName = (roleName || "").toLowerCase();
  const perms = new Set((permissions || []).map((p) => p.toLowerCase()));

  // Role categorization flags
  const isExecutive =
    rName.includes("owner") ||
    rName.includes("admin") ||
    rName.includes("general manager") ||
    rName.includes("director") ||
    perms.has("platform:admin");

  const isKitchen =
    rName.includes("chef") ||
    rName.includes("cook") ||
    rName.includes("kitchen") ||
    rName.includes("culinary") ||
    rName.includes("boh") ||
    rName.includes("prep") ||
    perms.has("catering:view") ||
    perms.has("catering:manage_orders");

  const isFrontOfHouse =
    rName.includes("cashier") ||
    rName.includes("server") ||
    rName.includes("waiter") ||
    rName.includes("waitress") ||
    rName.includes("bartender") ||
    rName.includes("foh") ||
    rName.includes("front") ||
    rName.includes("host") ||
    perms.has("pos:view") ||
    perms.has("pos:manage_orders") ||
    perms.has("pos:create_order");

  const isInventoryLead =
    rName.includes("inventory") ||
    rName.includes("store") ||
    rName.includes("procurement") ||
    rName.includes("supply") ||
    rName.includes("stock") ||
    rName.includes("warehouse") ||
    perms.has("inventory:view") ||
    perms.has("inventory:manage") ||
    perms.has("inventory:create_item");

  const isAccountant =
    rName.includes("account") ||
    rName.includes("finan") ||
    rName.includes("controller") ||
    rName.includes("tax") ||
    rName.includes("audit") ||
    rName.includes("billing") ||
    rName.includes("payroll") ||
    perms.has("finance:view") ||
    perms.has("finance:manage") ||
    perms.has("payroll:view");

  const isShiftManager =
    rName.includes("shift") ||
    rName.includes("roster") ||
    rName.includes("supervisor") ||
    rName.includes("floor lead") ||
    perms.has("shifts:manage_roster") ||
    perms.has("shifts:approve_swap");

  const isHR =
    rName.includes("hr") ||
    rName.includes("human resources") ||
    rName.includes("people") ||
    rName.includes("recruiter") ||
    perms.has("hr:view_employees") ||
    perms.has("hr:manage_onboarding");

  if (isExecutive) {
    items.push({
      title: "Comprehensive Workspace Oversight",
      description: "Administer restaurant configuration, branch outlets, user access, and operational standards.",
    });
    items.push({
      title: "Executive Intelligence & Controls",
      description: "Monitor real-time sales telemetry, operational costs, labor margins, and business performance.",
    });
  } else if (isKitchen) {
    items.push({
      title: "Kitchen Station Operations",
      description: "Access recipe master manuals, prep checklists, culinary specifications, and production orders.",
    });
    items.push({
      title: "Station Readiness & Coordination",
      description: "Track live dish prep queues and coordinate recipe execution with dining and dispatch stations.",
    });
  } else if (isInventoryLead) {
    items.push({
      title: "Inventory & Stock Tracking",
      description: "Manage stock item masters, track minimum par thresholds, and record stock usage and wastage.",
    });
    items.push({
      title: "Vendor Purchase Orders",
      description: "Issue supplier purchase orders and verify delivery receipts against item catalogues.",
    });
  } else if (isFrontOfHouse) {
    items.push({
      title: "Dining & POS Terminal Operations",
      description: "Process dine-in and takeaway orders, manage table checks, and handle customer billing.",
    });
    items.push({
      title: "Live Order Dispatch",
      description: "Send orders directly to the kitchen display screen (KDS) and coordinate floor service.",
    });
  } else if (isAccountant) {
    items.push({
      title: "Financial Ledgers & Invoices",
      description: "Review accounts payable, monitor upcoming vendor bills, and audit operational revenue logs.",
    });
    items.push({
      title: "Payroll & Compliance Oversight",
      description: "Access approved payroll cycles, employee pay structures, and compliance summaries.",
    });
  } else if (isShiftManager) {
    items.push({
      title: "Roster Management & Shift Allocations",
      description: "Schedule employee shift rosters, publish duty schedules, and review shift swap requests.",
    });
    items.push({
      title: "Live Attendance Monitoring",
      description: "Review real-time digital punch kiosk records and approve pending staff timesheets.",
    });
  } else if (isHR) {
    items.push({
      title: "Workforce & Staff Profiles",
      description: "Access employee directories, review onboarding documents, and maintain personnel compliance.",
    });
    items.push({
      title: "Department Coordination",
      description: "Manage staff designations, job grades, and outlet assignments.",
    });
  } else {
    // Dynamic fallback matching specific granted permissions or role description
    if (perms.has("inventory:view") || [...perms].some((p) => p.startsWith("inventory:"))) {
      items.push({
        title: "Inventory Management",
        description: "Access inventory catalogs, stock levels, and supply chain records.",
      });
    }
    if (perms.has("pos:view") || [...perms].some((p) => p.startsWith("pos:"))) {
      items.push({
        title: "Point-of-Sale Access",
        description: "Access order terminals, table management, and payment processing.",
      });
    }
    if (perms.has("shifts:view") || [...perms].some((p) => p.startsWith("shifts:"))) {
      items.push({
        title: "Shift Schedules & Rosters",
        description: "View upcoming shift assignments and coordinate availability.",
      });
    }
    if (perms.has("attendance:punch") || [...perms].some((p) => p.startsWith("attendance:"))) {
      items.push({
        title: "Digital Attendance Kiosk",
        description: "Clock in and out using your assigned credentials and track your timesheets.",
      });
    }

    // If still only 1 item (password setup), provide tailored role-specific capability descriptions
    if (items.length === 1) {
      const customDesc =
        roleDescription ||
        `Access tools, workflows, and modules specifically configured for your ${roleName} profile.`;
      items.push({
        title: `${roleName} Operational Access`,
        description: customDesc,
      });
      items.push({
        title: "Branch Collaboration",
        description: "Coordinate with supervisors and team members in your assigned branch in real time.",
      });
    }
  }

  return items;
}

export function generateStaffAccessEmail(params: StaffAccessEmailParams) {
  const baseUrl = (params.baseUrl || getAppBaseUrl()).replace(/\/$/, "");
  const activationUrl = `${baseUrl}/restaurant/${params.subdomain}/activate?token=${params.activationToken}`;
  const expirationText = params.expiresAt
    ? params.expiresAt.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "7 days";

  const capabilities = resolveRoleCapabilities(params.roleName, params.permissions, params.roleDescription);

  const subject = `Welcome to ${params.restaurantName} | Set Up Your Account Password`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #06080d; }
    @media only screen and (max-width: 620px) {
      .email-wrapper { width: 100% !important; border-radius: 0 !important; }
      .content-padding { padding: 24px 20px !important; }
      .header-padding { padding: 28px 20px 22px 20px !important; }
      .cta-button { width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #06080d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1;">
  <div style="background-color: #06080d; padding: 32px 12px;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" class="email-wrapper" style="max-width: 600px; width: 100%; background-color: #0c1017; border: 1px solid #1f2738; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
      
      <!-- Brand Header -->
      <tr>
        <td align="center" class="header-padding" style="background-color: #090d14; border-bottom: 1px solid #1a2233; padding: 36px 32px 28px 32px;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <img src="https://restobird.com/resto-bird-logo.png" alt="Resto Bird" width="160" style="display: block; width: 160px; max-width: 160px; height: auto; margin-bottom: 8px;" />
              </td>
            </tr>
          </table>
          <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 500; letter-spacing: 0.4px;">
            See your restaurant differently
          </p>
          <div style="display: inline-block; margin-top: 16px; padding: 5px 14px; border-radius: 9999px; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.35); color: #60a5fa; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
            DYNAMIC ROLE ACCESS &bull; ${params.roleName.toUpperCase()}
          </div>
        </td>
      </tr>

      <!-- Body Content -->
      <tr>
        <td class="content-padding" style="padding: 36px 32px;">
          <h1 style="margin: 0 0 14px 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.4px; line-height: 1.3;">
            You Have Been Granted Access to ${params.restaurantName}
          </h1>
          
          <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Hello <strong style="color: #ffffff;">${params.recipientName}</strong>,
          </p>

          <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
            You have been invited by the management of <strong style="color: #f1f5f9;">${params.restaurantName}</strong> to access their workspace on Resto Bird. Your account has been provisioned with the tailored role of <strong style="color: #f59e0b;">${params.roleName}</strong>. Please set up your password to activate your access.
          </p>

          <!-- Specifications Card -->
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #111723; border: 1px solid #1e293b; border-radius: 14px; margin-bottom: 28px;">
            <tr>
              <td style="padding: 18px 20px;">
                <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 7px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Restaurant</td>
                    <td align="right" style="padding: 7px 0; color: #ffffff; font-size: 13px; font-weight: 700;">${params.restaurantName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 7px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #1b2434;">Assigned Role</td>
                    <td align="right" style="padding: 7px 0; color: #f59e0b; font-size: 13px; font-weight: 700; border-top: 1px solid #1b2434;">${params.roleName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 7px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #1b2434;">Assigned Outlet</td>
                    <td align="right" style="padding: 7px 0; color: #ffffff; font-size: 13px; font-weight: 600; border-top: 1px solid #1b2434;">${params.outletName || "All Outlets"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 7px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #1b2434;">Login Account</td>
                    <td align="right" style="padding: 7px 0; color: #60a5fa; font-size: 13px; font-weight: 600; border-top: 1px solid #1b2434;">${params.recipientEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding: 7px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #1b2434;">Token Validity</td>
                    <td align="right" style="padding: 7px 0; color: #fbbf24; font-size: 13px; font-weight: 600; border-top: 1px solid #1b2434;">Valid until ${expirationText}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Primary CTA Button -->
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin: 30px 0 32px 0;">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="border-radius: 12px; background: #f59e0b;">
                      <a href="${activationUrl}" target="_blank" class="cta-button" style="display: inline-block; padding: 16px 36px; font-size: 14px; font-weight: 700; color: #000000; text-decoration: none; border-radius: 12px; letter-spacing: 0.3px; background-color: #f59e0b;">
                        Set Up Password &amp; Access Workspace &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Dynamic Role Capabilities Card -->
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #0d121c; border: 1px solid #1a2233; border-radius: 12px; margin-bottom: 26px;">
            <tr>
              <td style="padding: 20px;">
                <div style="color: #f8fafc; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;">
                  What You Can Do Once Activated (${params.roleName})
                </div>
                <table border="0" cellpadding="0" cellspacing="0" style="width: 100%;">
                  ${capabilities
                    .map(
                      (cap, idx) => `
                  <tr>
                    <td valign="top" style="padding-bottom: ${idx === capabilities.length - 1 ? "0" : "12px"}; width: 28px;">
                      <div style="width: 20px; height: 20px; border-radius: 50%; background: #1e293b; color: #f59e0b; text-align: center; font-size: 11px; line-height: 20px; font-weight: 700;">${idx + 1}</div>
                    </td>
                    <td style="padding-bottom: ${idx === capabilities.length - 1 ? "0" : "12px"}; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                      <strong style="color: #f1f5f9;">${cap.title}:</strong> ${cap.description}
                    </td>
                  </tr>
                  `
                    )
                    .join("")}
                </table>
              </td>
            </tr>
          </table>

          <!-- Fallback Direct Link -->
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; line-height: 1.4;">
            If the button does not work in your email client, copy and paste this link into your browser:
          </p>
          <div style="background-color: #090d14; border: 1px solid #1e293b; border-radius: 8px; padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #f59e0b; word-break: break-all; line-height: 1.5; margin-bottom: 22px;">
            ${activationUrl}
          </div>

          <!-- Security Notice Box -->
          <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px;">
            <tr>
              <td style="padding: 12px 16px; color: #93c5fd; font-size: 11px; line-height: 1.5;">
                <strong>Security Guard:</strong> This invitation is cryptographically signed and intended exclusively for ${params.recipientEmail}. It expires in 7 days.
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td align="center" style="background-color: #090d14; border-top: 1px solid #1a2233; padding: 26px 32px; color: #64748b; font-size: 12px; line-height: 1.6;">
          <p style="margin: 0 0 6px 0; color: #94a3b8; font-weight: 600;">
            Resto Bird &bull; Intelligent Restaurant Operating System
          </p>
          <p style="margin: 0 0 10px 0; font-size: 11px; color: #64748b;">
            See your restaurant differently &bull; <a href="https://restobird.com" style="color: #94a3b8; text-decoration: none;">restobird.com</a>
          </p>
          <p style="margin: 0; font-size: 11px; color: #475569;">
            &copy; ${new Date().getFullYear()} Resto Bird Inc. All rights reserved. Generated on behalf of ${params.restaurantName}.
          </p>
        </td>
      </tr>

    </table>
  </div>
</body>
</html>
`;

  const text = `
================================================================================
RESTO BIRD - TEAM ACCESS INVITATION
Welcome to ${params.restaurantName}
================================================================================

Hello ${params.recipientName},

You have been invited by the management of "${params.restaurantName}" to access their workspace on Resto Bird as a ${params.roleName}.

INVITATION DETAILS:
--------------------------------------------------------------------------------
- Restaurant:       ${params.restaurantName}
- Assigned Role:    ${params.roleName}
- Assigned Outlet:  ${params.outletName || "All Outlets"}
- Login Email:      ${params.recipientEmail}
- Valid Until:      ${expirationText}

ACTIVATE YOUR ACCOUNT & SET PASSWORD:
--------------------------------------------------------------------------------
Open the following activation link in your browser:
${activationUrl}

WHAT YOU CAN DO ONCE ACTIVATED (${params.roleName.toUpperCase()}):
--------------------------------------------------------------------------------
${capabilities.map((cap, idx) => `${idx + 1}. ${cap.title}: ${cap.description}`).join("\n")}

SECURITY NOTICE:
This invitation link is cryptographically signed and expires in 7 days.

================================================================================
(c) ${new Date().getFullYear()} Resto Bird Inc. | https://restobird.com
`;

  return { subject, html, text };
}
