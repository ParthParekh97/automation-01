import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-white/50 text-sm mt-1">{clients?.length ?? 0} clients</p>
        </div>
        <Link href="/clients/new" className="glass-btn-primary">+ New Client</Link>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07]">
              {["Name", "Email", "Plan", "Status", "Created", ""].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-white/40 px-4 py-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients?.length ? clients.map((client) => (
              <tr key={client.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/clients/${client.id}`} className="text-sm font-medium text-white hover:text-brand-400 transition-colors">
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-white/60">{client.email}</td>
                <td className="px-4 py-3">
                  <span className="status-badge text-purple-400 bg-purple-400/10 capitalize">{client.plan}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`status-badge ${client.active ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                    {client.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white/40">{formatDate(client.created_at)}</td>
                <td className="px-4 py-3">
                  <Link href={`/clients/${client.id}`} className="text-brand-400 hover:text-brand-300 text-sm transition-colors">View →</Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-white/30 text-sm">
                  No clients yet. <Link href="/clients/new" className="text-brand-400 hover:underline">Add your first client</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
