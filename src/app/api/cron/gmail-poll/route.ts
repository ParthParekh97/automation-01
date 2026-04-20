import { createAdminClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  listHistory,
  listMessages,
  getMessage,
  type IntegrationRow,
  type ParsedEmail,
} from "@/lib/gmail";
import { sendSlackNotification, buildEmailReplyPayload } from "@/lib/slack";
import { upsertEmailConversation } from "@/app/api/email/send/route";
import { markSequenceReplied } from "@/lib/sequence";
import { NextResponse } from "next/server";

const tag = "[gmail-poll]";

/**
 * POST /api/cron/gmail-poll
 * Polls every active Gmail integration for new inbound emails.
 * Should be triggered by a Vercel Cron Job every 5 minutes.
 * Protected by CRON_SECRET env var.
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAdminClient();

  // Kill switch: only poll active clients
  const { data: activeClients } = await supabase
    .from("clients")
    .select("id")
    .eq("active", true);
  const activeClientIds = new Set((activeClients ?? []).map((c) => c.id));

  // Load Gmail integrations for active clients only
  const { data: integrations, error: intErr } = await supabase
    .from("client_integrations")
    .select("*")
    .eq("provider", "gmail");

  if (intErr) {
    console.error(`${tag} failed to load integrations`, intErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const summary: Array<{ client_id: string; processed: number; errors: string[] }> = [];

  // Process each active client sequentially to avoid hammering Google's rate limits
  for (const integration of (integrations ?? []).filter((i) => activeClientIds.has(i.client_id))) {
    const result = await processIntegration(integration as IntegrationRow, supabase);
    summary.push({ client_id: integration.client_id, ...result });
  }

  const totalProcessed = summary.reduce((s, r) => s + r.processed, 0);
  console.log(`${tag} done — ${integrations?.length ?? 0} accounts, ${totalProcessed} new messages`);

  return NextResponse.json({ summary });
}

// ── Process one integration ───────────────────────────────────────────────────

async function processIntegration(
  integration: IntegrationRow,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ processed: number; errors: string[] }> {
  const { client_id } = integration;
  const errors: string[] = [];
  let processed = 0;

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(integration, supabase);
  } catch (err) {
    const msg = `Token error for client ${client_id}: ${String(err)}`;
    console.error(`${tag} ${msg}`);
    return { processed: 0, errors: [msg] };
  }

  // Collect new message IDs via history API, fallback to search if historyId expired
  let newMessageIds: string[] = [];
  let latestHistoryId: string | null = null;

  if (integration.gmail_history_id) {
    const history = await listHistory(accessToken, integration.gmail_history_id).catch(
      (err) => { errors.push(`listHistory: ${String(err)}`); return null; }
    );

    if (history) {
      latestHistoryId = history.historyId;
      newMessageIds = (history.history ?? [])
        .flatMap((h) => h.messagesAdded ?? [])
        .map((m) => m.message.id)
        .filter(Boolean);
      console.log(`${tag} client=${client_id} history returned ${newMessageIds.length} new messages`);
    } else {
      // historyId expired — fall back to unread messages from last 2 days
      console.warn(`${tag} client=${client_id} historyId expired, falling back to search`);
    }
  }

  // Fallback: search for unread inbox messages from the last 2 days
  if (!newMessageIds.length) {
    const refs = await listMessages(accessToken, "is:unread in:inbox newer_than:2d", 50).catch(
      (err) => { errors.push(`listMessages fallback: ${String(err)}`); return []; }
    );
    newMessageIds = refs.map((r) => r.id);
    console.log(`${tag} client=${client_id} fallback search returned ${newMessageIds.length} messages`);
  }

  if (!newMessageIds.length) {
    return { processed: 0, errors };
  }

  // Load all leads for this client so we can match by email address
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, email")
    .eq("client_id", client_id)
    .not("email", "is", null);

  const leadByEmail = new Map<string, { id: string; name: string }>(
    (leads ?? []).map((l: { id: string; name: string; email: string }) => [
      l.email.toLowerCase(),
      { id: l.id, name: l.name },
    ])
  );

  // Process each new message
  for (const msgId of newMessageIds) {
    try {
      await processMessage({
        msgId,
        accessToken,
        clientId: client_id,
        leadByEmail,
        supabase,
      });
      processed++;
    } catch (err) {
      const msg = `processMessage ${msgId}: ${String(err)}`;
      console.error(`${tag} ${msg}`);
      errors.push(msg);
    }
  }

  // Update historyId cursor for next poll
  if (latestHistoryId) {
    await supabase
      .from("client_integrations")
      .update({ gmail_history_id: latestHistoryId })
      .eq("id", integration.id);
  }

  return { processed, errors };
}

// ── Process one inbound message ───────────────────────────────────────────────

async function processMessage(params: {
  msgId: string;
  accessToken: string;
  clientId: string;
  leadByEmail: Map<string, { id: string; name: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const { msgId, accessToken, clientId, leadByEmail, supabase } = params;

  // Skip if already saved (deduplication)
  const { data: existing } = await supabase
    .from("emails")
    .select("id")
    .eq("gmail_message_id", msgId)
    .maybeSingle();
  if (existing) return;

  const email: ParsedEmail = await getMessage(accessToken, msgId);

  // Only process messages from (not sent by) this client
  const senderEmail = email.fromEmail.toLowerCase();
  const lead = leadByEmail.get(senderEmail);
  if (!lead) return; // sender is not a known lead — skip

  console.log(
    `${tag} inbound reply from lead="${lead.name}" subject="${email.subject}" msg=${msgId}`
  );

  const now = new Date().toISOString();

  // Save to emails table
  await supabase.from("emails").insert({
    lead_id: lead.id,
    client_id: clientId,
    subject: email.subject,
    body: email.body || email.snippet,
    status: "delivered",
    sent_at: email.date,
    direction: "inbound",
    gmail_message_id: email.gmailId,
    thread_id: email.threadId,
    from_email: email.fromEmail,
  });

  // Append to email conversation
  const message = {
    id: email.gmailId,
    role: "user" as const,
    content: email.body || email.snippet,
    timestamp: email.date || now,
    metadata: { subject: email.subject, from: email.from },
  };
  await upsertEmailConversation({
    lead_id: lead.id,
    client_id: clientId,
    message,
    supabase,
  });

  // Cancel any active email sequence for this lead — they replied
  markSequenceReplied(lead.id, supabase).catch((err) =>
    console.error(`${tag} markSequenceReplied failed for lead ${lead.id}:`, err)
  );

  // Slack notification
  try {
    await sendSlackNotification(
      buildEmailReplyPayload({
        leadName: lead.name,
        leadEmail: email.fromEmail,
        subject: email.subject,
        snippet: email.snippet,
      })
    );
  } catch (err) {
    console.error(`${tag} Slack notification failed`, err);
  }
}
