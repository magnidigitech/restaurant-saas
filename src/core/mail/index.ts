import { sendMail } from "./mailer";
import {
  generateTenantActivationEmail,
  generateEmployeeOnboardingEmail,
  TenantActivationEmailParams,
  EmployeeOnboardingEmailParams,
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
