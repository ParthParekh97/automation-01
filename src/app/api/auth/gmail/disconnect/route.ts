import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/auth/gmail/disconnect
 * Removes the Gmail integration for the authenticated client.
 */
export async function POST() {
  const tag = "[gmail-disconnect]";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createAdminClient();
  const { error } = await admin
    .from("client_integrations")
    .delete()
    .eq("client_id", user.id)
    .eq("provider", "gmail");

  if (error) {
    console.error(`${tag} delete failed`, error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  console.log(`${tag} Gmail disconnected for client=${user.id}`);
  return NextResponse.redirect(`${appUrl}/settings?gmail=disconnected`);
}
