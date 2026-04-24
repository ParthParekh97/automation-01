import { Suspense } from "react";
import { createPureAdminClient } from "@/lib/supabase/server";
import { EmailDashboard } from "@/components/emails/EmailDashboard";

// Supabase join shape
interface EmailJoinRow {
  id: string;
  lead_id: string;
  subject: string;
  sent_at: string | null;
  direction: string;
  status: string;
  leads: {
    id: string;
    name: string;
    email: string | null;
    status: string;
    client_id: string;
  } | null;
}

export default async function EmailsPage() {
  const supabase = createPureAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // All emails for this client (joined with lead data), ordered newest first.
  // We use this to build per-lead summaries without N+1 queries.
  const [{ data: emailRows }, { data: allLeads }] = await Promise.all([
    supabase
      .from("emails")
      .select(
        "id, lead_id, subject, sent_at, direction, status, leads(id, name, email, status, client_id)"
      )
      .order("sent_at", { ascending: false })
      .limit(500),

    supabase
      .from("leads")
      .select("id, name, email, client_id")
      .not("email", "is", null)
      .order("name"),
  ]);

  // Build one summary entry per lead (first row = latest email, because ordered desc)
  const seenLeads = new Map<
    string,
    {
      id: string;
      name: string;
      email: string | null;
      status: string;
      client_id: string;
      email_count: number;
      latest_email: { subject: string; sent_at: string | null; direction: string; status: string };
    }
  >();

  for (const row of (emailRows as EmailJoinRow[]) ?? []) {
    const lead = row.leads;
    if (!lead) continue;
    if (!seenLeads.has(row.lead_id)) {
      seenLeads.set(row.lead_id, {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        status: lead.status,
        client_id: lead.client_id,
        email_count: 1,
        latest_email: {
          subject: row.subject,
          sent_at: row.sent_at,
          direction: row.direction,
          status: row.status,
        },
      });
    } else {
      seenLeads.get(row.lead_id)!.email_count++;
    }
  }

  const leadsWithActivity = Array.from(seenLeads.values());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Emails</h1>
          <p className="text-white/50 text-sm mt-1">
            {leadsWithActivity.length} lead{leadsWithActivity.length !== 1 ? "s" : ""} with email activity
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="glass-card h-[calc(100vh-11rem)] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
          </div>
        }
      >
        <EmailDashboard
          leadsWithActivity={leadsWithActivity}
          allLeads={(allLeads ?? []) as { id: string; name: string; email: string | null; client_id: string }[]}
          clientId={user!.id}
        />
      </Suspense>
    </div>
  );
}
