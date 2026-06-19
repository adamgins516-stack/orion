import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const prompt = formData.get("prompt") || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mimeType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (mimeType.startsWith("image/")) {
      const base64 = buffer.toString("base64");
      const imagePrompt = prompt ||
        "Look at this carefully. If it's a worksheet or has questions, answer every question directly and completely. If it's something else, describe and analyze it.";

      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: "text", text: imagePrompt },
          ],
        }],
        max_tokens: 2048,
      });

      const text = response.choices[0]?.message?.content || "No response.";
      return NextResponse.json({ content: [{ type: "text", text }] });
    }

    if (mimeType === "application/pdf") {
      const { extractText } = await import("unpdf");
      const uint8Array = new Uint8Array(arrayBuffer);
      const { text: extractedText } = await extractText(uint8Array, { mergePages: true });

      if (!extractedText || extractedText.trim().length === 0) {
        return NextResponse.json({
          content: [{ type: "text", text: "Couldn't extract text from this PDF — it might be scanned. Try screenshotting it and uploading the image instead." }],
        });
      }

      const truncated = extractedText.length > 12000
        ? extractedText.slice(0, 12000) + "\n\n[PDF truncated at ~12,000 characters]"
        : extractedText;

      const pdfPrompt = prompt ||
        "This is a PDF the user uploaded. If it has questions or is a worksheet, answer every question directly and completely, numbered to match. If it's notes or reading material, summarize the key points.";

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Be direct and natural. Use markdown formatting — bullets, bold, tables, numbered lists — when it helps. Never say 'the provided text' — you're reading a PDF the user uploaded.",
          },
          { role: "user", content: `PDF CONTENTS:\n\n${truncated}\n\n${pdfPrompt}` },
        ],
        max_tokens: 2048,
      });

      const text = response.choices[0]?.message?.content || "No response.";
      return NextResponse.json({ content: [{ type: "text", text }] });
    }

    return NextResponse.json({
      content: [{ type: "text", text: `Can't read that file type (${mimeType}) directly. Upload a PDF or image, or paste the text into the chat.` }],
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: `Upload error: ${error.message}` }, { status: 500 });
  }
}
