import { NextResponse } from "next/server";

// NOTE: This route is kept as a fallback but widget creation now goes through
// the Supabase client directly in Orion.js (addWidget). The client-side SDK
// works consistently; server-side NEXT_PUBLIC_ env vars aren't reliable at
// runtime in Vercel serverless functions.
export async function POST(req) {
  try {
    const { type, content } = await req.json();
    if (!type || !content) {
      return NextResponse.json({ error: "Missing type or content" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { error: "Supabase env vars not available server-side. Widget creation uses client SDK directly." },
        { status: 503 }
      );
    }

    const id = Date.now().toString();
    const res = await fetch(`${url}/rest/v1/dashboard_widgets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ id, type, content, position: Date.now(), visible: true }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[dashboard] Supabase insert failed:", res.status, text);
      return NextResponse.json({ error: text }, { status: 500 });
    }

    return NextResponse.json({ id, ok: true });
  } catch (err) {
    console.error("[dashboard] Unexpected error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
