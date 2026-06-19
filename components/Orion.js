"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

const ACCENT = "#FF2D78";
const ACCENT_DIM = "rgba(255,45,120,0.15)";
const BG = "#0D0F14";
const BG2 = "#161820";
const BG3 = "#1E2028";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT = "#F0F2FF";
const TEXT2 = "#8B8FA8";

const DEFAULT_ACTIONS = ["What's in the news?", "PTV rundown", "Syracuse essay help", "Fort Lauderdale weather"];

const ADAM_CONTEXT = `You are Orion, Adam Ginsburg's personal AI assistant.

ABOUT ADAM:
- Rising senior at American Heritage School, Plantation FL. Lives in Fort Lauderdale.
- Senior Executive Producer of Patriots TV (PTV) — school's daily live news show
- Applying to college: top choice Syracuse Newhouse for broadcast journalism. Also BU, Northeastern, NYU, UF, Northwestern
- Media by AG: personal media brand, Sony A7 IV, Sigma 24-70mm f/2.8, Premiere Pro expert, After Effects intermediate
- Cinematic style, VO-led packages, 1-2 stats max, never say "on your screen"
- Jewish. Yankees + Knicks fan. Lives on Las Olas. Loves food, restaurants, horror movies.
- No access to his Gmail, Calendar, or Drive — if needed, ask him to paste the content

HOW TO RESPOND:
- Answer directly first, then explain if needed
- Sound like a smart, helpful assistant — natural and conversational, not robotic
- Use markdown: **bold**, bullet points, numbered lists, tables, headings — when they actually help
- Match response length to the question: short for simple, detailed for complex
- If it's a worksheet or assignment, answer the questions directly and completely, numbered to match
- Never say "the provided text" — say what it actually is (worksheet, PDF, image, etc.)
- Use web search results when provided. For anything current, rely on those results.
- Be honest when unsure. Don't guess and present it as fact.
- No long intros, no fake enthusiasm, no "great question!", no repeating the question back

RESPONSE STYLE:
1. Direct answer first
2. Short explanation if useful
3. Action steps or examples if needed
4. One follow-up question only if genuinely unclear`;

const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
const fmtDate = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const isImage = (f) => f.type?.startsWith("image/");

function inlineFormat(text, keyPrefix = "") {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match;
  let k = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={keyPrefix + k++}>{text.slice(last, match.index)}</span>);
    if (match[2]) parts.push(<strong key={keyPrefix + k++} style={{ color: TEXT, fontWeight: 600 }}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={keyPrefix + k++}>{match[3]}</em>);
    else if (match[4]) parts.push(<code key={keyPrefix + k++} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 13 }}>{match[4]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(<span key={keyPrefix + k++}>{text.slice(last)}</span>);
  return parts.length > 0 ? parts : text;
}

function renderMarkdown(text) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;
  let kc = 0;
  const k = () => kc++;

  while (i < lines.length) {
    const line = lines[i];

    // Table
    if (line.includes("|") && lines[i + 1]?.match(/^\|[-| :]+\|$/)) {
      const headers = line.split("|").filter(c => c.trim()).map(c => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").filter(c => c.trim()).map(c => c.trim()));
        i++;
      }
      elements.push(
        <div key={k()} style={{ overflowX: "auto", marginBottom: 12 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr>{headers.map((h, j) => <th key={j} style={{ border: `1px solid rgba(255,255,255,0.15)`, padding: "6px 10px", textAlign: "left", background: "rgba(255,255,255,0.05)", color: TEXT, fontWeight: 600 }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, j) => (
                <tr key={j}>{row.map((cell, kk) => <td key={kk} style={{ border: `1px solid rgba(255,255,255,0.1)`, padding: "5px 10px", color: TEXT2, fontSize: 13 }}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    if (h1) { elements.push(<div key={k()} style={{ fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 8, marginTop: 12 }}>{inlineFormat(h1[1])}</div>); i++; continue; }
    if (h2) { elements.push(<div key={k()} style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6, marginTop: 10 }}>{inlineFormat(h2[1])}</div>); i++; continue; }
    if (h3) { elements.push(<div key={k()} style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4, marginTop: 8 }}>{inlineFormat(h3[1])}</div>); i++; continue; }

    // Bullet list
    if (line.match(/^[-*] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].replace(/^[-*] /, ""));
        i++;
      }
      elements.push(
        <ul key={k()} style={{ paddingLeft: 18, marginBottom: 8, marginTop: 2 }}>
          {items.map((item, j) => <li key={j} style={{ color: TEXT, fontSize: 14, lineHeight: 1.65, marginBottom: 3 }}>{inlineFormat(item, `li${j}`)}</li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={k()} style={{ paddingLeft: 18, marginBottom: 8, marginTop: 2 }}>
          {items.map((item, j) => <li key={j} style={{ color: TEXT, fontSize: 14, lineHeight: 1.65, marginBottom: 3 }}>{inlineFormat(item, `ol${j}`)}</li>)}
        </ol>
      );
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      i++;
      elements.push(
        <pre key={k()} style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, overflowX: "auto", marginBottom: 10, color: "#a8d8a8", fontFamily: "monospace", lineHeight: 1.5 }}>
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") { elements.push(<div key={k()} style={{ height: 6 }} />); i++; continue; }

    // Paragraph
    elements.push(<p key={k()} style={{ color: TEXT, fontSize: 14, lineHeight: 1.7, marginBottom: 4 }}>{inlineFormat(line, `p${i}`)}</p>);
    i++;
  }

  return elements;
}

function Avatar({ size = 32, orion = false }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: orion ? `linear-gradient(135deg, ${ACCENT}, #7B2FFF)` : BG3, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.4, fontWeight: 800, color: orion ? "#fff" : TEXT2, fontFamily: "monospace" }}>
      {orion ? "O" : "A"}
    </div>
  );
}

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-end" }}>
      <Avatar size={28} orion={!isUser} />
      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 4 }}>
        {msg.fileName && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "8px 12px", marginBottom: 4 }}>
            {msg.fileType?.startsWith("image/") ? <span style={{ fontSize: 20 }}>🖼</span> : <span style={{ fontSize: 20 }}>📄</span>}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{msg.fileName}</div>
              <div style={{ fontSize: 11, color: TEXT2 }}>{msg.fileType || "File"}</div>
            </div>
          </div>
        )}
        <div style={{
          padding: "12px 16px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser ? ACCENT : BG3,
          color: "#fff", fontSize: 14, lineHeight: 1.65, wordBreak: "break-word",
          border: isUser ? "none" : `1px solid ${BORDER}`,
        }}>
          {isUser
            ? <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
            : renderMarkdown(msg.content)
          }
        </div>
        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 4, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: TEXT2 }}>Sources:</span>
            {msg.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: ACCENT, textDecoration: "none", background: ACCENT_DIM, borderRadius: 6, padding: "2px 7px", border: `1px solid rgba(255,45,120,0.2)` }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                {s.title.length > 30 ? s.title.slice(0, 30) + "…" : s.title}
              </a>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: TEXT2, paddingLeft: 4, paddingRight: 4 }}>{msg.time || ""}</div>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "flex-end" }}>
      <Avatar size={28} orion />
      <div style={{ padding: "14px 18px", borderRadius: "18px 18px 18px 4px", background: BG3, border: `1px solid ${BORDER}`, display: "flex", gap: 5, alignItems: "center" }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: TEXT2, animation: "blink 1.2s ease-in-out infinite", animationDelay: `${i*0.2}s` }} />)}
      </div>
    </div>
  );
}

function FilePreview({ file, onRemove }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (isImage(file)) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);
  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${BORDER}`, background: BG3, width: 72, height: 72, flexShrink: 0 }}>
      {src
        ? <img src={src} style={{ width: 72, height: 72, objectFit: "cover", display: "block" }} />
        : <div style={{ width: 72, height: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 8 }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <span style={{ fontSize: 9, color: TEXT2, textAlign: "center", wordBreak: "break-all" }}>{file.name.slice(0, 12)}</span>
          </div>}
      <button onClick={onRemove} style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
    </div>
  );
}

export default function Orion() {
  const [mounted,      setMounted]      = useState(false);
  const [time,         setTime]         = useState(null);
  const [chats,        setChats]        = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [memory,       setMemory]       = useState([]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [files,        setFiles]        = useState([]);
  const [dragging,     setDragging]     = useState(false);
  const [showSidebar,  setShowSidebar]  = useState(false);
  const [isMobile,     setIsMobile]     = useState(false);
  const [dbReady,      setDbReady]      = useState(false);
  const [quickActions, setQuickActions] = useState(DEFAULT_ACTIONS);

  const endRef  = useRef(null);
  const fileRef = useRef(null);
  const taRef   = useRef(null);

  useEffect(() => {
    setMounted(true);
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 60000);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    loadChats();
    loadMemory();
    return () => { clearInterval(t); window.removeEventListener("resize", checkMobile); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (activeChatId) { loadMessages(activeChatId); setQuickActions(DEFAULT_ACTIONS); } }, [activeChatId]);

  const loadChats = async () => {
    const { data, error } = await supabase.from("chats").select("*").order("updated_at", { ascending: false });
    if (error) { console.error(error); return; }
    setDbReady(true);
    if (!data || data.length === 0) { await createChat("New Chat"); }
    else { setChats(data); setActiveChatId(data[0].id); }
  };

  const loadMessages = async (chatId) => {
    const { data } = await supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true });
    if (!data || data.length === 0) {
      setMessages([{ role: "assistant", content: "Hey Adam — what do you need?", time: fmtTime(new Date()) }]);
    } else {
      setMessages(data.map(m => ({ role: m.role, content: m.content, time: fmtTime(new Date(m.created_at)) })));
    }
  };

  const loadMemory = async () => {
    const { data } = await supabase.from("memory").select("*").order("updated_at", { ascending: false }).limit(50);
    if (data) setMemory(data.map(m => m.fact));
  };

  const createChat = async (name) => {
    const id = Date.now().toString();
    const { error } = await supabase.from("chats").insert({ id, name });
    if (error) { console.error(error); return; }
    const newChat = { id, name, updated_at: new Date().toISOString() };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(id);
    setMessages([{ role: "assistant", content: "New chat — what do you need?", time: fmtTime(new Date()) }]);
    setQuickActions(DEFAULT_ACTIONS);
    if (isMobile) setShowSidebar(false);
  };

  const deleteChat = async (id) => {
    await supabase.from("chats").delete().eq("id", id);
    const updated = chats.filter(c => c.id !== id);
    setChats(updated);
    if (activeChatId === id) {
      if (updated.length > 0) setActiveChatId(updated[0].id);
      else createChat("New Chat");
    }
  };

  const renameChat = async (id, name) => {
    await supabase.from("chats").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
    setChats(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const saveMessage = async (chatId, role, content) => {
    await supabase.from("messages").insert({ chat_id: chatId, role, content });
    await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, updated_at: new Date().toISOString() } : c).sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)));
  };

  const autoNameChat = async (chatId, firstMessage) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "name", firstMessage }),
      });
      const data = await res.json();
      if (data.name) await renameChat(chatId, data.name);
    } catch {}
  };

  const updateQuickActions = async (msgs) => {
    try {
      const context = msgs.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 100)}`).join("\n");
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "quickactions", context }),
      });
      const data = await res.json();
      if (data.actions) setQuickActions(data.actions);
    } catch {}
  };

  const extractMemory = async (userMsg, reply) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "Extract memorable personal facts from this conversation as a JSON array of short strings. Return [] if nothing worth saving. JSON only, no markdown.",
          messages: [{ role: "user", content: `User: "${userMsg}" Orion: "${reply}"` }]
        }),
      });
      const data = await res.json();
      const text = (data.content?.[0]?.text || "[]").replace(/```json|```/g, "").trim();
      const facts = JSON.parse(text);
      if (Array.isArray(facts) && facts.length > 0) {
        for (const fact of facts) await supabase.from("memory").insert({ fact, category: "auto" });
        loadMemory();
      }
    } catch {}
  };

  const addFiles = useCallback((f) => setFiles(p => [...p, ...Array.from(f)]), []);

  const send = async (override) => {
    const text = override ?? input.trim();
    if ((!text && files.length === 0) || loading || !activeChatId) return;
    setInput("");
    if (taRef.current) { taRef.current.style.height = "auto"; }

    const attachedFiles = [...files];
    const fileName = attachedFiles.length > 0 ? attachedFiles[0].name : null;
    const fileType = attachedFiles.length > 0 ? attachedFiles[0].type : null;
    const userContent = text || "Please analyze the attached file.";
    setFiles([]);

    const t = fmtTime(new Date());
    const newMessages = [...messages, { role: "user", content: userContent, time: t, fileName, fileType }];
    setMessages(newMessages);
    await saveMessage(activeChatId, "user", userContent);

    const isFirstMessage = messages.filter(m => m.role === "user").length === 0;
    if (isFirstMessage) {
      const nameSource = fileName ? `File uploaded: ${fileName}. User said: ${text || "analyze this file"}` : text;
      autoNameChat(activeChatId, nameSource);
    }

    setLoading(true);
    try {
      let reply = "";
      let sources = [];

      if (attachedFiles.length > 0) {
        const formData = new FormData();
        formData.append("file", attachedFiles[0]);
        formData.append("prompt", text || "");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        reply = data.content?.[0]?.text || "No response.";
      } else {
        const memCtx = memory.length > 0 ? `\n\nORION MEMORY:\n${memory.slice(0,20).map((f,i)=>`${i+1}. ${f}`).join("\n")}` : "";
        const res = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: ADAM_CONTEXT + memCtx,
            messages: newMessages.map(m => ({ role: m.role, content: m.content }))
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        reply = data.content?.[0]?.text || "No response.";
        sources = data.sources || [];
      }

      const replyTime = fmtTime(new Date());
      const updatedMessages = [...newMessages, { role: "assistant", content: reply, time: replyTime, sources }];
      setMessages(updatedMessages);
      await saveMessage(activeChatId, "assistant", reply);
      extractMemory(userContent, reply);
      updateQuickActions(updatedMessages);

    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: " + (err.message || "something went wrong."), time: fmtTime(new Date()) }]);
    } finally {
      setLoading(false);
    }
  };

  const canSend = (input.trim() || files.length > 0) && !loading;
  const activeChat = chats.find(c => c.id === activeChatId);
  if (!mounted) return null;

  const Sidebar = () => (
    <div style={{ width: isMobile ? "100%" : 280, background: BG2, borderRight: isMobile ? "none" : `1px solid ${BORDER}`, display: "flex", flexDirection: "column", height: "100%", position: isMobile ? "fixed" : "relative", left: 0, top: 0, zIndex: isMobile ? 50 : "auto", transition: "transform 0.25s ease", transform: isMobile && !showSidebar ? "translateX(-100%)" : "translateX(0)" }}>
      <div style={{ padding: "20px 16px 12px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: "0.05em" }}>ORION</div>
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>Adam Ginsburg</div>
          </div>
          {isMobile && <button onClick={() => setShowSidebar(false)} style={{ background: "none", border: "none", color: TEXT2, fontSize: 22, cursor: "pointer" }}>×</button>}
        </div>
        <button onClick={() => createChat("New Chat")} style={{ width: "100%", padding: "10px 0", background: ACCENT, border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>+</span> New Chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: TEXT2, padding: "0 8px", marginBottom: 6 }}>RECENT</div>
        {chats.map(chat => (
          <button key={chat.id} onClick={() => { setActiveChatId(chat.id); if (isMobile) setShowSidebar(false); }}
            style={{ width: "100%", textAlign: "left", border: "none", borderRadius: 10, padding: "10px 12px", marginBottom: 2, cursor: "pointer", background: chat.id === activeChatId ? ACCENT_DIM : "transparent", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: chat.id === activeChatId ? ACCENT : BG3, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: chat.id === activeChatId ? TEXT : TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chat.name}</span>
            </div>
            <span onClick={e => { e.stopPropagation(); deleteChat(chat.id); }} style={{ color: "#555", fontSize: 16, flexShrink: 0, lineHeight: 1, cursor: "pointer" }}>×</span>
          </button>
        ))}
      </div>

      {memory.length > 0 && (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: TEXT2, marginBottom: 6 }}>MEMORY · {memory.length} FACTS</div>
          <div style={{ fontSize: 11, color: TEXT2, lineHeight: 1.5 }}>
            {memory.slice(0,2).map((f,i) => <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>· {f}</div>)}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #__next { height: 100%; background: ${BG}; font-family: Inter, sans-serif; color: ${TEXT}; overflow: hidden; }
        @keyframes blink { 0%,100%{opacity:.3} 50%{opacity:1} }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${BG3}; border-radius: 2px; }
        textarea { outline: none; font-family: Inter, sans-serif; caret-color: ${ACCENT}; }
        button { font-family: Inter, sans-serif; }
        input { font-family: Inter, sans-serif; }
      `}</style>

      {isMobile && showSidebar && <div onClick={() => setShowSidebar(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }} />}

      {dragging && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,15,20,0.95)", border: `2px dashed ${ACCENT}`, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}
          onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files);}} onDragLeave={()=>setDragging(false)}>
          <span style={{ fontSize: 48 }}>📎</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: ACCENT, letterSpacing: "0.1em" }}>Drop to attach</span>
        </div>
      )}

      <div style={{ height: "100vh", display: "flex", background: BG, overflow: "hidden" }}
        onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files);}}>

        {!isMobile && <Sidebar />}
        {isMobile && <Sidebar />}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Header — no Active/Live status */}
          <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: `1px solid ${BORDER}`, background: BG, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {isMobile && (
                <button onClick={() => setShowSidebar(true)} style={{ background: "none", border: "none", color: TEXT2, fontSize: 20, cursor: "pointer", padding: 4 }}>☰</button>
              )}
              <Avatar size={32} orion />
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{activeChat?.name || "Orion"}</div>
            </div>
            <div style={{ fontSize: 12, color: TEXT2 }}>{time ? fmtDate(time) : ""}</div>
          </div>

          {/* Quick actions */}
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 8, overflowX: "auto", flexShrink: 0 }}>
            {quickActions.map(a => (
              <button key={a} onClick={() => send(a)}
                style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 500, color: TEXT2, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.15s" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=ACCENT;e.currentTarget.style.color=ACCENT;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.color=TEXT2;}}>
                {a}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 10px" }}>
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
            {loading && <Dots />}
            <div ref={endRef} />
          </div>

          {/* File previews */}
          {files.length > 0 && (
            <div style={{ padding: "8px 20px", display: "flex", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${BORDER}` }}>
              {files.map((f, i) => <FilePreview key={i} file={f} onRemove={() => setFiles(p => p.filter((_, j) => j !== i))} />)}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "12px 20px 20px", flexShrink: 0 }}>
            <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => fileRef.current?.click()}
                style={{ width: 36, height: 36, borderRadius: 10, background: BG3, border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=ACCENT;e.currentTarget.style.background=ACCENT_DIM;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.background=BG3;}}>
                <span style={{ fontSize: 18, color: TEXT2 }}>📎</span>
              </button>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: "none" }}
                onChange={e=>{ const picked = Array.from(e.target.files); e.target.value=""; setFiles(p => [...p, ...picked]); }} />

              <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                placeholder="Ask Orion anything..." rows={1}
                style={{ flex:1, background:"none", border:"none", resize:"none", color:TEXT, fontSize:15, lineHeight:1.5, maxHeight:120, overflowY:"auto", display:"flex", alignItems:"center", paddingTop: 2 }}
                onInput={e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}} />

              <button onClick={()=>send()} disabled={!canSend}
                style={{ width:38, height:38, borderRadius:10, border:"none", cursor:canSend?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:16, fontWeight:700, transition:"all 0.15s", background:canSend?ACCENT:BG3, color:canSend?"#fff":TEXT2 }}>
                {loading ? <span style={{animation:"spin 0.8s linear infinite",display:"inline-block"}}>↻</span> : "↑"}
              </button>
            </div>
            <div style={{ textAlign:"center", marginTop:8, fontSize:11, color:"#333", letterSpacing:"0.08em" }}>Orion · Powered by Groq + Tavily · Free</div>
          </div>
        </div>
      </div>
    </>
  );
}
