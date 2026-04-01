# Spendly — CLAUDE.md

## Project Overview

A Salesforce Lightning Web Components (LWC) expense tracking app. Users log expenses under a two-level hierarchy (Spending → Category → Expense) and view/filter them in a datatable.

## Architecture

### Data Model
```
Spending__c
  └── Category__c (Spending__c lookup)
        └── Expense__c (Category__c lookup)
              ├── Amount__c
              ├── Expense_Date__c
              ├── Bank__c (global value set)
              ├── Transaction_Type__c
              └── Description__c
```

### Components

| Path | Role |
|------|------|
| `lwc/spendlyApp` | Main app shell — filters, datatable, delete, edit, modal trigger |
| `lwc/spendlyExpenseModal` | Add/Edit Expense modal — form, animations, focus trap |
| `classes/SpendlyController.cls` | Apex backend — all SOQL and DML |
| `classes/SpendlyControllerTest.cls` | Apex test class |

### Apex Methods
- `getAllSpendings()` — cacheable, returns all `Spending__c` ordered by Name
- `getCategoriesBySpending(spendingId)` — cacheable, filters by spending or returns all
- `getExpensesByFilters(spendingId, categoryId, startDate, endDate)` — cacheable, dynamic SOQL
- `deleteExpense(expenseId)` — non-cacheable, deletes a single `Expense__c`

## Key Patterns

### Reactive Filters
All wire adapters in `spendlyApp.js` use `$property` bindings. Changing `spendingId`, `categoryId`, `startDate`, or `endDate` automatically re-fetches data. When `spendingId` changes, `categoryId` resets to `'All'`.

### Date Validation
`validateDates()` checks if `startDate > endDate` and displays an inline error message. Prevents invalid date ranges from being queried.

### Infinite Scroll
Loads 20 rows initially, adds 10 on each `loadmore` event. All rows are held in `allRows`; `rowsToDisplay` is the visible slice.

### Totals
`totalAmount` sums all filtered rows (not just visible). `formattedTotal` formats as PHP currency using `Intl.NumberFormat`.

### Empty State
When no expenses match the current filters, a friendly message with icon is displayed instead of an empty table.

### Modal
- Opened via `isOpen` prop; closed by firing a `close` custom event
- Supports both Add and Edit modes via `recordId` prop
- `isClosing` flag triggers CSS `fade-out` animation; the `close` event dispatches only after `animationend`
- Implements ESC-to-close, Tab focus trapping, body scroll lock, and focus restoration
- On Add success: clears fields, fires `success` event, stays open
- On Edit success: fires `success` event, auto-closes

### Date Input Styling
A static resource (`RemoveDateFormatStyle.css`) loaded in `renderedCallback` hides the browser date format hint. The `date-format-hide` class is applied to date inputs in both components.

### Row Actions
Row action dropdown with Edit and Delete options. Edit opens the modal with `recordId` pre-filled. Delete uses `LightningConfirm.open()` → `deleteExpense` Apex → `refreshApex(wiredExpenseResult)`.

## Destructive Deploy
`destructive/destructiveChanges.xml` — removes all old `TrackSpend`-named components from the org. Run before deploying the renamed `Spendly` components:
```bash
sf project deploy start --manifest destructive/package.xml --post-destructive-changes destructive/destructiveChanges.xml --target-org your-org-alias
```

## Testing

Apex tests are in `SpendlyControllerTest.cls`. Uses `@testSetup` for shared data (2 spendings, 3 categories, 3 expenses). Covers:
- Happy path for all controller methods
- Null ID deletion (expects exception)
- Forced DML failure via `UserInfo.getUserId()` trick in the controller

## Currency
All amounts are in **PHP (Philippine Peso)** — hardcoded in the datatable column `typeAttributes`.
