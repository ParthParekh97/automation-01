import { createClient } from "@/lib/supabase/server";
import { CallsDashboard, type CallRow } from "@/components/calls/CallsDashboard";

export default async function CallsPage() {
  const supabase = await createClient();

  const { data: calls, error } = await supabase
    .from("calls")
    .select("id, lead_id, client_id, outcome, duration, transcript, recording_url, vapi_call_id, created_at, leads(name, phone)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[calls-page]", error);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Voice Calls</h1>
        <p className="text-white/40 text-sm mt-1">
          Track every AI call, outcome, and transcript
        </p>
      </div>

      <CallsDashboard calls={(calls ?? []) as CallRow[]} />
    </div>
  );
}
