import { createClient } from "@/lib/supabase/server";
import { formatDateTime, statusColor } from "@/lib/utils";
import Link from "next/link";

export default async function BookingsPage() {
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, leads(name)")
    .order("booking_date", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <p className="text-white/50 text-sm mt-1">{bookings?.length ?? 0} bookings</p>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07]">
              {["Lead", "Date & Time", "Status", "Cal Event ID"].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-white/40 px-4 py-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings?.length ? bookings.map((booking) => (
              <tr key={booking.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/leads/${booking.lead_id}`} className="text-sm font-medium text-white hover:text-brand-400 transition-colors">
                    {(booking.leads as { name: string } | null)?.name ?? "Unknown"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-white/60">{formatDateTime(booking.booking_date)}</td>
                <td className="px-4 py-3">
                  <span className={`status-badge ${statusColor(booking.status)}`}>{booking.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-white/40 font-mono">{booking.cal_event_id ?? "—"}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-white/30 text-sm">No bookings yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
