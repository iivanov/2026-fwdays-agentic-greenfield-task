## Why

The scheduler and ingestion worker can now enqueue flow processing work, but the
processing queue still lacks the AI step that turns newly ingested articles into
a user-facing digest. R-13 delivers that vertical slice: claim new articles for a
flow/day, group near-duplicates, enforce input budgets, call the selected OpenAI
Responses API with strict structured output, persist usage metadata, and record
`no_content` when there is nothing new to summarize.

## What Changes

- **Processing Selection**: Selects up to 50 newest unclaimed articles from the
  flow's configured sources and claims them through `flow_articles`.
- **Near-duplicate Grouping**: Groups article candidates by n-gram Jaccard
  similarity before building the model input.
- **Input Budgets**: Truncates each article to 2,000 Unicode characters and caps
  total article text at 60,000 characters before every AI request.
- **OpenAI Responses API**: Calls the Responses endpoint using
  `gpt-5.4-mini`, `max_output_tokens: 4000`, and strict JSON-schema structured
  output.
- **Usage Persistence**: Persists structured digest content plus token usage,
  provider request ID, and model on `processed_digests`.
- **No-content Outcome**: Marks the run `no_content` and creates no digest when
  a flow has no new articles.

## Capabilities

### New Capabilities

- `ai-processing-worker`: Batch article claiming, near-duplicate grouping,
  budgeted AI digest generation, usage persistence, and no-content outcomes.

### Modified Capabilities

<!-- No requirement changes to existing capabilities. -->

## Impact

- **Edge Functions**: Extends `supabase/functions/work/index.ts` processing
  queue handling.
- **Database**: Uses existing `processing_runs`, `flow_articles`, and
  `processed_digests` tables, and updates the transactional completion RPC to
  preserve explicit `no_content` processing outcomes.
- **External APIs**: Requires `OPENAI_API_KEY` at runtime; tests use mocked
  fetch only and do not call OpenAI.
- **Tests**: Adds Vitest coverage for processing selection, dedupe grouping,
  budget enforcement, strict output parsing, usage recording, and `no_content`.

## Non-goals

- Delivery worker creation/sending is R-14.
- Feedback analytics are R-15.
- Provider quota threshold alerting and fail-closed free-tier exhaustion are
  R-17.
