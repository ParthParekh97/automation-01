import { createClient, createAdminClient } from "@/lib/supabase/server";
import { GmailConnectCard } from "@/components/settings/GmailConnectCard";

interface Props {
  searchParams: Promise<{ gmail?: string }>;
}

export default async function SettingsPage({ searchParams }: Props) {
  const { gmail: gmailStatus = null } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch Gmail integration for this client (if connected)
  const admin = await createAdminClient();
  const { data: gmailIntegration } = await admin
    .from("client_integrations")
    .select("connected_email, created_at")
    .eq("client_id", user!.id)
    .eq("provider", "gmail")
    .maybeSingle();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/50 text-sm mt-1">Manage your account and integrations</p>
      </div>

      {/* Profile */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="font-semibold text-white">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">Email</label>
            <p className="text-sm text-white bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
              {user?.email}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">User ID</label>
            <p className="text-sm text-white/40 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 font-mono">
              {user?.id}
            </p>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="font-semibold text-white">Integrations</h2>
        <p className="text-white/40 text-sm -mt-1">
          Connect your tools to enable AI-powered outreach.
        </p>

        <div className="space-y-3">
          {/* Gmail — live connect/disconnect */}
          <GmailConnectCard
            connected={!!gmailIntegration}
            connectedEmail={gmailIntegration?.connected_email ?? null}
            connectedAt={gmailIntegration?.created_at ?? null}
            oauthStatus={gmailStatus}
          />

          {/* Other integrations (static for now) */}
          {[
            { name: "Twilio", description: "Calls & SMS", icon: "📞" },
            { name: "Cal.com", description: "Booking calendar", icon: "📅" },
            { name: "Stripe", description: "Payments", icon: "💳", soon: true },
          ].map((item) => (
            <div key={item.name} className="glass-card-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-lg">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{item.name}</p>
                  <p className="text-xs text-white/40">{item.description}</p>
                </div>
              </div>
              <button
                disabled={item.soon}
                className="glass-btn-secondary text-xs py-1.5 px-3 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {item.soon ? "Coming soon" : "Configure"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Cron status hint */}
      <div className="glass-card-sm p-4">
        <p className="text-white/40 text-xs">
          <span className="text-white/60 font-medium">Gmail reply detection</span> runs every 5 minutes via{" "}
          <code className="text-brand-400">POST /api/cron/gmail-poll</code>. Set{" "}
          <code className="text-brand-400">CRON_SECRET</code> in Vercel and add the cron schedule from{" "}
          <code className="text-brand-400">vercel.json</code>.
        </p>
      </div>
    </div>
  );
}
