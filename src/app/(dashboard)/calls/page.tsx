import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatDuration, statusColor } from "@/lib/utils";
import Link from "next/link";

export default async function CallsPage() {
  const supabase = await createClient();
  const { data: calls } = await supabase
    .from("calls")
    .select("*, leads(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Calls</h1>
        <p className="text-white/50 text-sm mt-1">{calls?.length ?? 0} total calls</p>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07]">
              {["Lead", "Outcome", "Duration", "Date", "Recording"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-white/40 px-4 py-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calls?.length ? calls.map((call) => (
              <tr key={call.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/leads/${call.lead_id}`} className="text-sm font-medium text-white hover:text-brand-400 transition-colors">
                    {(call.leads as { name: string } | null)?.name ?? "Unknown"}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`status-badge ${statusColor(call.outcome)}`}>{call.outcome}</span>
                </td>
                <td className="px-4 py-3 text-sm text-white/60">{formatDuration(call.duration)}</td>
                <td className="px-4 py-3 text-sm text-white/40">{formatDateTime(call.created_at)}</td>
                <td className="px-4 py-3">
                  {call.recording_url ? (
                    <a href={call.recording_url} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 text-sm transition-colors">Listen ↗</a>
                  ) : (
                    <span className="text-white/20 text-sm">—</span>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-white/30 text-sm">No calls logged yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
