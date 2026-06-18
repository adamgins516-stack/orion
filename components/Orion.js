"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const NEON = "#FF2D78";
const NEON_DIM = "rgba(255,45,120,0.10)";
const NEON_BORDER = "rgba(255,45,120,0.28)";

const ADAM_CONTEXT = `You are Orion, the personal AI assistant built exclusively for Adam Ginsburg. You are a sharp, knowledgeable chief of staff who knows everything about him.

IDENTITY: Adam Ginsburg, rising senior Class of 2027, American Heritage School, Plantation FL. Lives on Las Olas, Fort Lauderdale. Jewish. Email: aginsburg16@gmail.com. iPhone 17 Pro, MacBook Pro 16 inch. License since May 2025.

PTV: Senior Executive Producer, Patriots TV daily live show at American Heritage. Manages scripts, rundowns, crew, control room, field production. VO-led packages, cinematic pacing, 1-2 stats max, clean broadcast writing. Never say on your screen.

MEDIA BY AG: Personal brand. Sony A7 IV, Sigma 24-70mm f/2.8, SmallRig cage, K&F 90 inch tripod, Feelworld monitor, DJI Mic Mini, Sennheiser MKE 600. Expert Premiere Pro, intermediate After Effects. Cinematic montage style, VO-led, 30-90 sec finals.

COLLEGE: Top choice Syracuse Newhouse, broadcast journalism. Also BU, Northeastern, NYU, UF, Northwestern. Wants established outlet, not freelance.

FAMILY: Dad is real estate developer. Mom from Long Island. Brother Brad in college. Jewish identity matters.

NEW YORK: Goes often. Hamptons. Camp Hancock NY since 2018, CIT this summer. Yankees and Knicks fan.

PERSONAL: Breakfast every morning. Iced vanilla latte. Loves food, restaurants, cooking, grows scallions. Horror movies.

CRITICAL RULES:
- You do NOT have access to Adams real Gmail, Google Calendar, or Google Drive. If asked say: I do not have access to your actual Gmail or Calendar. Paste the content here and I will help.
- You DO have web search. Use it proactively for anything current, news, weather, sports, or time-sensitive.
- Never make up emails, calendar events, or file contents.

RESPONSE STYLE: Direct, no fluff, match length to task.`;

const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const fmtDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
const isImage = (f) => f.type?.startsWith("image/");

function FileChip({ file, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#777" }}>
      <span>{isImage(file) ? "🖼" : "📎"}</span>
      <span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
      <button onClick={onRemove} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, padding: "0 2px", lineHeight: 1 }}>×</button>
    </div>
  );
}

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexDirection: isUser ? "row-reverse" : "row", maxWidth: "75%" }}>
        {!isUser && (
          <div style={{ width: 26, height: 26, borderRadius: 5, background: "#0d0d0d", border: `1px solid ${NEON_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: NEON, flexShrink: 0, fontFamily: "monospace" }}>O</div>
        )}
        <div style={{
          padding: "11px 15px", fontSize: 14, lineHeight: 1.7,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          background:   isUser ? "#fff" : "#0a0a0a",
          color:        isUser ? "#000" : "#b0b0b0",
          borderRadius: isUser ? "14px 14px 3px 14px" : "3px 14px 14px 14px",
          border:       isUser ? "none" : "1px solid #1a1a1a",
          fontWeight:   isUser ? 500 : 400,
        }}>
          {msg.files?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {msg.files.map((f, i) => (
                <span key={i} style={{ display: "inline-block", background: "#f0f0f0", borderRadius: 4, padding: "2px 8px", fontSize: 11, color: "#666", marginRight: 4 }}>
                  {isImage(f) ? "🖼" : "📎"} {f.name}
                </span>
              ))}
            </div>
          )}
          {msg.content}
        </div>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "flex-start", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 5, background: "#0d0d0d", border: `1px solid ${NEON_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: NEON, flexShrink: 0, fontFamily: "monospace" }}>O</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "12px 16px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "3px 14px 14px 14px" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: NEON, animation: "blink 1.1s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const DEFAULT_CHAT = { id: "default", name: "General", messages: [{ role: "assistant", content: "Hey Adam — Orion is live. I can search the web, help with PTV, college apps, and anything else. What do you need?" }] };

export default function Orion() {
  const [mounted,      setMounted]      = useState(false);
  const [time,         setTime]         = useState(null);
  const [chats,        setChats]        = useState([DEFAULT_CHAT]);
  const [activeChatId, setActiveChatId] = useState("default");
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [files,        setFiles]        = useState([]);
  const [dragging,     setDragging]     = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [editingName,  setEditingName]  = useState("");

  const endRef  = useRef(null);
  const fileRef = useRef(null);
  const taRef   = useRef(null);

  useEffect(() => {
    setMounted(true);
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    try {
      const saved = localStorage.getItem("orion_chats");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) { setChats(parsed); setActiveChatId(parsed[0].id); }
      }
    } catch {}
    return () => clearInterval(t);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats, activeChatId, loading]);

  const saveChats = (updated) => {
    setChats(updated);
    try { localStorage.setItem("orion_chats", JSON.stringify(updated)); } catch {}
  };

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];
  const messages   = activeChat?.messages || [];

  const addFiles = useCallback((f) => setFiles(p => [...p, ...Array.from(f)]), []);

  const newChat = () => {
    const id   = Date.now().toString();
    const chat = { id, name: "New Chat", messages: [{ role: "assistant", content: "New chat. What do you need?" }] };
    saveChats([chat, ...chats]);
    setActiveChatId(id);
  };

  const deleteChat = (id) => {
    const updated = chats.filter(c => c.id !== id);
    if (updated.length === 0) { saveChats([DEFAULT_CHAT]); setActiveChatId("default"); }
    else { saveChats(updated); if (activeChatId === id) setActiveChatId(updated[0].id); }
  };

  const updateMessages = (chatId, newMessages) => {
    saveChats(chats.map(c => c.id === chatId ? { ...c, messages: newMessages } : c));
  };

  const renameChat = (id, name) => {
    saveChats(chats.map(c => c.id === id ? { ...c, name } : c));
    setEditingId(null);
  };

  const send = async (override) => {
    const text = override ?? input.trim();
    if ((!text && files.length === 0) || loading) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

    const userMsg     = { role: "user", content: text || "Please analyze the attached file.", files: [...files] };
    const newMessages = [...messages, userMsg];
    updateMessages(activeChatId, newMessages);
    const attachedFiles = [...files];
    setFiles([]);
    setLoading(true);

    if (messages.length <= 1 && text) {
      const name = text.slice(0, 30) + (text.length > 30 ? "..." : "");
      saveChats(chats.map(c => c.id === activeChatId ? { ...c, name, messages: newMessages } : c));
    }

    try {
      let reply = "";
      if (attachedFiles.length > 0 && isImage(attachedFiles[0])) {
        const formData = new FormData();
        formData.append("file", attachedFiles[0]);
        formData.append("prompt", text || "Please analyze this image in detail.");
        const res  = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        reply = data.content?.[0]?.text || "No response.";
      } else {
        const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content || "" }));
        const res  = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ system: ADAM_CONTEXT, messages: apiMessages }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        reply = data.content?.[0]?.text || "No response.";
      }
      updateMessages(activeChatId, [...newMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      updateMessages(activeChatId, [...newMessages, { role: "assistant", content: "Error: " + (err.message || "something went wrong.") }]);
    } finally {
      setLoading(false);
    }
  };

  const canSend = (input.trim() || files.length > 0) && !loading;
  if (!mounted) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #__next { height: 100%; width: 100%; background: #000; overflow: hidden; }
        @keyframes blink { 0%,100%{opacity:.2;transform:scale(.7)} 50%{opacity:1;transform:scale(1)} }
        @keyframes breathe { 0%,100%{box-shadow:0 0 4px ${NEON};opacity:.6} 50%{box-shadow:0 0 12px ${NEON},0 0 24px ${NEON}44;opacity:1} }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 2px; }
        textarea { outline: none; font-family: Inter, sans-serif; caret-color: ${NEON}; }
        button { font-family: Inter, sans-serif; }
        .chat-item { width: 100%; text-align: left; border: none; cursor: pointer; border-radius: 7px; padding: 8px 10px; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: space-between; gap: 6px; transition: all 0.15s; border-left: 2px solid transparent; }
        .chat-item:hover .del { opacity: 1 !important; }
        .qa-btn { background: #080808; border: 1px solid #191919; border-radius: 7px; padding: 6px 13px; cursor: pointer; color: #3a3a3a; font-size: 12px; font-weight: 500; white-space: nowrap; flex-shrink: 0; transition: all 0.15s; }
        .qa-btn:hover { border-color: ${NEON_BORDER}; color: ${NEON}; background: ${NEON_DIM}; }
      `}</style>

      {dragging && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", border: `2px dashed ${NEON}`, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }} onDragLeave={() => setDragging(false)}>
          <div style={{ fontSize: 42 }}>📎</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 14, color: NEON, letterSpacing: "0.25em" }}>DROP TO ATTACH</div>
        </div>
      )}

      <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", background: "#000", fontFamily: "Inter, sans-serif", color: "#fff", overflow: "hidden" }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>

        {/* Status bar */}
        <div style={{ height: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid #111", background: "#000" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: NEON, animation: "breathe 2.4s ease-in-out infinite" }} />
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#333", letterSpacing: "0.14em" }}>ORION · LIVE</span>
          </div>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#2a2a2a", letterSpacing: "0.12em" }}>{time ? `${fmtDate(time)} · ${fmtTime(time)}` : ""}</span>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

          {/* Sidebar */}
          <div style={{ width: 200, minWidth: 200, background: "#000", borderRight: "1px solid #111", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "20px 16px 14px" }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.22em", color: "#fff" }}>ORION</div>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#2a2a2a", marginTop: 2 }}>ADAM GINSBURG</div>
            </div>
            <div style={{ padding: "0 12px 12px" }}>
              <button onClick={newChat} style={{ width: "100%", padding: "8px 0", background: NEON_DIM, border: `1px solid ${NEON_BORDER}`, borderRadius: 7, color: NEON, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer" }}>+ NEW CHAT</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "#222", marginBottom: 6, paddingLeft: 4 }}>CHATS</div>
              {chats.map(chat => (
                <div key={chat.id} style={{ marginBottom: 2 }}>
                  {editingId === chat.id ? (
                    <input value={editingName} onChange={e => setEditingName(e.target.value)}
                      onBlur={() => renameChat(chat.id, editingName || chat.name)}
                      onKeyDown={e => { if (e.key === "Enter") renameChat(chat.id, editingName || chat.name); if (e.key === "Escape") setEditingId(null); }}
                      autoFocus style={{ width: "100%", background: "#111", border: `1px solid ${NEON_BORDER}`, borderRadius: 6, padding: "7px 8px", fontSize: 12, color: "#fff", outline: "none" }} />
                  ) : (
                    <button className="chat-item" onClick={() => setActiveChatId(chat.id)} onDoubleClick={() => { setEditingId(chat.id); setEditingName(chat.name); }}
                      style={{ background: chat.id === activeChatId ? NEON_DIM : "transparent", color: chat.id === activeChatId ? NEON : "#444", borderLeft: chat.id === activeChatId ? `2px solid ${NEON}` : "2px solid transparent" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{chat.name}</span>
                      <span className="del" onClick={e => { e.stopPropagation(); deleteChat(chat.id); }} style={{ opacity: 0, color: "#555", fontSize: 16, lineHeight: 1, transition: "opacity 0.15s", cursor: "pointer" }}>×</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid #0e0e0e" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "#222", marginBottom: 6 }}>POWERED BY</div>
              {["Groq · Llama 3.3", "Tavily Search"].map(n => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: NEON, boxShadow: `0 0 5px ${NEON}55` }} />
                  <span style={{ fontSize: 11, color: "#2e2e2e" }}>{n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
            <div style={{ padding: "10px 24px", borderBottom: "1px solid #0e0e0e", display: "flex", alignItems: "center", gap: 8, overflowX: "auto", minHeight: 44, flexShrink: 0 }}>
              {["What's in the news today?", "Help with a PTV rundown", "Work on my Syracuse essay", "Weather in Fort Lauderdale"].map(a => (
                <button key={a} className="qa-btn" onClick={() => send(a)}>{a}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px 10px", minHeight: 0, display: "flex", flexDirection: "column" }}>
              {messages.map((m, i) => <Bubble key={i} msg={m} />)}
              {loading && <Dots />}
              <div ref={endRef} />
            </div>
            <div style={{ padding: "12px 24px 20px", flexShrink: 0, background: "#000" }}>
              {files.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, padding: "9px 12px", background: "#080808", border: "1px solid #191919", borderRadius: 9 }}>
                  {files.map((f, i) => <FileChip key={i} file={f} onRemove={() => setFiles(p => p.filter((_, j) => j !== i))} />)}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#080808", border: "1px solid #1a1a1a", borderRadius: 11, padding: "10px 12px" }}>
                <label htmlFor="orion-file-input" style={{ width: 34, height: 34, borderRadius: 7, background: "#0d0d0d", border: "1px solid #1e1e1e", cursor: "pointer", color: "#333", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = NEON_BORDER; e.currentTarget.style.color = NEON; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#333"; }}>+</label>
                <input id="orion-file-input" type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: "none" }} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
                <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask Orion anything..." rows={1}
                  style={{ flex: 1, background: "none", border: "none", resize: "none", color: "#ddd", fontSize: 14, lineHeight: 1.6, maxHeight: 130, overflowY: "auto" }}
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px"; }} />
                <button onClick={() => send()} disabled={!canSend}
                  style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: canSend ? "pointer" : "not-allowed", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", background: canSend ? NEON : "#111", color: canSend ? "#000" : "#2a2a2a" }}>
                  {loading ? <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>↻</span> : "↑"}
                </button>
              </div>
              <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, color: "#1c1c1c", letterSpacing: "0.15em" }}>ORION · GROQ · TAVILY · FREE</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
