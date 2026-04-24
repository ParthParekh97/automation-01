import { createPureAdminClient } from "@/lib/supabase/server";
import { getValidAccessToken, sendEmail } from "@/lib/gmail";
import { NextResponse } from "next/server";

const VALID_STATUSES = [
  "new", "contacted", "qualified", "proposal", "booked", "closed_won", "closed_lost",
] as const;

type LeadStatus = (typeof VALID_STATUSES)[number];

// ── Route ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status, old_status } = body as { status?: string; old_status?: string };
  if (!status || !VALID_STATUSES.includes(status as LeadStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = createPureAdminClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id)
    .select("id, name, email, client_id, status")
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: error?.message ?? "Lead not found" }, { status: 404 });
  }

  // Log status change to lead_notes for the timeline
  if (old_status && old_status !== status) {
    supabase.from("lead_notes").insert({
      lead_id: lead.id,
      client_id: lead.client_id,
      type: "status_change",
      content: `Status changed from "${old_status.replace(/_/g, " ")}" to "${status.replace(/_/g, " ")}"`,
      metadata: { from: old_status, to: status },
    }).then().catch((err) => console.error("[status-route] note insert failed", err));
  }

  // Fire automation non-blocking — response returns immediately
  fireAutomation(lead.id, status as LeadStatus, supabase).catch((err) =>
    console.error("[pipeline:automation]", err)
  );

  return NextResponse.json({ ok: true, status });
}

// ── Automations ───────────────────────────────────────────────────────────────

type SupabaseAdmin = ReturnType<typeof createPureAdminClient>;

async function fireAutomation(
  leadId: string,
  newStatus: LeadStatus,
  supabase: SupabaseAdmin
): Promise<void> {
  if (newStatus !== "qualified" && newStatus !== "closed_won") return;

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, client_id")
    .eq("id", leadId)
    .single();

  if (!lead?.email) return;

  const [{ data: integration }, { data: client }] = await Promise.all([
    supabase
      .from("client_integrations")
      .select("*")
      .eq("client_id", lead.client_id)
      .eq("provider", "gmail")
      .single(),
    supabase
      .from("clients")
      .select("name, service_type")
      .eq("id", lead.client_id)
      .single(),
  ]);

  if (!integration || !client) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const prompt =
    newStatus === "qualified"
      ? `Write a short, warm appointment confirmation email to ${lead.name} from ${client.name}${client.service_type ? ` (${client.service_type})` : ""}. Confirm the appointment is set, express excitement about meeting them, and say you'll follow up with details soon. Under 120 words.`
      : `Write a short, warm welcome email to ${lead.name} from ${client.name}. Welcome them as a new client, express excitement about working together, and set expectations for next steps. Under 120 words.`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system:
        'You are an expert email copywriter. Return ONLY valid JSON: {"subject": "...", "html": "<p>...</p>"}. No markdown, no explanation.',
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeRes.ok) return;

  const claudeData = await claudeRes.json();
  const raw: string = claudeData.content?.[0]?.text ?? "";

  let generated: { subject: string; html: string };
  try {
    generated = JSON.parse(raw);
    if (!generated.subject || !generated.html) return;
  } catch {
    return;
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(integration, supabase);
  } catch {
    return;
  }

  let sent: { id: string; threadId: string };
  try {
    sent = await sendEmail(accessToken, {
      from: integration.connected_email!,
      to: lead.email,
      subject: generated.subject,
      html: generated.html,
    });
  } catch {
    return;
  }

  await supabase.from("emails").insert({
    lead_id: lead.id,
    client_id: lead.client_id,
    subject: generated.subject,
    body: generated.html,
    status: "sent",
    sent_at: new Date().toISOString(),
    direction: "outbound",
    gmail_message_id: sent.id,
    thread_id: sent.threadId,
    from_email: integration.connected_email,
  });

  console.log(
    `[pipeline:automation] ${newStatus} email sent to ${lead.email} (${lead.name})`
  );
}
