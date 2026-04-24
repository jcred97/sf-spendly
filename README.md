# Spendly

Spendly is a Salesforce Lightning Web Components (LWC) expense tracking app for managing personal spending in a simple hierarchy:

`Spending__c -> Category__c -> Expense__c`

The app combines a dashboard-style UI with filters, summary cards, charts, a datatable, and a modal form for creating and editing expenses.

## Features

- Manage expenses under spendings and categories
- Filter by spending, category, start date, and end date
- Search across expense name, category, spending, bank, and transaction type
- View dashboard summaries for total spent, average expense, top category, and top bank
- See chart breakdowns by category and bank
- View a monthly trend chart
- Sort the expense table by column
- Use infinite loading in the datatable
- Show or hide table columns with a column picker
- Add, edit, duplicate, and delete expenses from row actions
- Select multiple rows and bulk delete expenses
- Export filtered results to CSV
- Open a print/PDF-friendly report view from the UI
- Use an accessible modal with focus trapping, Escape-to-close, scroll lock, and focus restoration

## Data Model

### Spending__c
- Top-level spending bucket

### Category__c
- Lookup to `Spending__c`
- Groups related expenses under a spending

### Expense__c
- Lookup to `Category__c`
- Main transaction record
- Important fields include:
  - `Amount__c`
  - `Expense_Date__c`
  - `Bank__c`
  - `Transaction_Type__c`
  - `Description__c`

All amounts are formatted as PHP / Philippine Peso in the UI.

## App Experience

The main Spendly page is built around one primary LWC, `spendlyApp`, which provides:

- Top action bar
- Reactive filters
- Summary cards
- Category, bank, and trend charts
- Expense datatable
- Add/Edit/Duplicate modal workflow

Users can narrow the dataset with filters, review high-level metrics, and then act on individual or multiple expenses from the table.

## Architecture

### Apex

`force-app/main/default/classes/SpendlyController.cls`

The controller is responsible for:

- Loading all spendings
- Loading categories by spending
- Loading filtered expenses
- Loading monthly trend aggregates
- Deleting one expense
- Deleting multiple expenses

Notable backend behavior:

- Expense queries support spending, category, and date filters
- Monthly trend data also respects the active spending, category, and date filters
- Single-delete returns a handled message when a record is already missing

### LWC Components

`force-app/main/default/lwc/spendlyApp`
- Main shell for filters, charts, table, export, print, and row actions

`force-app/main/default/lwc/spendlyExpenseModal`
- Modal form for add, edit, and duplicate flows

`force-app/main/default/lwc/spendlySummaryCards`
- Displays top-level metrics

`force-app/main/default/lwc/spendlyBarChart`
- Reusable simple bar chart for grouped totals

`force-app/main/default/lwc/spendlyTrendChart`
- Monthly trend chart

## Current UI Behavior

- Default date range is the current month
- Changing `spendingId` resets `categoryId` to `All`
- Invalid date ranges are blocked with an inline error
- Search is client-side on the currently loaded filtered rows
- Infinite loading shows 20 rows initially and loads 10 more at a time
- Total and summary stats are calculated from the filtered dataset, not just visible rows
- The app uses request versioning in the main data load flow so stale async responses do not overwrite newer filter results

## Project Structure

```text
sf-spendly/
|- AGENTS.md
|- README.md
|- package.json
|- sfdx-project.json
|- eslint.config.js
|- jest.config.js
|- config/
|- destructive/
|- manifest/
`- force-app/main/default/
   |- applications/
   |- classes/
   |- flexipages/
   |- globalValueSets/
   |- layouts/
   |- lwc/
   |- objects/
   |- permissionsets/
   |- staticresources/
   `- tabs/
```

## Local Development

### Requirements

- Salesforce CLI
- Node.js / npm
- A Salesforce org or scratch org for deployment/testing

### Useful Commands

```bash
npm install
npm run lint
npm test
npm run test:unit
npm run test:unit:watch
npm run test:unit:coverage
npm run prettier
npm run prettier:verify
```

### Deploy

Example deployment:

```bash
sf project deploy start --source-dir force-app --target-org your-org-alias
```

### Destructive Deploy

This repo also includes a destructive deployment package for removing older `TrackSpend`-named metadata before deploying the renamed Spendly assets:

```bash
sf project deploy start --manifest destructive/package.xml --post-destructive-changes destructive/destructiveChanges.xml --target-org your-org-alias
```

## Testing

### Apex Tests

`force-app/main/default/classes/SpendlyControllerTest.cls`

The Apex tests cover:

- Spending retrieval
- Category retrieval
- Expense filtering
- Monthly trend aggregation
- Single delete
- Bulk delete
- Null and failure delete cases
- Missing-record delete handling

### LWC Tests

Jest tooling is configured through `@salesforce/sfdx-lwc-jest` in `package.json`.

At the moment, the repo includes Jest configuration and scripts, but no checked-in LWC test files were found in `force-app/main/default/lwc`.

## Tooling

- ESLint for Aura/LWC JavaScript
- Prettier for JS, HTML, XML, Apex, and related files
- Husky for git hooks
- lint-staged for formatting and linting staged files
- `sfdx-lwc-jest` for LWC unit testing

## Metadata Highlights

- App: `Spendly`
- API version: `65.0`
- Permission set: `Spendly_All_Access`
- Static resource: `RemoveDateFormatStyle.css`
- Includes flexipages, tabs, layouts, objects, permission sets, and app metadata

## Notes

- The default README scaffold has been replaced with project-specific documentation
- The app is more feature-rich than a basic CRUD sample and behaves more like a lightweight personal finance dashboard
- Some files in the repo still show historical encoding artifacts when viewed in certain terminals, but the project structure and code organization are clear
