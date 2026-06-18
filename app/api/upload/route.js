export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const prompt = formData.get("prompt") || "Please analyze this file.";

    if (!file) {
      return Response.json({ content: [{ type: "text", text: "No file received." }] });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mime = file.type || "application/octet-stream";

    let content;
    if (mime.startsWith("image/")) {
      content = [
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        { type: "text", text: prompt }
      ];
    } else {
      content = [{ type: "text", text: `${prompt}\n\n[File: ${file.name}] (Note: only images are fully supported for visual analysis. For PDFs and docs, please paste the text content directly.)` }];
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        max_tokens: 1000,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const reply = data.choices?.[0]?.message?.content || "No response.";
    return Response.json({ content: [{ type: "text", text: reply }] });
  } catch (err) {
    return Response.json({ content: [{ type: "text", text: "Upload error: " + err.message }] });
  }
}
