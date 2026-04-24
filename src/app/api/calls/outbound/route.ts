import { createPureAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const tag = "[outbound-call]";

const requestSchema = z.object({
  lead_id: z.string().uuid(),
  client_id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Vapi response shape (partial — only what we use)
// ---------------------------------------------------------------------------
interface VapiCallResponse {
  id: string;
  status: string;
  [key: string]: unknown;
}

async function initiateVapiCall(params: {
  phone: string;
  leadName: string;
  businessName: string;
  vapiCallId?: string; // for idempotency if needed later
}): Promise<VapiCallResponse> {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  if (!apiKey || !assistantId) {
    throw new Error("VAPI_API_KEY or VAPI_ASSISTANT_ID is not configured");
  }

  const res = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId,
      customer: {
        number: params.phone,
        name: params.leadName,
      },
      assistantOverrides: {
        variableValues: {
          leadName: params.leadName,
          businessName: params.businessName,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vapi API error: HTTP ${res.status} — ${body}`);
  }

  return res.json() as Promise<VapiCallResponse>;
}

// ---------------------------------------------------------------------------
// POST /api/calls/outbound
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lead_id, client_id } = parsed.data;
  const supabase = createPureAdminClient();

  // 2. Fetch lead — need phone number and name
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, name, phone, client_id")
    .eq("id", lead_id)
    .eq("client_id", client_id)
    .single();

  if (leadErr || !lead) {
    console.error(`${tag} lead not found`, { lead_id, client_id, leadErr });
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!lead.phone) {
    console.warn(`${tag} lead has no phone number`, { lead_id });
    return NextResponse.json({ error: "Lead has no phone number" }, { status: 422 });
  }

  // 3. Fetch client — need business name to pass to Vapi
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("name")
    .eq("id", client_id)
    .single();

  if (clientErr || !client) {
    console.error(`${tag} client not found`, { client_id, clientErr });
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  console.log(`${tag} initiating call — lead="${lead.name}" phone=${lead.phone} business="${client.name}"`);

  // 4. Save call record immediately so the UI has an ID to track
  //    outcome starts as "other" (in-progress); the Vapi webhook updates it on completion
  const { data: callRecord, error: callInsertErr } = await supabase
    .from("calls")
    .insert({
      lead_id,
      client_id,
      outcome: "other",
      duration: 0,
      transcript: null,
      recording_url: null,
      vapi_call_id: null, // filled once Vapi responds
    })
    .select("id")
    .single();

  if (callInsertErr || !callRecord) {
    console.error(`${tag} failed to pre-insert call record`, callInsertErr);
    return NextResponse.json({ error: "Failed to save call record" }, { status: 500 });
  }

  console.log(`${tag} pre-inserted call id=${callRecord.id}`);

  // 5. Trigger the Vapi outbound call
  let vapiCall: VapiCallResponse;
  try {
    vapiCall = await initiateVapiCall({
      phone: lead.phone,
      leadName: lead.name,
      businessName: client.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} Vapi API call failed`, message);

    // Clean up the pre-inserted record so we don't leave a ghost call
    await supabase.from("calls").delete().eq("id", callRecord.id);

    return NextResponse.json({ error: `Failed to initiate call: ${message}` }, { status: 502 });
  }

  console.log(`${tag} Vapi call created — vapi_call_id=${vapiCall.id} status=${vapiCall.status}`);

  // 6. Patch our call record with the Vapi call ID for later webhook matching
  const { error: patchErr } = await supabase
    .from("calls")
    .update({ vapi_call_id: vapiCall.id })
    .eq("id", callRecord.id);

  if (patchErr) {
    // Non-fatal — log but still return success; the record exists
    console.error(`${tag} failed to patch vapi_call_id`, patchErr);
  }

  // 7. Update lead status to "contacted" if it's still "new"
  await supabase
    .from("leads")
    .update({ status: "contacted" })
    .eq("id", lead_id)
    .eq("status", "new"); // only advance from "new", never regress

  return NextResponse.json({
    call_id: callRecord.id,
    vapi_call_id: vapiCall.id,
    vapi_status: vapiCall.status,
  });
}
