# 👻 PR Phantom — Diff Explainer

A beginner-friendly tool that explains code diffs in plain language.
Follow the **Patch Trail**, understand what changed, and ask the right questions during code review.

**Halloween themed · Gemini for hosted AI, Ollama for local AI**

---

## What you built

- **AI explanations**: Use Gemini cloud mode when hosted, or Ollama for local and private development.
- **Diff parser**: Reads your pasted diff, extracts filenames, line numbers, and change counts — the AI never invents these.
- **Annotated diff view**: Shows your diff highlighted green/red with hunk IDs (H1, H2, …) you can link back to.
- **Patch Trail**: For each important change — *What changed*, *Why it matters*, *A reviewer might ask*.
- **Evidence links**: Click a link to jump to the exact hunk in the diff that the AI is describing.
- **Learning reveal**: A "Guess what this change does" spoiler button for each change.
- **Error states**: Helpful status banners for Gemini configuration, Ollama connection, missing models, and invalid diffs.
- **Offline mode**: Diff parsing and the annotated view work even if Ollama is paused.

---

## Deploy to Render

PR Phantom deploys as one Node web service. It serves the Vite website and Express API from the same URL.

1. Push this folder to a private GitHub repository. The `.env` file is ignored by Git and must stay private.
2. In Render, choose **New → Blueprint** and connect that repository. Render reads the included `render.yaml`.
3. Add a Gemini API key when Render prompts for `GEMINI_API_KEY`.

When someone clicks **Explain this diff**, the diff text is sent to Gemini for analysis. The API key stays on the server and is never included in the browser bundle.

---
## How to run the app (Windows, step by step)

### Step 1 — Make sure Ollama is running

1. Open **Ollama** from your Start Menu or system tray.
2. If you don't have the model yet, open Command Prompt or PowerShell and type:
   ```cmd
   ollama pull gemma4:e2b
   ```
3. That's it! Ollama runs locally on `http://127.0.0.1:11434`.

### Step 2 — Start the app

Open Command Prompt inside the `PR Phantom` folder and run:
```cmd
npm run dev
```

You will see:
- **Server** on `http://localhost:3001` (communicates with local Ollama)
- **Frontend** on `http://localhost:5173` (the interactive UI)

### Step 3 — Open the app

Open your browser and navigate to: **http://localhost:5173**

You'll see:
- 🟢 **Ollama Local AI connected** — model `gemma4:e2b` ready
- Click **"🎃 Load sample diff"**
- Click **"🔮 Explain this diff"**
- Watch PR Phantom generate explanations directly from your local Ollama!

---

## Configuring Ollama (`.env`)

You can customize Ollama settings in `.env`:

```env
# Ollama Configuration (Local AI)
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:e2b
```

If you want to use a different model installed in your Ollama (e.g. `llama3.2`, `mistral`, etc.), just update `OLLAMA_MODEL` and restart.

---

## Project structure

```
PR Phantom/
├── server/
│   └── index.ts          <- Express server (communicates with local Ollama)
├── src/
│   ├── main.ts           <- Frontend app logic & Ollama status indicator
│   ├── style.css         <- Halloween CSS theme
│   ├── diffParser.ts     <- Diff parser (filenames, line refs, change counts)
│   └── sampleDiff.ts     <- Sample multi-file diff for testing
├── index.html            <- Main page
├── vite.config.ts        <- Vite dev server config
├── tsconfig.json         <- TypeScript config
├── .env.example          <- Ollama configuration example
├── .env                  <- Local settings
└── .gitignore            <- Excludes .env and node_modules
```

---

*Built with Vite + TypeScript + Express + Ollama · Halloween Edition 🎃*
