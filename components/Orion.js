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
const PRIORITY_COLORS = { low: "#4CAF50", medium: "#FF9800", high: ACCENT };
const WMO_DESC = {0:"Clear",1:"Mostly Clear",2:"Partly Cloudy",3:"Overcast",45:"Foggy",48:"Icy Fog",51:"Light Drizzle",53:"Drizzle",55:"Heavy Drizzle",61:"Light Rain",63:"Rain",65:"Heavy Rain",80:"Showers",81:"Showers",82:"Heavy Showers",95:"Thunderstorm",96:"Thunderstorm",99:"Thunderstorm"};
const WMO_ICON = {0:"☀️",1:"🌤",2:"⛅",3:"☁️",45:"🌫",48:"🌫",51:"🌦",53:"🌦",55:"🌧",61:"🌧",63:"🌧",65:"🌧",80:"🌦",81:"🌦",82:"🌧",95:"⛈",96:"⛈",99:"⛈"};
const TASK_KEYWORDS = /\b(test|quiz|exam|homework|hw|assignment|due|deadline|meeting|project|essay|presentation|practice|game|match|event|submit|hand in|turn in)\b/i;
const PRESET_CATEGORIES = ["School", "PTV", "Media by AG", "MUN", "Personal", "College Apps", "Other"];

const STYLE_SUFFIX = {
  balanced: "",
  detailed: "\n\nRESPONSE LENGTH: Give thorough, detailed responses with full explanations.",
  school: "\n\nRESPONSE MODE: Educational/school mode — explain step-by-step, teach concepts fully.",
  professional: "\n\nRESPONSE TONE: Professional and polished, suitable for business contexts.",
  creative: "\n\nRESPONSE STYLE: Be creative, expressive, and imaginative in your responses.",
};

const BASE_CONTEXT = `You are Orion, Adam Ginsburg's personal AI assistant.

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
4. One follow-up question only if genuinely unclear

DASHBOARD LIMITATIONS:
You cannot directly modify, add to, or customize the dashboard. If Adam asks to add something to his dashboard, do not say you will do it or that you've done it — you haven't and can't. Instead, tell him: the weather location can be changed in Settings → Dashboard, and other dashboard widget customization is coming soon. Be brief about it.`;

const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
const fmtDate = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const isImage = (f) => f.type?.startsWith("image/");
const fmtDue = (due) => {
  if (!due) return null;
  const d = new Date(due + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

function inlineFormat(text, keyPrefix = "") {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0, match, k = 0;
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
  let i = 0, kc = 0;
  const k = () => kc++;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes("|") && lines[i + 1]?.match(/^\|[-| :]+\|$/)) {
      const headers = line.split("|").filter(c => c.trim()).map(c => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) { rows.push(lines[i].split("|").filter(c => c.trim()).map(c => c.trim())); i++; }
      elements.push(<div key={k()} style={{ overflowX: "auto", marginBottom: 12 }}><table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}><thead><tr>{headers.map((h, j) => <th key={j} style={{ border: `1px solid rgba(255,255,255,0.15)`, padding: "6px 10px", textAlign: "left", background: "rgba(255,255,255,0.05)", color: TEXT, fontWeight: 600 }}>{h}</th>)}</tr></thead><tbody>{rows.map((row, j) => <tr key={j}>{row.map((cell, kk) => <td key={kk} style={{ border: `1px solid rgba(255,255,255,0.1)`, padding: "5px 10px", color: TEXT2, fontSize: 13 }}>{cell}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const h1 = line.match(/^# (.+)/), h2 = line.match(/^## (.+)/), h3 = line.match(/^### (.+)/);
    if (h1) { elements.push(<div key={k()} style={{ fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 8, marginTop: 12 }}>{inlineFormat(h1[1])}</div>); i++; continue; }
    if (h2) { elements.push(<div key={k()} style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6, marginTop: 10 }}>{inlineFormat(h2[1])}</div>); i++; continue; }
    if (h3) { elements.push(<div key={k()} style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4, marginTop: 8 }}>{inlineFormat(h3[1])}</div>); i++; continue; }
    if (line.match(/^[-*] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) { items.push(lines[i].replace(/^[-*] /, "")); i++; }
      elements.push(<ul key={k()} style={{ paddingLeft: 18, marginBottom: 8, marginTop: 2 }}>{items.map((item, j) => <li key={j} style={{ color: TEXT, fontSize: 14, lineHeight: 1.65, marginBottom: 3 }}>{inlineFormat(item, `li${j}`)}</li>)}</ul>);
      continue;
    }
    if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, "")); i++; }
      elements.push(<ol key={k()} style={{ paddingLeft: 18, marginBottom: 8, marginTop: 2 }}>{items.map((item, j) => <li key={j} style={{ color: TEXT, fontSize: 14, lineHeight: 1.65, marginBottom: 3 }}>{inlineFormat(item, `ol${j}`)}</li>)}</ol>);
      continue;
    }
    if (line.startsWith("```")) {
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      i++;
      elements.push(<pre key={k()} style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, overflowX: "auto", marginBottom: 10, color: "#a8d8a8", fontFamily: "monospace", lineHeight: 1.5 }}>{codeLines.join("\n")}</pre>);
      continue;
    }
    if (line.trim() === "") { elements.push(<div key={k()} style={{ height: 6 }} />); i++; continue; }
    elements.push(<p key={k()} style={{ color: TEXT, fontSize: 14, lineHeight: 1.7, marginBottom: 4 }}>{inlineFormat(line, `p${i}`)}</p>);
    i++;
  }
  return elements;
}

function Avatar({ size = 32, orion = false }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: orion ? `linear-gradient(135deg, ${ACCENT}, #7B2FFF)` : BG3, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.4, fontWeight: 800, color: orion ? "#fff" : TEXT2, fontFamily: "monospace" }}>{orion ? "O" : "A"}</div>;
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
            <div><div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{msg.fileName}</div><div style={{ fontSize: 11, color: TEXT2 }}>{msg.fileType || "File"}</div></div>
          </div>
        )}
        <div style={{ padding: "12px 16px", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isUser ? ACCENT : BG3, color: "#fff", fontSize: 14, lineHeight: 1.65, wordBreak: "break-word", border: isUser ? "none" : `1px solid ${BORDER}` }}>
          {isUser ? <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span> : renderMarkdown(msg.content)}
        </div>
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
      {src ? <img src={src} style={{ width: 72, height: 72, objectFit: "cover", display: "block" }} alt="" />
        : <div style={{ width: 72, height: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 8 }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <span style={{ fontSize: 9, color: TEXT2, textAlign: "center", wordBreak: "break-all" }}>{file.name.slice(0, 12)}</span>
          </div>}
      <button onClick={onRemove} style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
    </div>
  );
}

function DashboardPanel({ tasks, chats, weather, weatherCity, time, quickActions, onManageTasks, onChatSelect, onSend, onToggleTask }) {
  const upcoming = [...tasks].filter(t => !t.completed).sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  }).slice(0, 4);

  const card = (children, style = {}) => (
    <div style={{ background: BG2, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18, ...style }}>{children}</div>
  );
  const label = (txt) => <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: TEXT2, marginBottom: 10, textTransform: "uppercase" }}>{txt}</div>;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px 24px", minHeight: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>{getGreeting()}, Adam</div>
        <div style={{ fontSize: 13, color: TEXT2, marginTop: 3 }}>{time ? fmtDate(time) : ""}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>

        {/* Weather */}
        {card(<>
          {label(`Weather · ${weatherCity || "Fort Lauderdale"}`)}
          {weather ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 44, lineHeight: 1 }}>{WMO_ICON[weather.code] ?? "🌡"}</span>
              <div>
                <div style={{ fontSize: 36, fontWeight: 800, color: TEXT, lineHeight: 1 }}>{Math.round(weather.temp)}°</div>
                <div style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>{WMO_DESC[weather.code] ?? "Unknown"}</div>
                <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>H:{Math.round(weather.high)}° · L:{Math.round(weather.low)}°</div>
              </div>
            </div>
          ) : <div style={{ color: TEXT2, fontSize: 13 }}>Loading weather…</div>}
        </>)}

        {/* Upcoming tasks */}
        {card(<>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            {label("Upcoming Tasks")}
            <button onClick={onManageTasks} style={{ background: "none", border: "none", color: ACCENT, fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: -10 }}>Manage →</button>
          </div>
          {upcoming.length === 0
            ? <div style={{ color: TEXT2, fontSize: 13 }}>No upcoming tasks.</div>
            : upcoming.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                  {t.due_date && <div style={{ fontSize: 11, color: TEXT2 }}>{fmtDue(t.due_date)}</div>}
                </div>
                <button onClick={() => onToggleTask(t.id, true)}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${BORDER}`, background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: TEXT2, flexShrink: 0 }}
                  title="Mark complete">✓</button>
              </div>
            ))
          }
        </>)}

        {/* Recent chats */}
        {card(<>
          {label("Recent Chats")}
          {chats.slice(0, 4).map(c => (
            <button key={c.id} onClick={() => onChatSelect(c.id)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 0", cursor: "pointer", borderBottom: `1px solid ${BORDER}`, display: "block" }}>
              <div style={{ fontSize: 13, color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
            </button>
          ))}
        </>)}

        {/* Quick actions */}
        {card(<>
          {label("Quick Actions")}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {quickActions.map(a => (
              <button key={a} onClick={() => onSend(a)}
                style={{ textAlign: "left", padding: "9px 12px", background: BG3, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT2, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT2; }}>
                {a}
              </button>
            ))}
          </div>
        </>)}

      </div>
    </div>
  );
}

function TaskPanel({ tasks, allCategories, onAdd, onToggle, onUpdate, onDelete, onBack }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState(PRESET_CATEGORIES[0]);
  const [filter, setFilter] = useState("active");
  const [editing, setEditing] = useState(null); // task object being edited
  const [editTitle, setEditTitle] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editCat, setEditCat] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openEdit = (t) => {
    setEditing(t);
    setEditTitle(t.title);
    setEditDue(t.due_date || "");
    setEditCat(t.category || PRESET_CATEGORIES[0]);
    setConfirmDelete(false);
  };

  const closeEdit = () => { setEditing(null); setConfirmDelete(false); };

  const saveEdit = () => {
    if (!editTitle.trim()) return;
    onUpdate(editing.id, { title: editTitle.trim(), due_date: editDue || null, category: editCat });
    closeEdit();
  };

  const filtered = [...tasks].filter(t => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  }).sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), dueDate || null, category);
    setTitle(""); setDueDate(""); setCategory(PRESET_CATEGORIES[0]);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Edit modal */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "min(440px, 100%)", background: BG2, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 18 }}>Edit Task</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus
                style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px", color: TEXT, fontSize: 14, outline: "none", width: "100%" }} />
              <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)}
                style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", color: TEXT2, fontSize: 13, outline: "none", colorScheme: "dark", width: "100%" }} />
              <select value={editCat} onChange={e => setEditCat(e.target.value)}
                style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", color: TEXT, fontSize: 13, outline: "none" }}>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={saveEdit} style={{ flex: 1, padding: "10px", background: ACCENT, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save</button>
              <button onClick={closeEdit} style={{ padding: "10px 16px", background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT2, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
              {confirmDelete ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { onDelete(editing.id); closeEdit(); }} style={{ flex: 1, padding: "8px", background: "#FF4444", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirm Delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: "8px 14px", background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT2, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", padding: "8px", background: "none", border: `1px solid #FF4444`, borderRadius: 8, color: "#FF4444", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Delete Task</button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Tasks</div>
          <div style={{ fontSize: 12, color: TEXT2 }}>· {tasks.filter(t => !t.completed).length} active</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["active", "all", "completed"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${filter === f ? ACCENT : BORDER}`, background: filter === f ? ACCENT_DIM : "none", color: filter === f ? ACCENT : TEXT2, fontSize: 11, cursor: "pointer", fontWeight: 600, textTransform: "capitalize" }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, background: BG2, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="Add a task…"
            style={{ flex: 1, background: BG3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", color: TEXT, fontSize: 13, outline: "none" }} />
          <button onClick={handleAdd} disabled={!title.trim()}
            style={{ padding: "8px 16px", background: title.trim() ? ACCENT : BG3, border: "none", borderRadius: 8, color: title.trim() ? "#fff" : TEXT2, fontSize: 13, fontWeight: 700, cursor: title.trim() ? "pointer" : "not-allowed" }}>
            Add
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 8px", color: TEXT2, fontSize: 11, outline: "none", colorScheme: "dark" }} />
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ flex: 1, background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 8px", color: TEXT2, fontSize: 11, outline: "none" }}>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", minHeight: 0 }}>
        {filtered.length === 0 && <div style={{ color: TEXT2, fontSize: 13, paddingTop: 20 }}>No tasks.</div>}
        {filtered.map(t => (
          <div key={t.id} onClick={() => openEdit(t)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: BG2, marginBottom: 6, border: `1px solid ${BORDER}`, opacity: t.completed ? 0.55 : 1, cursor: "pointer" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: TEXT, textDecoration: t.completed ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                {t.due_date && <span style={{ fontSize: 11, color: TEXT2 }}>{fmtDue(t.due_date)}</span>}
                {t.category && <span style={{ fontSize: 11, color: TEXT2, background: BG3, borderRadius: 4, padding: "0 5px" }}>{t.category}</span>}
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); onToggle(t.id, !t.completed); }}
              style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${t.completed ? ACCENT : BORDER}`, background: t.completed ? ACCENT_DIM : "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: t.completed ? ACCENT : TEXT2, flexShrink: 0 }}
              title="Mark complete">
              ✓
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsModal({ onClose, responseStyle, onStyleChange, memoryItems, onDeleteMemory, onUpdateMemory, onClearMemory, onClearChats, customCategories, onAddCategory, onDeleteCategory, weatherCity, onSaveWeatherCity }) {
  const [tab, setTab] = useState("general");
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [newCat, setNewCat] = useState("");
  const [cityInput, setCityInput] = useState(weatherCity || "Fort Lauderdale");
  const [citySaving, setCitySaving] = useState(false);
  const [cityMsg, setCityMsg] = useState(null);

  const memByCategory = {};
  memoryItems.forEach(m => {
    const cat = m.category || "general";
    if (!memByCategory[cat]) memByCategory[cat] = [];
    memByCategory[cat].push(m);
  });

  const TABS = [{ id: "general", label: "General" }, { id: "memory", label: "Memory" }, { id: "categories", label: "Categories" }, { id: "dashboard", label: "Dashboard" }, { id: "appearance", label: "Appearance" }, { id: "data", label: "Data" }];
  const STYLES = [
    { id: "balanced", label: "Balanced", desc: "Natural tone matched to question length" },
    { id: "detailed", label: "Detailed", desc: "Thorough explanations and full coverage" },
    { id: "school", label: "School", desc: "Step-by-step, educational, teach the concept" },
    { id: "professional", label: "Professional", desc: "Polished and business-ready" },
    { id: "creative", label: "Creative", desc: "Expressive and imaginative" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "min(720px, 100%)", height: "min(580px, 90vh)", background: BG2, borderRadius: 16, border: `1px solid ${BORDER}`, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* Left nav */}
        <div style={{ width: 170, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "20px 16px 12px", fontSize: 14, fontWeight: 800, color: TEXT, letterSpacing: "0.05em" }}>Settings</div>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ textAlign: "left", padding: "10px 16px", background: "none", border: "none", borderLeft: `2px solid ${tab === t.id ? ACCENT : "transparent"}`, cursor: "pointer", color: tab === t.id ? ACCENT : TEXT2, fontSize: 13, fontWeight: tab === t.id ? 600 : 400, background: tab === t.id ? ACCENT_DIM : "none" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, minWidth: 0 }}>

          {tab === "general" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Response Style</div>
              <div style={{ fontSize: 13, color: TEXT2, marginBottom: 16 }}>Choose how Orion formats and delivers responses.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => onStyleChange(s.id)}
                    style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: `1px solid ${responseStyle === s.id ? ACCENT : BORDER}`, background: responseStyle === s.id ? ACCENT_DIM : BG3, cursor: "pointer" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: responseStyle === s.id ? ACCENT : TEXT, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: TEXT2 }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "memory" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Memory</div>
              <div style={{ fontSize: 13, color: TEXT2, marginBottom: 16 }}>{memoryItems.length} fact{memoryItems.length !== 1 ? "s" : ""} stored</div>
              {memoryItems.length === 0 && <div style={{ color: TEXT2, fontSize: 13 }}>No memories yet.</div>}
              {Object.entries(memByCategory).map(([cat, items]) => (
                <div key={cat} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: TEXT2, textTransform: "uppercase", marginBottom: 6 }}>{cat}</div>
                  {items.map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: BG3, marginBottom: 4 }}>
                      {editingId === m.id ? (
                        <>
                          <input value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus
                            style={{ flex: 1, background: "none", border: `1px solid ${ACCENT}`, borderRadius: 6, padding: "3px 7px", color: TEXT, fontSize: 12, outline: "none" }} />
                          <button onClick={() => { onUpdateMemory(m.id, editVal); setEditingId(null); }} style={{ background: ACCENT, border: "none", borderRadius: 6, padding: "3px 8px", color: "#fff", fontSize: 11, cursor: "pointer" }}>Save</button>
                          <button onClick={() => setEditingId(null)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3px 8px", color: TEXT2, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontSize: 12, color: TEXT, lineHeight: 1.4 }}>{m.fact}</span>
                          <button onClick={() => { setEditingId(m.id); setEditVal(m.fact); }} style={{ background: "none", border: "none", color: TEXT2, fontSize: 13, cursor: "pointer", padding: "1px 4px" }}>✎</button>
                          <button onClick={() => onDeleteMemory(m.id)} style={{ background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer", padding: "1px 4px", lineHeight: 1 }}>×</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {tab === "categories" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Categories</div>
              <div style={{ fontSize: 13, color: TEXT2, marginBottom: 16 }}>Manage task categories. Built-in ones can't be deleted.</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: TEXT2, textTransform: "uppercase", marginBottom: 6 }}>Built-in</div>
                {PRESET_CATEGORIES.map(c => (
                  <div key={c} style={{ display: "flex", alignItems: "center", padding: "7px 10px", borderRadius: 8, background: BG3, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 13, color: TEXT2 }}>{c}</span>
                    <span style={{ fontSize: 10, color: TEXT2, opacity: 0.5 }}>built-in</span>
                  </div>
                ))}
              </div>
              {customCategories.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: TEXT2, textTransform: "uppercase", marginBottom: 6 }}>Custom</div>
                  {customCategories.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: BG3, marginBottom: 4 }}>
                      <span style={{ flex: 1, fontSize: 13, color: TEXT }}>{c.name}</span>
                      <button onClick={() => onDeleteCategory(c.id)} style={{ background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newCat} onChange={e => setNewCat(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newCat.trim()) { onAddCategory(newCat.trim()); setNewCat(""); } }}
                  placeholder="Add a category…"
                  style={{ flex: 1, background: BG3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", color: TEXT, fontSize: 13, outline: "none" }} />
                <button onClick={() => { if (newCat.trim()) { onAddCategory(newCat.trim()); setNewCat(""); } }}
                  disabled={!newCat.trim()}
                  style={{ padding: "8px 14px", background: newCat.trim() ? ACCENT : BG3, border: "none", borderRadius: 8, color: newCat.trim() ? "#fff" : TEXT2, fontSize: 13, fontWeight: 700, cursor: newCat.trim() ? "pointer" : "not-allowed" }}>Add</button>
              </div>
            </div>
          )}

          {tab === "dashboard" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Dashboard</div>
              <div style={{ fontSize: 13, color: TEXT2, marginBottom: 20 }}>Configure what shows on your dashboard.</div>
              <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 600, color: TEXT }}>Weather Location</div>
              <div style={{ fontSize: 12, color: TEXT2, marginBottom: 12 }}>Type any city. Orion will look up its coordinates automatically.</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input value={cityInput} onChange={e => { setCityInput(e.target.value); setCityMsg(null); }}
                  onKeyDown={e => { if (e.key === "Enter" && cityInput.trim() && !citySaving) { setCitySaving(true); onSaveWeatherCity(cityInput.trim()).then(r => { setCityMsg(r.ok ? `Saved — showing weather for ${r.city}.` : `Couldn't find "${cityInput.trim()}". Try a different name.`); setCitySaving(false); }); } }}
                  placeholder="e.g. Miami, New York, Los Angeles"
                  style={{ flex: 1, background: BG3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 12px", color: TEXT, fontSize: 13, outline: "none" }} />
                <button
                  onClick={() => { if (!cityInput.trim() || citySaving) return; setCitySaving(true); setCityMsg(null); onSaveWeatherCity(cityInput.trim()).then(r => { setCityMsg(r.ok ? `Saved — showing weather for ${r.city}.` : `Couldn't find "${cityInput.trim()}". Try a different name.`); setCitySaving(false); }); }}
                  disabled={!cityInput.trim() || citySaving}
                  style={{ padding: "9px 16px", background: cityInput.trim() && !citySaving ? ACCENT : BG3, border: "none", borderRadius: 8, color: cityInput.trim() && !citySaving ? "#fff" : TEXT2, fontSize: 13, fontWeight: 700, cursor: cityInput.trim() && !citySaving ? "pointer" : "not-allowed", flexShrink: 0 }}>
                  {citySaving ? "Saving…" : "Save"}
                </button>
              </div>
              {cityMsg && <div style={{ fontSize: 12, color: cityMsg.startsWith("Saved") ? "#4CAF50" : "#FF6B6B", marginTop: 4 }}>{cityMsg}</div>}
            </div>
          )}

          {tab === "appearance" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Appearance</div>
              <div style={{ fontSize: 13, color: TEXT2, marginBottom: 16 }}>Customize the look of Orion.</div>
              <div style={{ padding: "14px 16px", borderRadius: 10, border: `1px solid ${BORDER}`, background: BG3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2 }}>Dark Mode</div>
                  <div style={{ fontSize: 12, color: TEXT2 }}>Always on — light mode coming soon</div>
                </div>
                <div style={{ width: 40, height: 22, borderRadius: 11, background: ACCENT, position: "relative", flexShrink: 0 }}>
                  <div style={{ position: "absolute", right: 2, top: 2, width: 18, height: 18, borderRadius: "50%", background: "#fff" }} />
                </div>
              </div>
            </div>
          )}

          {tab === "data" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Data</div>
              <div style={{ fontSize: 13, color: TEXT2, marginBottom: 20 }}>Manage your stored data.</div>
              {[
                { key: "memory", label: "Clear All Memories", desc: `Delete all ${memoryItems.length} stored memory facts. Cannot be undone.`, action: onClearMemory },
                { key: "chats", label: "Clear All Chats", desc: "Delete all chat history. Cannot be undone.", action: onClearChats },
              ].map(({ key, label, desc, action }) => (
                <div key={key} style={{ padding: "14px 16px", borderRadius: 10, border: `1px solid ${BORDER}`, background: BG3, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: TEXT2, marginBottom: 10 }}>{desc}</div>
                  {confirm === key ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { action(); setConfirm(null); }} style={{ padding: "6px 14px", background: "#FF4444", border: "none", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirm Delete</button>
                      <button onClick={() => setConfirm(null)} style={{ padding: "6px 14px", background: "none", border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT2, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirm(key)} style={{ padding: "7px 14px", background: "none", border: `1px solid #FF4444`, borderRadius: 7, color: "#FF4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{label}</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: TEXT2, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>
    </div>
  );
}

export default function Orion() {
  const [mounted,       setMounted]       = useState(false);
  const [time,          setTime]          = useState(null);
  const [chats,         setChats]         = useState([]);
  const [activeChatId,  setActiveChatId]  = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [memory,        setMemory]        = useState([]);
  const [memoryItems,   setMemoryItems]   = useState([]);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [files,         setFiles]         = useState([]);
  const [dragging,      setDragging]      = useState(false);
  const [showSidebar,   setShowSidebar]   = useState(false);
  const [isMobile,      setIsMobile]      = useState(false);
  const [quickActions,  setQuickActions]  = useState(DEFAULT_ACTIONS);
  const [activePanel,   setActivePanel]   = useState("chat");
  const [showSettings,  setShowSettings]  = useState(false);
  const [tasks,         setTasks]         = useState([]);
  const [weather,       setWeather]       = useState(null);
  const [responseStyle, setResponseStyle] = useState("balanced");
  const [categories,    setCategories]    = useState([]);
  const [weatherCity,   setWeatherCity]   = useState("Fort Lauderdale");
  const [weatherCoords, setWeatherCoords] = useState({ lat: 26.1224, lon: -80.1373 });

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
    loadTasks();
    loadCategories();
    const savedCity = localStorage.getItem("orion_weather_city");
    const savedLat  = localStorage.getItem("orion_weather_lat");
    const savedLon  = localStorage.getItem("orion_weather_lon");
    if (savedCity && savedLat && savedLon) {
      setWeatherCity(savedCity);
      setWeatherCoords({ lat: parseFloat(savedLat), lon: parseFloat(savedLon) });
    }
    return () => { clearInterval(t); window.removeEventListener("resize", checkMobile); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (activeChatId) { loadMessages(activeChatId); setQuickActions(DEFAULT_ACTIONS); } }, [activeChatId]);
  useEffect(() => { if (activePanel === "dashboard" && !weather) loadWeather(); }, [activePanel, weather]);

  const loadChats = async () => {
    const { data, error } = await supabase.from("chats").select("*").order("updated_at", { ascending: false });
    if (error) { console.error(error); return; }
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
    if (data) { setMemory(data.map(m => m.fact)); setMemoryItems(data); }
  };

  const loadTasks = async () => {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (data) setTasks(data);
  };

  const loadCategories = async () => {
    const { data } = await supabase.from("categories").select("*").order("created_at", { ascending: true });
    if (data) setCategories(data);
  };

  const addCategory = async (name) => {
    const trimmed = name.trim();
    if (!trimmed || PRESET_CATEGORIES.includes(trimmed) || categories.some(c => c.name === trimmed)) return;
    const id = Date.now().toString();
    await supabase.from("categories").insert({ id, name: trimmed });
    loadCategories();
  };

  const deleteCategory = async (id) => {
    await supabase.from("categories").delete().eq("id", id);
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const loadWeather = async (coords) => {
    try {
      const { lat, lon } = coords || weatherCoords;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=${encodeURIComponent(tz)}&forecast_days=1`);
      const data = await res.json();
      setWeather({ temp: data.current.temperature_2m, code: data.current.weather_code, high: data.daily.temperature_2m_max[0], low: data.daily.temperature_2m_min[0] });
    } catch {}
  };

  const saveWeatherCity = async (cityName) => {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`);
      const data = await res.json();
      if (!data.results?.length) return { ok: false };
      const { name, latitude, longitude } = data.results[0];
      localStorage.setItem("orion_weather_city", name);
      localStorage.setItem("orion_weather_lat", String(latitude));
      localStorage.setItem("orion_weather_lon", String(longitude));
      setWeatherCity(name);
      const newCoords = { lat: latitude, lon: longitude };
      setWeatherCoords(newCoords);
      setWeather(null);
      loadWeather(newCoords);
      return { ok: true, city: name };
    } catch {
      return { ok: false };
    }
  };

  const createChat = async (name) => {
    const id = Date.now().toString();
    const { error } = await supabase.from("chats").insert({ id, name });
    if (error) { console.error(error); return; }
    const newChat = { id, name, updated_at: new Date().toISOString() };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(id);
    setActivePanel("chat");
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
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "name", firstMessage }) });
      const data = await res.json();
      if (data.name) await renameChat(chatId, data.name);
    } catch {}
  };

  const updateQuickActions = async (msgs) => {
    try {
      const context = msgs.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 100)}`).join("\n");
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "quickactions", context }) });
      const data = await res.json();
      if (data.actions) setQuickActions(data.actions);
    } catch {}
  };

  const extractMemory = async (userMsg, reply) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: "Extract memorable personal facts from this conversation as a JSON array of short strings. Return [] if nothing worth saving. JSON only, no markdown.", messages: [{ role: "user", content: `User: "${userMsg}" Orion: "${reply}"` }] }),
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

  const extractTask = async (userMsg) => {
    if (!TASK_KEYWORDS.test(userMsg)) return null;
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: 'Extract a task from this message. Return JSON: {"task":{"title":"concise title","due_date":"YYYY-MM-DD or null","priority":"low|medium|high","category":"school|work|personal|general"}} or {"task":null} if no clear actionable task. JSON only.', messages: [{ role: "user", content: userMsg.slice(0, 300) }] }),
      });
      const data = await res.json();
      const text = (data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim();
      const result = JSON.parse(text);
      if (result.task?.title) {
        const { title, due_date, priority, category } = result.task;
        const id = Date.now().toString();
        await supabase.from("tasks").insert({ id, title, due_date: due_date || null, priority: priority || "medium", category: category || "general", completed: false });
        loadTasks();
        return result.task;
      }
    } catch {}
    return null;
  };

  const addTask = async (title, due_date, category) => {
    const id = Date.now().toString();
    await supabase.from("tasks").insert({ id, title, due_date, category, completed: false });
    loadTasks();
  };

  const updateTask = async (id, fields) => {
    await supabase.from("tasks").update(fields).eq("id", id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
  };

  const toggleTask = async (id, completed) => {
    await supabase.from("tasks").update({ completed }).eq("id", id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
  };

  const deleteTask = async (id) => {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const deleteMemory = async (id) => {
    await supabase.from("memory").delete().eq("id", id);
    loadMemory();
  };

  const updateMemory = async (id, fact) => {
    await supabase.from("memory").update({ fact }).eq("id", id);
    loadMemory();
  };

  const clearAllMemory = async () => {
    const { data } = await supabase.from("memory").select("id");
    if (data && data.length > 0) await supabase.from("memory").delete().in("id", data.map(m => m.id));
    setMemory([]); setMemoryItems([]);
  };

  const clearAllChats = async () => {
    const { data: msgs } = await supabase.from("messages").select("id");
    if (msgs && msgs.length > 0) await supabase.from("messages").delete().in("id", msgs.map(m => m.id));
    const { data: cs } = await supabase.from("chats").select("id");
    if (cs && cs.length > 0) await supabase.from("chats").delete().in("id", cs.map(c => c.id));
    setChats([]); setMessages([]);
    setShowSettings(false);
    await createChat("New Chat");
  };

  const addFiles = useCallback((f) => setFiles(p => [...p, ...Array.from(f)]), []);

  const send = async (override) => {
    const text = override ?? input.trim();
    if ((!text && files.length === 0) || loading || !activeChatId) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

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
    if (isFirstMessage) autoNameChat(activeChatId, fileName ? `File: ${fileName}. User: ${text || "analyze this file"}` : text);

    setLoading(true);
    try {
      let reply = "";
      let sources = [];

      if (attachedFiles.length > 0) {
        const formData = new FormData();
        formData.append("file", attachedFiles[0]);
        formData.append("prompt", text || "");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          if (res.status === 413) {
            reply = "That file is too large to upload (Vercel's limit is ~4.5 MB). Try compressing the PDF or uploading individual pages as images instead.";
          } else {
            let msg = `Upload failed (${res.status})`;
            try { const d = await res.json(); msg = d.error || msg; } catch {}
            reply = `Error: ${msg}`;
          }
        } else {
          const data = await res.json();
          reply = data.content?.[0]?.text || (data.error ? `Error: ${data.error}` : "No response.");
        }
      } else {
        const now = new Date();
        const dateCtx = `\n\nCURRENT DATE & TIME: ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at ${fmtTime(now)}`;
        const memCtx = memory.length > 0 ? `\n\nORION MEMORY:\n${memory.slice(0,20).map((f,i) => `${i+1}. ${f}`).join("\n")}` : "";
        const res = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ system: BASE_CONTEXT + STYLE_SUFFIX[responseStyle] + dateCtx + memCtx, messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        reply = data.content?.[0]?.text || "No response.";
        sources = data.sources || [];
      }

      const task = await extractTask(userContent);
      if (task) reply += `\n\n📋 Added to your tasks: **${task.title}**${task.due_date ? ` (due ${fmtDue(task.due_date)})` : ""} — is that right?`;

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

  const allCategories = [...PRESET_CATEGORIES, ...categories.map(c => c.name)];

  const NAV = [
    { id: "chat", icon: "💬", label: "Chat" },
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "tasks", icon: "☑", label: "Tasks" },
  ];

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
          <button key={chat.id} onClick={() => { setActiveChatId(chat.id); setActivePanel("chat"); if (isMobile) setShowSidebar(false); }}
            style={{ width: "100%", textAlign: "left", border: "none", borderRadius: 10, padding: "10px 12px", marginBottom: 2, cursor: "pointer", background: chat.id === activeChatId && activePanel === "chat" ? ACCENT_DIM : "transparent", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: chat.id === activeChatId && activePanel === "chat" ? ACCENT : BG3, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: chat.id === activeChatId && activePanel === "chat" ? TEXT : TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chat.name}</span>
            </div>
            <span onClick={e => { e.stopPropagation(); deleteChat(chat.id); }} style={{ color: "#555", fontSize: 16, flexShrink: 0, lineHeight: 1, cursor: "pointer" }}>×</span>
          </button>
        ))}
      </div>

      {memory.length > 0 && (
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: TEXT2, marginBottom: 5 }}>MEMORY · {memory.length} FACTS</div>
          <div style={{ fontSize: 11, color: TEXT2, lineHeight: 1.5 }}>
            {memory.slice(0,2).map((f,i) => <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>· {f}</div>)}
          </div>
        </div>
      )}

      {/* Bottom nav — desktop only; mobile gets a persistent tab bar at page bottom */}
      {!isMobile && (
        <div style={{ padding: "8px 12px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 4 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setActivePanel(n.id)} title={n.label}
              style={{ flex: 1, padding: "8px 4px", background: activePanel === n.id ? ACCENT_DIM : "none", border: `1px solid ${activePanel === n.id ? ACCENT : "transparent"}`, borderRadius: 10, cursor: "pointer", color: activePanel === n.id ? ACCENT : TEXT2, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em" }}>{n.label.toUpperCase()}</span>
            </button>
          ))}
          <button onClick={() => setShowSettings(true)} title="Settings"
            style={{ flex: 1, padding: "8px 4px", background: "none", border: "1px solid transparent", borderRadius: 10, cursor: "pointer", color: TEXT2, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 16 }}>⚙️</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em" }}>SETTINGS</span>
          </button>
        </div>
      )}
    </div>
  );

  const headerTitle = activePanel === "dashboard" ? "Dashboard" : activePanel === "tasks" ? "Tasks" : (activeChat?.name || "Orion");

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
        button, input, select { font-family: Inter, sans-serif; }
        .orion-mobile-nav { padding-bottom: env(safe-area-inset-bottom, 0px); }
        .orion-input-wrap { padding-bottom: max(16px, env(safe-area-inset-bottom, 16px)); }
      `}</style>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          responseStyle={responseStyle}
          onStyleChange={setResponseStyle}
          memoryItems={memoryItems}
          onDeleteMemory={deleteMemory}
          onUpdateMemory={updateMemory}
          onClearMemory={clearAllMemory}
          onClearChats={clearAllChats}
          customCategories={categories}
          onAddCategory={addCategory}
          onDeleteCategory={deleteCategory}
          weatherCity={weatherCity}
          onSaveWeatherCity={saveWeatherCity}
        />
      )}

      {isMobile && showSidebar && <div onClick={() => setShowSidebar(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }} />}

      {dragging && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,15,20,0.95)", border: `2px dashed ${ACCENT}`, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }} onDragLeave={() => setDragging(false)}>
          <span style={{ fontSize: 48 }}>📎</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: ACCENT, letterSpacing: "0.1em" }}>Drop to attach</span>
        </div>
      )}

      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BG, overflow: "hidden" }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>

        {/* Main row: sidebar + content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <Sidebar />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Header */}
          <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: `1px solid ${BORDER}`, background: BG, flexShrink: 0, gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              {isMobile && <button onClick={() => setShowSidebar(true)} style={{ background: "none", border: "none", color: TEXT2, fontSize: 20, cursor: "pointer", padding: 4, flexShrink: 0 }}>☰</button>}
              <Avatar size={30} orion />
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{headerTitle}</div>
            </div>
            <div style={{ fontSize: 12, color: TEXT2, flexShrink: 0 }}>
              {time ? (isMobile ? time.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : fmtDate(time)) : ""}
            </div>
          </div>

          {/* Dashboard panel */}
          {activePanel === "dashboard" && (
            <DashboardPanel
              tasks={tasks}
              chats={chats}
              weather={weather}
              weatherCity={weatherCity}
              time={time}
              quickActions={quickActions}
              onManageTasks={() => setActivePanel("tasks")}
              onChatSelect={(id) => { setActiveChatId(id); setActivePanel("chat"); }}
              onSend={(msg) => { setActivePanel("chat"); send(msg); }}
              onToggleTask={toggleTask}
            />
          )}

          {/* Tasks panel */}
          {activePanel === "tasks" && (
            <TaskPanel
              tasks={tasks}
              allCategories={allCategories}
              onAdd={addTask}
              onToggle={toggleTask}
              onUpdate={updateTask}
              onDelete={deleteTask}
              onBack={() => setActivePanel("dashboard")}
            />
          )}

          {/* Chat panel */}
          {activePanel === "chat" && (<>
            {/* Quick actions */}
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 8, overflowX: "auto", flexShrink: 0 }}>
              {quickActions.map(a => (
                <button key={a} onClick={() => send(a)}
                  style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 500, color: TEXT2, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT2; }}>
                  {a}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 12px 8px" : "20px 20px 10px", minHeight: 0 }}>
              {messages.map((m, i) => <Bubble key={i} msg={m} />)}
              {loading && <Dots />}
              <div ref={endRef} />
            </div>

            {/* File previews */}
            {files.length > 0 && (
              <div style={{ padding: "8px 20px", display: "flex", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
                {files.map((f, i) => <FilePreview key={i} file={f} onRemove={() => setFiles(p => p.filter((_, j) => j !== i))} />)}
              </div>
            )}

            {/* Input */}
            <div className="orion-input-wrap" style={{ padding: isMobile ? "10px 12px 12px" : "12px 20px 16px", flexShrink: 0 }}>
              <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={() => fileRef.current?.click()}
                  style={{ width: 36, height: 36, borderRadius: 10, background: BG3, border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = ACCENT_DIM; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.background = BG3; }}>
                  <span style={{ fontSize: 18, color: TEXT2 }}>📎</span>
                </button>
                <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: "none" }}
                  onChange={e => { const picked = Array.from(e.target.files); e.target.value = ""; setFiles(p => [...p, ...picked]); }} />
                <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask Orion anything…" rows={1}
                  style={{ flex: 1, background: "none", border: "none", resize: "none", color: TEXT, fontSize: 15, lineHeight: 1.5, maxHeight: 120, overflowY: "auto", paddingTop: 2 }}
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }} />
                <button onClick={() => send()} disabled={!canSend}
                  style={{ width: 38, height: 38, borderRadius: 10, border: "none", cursor: canSend ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, fontWeight: 700, transition: "all 0.15s", background: canSend ? ACCENT : BG3, color: canSend ? "#fff" : TEXT2 }}>
                  {loading ? <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>↻</span> : "↑"}
                </button>
              </div>
              <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#333", letterSpacing: "0.08em" }}>Orion · Powered by Groq + Tavily · Free</div>
            </div>
          </>)}

        </div>
        </div>{/* end main row */}

        {/* Mobile bottom tab bar — persistent, sits in layout flow so nothing hides behind it */}
        {isMobile && (
          <div className="orion-mobile-nav" style={{ background: BG2, borderTop: `1px solid ${BORDER}`, display: "flex", flexShrink: 0 }}>
            {[...NAV, { id: "settings", icon: "⚙️", label: "Settings" }].map(n => (
              <button key={n.id}
                onClick={() => n.id === "settings" ? setShowSettings(true) : setActivePanel(n.id)}
                style={{ flex: 1, minHeight: 64, padding: "10px 4px 8px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, color: (n.id !== "settings" && activePanel === n.id) ? ACCENT : TEXT2, borderTop: `2px solid ${(n.id !== "settings" && activePanel === n.id) ? ACCENT : "transparent"}` }}>
                <span style={{ fontSize: 24 }}>{n.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.01em" }}>{n.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
