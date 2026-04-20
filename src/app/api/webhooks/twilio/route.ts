import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();

  const callSid = formData.get("CallSid") as string;
  const callStatus = formData.get("CallStatus") as string;
  const callDuration = parseInt(formData.get("CallDuration") as string ?? "0", 10);
  const recordingUrl = formData.get("RecordingUrl") as string | null;

  const outcomeMap: Record<string, string> = {
    completed: "interested",
    "no-answer": "no_answer",
    busy: "no_answer",
    failed: "no_answer",
  };

  const supabase = await createAdminClient();

  await supabase.from("calls").update({
    outcome: outcomeMap[callStatus] ?? "other",
    duration: callDuration,
    recording_url: recordingUrl,
  }).eq("id", callSid);

  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}
