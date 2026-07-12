import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import listFormsDetailed from '@salesforce/apex/FormBuilderController.listFormsDetailed';
import getResults from '@salesforce/apex/FormResultsController.getResults';
import generateAiInsights from '@salesforce/apex/FormResultsController.generateAiInsights';
import listResponses from '@salesforce/apex/FormResultsController.listResponses';
import getResponseDetail from '@salesforce/apex/FormResultsController.getResponseDetail';

const COLUMNS = [
    { label: 'שם הטופס', fieldName: 'name', sortable: true, wrapText: true },
    { label: 'מזהה', fieldName: 'externalId', sortable: true },
    { label: 'סוג שירות', fieldName: 'serviceType', sortable: true },
    { label: 'סטטוס', fieldName: 'statusLabel' },
    { label: 'תגובות', fieldName: 'responseCount', type: 'number', sortable: true, initialWidth: 110 },
    { type: 'action', typeAttributes: { rowActions: [{ label: 'הצג תוצאות', name: 'view' }] } }
];

const RESP_COLUMNS = [
    { label: 'סימוכין', fieldName: 'reference', initialWidth: 130 },
    { label: 'שם הפונה', fieldName: 'respondentName', wrapText: true },
    { label: 'הוגש', fieldName: 'submittedStr' },
    { label: 'סטטוס AI', fieldName: 'aiStatusLabel', initialWidth: 130,
      cellAttributes: { class: { fieldName: 'aiStatusClass' } } },
    { label: 'מסלול אישור', fieldName: 'approvalRoute', initialWidth: 130 },
    { type: 'action', typeAttributes: { rowActions: [{ label: 'הצג רשומה', name: 'open' }] } }
];

// AI status -> SLDS text-color class (used in the table and record view)
const STATUS_CLASS = {
    Approved: 'slds-text-color_success',
    Needs_Info: 'slds-text-color_error',
    Error: 'slds-text-color_error',
    Pending: 'slds-text-color_weak'
};
function statusClass(s) { return STATUS_CLASS[s] || 'slds-text-color_weak'; }

function fmt(v) {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('he-IL');
}

export default class FormResults extends LightningElement {
    columns = COLUMNS;
    respColumns = RESP_COLUMNS;
    allRows = [];
    rows = [];
    mode = 'list';
    search = '';
    sortBy;
    sortDirection = 'asc';

    // Responses list (record-level): client-side search / status filter / sort.
    respSearch = '';
    respStatus = '';
    respSort = 'date_desc';

    results;
    selectedId;
    aiText;
    aiGeneratedAt;
    aiCount;
    loading = false;
    aiLoading = false;

    responses = [];
    record;
    recordLoading = false;

    // Accessibility: selector of the element to move focus to after the next render
    // (keeps keyboard/screen-reader focus in sync when the inline view changes).
    _focusSelector;

    renderedCallback() {
        if (this._focusSelector) {
            const el = this.template.querySelector(this._focusSelector);
            if (el) {
                this._focusSelector = undefined;
                el.focus();
            }
        }
    }

    // Distribution of approval routes across the loaded responses (info surfacing).
    get routeSummary() {
        const counts = {};
        this.responses.forEach((r) => {
            const k = r.approvalRoute || 'ללא מסלול';
            counts[k] = (counts[k] || 0) + 1;
        });
        return Object.keys(counts).map((k) => ({ key: k, label: k, count: counts[k] }));
    }

    // ---- KPI tiles (derived client-side; no Apex change) ----
    // Auto-approve count: approvalRoute is already the Hebrew label from Apex.
    get autoApproveCount() {
        return this.responses.filter((r) => r.approvalRoute === 'אישור אוטומטי').length;
    }
    // AI-reviewed: aiStatus is null when never reviewed (label "לא נבדק").
    get reviewedCount() {
        return this.responses.filter((r) => r.aiStatus).length;
    }
    get reviewedPct() {
        const t = this.responses.length;
        return t ? Math.round((this.reviewedCount / t) * 100) : 0;
    }
    get reviewedPctLabel() {
        return this.reviewedPct + '%';
    }

    // ---- Charts (inline CSS bars; accessible text alternatives via aria-label) ----
    // AI-status distribution, from the server aggregates in getResults.
    get statusChart() {
        if (!this.results) return [];
        const items = [
            { key: 'ok', label: 'אושר', count: this.results.approved || 0, cls: 'hbar-fill bar-ok' },
            { key: 'warn', label: 'נדרשת השלמה', count: this.results.needsInfo || 0, cls: 'hbar-fill bar-warn' },
            { key: 'pending', label: 'בהמתנה / לא נבדק', count: this.results.pending || 0, cls: 'hbar-fill bar-pending' }
        ];
        return this._scaleBars(items);
    }
    get statusChartAria() {
        return 'התפלגות סטטוס בדיקת AI. ' +
            this.statusChart.map((i) => `${i.label}: ${i.count} (${i.percent}%)`).join(', ');
    }

    // Approval-route distribution, from the loaded responses.
    get routeChart() {
        return this._scaleBars(this.routeSummary.map((r) => ({ ...r, cls: 'hbar-fill bar-accent' })));
    }
    get routeChartAria() {
        return 'התפלגות מסלולי אישור. ' +
            this.routeChart.map((r) => `${r.label}: ${r.count} (${r.percent}%)`).join(', ');
    }

    // Submissions over time — grouped by day from listResponses' submittedAt.
    get timeChart() {
        const byDay = {};
        this.responses.forEach((r) => {
            if (!r.submittedAt) return;
            const d = new Date(r.submittedAt);
            if (Number.isNaN(d.getTime())) return;
            const key = d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
            byDay[key] = (byDay[key] || 0) + 1;
        });
        let days = Object.keys(byDay).sort();
        if (days.length > 30) days = days.slice(days.length - 30);
        const max = Math.max(1, ...days.map((k) => byDay[k]));
        return days.map((k) => {
            const parts = k.split('-');
            return {
                key: k,
                label: parts[2] + '/' + parts[1],
                count: byDay[k],
                barStyle: 'height:' + Math.round((byDay[k] / max) * 100) + '%'
            };
        });
    }
    get hasTimeChart() {
        return this.timeChart.length > 0;
    }
    get timeChartAria() {
        return 'הגשות לפי יום. ' + this.timeChart.map((d) => `${d.label}: ${d.count}`).join(', ');
    }

    // Shared: turn [{count,...}] into scaled horizontal bars (width vs max) with % of total.
    _scaleBars(items) {
        const max = Math.max(1, ...items.map((i) => i.count || 0));
        const total = items.reduce((s, i) => s + (i.count || 0), 0) || 1;
        return items.map((i) => ({
            ...i,
            percent: Math.round(((i.count || 0) / total) * 100),
            barStyle: 'width:' + Math.round(((i.count || 0) / max) * 100) + '%'
        }));
    }

    // ---- Responses list: search / status filter / sort (client-side) ----
    get sortOptions() {
        return [
            { label: 'תאריך (חדש לישן)', value: 'date_desc' },
            { label: 'תאריך (ישן לחדש)', value: 'date_asc' },
            { label: 'סטטוס AI', value: 'status' },
            { label: 'שם הפונה', value: 'name' }
        ];
    }
    get statusFilterOptions() {
        const counts = new Map();
        this.responses.forEach((r) => {
            const lbl = r.aiStatusLabel || 'לא נבדק';
            counts.set(lbl, (counts.get(lbl) || 0) + 1);
        });
        const opts = [{ label: 'כל הסטטוסים', value: '' }];
        counts.forEach((count, lbl) => opts.push({ label: `${lbl} (${count})`, value: lbl }));
        return opts;
    }
    get filteredResponses() {
        let r = [...this.responses];
        const s = (this.respSearch || '').trim().toLowerCase();
        if (s) {
            r = r.filter((x) =>
                (x.respondentName || '').toLowerCase().includes(s) ||
                (x.reference || '').toLowerCase().includes(s));
        }
        if (this.respStatus) {
            r = r.filter((x) => (x.aiStatusLabel || 'לא נבדק') === this.respStatus);
        }
        r.sort((a, b) => this._sortResp(a, b));
        return r;
    }
    get filteredCount() {
        return this.filteredResponses.length;
    }
    get hasFilteredResponses() {
        return this.filteredCount > 0;
    }
    get resultCountText() {
        return `נמצאו ${this.filteredCount} פניות`;
    }
    _sortResp(a, b) {
        switch (this.respSort) {
            case 'date_asc': return this._ts(a.submittedAt) - this._ts(b.submittedAt);
            case 'status': return (a.aiStatusLabel || '').localeCompare(b.aiStatusLabel || '', 'he');
            case 'name': return (a.respondentName || '').localeCompare(b.respondentName || '', 'he');
            case 'date_desc':
            default: return this._ts(b.submittedAt) - this._ts(a.submittedAt);
        }
    }
    _ts(v) {
        const t = new Date(v).getTime();
        return Number.isNaN(t) ? 0 : t;
    }
    handleRespSearch(e) { this.respSearch = e.target.value; }
    handleRespStatus(e) { this.respStatus = e.detail.value; }
    handleRespSort(e) { this.respSort = e.detail.value; }

    buildCsv() {
        const header = ['סימוכין', 'שם הפונה', 'הוגש', 'סטטוס AI', 'מסלול אישור'];
        const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const lines = [header.map(esc).join(',')];
        this.responses.forEach((r) => {
            lines.push([r.reference, r.respondentName, r.submittedStr, r.aiStatusLabel, r.approvalRoute].map(esc).join(','));
        });
        return lines.join('\r\n');
    }

    exportCsv() {
        const anchor = this.template.querySelector('a.csv-download');
        if (!anchor) return;
        // UTF-8 BOM so Excel renders Hebrew correctly
        anchor.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + this.buildCsv());
        anchor.download = (this.results && this.results.externalId ? this.results.externalId : 'results') + '.csv';
        anchor.click();
    }

    // Export a single record (details + fields + AI interaction thread) to CSV.
    exportRecordCsv() {
        const r = this.record;
        if (!r) return;
        const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const lines = [['סוג', 'פרט', 'ערך'].map(esc).join(',')];
        lines.push(['פרטים', 'סימוכין', r.reference].map(esc).join(','));
        lines.push(['פרטים', 'שם הפונה', r.respondentName].map(esc).join(','));
        lines.push(['פרטים', 'סטטוס AI', r.aiStatusLabel].map(esc).join(','));
        lines.push(['פרטים', 'מסלול אישור', r.approvalRoute].map(esc).join(','));
        (r.fields || []).forEach((f) => lines.push(['שדה', f.label, f.value].map(esc).join(',')));
        (r.interactions || []).forEach((i) =>
            lines.push(['התכתבות', i.interactionType + ' · ' + i.direction + ' · ' + i.occurredStr, i.message].map(esc).join(',')));
        const anchor = this.template.querySelector('a.record-csv-download');
        if (!anchor) return;
        anchor.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + lines.join('\r\n'));
        anchor.download = (r.reference || 'record') + '.csv';
        anchor.click();
    }

    connectedCallback() {
        this.load();
    }

    async load() {
        try {
            const data = await listFormsDetailed();
            this.allRows = data.map((r) => ({ ...r, statusLabel: r.active ? 'פעיל' : 'לא פעיל' }));
            this.applyFilter();
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        }
    }

    applyFilter() {
        let r = [...this.allRows];
        if (this.search) {
            const s = this.search.toLowerCase();
            r = r.filter((x) => (x.name || '').toLowerCase().includes(s) || (x.externalId || '').toLowerCase().includes(s));
        }
        if (this.sortBy) {
            const dir = this.sortDirection === 'asc' ? 1 : -1;
            r.sort((a, b) => {
                const av = a[this.sortBy] === undefined || a[this.sortBy] === null ? '' : a[this.sortBy];
                const bv = b[this.sortBy] === undefined || b[this.sortBy] === null ? '' : b[this.sortBy];
                return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
            });
        }
        this.rows = r;
    }

    handleSearch(e) { this.search = e.target.value; this.applyFilter(); }
    handleSort(e) { this.sortBy = e.detail.fieldName; this.sortDirection = e.detail.sortDirection; this.applyFilter(); }

    get isList() { return this.mode === 'list'; }
    get isDetail() { return this.mode === 'detail'; }
    get isRecord() { return this.mode === 'record'; }
    get hasRows() { return this.rows.length > 0; }
    get hasResponses() { return this.responses.length > 0; }
    get noData() { return this.results && this.results.total === 0; }

    async handleRowAction(e) {
        if (e.detail.action.name === 'view') {
            await this.openResults(e.detail.row.externalId);
        }
    }

    async openResults(externalId) {
        this.loading = true;
        this.aiText = undefined;
        this.respSearch = '';
        this.respStatus = '';
        this.respSort = 'date_desc';
        this.selectedId = externalId;
        try {
            const res = await getResults({ externalId });
            // decorate bar buckets with a width style for the CSS chart
            this.results = {
                ...res,
                fields: (res.fields || []).map((f) => ({
                    ...f,
                    buckets: (f.buckets || []).map((b) => ({ ...b, barStyle: 'width:' + b.percent + '%' }))
                }))
            };
            // show previously generated (persisted) insights on this and later visits
            this.aiText = res.insights || undefined;
            this.aiGeneratedAt = res.insightsGeneratedAt || undefined;
            this.aiCount = (res.insightsCount === undefined || res.insightsCount === null) ? undefined : res.insightsCount;
            // load the individual submissions for the record-level list
            const list = await listResponses({ externalId });
            this.responses = list.map((r) => ({ ...r, submittedStr: fmt(r.submittedAt), aiStatusClass: statusClass(r.aiStatus) }));
            this.mode = 'detail';
            this._focusSelector = '.detail-heading';
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        } finally {
            this.loading = false;
        }
    }

    async handleResponseRowAction(e) {
        if (e.detail.action.name === 'open') {
            await this.openRecord(e.detail.row.id);
        }
    }

    async openRecord(responseId) {
        this.recordLoading = true;
        try {
            const d = await getResponseDetail({ responseId });
            this.record = {
                ...d,
                submittedStr: fmt(d.submittedAt),
                aiReviewedStr: fmt(d.aiReviewedAt),
                aiStatusClass: statusClass(d.aiStatus),
                hasFiles: (d.files || []).length > 0,
                hasInteractions: (d.interactions || []).length > 0,
                interactions: (d.interactions || []).map((i, idx) => ({
                    ...i,
                    key: idx,
                    occurredStr: fmt(i.occurredAt),
                    fromApplicant: i.direction === 'מהפונה',
                    itemClass:
                        'slds-p-around_x-small slds-m-bottom_x-small slds-box slds-box_x-small ' +
                        (i.direction === 'מהפונה' ? 'ix-from' : i.direction === 'לפונה' ? 'ix-to' : 'ix-sys')
                }))
            };
            this.mode = 'record';
            this._focusSelector = '.record-heading';
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        } finally {
            this.recordLoading = false;
        }
    }

    backToList() {
        this.mode = 'list';
        this.results = undefined;
        this.responses = [];
        this.aiText = undefined;
        this.aiGeneratedAt = undefined;
        this.aiCount = undefined;
        this.respSearch = '';
        this.respStatus = '';
        this.respSort = 'date_desc';
        this._focusSelector = '.list-search';
    }

    backToDetail() {
        this.mode = 'detail';
        this.record = undefined;
        this._focusSelector = '.detail-heading';
    }

    // button label reflects whether insights already exist
    get aiButtonLabel() {
        return this.aiText ? 'הפק תובנות מחדש' : 'הפק תובנות AI';
    }

    // "נוצר: <date> · על N רשומות" — shown once insights exist
    get aiMeta() {
        if (!this.aiGeneratedAt) return '';
        const when = fmt(this.aiGeneratedAt);
        const countTxt = (this.aiCount === undefined || this.aiCount === null)
            ? '' : ` · על ${this.aiCount} רשומות`;
        return when ? `נוצר: ${when}${countTxt}` : '';
    }

    async runAi() {
        this.aiLoading = true;
        try {
            const res = await generateAiInsights({ externalId: this.selectedId });
            this.aiText = res.text;
            this.aiGeneratedAt = res.generatedAt;
            this.aiCount = res.count;
            if (this.results && res.text === this.results.summary) {
                this.toast('סיכום אוטומטי', 'לא מחובר מנוע AI חיצוני — מוצג סיכום מבוסס-חוקים. ניתן לחבר מנוע בטאב "ניהול".', 'warning');
            } else {
                this.toast('הופק', 'תובנות AI הופקו ונשמרו.', 'success');
            }
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        } finally {
            this.aiLoading = false;
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
    msg(e) {
        return (e && e.body && e.body.message) || 'אירעה שגיאה.';
    }
}
