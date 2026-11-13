# KathaToon Studio — AI Cartoon Story Maker

Full-stack AI Cartoon Story Maker supporting Photo-to-Cartoon Characters, 4-act Hindi & English story generation, character-wise Hindi & English voiceovers, scene animation, a live Video Editing Studio with real `.webm` export (720p/1080p, 16:9/9:16), Firebase Authentication & Firestore persistence, and an Admin Control Center.

## Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Canvas2D + WebAudio + `MediaRecorder` real-time video studio.
- **Backend**: Express (`server.ts`) hosting server-side `@google/genai` SDK endpoints and persistent `/api/media` asset storage (`./data/media`).
- **Database & Auth**: Firebase Authentication (Google Sign-In + optional Email/Password) & Cloud Firestore (`firebase-applet-config.json`, `firestore.rules`).

## AI Model Routing

- **Story & Script Generation + Facial Trait Analysis**: `gemini-4-hydrogen`
- **Hindi & English Character TTS (WAV)**: `gemini-3.8-flash-tts`
- **Photo-to-Cartoon & Scene Keyframes**: `gemini-3.1-flash-lite-image` (requires a billing-enabled Gemini API key; falls back transparently to Canvas2D stylized toon shading if free-tier key is active)
- **AI Video Clip Generation**: `gemini-omni-1.2-flash` via Interactions API (`ai.interactions.create`, requires billing-enabled key; Studio Canvas2D Lip-Sync Animator & WebM Exporter always works natively)
- **Background Music**: `lyria-3-clip-preview` (requires billing-enabled key; procedural WebAudio BGM + SFX synthesizer built in)

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   - Set `GEMINI_API_KEY` in your environment or AI Studio **Settings > Secrets**.
   - Ensure `firebase-applet-config.json` points to your Firebase project.
3. Run development server (Express + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```
4. Build and run production server:
   ```bash
   npm run build
   npm start
   ```

## Deployment & Security

- Deploy Firestore security rules (`firestore.rules`) via Firebase CLI or AI Studio deployment.
- Never expose `GEMINI_API_KEY` to client-side code; all Gemini calls are routed through `/api/ai/*` in `server.ts`.
