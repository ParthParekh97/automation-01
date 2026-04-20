import { createClient } from "@/lib/supabase/server";
import { buildOAuthUrl } from "@/lib/gmail";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * GET /api/auth/gmail
 * Initiates the Google OAuth flow for the currently authenticated client.
 * Stores a CSRF nonce in a short-lived cookie, then redirects to Google.
 */
export async function GET() {
  const tag = "[gmail-oauth-start]";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(
    JSON.stringify({ client_id: user.id, nonce })
  ).toString("base64url");

  const redirectUri = `${appUrl}/api/auth/gmail/callback`;
  const oauthUrl = buildOAuthUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    redirectUri,
    state,
  });

  console.log(`${tag} starting OAuth for client=${user.id}`);

  const response = NextResponse.redirect(oauthUrl);
  response.cookies.set("gmail_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — more than enough for OAuth round-trip
    path: "/",
  });
  return response;
}
