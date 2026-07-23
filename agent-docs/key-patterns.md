# Key Patterns

## Workspace Shell

`spendlyApp` owns an internal workspace shell driven by `VIEW_CONFIG`.
Desktop uses a collapsible left sidebar so Spendly can have app-like
navigation inside Salesforce, while smaller screens fall back to a horizontal
view strip. The first available `Expense_Group__c` is selected automatically,
and the sidebar dropdown is the workspace group switcher. Dashboard,
Expenses, and Recurring only load data after that group context is
selected. Dashboard is the default view and shows a current-period hero, header
month navigation, summary cards, category/bank charts, six-month trend, latest
expenses, and insight cards. Expenses uses a
two-column workspace: a left filter rail for search, date, and category
controls; and a right expense panel with date-grouped expense rows,
period summary, total amount, export, print, bulk delete, and row actions.
Expense row actions should use a Salesforce-style action menu instead of
multiple exposed icon buttons when there is more than one row action.
Recurring uses a custom grouped workspace view for template summaries, due
status, schedule details, manual run, edit, and deactivate actions. Settings is
reserved for app-level controls.

Custom views should stay close to Salesforce Lightning styling: neutral card
borders, light typography, compact headings, and restrained custom shadows.
Dashboard rows should share the same workspace edges; avoid adding horizontal
padding inside child dashboard row components unless the adjacent rows use the
same inset.
Dashboard labels and values should handle long category/bank names and large
currency values with truncation or compact display. Do not rely on hover for
important dashboard values; show exact amounts in summary cards, lists, or
insight details where precision matters.

## Reactive Filters

`spendlyApp.js` binds filters to the UI state. Changing the workspace
`expenseGroupId` reloads the scoped expense data and resets `categoryId` to
`All`. Changing `categoryId`, `startDate`, or `endDate` reloads the data inside
the selected expense group. Dashboard and Expenses both show previous/next
month controls in their view headers. These controls set `startDate` and
`endDate` to the selected calendar month, then reload through the same filter
path so both views stay on the same selected month.

## Date Validation

`validateDates()` prevents invalid date ranges by showing an inline error when
`startDate` is later than `endDate`.

## Default Date Range

The app defaults to the current month on load.

## Incremental Loading

The expense list loads 20 rows initially and adds 10 rows when users click
Load More. All filtered rows stay in memory, while `rowsToDisplay` controls the
visible slice.

## Totals And Summaries

`totalAmount` sums all filtered rows, not only visible rows. `formattedTotal`
uses PHP currency formatting via `Intl.NumberFormat`.

Summary cards show total amount, expense count, average expense, top
category, and top bank. Dashboard chart and summary fallbacks should match the
expense row display labels, such as `No bank` for blank bank values.

## Charts

The app renders category, bank, and monthly trend visualizations from the
filtered expense set and monthly Apex trend data. The expense list uses the
selected date range, while the trend request expands the start date to the
first day of the fifth previous month so the dashboard can show a six-month
window for the currently selected month. The trend chart shows per-month PHP
totals, uses a small minimum height for non-zero months, and highlights the
currently selected month.

## Empty State

When no expenses match the filters, the app shows a friendly empty state
instead of an empty datatable.
Dashboard loading uses a clear spinner state before cards/charts render, and
dashboard empty states should use Salesforce-style boxes/media patterns rather
than custom decorative treatments.

## Modal

- Opened via `isOpen`; closed by firing a `close` custom event.
- Supports Add, Edit, and Duplicate flows.
- Uses standard SLDS modal structure with Lightning form controls and an SLDS
  footer; keep custom modal CSS minimal.
- Uses `recordId` for edit mode and `duplicateData` for duplicate mode.
- Uses `isClosing` to trigger the CSS fade-out animation.
- Dispatches `close` only after `animationend`.
- Implements Escape-to-close, Tab focus trapping, body scroll lock, and focus restoration.
- On Save & New, clears fields and stays open.
- On regular Save, closes after success.
- Uses `lightning-record-edit-form`.
- Category selection is a required `lightning-combobox` populated from the
  current workspace `Expense_Group__c`; the selected category is injected into
  the record form on submit.

## Date Input Styling

`RemoveDateFormatStyle.css` hides the browser date format hint. Components add
the `date-format-hide` class to date inputs.

## Transaction Time Input

`Expense__c.Transaction_Time__c` stays as a Salesforce Time field, but the
expense modal uses `lightning-input type="time"` and injects the normalized
time value into `lightning-record-edit-form` on submit. This allows exact
minute entry while preserving Lightning Data Service save behavior.

## Expense List

The Expenses view uses custom date-grouped rows instead of
`lightning-datatable`. Each row shows the expense name, category, bank,
transaction type, time, date, and PHP amount. Checkboxes populate
`selectedRows` for bulk delete, while row icon buttons call the shared
edit/duplicate/delete behavior. Prefer Lightning button/icon controls and
quiet SLDS-like row typography over custom button chrome.

## Row Actions

Rows support Edit, Duplicate, and Delete. Delete uses `LightningConfirm.open()`
and calls Apex delete methods.

## Bulk Delete

Selected rows can be deleted in bulk through `deleteExpenses`. Keep this
bulkified and avoid one-DML-per-row implementations.

## Export And Print

The app can export filtered rows to CSV and render a print-only expense report.

## Recurring Expense Templates

Recurring expense templates are represented by `Recurring_Expense__c`.
`Expense__c.Recurring_Expense__c` links an expense back to the template that
generated it. The custom Recurring workspace view loads templates through
`SpendlyController.getRecurringExpenseOverview()`, scoped by the current
`Expense_Group__c`, and displays active count, due-today count, and a normalized
monthly estimate. Manual generation calls
`SpendlyRecurringExpenseService.runDueExpensesBatch()`, while deactivation uses
a single-record Apex update. Generation automation uses Batch Apex so more than
100 due templates can be processed without hitting per-transaction governor
limits.

## Spendly Settings

`Spendly_Settings__c` stores singleton app-level controls. `SpendlySettingsTrigger`
prevents multiple settings records, while `SpendlySettingsService` creates the
default record when missing. The `spendlySettings` LWC lets users enable or
disable recurring expense generation, manually queue a recurring run, and view
the most recent run status.
