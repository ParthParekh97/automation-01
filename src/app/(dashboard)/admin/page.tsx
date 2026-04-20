import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.SUPER_ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const adminSupabase = await createAdminClient();

  const { data: clients } = await adminSupabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  const ids = (clients ?? []).map((c) => c.id);

  const [{ data: leadRows }, { data: callRows }, { data: emailRows }] =
    await Promise.all([
      adminSupabase.from("leads").select("client_id").in("client_id", ids),
      adminSupabase.from("calls").select("client_id").in("client_id", ids),
      adminSupabase.from("emails").select("client_id").in("client_id", ids),
    ]);

  const tally = (rows: { client_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.client_id, (m.get(r.client_id) ?? 0) + 1);
    return m;
  };

  const leadMap = tally(leadRows);
  const callMap = tally(callRows);
  const emailMap = tally(emailRows);

  const clientsWithStats = (clients ?? []).map((c) => ({
    ...c,
    leads: leadMap.get(c.id) ?? 0,
    calls: callMap.get(c.id) ?? 0,
    emails: emailMap.get(c.id) ?? 0,
  }));

  return <AdminDashboard clients={clientsWithStats} />;
}
