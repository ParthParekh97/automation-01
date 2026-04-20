import { createAdminClient } from "@/lib/supabase/server";
import { generateSequenceEmail } from "@/lib/claude";
import { getValidAccessToken, sendEmail } from "@/lib/gmail";

type SupabaseAdmin = Awaited<ReturnType<typeof createAdminClient>>;

const STEP_DELAYS_MS: Record<number, number> = {
  1: 0,                          // step 1: send immediately
  2: 3 * 24 * 60 * 60 * 1000,   // step 2: 3 days after step 1
  3: 7 * 24 * 60 * 60 * 1000,   // step 3: 7 days after step 2
};

// ── Start ────────────────────────────────────────────────────────────────────

/**
 * Creates a new active sequence for a lead.
 * next_send_at = NOW() so the cron picks it up immediately for email 1.
 */
export async function startSequence(
  leadId: string,
  clientId: string,
  supabase: SupabaseAdmin
): Promise<void> {
  // Don't start a duplicate if one is already running
  const { data: existing } = await supabase
    .from("email_sequences")
    .select("id")
    .eq("lead_id", leadId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) return;

  await supabase.from("email_sequences").insert({
    lead_id: leadId,
    client_id: clientId,
    status: "active",
    current_step: 0,
    next_send_at: new Date().toISOString(),
    replied: false,
  });
}

// ── Cancel / complete ────────────────────────────────────────────────────────

export async function cancelSequence(
  sequenceId: string,
  reason: string,
  supabase: SupabaseAdmin
): Promise<void> {
  await supabase
    .from("email_sequences")
    .update({ status: "cancelled", cancelled_reason: reason, next_send_at: null })
    .eq("id", sequenceId);
}

export async function markSequenceReplied(
  leadId: string,
  supabase: SupabaseAdmin
): Promise<void> {
  await supabase
    .from("email_sequences")
    .update({ replied: true, status: "cancelled", cancelled_reason: "lead_replied", next_send_at: null })
    .eq("lead_id", leadId)
    .eq("status", "active");
}

// ── Process a single sequence row ────────────────────────────────────────────

interface SequenceRow {
  id: string;
  lead_id: string;
  client_id: string;
  current_step: number;
  thread_id: string | null;
  last_email_id: string | null;
}

export async function processSequence(
  seq: SequenceRow,
  supabase: SupabaseAdmin
): Promise<{ ok: boolean; error?: string }> {
  const nextStep = (seq.current_step + 1) as 1 | 2 | 3;

  if (nextStep > 3) {
    // All steps sent — mark complete
    await supabase
      .from("email_sequences")
      .update({ status: "completed", completed_at: new Date().toISOString(), next_send_at: null })
      .eq("id", seq.id);
    return { ok: true };
  }

  // Fetch lead
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, client_id")
    .eq("id", seq.lead_id)
    .single();

  if (!lead?.email) {
    await cancelSequence(seq.id, "no_lead_email", supabase);
    return { ok: false, error: "Lead has no email address" };
  }

  // Fetch client (name, service_type, booking_link)
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, service_type, booking_link")
    .eq("id", seq.client_id)
    .single();

  if (!client) {
    await cancelSequence(seq.id, "client_not_found", supabase);
    return { ok: false, error: "Client not found" };
  }

  // Fetch Gmail integration
  const { data: integration } = await supabase
    .from("client_integrations")
    .select("*")
    .eq("client_id", seq.client_id)
    .eq("provider", "gmail")
    .single();

  if (!integration) {
    await cancelSequence(seq.id, "no_gmail_integration", supabase);
    return { ok: false, error: "Gmail not connected for client" };
  }

  // Get valid access token
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(integration, supabase);
  } catch (err) {
    return { ok: false, error: `Token refresh failed: ${err}` };
  }

  // Generate email content via Claude
  let generated: { subject: string; html: string };
  try {
    generated = await generateSequenceEmail({
      step: nextStep,
      leadName: lead.name,
      businessName: client.name,
      serviceType: client.service_type ?? "our services",
      bookingLink: client.booking_link ?? "",
    });
  } catch (err) {
    return { ok: false, error: `Claude generation failed: ${err}` };
  }

  // Send via Gmail (thread all follow-ups together)
  let sent: { id: string; threadId: string };
  try {
    sent = await sendEmail(accessToken, {
      from: integration.connected_email!,
      to: lead.email,
      subject: generated.subject,
      html: generated.html,
      threadId: seq.thread_id ?? undefined,
      inReplyTo: seq.last_email_id ?? undefined,
      references: seq.last_email_id ?? undefined,
    });
  } catch (err) {
    return { ok: false, error: `Gmail send failed: ${err}` };
  }

  const now = new Date();

  // Save email record
  await supabase.from("emails").insert({
    lead_id: seq.lead_id,
    client_id: seq.client_id,
    subject: generated.subject,
    body: generated.html,
    status: "sent",
    sent_at: now.toISOString(),
    direction: "outbound",
    gmail_message_id: sent.id,
    thread_id: sent.threadId,
    from_email: integration.connected_email,
  });

  // Compute next_send_at for the following step (null if this was the last)
  const followUpStep = nextStep + 1;
  const delayMs = STEP_DELAYS_MS[followUpStep];
  const nextSendAt =
    followUpStep <= 3 && delayMs !== undefined
      ? new Date(now.getTime() + delayMs).toISOString()
      : null;

  // Advance sequence state
  await supabase
    .from("email_sequences")
    .update({
      current_step: nextStep,
      thread_id: sent.threadId,
      last_email_id: sent.id,
      next_send_at: nextSendAt,
      status: nextSendAt ? "active" : "completed",
      completed_at: nextSendAt ? null : now.toISOString(),
    })
    .eq("id", seq.id);

  return { ok: true };
}
