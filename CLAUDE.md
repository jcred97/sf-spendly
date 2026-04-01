# TrackSpend App — CLAUDE.md

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
| `lwc/trackSpendApp` | Main app shell — filters, datatable, delete, modal trigger |
| `lwc/trackSpendExpenseModal` | Add Expense modal — form, animations, focus trap |
| `classes/TrackSpendController.cls` | Apex backend — all SOQL and DML |
| `classes/TrackSpendControllerTest.cls` | Apex test class |

### Apex Methods
- `getAllSpendings()` — cacheable, returns all `Spending__c` ordered by Name
- `getCategoriesBySpending(spendingId)` — cacheable, filters by spending or returns all
- `getExpensesByFilters(spendingId, categoryId, startDate, endDate)` — cacheable, dynamic SOQL
- `deleteExpense(expenseId)` — non-cacheable, deletes a single `Expense__c`

## Key Patterns

### Reactive Filters
All wire adapters in `trackSpendApp.js` use `$property` bindings. Changing `spendingId`, `categoryId`, `startDate`, or `endDate` automatically re-fetches data. When `spendingId` changes, `categoryId` resets to `'All'`.

### Infinite Scroll
Loads 20 rows initially, adds 10 on each `loadmore` event. All rows are held in `allRows`; `rowsToDisplay` is the visible slice.

### Modal
- Opened via `isOpen` prop; closed by firing a `close` custom event
- `isClosing` flag triggers CSS `fade-out` animation; the `close` event dispatches only after `animationend`
- Implements ESC-to-close, Tab focus trapping, body scroll lock, and focus restoration
- On success: clears fields, fires `success` event, but does **not** auto-close (intentional)

### Date Input Styling
A static resource (`RemoveDateFormatStyle.css`) loaded in `renderedCallback` hides the browser date format hint. The `date-format-hide` class is applied to date inputs in both components.

### Delete Flow
Row action → `LightningConfirm.open()` → `deleteExpense` Apex → `refreshApex(wiredExpenseResult)`

## Testing

Apex tests are in `TrackSpendControllerTest.cls`. Uses `@testSetup` for shared data (2 spendings, 3 categories, 3 expenses). Covers:
- Happy path for all controller methods
- Null ID deletion (expects exception)
- Forced DML failure via `UserInfo.getUserId()` trick in the controller

LWC tests: `lwc/trackSpendExpenseModal/__tests__/trackSpendExpenseModal.test.js`

## Currency
All amounts are in **PHP (Philippine Peso)** — hardcoded in the datatable column `typeAttributes`.
