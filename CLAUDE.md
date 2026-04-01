# Spendly — CLAUDE.md

## Project Overview

A Salesforce Lightning Web Components (LWC) expense tracking app. Users log expenses under a two-level hierarchy (Spending → Category → Expense) and view/filter them in a datatable.

## Project Structure

```
sf-spendly/
├── CLAUDE.md
├── README.md
├── package.json
├── sfdx-project.json          (API v65.0, name: sf-trackspend-app)
├── jest.config.js
├── eslint.config.js
├── config/
│   └── project-scratch-def.json
├── manifest/
│   └── package.xml
├── destructive/
│   ├── package.xml
│   └── destructiveChanges.xml
└── force-app/main/default/
    ├── applications/
    │   └── Spendly.app-meta.xml
    ├── classes/
    │   ├── SpendlyController.cls
    │   └── SpendlyControllerTest.cls
    ├── contentassets/
    │   └── spendly.asset
    ├── flexipages/
    │   ├── Spendly.flexipage-meta.xml
    │   ├── Spendly_UtilityBar.flexipage-meta.xml
    │   └── Expense_Record_Page.flexipage-meta.xml
    ├── globalValueSets/
    │   └── Bank.globalValueSet-meta.xml
    ├── layouts/
    │   ├── Category__c-Category Layout.layout-meta.xml
    │   ├── Expense__c-Expense Layout.layout-meta.xml
    │   └── Spending__c-Spending Layout.layout-meta.xml
    ├── lwc/
    │   ├── spendlyApp/
    │   └── spendlyExpenseModal/
    ├── objects/
    │   ├── Spending__c/
    │   ├── Category__c/
    │   └── Expense__c/
    ├── permissionsets/
    │   └── Spendly_All_Access.permissionset-meta.xml
    ├── staticresources/
    │   └── RemoveDateFormatStyle.css
    └── tabs/
        ├── Spendly.tab-meta.xml
        ├── Category__c.tab-meta.xml
        ├── Expense__c.tab-meta.xml
        └── Spending__c.tab-meta.xml
```

## Architecture

### Data Model
```
Spending__c
  └── Category__c (Spending__c lookup)
        ├── Display_Name__c
        ├── Total_Amount__c (roll-up, read-only)
        └── Expense__c (Category__c lookup)
              ├── Amount__c
              ├── Expense_Date__c
              ├── Bank__c (global value set: BPI, BDO, MariBank, Metrobank, GCash)
              ├── Transaction_Type__c (picklist)
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
- `getCategoriesBySpending(spendingId)` — cacheable, filters by spending or returns all; selects `Spending__r.Name`
- `getExpensesByFilters(spendingId, categoryId, startDate, endDate)` — cacheable, dynamic SOQL; selects full Category and Spending names; ordered by `Expense_Date__c DESC`
- `deleteExpense(expenseId)` — non-cacheable, null-checks expenseId, deletes a single `Expense__c`, catches `DmlException`

### Custom Application
`Spendly.app-meta.xml` — Blue brand (#0070D2), logo `spendly2`, supports Small + Large form factors. Tabs: Home, Spendly, Expense__c, Reports, Category__c, Spending__c, Dashboard. Has utility bar (`Spendly_UtilityBar`).

### Permission Set
`Spendly_All_Access` — Full CRUD + `viewAllRecords`/`modifyAllRecords` on all 3 objects. All fields read/edit except `Total_Amount__c` (read-only). `SpendlyController` class access enabled.

### Flexipages
- `Spendly` — AppPage, two-column stacked, contains `spendlyApp` component
- `Spendly_UtilityBar` — UtilityBar, left-aligned desktop
- `Expense_Record_Page` — RecordPage for `Expense__c`, overrides the View action

## Key Patterns

### Reactive Filters
All wire adapters in `spendlyApp.js` use `$property` bindings. Changing `spendingId`, `categoryId`, `startDate`, or `endDate` automatically re-fetches data. When `spendingId` changes, `categoryId` resets to `'All'`.

### Date Validation
`validateDates()` checks if `startDate > endDate` and displays an inline error message. Prevents invalid date ranges from being queried.

### Infinite Scroll
Loads 20 rows initially, adds 10 on each `loadmore` event. All rows are held in `allRows`; `rowsToDisplay` is the visible slice. Datatable height is fixed at 500px.

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
- Uses `lightning-record-edit-form` with fields: Name, Amount__c, Category__c, Expense_Date__c, Transaction_Type__c, Bank__c

### Date Input Styling
A static resource (`RemoveDateFormatStyle.css`) loaded in `renderedCallback` hides the browser date format hint. The `date-format-hide` class is applied to date inputs in both components.

### Row Actions
Row action dropdown with Edit and Delete options. Edit opens the modal with `recordId` pre-filled. Delete uses `LightningConfirm.open()` → `deleteExpense` Apex → `refreshApex(wiredExpenseResult)`.

### Datatable Columns
Date, Expense Name (link to record), Category, Spending, Bank, Transaction Type, Amount (PHP currency), Actions.

## Destructive Deploy
`destructive/destructiveChanges.xml` — removes all old `TrackSpend`-named components from the org (TrackSpendController, TrackSpendControllerTest, TrackSpend app, Track_Spend_Page tab/flexipage, Track_Spend_All_Access permission set, trackSpendApp and trackSpendExpenseModal LWC bundles). Run before deploying the renamed `Spendly` components:
```bash
sf project deploy start --manifest destructive/package.xml --post-destructive-changes destructive/destructiveChanges.xml --target-org your-org-alias
```

## Testing

Apex tests are in `SpendlyControllerTest.cls`. Uses `@testSetup` for shared data (2 spendings: Food/Transport, 3 categories: Groceries/Dining/Taxi, 3 expenses with amounts 100/200/300). Covers:
- `testGetAllSpendings` — asserts 2 spendings
- `testGetCategories_All` — asserts 3 categories
- `testGetCategories_BySpending` — asserts Food has 2 categories
- `testGetExpenses_NoFilters` — asserts 3 expenses
- `testGetExpenses_BySpending` — asserts 2 expenses under Food
- `testGetExpenses_ByCategoryAndDate` — asserts 1 expense in date range
- `testDeleteExpense_Success` — asserts deletion
- `testDeleteExpense_NullId` — expects `AuraHandledException`
- `testDeleteExpense_ForcedDmlFailure` — uses `UserInfo.getUserId()` trick to force DML exception

LWC tests: `spendlyExpenseModal/__tests__/spendlyExpenseModal.test.js` (Jest via `@salesforce/sfdx-lwc-jest`).

## Tooling
- ESLint with Aura (recommended + locker) and LWC (recommended) rules
- Prettier with Apex and XML plugins
- Husky pre-commit hooks + lint-staged
- Jest ignores `.localdevserver`

## Currency
All amounts are in **PHP (Philippine Peso)** — hardcoded in the datatable column `typeAttributes` and in `formattedTotal` via `Intl.NumberFormat`.
