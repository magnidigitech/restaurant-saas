import { getAppBaseUrl } from "./mailer";

export interface TenantActivationEmailParams {
  adminName: string;
  adminEmail: string;
  restaurantName: string;
  subdomain: string;
  activationToken: string;
  expiresAt?: Date;
}

export interface EmployeeOnboardingEmailParams {
  employeeName: string;
  employeeCode: string;
  personalEmail: string;
  restaurantName: string;
  department?: string | null;
  designation?: string | null;
  accessToken: string;
  branding?: {
    applicationName?: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    supportEmail?: string | null;
    supportPhone?: string | null;
  } | null;
}

/**
 * 1. TENANT ACTIVATION EMAIL TEMPLATE
 */
export function generateTenantActivationEmail(params: TenantActivationEmailParams) {
  const baseUrl = getAppBaseUrl();
  const activationUrl = `${baseUrl}/activate?token=${params.activationToken}&subdomain=${params.subdomain}`;
  const expirationText = params.expiresAt
    ? params.expiresAt.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "7 days";

  const subject = `Activate your restaurant account: ${params.restaurantName} (Resto Bird)`;

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
      background-color: #f7f4ef;
      color: #1a120b;
    }
    .wrapper {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      border: 1px solid #e8dfc8;
    }
    .header {
      background: linear-gradient(135deg, #1a120b 0%, #2c1e13 100%);
      padding: 40px 30px;
      text-align: center;
      color: #ffffff;
    }
    .badge {
      display: inline-block;
      padding: 5px 14px;
      background: rgba(232, 168, 56, 0.18);
      border: 1px solid #e8a838;
      border-radius: 20px;
      color: #fbd38d;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .title {
      font-size: 26px;
      font-weight: 900;
      margin: 0 0 8px 0;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 14px;
      color: #d6cbba;
      margin: 0;
    }
    .content {
      padding: 35px 35px 25px 35px;
      line-height: 1.6;
    }
    .info-card {
      background: #faf7f2;
      border: 1px solid #ebe2d3;
      border-radius: 14px;
      padding: 20px;
      margin: 24px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px dashed #e2d7c5;
      font-size: 13px;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #786a58;
      font-weight: 600;
    }
    .info-value {
      font-weight: 700;
      color: #1a120b;
    }
    .btn-container {
      text-align: center;
      margin: 35px 0 25px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 36px;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.5px;
      box-shadow: 0 6px 20px rgba(180, 83, 9, 0.3);
    }
    .fallback-link {
      font-size: 11px;
      color: #8c7d6b;
      word-break: break-all;
      background: #f5f2eb;
      padding: 12px;
      border-radius: 8px;
      margin-top: 15px;
      font-family: monospace;
    }
    .footer {
      background: #faf7f2;
      padding: 25px 35px;
      text-align: center;
      font-size: 12px;
      color: #9c8e7c;
      border-top: 1px solid #ebe2d3;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Enterprise Platform</div>
      <h1 class="title">Bahubali Restaurant Suite</h1>
      <p class="subtitle">Next-Generation Multi-Tenant Culinary Operating System</p>
    </div>

    <div class="content">
      <p style="font-size: 16px; margin-top: 0;">
        Hello <strong>${params.adminName}</strong>,
      </p>
      <p style="color: #4a3e31; font-size: 14px;">
        Welcome to the Bahubali platform! Your restaurant organization <strong>${params.restaurantName}</strong> has been provisioned. Click below to activate your administrative privileges and set up your master security password.
      </p>

      <div class="info-card">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #786a58; font-size: 13px; font-weight: 600;">Restaurant Entity:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #1a120b; font-size: 13px;">${params.restaurantName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #786a58; font-size: 13px; font-weight: 600;">Subdomain:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #d97706; font-size: 13px;">${params.subdomain}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #786a58; font-size: 13px; font-weight: 600;">Primary Admin Login:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #1a120b; font-size: 13px;">${params.adminEmail}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #786a58; font-size: 13px; font-weight: 600;">Activation Expiration:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #b45309; font-size: 13px;">Valid until ${expirationText}</td>
          </tr>
        </table>
      </div>

      <div class="btn-container">
        <a href="${activationUrl}" class="btn">
          Activate Restaurant &amp; Set Password &rarr;
        </a>
      </div>

      <p style="font-size: 12px; color: #786a58; margin-bottom: 5px;">
        If the button above does not work, copy and paste this link into your browser:
      </p>
      <div class="fallback-link">${activationUrl}</div>
    </div>

    <div class="footer">
      &copy; ${new Date().getFullYear()} Resto Bird. High-scale restaurant &amp; cloud kitchen operations suite.<br>
      This is a secure system notification intended for ${params.adminEmail}.
    </div>
  </div>
</body>
</html>
`;

  const text = `
Resto Bird - Tenant Activation

Hello ${params.adminName},

Your restaurant account "${params.restaurantName}" has been provisioned on Resto Bird.

Restaurant: ${params.restaurantName}
Subdomain: ${params.subdomain}
Admin Email: ${params.adminEmail}
Valid Until: ${expirationText}

Click the link below to activate your account and configure your password:
${activationUrl}
`;

  return { subject, html, text };
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
      &copy; ${new Date().getFullYear()} ${params.restaurantName}. Powered by Bahubali Restaurant Suite.
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
