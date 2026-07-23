# Testing And Tooling

## Apex Tests

Apex tests live in `SpendlyControllerTest.cls`, `RecurringExpenseTriggerTest.cls`, `SpendlyRecurringExpenseBatchTest.cls`, `SpendlyRecurringExpenseCalculatorTest.cls`, `SpendlyRecurringExpenseServiceTest.cls`, `SpendlyRecurringExpenseSchedulerTest.cls`, and `SpendlySettingsServiceTest.cls`.

The test setup creates:

- 2 expense groups: Food and Transport
- 3 categories: Groceries, Dining, Taxi
- 3 expenses with amounts 100, 200, and 300

Covered behavior includes:

- `getAllExpenseGroups`
- `getCategoriesByExpenseGroup`
- `getExpensesByFilters`
- single expense delete
- bulk expense delete
- monthly trend data
- handled delete failures
- recurring expense trigger defaults for `Next_Run_Date__c`
- recurring expense batch generation for more than the manual run cap
- recurring expense next-run-date calculation for daily, weekly, monthly, and yearly frequencies
- recurring expense generation, catch-up behavior, end dates, inactive records, future records, manual batch start, and null run-date validation
- scheduled recurring expense generation
- Spendly Settings default creation, updates, singleton protection, and recurring run status tracking

## LWC Tests

LWC tests use `@salesforce/sfdx-lwc-jest`.

Current known test location:

- `spendlyExpenseModal/__tests__/spendlyExpenseModal.test.js`

## Tooling

- ESLint with Aura and LWC recommended rules
- Prettier with Apex and XML plugins
- Husky pre-commit hooks
- lint-staged
- Jest ignores `.localdevserver`

## Destructive Deploy

`destructive/destructiveChanges.xml` removes old `TrackSpend`-named components.
Run it before deploying renamed `Spendly` components when cleaning an org:

```bash
sf project deploy start --manifest destructive/package.xml --post-destructive-changes destructive/destructiveChanges.xml --target-org your-org-alias
```

The recurring expense generator uses `Next_Run_Date__c` as its continuation pointer.

## Currency

All amounts are in PHP (Philippine Peso). Currency formatting is hardcoded in
the datatable column `typeAttributes` and in `formattedTotal` via
`Intl.NumberFormat`.
