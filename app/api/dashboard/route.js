import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const { type, content } = await req.json();
    if (!type || !content) {
      return NextResponse.json({ error: "Missing type or content" }, { status: 400 });
    }
    const id = Date.now().toString();
    const { error } = await supabase.from("dashboard_widgets").insert({
      id, type, content, position: Date.now(), visible: true,
    });
    if (error) throw error;
    return NextResponse.json({ id, ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
