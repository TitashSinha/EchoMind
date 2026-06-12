# EchoMind

AI-powered real-time interview and meeting copilot for Windows. EchoMind listens to your live conversations (interviews, meetings, sales calls, presentations), understands your documents and your history, and whispers personalized suggestions in a floating overlay — like an expert advisor sitting beside you.

## How it works

```
┌─ Main window ─────────────┐      ┌─ Overlay (always-on-top) ─┐
│ Dashboard · Spaces ·      │      │ Say this / Ask this /     │
│ Sessions · Memory ·       │      │ Key points / Heads up     │
│ Settings · Live view      │      │ (hidden from screen share)│
└───────────┬───────────────┘      └───────────▲───────────────┘
            │ IPC                              │ live events
┌───────────▼───────────────────────────────────────────────────┐
│ Electron main process                                          │
│  • Live engine: transcription queue → retrieval → suggestions  │
│  • Knowledge spaces: extract → chunk → embed (local JSON)      │
│  • Personal memory: auto-extracted after each session          │
│  • Session store: transcript, summary, action items, search    │
└───────────┬────────────────────────────────────────────────────┘
            │ OpenAI API (your key, stored encrypted via DPAPI)
            ▼
   transcription · chat completions · embeddings
```

**Audio capture** — two independent streams, labeled by speaker:

- **You** — your microphone (`getUserMedia`)
- **Them** — Windows system audio via WASAPI loopback (Electron's
  `setDisplayMediaRequestHandler` with `audio: 'loopback'`), i.e. whatever you hear
  from Zoom / Teams / Meet / Slack — no bot joins the call, nothing is installed
  in the meeting.

Each stream runs a cycling `MediaRecorder` (5-second complete WebM blobs). Silent
windows are dropped client-side (cheap RMS voice-activity gate) before they cost an
API call. Chunks are transcribed in order through a serialized queue, so the
transcript reads in spoken order with speaker labels.

**Suggestions** — when the other party speaks, the live engine (debounced, ~6s min
interval) embeds the recent transcript, retrieves the top chunks from the session's
knowledge space, combines them with your personal memory and the mode's playbook
(interview / meeting / sales / presentation / research / custom), and asks the chat
model for a structured set: *say this, ask this, key points, heads-up warnings,
action items, decisions*. Results stream to both the main window and the overlay.

**After each session** — a summary, action items, decisions, risks, follow-ups, and
highlights are generated and stored with the searchable transcript. Durable facts
about *you* are extracted into the personal memory layer, which feeds every future
session — EchoMind gets more personalized the more you use it.

## Getting started

```powershell
npm install
npm run dev          # run in development (hot reload)
```

First run:

1. Open **Settings** → paste your OpenAI API key (stored locally, encrypted with Windows DPAPI).
2. Create a **Knowledge space** → add your resume, the job description, agendas, SOPs… (PDF, DOCX, PPTX, XLSX, CSV, TXT, MD).
3. Go to **Live Session** → pick a mode and the space → Start.
4. Position the overlay next to your meeting window. It stays on top and (by default) is excluded from screen capture, so it never appears in a screen share.

## Building the Windows installer

```powershell
npm run dist         # produces release/EchoMind Setup 0.1.0.exe (NSIS installer)
npm run dist:dir     # unpacked build for quick testing
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | electron-vite dev server with HMR |
| `npm run build` | bundle main / preload / renderer to `out/` |
| `npm run typecheck` | strict TypeScript check for both node and web code |
| `npm run dist` | build + package Windows NSIS installer into `release/` |

## Privacy & data

- Everything lives in `%APPDATA%\EchoMind\echomind-data\` — settings, knowledge
  spaces (extracted text + embeddings), session transcripts, summaries, and memory.
  **Settings → Open folder** takes you there; delete anything at any time.
- The only network traffic is to the OpenAI API: audio chunks for transcription,
  text for embeddings/suggestions/summaries, using **your** key.
- The API key is encrypted at rest with Windows DPAPI (`safeStorage`).
- The overlay is excluded from screen capture by default (toggle in Settings).

## Project layout

```
src/
  shared/      types.ts, bridge.ts — contracts shared by all three processes
  main/        Electron main: windows, ipc, store, ai, extract, spaces,
               live (session engine), sessions, memory, modes (prompt playbooks)
  preload/     contextBridge → window.echomind (typed EchoBridge)
  renderer/    React app: Dashboard, LivePage, Spaces, Sessions, Memory,
               Settings, Overlay + audio.ts capture engine
```

## Roadmap

- [ ] Streaming transcription (OpenAI Realtime API) for sub-second latency
- [ ] Local STT option (whisper.cpp) for fully offline transcription
- [ ] Session memory review screen (accept/reject extracted facts before saving)
- [ ] Global hotkeys (toggle overlay, mark a moment, pause listening)
- [ ] Click-through overlay mode and opacity control
- [ ] Calendar integration to pre-create sessions from upcoming meetings
- [ ] Export session reports (PDF / Markdown)
- [ ] Auto-update via electron-updater

## A note on use

EchoMind is built to help you present **your own** experience effectively and keep
meetings organized — it grounds every suggestion in your real documents and never
invents facts. Be aware of your local norms and the policies of the organizations
you talk to; some interview processes prohibit live assistance. You are responsible
for using it appropriately, and recording laws vary by jurisdiction — get consent
where required.
