## ADDED Requirements

### Requirement: Database Tables Schema
The database SHALL define tables matching the fields, constraints, types, and primary/foreign keys specified in `data_structure.md` (satisfies D-01..06).

#### Scenario: Verify tables exist
- **WHEN** the schema is fully applied to the database
- **THEN** all tables and indexes match the structural specification exactly

### Requirement: Deny-by-Default Row Level Security (RLS)
Every table SHALL have Row Level Security enabled. No table SHALL allow unauthenticated public reads or writes unless explicitly permitted.

#### Scenario: Authenticated User Isolation
- **WHEN** an authenticated user queries the `profiles`, `delivery_channels`, `processing_flows`, or `processed_digests` tables
- **THEN** they can only view or modify rows where the `user_id` matches their own verified authenticated identifier (`auth.uid()`)
