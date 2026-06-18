"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const NEON = "#FF2D78";
const NEON_DIM = "rgba(255,45,120,0.10)";
const NEON_BORDER = "rgba(255,45,120,0.28)";

const SECTIONS = [
  { id: "all",      label: "All",      icon: "⊞" },
  { id: "ptv",      label: "PTV",      icon: "🎬" },
  { id: "personal", label: "Personal", icon: "◈"  },
  { id: "college",  label: "College",  icon: "◉"  },
];

const QUICK_ACTIONS = {
  all:      ["What's in the news today?", "Help me think through something", "What's the weather in Fort Lauderdale?"],
  ptv:      ["Build a show rundown", "Write a VO script", "Draft intro copy"],
  personal: ["What's happening in NYC this week?", "Help me plan my week", "Find a restaurant on Las Olas"],
  college:  ["Help with my Syracuse essay", "Draft a short answer", "Application strategy"],
};

const SECTION_CONTEXT = {
  all:      "",
  ptv:      "USER IS IN PTV MODE. Focus: Patriots TV production, rundowns, scripts, VO writing, broadcast copy, control room. Adam is Senior Executive Producer. Broadcast-tight copy, cinematic pacing, 1-2 stats max. Never say 'on your screen.'",
  personal: "USER IS IN PERSONAL MODE. Help with life logistics, planning, food, NYC, camp, family. Be casual and direct.",
  college:  "USER IS IN COLLEGE MODE. Focus on college applications. Primary: Syracuse Newhouse (broadcast journalism). Also BU, Northeastern, NYU, UF, Northwestern. Essays, short answers, activity descriptions, interview prep, strategy.",
};

const ADAM_CONTEXT = `You are Orion, the personal AI assistant built exclusively for Adam Ginsburg. You are a sharp, knowledgeable chief of staff who knows everything about him.

IDENTITY: Adam Ginsburg, rising senior Class of 2027, American Heritage School, Plantation FL. Lives on Las Olas, Fort Lauderdale. Jewish. Email: aginsburg16@gmail.com. iPhone 17 Pro, MacBook Pro 16 inch. License since May 2025.

PTV: Senior Executive Producer, Patriots TV daily live show at American Heritage. Manages scripts, rundowns, crew, control room, field production. VO-led packages, cinematic pacing, 1-2 stats max, clean broadcast writing. Never say on your screen.

MEDIA BY AG: Personal brand. Sony A7 IV, Sigma 24-70mm f/2.8, SmallRig cage, K&F 90 inch tripod, Feelworld monitor, DJI Mic Mini, Sennheiser MKE 600. Expert Premiere Pro, intermediate After Effects. Cinematic montage style, VO-led, 30-90 sec finals.

COLLEGE: Top choice Syracuse Newhouse, broadcast journalism. Also BU, Northeastern, NYU, UF, Northwestern. Wants established outlet, not freelance.

FAMILY: Dad is real estate developer. Mom from Long Island. Brother Brad in college. Jewish identity matters.

NEW YORK: Goes often. Hamptons. Camp Hancock NY since 2018, CIT this summer. Yankees and Knicks fan.

PERSONAL: Breakfast every morning. Iced vanilla latte. Loves food, restaurants, cooking, grows scallions. Horror movies.

CRITICAL: You do NOT have access to Adam's real Gmail, Google Calendar, or Google Drive. If asked about emails, calendar, or files say: I do not have access to your actual Gmail or Calendar. You can paste content here and I will help you with it. You DO have web search. Use it for anything current, news, weather, sports, or time-sensitive.

RESPONSE STYLE: Direct, no fluff, match length to task.`;

const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const fmtDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
const isImage = (f) => f.type?.startsWith("image/");
const isPDF   = (f) => f.type === "application/pdf" || f.name?.endsWith(".pdf");

function FileChip({ file, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#777" }}>
      <span>{isImage(file) ? "🖼" : isPDF(file) ? "📄" : "📎"}</span>
      <span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
      <button onClick={onRemove} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, padding: "0 2px", lineHeight: 1 }}>×</button>
    </div>
  );
}

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 20 }}>
      {msg.files?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7, justifyContent: isUser ? "flex-end" : "flex-start" }}>
          {msg.files.map((f, i) => (
            <div key={i} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#555" }}>
              {isImage(f) ? "🖼" : isPDF(f) ? "📄" : "📎"} {f.name}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexDirection: isUser ? "row-reverse" : "row", maxWidth: "100%" }}>
        {!isUser && (
          <div style={{ width: 26, height: 26, borderRadius: 5, background: "#0d0d0d", border: `1px solid ${NEON_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: NEON, flexShrink: 0, fontFamily: "monospace" }}>O</div>
        )}
        <div style={{
          maxWidth: "72%", padding: "11px 15px", fontSize: 14, lineHeight: 1.7,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          background:   isUser ? "#ffffff" : "#0a0a0a",
          color:        isUser ? "#000000" : "#b0b0b0",
          borderRadius: isUser ? "14px 14px 3px 14px" : "3px 14px 14px 14px",
          border:       isUser ? "none" : "1px solid #1a1a1a",
          fontWeight:   isUser ? 500 : 400,
        }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 20 }}>
      <div style={{ width: 26, height: 26, borderRadius: 5, background: "#0d0d0d", border: `1px solid ${NEON_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: NEON, flexShrink: 0, fontFamily: "monospace" }}>O</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "12px 16px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "3px 14px 14px 14px" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: NEON, animation: "blink 1.1s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  );
}

export default function Orion() {
  const [mounted,  setMounted]  = useState(false);
  const [section,  setSection]  = useState("all");
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hey Adam — Orion is live. I can search the web, help with PTV, college apps, and anything else. What do you need?", section: "all" }]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [files,    setFiles]    = useState([]);
  const [dragging, setDragging] = useState(false);
  const [time,     setTime]     = useState(null);

  const endRef  = useRef(null);
  const fileRef = useRef(null);
  const taRef   = useRef(null);

  useEffect(() => {
    setMounted(true);
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const addFiles = useCallback((f) => setFiles(p => [...p, ...Array.from(f)]), []);

  const send = async (override) => {
    const text = override ?? input.trim();
    if ((!text && files.length === 0) || loading) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

    const userMsg = { role: "user", content: text || "Please analyze the attached file.", files: [...files], section };
    const next = [...messages, userMsg];
    setMessages(next);
    const attachedFiles = [...files];
    setFiles([]);
    setLoading(true);

    try {
      let reply = "";

      if (attachedFiles.length > 0 && isImage(attachedFiles[0])) {
        // Use upload route for images
        const formData = new FormData();
        formData.append("file", attachedFiles[0]);
        formData.append("prompt", text || "Please analyze this image.");
        const res  = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        reply = data.content?.[0]?.text || "No response.";
      } else {
        // Use chat route for text
        const apiMessages = next.map(m => ({
          role: m.role,
          content: m.content || "",
        }));
        const system = ADAM_CONTEXT + (SECTION_CONTEXT[section] ? "\n\n" + SECTION_CONTEXT[section] : "");
        const res  = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ system, messages: apiMessages }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        reply = data.content?.[0]?.text || "No response.";
      }

      setMessages(prev => [...prev, { role: "assistant", content: reply, section }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: " + (err.message || "something went wrong."), section }]);
    } finally {
      setLoading(false);
    }
  };

  const visible = section === "all" ? messages : messages.filter(m => m.section === section);
  const sec     = SECTIONS.find(s => s.id === section);
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
      `}</style>

      {dragging && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", border: `2px dashed ${NEON}`, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onDragLeave={() => setDragging(false)}>
          <div style={{ fontSize: 42 }}>📎</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 14, color: NEON, letterSpacing: "0.25em" }}>DROP TO ATTACH</div>
        </div>
      )}

      <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", background: "#000", fontFamily: "Inter, sans-serif", color: "#fff", overflow: "hidden" }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>

        {/* Status bar */}
        <div style={{ height: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid #111", background: "#000" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: NEON, animation: "breathe 2.4s ease-in-out infinite" }} />
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#333", letterSpacing: "0.14em" }}>ORION · LIVE · {sec?.label.toUpperCase()}</span>
          </div>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#2a2a2a", letterSpacing: "0.12em" }}>
            {time ? `${fmtDate(time)} · ${fmtTime(time)}` : ""}
          </span>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

          {/* Sidebar */}
          <div style={{ width: 176, minWidth: 176, background: "#000", borderRight: "1px solid #111", display: "flex", flexDirection: "column", padding: "20px 0", overflow: "hidden" }}>
            <div style={{ padding: "0 16px 24px" }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.22em", color: "#fff" }}>ORION</div>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#2a2a2a", marginTop: 3 }}>ADAM GINSBURG</div>
            </div>

            <div style={{ padding: "0 12px 20px" }}>
              <button onClick={() => { setMessages([{ role: "assistant", content: "New chat. What do you need?", section }]); setFiles([]); }}
                style={{ width: "100%", padding: "8px 0", background: NEON_DIM, border: `1px solid ${NEON_BORDER}`, borderRadius: 7, color: NEON, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer" }}>
                + NEW CHAT
              </button>
            </div>

            <div style={{ padding: "0 12px" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "#222", marginBottom: 8, paddingLeft: 4 }}>SECTIONS</div>
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => setSection(s.id)} style={{
                  width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                  borderRadius: 7, padding: "9px 12px", marginBottom: 2,
                  fontSize: 12, fontWeight: 600, letterSpacing: "0.06em",
                  display: "flex", alignItems: "center", gap: 9, transition: "all 0.15s",
                  background:  s.id === section ? NEON_DIM : "transparent",
                  color:       s.id === section ? NEON     : "#333",
                  borderLeft:  s.id === section ? `2px solid ${NEON}` : "2px solid transparent",
                }}>
                  <span style={{ fontSize: 13 }}>{s.icon}</span>{s.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ padding: "14px 16px", borderTop: "1px solid #0e0e0e" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "#222", marginBottom: 8 }}>POWERED BY</div>
              {["Groq · Llama 3.3", "Tavily Search", "Next.js · Vercel"].map(name => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: NEON, boxShadow: `0 0 5px ${NEON}55` }} />
                  <span style={{ fontSize: 11, color: "#2e2e2e", letterSpacing: "0.04em" }}>{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

            {/* Quick actions */}
            <div style={{ padding: "10px 24px", borderBottom: "1px solid #0e0e0e", display: "flex", alignItems: "center", gap: 8, overflowX: "auto", minHeight: 44, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#222", flexShrink: 0, marginRight: 4 }}>{sec?.label.toUpperCase()}</span>
              {(QUICK_ACTIONS[section] || []).map(a => (
                <button key={a} onClick={() => send(a)}
                  style={{ background: "#080808", border: "1px solid #191919", borderRadius: 7, padding: "6px 13px", cursor: "pointer", color: "#3a3a3a", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = NEON_BORDER; e.currentTarget.style.color = NEON; e.currentTarget.style.background = NEON_DIM; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#191919"; e.currentTarget.style.color = "#3a3a3a"; e.currentTarget.style.background = "#080808"; }}>
                  {a}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 10px", minHeight: 0 }}>
              {visible.map((m, i) => <Bubble key={i} msg={m} />)}
              {loading && <Dots />}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 24px 20px", flexShrink: 0, background: "#000" }}>
              {files.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, padding: "9px 12px", background: "#080808", border: "1px solid #191919", borderRadius: 9 }}>
                  {files.map((f, i) => <FileChip key={i} file={f} onRemove={() => setFiles(p => p.filter((_, j) => j !== i))} />)}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#080808", border: "1px solid #1a1a1a", borderRadius: 11, padding: "10px 12px" }}>
                <button onClick={() => fileRef.current?.click()}
                  style={{ width: 34, height: 34, borderRadius: 7, background: "#0d0d0d", border: "1px solid #1e1e1e", cursor: "pointer", color: "#333", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = NEON_BORDER; e.currentTarget.style.color = NEON; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#333"; }}>+</button>
                <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: "none" }}
                  onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />

                <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={section === "all" ? "Ask Orion anything..." : `Ask Orion (${sec?.label} mode)...`}
                  rows={1} style={{ flex: 1, background: "none", border: "none", resize: "none", color: "#ddd", fontSize: 14, lineHeight: 1.6, maxHeight: 130, overflowY: "auto" }}
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
