import { createPureAdminClient } from "@/lib/supabase/server";
import { getValidAccessToken, listMessages, getMessage } from "@/lib/gmail";
import { NextResponse } from "next/server";

const tag = "[email-inbox]";

/**
 * GET /api/email/inbox?lead_id=xxx&client_id=xxx&max=20
 * Pulls Gmail messages from/to the lead's email address in real time.
 * Does NOT persist — use this for the "refresh inbox" action in the UI.
 * The cron poll handles persistence + notifications.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lead_id = searchParams.get("lead_id");
  const client_id = searchParams.get("client_id");
  const max = Math.min(parseInt(searchParams.get("max") ?? "20", 10), 50);

  if (!lead_id || !client_id) {
    return NextResponse.json({ error: "lead_id and client_id are required" }, { status: 400 });
  }

  const supabase = createPureAdminClient();

  // Get lead email
  const { data: lead } = await supabase
    .from("leads")
    .select("id, email")
    .eq("id", lead_id)
    .eq("client_id", client_id)
    .single();

  if (!lead?.email) {
    return NextResponse.json({ error: "Lead not found or has no email" }, { status: 404 });
  }

  // Get Gmail integration
  const { data: integration } = await supabase
    .from("client_integrations")
    .select("*")
    .eq("client_id", client_id)
    .eq("provider", "gmail")
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 422 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(integration, supabase);
  } catch (err) {
    console.error(`${tag} token error`, err);
    return NextResponse.json({ error: "Gmail token invalid" }, { status: 401 });
  }

  // Search Gmail: all threads that involve this lead's email address
  const query = `from:${lead.email} OR to:${lead.email}`;
  let refs;
  try {
    refs = await listMessages(accessToken, query, max);
  } catch (err) {
    console.error(`${tag} listMessages error`, err);
    return NextResponse.json({ error: "Gmail API error" }, { status: 502 });
  }

  if (!refs.length) {
    return NextResponse.json([]);
  }

  // Fetch each message in parallel (cap at max)
  const messages = await Promise.allSettled(
    refs.map((ref) => getMessage(accessToken, ref.id))
  );

  const results = messages
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof getMessage>>>).value);

  console.log(`${tag} fetched ${results.length} messages for lead=${lead_id}`);

  return NextResponse.json(results);
}
