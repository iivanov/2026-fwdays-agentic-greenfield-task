## MODIFIED Requirements

### Requirement: Deny-by-Default Row Level Security (RLS)
Every table SHALL have Row Level Security enabled. No table SHALL allow unauthenticated public reads or writes unless explicitly permitted. Shared cache tables SHALL only expose rows to authenticated users through owned flow links.

#### Scenario: Authenticated User Isolation
- **WHEN** an authenticated user queries the `profiles`, `delivery_channels`, `processing_flows`, or `processed_digests` tables
- **THEN** they can only view or modify rows where the `user_id` matches their own verified authenticated identifier (`auth.uid()`)

#### Scenario: Shared source visibility is flow-linked
- **WHEN** an authenticated user queries `global_sources`
- **THEN** they can only view sources connected to one of their owned processing flows through `flow_sources`

#### Scenario: Shared article visibility is flow-claimed
- **WHEN** an authenticated user queries `ingested_articles`
- **THEN** they can only view articles claimed by one of their owned processing flows through `flow_articles`
