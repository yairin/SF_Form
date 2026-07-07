import { LightningElement, api } from 'lwc';
import saveForm from '@salesforce/apex/FormBuilderController.saveForm';
import listForms from '@salesforce/apex/FormBuilderController.listForms';
import listServiceTypes from '@salesforce/apex/FormBuilderController.listServiceTypes';
import getTemplate from '@salesforce/apex/FormBuilderController.getTemplate';
import getPublicUrl from '@salesforce/apex/FormBuilderController.getPublicUrl';
import setAIConfig from '@salesforce/apex/FormBuilderController.setAIConfig';

const CHOICE = new Set(['select', 'radio', 'checkboxGroup']);
const TYPE_OPTIONS = [
    ['text', 'טקסט קצר'], ['textarea', 'טקסט ארוך'], ['email', 'אימייל'], ['phone', 'טלפון'],
    ['number', 'מספר'], ['currency', 'סכום (₪)'], ['idNumber', 'תעודת זהות'], ['date', 'תאריך'],
    ['file', 'העלאת קובץ'],
    ['select', 'בחירה מרשימה'], ['radio', 'בחירה יחידה'],
    ['checkbox', 'תיבת סימון'], ['checkboxGroup', 'בחירה מרובה']
];
const MAP_OPTIONS = [
    ['', '— ללא מיפוי —'], ['respondentName', 'שם'], ['email', 'אימייל'], ['phone', 'טלפון'], ['subject', 'נושא']
];
const newField = () => ({ type: 'text', label: '', required: false, options: '', mapTo: '' });
const newStep = () => ({ title: '', fields: [newField()] });

export default class FormBuilder extends LightningElement {
    title = '';
    description = '';
    serviceTypeId = '';
    serviceTypes = [];
    aiEnabled = false;
    aiInstructions = '';
    aiCheckAttachments = false;
    aiContactApplicant = false;
    steps = [{ title: '', fields: [{ type: 'text', label: '', required: true, options: '', mapTo: 'respondentName' }] }];

    savedExternalId;
    savedUrl;
    savedMsg;
    error;
    existing = [];

    @api embedded = false;

    _recordId;
    _editExternalId;
    @api
    get recordId() { return this._recordId; }
    set recordId(v) {
        this._recordId = v;
        if (v) this.loadTemplate(v);
        else this.resetForm();
    }

    connectedCallback() {
        this.refresh();
    }

    resetForm() {
        this.title = '';
        this.description = '';
        this.serviceTypeId = '';
        this.aiEnabled = false;
        this.aiInstructions = '';
        this.aiCheckAttachments = false;
        this.aiContactApplicant = false;
        this.steps = [newStep()];
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
            this.aiEnabled = t.AI_Review_Enabled__c === true;
            this.aiInstructions = t.AI_Review_Instructions__c || '';
            this.aiCheckAttachments = t.AI_Check_Attachments__c === true;
            this.aiContactApplicant = t.AI_Contact_Applicant__c === true;
            this._editExternalId = t.External_Id__c;
            let parsed = [];
            try { parsed = JSON.parse(t.Schema_JSON__c || '[]'); } catch (e) { parsed = []; }
            this.steps = this.toStepsModel(parsed);
        } catch (e) {
            this.error = 'שגיאה בטעינת הטופס.';
        }
    }

    toStepsModel(parsed) {
        const rev = (f) => ({
            type: f.type || 'text',
            label: f.label || '',
            required: !!f.required,
            options: (f.options || []).join('\n'),
            mapTo: f.mapTo || ''
        });
        let rawSteps;
        if (Array.isArray(parsed)) rawSteps = [{ title: '', fields: parsed }];
        else if (parsed && Array.isArray(parsed.steps)) rawSteps = parsed.steps;
        else if (parsed && Array.isArray(parsed.fields)) rawSteps = [{ title: '', fields: parsed.fields }];
        else rawSteps = [];
        const model = rawSteps.map((s) => ({
            title: s.title || '',
            fields: (s.fields || []).map(rev)
        }));
        return model.length ? model : [newStep()];
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

    get stepRows() {
        return this.steps.map((st, s) => ({
            index: s,
            title: st.title,
            label: 'שלב ' + (s + 1),
            canRemove: this.steps.length > 1,
            fields: st.fields.map((f, i) => ({
                s: s,
                i: i,
                label: f.label,
                required: f.required,
                options: f.options,
                showOptions: CHOICE.has(f.type),
                typeOptions: TYPE_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === f.type })),
                mapOptions: MAP_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === (f.mapTo || '') }))
            }))
        }));
    }

    addStep() {
        this.steps = [...this.steps, newStep()];
    }

    removeStep(event) {
        const s = Number(event.target.dataset.s);
        if (this.steps.length <= 1) return;
        this.steps = this.steps.filter((_, idx) => idx !== s);
    }

    handleStepTitle(event) {
        const s = Number(event.target.dataset.s);
        const val = event.target.value;
        this.steps = this.steps.map((st, idx) => (idx === s ? { ...st, title: val } : st));
    }

    addField(event) {
        const s = Number(event.target.dataset.s);
        this.steps = this.steps.map((st, idx) => (idx === s ? { ...st, fields: [...st.fields, newField()] } : st));
    }

    removeField(event) {
        const s = Number(event.target.dataset.s);
        const i = Number(event.target.dataset.i);
        this.steps = this.steps.map((st, idx) =>
            idx === s ? { ...st, fields: st.fields.filter((_, fi) => fi !== i) } : st
        );
    }

    handleField(event) {
        const s = Number(event.target.dataset.s);
        const i = Number(event.target.dataset.i);
        const p = event.target.dataset.p;
        const val = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        this.steps = this.steps.map((st, idx) =>
            idx === s ? { ...st, fields: st.fields.map((f, fi) => (fi === i ? { ...f, [p]: val } : f)) } : st
        );
    }

    handleTitle(e) { this.title = e.target.value; }
    handleDesc(e) { this.description = e.target.value; }
    handleAiEnabled(e) { this.aiEnabled = e.target.checked; }
    handleAiInstructions(e) { this.aiInstructions = e.target.value; }
    handleAiCheckAttachments(e) { this.aiCheckAttachments = e.target.checked; }
    handleAiContactApplicant(e) { this.aiContactApplicant = e.target.checked; }

    buildSchema() {
        const seen = {};
        let n = 0;
        const steps = this.steps.map((st) => ({
            title: (st.title || '').trim() || null,
            fields: st.fields
                .filter((f) => f.label && f.label.trim())
                .map((f) => {
                    n += 1;
                    let key = f.label.trim().toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '_').replace(/^_+|_+$/g, '');
                    if (!key) key = 'field_' + n;
                    while (seen[key]) key = key + '_' + n;
                    seen[key] = 1;
                    return {
                        key,
                        label: f.label.trim(),
                        type: f.type,
                        required: !!f.required,
                        mapTo: f.mapTo || undefined,
                        options: CHOICE.has(f.type)
                            ? String(f.options || '').split('\n').map((x) => x.trim()).filter(Boolean)
                            : undefined
                    };
                })
        }));
        return steps;
    }

    slugify(s) {
        // ASCII-only external ids — Hebrew characters in the public URL break LWR routing.
        return String(s || '').trim().toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'form';
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
        const steps = this.buildSchema();
        const totalFields = steps.reduce((acc, st) => acc + st.fields.length, 0);
        if (!totalFields) {
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
                schemaJson: JSON.stringify({ steps }),
                externalId,
                serviceTypeId: this.serviceTypeId
            });
            this.savedExternalId = (saved && saved.External_Id__c) || externalId;
            if (saved && saved.Id) {
                try {
                    await setAIConfig({
                        recordId: saved.Id,
                        enabled: this.aiEnabled,
                        instructions: this.aiInstructions,
                        checkAttachments: this.aiCheckAttachments,
                        contactApplicant: this.aiContactApplicant
                    });
                } catch (e) { /* non-fatal */ }
            }
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
