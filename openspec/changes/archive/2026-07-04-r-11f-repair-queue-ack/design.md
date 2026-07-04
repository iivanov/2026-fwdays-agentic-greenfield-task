# Design

The Edge worker remains the orchestration boundary, but queue acknowledgement moves into PostgreSQL RPCs so domain state mutation and `pgmq.delete`/`pgmq.archive` share one transaction. The worker treats RPC errors as failures and never reports success if a state update or queue acknowledgement fails.

## Safety

- Service-role-only functions validate queue names and job kinds.
- Message payload context recorded for DLQ is reduced to IDs and type fields.
- Delivery attempts use existing schema values: `sending`, `delivered`, `failed` with `error_message`.
- Ordinary failures keep the message leased for pgmq retry; exhausted reads archive and log atomically.
