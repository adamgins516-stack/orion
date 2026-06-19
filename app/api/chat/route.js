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

function trimHistory(messages, maxMessages = 10) {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(messages.length - maxMessages);
}

export async function POST(req) {
  const body = await req.json();
  const system = body.system || "";
  const messages = body.messages || [];

  // NAME GENERATION MODE
  if (body.mode === "name") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 20,
        messages: [
          {
            role: "system",
            content: "Generate a very short chat title (3-5 words max) based on the user's first message. No quotes, no punctuation, just the title. Examples: 'PTV Script Help', 'Syracuse Essay Draft', 'Fort Lauderdale Weather', 'Exercise Terminology PDF'"
          },
          { role: "user", content: body.firstMessage || "" }
        ],
      }),
    });
    const data = await res.json();
    const name = data.choices?.[0]?.message?.content?.trim() || "New Chat";
    return Response.json({ name });
  }

  // QUICK ACTIONS GENERATION MODE
  if (body.mode === "quickactions") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 60,
        messages: [
          {
            role: "system",
            content: `Generate exactly 4 short follow-up quick action buttons based on the conversation context. 
Return ONLY a JSON array of 4 strings, each under 30 characters. No markdown, no explanation.
Example: ["Summarize key points", "Create study guide", "Quiz me on this", "Explain question 3"]
Make them relevant and useful for what Adam is working on.`
          },
          {
            role: "user",
            content: `Conversation so far: ${body.context || ""}`
          }
        ],
      }),
    });
    const data = await res.json();
    try {
      const text = data.choices?.[0]?.message?.content?.trim() || "[]";
      const actions = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (Array.isArray(actions) && actions.length === 4) {
        return Response.json({ actions });
      }
    } catch {}
    return Response.json({ actions: ["What's in the news?", "PTV rundown", "Syracuse essay help", "Fort Lauderdale weather"] });
  }

  // NORMAL CHAT MODE
  const lastMessage = messages[messages.length - 1]?.content || "";
  let contextualSystem = system;

  if (needsSearch(lastMessage)) {
    const searchResults = await webSearch(lastMessage);
    contextualSystem = system + `\n\nWEB SEARCH RESULTS for "${lastMessage}":\n${searchResults}\n\nUse these search results to answer the user's question accurately. Cite what you found.`;
  }

  const trimmedMessages = trimHistory(messages, 10);

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
        ...trimmedMessages.map(m => ({
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
