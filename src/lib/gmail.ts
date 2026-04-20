import { encrypt, decrypt } from "@/lib/encryption";
import type { SupabaseClient } from "@supabase/supabase-js";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ── Scopes ──────────────────────────────────────────────────────────────────
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// ── Public types ─────────────────────────────────────────────────────────────

export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface GmailProfile {
  emailAddress: string;
  historyId: string;
  messagesTotal: number;
  threadsTotal: number;
}

export interface ParsedEmail {
  gmailId: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  labelIds: string[];
  inReplyTo: string | null;
  references: string | null;
}

export interface GmailMessageRef {
  id: string;
  threadId: string;
}

export interface HistoryResult {
  history?: Array<{
    id: string;
    messagesAdded?: Array<{ message: GmailMessageRef }>;
  }>;
  historyId: string;
  nextPageToken?: string;
}

// DB row shape (subset we need)
export interface IntegrationRow {
  id: string;
  client_id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expiry: string | null;
  connected_email: string | null;
  gmail_history_id: string | null;
}

// ── OAuth helpers ────────────────────────────────────────────────────────────

export function buildOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES);
  url.searchParams.set("state", params.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // forces refresh_token on every auth
  return url.toString();
}

export async function exchangeCode(params: {
  code: string;
  redirectUri: string;
}): Promise<GmailTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Code exchange failed: HTTP ${res.status} — ${await res.text()}`);
  return res.json() as Promise<GmailTokens>;
}

async function doRefresh(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: HTTP ${res.status} — ${await res.text()}`);
  return res.json();
}

// ── Token management ─────────────────────────────────────────────────────────

/**
 * Returns a valid (non-expired) access token.
 * Refreshes automatically and patches the DB row when needed.
 */
export async function getValidAccessToken(
  integration: IntegrationRow,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<string> {
  const expiry = integration.token_expiry ? new Date(integration.token_expiry) : null;
  const needsRefresh = !expiry || expiry <= new Date(Date.now() + 5 * 60 * 1000);

  if (!needsRefresh) {
    return decrypt(integration.access_token_enc);
  }

  if (!integration.refresh_token_enc) {
    throw new Error("No refresh token — client must reconnect Gmail");
  }

  const refreshed = await doRefresh(decrypt(integration.refresh_token_enc));

  await supabase
    .from("client_integrations")
    .update({
      access_token_enc: encrypt(refreshed.access_token),
      token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq("id", integration.id);

  return refreshed.access_token;
}

// ── Gmail API calls ──────────────────────────────────────────────────────────

export async function getProfile(accessToken: string): Promise<GmailProfile> {
  const res = await fetch(`${GMAIL_BASE}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`getProfile failed: HTTP ${res.status}`);
  return res.json() as Promise<GmailProfile>;
}

// Build a base64url-encoded RFC-2822 MIME message
function buildRawMime(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const headers: string[] = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
  ];
  if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) headers.push(`References: ${params.references}`);
  headers.push(""); // blank line — separates headers from body
  headers.push(params.html);
  return Buffer.from(headers.join("\r\n")).toString("base64url");
}

export async function sendEmail(
  accessToken: string,
  params: {
    from: string;
    to: string;
    subject: string;
    html: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string;
  }
): Promise<{ id: string; threadId: string }> {
  const body: Record<string, string> = { raw: buildRawMime(params) };
  if (params.threadId) body.threadId = params.threadId;

  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gmail send failed: HTTP ${res.status} — ${await res.text()}`);
  return res.json() as Promise<{ id: string; threadId: string }>;
}

// ── Message parsing ──────────────────────────────────────────────────────────

interface GmailPart {
  mimeType: string;
  body?: { data?: string; size: number };
  parts?: GmailPart[];
}

function extractBody(part: GmailPart): string {
  if (part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  if (part.parts) {
    for (const p of part.parts) {
      if (p.mimeType === "text/plain" && p.body?.data)
        return Buffer.from(p.body.data, "base64url").toString("utf8");
    }
    for (const p of part.parts) {
      if (p.mimeType === "text/html" && p.body?.data)
        return Buffer.from(p.body.data, "base64url").toString("utf8");
    }
    for (const p of part.parts) {
      const nested = extractBody(p);
      if (nested) return nested;
    }
  }
  return "";
}

function header(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractAddress(value: string): string {
  return value.match(/<([^>]+)>/)?.[1] ?? value.trim();
}

interface RawGmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string; size: number };
    parts?: GmailPart[];
  };
}

export function parseMessage(raw: RawGmailMessage): ParsedEmail {
  const h = raw.payload.headers;
  const from = header(h, "From");
  const dateStr = header(h, "Date");
  return {
    gmailId: raw.id,
    threadId: raw.threadId,
    from,
    fromEmail: extractAddress(from),
    to: header(h, "To"),
    subject: header(h, "Subject"),
    snippet: raw.snippet,
    body: extractBody(raw.payload as GmailPart),
    date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
    labelIds: raw.labelIds ?? [],
    inReplyTo: header(h, "In-Reply-To") || null,
    references: header(h, "References") || null,
  };
}

export async function getMessage(accessToken: string, id: string): Promise<ParsedEmail> {
  const res = await fetch(`${GMAIL_BASE}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`getMessage failed: HTTP ${res.status}`);
  return parseMessage((await res.json()) as RawGmailMessage);
}

export async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 25
): Promise<GmailMessageRef[]> {
  const url = new URL(`${GMAIL_BASE}/messages`);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`listMessages failed: HTTP ${res.status}`);
  const data = (await res.json()) as { messages?: GmailMessageRef[] };
  return data.messages ?? [];
}

/**
 * Returns messages added since startHistoryId, or null if the historyId
 * has expired (Google only retains history for ~7 days).
 */
export async function listHistory(
  accessToken: string,
  startHistoryId: string
): Promise<HistoryResult | null> {
  const url = new URL(`${GMAIL_BASE}/history`);
  url.searchParams.set("startHistoryId", startHistoryId);
  url.searchParams.set("historyTypes", "messageAdded");
  url.searchParams.set("labelId", "INBOX");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null; // historyId too old — caller should fall back
  if (!res.ok) throw new Error(`listHistory failed: HTTP ${res.status}`);
  return res.json() as Promise<HistoryResult>;
}
