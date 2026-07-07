import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import listFormsDetailed from '@salesforce/apex/FormBuilderController.listFormsDetailed';
import getResults from '@salesforce/apex/FormResultsController.getResults';
import getAiInsights from '@salesforce/apex/FormResultsController.getAiInsights';

const COLUMNS = [
    { label: 'שם הטופס', fieldName: 'name', sortable: true, wrapText: true },
    { label: 'מזהה', fieldName: 'externalId', sortable: true },
    { label: 'סוג שירות', fieldName: 'serviceType', sortable: true },
    { label: 'סטטוס', fieldName: 'statusLabel' },
    { label: 'תגובות', fieldName: 'responseCount', type: 'number', sortable: true, initialWidth: 110 },
    { type: 'action', typeAttributes: { rowActions: [{ label: 'הצג תוצאות', name: 'view' }] } }
];

export default class FormResults extends LightningElement {
    columns = COLUMNS;
    allRows = [];
    rows = [];
    mode = 'list';
    search = '';
    sortBy;
    sortDirection = 'asc';

    results;
    selectedId;
    aiText;
    loading = false;

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
    get hasRows() { return this.rows.length > 0; }
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
            this.mode = 'detail';
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        } finally {
            this.loading = false;
        }
    }

    back() {
        this.mode = 'list';
        this.results = undefined;
        this.aiText = undefined;
    }

    async runAi() {
        this.loading = true;
        try {
            this.aiText = await getAiInsights({ externalId: this.selectedId });
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        } finally {
            this.loading = false;
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
    msg(e) {
        return (e && e.body && e.body.message) || 'אירעה שגיאה.';
    }
}
