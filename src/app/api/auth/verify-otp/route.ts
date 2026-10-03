import { NextResponse } from "next/server";
import crypto from "crypto";

const SECRET_KEY = process.env.OTP_SECRET_KEY || "wapix_otp_stateless_secret_salt_98471923847";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, otp, token } = body;

    if (!phone || !otp || !token) {
      return NextResponse.json(
        { success: false, error: "Phone number, OTP, and session token are required." },
        { status: 400 }
      );
    }

    const parts = token.split(".");
    if (parts.length !== 2) {
      return NextResponse.json(
        { success: false, error: "Malformed verification token." },
        { status: 400 }
      );
    }

    const [expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(expiresAt)) {
      return NextResponse.json(
        { success: false, error: "Invalid token timestamp." },
        { status: 400 }
      );
    }

    if (Date.now() > expiresAt) {
      return NextResponse.json(
        { success: false, error: "The OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Verify HMAC
    const dataToSign = `${phone.trim()}:${otp.trim()}:${expiresAt}`;
    const expectedHash = crypto.createHmac("sha256", SECRET_KEY).update(dataToSign).digest("hex");

    const expectedBuffer = Buffer.from(expectedHash, "hex");
    const signatureBuffer = Buffer.from(signature, "hex");

    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP code. Please check your WhatsApp and try again." },
        { status: 400 }
      );
    }

    // Verification succeeded
    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully!",
      user: {
        phone: phone.trim(),
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("Error verifying OTP:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: `Verification failed: ${message}` },
      { status: 500 }
    );
  }
}
