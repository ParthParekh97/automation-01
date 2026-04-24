import { createPureAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lead_id, client_id, booking_date, notes } = body as {
    lead_id?: string;
    client_id?: string;
    booking_date?: string;
    notes?: string;
  };

  if (!lead_id || !client_id || !booking_date) {
    return NextResponse.json(
      { error: "lead_id, client_id and booking_date are required" },
      { status: 400 }
    );
  }

  const supabase = createPureAdminClient();

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      lead_id,
      client_id,
      booking_date,
      status: "pending",
      cal_event_id: null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log a note for the booking
  if (notes?.trim()) {
    await supabase.from("lead_notes").insert({
      lead_id,
      client_id,
      type: "note",
      content: `Appointment booked: ${notes.trim()}`,
      metadata: { booking_id: data.id },
    });
  }

  return NextResponse.json(data, { status: 201 });
}
