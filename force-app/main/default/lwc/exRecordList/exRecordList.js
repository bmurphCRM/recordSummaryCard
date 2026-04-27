import { LightningElement, api, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getRecords from '@salesforce/apex/ExRecordListController.getRecords';

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;
const SPARKLINE_POINTS = [
    '0,25 10,18 20,22 30,10 40,15 50,8 60,12 70,5 80,10',
    '0,20 10,25 20,15 30,20 40,10 50,18 60,8 70,14 80,6',
    '0,28 10,20 20,25 30,12 40,18 50,14 60,20 70,10 80,16',
    '0,15 10,22 20,10 30,18 40,8 50,20 60,12 70,24 80,14',
];
const SPARKLINE_FILLS = [
    '0,25 10,18 20,22 30,10 40,15 50,8 60,12 70,5 80,10 80,30 0,30',
    '0,20 10,25 20,15 30,20 40,10 50,18 60,8 70,14 80,6 80,30 0,30',
    '0,28 10,20 20,25 30,12 40,18 50,14 60,20 70,10 80,16 80,30 0,30',
    '0,15 10,22 20,10 30,18 40,8 50,20 60,12 70,24 80,14 80,30 0,30',
];

const STAT_ACCENT_CLASSES = ['erl-stat--blue', 'erl-stat--orange', 'erl-stat--purple', 'erl-stat--green'];

export default class ExRecordList extends NavigationMixin(LightningElement) {
    // ── App Builder properties ──────────────────────────────────────────────
    @api listTitle       = 'Records';
    @api subtitle        = '';
    @api objectApiName   = '';
    @api displayFields   = '';          // comma-separated field API names
    @api statusField     = 'Status';
    @api priorityField   = '';
    @api filterField     = 'Status';    // field for tab + stat-card grouping
    @api nameField       = 'Name';      // field rendered as the clickable record name
    @api pageSize        = DEFAULT_PAGE_SIZE;
    @api showSearch      = false;
    @api showCheckboxes  = false;
    @api showCreateButton = false;
    @api createButtonLabel = 'New Record';
    @api theme           = 'light';     // 'light' | 'dark'
    @api recordPageName  = '';          // Experience Cloud named page for record detail

    // ── Internal reactive state ─────────────────────────────────────────────
    @track _activeFilter = 'all';
    @track _searchTerm   = '';
    @track _page         = 1;
    @track _sortField    = '';
    @track _sortAsc      = true;
    @track _selectedIds  = new Set();

    _searchTimer;
    _wiredData;
    isLoading = false;
    errorMessage;
    liveAnnouncement = '';

    // ── Wired data ──────────────────────────────────────────────────────────

    @wire(getRecords, {
        objectApiName: '$objectApiName',
        displayFields: '$displayFields',
        statusField:   '$statusField',
        priorityField: '$priorityField',
        filterField:   '$filterField',
        filterValue:   '$_activeFilter',
        searchTerm:    '$_searchTerm',
        nameField:     '$nameField',
        pageSize:      '$_pageSize',
        pageOffset:    '$_pageOffset'
    })
    wiredRecords(result) {
        this._wiredData = result;
        this.isLoading = false;
        if (result.data) {
            this.errorMessage = undefined;
            this._announce(`${result.data.totalCount} records loaded`);
        } else if (result.error) {
            this.errorMessage = result.error?.body?.message ?? 'Unable to load records.';
        }
    }

    // ── Derived getters ─────────────────────────────────────────────────────

    get _data() {
        return this._wiredData?.data;
    }

    get _pageSize() {
        const s = parseInt(this.pageSize, 10);
        return (s > 0 && s <= 200) ? s : DEFAULT_PAGE_SIZE;
    }

    get _pageOffset() {
        return (this._page - 1) * this._pageSize;
    }

    get totalCount() {
        return this._data?.totalCount ?? 0;
    }

    get hasError() {
        return !!this.errorMessage;
    }

    get isEmpty() {
        return !this.isLoading && !this.hasError && (this._data?.rows?.length ?? 0) === 0;
    }

    get hasActiveFilter() {
        return this._activeFilter !== 'all' || this._searchTerm !== '';
    }

    get wrapperClass() {
        return `erl-wrapper${this.theme === 'dark' ? ' erl-wrapper--dark' : ''}`;
    }

    get showSubtitle() {
        return !!this.subtitle?.trim();
    }

    get searchTerm() {
        return this._searchTerm;
    }

    get searchPlaceholder() {
        return `Search ${this.listTitle.toLowerCase()}...`;
    }

    get skeletonRows() {
        return [1, 2, 3, 4, 5];
    }

    // ── Stat cards ──────────────────────────────────────────────────────────

    get hasStats() {
        return (this._data?.stats?.length ?? 0) > 0;
    }

    get displayStats() {
        return (this._data?.stats ?? []).map((s, idx) => {
            const accent = STAT_ACCENT_CLASSES[idx % STAT_ACCENT_CLASSES.length];
            const isActive = s.filterValue === this._activeFilter;
            return {
                ...s,
                cardClass: `erl-stat ${accent}${isActive ? ' erl-stat--active' : ''}`,
                ariaLabel: `${s.label}: ${s.count} records`,
                sparkPoints: SPARKLINE_POINTS[idx % SPARKLINE_POINTS.length],
                sparkFill:   SPARKLINE_FILLS[idx % SPARKLINE_FILLS.length],
            };
        });
    }

    // ── Tab bar ─────────────────────────────────────────────────────────────

    get tabs() {
        const stats = this._data?.stats ?? [];
        if (stats.length === 0) {
            return [{ label: 'All', value: 'all', isActive: true, tabClass: 'erl-tab erl-tab--active' }];
        }
        return stats.map(s => {
            const isActive = s.filterValue === this._activeFilter;
            return {
                label: s.label,
                value: s.filterValue,
                isActive,
                tabClass: `erl-tab${isActive ? ' erl-tab--active' : ''}`,
            };
        });
    }

    // ── Table columns ────────────────────────────────────────────────────────

    get columnHeaders() {
        const fields = this._parseFields();
        const nameKey = this.nameField || 'Name';
        const cols = [
            { key: nameKey, label: this._fieldLabel(nameKey), isNameCol: true }
        ];
        for (const f of fields) {
            if (f.toLowerCase() === (this.nameField || 'Name').toLowerCase()) continue;
            const isSorted = this._sortField === f;
            cols.push({
                key: f,
                label: this._fieldLabel(f),
                thClass: 'erl-table__th',
                isSorted,
                ariaSort: isSorted ? (this._sortAsc ? 'ascending' : 'descending') : 'none',
                sortIcon: isSorted ? (this._sortAsc ? '↑' : '↓') : '',
            });
        }
        // Updated column
        cols.push({
            key: '_lastModified',
            label: 'Updated',
            thClass: 'erl-table__th erl-table__th--date',
            isSorted: this._sortField === '_lastModified',
            ariaSort: this._sortField === '_lastModified' ? (this._sortAsc ? 'ascending' : 'descending') : 'none',
            sortIcon: this._sortField === '_lastModified' ? (this._sortAsc ? '↑' : '↓') : '',
        });
        return cols;
    }

    // ── Row data ─────────────────────────────────────────────────────────────

    get rows() {
        const rawRows = this._data?.rows ?? [];
        const fields = this._parseFields();
        const statusFieldLow   = this.statusField?.toLowerCase();
        const priorityFieldLow = this.priorityField?.toLowerCase();

        return rawRows.map(r => {
            const isSelected = this._selectedIds.has(r.recordId);
            const nameFieldLow = (this.nameField || 'Name').toLowerCase();
            const fieldCells = fields
                .filter(f => f.toLowerCase() !== nameFieldLow)
                .map(f => {
                    const fLow = f.toLowerCase();
                    const value = r.fields?.[f] ?? '';
                    const isStatus   = fLow === statusFieldLow;
                    const isPriority = fLow === priorityFieldLow;
                    const isPill = isStatus || isPriority;
                    let pillClass = 'erl-pill';
                    if (isStatus)   pillClass += ` ${r.statusPillClass ?? 'pill--grey'}`;
                    if (isPriority) pillClass += ` ${r.priorityPillClass ?? 'pill--grey'}`;
                    return { key: f, value, isPill, pillClass };
                });

            return {
                recordId: r.recordId,
                name: r.name,
                fieldCells,
                lastModifiedLabel: this._relativeTime(r.lastModifiedMs),
                isSelected,
                rowClass: `erl-table__row${isSelected ? ' erl-table__row--selected' : ''}`,
                ariaLabel: `Record: ${r.name}`,
                nameLinkAria: `View ${r.name}`,
                checkboxAriaLabel: `Select ${r.name}`,
            };
        });
    }

    // ── Pagination ───────────────────────────────────────────────────────────

    get totalPages() {
        return Math.max(1, Math.ceil(this.totalCount / this._pageSize));
    }

    get isPrevDisabled() {
        return this._page <= 1;
    }

    get isNextDisabled() {
        return this._page >= this.totalPages;
    }

    get paginationLabel() {
        const start = this._pageOffset + 1;
        const end   = Math.min(this._pageOffset + this._pageSize, this.totalCount);
        return `${start}–${end} of ${this.totalCount}`;
    }

    get pageNumbers() {
        const total = this.totalPages;
        const cur   = this._page;
        const nums  = [];
        const window = 2;
        for (let i = Math.max(1, cur - window); i <= Math.min(total, cur + window); i++) {
            nums.push({
                num: i,
                isCurrent: i === cur,
                btnClass: `erl-pagination__btn${i === cur ? ' erl-pagination__btn--active' : ''}`,
                ariaLabel: `Page ${i}`,
            });
        }
        return nums;
    }

    get allSelected() {
        const rowIds = (this._data?.rows ?? []).map(r => r.recordId);
        return rowIds.length > 0 && rowIds.every(id => this._selectedIds.has(id));
    }

    get tableAriaLabel() {
        return `${this.listTitle} — ${this.totalCount} records`;
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    handleStatCardClick(event) {
        const filter = event.currentTarget.dataset.filter;
        this._setFilter(filter);
    }

    handleStatKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this._setFilter(event.currentTarget.dataset.filter);
        }
    }

    handleTabClick(event) {
        this._setFilter(event.currentTarget.dataset.value);
    }

    handleSearchInput(event) {
        const val = event.target.value;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
            this._searchTerm = val;
            this._page = 1;
        }, SEARCH_DEBOUNCE_MS);
    }

    handleSearchKeyDown(event) {
        if (event.key === 'Escape') {
            this._searchTerm = '';
            event.target.value = '';
        }
    }

    handleSort(event) {
        const field = event.currentTarget.dataset.field;
        if (field === '_lastModified') return; // server always sorts by LastModifiedDate
        if (this._sortField === field) {
            this._sortAsc = !this._sortAsc;
        } else {
            this._sortField = field;
            this._sortAsc = true;
        }
    }

    handleSelectAll(event) {
        const checked = event.target.checked;
        const ids = new Set(this._selectedIds);
        (this._data?.rows ?? []).forEach(r => {
            checked ? ids.add(r.recordId) : ids.delete(r.recordId);
        });
        this._selectedIds = ids;
    }

    handleRowSelect(event) {
        event.stopPropagation();
        const id = event.target.dataset.id;
        const ids = new Set(this._selectedIds);
        event.target.checked ? ids.add(id) : ids.delete(id);
        this._selectedIds = ids;
    }

    handleCheckboxClick(event) {
        event.stopPropagation();
    }

    handleRowClick(event) {
        const id = event.currentTarget.dataset.id;
        if (id) this._navigateToRecord(id);
    }

    handleRowKeyDown(event) {
        if (event.key === 'Enter') {
            const id = event.currentTarget.dataset.id;
            if (id) this._navigateToRecord(id);
        }
    }

    handleNameClick(event) {
        event.stopPropagation();
        const id = event.currentTarget.dataset.id;
        if (id) this._navigateToRecord(id);
    }

    handleCreate() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: { objectApiName: this.objectApiName, actionName: 'new' }
        });
    }

    handleRefresh() {
        this.isLoading = true;
        this.errorMessage = undefined;
        // Force wire re-evaluation by toggling page
        const p = this._page;
        this._page = 0;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this._page = p; }, 0);
    }

    handleClearFilter() {
        this._activeFilter = 'all';
        this._searchTerm   = '';
        this._page = 1;
    }

    handlePrevPage() {
        if (this._page > 1) this._page--;
    }

    handleNextPage() {
        if (this._page < this.totalPages) this._page++;
    }

    handlePageClick(event) {
        this._page = parseInt(event.currentTarget.dataset.page, 10);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    _setFilter(value) {
        this._activeFilter = value;
        this._page = 1;
        this._announce(`Showing ${value === 'all' ? 'all records' : value + ' records'}`);
    }

    _navigateToRecord(recordId) {
        if (this.recordPageName) {
            this[NavigationMixin.Navigate]({
                type: 'comm__namedPage',
                attributes: { name: this.recordPageName },
                state: { recordId }
            });
        } else {
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: { recordId, actionName: 'view' }
            });
        }
    }

    _parseFields() {
        if (!this.displayFields) return [];
        return this.displayFields.split(',').map(f => f.trim()).filter(Boolean);
    }

    _fieldLabel(apiName) {
        if (!apiName) return '';
        // Convert CamelCase / underscores to readable label
        return apiName
            .replace(/__c$/i, '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .trim();
    }

    _relativeTime(ms) {
        if (!ms) return '';
        const diffMs  = Date.now() - ms;
        const diffMin = Math.floor(diffMs / 60_000);
        if (diffMin < 1)   return 'Just now';
        if (diffMin < 60)  return `${diffMin}m ago`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24)    return `${diffH}h ago`;
        const diffD = Math.floor(diffH / 24);
        if (diffD === 1)   return 'Yesterday';
        if (diffD < 7)     return `${diffD} days ago`;
        return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }

    _announce(msg) {
        this.liveAnnouncement = '';
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.liveAnnouncement = msg; }, 50);
    }
}
