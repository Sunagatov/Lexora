# Lexora Frontend

React/Vite frontend for Lexora.

Source lives in `src/`.

## Local Commands

```bash
npm ci
npm run dev
npm test
npm run lint
npm run build
```

Use Node 22.22.2+, 24.15.0+, or 26+; the Docker builder uses Node 26.
TypeScript stays on 6.0.3 because typescript-eslint 8.72.1 requires TypeScript
below 6.1. Upgrade it when the lint adapter supports TypeScript 7.
The minimatch override supplies the patched 11.x release to ESLint and its
TypeScript adapter while their dependency ranges still select vulnerable 10.x.

Offline mode is available in production builds: `npm run build`, then
`npm run preview` (with a same-origin API proxy/server), or the frontend web server.
The Vite development server does not install the service worker. Test with a full
saved library, stop the API/web server, reload a saved route, make edits, then
reconnect and verify the outbox clears without duplicated entries. See
`../docs/ai/api-surface.md` for the offline API and supported behavior.

For AI-agent guidance, read `../AGENTS.md`, `../docs/ai/request-routing-guide.md`, and `AGENTS.md` in this directory. Keep repo-wide policy out of this module README.

Main-screen regression checks cover Next/Previous during loading and failed page
requests, all page sizes (50/100/200), and resetting scroll when the size changes.
Previous page totals stay available while loading; placeholder rows are hidden
until the requested page arrives. Knowledge updates track every pending word,
including overlapping saves. Swipes save the new knowledge level directly,
without an Undo popup. Failed saves still roll back and show an error.

Swipe checks also cover diagonal direction locking, accurate release hints,
cancellation by the active pointer, keyboard activation after cancellation,
and stopping card movement during a pending save. Vertical scrolling and
screen-edge navigation remain available.

Interrupted drags are discarded when a card becomes disabled, and mouse drags
stop if the primary button is no longer held. Unlocking the card requires a new
gesture rather than resuming the interrupted one.
Swipes started while saving also stay on the list without opening word details;
ordinary taps still work.
The release position also handles fast flicks without intermediate movement
events; short drags do not open the word, and reversing direction commits once.

Word details opened from a list keep its filtered order for Prev/Next and its
original page and scroll position for Back. Server-paged lists load only the
neighbouring page at a boundary; topics and Daily Word Mix keep their loaded
filtered sequence. A failed neighbouring-page request can be retried without
hiding the current word. Direct word links retain topic navigation.

## Browser diagnostics

Set `VITE_FARO_URL` at build time to enable optional, self-hosted Faro telemetry.
The SDK loads separately after startup and collects error types/script locations,
Core Web Vitals and numeric outcomes for failed or slow requests. It does not
collect error message text, request URLs, headers, bodies, form values, user IDs
or session IDs. Each page has a 60-signal/minute limit; telemetry failures do
not change application requests. Server routing, ingestion limits and dashboard
configuration belong to Vault.
