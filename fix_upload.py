import re

with open('/Users/adam/Desktop/orion/components/Orion.js', 'r') as f:
    content = f.read()

old = '''                <button onClick={() => fileRef.current?.click()}
                  style={{ width: 34, height: 34, borderRadius: 7, background: "#0d0d0d", border: "1px solid #1e1e1e", cursor: "pointer", color: "#333", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = NEON_BORDER; e.currentTarget.style.color = NEON; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#333"; }}>+</button>
                <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: "none" }} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />'''

new = '''                <label htmlFor="orion-file-input" style={{ width: 34, height: 34, borderRadius: 7, background: "#0d0d0d", border: "1px solid #1e1e1e", cursor: "pointer", color: "#333", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = NEON_BORDER; e.currentTarget.style.color = NEON; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#333"; }}>+</label>
                <input id="orion-file-input" type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: "none" }} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />'''

content = content.replace(old, new)

with open('/Users/adam/Desktop/orion/components/Orion.js', 'w') as f:
    f.write(content)

print("done")
