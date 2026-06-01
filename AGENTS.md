# Spendly Agent Instructions

This repo follows the shared Salesforce agent standards in `F:\Salesforce\AGENTS.md`.

## Repo Context

Spendly is a Salesforce Lightning Web Components expense tracking app. Users manage a hierarchy of `Spending__c -> Category__c -> Expense__c`, with recurring expense automation and settings.

## Reference Docs

- `agent-docs/project-overview.md` - product purpose, core hierarchy, and main app capabilities.
- `agent-docs/project-structure.md` - repository layout and important metadata locations.
- `agent-docs/architecture.md` - data model, Apex methods, app metadata, permissions, and flexipages.
- `agent-docs/components.md` - LWC and Apex component responsibilities.
- `agent-docs/key-patterns.md` - UI, filtering, modal, table, and export behavior.
- `agent-docs/salesforce-standards.md` - Flow, Apex, SOQL, LWC, deploy, and Git standards.
- `agent-docs/testing-and-tooling.md` - Apex/LWC tests, tooling, destructive deploy notes, and currency behavior.

## Local Notes

- Source API version: `65.0`.
- Currency behavior is PHP-focused; check `agent-docs/testing-and-tooling.md` before changing formatting.
- Prioritize Salesforce Lightning/SLDS styling for UI work; use custom styling only when the standard Salesforce patterns cannot reasonably cover the experience.
- `AGENTS.md` and `agent-docs/` are local agent notes unless the user explicitly asks to commit them.
