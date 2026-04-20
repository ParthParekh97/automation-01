import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import type { LeadCardData } from "@/components/pipeline/LeadCard";

// Raw row shape returned by the nested Supabase select
interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  client_id: string;
  calls: Array<{ outcome: string; created_at: string }>;
  emails: Array<{ subject: string; sent_at: string | null; direction: string }>;
}

function buildLastActivity(lead: LeadRow): LeadCardData["last_activity"] {
  const latestCall = [...lead.calls].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0] ?? null;

  const latestEmail = [...lead.emails].sort(
    (a, b) =>
      new Date(b.sent_at ?? 0).getTime() - new Date(a.sent_at ?? 0).getTime()
  )[0] ?? null;

  const callAt = latestCall ? new Date(latestCall.created_at).getTime() : 0;
  const emailAt = latestEmail ? new Date(latestEmail.sent_at ?? 0).getTime() : 0;

  if (!latestCall && !latestEmail) {
    return { type: "none", label: "No activity yet", at: null };
  }

  if (callAt >= emailAt && latestCall) {
    const outcomeLabel = latestCall.outcome.replace(/_/g, " ");
    return {
      type: "call",
      label: `Called — ${outcomeLabel}`,
      at: latestCall.created_at,
    };
  }

  if (latestEmail) {
    const label =
      latestEmail.direction === "inbound"
        ? "Replied to email"
        : `Sent: ${latestEmail.subject}`;
    return { type: "email", label, at: latestEmail.sent_at };
  }

  return { type: "none", label: "No activity yet", at: null };
}

export default async function PipelinePage() {
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from("leads")
    .select(
      `id, name, email, phone, status, source, client_id,
       calls(outcome, created_at),
       emails(subject, sent_at, direction)`
    )
    .order("created_at", { ascending: false });

  const leads: LeadCardData[] = (raw as LeadRow[] ?? []).map((lead) => ({
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    source: lead.source,
    client_id: lead.client_id,
    last_activity: buildLastActivity(lead),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Pipeline</h1>
        <p className="text-white/50 text-sm mt-1">
          Drag leads across columns to track progress
        </p>
      </div>

      <KanbanBoard initialLeads={leads} />
    </div>
  );
}
