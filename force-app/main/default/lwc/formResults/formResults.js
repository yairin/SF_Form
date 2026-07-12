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
