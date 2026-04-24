import { createPureAdminClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/StatCard";
import { formatDate, statusColor } from "@/lib/utils";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = createPureAdminClient();

  const [
    { count: totalLeads },
    { count: totalCalls },
    { count: totalBookings },
    { data: recentLeads },
    { data: recentCalls },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("calls").select("*", { count: "exact", head: true }),
    supabase.from("bookings").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("id, name, status, source, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("calls").select("id, outcome, duration, created_at, leads(name)").order("created_at", { ascending: false }).limit(5),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-white/50 text-sm mt-1">Overview of your CRM activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={totalLeads ?? 0} icon="👤" />
        <StatCard label="Total Calls" value={totalCalls ?? 0} icon="📞" />
        <StatCard label="Bookings" value={totalBookings ?? 0} icon="📅" />
        <StatCard label="Conversion" value="—" icon="📈" />
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Recent Leads</h2>
            <Link href="/leads" className="text-brand-400 hover:text-brand-300 text-sm transition-colors">View all</Link>
          </div>
          <div className="space-y-3">
            {recentLeads?.length ? recentLeads.map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{lead.name}</p>
                  <p className="text-xs text-white/40 mt-0.5">{lead.source} · {formatDate(lead.created_at)}</p>
                </div>
                <span className={`status-badge ${statusColor(lead.status)}`}>{lead.status}</span>
              </Link>
            )) : (
              <p className="text-white/30 text-sm py-4 text-center">No leads yet</p>
            )}
          </div>
        </div>

        {/* Recent Calls */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Recent Calls</h2>
            <Link href="/calls" className="text-brand-400 hover:text-brand-300 text-sm transition-colors">View all</Link>
          </div>
          <div className="space-y-3">
            {recentCalls?.length ? recentCalls.map((call) => (
              <div key={call.id} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">
                    {(call.leads as { name: string } | null)?.name ?? "Unknown lead"}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">{formatDate(call.created_at)}</p>
                </div>
                <span className={`status-badge ${statusColor(call.outcome)}`}>{call.outcome}</span>
              </div>
            )) : (
              <p className="text-white/30 text-sm py-4 text-center">No calls yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
