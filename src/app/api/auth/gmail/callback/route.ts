import { createAdminClient } from "@/lib/supabase/server";
import { exchangeCode, getProfile } from "@/lib/gmail";
import { encrypt } from "@/lib/encryption";
import { type NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/gmail/callback
 * Receives the authorization code from Google, exchanges it for tokens,
 * encrypts them, and upserts into client_integrations.
 */
export async function GET(request: NextRequest) {
  const tag = "[gmail-callback]";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const fail = (reason: string) => {
    console.error(`${tag} failed: ${reason}`);
    return NextResponse.redirect(`${appUrl}/settings?gmail=error&reason=${reason}`);
  };

  if (error) return fail(`google_denied:${error}`);
  if (!code || !state) return fail("missing_params");

  // Decode & verify CSRF state
  let clientId: string;
  let nonce: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    clientId = decoded.client_id;
    nonce = decoded.nonce;
  } catch {
    return fail("bad_state");
  }

  const cookieNonce = request.cookies.get("gmail_oauth_nonce")?.value;
  if (!cookieNonce || cookieNonce !== nonce) {
    console.warn(`${tag} CSRF nonce mismatch — cookieNonce=${cookieNonce} stateNonce=${nonce}`);
    return fail("csrf");
  }

  const redirectUri = `${appUrl}/api/auth/gmail/callback`;

  // Exchange code → tokens
  let tokens;
  try {
    tokens = await exchangeCode({ code, redirectUri });
  } catch (err) {
    console.error(`${tag} token exchange error`, err);
    return fail("token_exchange");
  }

  // Get Gmail profile (email address + seed historyId for first poll)
  let profile;
  try {
    profile = await getProfile(tokens.access_token);
  } catch (err) {
    console.error(`${tag} getProfile error`, err);
    return fail("profile_fetch");
  }

  // Encrypt sensitive values before storing
  const accessTokenEnc = encrypt(tokens.access_token);
  const refreshTokenEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const supabase = await createAdminClient();
  const { error: upsertErr } = await supabase.from("client_integrations").upsert(
    {
      client_id: clientId,
      provider: "gmail",
      access_token_enc: accessTokenEnc,
      refresh_token_enc: refreshTokenEnc,
      token_expiry: tokenExpiry,
      connected_email: profile.emailAddress,
      gmail_history_id: profile.historyId,
      scope: tokens.scope,
    },
    { onConflict: "client_id,provider" }
  );

  if (upsertErr) {
    console.error(`${tag} DB upsert failed`, upsertErr);
    return fail("db_upsert");
  }

  console.log(
    `${tag} Gmail connected — client=${clientId} email=${profile.emailAddress} historyId=${profile.historyId}`
  );

  const response = NextResponse.redirect(`${appUrl}/settings?gmail=connected`);
  response.cookies.delete("gmail_oauth_nonce");
  return response;
}
