# Architecture summary

## Product purpose

Lexora is a personal multilingual vocabulary learning app centered on:

- topic-based study
- fast review
- knowledge-level progression
- smart review queues
- quick word management

Learning libraries are separate for English, Mandarin Chinese, Spanish, German,
Turkish, Tatar, Arabic, French and Portuguese. The header language selector chooses
the library and Russian (default) or English translations/explanations. Changing
the library clears scoped query data and returns to All words. Existing English
Word IDs, topics and learning progress remain in the English library; new libraries
start empty. See `multilingual.md` for language, migration and offline contracts.

## Runtime shape

### Local development

- Postgres runs in Docker
- backend serves FastAPI on port 8000
- frontend is served on port 5173

### Backend

The FastAPI app mounts routers for:

- health
- auth
- topics
- words
- word topic suggestion
- smart review
- trash
- stats

Protected functional routers are guarded by:

- session cookie verification
- CSRF header verification

Backend features are organized as modular packages under `backend/app/features/`.

Current boundary rule:

- feature-owned business logic stays inside the owning feature package
- `app/shared/` is for technical cross-cutting concerns only
- cross-feature access should prefer small feature API modules such as `topics/api.py` and `words/api.py`
- other features should avoid importing another feature's repository or domain internals when a feature API can expose the needed operation

### Frontend

Frontend bootstraps React and uses a browser router.

Confirmed routes:

- `/` — My Vocabulary homepage
- `/login`
- `/smart-review`
- `/words` — bulk vocabulary view
- `/topics/:topicSlug`
- `/words/:wordId`
- `/words/:wordId/edit`
- `/trash`
- `/stats`

Word lists share a compact toolbar on desktop and mobile: collection heading,
collection knowledge progress, then sorting, filtering, and search controls. Search
sits immediately after Sort and Filters as a permanent inline field; on mobile,
focusing it expands the field across the control row. The
heading distinguishes All words, the selected topic, and Daily Word Mix, with a
matching/collection count when filtered. Progress always covers the collection,
independent of filters; exact knowledge counts expand from the percentage legend.
The four mobile legend labels and two-decimal percentages share one row; below
360px, decorative dots are hidden to preserve space for the text.
Filter chips, reset controls, and detailed sorting appear only in the filter panel.
Word lists open full details through the word term or row; desktop rows have no
separate expand button or inline expanded-details section.
On mobile, Filters opens a native modal bottom sheet with independent scrolling
and a pinned Done button. Opening/closing it does not move the word list.
Knowledge saves update badges and collection progress while retaining the current
page membership/order. Paginated word queries are marked stale without refetching
for knowledge-only updates, and do not refresh on focus, reconnect, or remount.
Changing list controls/pages or reloading fetches the current saved ordering.
The homepage has no separate My Vocabulary summary card. Daily Word Mix remains
available through the sidebar/menu. Its shared toolbar shows one knowledge
distribution bar, an All words / Daily Word Mix breadcrumb and New set beside
the heading; completion continues to be tracked without another progress bar.

The shared Add word action is available on the homepage, bulk vocabulary, and
topic lists. Its modal preserves drafts after failed saves and prevents duplicate
submissions. Knowledge pickers render outside list containers so sticky controls
cannot cover their options; positioning stays within the viewport.
The word actions popup uses a top-right X to close, including its Trash
confirmation step; dismissal stays disabled while a deletion is pending.
Word details, Trash, and Daily Word Mix distinguish request failures from missing or empty data
and offer Retry. Review completion can be retried without saving the word level
again, and late completion responses cannot replace a newer mix or reduce progress.
The word editor locks fields during saves and waits for enrichment before saving.
Word edits and knowledge-level writes share a per-word request queue. List and
Daily Mix caches receive saved words, and failed completion acknowledgements stay
retryable independently of later successes. A stored Swipe acknowledgement is
cleared when the refreshed server queue already marks that item complete.

Unsaved word edits block route navigation until kept or explicitly discarded;
successful saves and explicit Cancel navigation bypass that guard. Detail panels
preserve the originating filtered word sequence when opening the full editor.

Enrichment tries Gemini first, then the configured OpenAI-compatible provider.
The fallback uses the same multilingual JSON parser and does not save generated
content. A genuine provider credential is required; retired GitHub Models hosts
are rejected. Production configuration and credential recovery belong to Vault.
The topic editor is a native modal outside the sidebar, with scrollable fields and
visible actions on short screens. Topic refetches preserve its unsaved draft.
Topic row actions are available on keyboard focus and touch screens as well as hover.

## Request flow

### Normal authenticated request

1. user logs in
2. backend returns `csrf_token`
3. frontend stores CSRF token
4. frontend request helper sends:
   - cookies via `credentials: 'include'`
   - `X-CSRF-Token` header when available
5. backend verifies cookie + CSRF before protected routes proceed

### Word update flow

Typical path:

- frontend feature API -> shared HTTP helper
- FastAPI router
- service/repository logic
- SQLAlchemy session / DB
- response schema back to frontend

### Smart review flow

- frontend study page chooses smart review route
- backend returns active queue or generates/refreshes one
- queue item completion updates queue state
- frontend renders resulting queue response

Daily Word Mix has List and Swipe views over the same queue. Swipe presents one
word with its translations, selected pronunciation and a saved example. Right
rates Strong (4), left Parked (5), up Okay (3), and down skips locally without a
knowledge or completion request. Visible buttons provide the same actions.
Previous/Next only navigate; there is no Undo action. Direction previews require
an 80px unambiguous drag before release, and pointer cancellation never rates.
The example area scrolls independently of the gesture surface.

The versioned per-learning-language local storage entry contains queue identity,
item IDs, cursor, decisions and any saved-rating/pending-completion marker; it
contains no word text. Position survives List/Swipe switching and reopening the
same queue on the same device, and resets for a new queue identity. Translation
language changes do not discard this learning-language session. Skips are offered
again at the end, and unrated words reached by navigation are offered as remaining
work. Ratings advance only after level and completion requests succeed; a failed
completion retries without submitting the saved rating again, including after
reload. Pending saves block mode switching and navigation. Window focus does not
silently regenerate the active review queue. Expired/server-replaced queues still
follow the existing queue lifecycle; progress is not claimed to sync between devices.

### AI topic suggestion flow

Current path:

1. frontend sends word + translation
2. backend loads all active topics
3. backend composes a prompt containing the full topic list
4. model returns one topic name
5. backend validates that the name exists
6. response returns the selected topic name

This design is simple but will become more expensive as topic count grows.

## Design priorities for future changes

- keep auth contract stable
- preserve small, focused feature boundaries
- prefer feature-local ownership over moving business logic into shared modules
- add cross-feature facades only when a second feature genuinely needs stable access
- prefer deterministic or cached logic before LLM calls
- keep network payloads and model prompts compact
- avoid cross-cutting refactors unless a bug or repeated pain justifies them
