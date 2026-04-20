import { createClient } from "@/lib/supabase/server";
import { formatDate, statusColor } from "@/lib/utils";
import Link from "next/link";
import type { LeadStatus, LeadSource } from "@/types/database";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  const statusCounts = (leads ?? []).reduce<Record<string, number>>((acc, lead) => {
    acc[lead.status] = (acc[lead.status] ?? 0) + 1;
    return acc;
  }, {});

  const statuses: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "booked", "closed_won", "closed_lost"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-white/50 text-sm mt-1">{leads?.length ?? 0} total leads</p>
        </div>
        <Link href="/leads/new" className="glass-btn-primary">+ New Lead</Link>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <span key={s} className={`status-badge ${statusColor(s)} cursor-pointer`}>
            {s} {statusCounts[s] ? `(${statusCounts[s]})` : ""}
          </span>
        ))}
      </div>

      {/* Leads table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07]">
              {["Name", "Phone", "Email", "Source", "Status", "Created"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-white/40 px-4 py-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads?.length ? leads.map((lead) => (
              <tr key={lead.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-white hover:text-brand-400 transition-colors">
                    {lead.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-white/60">{lead.phone ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-white/60">{lead.email ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-white/60 capitalize">{lead.source as LeadSource}</td>
                <td className="px-4 py-3">
                  <span className={`status-badge ${statusColor(lead.status)}`}>{lead.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-white/40">{formatDate(lead.created_at)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-white/30 text-sm">
                  No leads yet. <Link href="/leads/new" className="text-brand-400 hover:underline">Add your first lead</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
