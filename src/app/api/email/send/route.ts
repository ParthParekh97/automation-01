import { createPureAdminClient } from "@/lib/supabase/server";
import { sendEmail, getValidAccessToken } from "@/lib/gmail";
import { NextResponse } from "next/server";
import { z } from "zod";

const tag = "[email-send]";

const schema = z.object({
  lead_id: z.string().uuid(),
  client_id: z.string().uuid(),
  subject: z.string().min(1),
  body: z.string().min(1),           // HTML or plain text
  thread_id: z.string().optional(),  // supply to keep the Gmail thread together
  in_reply_to: z.string().optional(),
});

/**
 * POST /api/email/send
 * Sends an email to a lead using the client's connected Gmail account.
 * Saves the message to the emails and conversations tables.
 */
export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { lead_id, client_id, subject, body, thread_id, in_reply_to } = parsed.data;
  const supabase = createPureAdminClient();

  // Fetch lead
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, client_id")
    .eq("id", lead_id)
    .eq("client_id", client_id)
    .single();

  if (!lead?.email) {
    return NextResponse.json({ error: "Lead not found or has no email address" }, { status: 422 });
  }

  // Fetch Gmail integration
  const { data: integration } = await supabase
    .from("client_integrations")
    .select("*")
    .eq("client_id", client_id)
    .eq("provider", "gmail")
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Gmail not connected — visit /settings to connect" }, { status: 422 });
  }

  // Get a valid (auto-refreshed) access token
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(integration, supabase);
  } catch (err) {
    console.error(`${tag} token error`, err);
    return NextResponse.json({ error: "Gmail token invalid — please reconnect" }, { status: 401 });
  }

  // Send via Gmail API
  let sent: { id: string; threadId: string };
  try {
    sent = await sendEmail(accessToken, {
      from: integration.connected_email!,
      to: lead.email,
      subject,
      html: body,
      threadId: thread_id,
      inReplyTo: in_reply_to,
      references: in_reply_to,
    });
  } catch (err) {
    console.error(`${tag} Gmail API error`, err);
    return NextResponse.json({ error: "Failed to send via Gmail" }, { status: 502 });
  }

  const now = new Date().toISOString();

  // Persist to emails table
  const { data: emailRecord, error: emailErr } = await supabase
    .from("emails")
    .insert({
      lead_id,
      client_id,
      subject,
      body,
      status: "sent",
      sent_at: now,
      direction: "outbound",
      gmail_message_id: sent.id,
      thread_id: sent.threadId,
      from_email: integration.connected_email,
    })
    .select("id")
    .single();

  if (emailErr) console.error(`${tag} email record insert error`, emailErr);

  // Upsert into conversations (email channel) — append message to JSONB array
  const message = {
    id: sent.id,
    role: "assistant" as const,
    content: body,
    timestamp: now,
    metadata: { subject, from: integration.connected_email ?? "" },
  };

  await upsertEmailConversation({ lead_id, client_id, message, supabase });

  console.log(`${tag} sent to ${lead.email} gmail_id=${sent.id} thread=${sent.threadId}`);

  return NextResponse.json({
    email_id: emailRecord?.id ?? null,
    gmail_message_id: sent.id,
    thread_id: sent.threadId,
  });
}

// ── Shared helper (also used by poll route) ──────────────────────────────────

interface ConvMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

export async function upsertEmailConversation(params: {
  lead_id: string;
  client_id: string;
  message: ConvMessage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createPureAdminClient>;
}) {
  const { lead_id, client_id, message, supabase } = params;

  const { data: existing } = await supabase
    .from("conversations")
    .select("id, messages")
    .eq("lead_id", lead_id)
    .eq("client_id", client_id)
    .eq("channel", "email")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const msgs = [...((existing.messages as unknown[]) ?? []), message];
    await supabase.from("conversations").update({ messages: msgs }).eq("id", existing.id);
  } else {
    await supabase.from("conversations").insert({
      lead_id,
      client_id,
      channel: "email",
      messages: [message],
    });
  }
}
