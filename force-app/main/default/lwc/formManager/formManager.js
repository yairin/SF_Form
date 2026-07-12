import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningConfirm from 'lightning/confirm';
import listFormsDetailed from '@salesforce/apex/FormBuilderController.listFormsDetailed';
import deleteForm from '@salesforce/apex/FormBuilderController.deleteForm';
import cloneForm from '@salesforce/apex/FormBuilderController.cloneForm';
import setActive from '@salesforce/apex/FormBuilderController.setActive';

const COLUMNS = [
    { label: 'שם הטופס', fieldName: 'name', wrapText: true },
    { label: 'מזהה', fieldName: 'externalId' },
    { label: 'סוג שירות', fieldName: 'serviceType' },
    { label: 'סטטוס', fieldName: 'statusLabel', cellAttributes: { class: { fieldName: 'statusClass' } } },
    { label: 'תגובות', fieldName: 'responseCount', type: 'number', initialWidth: 100 },
    {
        label: 'קישור ציבורי', fieldName: 'url', type: 'url',
        typeAttributes: { label: 'פתח טופס', target: '_blank' }
    },
    {
        type: 'action',
        typeAttributes: {
            rowActions: (row, done) => done([
                { label: 'עריכה', name: 'edit' },
                { label: 'שכפול', name: 'clone' },
                { label: row.active ? 'השבתה' : 'הפעלה', name: 'toggle' },
                { label: 'העתקת קישור', name: 'copy' },
                { label: 'מחיקה', name: 'delete' }
            ])
        }
    }
];

export default class FormManager extends LightningElement {
    columns = COLUMNS;
    rows = [];
    mode = 'list';
    editId = null;

    // Accessibility: element to move focus to after the next render, so keyboard
    // and screen-reader focus follow the view change (list <-> builder).
    _focusSelector;

    connectedCallback() {
        this.load();
    }

    renderedCallback() {
        if (this._focusSelector) {
            const el = this.template.querySelector(this._focusSelector);
            if (el) {
                this._focusSelector = undefined;
                el.focus();
            }
        }
    }

    async load() {
        try {
            const data = await listFormsDetailed();
            this.rows = data.map((r) => ({
                ...r,
                statusLabel: r.active ? 'פעיל' : 'לא פעיל',
                statusClass: r.active ? 'slds-text-color_success' : 'slds-text-color_weak'
            }));
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        }
    }

    get isList() { return this.mode === 'list'; }
    get hasRows() { return this.rows.length > 0; }

    newForm() {
        this.editId = null;
        this.mode = 'edit';
        this._focusSelector = '.builder-heading';
    }

    handleSaved() {
        this.mode = 'list';
        this._focusSelector = '.new-form-btn';
        this.toast('נשמר', 'הטופס נשמר בהצלחה.', 'success');
        this.load();
    }

    handleCancel() {
        this.mode = 'list';
        this._focusSelector = '.new-form-btn';
    }

    async handleRowAction(event) {
        const action = event.detail.action.name;
        const row = event.detail.row;
        if (action === 'edit') {
            this.editId = row.id;
            this.mode = 'edit';
            this._focusSelector = '.builder-heading';
        } else if (action === 'clone') {
            await this.run(() => cloneForm({ recordId: row.id }), 'הטופס שוכפל (העותק לא פעיל).');
        } else if (action === 'toggle') {
            await this.run(() => setActive({ recordId: row.id, active: !row.active }),
                row.active ? 'הטופס הושבת.' : 'הטופס הופעל.');
        } else if (action === 'copy') {
            this.copy(row.url);
        } else if (action === 'delete') {
            const ok = await LightningConfirm.open({
                message: `למחוק את הטופס "${row.name}"? פעולה זו אינה הפיכה.`,
                label: 'אישור מחיקה',
                theme: 'warning'
            });
            if (ok) await this.run(() => deleteForm({ recordId: row.id }), 'הטופס נמחק.');
        }
    }

    async run(fn, successMsg) {
        try {
            await fn();
            this.toast('בוצע', successMsg, 'success');
            this.load();
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        }
    }

    copy(url) {
        if (!url) {
            this.toast('אין קישור', 'כתובת האתר הציבורי לא הוגדרה (Form Setting).', 'warning');
            return;
        }
        navigator.clipboard.writeText(url);
        this.toast('הועתק', 'הקישור הועתק ללוח.', 'success');
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    msg(e) {
        return (e && e.body && e.body.message) || 'אירעה שגיאה.';
    }
}
