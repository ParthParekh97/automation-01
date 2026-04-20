import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/50 text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="font-semibold text-white">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">Email</label>
            <p className="text-sm text-white bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">{user?.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">User ID</label>
            <p className="text-sm text-white/40 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 font-mono">{user?.id}</p>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="font-semibold text-white">Integrations</h2>
        <div className="space-y-3">
          {[
            { name: "Twilio", description: "Calls & SMS", icon: "📞", status: "Configure" },
            { name: "SendGrid", description: "Email delivery", icon: "✉️", status: "Configure" },
            { name: "Cal.com", description: "Booking calendar", icon: "📅", status: "Configure" },
            { name: "Stripe", description: "Payments", icon: "💳", status: "Coming soon" },
          ].map((integration) => (
            <div key={integration.name} className="glass-card-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{integration.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{integration.name}</p>
                  <p className="text-xs text-white/40">{integration.description}</p>
                </div>
              </div>
              <button className="glass-btn-secondary text-sm py-1.5 px-3">{integration.status}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
