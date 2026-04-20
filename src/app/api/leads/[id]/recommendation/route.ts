import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lead_id } = await params;

  const supabase = await createAdminClient();

  // Fetch lead + activity counts in parallel
  const [{ data: lead }, { count: callCount }, { count: emailCount }, { count: convCount }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id, name, status, created_at, client_id")
        .eq("id", lead_id)
        .single(),
      supabase.from("calls").select("id", { count: "exact", head: true }).eq("lead_id", lead_id),
      supabase.from("emails").select("id", { count: "exact", head: true }).eq("lead_id", lead_id),
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead_id),
    ]);

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Most recent activity
  const { data: recentCalls } = await supabase
    .from("calls")
    .select("created_at, outcome")
    .eq("lead_id", lead_id)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: recentEmails } = await supabase
    .from("emails")
    .select("sent_at, direction, subject")
    .eq("lead_id", lead_id)
    .order("sent_at", { ascending: false })
    .limit(1);

  const lastCall = recentCalls?.[0] ?? null;
  const lastEmail = recentEmails?.[0] ?? null;

  const callAt = lastCall ? new Date(lastCall.created_at).getTime() : 0;
  const emailAt = lastEmail ? new Date(lastEmail.sent_at ?? 0).getTime() : 0;
  const lastContactAt = Math.max(callAt, emailAt);

  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(lead.created_at).getTime()) / 86_400_000
  );
  const daysSinceContact =
    lastContactAt > 0
      ? Math.floor((Date.now() - lastContactAt) / 86_400_000)
      : null;

  const lastActivityDesc =
    callAt >= emailAt && lastCall
      ? `a call (${lastCall.outcome.replace(/_/g, " ")})`
      : lastEmail
      ? `an email (${lastEmail.direction === "inbound" ? "reply received" : `sent: ${lastEmail.subject}`})`
      : "no recorded activity";

  const totalTouchpoints = (callCount ?? 0) + (emailCount ?? 0) + (convCount ?? 0);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      recommendation: "Configure ANTHROPIC_API_KEY to enable AI recommendations.",
    });
  }

  const prompt = `You are a sales coach reviewing a CRM lead.

Lead: ${lead.name}
Pipeline status: ${lead.status.replace(/_/g, " ")}
Days in pipeline: ${daysSinceCreated}
Total touchpoints: ${totalTouchpoints} (${callCount} calls, ${emailCount} emails, ${convCount} conversations)
Last contact: ${daysSinceContact !== null ? `${daysSinceContact} day${daysSinceContact === 1 ? "" : "s"} ago via ${lastActivityDesc}` : "never"}

In 1–2 sentences, give a specific, actionable next step recommendation for this lead. Be direct and concise. No fluff.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      system: "You are a concise sales coach. Give direct, specific recommendations. No pleasantries.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    return NextResponse.json({
      recommendation: "Unable to generate recommendation right now.",
    });
  }

  const data = await res.json();
  const recommendation: string = data.content?.[0]?.text ?? "No recommendation available.";
  return NextResponse.json({ recommendation });
}
