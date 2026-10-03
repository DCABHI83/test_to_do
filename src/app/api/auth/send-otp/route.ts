import { NextResponse } from "next/server";
import crypto from "crypto";

const WAPIX_API_URL = "https://api.wapix.sbs/api/v1/send/otp";
const SECRET_KEY = process.env.OTP_SECRET_KEY || "wapix_otp_stateless_secret_salt_98471923847";
const WAPIX_API_KEY = process.env.WAPIX_API_KEY || "WAPIX.2.9cvEKO1k";

// Normalize phone number to international format without leading + or 00
function normalizePhoneNumber(rawNumber: string, countryCode: string = "91"): string {
  // Strip all non-digit characters
  let cleaned = rawNumber.replace(/\D/g, "");

  // If user included leading zeros, remove them
  cleaned = cleaned.replace(/^0+/, "");

  // If number is standard 10 digits (common in India and many countries), prepend country code
  if (cleaned.length === 10) {
    cleaned = `${countryCode.replace(/\D/g, "")}${cleaned}`;
  }

  return cleaned;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, countryCode = "91" } = body;

    if (!phone || typeof phone !== "string" || phone.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid phone number." },
        { status: 400 }
      );
    }

    const formattedNumber = normalizePhoneNumber(phone, countryCode);

    if (formattedNumber.length < 10 || formattedNumber.length > 15) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number length with country code." },
        { status: 400 }
      );
    }

    // Generate a secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    // Generate HMAC signature for stateless verification without DB
    const dataToSign = `${formattedNumber}:${otp}:${expiresAt}`;
    const hash = crypto.createHmac("sha256", SECRET_KEY).update(dataToSign).digest("hex");
    const token = `${expiresAt}.${hash}`;

    // Call Wapix REST API
    const response = await fetch(WAPIX_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service: "otp",
        whatsaap_number: formattedNumber,
        otp: otp,
        text: "Your Wapix To-Do verification code is:",
        api_key: WAPIX_API_KEY,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success) {
      const errorMessage =
        data?.message ||
        data?.error ||
        `Wapix Gateway responded with status ${response.status}`;

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: data,
        },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `OTP sent successfully to WhatsApp (+${formattedNumber})!`,
      token,
      phone: formattedNumber,
      expiresAt,
      // Include debug OTP helper in local development for smooth testing
      debugOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (error: unknown) {
    console.error("Error sending OTP via Wapix:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: `Failed to dispatch OTP: ${message}` },
      { status: 500 }
    );
  }
}
