import { sendMail } from "./mailer";
import {
  generateTenantActivationEmail,
  generateEmployeeOnboardingEmail,
  generateStaffAccessEmail,
  TenantActivationEmailParams,
  EmployeeOnboardingEmailParams,
  StaffAccessEmailParams,
} from "./templates";

export * from "./mailer";
export * from "./templates";

/**
 * High-level helper: Send Tenant Activation Email
 */
export async function sendTenantActivationEmail(params: TenantActivationEmailParams) {
  const { subject, html, text } = generateTenantActivationEmail(params);
  return sendMail({
    to: params.adminEmail,
    subject,
    html,
    text,
  });
}

/**
 * High-level helper: Send Employee Onboarding Email with Restaurant Branding
 */
export async function sendEmployeeOnboardingEmail(params: EmployeeOnboardingEmailParams) {
  if (!params.personalEmail) {
    return { success: false, error: "No personal email provided for employee" };
  }
  const { subject, html, text } = generateEmployeeOnboardingEmail(params);
  return sendMail({
    to: params.personalEmail,
    subject,
    html,
    text,
  });
}

/**
 * High-level helper: Send Staff Access & Set Password Email
 */
export async function sendStaffAccessEmail(params: StaffAccessEmailParams) {
  if (!params.recipientEmail) {
    return { success: false, error: "No recipient email provided" };
  }
  const { subject, html, text } = generateStaffAccessEmail(params);
  return sendMail({
    to: params.recipientEmail,
    subject,
    html,
    text,
  });
}
