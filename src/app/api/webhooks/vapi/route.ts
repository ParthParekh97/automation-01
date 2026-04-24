import { createPureAdminClient } from "@/lib/supabase/server";
import { sendSlackNotification, buildCallSummaryPayload } from "@/lib/slack";
import { NextResponse } from "next/server";
import type { CallOutcome, LeadStatus } from "@/types/database";

// ---------------------------------------------------------------------------
// Vapi payload types
// ---------------------------------------------------------------------------

interface VapiCustomer {
  number?: string;
  name?: string;
}

interface VapiCall {
  id: string;
  customer?: VapiCustomer;
  /** Pass client_id here when initiating the call via the Vapi API */
  metadata?: Record<string, string>;
}

interface VapiArtifact {
  transcript?: string;
  recordingUrl?: string;
}

interface VapiAnalysis {
  summary?: string;
  structuredData?: {
    /** Your Vapi assistant should be configured to extract this field */
    outcome?: string;
    [key: string]: unknown;
  };
  successEvaluation?: string;
}

interface VapiEndOfCallMessage {
  type: "end-of-call-report";
  endedReason?: string;
  durationSeconds?: number;
  transcript?: string;
  call: VapiCall;
  artifact?: VapiArtifact;
  analysis?: VapiAnalysis;
}

interface VapiWebhookBody {
  message: VapiEndOfCallMessage | { type: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip non-digits and normalise to E.164 (+1XXXXXXXXXX for NA numbers) */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Map Vapi analysis + endedReason to our CallOutcome enum.
 * Priority: structuredData.outcome → endedReason → "other"
 */
function resolveOutcome(msg: VapiEndOfCallMessage): CallOutcome {
  const raw = msg.analysis?.structuredData?.outcome?.toLowerCase() ?? "";

  const structuredMap: Record<string, CallOutcome> = {
    booked: "booked",
    book: "booked",
    appointment: "booked",
    not_interested: "not_interested",
    "not interested": "not_interested",
    uninterested: "not_interested",
    no_answer: "no_answer",
    "no answer": "no_answer",
    voicemail: "voicemail",
    callback: "callback",
    "call back": "callback",
    interested: "interested",
  };

  if (raw && structuredMap[raw]) return structuredMap[raw];

  const endedReasonMap: Record<string, CallOutcome> = {
    "customer-did-not-answer": "no_answer",
    "no-answer": "no_answer",
    voicemail: "voicemail",
    "customer-busy": "callback",
    "assistant-ended-call": "interested",
    "customer-ended-call": "interested",
    "pipeline-error": "other",
    "silence-timed-out": "no_answer",
  };

  return endedReasonMap[msg.endedReason ?? ""] ?? "other";
}

// ---------------------------------------------------------------------------
// Request signature verification
// ---------------------------------------------------------------------------

function verifySecret(request: Request): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return true; // skip verification when not configured

  const incoming = request.headers.get("x-vapi-secret");
  return incoming === secret;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const tag = "[vapi-webhook]";

  // 1. Signature check
  if (!verifySecret(request)) {
    console.warn(`${tag} rejected — invalid x-vapi-secret`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: VapiWebhookBody;
  try {
    body = await request.json();
  } catch (err) {
    console.error(`${tag} failed to parse JSON body`, err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log(`${tag} received message type: ${body.message?.type}`);

  // 3. Only process end-of-call-report events; ack everything else
  if (body.message?.type !== "end-of-call-report") {
    return NextResponse.json({ received: true });
  }

  const msg = body.message as VapiEndOfCallMessage;

  // 4. Extract core fields
  const rawPhone = msg.call?.customer?.number ?? "";
  const callerName = msg.call?.customer?.name ?? "Unknown Caller";
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const durationSeconds = Math.round(msg.durationSeconds ?? 0);
  const transcript = msg.artifact?.transcript ?? msg.transcript ?? null;
  const recordingUrl = msg.artifact?.recordingUrl ?? null;
  const outcome = resolveOutcome(msg);
  const vapiCallId = msg.call?.id;

  // client_id must be forwarded in call.metadata when initiating via Vapi API
  const clientId =
    msg.call?.metadata?.client_id ?? process.env.VAPI_DEFAULT_CLIENT_ID ?? null;

  console.log(`${tag} call=${vapiCallId} phone=${phone} outcome=${outcome} duration=${durationSeconds}s client_id=${clientId}`);

  if (!clientId) {
    console.error(`${tag} no client_id in metadata and VAPI_DEFAULT_CLIENT_ID not set`);
    return NextResponse.json({ error: "client_id missing" }, { status: 422 });
  }

  const supabase = createPureAdminClient();

  // 5. Find or create lead by phone number
  let leadId: string;
  let isNewLead = false;
  let leadName = callerName;

  if (phone) {
    const { data: existingLead, error: findErr } = await supabase
      .from("leads")
      .select("id, name, status")
      .eq("client_id", clientId)
      .eq("phone", phone)
      .maybeSingle();

    if (findErr) {
      console.error(`${tag} error querying lead by phone`, findErr);
      return NextResponse.json({ error: "DB error looking up lead" }, { status: 500 });
    }

    if (existingLead) {
      leadId = existingLead.id;
      leadName = existingLead.name;
      console.log(`${tag} found existing lead id=${leadId} name=${leadName}`);
    } else {
      const { data: newLead, error: createErr } = await supabase
        .from("leads")
        .insert({
          client_id: clientId,
          name: callerName,
          phone,
          source: "other",
          status: "contacted",
        })
        .select("id")
        .single();

      if (createErr || !newLead) {
        console.error(`${tag} error creating lead`, createErr);
        return NextResponse.json({ error: "DB error creating lead" }, { status: 500 });
      }

      leadId = newLead.id;
      isNewLead = true;
      console.log(`${tag} created new lead id=${leadId} phone=${phone}`);
    }
  } else {
    // No phone — create an anonymous lead so the call is still recorded
    const { data: anonLead, error: anonErr } = await supabase
      .from("leads")
      .insert({
        client_id: clientId,
        name: callerName,
        source: "other",
        status: "contacted",
      })
      .select("id")
      .single();

    if (anonErr || !anonLead) {
      console.error(`${tag} error creating anonymous lead`, anonErr);
      return NextResponse.json({ error: "DB error creating anonymous lead" }, { status: 500 });
    }

    leadId = anonLead.id;
    isNewLead = true;
    console.log(`${tag} created anonymous lead id=${leadId} (no phone number)`);
  }

  // 6. Save call record
  const { data: call, error: callErr } = await supabase
    .from("calls")
    .insert({
      lead_id: leadId,
      client_id: clientId,
      outcome,
      duration: durationSeconds,
      transcript,
      recording_url: recordingUrl,
    })
    .select("id")
    .single();

  if (callErr || !call) {
    console.error(`${tag} error inserting call`, callErr);
    return NextResponse.json({ error: "DB error saving call" }, { status: 500 });
  }

  console.log(`${tag} saved call id=${call.id} outcome=${outcome}`);

  // 7. Update lead status when booked
  if (outcome === "booked") {
    const { error: updateErr } = await supabase
      .from("leads")
      .update({ status: "booked" as LeadStatus })
      .eq("id", leadId);

    if (updateErr) {
      // Non-fatal — log and continue
      console.error(`${tag} error updating lead status to booked`, updateErr);
    } else {
      console.log(`${tag} updated lead id=${leadId} status → booked`);
    }
  }

  // 8. Slack notification
  try {
    await sendSlackNotification(
      buildCallSummaryPayload({
        leadName,
        phone: phone ?? "unknown",
        outcome,
        durationSeconds,
        transcript,
        isNewLead,
      })
    );
    console.log(`${tag} Slack notification sent`);
  } catch (slackErr) {
    // Non-fatal — don't fail the webhook over a notification error
    console.error(`${tag} Slack notification failed`, slackErr);
  }

  return NextResponse.json({ received: true, callId: call.id, leadId, outcome });
}
