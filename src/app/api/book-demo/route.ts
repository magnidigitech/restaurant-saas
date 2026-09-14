import { NextResponse } from "next/server";
import { sendMail } from "@/core/mail/mailer";
import {
  generateBookDemoEmail,
  generateBookDemoUserConfirmationEmail,
} from "@/core/mail/templates";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      fullName,
      restaurantName,
      email,
      country,
      phone,
      outletCount,
      restaurantType,
      currentPos,
      goals,
      notes,
    } = body;

    if (!fullName || !restaurantName || !email) {
      return NextResponse.json(
        { error: "Full Name, Restaurant Name, and Email are required fields." },
        { status: 400 }
      );
    }

    const adminEmailContent = generateBookDemoEmail({
      fullName: String(fullName).trim(),
      restaurantName: String(restaurantName).trim(),
      email: String(email).trim().toLowerCase(),
      country: String(country || "Not specified"),
      phone: String(phone || "Not specified").trim(),
      outletCount: String(outletCount || "1 Outlet").trim(),
      restaurantType: String(restaurantType || "General Restaurant").trim(),
      currentPos: currentPos ? String(currentPos).trim() : undefined,
      goals: Array.isArray(goals) ? goals.map(String) : [],
      notes: notes ? String(notes).trim() : undefined,
      submittedAt: new Date(),
    });

    // Send notification email to getrestobird@gmail.com
    const mailResult = await sendMail({
      to: "getrestobird@gmail.com",
      subject: adminEmailContent.subject,
      html: adminEmailContent.html,
      text: adminEmailContent.text,
    });

    // Optionally send user confirmation email
    try {
      const confirmContent = generateBookDemoUserConfirmationEmail({
        fullName: String(fullName).trim(),
        restaurantName: String(restaurantName).trim(),
        email: String(email).trim().toLowerCase(),
      });
      await sendMail({
        to: String(email).trim().toLowerCase(),
        subject: confirmContent.subject,
        html: confirmContent.html,
        text: confirmContent.text,
      });
    } catch (confirmErr) {
      console.warn("[BookDemo] Prospect confirmation email error:", confirmErr);
    }

    return NextResponse.json({
      success: true,
      message: "Demo request received successfully!",
      simulated: mailResult.simulated,
    });
  } catch (err: any) {
    console.error("[BookDemo] Server error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to submit demo request." },
      { status: 500 }
    );
  }
}
