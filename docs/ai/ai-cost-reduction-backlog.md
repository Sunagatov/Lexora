# AI cost-reduction backlog for Lexora

This backlog is specific to Lexora’s current topic-suggestion flow.

## Current baseline problem

The current implementation sends:

- a system prompt
- the word and translation
- the **entire active topic list**

on every request, then allows up to `max_tokens = 40`.

That is fine for a small topic catalog, but it creates avoidable token growth, latency growth, and noisy outputs as the catalog expands.

## Lexora-specific reusable rules

These are the rules that have repeatedly mattered in later Lexora work and should be treated as defaults.

### Enrichment

- export from prod only
- use lean exports
- use `needs_examples_only=true` when you only need unfinished words
- treat 3 natural English examples per word as the completion threshold
- skip already-complete words
- keep examples natural, not templated
- prefer model-written examples over deterministic filler
- do not use deterministic template generators unless explicitly asked
- prefer page-by-page work and avoid pasting large histories back into prompts

### Topic splitting

- only split topics with more than 300 active words
- skip part-of-speech umbrella topics for now
- keep umbrella topics intact
- split only when the new buckets are clearly narrower and easy to explain
- if the split would produce fuzzy or near-duplicate topics, do not split
- reuse an existing topic if it already fits closely enough
- prefer fewer, broader subtopics over many adjacent siblings
- review dry-run output before live import
- if the app supports hierarchy, keep umbrella topics and add child topics beneath them
- do not force grammar buckets into the splitter
- use `parent_topic_id` for subtopics instead of inventing new relation types
- keep many-to-many membership when a word belongs in multiple topics

### Ops hygiene

- Vault is the source of truth for prod deploys, logs, SSH, config, and secrets
- do not use stale maintainer scripts
- do not use local DB exports for prod imports because IDs differ across environments
- keep generated artifacts under `backend/.artifacts/ai-curation/`
- if Alembic startup hits a prepared-statement collision, check the migration engine settings before retrying deploys
- dry-run first, then spot-check a small sample, then live import

---

## Priority 0 — highest ROI

### 1. Return a tiny structured answer
**Idea:** ask for a stable topic ID or a short index instead of a full topic name.

**Why it helps**
- fewer output tokens
- lower risk of formatting drift
- easier validation

**Implementation direction**
- build a numbered candidate list
- prompt model to return only the number
- set output budget closer to `1–8` tokens

**Expected impact**
- small engineering effort
- immediate token savings
- simpler parsing

---

### 2. Add normalized request-result caching
**Idea:** cache by normalized `(term, translation, topic_catalog_version)`.

**Why it helps**
- repeated lookups become free
- faster UX for common words
- fewer upstream model calls

**Implementation direction**
- normalize case and whitespace
- include a catalog version or hash so cache invalidates when topics change
- use TTL plus catalog-aware invalidation

**Expected impact**
- very high for repeated use
- lower latency and cost

---

### 3. Short-circuit obvious matches before the model
**Idea:** if a deterministic rule can confidently choose a topic, skip the model.

**Examples**
- exact term already seen before
- exact translation already seen before
- strong synonym / phrase rules
- only one active topic exists

**Expected impact**
- high for frequent or repetitive usage
- zero model tokens for easy cases

---

### 4. Reduce candidate topics before prompting
**Idea:** shortlist topics first, then ask the model to choose from a much smaller list.

**Cheap shortlist options**
- lexical similarity on topic names
- previously used topic for same/similar word
- simple keyword dictionaries
- topic-specific frequency hints

**Expected impact**
- lower input tokens
- lower confusion for the model
- faster responses

---

### 5. Lower `max_tokens`
**Idea:** current `max_tokens = 40` is generous for a one-label classification task.

**Suggested target**
- `4` if using numbered output
- `6–8` if using exact label output

**Expected impact**
- immediate cost control
- lower chance of verbose answers

---

## Priority 1 — still very practical

### 6. Batch suggestion endpoint for imports
**Idea:** when many words are added together, classify them in batches or reuse cached results.

**Why it helps**
- amortises request overhead
- enables deduplication inside one import session

---

### 7. Add lightweight observability
Track:

- request count
- cache hit rate
- prompt candidate count
- model latency
- timeout count
- invalid-response count
- fallback usage

**Why it helps**
- you can optimise from evidence instead of intuition

---

### 8. Separate confidence tiers
**Idea:** deterministic high-confidence path, model medium-confidence path, manual fallback low-confidence path.

**Why it helps**
- keeps expensive calls only for ambiguous cases

---

### 9. Store per-topic aliases / keywords
**Idea:** enrich topics with optional short alias lists or seed keywords.

**Why it helps**
- better shortlisting without large prompts
- can stay fully local for many decisions

---

## Priority 2 — more advanced

### 10. Embedding-based preselection
Use embeddings or another compact semantic index to shortlist a few candidate topics before the final classifier call.

**Trade-off**
- extra engineering and storage
- strongest benefit when topic count grows a lot

---

### 11. Evaluation harness
Create a gold dataset of words -> expected topics.

Measure:
- accuracy
- average candidate count
- average latency
- cache hit rate
- cost per 100 suggestions

This prevents “cheaper but worse” regressions.

---

### 12. Provider / model fallback ladder
Example:

1. deterministic rules
2. smallest cheap classifier model
3. stronger fallback only for ambiguous misses

This keeps most traffic on the cheapest path.

---

## Recommended implementation order

1. numbered or ID-based output
2. lower `max_tokens`
3. caching
4. deterministic shortcuts
5. candidate shortlisting
6. metrics
7. batching
8. evaluation harness

## Practical acceptance criteria

A good first optimisation pass should achieve most of these:

- fewer tokens per suggestion
- same or better success rate
- lower timeout/error rate
- no verbose model output
- repeat requests often resolved from cache
- easy-to-read logs for failures and cache hits
