# Salesforce Experience Cloud & Lightning Components

A collection of production-ready Salesforce Lightning Web Components built for real-world use — including both internal Lightning Experience and external-facing Experience Cloud sites.

---

## Components

| Component | Target | Description |
|---|---|---|
| [`recordSummaryCard`](#recordsummarycard) | Lightning App Builder (internal) | Real-time activity metrics card for any record page — open/completed activities, notes, files, and live duration |
| [`exRecordList`](#exrecordlist) | Experience Builder (external) | Modern website-style record list for Experience Cloud — stat cards, colored status/priority pills, tab filtering, search, and pagination |

---

## recordSummaryCard

A configurable, any-object record summary card for Salesforce Lightning Experience. Displays up to five real-time metrics in a single responsive row on any record page — open activities, completed activities, notes, files, and an optional record duration with a live clock.

<img width="1681" height="705" alt="recordSummaryCard screenshot" src="https://github.com/user-attachments/assets/ca272b6b-1d51-4f97-ac76-3481ab9179a8" />

### Metadata

| Metadata | Type | Description |
|---|---|---|
| `recordSummaryCard` | LightningComponentBundle | The card UI — metrics grid, theming, live duration |
| `RecordSummaryController` | ApexClass | Cacheable Apex — 6 SOQL COUNT queries + dynamic duration field lookup |

### Quick Start

```bash
sf project deploy start \
  --source-dir force-app/main/default/lwc/recordSummaryCard \
  --source-dir force-app/main/default/classes/RecordSummaryController.cls \
  --source-dir force-app/main/default/classes/RecordSummaryController.cls-meta.xml \
  --target-org <your-org-alias> \
  --wait 30
```

Then add **Record Summary** to any record page in **Lightning App Builder**.

**Full reference:** [`force-app/main/default/lwc/recordSummaryCard/README.md`](force-app/main/default/lwc/recordSummaryCard/README.md)

---

## exRecordList

A modern, website-style record list component purpose-built for **Experience Cloud** (community) sites. Designed from the ground up with external audiences in mind — not a repurposed internal Lightning component.

Delivers the clean, data-dense UX seen in modern SaaS dashboards: KPI stat cards, color-coded status pills, tab filtering, debounced search, and paginated rows — all fully configurable from **Experience Builder** without touching code.

### Metadata

| Metadata | Type | Description |
|---|---|---|
| `exRecordList` | LightningComponentBundle | The full list UI — stat cards, tabs, table, pills, pagination |
| `ExRecordListController` | ApexClass | Dynamic SOQL with full field validation, stat aggregation, and pill class resolution |

### Quick Start

```bash
sf project deploy start \
  --source-dir force-app/main/default/lwc/exRecordList \
  --source-dir force-app/main/default/classes/ExRecordListController.cls \
  --source-dir force-app/main/default/classes/ExRecordListController.cls-meta.xml \
  --target-org <your-org-alias> \
  --wait 30
```

Then open **Experience Builder**, drag **Modern Record List** onto any page, and configure the properties panel.

**Full reference:** [`force-app/main/default/lwc/exRecordList/README.md`](force-app/main/default/lwc/exRecordList/README.md)

---

## Repository Structure

```
force-app/main/default/
├── lwc/
│   ├── recordSummaryCard/          # Internal Lightning metrics card
│   │   ├── recordSummaryCard.html
│   │   ├── recordSummaryCard.js
│   │   ├── recordSummaryCard.css
│   │   ├── recordSummaryCard.js-meta.xml
│   │   └── README.md
│   └── exRecordList/               # Experience Cloud modern record list
│       ├── exRecordList.html
│       ├── exRecordList.js
│       ├── exRecordList.css
│       ├── exRecordList.js-meta.xml
│       └── README.md
└── classes/
    ├── RecordSummaryController.cls
    ├── RecordSummaryController.cls-meta.xml
    ├── ExRecordListController.cls
    └── ExRecordListController.cls-meta.xml
```

---

## Requirements

- Salesforce DX project with `force-app` as the default package directory
- Salesforce CLI v2 (`sf`)
- API version 62.0 or later
- For `exRecordList`: an Experience Cloud site (any template)
- For `recordSummaryCard`: any Lightning record, app, or home page

## License

MIT
