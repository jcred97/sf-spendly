# Spendly Handover

## Current State

- Main branch is pushed and clean after the latest expenses table layout polish.
- Spendly is centered around a custom LWC workspace in `force-app/main/default/lwc/spendlyApp`.
- The app currently uses `Expense_Group__c`, `Category__c`, `Expense__c`, recurring expense automation, and Spendly Settings.
- Recent UI direction: keep the custom workspace, but make it feel closer to Salesforce Lightning/SLDS and avoid heavy custom styling unless needed.

## Recent Work

- Spendly Settings global recurring automation can be enabled/disabled and is being expanded to let the global daily run time be changed from the Settings UI.
- Recurring view summary cards, template panel, rows, due/inactive states, and row actions were polished toward the same Salesforce/SLDS direction as Dashboard and Expenses.
- Dashboard panels, summary cards, charts, latest expenses, and insight cards were tightened toward Salesforce/SLDS styling with better truncation and responsive behavior.
- Expenses UI was polished with a fixed/scrollable list area, loading state, footer status, and Load More behavior.
- Export CSV and Print / PDF actions were moved beside Add Expense in the Expenses header.
- Dashboard and Expenses language was changed from Transactions to Expenses in the custom UI.
- Dashboard month controls, empty/loading states, and chart presentation were adjusted toward Salesforce-style UI.

## Watch Points

- Verify the app in the org after deploys because Salesforce shell height and page scroll behavior can differ from local expectations.
- Keep dashboard and expenses views in sync after create, edit, duplicate, delete, and bulk delete actions.
- For UI polish, prefer `lightning-*` base components and SLDS utility classes first.
- Check PHP currency formatting behavior before touching amount display.
- Do not commit `AGENTS.md`, `agent-docs/`, or this handover unless the user explicitly asks.

## Next Likely Work

- Continue reducing custom CSS where Lightning/SLDS can cover the same behavior.
- Validate the Spendly Settings global recurring run-time control in the org, including saving a new time and confirming the scheduled Apex cron updates.
- Verify the refreshed Recurring layout in the Salesforce shell after deploy, including inactive templates, due-today templates, and long recurring template names.
- Verify the refreshed Dashboard layout in the Salesforce shell after deploy, especially with long category/bank names and large PHP amounts.
- Revisit fixed-height Expenses layout if the Salesforce page still shows an outer scrollbar.
- Continue with Settings polish after Dashboard and Recurring verification.
