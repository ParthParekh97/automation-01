import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime, formatDuration, statusColor } from "@/lib/utils";
import Link from "next/link";

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
  ] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).single(),
    supabase.from("calls").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("emails").select("*").eq("lead_id", id).order("sent_at", { ascending: false }),
    supabase.from("conversations").select("id, channel, created_at").eq("lead_id", id),
    supabase.from("bookings").select("*").eq("lead_id", id).order("booking_date", { ascending: false }),
  ]);

  if (!lead) notFound();

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
            <Link href="/leads" className="hover:text-white/60 transition-colors">Leads</Link>
            <span>/</span>
            <span className="text-white/70">{lead.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{lead.name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {lead.phone && <span className="text-white/50 text-sm">📞 {lead.phone}</span>}
            {lead.email && <span className="text-white/50 text-sm">✉️ {lead.email}</span>}
            <span className="text-white/50 text-sm capitalize">🔗 {lead.source}</span>
          </div>
        </div>
        <span className={`status-badge text-sm ${statusColor(lead.status)}`}>{lead.status}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calls */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">📞 Calls <span className="text-white/30 text-sm font-normal">({calls?.length ?? 0})</span></h2>
          <div className="space-y-3">
            {calls?.length ? calls.map((call) => (
              <div key={call.id} className="glass-card-sm p-3">
                <div className="flex items-center justify-between">
                  <span className={`status-badge text-xs ${statusColor(call.outcome)}`}>{call.outcome}</span>
                  <span className="text-white/30 text-xs">{formatDuration(call.duration)}</span>
                </div>
                <p className="text-xs text-white/40 mt-1">{formatDateTime(call.created_at)}</p>
                {call.transcript && (
                  <p className="text-xs text-white/50 mt-2 line-clamp-2">{call.transcript}</p>
                )}
              </div>
            )) : <p className="text-white/30 text-sm">No calls yet</p>}
          </div>
        </div>

        {/* Emails */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">✉️ Emails <span className="text-white/30 text-sm font-normal">({emails?.length ?? 0})</span></h2>
          <div className="space-y-3">
            {emails?.length ? emails.map((email) => (
              <div key={email.id} className="glass-card-sm p-3">
                <p className="text-sm font-medium text-white line-clamp-1">{email.subject}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className={`status-badge text-xs ${statusColor(email.status)}`}>{email.status}</span>
                  <span className="text-white/30 text-xs">{email.sent_at ? formatDate(email.sent_at) : "Draft"}</span>
                </div>
              </div>
            )) : <p className="text-white/30 text-sm">No emails yet</p>}
          </div>
        </div>

        {/* Bookings */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">📅 Bookings <span className="text-white/30 text-sm font-normal">({bookings?.length ?? 0})</span></h2>
          <div className="space-y-3">
            {bookings?.length ? bookings.map((booking) => (
              <div key={booking.id} className="glass-card-sm p-3">
                <p className="text-sm font-medium text-white">{formatDateTime(booking.booking_date)}</p>
                <span className={`status-badge text-xs mt-1 ${statusColor(booking.status)}`}>{booking.status}</span>
              </div>
            )) : <p className="text-white/30 text-sm">No bookings yet</p>}
          </div>
        </div>
      </div>

      {/* Conversations */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-4">💬 Conversations ({conversations?.length ?? 0})</h2>
        <div className="flex flex-wrap gap-3">
          {conversations?.length ? conversations.map((conv) => (
            <Link key={conv.id} href={`/conversations?id=${conv.id}`} className="glass-card-sm px-4 py-2.5 flex items-center gap-2 hover:bg-white/[0.06] transition-colors">
              <span className="text-sm capitalize">{conv.channel}</span>
              <span className="text-white/30 text-xs">{formatDate(conv.created_at)}</span>
            </Link>
          )) : <p className="text-white/30 text-sm">No conversations yet</p>}
        </div>
      </div>
    </div>
  );
}
