# Documentation Decision Strategy

The documentation is organized as a one-way decision chain. A downstream layer may refine or implement an upstream decision, but it must not silently change it.

```text
Business requirements and NFRs
        ↓
Data model and data policies
        ↓
Application architecture, tactics, and quality standards
        ↓
Technology trade-off analysis and selections
        ↓
Hosting and deployment
```

## Layer Ownership

| Layer | Owns | Must use as inputs | Must not contain |
| --- | --- | --- | --- |
| `1_business` | Product behavior, scope, constraints, measurable qualities | User/product decisions | Database schemas, frameworks, providers, deployment design |
| `2_data` | Required information, relationships, lifecycle, integrity rules | Business requirements and NFRs | UI/runtime/provider choices |
| `3_application` | Logical components, responsibilities, data flow, architecture tactics, security boundaries, quality gates | Business plus data decisions | Concrete frameworks, databases, queues, IaC tools, or hosting providers |
| `4_technology` | Alternative analysis, concrete technology decisions, deployment realization | Business constraints, data needs, and application architecture | New product behavior not approved upstream |

## Decision Rules

1. Every durable requirement or decision has a stable ID.
2. Every downstream decision cites the upstream IDs that require it.
3. Technology selections follow an alternatives/trade-offs analysis; the chosen product is stated after the analysis.
4. If no upstream requirement supports a proposed downstream choice, either remove the choice or add/approve the missing upstream requirement first.
5. If implementation reveals a product ambiguity, resolve it in `1_business` and then propagate the result downward.
6. External limits and pricing are evidence, not requirements. Record their verification date and source in `4_technology`.
7. A change is complete only when traceability tables and affected downstream documents are updated.

## Decision Record Shape

Use this compact structure for new decisions:

| Field | Meaning |
| --- | --- |
| ID | Stable identifier, such as `BR-DEL-05`, `A-04`, or `T-03` |
| Inputs | Upstream requirement/decision IDs |
| Options | Credible alternatives considered |
| Decision | Selected behavior or solution |
| Rationale | Why it best satisfies the inputs |
| Consequences | Known limits, risks, and exit conditions |
| Verification | Test, metric, or source that can confirm the decision |
