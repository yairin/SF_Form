import { LightningElement, api } from 'lwc';
import saveForm from '@salesforce/apex/FormBuilderController.saveForm';
import listForms from '@salesforce/apex/FormBuilderController.listForms';
import listServiceTypes from '@salesforce/apex/FormBuilderController.listServiceTypes';
import getTemplate from '@salesforce/apex/FormBuilderController.getTemplate';
import getPublicUrl from '@salesforce/apex/FormBuilderController.getPublicUrl';

const CHOICE = new Set(['select', 'radio', 'checkboxGroup']);
const TYPE_OPTIONS = [
    ['text', 'טקסט קצר'], ['textarea', 'טקסט ארוך'], ['email', 'אימייל'], ['phone', 'טלפון'],
    ['number', 'מספר'], ['date', 'תאריך'], ['select', 'בחירה מרשימה'], ['radio', 'בחירה יחידה'],
    ['checkbox', 'תיבת סימון'], ['checkboxGroup', 'בחירה מרובה']
];
const MAP_OPTIONS = [
    ['', '— ללא מיפוי —'], ['respondentName', 'שם'], ['email', 'אימייל'], ['phone', 'טלפון'], ['subject', 'נושא']
];
const NEW_FIELD = { type: 'text', label: '', required: true, options: '', mapTo: 'respondentName' };

export default class FormBuilder extends LightningElement {
    title = '';
    description = '';
    serviceTypeId = '';
    serviceTypes = [];
    fields = [{ ...NEW_FIELD }];

    savedExternalId;
    savedUrl;
    savedMsg;
    error;
    existing = [];

    // When embedded inside the manager, show navigation ("back to list") buttons.
    @api embedded = false;

    _recordId;
    _editExternalId;
    @api
    get recordId() { return this._recordId; }
    set recordId(v) {
        this._recordId = v;
        if (v) {
            this.loadTemplate(v);
        } else {
            this.resetForm();
        }
    }

    connectedCallback() {
        this.refresh();
    }

    resetForm() {
        this.title = '';
        this.description = '';
        this.serviceTypeId = '';
        this.fields = [{ ...NEW_FIELD }];
        this._editExternalId = undefined;
        this.savedExternalId = undefined;
        this.savedUrl = undefined;
        this.savedMsg = undefined;
        this.error = undefined;
    }

    async loadTemplate(id) {
        this.error = undefined;
        this.savedMsg = undefined;
        try {
            const t = await getTemplate({ recordId: id });
            this.title = t.Name || '';
            this.description = t.Description__c || '';
            this.serviceTypeId = t.Service_Type__c || '';
            this._editExternalId = t.External_Id__c;
            let parsed = [];
            try { parsed = JSON.parse(t.Schema_JSON__c || '[]'); } catch (e) { parsed = []; }
            this.fields = parsed.length
                ? parsed.map((f) => ({
                    type: f.type || 'text',
                    label: f.label || '',
                    required: !!f.required,
                    options: (f.options || []).join('\n'),
                    mapTo: f.mapTo || ''
                }))
                : [{ ...NEW_FIELD }];
        } catch (e) {
            this.error = 'שגיאה בטעינת הטופס.';
        }
    }

    async refresh() {
        try { this.existing = await listForms(); } catch (e) { /* ignore */ }
        try {
            const sts = await listServiceTypes();
            this.serviceTypes = [{ value: '', label: '— ללא —' }].concat(
                sts.map((s) => ({ value: s.Id, label: s.Name }))
            );
        } catch (e) { /* ignore */ }
    }

    handleServiceType(e) { this.serviceTypeId = e.target.value; }

    get isEdit() { return !!this._recordId; }
    get saveLabel() { return this.isEdit ? 'שמור שינויים' : 'שמור ופרסם'; }
    get notEmbedded() { return !this.embedded; }

    get fieldRows() {
        return this.fields.map((f, i) => ({
            index: i,
            label: f.label,
            required: f.required,
            options: f.options,
            showOptions: CHOICE.has(f.type),
            typeOptions: TYPE_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === f.type })),
            mapOptions: MAP_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === (f.mapTo || '') }))
        }));
    }

    addField() {
        this.fields = [...this.fields, { type: 'text', label: '', required: false, options: '', mapTo: '' }];
    }

    removeField(event) {
        const i = Number(event.target.dataset.i);
        this.fields = this.fields.filter((_, idx) => idx !== i);
    }

    handleTitle(e) { this.title = e.target.value; }
    handleDesc(e) { this.description = e.target.value; }

    handleField(event) {
        const i = Number(event.target.dataset.i);
        const p = event.target.dataset.p;
        const val = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        this.fields = this.fields.map((f, idx) => (idx === i ? { ...f, [p]: val } : f));
    }

    buildFields() {
        const seen = {};
        return this.fields
            .filter((f) => f.label && f.label.trim())
            .map((f, i) => {
                let key = f.label.trim().toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '_').replace(/^_+|_+$/g, '');
                if (!key) key = 'field_' + (i + 1);
                while (seen[key]) key = key + '_' + i;
                seen[key] = 1;
                return {
                    key,
                    label: f.label.trim(),
                    type: f.type,
                    required: !!f.required,
                    mapTo: f.mapTo || undefined,
                    options: CHOICE.has(f.type)
                        ? String(f.options || '').split('\n').map((s) => s.trim()).filter(Boolean)
                        : undefined
                };
            });
    }

    slugify(s) {
        return String(s || '').trim().toLowerCase()
            .replace(/[^a-z0-9֐-׿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'form';
    }

    async save() {
        this.error = undefined;
        this.savedMsg = undefined;
        this.savedExternalId = undefined;
        this.savedUrl = undefined;
        if (!this.title || this.title.trim().length < 2) {
            this.error = 'נא להזין כותרת (לפחות 2 תווים).';
            return;
        }
        const fields = this.buildFields();
        if (!fields.length) {
            this.error = 'נא להוסיף לפחות שדה אחד עם תווית.';
            return;
        }
        const externalId = this._recordId
            ? this._editExternalId
            : this.slugify(this.title) + '-' + Date.now();
        try {
            const saved = await saveForm({
                recordId: this._recordId || null,
                title: this.title.trim(),
                description: this.description,
                schemaJson: JSON.stringify(fields),
                externalId,
                serviceTypeId: this.serviceTypeId
            });
            this.savedExternalId = (saved && saved.External_Id__c) || externalId;
            try { this.savedUrl = await getPublicUrl({ externalId: this.savedExternalId }); } catch (e) { /* ignore */ }
            this.savedMsg = this.isEdit ? 'השינויים נשמרו!' : 'הטופס נשמר ופורסם!';
            this.refresh();
            this.dispatchEvent(new CustomEvent('saved', {
                detail: { externalId: this.savedExternalId, url: this.savedUrl }
            }));
        } catch (e) {
            this.error = (e && e.body && e.body.message) || 'שגיאה בשמירה.';
        }
    }

    copyUrl() {
        if (!this.savedUrl) return;
        navigator.clipboard.writeText(this.savedUrl);
    }

    cancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }
}
