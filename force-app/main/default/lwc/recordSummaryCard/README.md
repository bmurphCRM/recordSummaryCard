# recordSummaryCard — Salesforce Lightning Web Component

A configurable, any-object record summary card for Salesforce Lightning Experience. Displays up to five real-time metrics—open activities, completed activities, notes, files, and an optional record duration—in a single responsive row directly on any record page.

---

## Table of Contents

- [Overview](#overview)
- [Screenshots / Theme Preview](#screenshots--theme-preview)
- [Component Architecture](#component-architecture)
- [Files](#files)
- [App Builder Properties](#app-builder-properties)
- [Metrics Reference](#metrics-reference)
- [Duration Metric](#duration-metric)
- [Theme Reference](#theme-reference)
- [Accessibility](#accessibility)
- [Deployment](#deployment)
- [Object Compatibility](#object-compatibility)
- [Security Model](#security-model)
- [Known Considerations](#known-considerations)

---

## Overview

`recordSummaryCard` drops onto any Lightning record page and shows an admin-configured dashboard of key activity metrics at a glance. No custom objects or custom fields are required for the core four metrics. The optional fifth metric (Duration) activates only when the admin supplies Date/DateTime field API names, making the component safe to place on any object without configuration errors.

**Key capabilities:**

| Capability | Detail |
|---|---|
| Any-object support | Works on Account, Contact, Case, Opportunity, custom objects — any object that supports Tasks, Events, and ContentDocumentLinks |
| Up to 5 metrics | Open activities, completed activities, notes, files, + optional duration |
| 10 color themes | Selected in App Builder from a dropdown — no code changes needed |
| Custom card title | Admin sets a plain-text heading per page placement |
| Live duration clock | Open records tick their hours/minutes counter every 60 seconds |
| Overdue warning | Orange warning badge on the Open Activities tile when overdue tasks exist |
| Tile navigation | Clicking/keyboard-activating a tile navigates to the corresponding related list |
| WCAG 2.1 AA | Full keyboard navigation, ARIA labels, live region announcements, focus-visible rings |

---

## Screenshots / Theme Preview

The card renders all five tiles in a single row at standard Lightning record page widths (≥ 480 px). Below 480 px it collapses gracefully to 3 columns, then 2 columns on the narrowest viewports.


```
<img width="1681" height="705" alt="image" src="https://github.com/user-attachments/assets/54d7dd60-4dce-470a-aab3-c1d35d8cc52d" />


```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⬡ Case Summary                                                    ↺         │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────────┤
│  🔵           │  🟢           │  🔵           │  🟣           │  🟩             │
│  Open         │  Completed   │   Notes      │   Files      │  Duration        │
│   3           │     12       │     5        │     8        │   14d            │
│ Open Activities│ Completed Activities│ Notes │   Files      │  2h 37m  ● OPEN │
├──────────────┴──────────────┴──────────────┴──────────────┴──────────────────┤
│  🕐 Updated 2:34 PM                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
force-app/main/default/
├── lwc/
│   └── recordSummaryCard/
│       ├── recordSummaryCard.html          # Template
│       ├── recordSummaryCard.js            # Controller
│       ├── recordSummaryCard.css           # Theme tokens + structural styles
│       └── recordSummaryCard.js-meta.xml  # App Builder configuration
└── classes/
    ├── RecordSummaryController.cls         # Apex data layer
    └── RecordSummaryController.cls-meta.xml
```

**Data flow:**

```
App Builder properties (@api)
        │
        ▼
  recordSummaryCard.js
  @wire(getRecordMetrics, { recordId, objectApiName, openDateField, closeDateField })
        │
        ▼
  RecordSummaryController.getRecordMetrics()
  ├── COUNT(Task WHERE IsClosed = false)          → openActivities
  ├── COUNT(Task WHERE IsClosed = false AND ActivityDate < today) → overdueActivities
  ├── COUNT(Task WHERE IsClosed = true) +
  │   COUNT(Event WHERE EndDateTime <= now)        → completedActivities
  ├── COUNT(ContentDocumentLink WHERE FileType = 'SNOTE') → notes
  ├── COUNT(ContentDocumentLink WHERE FileType != 'SNOTE') → files
  ├── queryDurationField(openDateField)            → openDate
  └── queryDurationField(closeDateField)           → closeDate
```

---

## Files

### `recordSummaryCard.html`

The component template. All conditional rendering uses `lwc:if` / `lwc:elseif` / `lwc:else`. The duration tile is wrapped in `lwc:if={showDuration}` and is simply absent from the DOM when `openDateField` is not configured or the field returns null — no empty tile, no placeholder.

### `recordSummaryCard.js`

Controller responsibilities:

| Concern | Implementation |
|---|---|
| Data fetch | `@wire(getRecordMetrics)` — reactive, auto-refreshes when any `@api` prop changes |
| Manual refresh | `refreshApex()` triggered by the refresh button |
| Theme resolution | `themeClass` getter — validates against `VALID_THEMES` Set, falls back to `default` |
| Title fallback | `cardTitleDisplay` getter — returns `'Record Summary'` when `cardTitle` is blank |
| Duration math | `_durationMs`, `durationDays`, `durationHours`, `durationMinutes` computed getters |
| Live clock | `setInterval` (60 s) updates `_now` reactively; started/stopped in `_manageTick()` |
| Memory cleanup | `disconnectedCallback` always calls `_stopTick()` to clear the interval |
| Tile navigation | `NavigationMixin` navigates to the related list for the clicked tile |
| Keyboard access | `handleTileKeyDown` — Enter or Space activates tile navigation |

### `recordSummaryCard.css`

The CSS is structured in two layers:

1. **Theme token layer** — `.card-wrapper` defines all CSS custom properties (`--tile-bg`, `--value-color`, `--accent-1-bg`, etc.). Each `.theme-X` class overrides only the tokens that differ from the default.
2. **Structural layer** — all layout, typography, and animation rules consume the custom properties exclusively. No hardcoded colors below the token block.

This means adding a new theme requires only a small token-override block — no duplication of structural rules.

### `recordSummaryCard.js-meta.xml`

Exposes the component on `lightning__RecordPage`, `lightning__AppPage`, and `lightning__HomePage`. The `theme` property uses `datasource` to render a picklist dropdown in App Builder, so admins never need to type a key.

### `RecordSummaryController.cls`

- Declared `with sharing` — respects record-level sharing rules.
- All SOQL uses `WITH SECURITY_ENFORCED` — enforces FLS and CRUD at query time.
- Duration field queries go through `queryDurationField()` which:
  1. Validates the object API name via `Schema.getGlobalDescribe()`
  2. Validates the field exists on the object via `getDescribe().fields.getMap()`
  3. Validates the field type is `DATE` or `DATETIME` — rejects other types with a clean `AuraHandledException`
  4. Uses `String.escapeSingleQuotes()` before building the dynamic SOQL string
  5. Promotes `Date` values to `Datetime` at midnight UTC so JavaScript arithmetic is consistent

---

## App Builder Properties

All properties are set in the Lightning App Builder property panel when the component is added to a record page.

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| **Card Title** | String | No | `Record Summary` | Custom heading shown at the top of the card. Leave blank to use the default. |
| **Color Theme** | Picklist | No | `default` | Visual color scheme. Choose from 10 options (see [Theme Reference](#theme-reference)). |
| **Object API Name** | String | Yes* | — | API name of the object this component is placed on (e.g. `Account`, `Case`). Set to `{!objectApiName}` to auto-populate from the page context. |
| **Open Date Field API Name** | String | No | — | API name of the Date or DateTime field representing when the record was opened (e.g. `CreatedDate`, `Date_Opened__c`). **Leave blank to hide the Duration tile entirely.** |
| **Close Date Field API Name** | String | No | — | API name of the Date or DateTime field representing when the record was closed (e.g. `ClosedDate`, `Date_Closed__c`). Leave blank to calculate duration against the current time (record still open). |

> \* The `objectApiName` property is auto-populated when set to `{!objectApiName}` — the platform substitutes the current page's object API name at runtime. Manual entry is only needed for App Pages or Home Pages.

---

## Metrics Reference

### Tile 1 — Open Activities

- **Source:** `Task` WHERE `WhatId = recordId` AND `IsClosed = false`
- **Overdue badge:** An orange `utility:warning` icon appears in the tile corner when any open task has an `ActivityDate` in the past.
- **Click behavior:** Navigates to the `OpenActivities` related list on the record.

### Tile 2 — Completed Activities

- **Source:** Closed tasks (`Task.IsClosed = true`) + past events (`Event.EndDateTime <= now`), counted separately and summed.
- **Why not `ActivityHistory`?** `ActivityHistory` is a virtual relationship object and does not support direct `COUNT()` SOQL queries. The two-query approach is functionally equivalent and fully supported.
- **Click behavior:** Navigates to the `ActivityHistories` related list.

### Tile 3 — Notes

- **Source:** `ContentDocumentLink` WHERE `LinkedEntityId = recordId` AND `ContentDocument.FileType = 'SNOTE'`
- **What counts:** Salesforce Notes (Enhanced Notes / ContentNote). Legacy Notes (`Note` object) are not counted.
- **Click behavior:** Navigates to the `CombinedAttachments` related list.

### Tile 4 — Files

- **Source:** `ContentDocumentLink` WHERE `LinkedEntityId = recordId` AND `ContentDocument.FileType != 'SNOTE'`
- **What counts:** All files attached to the record that are not Salesforce Notes (PDFs, images, spreadsheets, etc.).
- **Click behavior:** Navigates to the `AttachedContentDocuments` related list.

### Tile 5 — Duration *(optional)*

See [Duration Metric](#duration-metric) below.

---

## Duration Metric

The Duration tile is the only metric that requires admin configuration. It is completely hidden from the DOM (not just invisible) when `openDateField` is not set.

### How it works

1. The admin sets `Open Date Field API Name` in App Builder (e.g. `CreatedDate` for Cases).
2. Apex validates the field exists on the object and is a Date or DateTime type, then queries its value.
3. The JS controller computes elapsed time from `openDate` to `closeDate` (if set) or to `Date.now()` (if the record is still open).
4. For open records, a `setInterval` ticking every 60 seconds keeps the hours/minutes display live without a server round-trip.

### Display format

| State | Days | Sub-line | Badge |
|---|---|---|---|
| Open | `14d` | `2h 37m` | `● OPEN` (pulsing teal dot) |
| Closed | `14d` | `2h 37m` | `CLOSED` (grey, no dot) |

### Configuration examples

| Object | Open Date Field | Close Date Field | Notes |
|---|---|---|---|
| Case | `CreatedDate` | `ClosedDate` | Standard Case fields |
| Opportunity | `CreatedDate` | `CloseDate` | CloseDate is the expected close; won't reflect actual close if left open |
| Work Order | `CreatedDate` | `CompletedDate` | |
| Custom object | `Open_Date__c` | `Close_Date__c` | Any custom Date or DateTime field |
| Any object (age only) | `CreatedDate` | *(leave blank)* | Shows time since record was created, always in "Open" state |

### Edge cases

| Scenario | Behavior |
|---|---|
| `openDateField` not configured | Duration tile hidden entirely |
| `openDateField` configured but field is null on this record | Duration tile hidden |
| `closeDateField` not configured | Duration calculated against `Date.now()` — record treated as open |
| `closeDateField` configured but null | Same as above — record treated as open |
| Field name typo | Apex throws `AuraHandledException`; error state shown on card |
| Field is not Date/DateTime type | Apex throws `AuraHandledException`; error state shown on card |

---

## Theme Reference

The theme is selected in App Builder as a picklist. Unknown or blank values silently fall back to `default`.

| Key | Name | Palette | Best for |
|---|---|---|---|
| `default` | Default | SLDS neutral whites | Any org, general purpose |
| `ocean` | Ocean | Salesforce blue (`#032d60` → `#0176d3`) | Sales, CRM-heavy pages |
| `forest` | Forest | Success green (`#0a3b1a` → `#2e844a`) | Service, resolved/approved records |
| `sunset` | Sunset | Warm amber + red (`#431407` → `#ca8a04`) | Field service, urgent workflows |
| `violet` | Violet | Brand purple (`#3b0764` → `#7e22ce`) | Marketing, campaigns |
| `slate` | Slate | Cool neutral grey (`#0f172a` → `#475569`) | Finance, compliance, legal |
| `midnight` | Midnight | Deep navy + cyan (`#0f1a2e` + `#22d3ee`) | Operations centers, dark-preference users |
| `coral` | Coral | Rose pink (`#4c0519` → `#e11d48`) | Healthcare, customer care |
| `gold` | Gold | Rich amber (`#451a03` → `#b45309`) | Government, enterprise, permits |
| `aurora` | Aurora | Teal-to-indigo (`#042f2e` → `#0d9488`) | Public sector, environmental |

### How themes work technically

All colors are expressed as CSS custom properties defined on `.card-wrapper`. Each `.theme-X` block overrides only the tokens that differ from the default palette. The structural CSS rules (layout, animation, typography sizing) consume those tokens exclusively — no theme has duplicated structural rules.

To add a custom theme beyond the 10 shipped: add a `.theme-yourkey {}` block to `recordSummaryCard.css` overriding the relevant tokens, add the key to `VALID_THEMES` in the JS, and add it to the `datasource` list in the meta.xml.

---

## Accessibility

The component targets **WCAG 2.1 Level AA**.

| Feature | Implementation |
|---|---|
| Keyboard navigation | All metric tiles are `tabindex="0"`; Enter or Space triggers tile navigation |
| ARIA labels | Each tile has a computed `aria-label` with the numeric count and metric name (e.g. `"3 open activities"`). Labels are computed in JS getters — not inline template expressions — to satisfy the LWC compiler's ambiguity rule. |
| Screen reader live region | An `aria-live="polite"` region announces the full metric summary each time data refreshes |
| Loading state | `aria-busy="true"` on the loading container; `alternative-text` on the spinner |
| Error state | `role="alert"` on the error container for immediate screen reader announcement |
| Focus indicator | `:focus-visible` outline in the active theme's focus-ring color — visible without impacting mouse UX |
| Color independence | The overdue warning uses both a color change and a `utility:warning` icon — never color alone |
| Duration ARIA | The duration tile's `aria-label` uses a full spoken sentence: *"Record open for 14 days 2 hours 37 minutes"* |

---

## Deployment

### Prerequisites

- Salesforce DX project with `force-app` package directory
- Authenticated org alias (example uses `vscodeOrg`)
- Salesforce CLI v2 (`sf`)

### Deploy both components

```bash
sf project deploy start \
  --source-dir force-app/main/default/lwc/recordSummaryCard \
  --source-dir force-app/main/default/classes/RecordSummaryController.cls \
  --source-dir force-app/main/default/classes/RecordSummaryController.cls-meta.xml \
  --target-org <your-org-alias> \
  --wait 30
```

### Validate before deploying (dry-run)

```bash
sf project deploy start \
  --dry-run \
  --source-dir force-app/main/default/lwc/recordSummaryCard \
  --source-dir force-app/main/default/classes/RecordSummaryController.cls \
  --source-dir force-app/main/default/classes/RecordSummaryController.cls-meta.xml \
  --target-org <your-org-alias> \
  --wait 30
```

### Add to a record page

1. Open **Lightning App Builder** for the target record page (Setup → Lightning App Builder, or the **Edit Page** button on a record).
2. Find **Record Summary** in the custom components panel.
3. Drag it onto the page layout.
4. Set **Object API Name** to `{!objectApiName}`.
5. Optionally set **Card Title**, **Color Theme**, **Open Date Field API Name**, and **Close Date Field API Name**.
6. **Save** and **Activate**.

---

## Object Compatibility

The core four metrics work on any standard or custom object that supports:
- Tasks (`WhatId` relationship) — most standard objects and custom objects with activities enabled
- Events (`WhatId` relationship) — same as Tasks
- `ContentDocumentLink` — objects with Files enabled in the object settings

Objects where some metrics may not apply:

| Object type | Notes |
|---|---|
| Person Account | Tasks/Events use `WhoId` not `WhatId` — open/completed counts will return 0. Use a Person Account-aware variant. |
| Lead | Tasks/Events use `WhoId` — same consideration as Person Account. |
| Custom objects without activities | Open/completed tiles will show 0 (not an error). Enable activities on the object in Object Manager if needed. |
| Custom objects without Files | Notes/Files tiles will show 0. Enable Files in Object Manager if needed. |

---

## Security Model

| Layer | Mechanism |
|---|---|
| Sharing | `with sharing` — org sharing rules are enforced |
| FLS / CRUD | `WITH SECURITY_ENFORCED` on all SOQL queries |
| Dynamic SOQL injection prevention | `Schema.getGlobalDescribe()` + `fields.getMap()` validate the field name before it is placed in a SOQL string; `String.escapeSingleQuotes()` is applied as an additional guard |
| Field type enforcement | Only `DATE` and `DATETIME` fields are accepted for duration queries — a non-date field API name is rejected with a user-visible error |
| Cacheable Apex | `@AuraEnabled(cacheable=true)` — read-only, no DML possible from this method |

---

## Known Considerations

- **SOQL query count:** The controller issues up to 6 queries per page load (4 fixed + up to 2 for duration fields). This is well within governor limits but worth noting on pages with many components.
- **Date fields and timezone:** `Date` (not `DateTime`) fields are converted to `Datetime` at midnight UTC when returned to the LWC. Duration calculations for Date-type fields will be off by up to 24 hours depending on the user's timezone. Use `DateTime` fields for precise duration tracking.
- **Activities on Person Accounts / Leads:** These objects relate activities via `WhoId` rather than `WhatId`. The component will show 0 open/completed activities for those objects unless the org has activity sharing that populates `WhatId`.
- **ContentDocumentLink visibility:** Files visible in the query results are subject to the running user's access to the `ContentDocument`. Users with access to the record but not to a specific file will see a lower count than the total number of attached files.
- **Live clock interval:** The `setInterval` runs only while the component is mounted and the record has no close date. It is cleared in `disconnectedCallback`. If the component is placed multiple times on a single page it will create one interval per instance.
