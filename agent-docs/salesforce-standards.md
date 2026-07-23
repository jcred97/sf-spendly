# Salesforce Standards

## Declarative First

- Before writing Apex, evaluate whether the requirement can be met using Flow.
- Ensure custom code respects Salesforce Flow best practices.

## Apex And SOQL

- Bulkify all Apex code. Handle lists of records, not only individual records.
- Avoid DML and SOQL queries inside loops.
- Every trigger or class must have a corresponding test class with at least 85% code coverage.
- Use `@IsTest` and meaningful `System.assert` methods.
- Never hardcode Salesforce IDs.
- Prefer Custom Labels, Custom Metadata, or `$Setup` Custom Settings for configurable values.

## Lightning Web Components

- Follow standard LWC separation of concerns: HTML, JavaScript, and CSS.
- Do not use Aura components unless they are strictly necessary for a platform limitation, standard button override, or managed package requirement.
- Use `@salesforce/apex` imports for server-side calls.

## Deployment And Git

- Ask the user before deploying, committing, or pushing.
- Validate deployable changes with `sf project deploy start --dry-run` before a full deployment.
- For project architecture and repo context, reference `agent-docs/architecture.md`.
- Use clear, scoped commit messages that summarize the user-facing intent, keep subject lines concise, and include body details when the change needs context or verification notes.
