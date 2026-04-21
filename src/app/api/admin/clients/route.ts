import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createPureAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function createAuthAdmin() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, plan, service_type } = body as {
    name?: string;
    email?: string;
    plan?: "starter" | "growth" | "scale";
    service_type?: string | null;
  };

  if (!name || !email || !plan) {
    return NextResponse.json(
      { error: "name, email, and plan are required" },
      { status: 400 }
    );
  }

  const authAdmin = createAuthAdmin();

  // Create Supabase auth user
  const { data: userData, error: userError } = await authAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  });

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: userError?.message ?? "Failed to create user" },
      { status: 500 }
    );
  }

  const userId = userData.user.id;

  const dbAdmin = createPureAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client, error: clientError } = await (dbAdmin as any)
    .from("clients")
    .insert({
      id: userId,
      name,
      email,
      plan,
      service_type: service_type ?? null,
      active: true,
    })
    .select()
    .single();

  if (clientError || !client) {
    await authAdmin.auth.admin.deleteUser(userId); // rollback auth user
    return NextResponse.json(
      { error: clientError?.message ?? "Failed to create client record" },
      { status: 500 }
    );
  }

  // Generate recovery/invite link
  const { data: linkData } = await authAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const invite_link = linkData?.properties?.action_link ?? null;

  return NextResponse.json({ client, invite_link }, { status: 201 });
}
