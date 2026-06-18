# Orion — Deploy Guide
_Get Orion live on the web, iPhone, and Mac in ~10 minutes. All free._

---

## What you need first
- A free **GitHub** account → github.com
- A free **Vercel** account → vercel.com (sign up with GitHub)
- Your **Anthropic API key** → console.anthropic.com (free tier works)

---

## Step 1 — Get the project on your Mac

Open Terminal (Command+Space → "Terminal") and run these one at a time:

```bash
cd ~/Desktop
```

Copy the `orion` folder Claude gave you to your Desktop. Then:

```bash
cd orion
npm install
```

Wait for it to finish. Then test it locally:

```bash
cp .env.example .env.local
```

Open `.env.local` in TextEdit and replace `your_api_key_here` with your actual Anthropic key.

```bash
npm run dev
```

Open your browser → **http://localhost:3000** — Orion should be running.

---

## Step 2 — Push to GitHub

Go to **github.com → New repository**
- Name it: `orion`
- Set to **Private**
- Do NOT add README, .gitignore, or license
- Click **Create repository**

Back in Terminal (stop the dev server with Control+C first):

```bash
git init
git add .
git commit -m "Orion v1"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/orion.git
git branch -M main
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

---

## Step 3 — Deploy on Vercel (free)

1. Go to **vercel.com** → Log in with GitHub
2. Click **Add New → Project**
3. Find and import your `orion` repo
4. Under **Environment Variables**, add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
5. Click **Deploy**

Vercel builds it in about 60 seconds. You'll get a URL like:
**https://orion-yourusername.vercel.app**

That URL works anywhere — phone, Mac, any browser.

---

## Step 4 — Add to iPhone home screen (makes it feel native)

1. Open Safari on your iPhone
2. Go to your Vercel URL
3. Tap the **Share** button (box with arrow pointing up)
4. Tap **Add to Home Screen**
5. Name it **Orion** → tap **Add**

It now opens full-screen with no browser chrome, like a real app.

---

## Step 5 — Add to Mac dock

1. Open Chrome or Safari on your Mac
2. Go to your Vercel URL
3. **Chrome:** click the install icon in the address bar → Install
4. **Safari:** File → Add to Dock
5. Drag it to your dock

---

## Updating Orion later

Any time you want to change something, edit the files, then:

```bash
git add .
git commit -m "update"
git push
```

Vercel auto-deploys in ~30 seconds. No extra steps.

---

## Your Anthropic API key

Get it at: **console.anthropic.com → API Keys → Create Key**

The free tier gives you $5 in credits. At Orion's usage, that's hundreds of conversations.
When you want to add more, you pay as you go — roughly $0.003 per message.

---

## Folder structure (for reference)

```
orion/
├── app/
│   ├── api/chat/route.js   ← API route (keeps your key secret)
│   ├── layout.js           ← HTML shell + PWA meta tags
│   └── page.js             ← Entry point
├── components/
│   └── Orion.js            ← The whole app
├── public/
│   └── manifest.json       ← Makes it installable on iPhone/Mac
├── .env.local              ← Your API key (never committed to GitHub)
├── .gitignore
├── next.config.js
└── package.json
```
