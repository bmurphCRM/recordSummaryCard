# recordSummaryCard — Salesforce LWC

A configurable, any-object record summary card for Salesforce Lightning Experience. Displays up to five real-time metrics in a single responsive row on any record page — open activities, completed activities, notes, files, and an optional record duration with a live clock.

## Components

| Metadata | Type | Description |
|---|---|---|
| `recordSummaryCard` | LightningComponentBundle | The card UI — metrics grid, theming, live duration |
| `RecordSummaryController` | ApexClass | Cacheable Apex data layer — 6 SOQL COUNT queries + dynamic duration field lookup |

## Quick Start

```bash
sf project deploy start \
  --source-dir force-app/main/default/lwc/recordSummaryCard \
  --source-dir force-app/main/default/classes/RecordSummaryController.cls \
  --source-dir force-app/main/default/classes/RecordSummaryController.cls-meta.xml \
  --target-org <your-org-alias> \
  --wait 30
```

Then add **Record Summary** to any record page in Lightning App Builder.

## Full Documentation

See [`force-app/main/default/lwc/recordSummaryCard/README.md`](force-app/main/default/lwc/recordSummaryCard/README.md) for the complete reference:
- All App Builder properties
- Metrics data sources
- Duration tile configuration + examples
- 10 color themes
- Accessibility notes
- Security model
- Known considerations
