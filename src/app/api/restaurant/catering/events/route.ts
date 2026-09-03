import { NextRequest, NextResponse } from "next/server";
import {
  getRegisteredEvent,
  saveRegisteredEvent,
  listRegisteredEvents,
  getCustomTemplates,
  saveCustomTemplate,
  RegisteredCateringEvent,
} from "@/modules/catering/eventStore";
import { SmartMenuTemplate } from "@/modules/catering/types";
import { SMART_MENU_TEMPLATES } from "@/modules/catering/templatesData";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const subdomain = searchParams.get("subdomain") || "bahubali";

    if (token) {
      const event = getRegisteredEvent(token);
      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      return NextResponse.json({ event });
    }

    const events = listRegisteredEvents(subdomain);
    const templates = getCustomTemplates();
    return NextResponse.json({ events, templates });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch event data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Action 1: Register Audience / Event and Generate Shareable Customer Link
    if (action === "REGISTER_EVENT") {
      const {
        subdomain = "bahubali",
        eventDetails,
        template,
      } = body;

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const year = new Date().getFullYear();
      const token = body.token || body.id || `EVT-${year}-${randomSuffix}`;
      const customerSelectionLink = `/restaurant/${subdomain}/catering/portal/${token}`;

      const newEvent: RegisteredCateringEvent = {
        id: token,
        restaurantSubdomain: subdomain,
        eventDetails,
        templateId: template?.id || "wedding-lunch-premium",
        template: template || SMART_MENU_TEMPLATES[0],
        customerSelectionLink,
        status: "LINK_SHARED",
        selectedItemIds: [],
        selectedAddonIds: [],
        createdAt: new Date().toISOString(),
      };

      saveRegisteredEvent(newEvent);
      return NextResponse.json({
        success: true,
        event: newEvent,
        customerSelectionLink,
        token,
      });
    }

    // Action 2: Build and Save Custom Template
    if (action === "SAVE_CUSTOM_TEMPLATE") {
      const { template } = body;
      if (!template || !template.name) {
        return NextResponse.json({ error: "Invalid template payload" }, { status: 400 });
      }

      saveCustomTemplate(template as SmartMenuTemplate);
      return NextResponse.json({ success: true, template });
    }

    // Action 3: Customer Submits Menu Choices from Public Portal
    if (action === "CUSTOMER_SUBMIT_MENU") {
      const { token, selectedItemIds, selectedAddonIds, clientNotes } = body;
      const existing = getRegisteredEvent(token);
      if (!existing) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      existing.selectedItemIds = selectedItemIds;
      existing.selectedAddonIds = selectedAddonIds;
      existing.status = "CUSTOMER_SUBMITTED";
      existing.submittedAt = new Date().toISOString();
      if (clientNotes) {
        existing.eventDetails.notes = (existing.eventDetails.notes ? existing.eventDetails.notes + "\n\n" : "") + "Customer Note: " + clientNotes;
      }

      saveRegisteredEvent(existing);
      return NextResponse.json({ success: true, event: existing });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process event request" },
      { status: 500 }
    );
  }
}
