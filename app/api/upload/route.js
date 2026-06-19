import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const prompt = formData.get("prompt") || "Analyze this file.";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mimeType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── IMAGE HANDLING ──────────────────────────────────────────────────────
    if (mimeType.startsWith("image/")) {
      const base64 = buffer.toString("base64");
      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
        max_tokens: 2048,
      });

      const text = response.choices[0]?.message?.content || "No response.";
      return NextResponse.json({
        content: [{ type: "text", text }],
      });
    }

    // ── PDF HANDLING (unpdf) ─────────────────────────────────────────────────
    if (mimeType === "application/pdf") {
      const { extractText } = await import("unpdf");

      const uint8Array = new Uint8Array(arrayBuffer);
      const { text: extractedText } = await extractText(uint8Array, {
        mergePages: true,
      });

      if (!extractedText || extractedText.trim().length === 0) {
        return NextResponse.json({
          content: [
            {
              type: "text",
              text: "I couldn't extract any text from that PDF. It may be a scanned image-only PDF. Try copying and pasting the text directly.",
            },
          ],
        });
      }

      // Truncate to avoid token overflow (~12,000 chars ≈ ~3,000 tokens)
      const truncated =
        extractedText.length > 12000
          ? extractedText.slice(0, 12000) +
            "\n\n[PDF truncated — showing first ~12,000 characters]"
          : extractedText;

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: `Here is the text extracted from the uploaded PDF:\n\n${truncated}\n\n${prompt}`,
          },
        ],
        max_tokens: 2048,
      });

      const text = response.choices[0]?.message?.content || "No response.";
      return NextResponse.json({
        content: [{ type: "text", text }],
      });
    }

    // ── UNSUPPORTED FILE TYPE ────────────────────────────────────────────────
    return NextResponse.json({
      content: [
        {
          type: "text",
          text: `Sorry, I can't read that file type (${mimeType}) directly. Try uploading a PDF or image, or paste the text content directly into the chat.`,
        },
      ],
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: `Upload error: ${error.message}` },
      { status: 500 }
    );
  }
}
