## Design

### Processing run contract

The existing worker already claims one queue message, marks its domain record as
`processing`, and acknowledges only through `complete_worker_job`. R-13 keeps
that contract: the processing handler mutates only relational state, and queue
acknowledgement remains delegated to the transactional RPC after successful
domain work.

For a processing job, the handler:

1. Loads the flow and verifies it is enabled.
2. Loads the flow's configured sources.
3. Selects up to 50 newest ingested articles from those sources that have not
   been claimed by that flow.
4. Inserts `flow_articles` claim rows for the processing run.
5. If no articles were claimed, marks `processing_runs.status = no_content` and
   returns without creating a digest.
6. Groups near-duplicates, applies input budgets, and calls OpenAI.
7. Calls a service-role RPC that inserts/reuses one `processed_digests` row and
   updates claimed `flow_articles` to `included` with the digest ID in one
   database transaction.

The `flow_articles` primary key `(flow_id, article_id)` is the domain
idempotency guard. If a concurrent worker has already claimed an article, the
insert is treated as an already-processed candidate and is not sent to OpenAI.
If queue acknowledgement fails after digest persistence, a retry first checks
for the existing digest and repairs/verifies current-run `flow_articles` links
before returning success.

### Near-duplicate grouping

Article text is normalized to lowercase word tokens. The handler builds
three-word shingles and computes Jaccard similarity. Articles with similarity
`>= 0.6` to a group's representative are grouped together. The prompt passes
grouped source URLs so the generated digest can cite the story cluster without
repeating duplicate source text.

### Input budgets

The architecture budget is enforced in characters because the runtime does not
include a tokenizer:

- At most 50 newest candidates per flow run.
- Each article's content is truncated to 2,000 Unicode characters.
- Total article text included in the OpenAI request is capped at 60,000
  Unicode characters.
- OpenAI `max_output_tokens` is fixed at 4,000.

### OpenAI request

The worker uses the official Responses endpoint directly with `fetch` to avoid a
new SDK dependency in the Edge Function. The request body uses:

- `model: "gpt-5.4-mini"`.
- `max_output_tokens: 4000`.
- `text.format.type: "json_schema"`.
- `text.format.strict: true`.
- A strict schema requiring `title`, `language`, and `sections`.

The OpenAI documentation checked on 2026-07-04 confirms that Responses supports
Structured Outputs through `text.format` with `type: "json_schema"` and
`strict: true`, and that response usage is returned under `usage.total_tokens`.
If a model response fails local schema parsing, the worker makes one bounded
repair request with the same strict schema before failing the run.

### Security, privacy, and operations

- The queue payload stays ID-only (`flow_id`, `cycle_date`).
- The runtime API key is read from `OPENAI_API_KEY`; tests never contain a real
  key.
- Logs and worker errors use sanitized categories and do not include prompts,
  article bodies, or provider response bodies.
- User custom prompts are already encrypted at rest by R-11C and are used only
  inside the service-role worker path.
- Existing RLS remains deny-by-default for user access; service-role worker
  writes the digest and claim rows.

### Failure handling

Missing OpenAI configuration, provider timeouts, non-2xx provider responses,
malformed structured output after one repair attempt, and database write errors
fail the processing job. The worker records a sanitized `fail_worker_job` error
and relies on the queue retry/DLQ contract from R-11F.
