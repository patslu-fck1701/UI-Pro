# WerkZ Business Graph / Betriebszwilling

**Baseline:** KB-v1.24  
**Origin:** Abstraction from a user-provided external example, 2026-09-28.  
**Important:** The external person's/company's names, data and structure are not copied as WerkZ content.

## Key insight

WerkZ should not only maintain a graph of its technical knowledge systems. It should also be able to model a business itself as a connected operational graph: goals, customers, projects, processes, roles, employees/subcontractors, finance, documents, rules, automation, quality controls, open items and dashboards.

This creates two distinct but connected graph views:

1. **WerkZ System Graph** — where knowledge/code/evidence lives and how GitHub, WebsitePublisher, Drive, Chat, testing and founding artifacts connect.
2. **Business Operating Graph** — how a real business works and how its entities/processes depend on and influence one another.

Together they form the basis for a **WerkZ Business Twin**: a navigable, evidence-backed digital model of the customer's actual operating system.

## Proposed node classes

- Business / organization
- Goal / priority
- Customer / lead
- Project / order
- Process / workflow
- Task / open item
- Role / responsibility
- Employee / subcontractor
- Appointment / deployment
- Document / evidence
- Invoice / payment / cost
- KPI / finance metric
- Rule / standard
- Quality check
- Automation
- Integration / external system
- Risk / dependency
- Knowledge / decision
- Archive / historical state

## Relationship vocabulary

Examples:
- OWNS / RESPONSIBLE_FOR
- DEPENDS_ON / BLOCKS
- CREATES / PRODUCES
- ASSIGNED_TO
- PART_OF
- SERVES
- REQUIRES
- TRIGGERS / AUTOMATES
- VALIDATED_BY
- MEASURED_BY
- INVOICED_BY / PAID_BY
- SUPERSEDES / HISTORICAL_OF
- CONNECTED_TO

Relationships should carry provenance and, where relevant, state/time instead of being decorative lines.

## Views / perspectives

Do not show the whole graph all the time. Build role- and question-specific perspectives, e.g.:
- Management cockpit
- Today / morning briefing
- Customers & projects
- Processes & bottlenecks
- Employees & subcontractors
- Finance & KPIs
- Quality & open requirements
- Automation & integrations
- Knowledge / architecture / evidence
- History / archive

## WerkZ product principle

The graph is not the UI by itself. It is the connected semantic model beneath role-specific dashboards, workflows, search, automation and AI assistance.

A customer should be able to ask operational questions such as:
- What is blocked and why?
- Which customer/order is affected if this task fails?
- Who is responsible?
- What is overdue?
- Which invoice is still open?
- Which process has no owner?
- Which automation touches this workflow?
- What changed since yesterday?
- Where is evidence for this decision?

## Validation principle

A node/edge becomes operationally trusted only when its source/provenance and relevant state are known. Historical states remain available. Imported assumptions are marked as assumptions until validated.

## Privacy boundary

Do not ingest sensitive customer/employee data merely to make the graph richer. Model identifiers, roles, relationships and operational facts only when required and authorized. Keep public demo/example data synthetic or sanitized.

## Implementation posture

This is an architecture direction, not a claim that a graph database is already deployed. Start by expressing graph-compatible IDs, node types and relationship types in the existing WerkZ data model. A dedicated graph store can be evaluated later if traversal/impact analysis/search needs justify it.

## Confirmed generic relationship patterns from the external visual reference

The following patterns are adopted only at generic schema level because the supplied image visibly connects these business concepts. No company/person names, values, customer data, employee data or organization-specific labels are imported.

- Business goals/priorities ↔ company/management overview
- Customers/projects ↔ operational overview / daily steering
- Leads ↔ customer/project flow
- Processes ↔ system/organization architecture
- Roles/responsibilities ↔ employees / deployment planning
- Employee onboarding ↔ employee lifecycle / responsibility model
- Employees ↔ quality requirements / rules / standards
- Subcontractors ↔ commissioning / billing / standards
- Material procurement/supply ↔ operational processes
- Finance/KPIs ↔ management/company overview
- Outgoing invoice control ↔ finance / process control
- Quality control ↔ processes / responsibility
- Open requirements ↔ projects / responsibility / planning
- Automation ↔ operational/company overview
- Daily/morning steering ↔ customers/projects / operational state
- Archive/history ↔ company knowledge/history

These are **relationship hypotheses promoted to generic WerkZ schema patterns**, not facts about any specific third-party business. Before customer use, WerkZ must validate which relationships actually apply to that customer.

## Privacy extraction rule

External examples may teach WerkZ only at the level of generic node classes, generic relationship classes, workflow motifs and view patterns. Never ingest names, company identity, exact internal wording, customer/employee identities, values, credentials, internal performance data, or other organization-specific content unless the data owner explicitly authorizes it for a concrete WerkZ engagement.
