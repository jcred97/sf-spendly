# Project Overview - Spendly

Spendly is a Salesforce Lightning Web Components expense tracking app.

Users log expenses under a two-level hierarchy:

```text
Expense Group -> Category -> Expense
```

The main app lets users filter, summarize, visualize, edit, duplicate, delete, export, and print expenses. Expenses store a required date and optional transaction time so same-day activity can be ordered without converting the date field to DateTime.
