# exRecordList — Modern Record List for Experience Cloud

A modern, website-style record list component purpose-built for Salesforce **Experience Cloud** sites. Replaces the repurposed internal Lightning record list with a design paradigm that feels native to external-facing web applications — clean stat cards, color-coded status/priority pills, tab filtering, debounced search, and client-side pagination.

---

## Table of Contents

- [Overview](#overview)
- [Design Inspiration](#design-inspiration)
- [Component Architecture](#component-architecture)
- [Files](#files)
- [Experience Builder Properties](#experience-builder-properties)
- [Stat Cards](#stat-cards)
- [Status & Priority Pills](#status--priority-pills)
- [Tab Filtering](#tab-filtering)
- [Search](#search)
- [Pagination](#pagination)
- [Navigation](#navigation)
- [Color Themes](#color-themes)
- [Accessibility](#accessibility)
- [Security Model](#security-model)
- [Deployment](#deployment)
- [Object Compatibility](#object-compatibility)
- [Known Considerations](#known-considerations)

---

## Overview

`exRecordList` drops onto any Experience Cloud page and renders a fully configured record list for any standard or custom Salesforce object. No custom objects or schema changes are required — the component works directly against standard fields.

**Key capabilities:**

| Capability | Detail |
|---|---|
| Any-object support | Cases, applications, payments, work orders, custom objects — any object accessible to the running user |
| Dynamic columns | Admin specifies field API names as a comma-separated list; columns render automatically |
| Colored pills | Status and Priority fields render as colored pill badges — 7 color variants, auto-mapped from field values |
| Stat cards | KPI cards at the top summarize record counts by `filterField` value with sparkline graphics |
| Tab filtering | Tabs auto-generated from the same field as the stat cards; clicking a tab or card filters the list |
| Debounced search | Search box with 350 ms debounce filters by record name |
| Pagination | Server-side pagination with a sliding page number window |
| Light + dark theme | Two built-in color modes wired to DXP design tokens |
| Experience Builder | All options configurable via drag-and-drop property panel — no code changes needed |
| Guest-safe | Uses `with sharing` and `WITH SECURITY_ENFORCED`; works for authenticated Experience Cloud users |
| Accessible | WCAG 2.1 AA — keyboard navigation, ARIA labels, live region announcements |

---

## Design Inspiration

The component is designed to match the aesthetic of modern SaaS order/case management dashboards:

```
┌──────────────────────────────────────────────────────────────────┐
│  Cases                                               + New Case   │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ All Cases  │  │  New       │  │  In Progress│  │  Closed   │ │
│  │  1,046     │  │  159       │  │  624        │  │  263      │ │
│  │    ~~~~    │  │   ~~~~     │  │   ~~~~      │  │   ~~~~    │ │
│  └────────────┘  └────────────┘  └─────────────┘  └───────────┘ │
├──────────────────────────────────────────────────────────────────┤
│  All  New  In Progress  Closed                      🔍 Search... │
├────────────┬──────────────────┬──────────────┬───────────────────┤
│  Case #    │  Subject         │  Status      │  Priority         │
├────────────┼──────────────────┼──────────────┼───────────────────┤
│  00001234  │  Login issue     │  ● New       │  ● High           │
│  00001233  │  Billing error   │  ● Closed    │  ● Normal         │
│  00001232  │  Access request  │  ● In Progress│  ● Low           │
└────────────┴──────────────────┴──────────────┴───────────────────┘
                                         Showing 1–10 of 47  ← 1 2 3 →
```

---

## Component Architecture

```
force-app/main/default/
├── lwc/
│   └── exRecordList/
│       ├── exRecordList.html           # Template
│       ├── exRecordList.js             # Controller
│       ├── exRecordList.css            # DXP tokens + structural styles
│       ├── exRecordList.js-meta.xml    # Experience Builder configuration
│       └── README.md
└── classes/
    ├── ExRecordListController.cls
    └── ExRecordListController.cls-meta.xml
```

**Data flow:**

```
Experience Builder properties (@api)
          │
          ▼
   exRecordList.js
   @wire(getRecords, { objectApiName, displayFields, statusField,
                       priorityField, filterField, filterValue,
                       searchTerm, nameField, pageSize, pageOffset })
          │
          ▼
   ExRecordListController.getRecords()
   ├── Validates objectApiName via Schema.getGlobalDescribe()
   ├── Validates each field name against fields.getMap()
   ├── Builds safe SOQL (no user-controlled string concatenation)
   ├── Runs COUNT() for totalCount (pagination)
   ├── Runs SELECT for row data (LIMIT / OFFSET)
   ├── Resolves pill CSS class for status and priority values
   └── Runs GROUP BY aggregate for stat card counts
          │
          ▼
   { rows[], stats[], totalCount }
```

---

## Files

### `exRecordList.html`

The component template is divided into four visual regions:

| Region | Description |
|---|---|
| **Page header** | Title, optional subtitle, optional Create button |
| **Stat cards** | KPI row with sparkline SVGs — hidden when no `filterField` is configured |
| **Toolbar** | Tab bar (auto-generated from stat data) + search input |
| **Table / states** | Skeleton loader → error state → empty state → data table + pagination footer |

All conditional rendering uses `lwc:if` / `lwc:elseif` / `lwc:else`. The skeleton loader shows 5 shimmer rows during the initial wire fetch.

### `exRecordList.js`

Controller responsibilities:

| Concern | Implementation |
|---|---|
| Data fetch | `@wire(getRecords)` — reactive, re-executes when any `@api` prop or internal filter changes |
| Tab / stat filtering | `_activeFilter` tracked property; stat card and tab clicks update it, resetting to page 1 |
| Search | Debounced 350 ms via `setTimeout`; clears on Escape key |
| Sorting | Client-side sort state (`_sortField`, `_sortAsc`); server always returns by `LastModifiedDate DESC` |
| Pagination | `_page` and `_pageOffset` drive `LIMIT`/`OFFSET` in the wire params |
| Row selection | `_selectedIds` Set; supports select-all and individual toggles |
| Navigation | `NavigationMixin` — navigates to named Experience Cloud page (if `recordPageName` is set) or falls back to standard record page |
| Relative timestamps | `_relativeTime()` — converts `LastModifiedDate` to "Just now", "2h ago", "Yesterday", etc. |
| Live announcement | `aria-live` region updated on filter change and data load |
| Field label | `_fieldLabel()` — converts API names (`MyField__c` → `My Field`) for column headers |

### `exRecordList.css`

The CSS is structured in three layers:

1. **DXP token layer** — `.erl-wrapper` defines all custom properties consuming `--dxp-*` tokens with SLDS and literal fallbacks. Guaranteed to render correctly in Experience Cloud, internal Lightning, and degraded environments.
2. **Dark mode override** — `.erl-wrapper--dark` redefines only the surface and text tokens. No structural rules are duplicated.
3. **Structural layer** — all layout, typography, animation, and component rules consume the custom properties exclusively. No hardcoded brand colors below the token block.

### `exRecordList.js-meta.xml`

Exposes the component on `lightningCommunity__Page` and `lightningCommunity__Default`. All configurable properties are surfaced as Experience Builder property panel inputs with labels, descriptions, and sensible defaults. The `theme` property uses `datasource` to render a picklist.

### `ExRecordListController.cls`

- Declared `with sharing` — enforces record-level sharing rules.
- All SOQL uses `WITH SECURITY_ENFORCED` — enforces FLS and CRUD at query time.
- All field and object names are validated against `Schema.getGlobalDescribe()` before being used in any dynamic SOQL string.
- `String.escapeSingleQuotes()` is applied on all dynamic string values.
- The pill class (`pill--green`, `pill--red`, etc.) is resolved server-side from a `Map<String, String>` keyed on lowercase field values — no client-supplied class names reach the DOM.

---

## Experience Builder Properties

All properties are set in the Experience Builder property panel when the component is added to a page.

### Core Data

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| **Object API Name** | String | Yes | — | Salesforce object to query (e.g. `Case`, `Application__c`, `Payment__c`) |
| **Display Fields** | String | Yes | `Name,Status` | Comma-separated field API names for table columns, e.g. `CaseNumber,Subject,Status,Priority` |
| **Name / Title Field** | String | No | `Name` | Field rendered as the clickable record link in the first column |
| **Status Field API Name** | String | No | `Status` | Field whose values receive colored status pills |
| **Priority Field API Name** | String | No | *(blank)* | Field whose values receive colored priority pills. Leave blank to hide. |
| **Filter / Tab Field** | String | No | `Status` | Field used to build stat cards and filter tabs |

### Display

| Property | Type | Default | Description |
|---|---|---|---|
| **List Title** | String | `Records` | Page-level heading |
| **Subtitle** | String | *(blank)* | Optional descriptive text below the title |
| **Color Theme** | Picklist | `light` | `light` or `dark` |
| **Show Search Bar** | Boolean | `false` | Renders the search input in the toolbar |
| **Show Row Checkboxes** | Boolean | `false` | Renders a checkbox column for row selection |
| **Rows per Page** | Integer | `10` | Page size — min 5, max 100 |

### Create Button

| Property | Type | Default | Description |
|---|---|---|---|
| **Show Create Button** | Boolean | `false` | Renders a primary action button in the header |
| **Create Button Label** | String | `New Record` | Button label text |

### Navigation

| Property | Type | Default | Description |
|---|---|---|---|
| **Record Detail Page Name** | String | *(blank)* | Experience Cloud named page to navigate to on row click. Leave blank to use the standard Salesforce record page. |

---

## Stat Cards

Stat cards are automatically built from the `filterField` property. The controller runs a `GROUP BY` aggregate query and returns up to 6 value-level counts plus an "All Records" total.

Each card displays:
- A **label** (the field value, e.g. "New", "Closed", "Fulfilled")
- A **count** of matching records
- A **sparkline** SVG in one of four accent colors (blue, orange, purple, green)

Clicking a stat card sets the active filter to that value, which simultaneously highlights the matching tab and reloads the table.

The stat card row is hidden entirely when `filterField` is blank or when the aggregate returns no data.

---

## Status & Priority Pills

Pills are colored badges rendered inline within table cells for the `statusField` and `priorityField` columns. The pill color class is resolved **server-side** from a static value map — the client receives only a CSS class name, never a user-controlled string.

### Built-in value mappings

| Pill Color | Status values (case-insensitive) | Priority values |
|---|---|---|
| `pill--green` | Closed, Resolved, Completed, Fulfilled, Approved, Paid | Low |
| `pill--blue` | New, Open | Normal, Medium |
| `pill--indigo` | Working, In Progress | — |
| `pill--orange` | Pending, Waiting, On Hold, Unfulfilled, Authorized | High |
| `pill--purple` | Pending Receipt | — |
| `pill--red` | Escalated, Rejected, Cancelled, Denied | Critical, Urgent |
| `pill--grey` | Draft, Inactive, *(any unmapped value)* | *(any unmapped value)* |

Values are matched case-insensitively. Any value not in the map gets `pill--grey` as a safe fallback.

### Dark mode pill adjustments

All 7 pill variants have dedicated dark-mode overrides in the CSS that maintain WCAG AA contrast ratios on dark surfaces.

---

## Tab Filtering

Tabs are auto-generated from the same aggregate data that populates the stat cards. If `filterField` is `Status` and the object has records with `New`, `In Progress`, and `Closed` statuses, those three tabs plus an "All" tab are rendered automatically.

- Tabs and stat cards stay in sync — clicking either updates the other
- The active tab shows a brand-color underline (consumes `--dxp-s-brand-1`)
- On narrow viewports the tab bar scrolls horizontally without a visible scrollbar

---

## Search

The search input filters records by the `Name` field (or the field identified as `nameField`). A 350 ms debounce prevents excessive wire re-executions while the user is typing.

- Press **Escape** to clear the search term instantly
- Search resets to page 1 automatically
- Minimum 2 characters before the server query fires (enforced in Apex)

---

## Pagination

Pagination is fully server-side using `LIMIT` and `OFFSET`.

- A sliding window of page number buttons is shown (current page ± 2)
- Prev / Next arrow buttons are disabled at the first and last pages
- A record range label shows `1–10 of 47` style counts
- Changing the active filter or search term automatically resets to page 1

---

## Navigation

When a row or record name link is clicked, the component navigates using `NavigationMixin`:

| `recordPageName` configured? | Navigation target |
|---|---|
| Yes | `comm__namedPage` — navigates to the named Experience Cloud page with `?recordId=<id>` in the state |
| No | `standard__recordPage` — navigates to the standard Salesforce record view page |

The Create button always navigates to the standard `standard__objectPage` new record action.

---

## Color Themes

Two top-level themes are available. Both fully consume DXP design tokens so the component respects the site's brand colors automatically.

| Theme | `theme` value | Description |
|---|---|---|
| Light | `light` | White panel on light grey background — appropriate for most public-facing sites |
| Dark | `dark` | Deep navy surfaces — appropriate for dark-branded sites or dashboard pages |

**Token fallback chain for every color declaration:**

```css
color: var(--dxp-s-brand-1, var(--slds-g-color-accent-1, #2563eb));
```

This ensures the component renders correctly in Experience Cloud (DXP tokens), internal Lightning (SLDS hooks), and degraded/preview environments (literal fallback).

---

## Accessibility

The component targets **WCAG 2.1 Level AA**.

| Feature | Implementation |
|---|---|
| Keyboard navigation | Stat cards are `tabindex="0"` with Enter/Space handlers; table rows support Enter to navigate; all interactive elements reachable via Tab |
| ARIA labels | Stat cards use computed `aria-label` with count and label; table has `aria-rowcount`; pagination buttons have `aria-label`; columns have `aria-sort` |
| Screen reader live region | `aria-live="polite"` region announces count changes on filter/search updates |
| Loading state | Skeleton loader shown during wire fetch; no spinner-only loading that hides content |
| Error state | `role="alert"` on error container for immediate announcement |
| Empty state | Clear "No records found" message with a "Clear filters" action when a filter is active |
| Focus indicator | `:focus-visible` outline using the brand token; no impact on mouse UX |
| Semantic HTML | `<table>` with `<thead>` / `<tbody>`, `scope="col"` on headers, `<nav>` for pagination |
| Color independence | Pills use both color and text label — never color alone |
| Search | `role="search"` landmark on the search container |

---

## Security Model

| Layer | Mechanism |
|---|---|
| Sharing | `with sharing` — record-level sharing rules enforced |
| FLS / CRUD | `WITH SECURITY_ENFORCED` on all SOQL |
| Field validation | All field names validated against `Schema.getGlobalDescribe().get(objectApiName).getDescribe().fields.getMap()` before use in dynamic SOQL |
| SOQL injection prevention | `String.escapeSingleQuotes()` on all dynamic string values; field/object names go through schema validation first, never raw user input |
| Pill class resolution | CSS class names resolved entirely server-side from a static `Map<String, String>` — no client-supplied values reach CSS class attributes |
| Cacheable Apex | `@AuraEnabled(cacheable=true)` — read-only; no DML possible from this method |
| Page size cap | `pageSize` capped at 200 in Apex regardless of what the client sends |

---

## Deployment

### Prerequisites

- Salesforce DX project (`sfdx-project.json` present)
- Salesforce CLI v2 (`sf`)
- Authenticated org alias
- An Experience Cloud site on the target org (any template)

### Deploy

```bash
sf project deploy start \
  --source-dir force-app/main/default/lwc/exRecordList \
  --source-dir force-app/main/default/classes/ExRecordListController.cls \
  --source-dir force-app/main/default/classes/ExRecordListController.cls-meta.xml \
  --target-org <your-org-alias> \
  --wait 30
```

### Validate before deploying (dry-run)

```bash
sf project deploy start \
  --dry-run \
  --source-dir force-app/main/default/lwc/exRecordList \
  --source-dir force-app/main/default/classes/ExRecordListController.cls \
  --source-dir force-app/main/default/classes/ExRecordListController.cls-meta.xml \
  --target-org <your-org-alias> \
  --wait 30
```

### Add to an Experience Cloud page

1. Open **Experience Builder** for your site.
2. Navigate to the page where the list should appear.
3. In the **Components** panel, find **Modern Record List**.
4. Drag it onto the page canvas.
5. In the property panel on the right, configure:
   - **Object API Name** — e.g. `Case`
   - **Display Fields** — e.g. `CaseNumber,Subject,Status,Priority`
   - **Status Field API Name** — e.g. `Status`
   - **Priority Field API Name** — e.g. `Priority` (optional)
   - **Filter / Tab Field** — e.g. `Status`
   - **List Title** — e.g. `My Cases`
6. Click **Publish**.

### Example configurations

**Case list for a customer portal:**

| Property | Value |
|---|---|
| Object API Name | `Case` |
| Display Fields | `CaseNumber,Subject,Status,Priority` |
| Name / Title Field | `CaseNumber` |
| Status Field API Name | `Status` |
| Priority Field API Name | `Priority` |
| Filter / Tab Field | `Status` |
| List Title | `My Cases` |
| Show Search Bar | ✓ |
| Show Create Button | ✓ |
| Create Button Label | `Open New Case` |

**Payment list for a financial portal:**

| Property | Value |
|---|---|
| Object API Name | `Payment__c` |
| Display Fields | `Name,Amount__c,Due_Date__c,Status__c` |
| Status Field API Name | `Status__c` |
| Filter / Tab Field | `Status__c` |
| List Title | `Payment History` |
| Rows per Page | `20` |

**Permit/application list for a government portal:**

| Property | Value |
|---|---|
| Object API Name | `IndividualApplication__c` |
| Display Fields | `Name,Application_Type__c,Status__c,Priority__c,Submitted_Date__c` |
| Status Field API Name | `Status__c` |
| Priority Field API Name | `Priority__c` |
| Filter / Tab Field | `Status__c` |
| List Title | `My Applications` |
| Theme | `light` |
| Record Detail Page Name | `application-detail` |

---

## Object Compatibility

The component works against any standard or custom object accessible to the running user. No special object features are required beyond basic read access.

| Object type | Notes |
|---|---|
| Standard objects (Case, Contact, etc.) | Fully supported |
| Custom objects | Fully supported — use the `__c` suffix for field and object names |
| Objects without a `Name` field | Set `nameField` to a different text field (e.g. `CaseNumber` for Case) |
| Objects with restricted FLS | Fields the running user cannot read are silently excluded by `WITH SECURITY_ENFORCED` |
| Guest user access | Works for authenticated Experience Cloud users; guest user access requires that the object and fields are exposed via guest user sharing/profiles |

---

## Known Considerations

- **SOQL queries per page load:** The controller issues 3 queries per request — a `COUNT()` for pagination, a `SELECT` for row data, and a `GROUP BY` aggregate for stat cards. Well within governor limits.
- **Search scope:** Search currently filters on the `Name` field only (or the field set as `nameField`). It does not perform a full-text search across all displayed fields.
- **Sort order:** The server always returns records ordered by `LastModifiedDate DESC`. The client-side sort state (`_sortField`) is tracked in the JS for future use but does not currently re-sort server results.
- **Stat card count:** Up to 6 distinct `filterField` values are returned by the aggregate query. Objects with more than 6 distinct values will show only the top 6 by record count plus the "All" total.
- **`OFFSET` governor limit:** Salesforce SOQL does not permit `OFFSET` greater than 2,000. At 10 rows per page this is page 200; at 20 rows per page this is page 100. For very large datasets consider adding a date or ID-based range filter rather than deep pagination.
- **Guest users:** Guest user access requires that the queried object is accessible via the guest user profile and that the Apex class is granted access via the Experience Cloud site's guest user profile. The component does not handle unauthenticated access automatically.
