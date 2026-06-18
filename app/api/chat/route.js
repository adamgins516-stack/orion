async function webSearch(query) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 5,
      }),
    });
    const data = await res.json();
    return data.results?.map(r => `${r.title}: ${r.content}`).join("\n\n") || "No results found.";
  } catch {
    return "Search failed.";
  }
}

function needsSearch(message) {
  const triggers = ["news", "today", "current", "weather", "score", "latest", "recent", "right now", "happening", "world", "update", "stock", "price", "who won", "what is", "2024", "2025", "2026"];
  const lower = message.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

export async function POST(req) {
  const body = await req.json();
  const messages = body.messages || [];
  const lastMessage = messages[messages.length - 1]?.content || "";
  const system = body.system || "";

  let contextualSystem = system;

  // If the message likely needs current info, search first then answer
  if (needsSearch(lastMessage)) {
    const searchResults = await webSearch(lastMessage);
    contextualSystem = system + `\n\nWEB SEARCH RESULTS for "${lastMessage}":\n${searchResults}\n\nUse these search results to answer the user's question accurately. Cite what you found.`;
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: [
        { role: "system", content: contextualSystem },
        ...messages.map(m => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : m.content?.filter?.(b => b.type === "text").map(b => b.text).join("\n") || String(m.content)
        }))
      ],
    }),
  });

  const data = await res.json();
  if (data.error) {
    return Response.json({ content: [{ type: "text", text: "Error: " + (data.error.message || JSON.stringify(data.error)) }] });
  }

  const reply = data.choices?.[0]?.message?.content || "No response.";
  return Response.json({ content: [{ type: "text", text: reply }] });
}
