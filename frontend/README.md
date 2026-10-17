# Lexora Frontend

React/Vite frontend for Lexora.

Source lives in `src/`.

## Local Commands

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

Offline mode is available in production builds: `npm run build`, then
`npm run preview` (with a same-origin API proxy/server), or the frontend web server.
The Vite development server does not install the service worker. Test with a full
saved library, stop the API/web server, reload a saved route, make edits, then
reconnect and verify the outbox clears without duplicated entries. See
`../docs/ai/api-surface.md` for the offline API and supported behavior.

For AI-agent guidance, read `../AGENTS.md`, `../docs/ai/request-routing-guide.md`, and `AGENTS.md` in this directory. Keep repo-wide policy out of this module README.
