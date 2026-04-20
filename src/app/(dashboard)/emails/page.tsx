import { createClient } from "@/lib/supabase/server";
import { formatDate, statusColor } from "@/lib/utils";
import Link from "next/link";

export default async function EmailsPage() {
  const supabase = await createClient();
  const { data: emails } = await supabase
    .from("emails")
    .select("*, leads(name)")
    .order("sent_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Emails</h1>
        <p className="text-white/50 text-sm mt-1">{emails?.length ?? 0} total emails</p>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07]">
              {["Lead", "Subject", "Status", "Sent"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-white/40 px-4 py-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {emails?.length ? emails.map((email) => (
              <tr key={email.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/leads/${email.lead_id}`} className="text-sm font-medium text-white hover:text-brand-400 transition-colors">
                    {(email.leads as { name: string } | null)?.name ?? "Unknown"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-white/70 max-w-xs truncate">{email.subject}</td>
                <td className="px-4 py-3">
                  <span className={`status-badge ${statusColor(email.status)}`}>{email.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-white/40">
                  {email.sent_at ? formatDate(email.sent_at) : "Not sent"}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-white/30 text-sm">No emails logged yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
