async function webSearch(query) {
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
  return data.results?.map(r => `${r.title}\n${r.url}\n${r.content}`).join("\n\n") || "No results found.";
}

export async function POST(req) {
  const body = await req.json();

  const tools = [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Search the web for current information, news, events, or anything that requires up-to-date data. Use this whenever the user asks about current events, news, weather, sports, or anything that may have changed recently.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query" }
          },
          required: ["query"]
        }
      }
    }
  ];

  const systemPrompt = (body.system || "") + `

CRITICAL RULES:
- You do NOT have access to Adam's real Gmail, Google Calendar, or Google Drive. If asked about emails, calendar, or files, tell him clearly: "I don't have access to your actual Gmail/Calendar/Drive — you'd need to check that directly. I can help you draft a reply, plan your schedule, or organize files if you paste the content here."
- You DO have access to a web search tool. Use it proactively for any question about current events, news, sports scores, recent developments, or anything time-sensitive.
- Never make up emails, calendar events, or file contents. Only work with information Adam actually provides.
- When you search the web, tell Adam what you found and cite the source.`;

  const messages = body.messages || [];

  // First call to Groq
  const res1 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : m.content.filter?.(b => b.type === "text").map(b => b.text).join("\n") || String(m.content)
        }))
      ],
      tools,
      tool_choice: "auto",
    }),
  });

  const data1 = await res1.json();
  if (data1.error) {
    return Response.json({ content: [{ type: "text", text: "Error: " + (data1.error.message || JSON.stringify(data1.error)) }] });
  }

  const choice = data1.choices?.[0];

  // If Groq wants to call a tool
  if (choice?.finish_reason === "tool_calls" && choice?.message?.tool_calls?.length > 0) {
    const toolCall = choice.message.tool_calls[0];
    const args     = JSON.parse(toolCall.function.arguments);
    const results  = await webSearch(args.query);

    // Second call with search results
    const res2 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map(m => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : m.content.filter?.(b => b.type === "text").map(b => b.text).join("\n") || String(m.content)
          })),
          { role: "assistant", content: null, tool_calls: choice.message.tool_calls },
          { role: "tool", tool_call_id: toolCall.id, content: results }
        ],
      }),
    });

    const data2 = await res2.json();
    if (data2.error) {
      return Response.json({ content: [{ type: "text", text: "Search error: " + (data2.error.message || JSON.stringify(data2.error)) }] });
    }
    const reply = data2.choices?.[0]?.message?.content || "No response.";
    return Response.json({ content: [{ type: "text", text: reply }] });
  }

  // Normal response
  const reply = choice?.message?.content || "No response.";
  return Response.json({ content: [{ type: "text", text: reply }] });
}
