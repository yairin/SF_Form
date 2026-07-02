import { LightningElement, api } from 'lwc';
import getForm from '@salesforce/apex/FormRenderController.getForm';
import submitResponse from '@salesforce/apex/FormResponseController.submitResponse';

const TEXT_TYPES = { text: 'text', email: 'email', phone: 'tel', number: 'number', date: 'date' };

export default class DynamicForm extends LightningElement {
    _ext;
    @api
    get externalId() { return this._ext; }
    set externalId(v) {
        this._ext = v;
        if (v) this.load();
    }

    title = 'טופס';
    description = '';
    fields = [];
    values = {};
    reference;
    error;
    loading = false;
    notFound = false;

    connectedCallback() {
        if (this._ext && this.fields.length === 0) this.load();
    }

    async load() {
        this.notFound = false;
        try {
            const t = await getForm({ externalId: this._ext });
            this.applySchema(t.Name, t.Description__c, t.Schema_JSON__c);
        } catch (e) {
            this.notFound = true;
        }
    }

    applySchema(title, description, schemaJson) {
        this.title = title || 'טופס';
        this.description = description || '';
        this.values = {};
        this.reference = undefined;
        let parsed = [];
        try { parsed = JSON.parse(schemaJson || '[]'); } catch (e) { parsed = []; }
        this.fields = parsed.map((f) => ({
            key: f.key,
            label: f.label,
            required: !!f.required,
            mapTo: f.mapTo,
            options: (f.options || []).map((o) => ({ label: o, value: o })),
            isText: Object.keys(TEXT_TYPES).includes(f.type),
            inputType: TEXT_TYPES[f.type] || 'text',
            isTextarea: f.type === 'textarea',
            isSelect: f.type === 'select',
            isRadio: f.type === 'radio',
            isCheckbox: f.type === 'checkbox',
            isCheckboxGroup: f.type === 'checkboxGroup'
        }));
    }

    handleChange(event) {
        const key = event.target.dataset.key;
        const f = this.fields.find((x) => x.key === key);
        if (!f) return;
        if (f.isCheckbox) {
            this.values[key] = event.target.checked ? 'כן' : '';
        } else if (f.isCheckboxGroup) {
            const set = new Set(this.values[key] || []);
            if (event.target.checked) set.add(event.target.value); else set.delete(event.target.value);
            this.values[key] = [...set];
        } else {
            this.values[key] = event.target.value;
        }
    }

    isEmpty(v) {
        return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    }

    async handleSubmit() {
        this.error = undefined;
        const missing = this.fields.filter((f) => f.required && this.isEmpty(this.values[f.key]));
        if (missing.length) {
            this.error = 'נא למלא את שדות החובה: ' + missing.map((f) => f.label).join(', ');
            return;
        }
        this.loading = true;
        const payload = {};
        const mapped = {};
        for (const f of this.fields) {
            let v = this.values[f.key];
            if (this.isEmpty(v)) continue;
            if (Array.isArray(v)) v = v.join('; ');
            payload[f.key] = v;
            if (f.mapTo) mapped[f.mapTo] = v;
        }
        try {
            const res = await submitResponse({
                formName: this.title,
                externalId: this._ext || 'preview',
                payloadJson: JSON.stringify(payload),
                respondentName: mapped.respondentName || null,
                email: mapped.email || null,
                phone: mapped.phone || null,
                subject: mapped.subject || this.title
            });
            this.reference = res.name;
        } catch (e) {
            this.error = (e && e.body && e.body.message) || 'אירעה שגיאה בשליחה.';
        } finally {
            this.loading = false;
        }
    }
}
