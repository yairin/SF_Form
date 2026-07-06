import { LightningElement, api, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getForm from '@salesforce/apex/FormRenderController.getForm';
import submitResponse from '@salesforce/apex/FormResponseController.submitResponse';
import attachFiles from '@salesforce/apex/FormFileService.attachFiles';

const MAX_FILE_BYTES = 4 * 1024 * 1024; // ~4MB per file (Apex heap/base64 guard)

const TEXT_TYPES = {
    text: 'text', email: 'email', phone: 'tel', number: 'number',
    currency: 'number', idNumber: 'text', date: 'date'
};

// Accepts a plain array (legacy single-step) or { steps:[{title,fields}] } / { fields:[...] }.
function normalizeSteps(parsed) {
    if (Array.isArray(parsed)) return [{ title: null, fields: parsed }];
    if (parsed && Array.isArray(parsed.steps)) {
        return parsed.steps.map((s) => ({ title: s.title || null, fields: s.fields || [] }));
    }
    if (parsed && Array.isArray(parsed.fields)) return [{ title: null, fields: parsed.fields }];
    return [{ title: null, fields: [] }];
}

function isValidIsraeliId(id) {
    const digits = String(id || '').replace(/\D/g, '');
    if (!digits.length || digits.length > 9) return false;
    const padded = digits.padStart(9, '0');
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        let p = Number(padded[i]) * ((i % 2 === 0) ? 1 : 2);
        if (p > 9) p -= 9;
        sum += p;
    }
    return sum % 10 === 0;
}

export default class DynamicForm extends LightningElement {
    _ext;
    _urlExt;
    @api
    get externalId() { return this._ext; }
    set externalId(v) {
        // A ?formId= URL param (read via the wire) always wins over the static
        // property, so a single published page can serve every form.
        if (!this._urlExt) this.applyExternalId(v);
    }

    // Read ?formId= (or ?c__formId=) from the Experience page URL.
    @wire(CurrentPageReference)
    setPageRef(ref) {
        const fromUrl = ref && ref.state && (ref.state.formId || ref.state.c__formId);
        if (fromUrl) {
            this._urlExt = fromUrl;
            this.applyExternalId(fromUrl);
        }
    }

    applyExternalId(v) {
        if (!v || v === this._ext) return;
        this._ext = v;
        this.load();
    }

    title = 'טופס';
    description = '';
    fields = [];
    values = {};
    files = {}; // key -> [{name, base64}]
    reference;
    error;
    loading = false;
    notFound = false;
    stepIndex = 0;
    stepTitles = [];

    get isWizard() { return this.stepTitles.length > 1; }
    get currentFields() { return this.fields.filter((f) => f.step === this.stepIndex); }
    get isFirstStep() { return this.stepIndex === 0; }
    get isLastStep() { return this.stepIndex >= this.stepTitles.length - 1; }
    get currentStepTitle() { return this.stepTitles[this.stepIndex]; }
    get stepProgressLabel() {
        return 'שלב ' + (this.stepIndex + 1) + ' מתוך ' + this.stepTitles.length + ': ' + this.currentStepTitle;
    }
    get progressStyle() {
        const pct = this.stepTitles.length ? Math.round(((this.stepIndex + 1) / this.stepTitles.length) * 100) : 100;
        return 'width:' + pct + '%';
    }

    stepHasErrors() {
        const missing = this.currentFields.filter((f) => f.required && this.isEmpty(this.values[f.key]));
        if (missing.length) {
            this.error = 'נא למלא את שדות החובה: ' + missing.map((f) => f.label).join(', ');
            return true;
        }
        const badId = this.currentFields.filter((f) => f.type === 'idNumber'
            && !this.isEmpty(this.values[f.key]) && !isValidIsraeliId(this.values[f.key]));
        if (badId.length) {
            this.error = 'תעודת זהות לא תקינה: ' + badId.map((f) => f.label).join(', ');
            return true;
        }
        return false;
    }

    nextStep() {
        this.error = undefined;
        if (this.stepHasErrors()) return;
        if (!this.isLastStep) this.stepIndex += 1;
    }

    prevStep() {
        this.error = undefined;
        if (!this.isFirstStep) this.stepIndex -= 1;
    }

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
        this.files = {};
        this.reference = undefined;
        this.stepIndex = 0;
        let parsed = [];
        try { parsed = JSON.parse(schemaJson || '[]'); } catch (e) { parsed = []; }
        const steps = normalizeSteps(parsed);
        this.stepTitles = steps.map((s, i) => s.title || ('שלב ' + (i + 1)));
        const flat = [];
        steps.forEach((s, si) => {
            (s.fields || []).forEach((f) => {
                flat.push({
                    key: f.key,
                    label: f.label,
                    type: f.type,
                    step: si,
                    required: !!f.required,
                    mapTo: f.mapTo,
                    options: (f.options || []).map((o) => ({ label: o, value: o })),
                    isText: Object.keys(TEXT_TYPES).includes(f.type),
                    inputType: TEXT_TYPES[f.type] || 'text',
                    isTextarea: f.type === 'textarea',
                    isSelect: f.type === 'select',
                    isRadio: f.type === 'radio',
                    isCheckbox: f.type === 'checkbox',
                    isCheckboxGroup: f.type === 'checkboxGroup',
                    isFile: f.type === 'file'
                });
            });
        });
        this.fields = flat;
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

    handleFileChange(event) {
        const key = event.target.dataset.key;
        const fileList = Array.from(event.target.files || []);
        this.error = undefined;
        const tooBig = fileList.find((f) => f.size > MAX_FILE_BYTES);
        if (tooBig) {
            this.error = 'הקובץ "' + tooBig.name + '" גדול מדי (מקסימום 4MB).';
            event.target.value = null;
            return;
        }
        Promise.all(fileList.map((file) => this.readFile(file))).then((read) => {
            this.files = { ...this.files, [key]: read };
            this.values[key] = read.map((r) => r.name).join('; ');
        });
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result || '';
                const base64 = String(result).split(',')[1] || '';
                resolve({ name: file.name, base64 });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    isEmpty(v) {
        return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    }

    collectFiles() {
        const out = [];
        Object.keys(this.files).forEach((k) => {
            (this.files[k] || []).forEach((f) => {
                if (f && f.base64) out.push({ name: f.name, base64: f.base64 });
            });
        });
        return out;
    }

    async handleSubmit() {
        this.error = undefined;
        const missing = this.fields.filter((f) => f.required && this.isEmpty(this.values[f.key]));
        if (missing.length) {
            this.error = 'נא למלא את שדות החובה: ' + missing.map((f) => f.label).join(', ');
            return;
        }
        const badId = this.fields.filter((f) => f.type === 'idNumber'
            && !this.isEmpty(this.values[f.key]) && !isValidIsraeliId(this.values[f.key]));
        if (badId.length) {
            this.error = 'תעודת זהות לא תקינה: ' + badId.map((f) => f.label).join(', ');
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
            const toAttach = this.collectFiles();
            if (toAttach.length) {
                try { await attachFiles({ responseId: res.id, files: toAttach }); } catch (e) { /* non-fatal */ }
            }
            this.reference = res.name;
        } catch (e) {
            this.error = (e && e.body && e.body.message) || 'אירעה שגיאה בשליחה.';
        } finally {
            this.loading = false;
        }
    }
}
