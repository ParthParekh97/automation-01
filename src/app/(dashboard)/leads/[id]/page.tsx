import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { statusColor } from "@/lib/utils";
import Link from "next/link";
import {
  LeadProfileClient,
  type TimelineEvent,
} from "@/components/leads/LeadProfileClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: lead },
    { data: calls },
    { data: emails },
    { data: conversations },
    { data: bookings },
    { data: notes },
    { data: activeSeq },
  ] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).single(),
    supabase
      .from("calls")
      .select("id, outcome, duration, transcript, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("emails")
      .select("id, subject, body, status, sent_at, direction, from_email")
      .eq("lead_id", id)
      .order("sent_at", { ascending: false }),
    supabase
      .from("conversations")
      .select("id, channel, messages, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, booking_date, status, created_at")
      .eq("lead_id", id)
      .order("booking_date", { ascending: false }),
    supabase
      .from("lead_notes")
      .select("id, type, content, metadata, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("email_sequences")
      .select("id")
      .eq("lead_id", id)
      .eq("status", "active")
      .limit(1),
  ]);

  if (!lead) notFound();

  // ── Build unified timeline ──────────────────────────────────────────────────
  const timeline: TimelineEvent[] = [
    ...(calls ?? []).map((c) => ({
      id: c.id,
      at: c.created_at,
      type: "call" as const,
      data: c,
    })),
    ...(emails ?? []).map((e) => ({
      id: e.id,
      at: e.sent_at ?? e.id,
      type: (e.direction === "inbound" ? "email_in" : "email_out") as
        | "email_in"
        | "email_out",
      data: e,
    })),
    ...(conversations ?? []).map((c) => ({
      id: c.id,
      at: c.created_at,
      type: "conversation" as const,
      data: c,
    })),
    ...(bookings ?? []).map((b) => ({
      id: b.id,
      at: b.booking_date,
      type: "booking" as const,
      data: b,
    })),
    ...(notes ?? []).map((n) => ({
      id: n.id,
      at: n.created_at,
      type: (n.type === "status_change" ? "status_change" : "note") as
        | "status_change"
        | "note",
      data: n,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const totalTouchpoints =
    (calls?.length ?? 0) +
    (emails?.length ?? 0) +
    (conversations?.length ?? 0) +
    (bookings?.length ?? 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-white/40 text-xs mb-3">
          <Link href="/leads" className="hover:text-white/70 transition-colors">
            Leads
          </Link>
          <span>/</span>
          <Link href="/pipeline" className="hover:text-white/70 transition-colors">
            Pipeline
          </Link>
          <span>/</span>
          <span className="text-white/60">{lead.name}</span>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{lead.name}</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {lead.phone && (
                <span className="text-white/45 text-sm">📞 {lead.phone}</span>
              )}
              {lead.email && (
                <span className="text-white/45 text-sm">✉️ {lead.email}</span>
              )}
              <span className="text-white/45 text-sm capitalize">
                🔗 {lead.source}
              </span>
            </div>
          </div>
          <span className={`status-badge text-sm ${statusColor(lead.status)}`}>
            {lead.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* ── Main two-column layout ────────────────────────────────────────── */}
      <LeadProfileClient
        lead={{
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          status: lead.status,
          client_id: lead.client_id,
          created_at: lead.created_at,
        }}
        timeline={timeline}
        totalTouchpoints={totalTouchpoints}
        activeSequence={(activeSeq?.length ?? 0) > 0}
      />
    </div>
  );
}
