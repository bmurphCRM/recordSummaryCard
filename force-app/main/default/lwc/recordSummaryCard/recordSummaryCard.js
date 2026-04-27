import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import getRecordMetrics from '@salesforce/apex/RecordSummaryController.getRecordMetrics';

const TICK_MS = 60_000;
const DEFAULT_TITLE = 'Record Summary';
const DEFAULT_THEME = 'default';
const VALID_THEMES = new Set([
    'default','ocean','forest','sunset','violet',
    'slate','midnight','coral','gold','aurora'
]);

export default class RecordSummaryCard extends NavigationMixin(LightningElement) {
    @api recordId;
    @api objectApiName;
    @api openDateField;
    @api closeDateField;
    @api cardTitle;
    @api theme;

    _wiredResult;
    metrics = {};
    isLoading = true;
    errorMessage;
    lastRefreshed = '';
    liveAnnouncement = '';
    _now = Date.now();
    _tickInterval;

    @wire(getRecordMetrics, {
        recordId: '$recordId',
        objectApiName: '$objectApiName',
        openDateField: '$openDateField',
        closeDateField: '$closeDateField'
    })
    wiredMetrics(result) {
        this._wiredResult = result;
        this.isLoading = false;
        if (result.data) {
            this.metrics = result.data;
            this.errorMessage = undefined;
            this.lastRefreshed = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.liveAnnouncement = `Metrics refreshed: ${this.metrics.openActivities} open activities, ${this.metrics.completedActivities} completed, ${this.metrics.notes} notes, ${this.metrics.files} files.`;
            this._manageTick();
        } else if (result.error) {
            this.errorMessage = result.error.body?.message ?? 'Unable to load record metrics.';
            this.metrics = {};
            this._stopTick();
        }
    }

    connectedCallback() {
        this._manageTick();
    }

    disconnectedCallback() {
        this._stopTick();
    }

    // ── Title + theme ─────────────────────────────────────────────────────

    get cardTitleDisplay() {
        return this.cardTitle?.trim() || DEFAULT_TITLE;
    }

    get themeClass() {
        const key = (this.theme || DEFAULT_THEME).toLowerCase();
        const resolved = VALID_THEMES.has(key) ? key : DEFAULT_THEME;
        return `card-wrapper theme-${resolved}`;
    }

    // ── Duration tile ─────────────────────────────────────────────────────

    get showDuration() {
        return !!this.openDateField && !!this.metrics?.openDate;
    }

    get isRecordOpen() {
        return this.showDuration && !this.metrics?.closeDate;
    }

    get durationStatusLabel() {
        return this.isRecordOpen ? 'Open' : 'Closed';
    }

    get durationStatusClass() {
        return this.isRecordOpen
            ? 'duration-status duration-status--open'
            : 'duration-status duration-status--closed';
    }

    // ── Duration arithmetic ───────────────────────────────────────────────

    get _durationMs() {
        if (!this.metrics?.openDate) return 0;
        const start = new Date(this.metrics.openDate).getTime();
        const end = this.metrics?.closeDate
            ? new Date(this.metrics.closeDate).getTime()
            : this._now;
        return Math.max(0, end - start);
    }

    get durationDays() {
        return Math.floor(this._durationMs / 86_400_000);
    }

    get durationHours() {
        return Math.floor((this._durationMs % 86_400_000) / 3_600_000);
    }

    get durationMinutes() {
        return Math.floor((this._durationMs % 3_600_000) / 60_000);
    }

    get durationDaysLabel() {
        return `${this.durationDays}d`;
    }

    get durationHmLabel() {
        return `${this.durationHours}h ${this.durationMinutes}m`;
    }

    get ariaDuration() {
        const state = this.isRecordOpen ? 'open for' : 'was open for';
        return `Record ${state} ${this.durationDays} days ${this.durationHours} hours ${this.durationMinutes} minutes`;
    }

    // ── Tick (live minutes on open records) ──────────────────────────────

    _manageTick() {
        if (this.isRecordOpen) {
            if (!this._tickInterval) {
                this._tickInterval = setInterval(() => {
                    this._now = Date.now();
                }, TICK_MS);
            }
        } else {
            this._stopTick();
        }
    }

    _stopTick() {
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = null;
        }
    }

    // ── Standard metric getters ───────────────────────────────────────────

    get hasError() {
        return !!this.errorMessage;
    }

    get hasOverdueActivities() {
        return this.metrics?.overdueActivities > 0;
    }

    get ariaOpenActivities() {
        return `${this.metrics?.openActivities ?? 0} open activities`;
    }

    get ariaCompletedActivities() {
        return `${this.metrics?.completedActivities ?? 0} completed activities`;
    }

    get ariaNotes() {
        return `${this.metrics?.notes ?? 0} notes`;
    }

    get ariaFiles() {
        return `${this.metrics?.files ?? 0} files`;
    }

    // ── Interaction handlers ──────────────────────────────────────────────

    async handleRefresh() {
        this.isLoading = true;
        this._now = Date.now();
        await refreshApex(this._wiredResult);
        this.isLoading = false;
    }

    handleTileKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this._navigateFromTile(event.currentTarget);
        }
    }

    handleOpenActivitiesClick(event) {
        this._navigateFromTile(event.currentTarget);
    }

    handleCompletedActivitiesClick(event) {
        this._navigateFromTile(event.currentTarget);
    }

    handleNotesClick(event) {
        this._navigateFromTile(event.currentTarget);
    }

    handleFilesClick(event) {
        this._navigateFromTile(event.currentTarget);
    }

    _navigateFromTile(tile) {
        const action = tile?.dataset?.action;
        const relationshipMap = {
            openActivities: 'OpenActivities',
            completedActivities: 'ActivityHistories',
            notes: 'CombinedAttachments',
            files: 'AttachedContentDocuments'
        };
        const relationshipApiName = relationshipMap[action];
        if (!relationshipApiName || !this.recordId) return;

        this[NavigationMixin.Navigate]({
            type: 'standard__recordRelationshipPage',
            attributes: {
                recordId: this.recordId,
                objectApiName: this.objectApiName,
                relationshipApiName,
                actionName: 'view'
            }
        });
    }
}
