import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { type, content } = await req.json();
    if (!type || !content) {
      return NextResponse.json({ error: "Missing type or content" }, { status: 400 });
    }
    const id = Date.now().toString();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/dashboard_widgets`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ id, type, content, position: Date.now(), visible: true }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: 500 });
    }
    return NextResponse.json({ id, ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
