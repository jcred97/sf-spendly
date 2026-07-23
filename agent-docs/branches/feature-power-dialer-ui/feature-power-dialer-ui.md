# feature/power-dialer-ui

Last updated: 2026-06-21 Manila time

## Purpose

Recreate the AMAHC Power Dialer pattern in Spendly without real customer data or AMAHC-specific integrations.

## Implemented Scope

- Added Lead and Opportunity Power Dialer Lightning tab components.
- Added standard-object Apex controllers for Lead and Opportunity queues.
- Added exclusion checkboxes on Lead and Opportunity for manual removal from dialer queues.
- Added direct custom tabs for Lead Power Dialer and Opportunity Power Dialer.
- Kept the implementation generic to standard Salesforce CRM fields.
- Included click-to-dial, System Administrator owner filtering, queue filters, sorting, pagination, follow-up task creation, task completion, and manual queue removal.

## Excluded From Port

- Shopify, Tidio, Klaviyo, Aircall summary objects/fields, AMAHC scoring/product fields, and AMAHC manager flags were intentionally not copied.

## Validation

- Pending local syntax and Salesforce validation.
- No deploy, commit, or push has been performed.
