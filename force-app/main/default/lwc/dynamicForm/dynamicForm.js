import { LightningElement, api, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getForm from '@salesforce/apex/FormRenderController.getForm';
import submitResponse from '@salesforce/apex/FormResponseController.submitResponse';
import attachFiles from '@salesforce/apex/FormFileService.attachFiles';
import validateFile from '@salesforce/apex/FormFileValidationService.validateFile';

const MAX_FILE_BYTES = 4 * 1024 * 1024; // ~4MB per file (Apex heap/base64 guard)
const DEFAULT_ACCEPT = ['pdf', 'png', 'jpg', 'jpeg'];

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
    appearance = null;
    fields = [];
    values = {};
    files = {}; // key -> [{name, base64}]
    fileStatus = {}; // key -> {checking, ok, message, cssClass}
    fieldErrors = {}; // key -> message (inline, per-field)
    reference;
    error;
    loading = false;
    notFound = false;
    stepIndex = 0;
    stepTitles = [];
    showErrorSummary = false;
    submittedEmail = null; // shown on the success screen if an email was captured
    copyMessage = '';      // live feedback for the "copy reference" button
    _dragKey = null;       // key of the file field currently under a drag operation
    _pendingFocus = null;  // 'summary' | 'success' | 'review' | field key -> handled in renderedCallback

    get isWizard() { return this.stepTitles.length > 1; }
    get currentFields() { return this.fields.filter((f) => f.step === this.stepIndex); }
    // fields for the current step decorated with per-file status and inline errors
    get currentFieldsView() {
        return this.currentFields.map((f) => {
            const hasErr = !!this.fieldErrors[f.key];
            const ids = [];
            if (f.helpText) ids.push(f.key + '-help');
            if (hasErr) ids.push(f.key + '-err');
            // file fields get chip data + a drag-aware drop-zone class
            let fileItems = null;
            let dropzoneClass;
            let acceptHint;
            if (f.isFile) {
                const arr = this.files[f.key] || [];
                fileItems = arr.length ? arr.map((it, idx) => ({
                    uid: f.key + '-' + idx,
                    index: idx,
                    name: it.name,
                    sizeLabel: this.formatSize(it.size),
                    isImage: !!it.isImage,
                    previewUrl: it.previewUrl || null,
                    removeLabel: 'הסר את הקובץ ' + it.name
                })) : null;
                dropzoneClass = 'form-dropzone' + (this._dragKey === f.key ? ' form-dropzone_active' : '');
                acceptHint = 'סוגים נתמכים: ' + (f.acceptList || []).join(', ');
            }
            return {
                ...f,
                status: this.fileStatus[f.key],
                fieldError: this.fieldErrors[f.key],
                ariaInvalid: hasErr ? 'true' : 'false',
                ariaRequired: f.required ? 'true' : 'false',
                isGroup: f.isRadio || f.isCheckboxGroup,
                helpId: f.key + '-help',
                errId: f.key + '-err',
                describedBy: ids.length ? ids.join(' ') : undefined,
                fileItems,
                dropzoneClass,
                acceptHint
            };
        });
    }

    // aria-busy state for the card/buttons while submitting.
    get ariaBusy() { return this.loading ? 'true' : 'false'; }

    // Fields on the current step that currently carry an inline error, for the
    // accessible error summary box shown at the top of the form.
    get errorSummaryItems() {
        return this.currentFields
            .filter((f) => this.fieldErrors[f.key])
            .map((f) => ({ key: f.key, label: f.label, message: this.fieldErrors[f.key] }));
    }
    get hasErrorSummary() { return this.showErrorSummary && this.errorSummaryItems.length > 0; }
    get isFirstStep() { return this.stepIndex === 0; }

    // A wizard gets one extra "review & confirm" step appended after the last
    // content step. Single-step forms get no review step.
    get hasReviewStep() { return this.isWizard; }
    get reviewStepIndex() { return this.stepTitles.length; }
    get isReviewStep() { return this.hasReviewStep && this.stepIndex === this.reviewStepIndex; }
    get allStepTitles() {
        return this.hasReviewStep ? [...this.stepTitles, 'סקירה ואישור'] : this.stepTitles;
    }
    get totalSteps() { return this.allStepTitles.length; }

    get isLastStep() { return this.stepIndex >= this.totalSteps - 1; }
    get currentStepTitle() { return this.allStepTitles[this.stepIndex]; }
    get stepProgressLabel() {
        return 'שלב ' + (this.stepIndex + 1) + ' מתוך ' + this.totalSteps + ': ' + this.currentStepTitle;
    }
    get progressStyle() {
        const pct = this.totalSteps ? Math.round(((this.stepIndex + 1) / this.totalSteps) * 100) : 100;
        return 'width:' + pct + '%';
    }

    // Read-only recap of all entered values, grouped by content step, for the
    // review step. Files show their file names; empty optional fields show "—".
    get reviewGroups() {
        return this.stepTitles.map((title, si) => {
            const flds = this.fields.filter((f) => f.step === si).map((f) => {
                let display;
                if (f.isFile) {
                    const items = this.files[f.key] || [];
                    display = items.length ? items.map((x) => x.name).join(', ') : '—';
                } else {
                    const v = this.values[f.key];
                    if (Array.isArray(v)) display = v.length ? v.join(', ') : '—';
                    else display = this.isEmpty(v) ? '—' : v;
                }
                return { key: f.key, label: f.label, display };
            });
            return { id: 'grp-' + si, index: si, title, fields: flds };
        });
    }

    formatSize(bytes) {
        const n = Number(bytes) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
        return (n / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Validates a set of fields, writing inline per-field errors. Returns true if any invalid.
    validateFields(fieldsToCheck) {
        const errs = { ...this.fieldErrors };
        let bad = false;
        fieldsToCheck.forEach((f) => {
            delete errs[f.key];
            let m;
            if (f.required && this.isEmpty(this.values[f.key])) m = 'שדה חובה';
            else if (f.type === 'idNumber' && !this.isEmpty(this.values[f.key]) && !isValidIsraeliId(this.values[f.key])) m = 'תעודת זהות לא תקינה';
            if (m) { errs[f.key] = m; bad = true; }
        });
        this.fieldErrors = errs;
        this.error = bad ? 'נא לתקן את השדות המסומנים.' : undefined;
        this.showErrorSummary = bad;
        return bad;
    }

    stepHasErrors() {
        return this.validateFields(this.currentFields);
    }

    nextStep() {
        this.error = undefined;
        if (this.stepHasErrors()) { this._pendingFocus = 'summary'; return; }
        if (!this.isLastStep) {
            this.stepIndex += 1;
            if (this.isReviewStep) this._pendingFocus = 'review';
        }
    }

    prevStep() {
        this.error = undefined;
        this.showErrorSummary = false;
        if (!this.isFirstStep) this.stepIndex -= 1;
    }

    // "עריכה" link on the review step: jump back to a specific content step.
    editStep(event) {
        this.error = undefined;
        this.showErrorSummary = false;
        this.stepIndex = Number(event.currentTarget.dataset.step);
    }

    // Focus management: after a render triggered by validation failure or a
    // successful submit, move keyboard focus to the relevant landmark.
    renderedCallback() {
        if (!this._pendingFocus) return;
        const target = this._pendingFocus;
        this._pendingFocus = null;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        requestAnimationFrame(() => {
            let el;
            if (target === 'summary') el = this.template.querySelector('.form-error-summary');
            else if (target === 'success') el = this.template.querySelector('.form-success-heading');
            else if (target === 'review') el = this.template.querySelector('.form-review-heading');
            else el = this.template.querySelector('[data-key="' + target + '"]');
            if (el && typeof el.focus === 'function') el.focus();
        });
    }

    // Error-summary link: move focus to the offending field.
    focusField(event) {
        event.preventDefault();
        const key = event.currentTarget.dataset.key;
        const el = this.template.querySelector('[data-key="' + key + '"]');
        if (el && typeof el.focus === 'function') el.focus();
    }

    connectedCallback() {
        if (this._ext && this.fields.length === 0) this.load();
    }

    async load() {
        this.notFound = false;
        try {
            const t = await getForm({ externalId: this._ext });
            this.applyAppearance(t.Appearance_JSON__c);
            this.applySchema(t.Name, t.Description__c, t.Schema_JSON__c);
        } catch (e) {
            this.notFound = true;
        }
    }

    applyAppearance(json) {
        try {
            const a = JSON.parse(json || 'null');
            this.appearance = a && a.bgType ? a : null;
        } catch (e) {
            this.appearance = null;
        }
    }

    applySchema(title, description, schemaJson) {
        this.title = title || 'טופס';
        this.description = description || '';
        this.values = {};
        this.files = {};
        this.fileStatus = {};
        this.fieldErrors = {};
        this.showErrorSummary = false;
        this.reference = undefined;
        this.submittedEmail = null;
        this.copyMessage = '';
        this._dragKey = null;
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
                    isFile: f.type === 'file',
                    helpText: f.helpText || f.help || null,
                    // per-file-field validation config (optional in schema)
                    acceptList: Array.isArray(f.accept) && f.accept.length ? f.accept.map((x) => String(x).toLowerCase()) : DEFAULT_ACCEPT,
                    accept: '.' + (Array.isArray(f.accept) && f.accept.length ? f.accept : DEFAULT_ACCEPT).join(',.'),
                    docLabel: f.docLabel || f.label,
                    verifyKeys: Array.isArray(f.verify) && f.verify.length ? f.verify : null
                });
            });
        });
        this.fields = flat;
    }

    // ---- Appearance-driven styling (all inline so it works on a guest site) ----
    get styled() { return !!this.appearance; }
    get isVideoBg() { return this.styled && this.appearance.bgType === 'video' && !!this.appearance.bgUrl; }
    get bgVideoUrl() { return this.isVideoBg ? this.appearance.bgUrl : null; }
    get hasOverlay() {
        return this.styled
            && (this.appearance.bgType === 'image' || this.appearance.bgType === 'video')
            && Number(this.appearance.overlay) > 0;
    }

    get containerStyle() {
        const a = this.appearance;
        if (!a) return 'max-width:560px;margin:0 auto;';
        let s = 'position:relative;padding:2rem 1rem;margin:0 auto;box-sizing:border-box;';
        if (a.fontFamily) s += 'font-family:' + a.fontFamily + ';';
        if (a.bgType === 'color') s += 'background:' + a.bgColor + ';';
        else if (a.bgType === 'gradient') s += 'background:linear-gradient(135deg,' + a.bgColor + ',' + a.bgColor2 + ');';
        else if (a.bgType === 'image' && a.bgUrl) s += 'background:center/cover no-repeat url(' + a.bgUrl + ');';
        if (a.bgType !== 'none') s += 'min-height:100%;';
        return s;
    }

    get overlayStyle() {
        const o = Number(this.appearance && this.appearance.overlay) || 0;
        return 'position:absolute;inset:0;z-index:0;background:rgba(0,0,0,' + o + ');';
    }

    get videoStyle() {
        return 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';
    }

    // Card corner radius: new optional appearance key cornerRadius (px), default 12.
    get cornerRadius() {
        const r = Number(this.appearance && this.appearance.cornerRadius);
        return (r > 0) ? r : 12;
    }

    get cardStyle() {
        const a = this.appearance;
        const max = (a && a.maxWidth) ? a.maxWidth : 560;
        let s = 'position:relative;z-index:1;max-width:' + max + 'px;margin:0 auto;';
        if (a) {
            s += 'background:' + a.cardColor + ';color:' + a.textColor + ';'
                + 'border-radius:' + this.cornerRadius + 'px;padding:1.25rem 1.5rem;box-shadow:0 6px 24px rgba(0,0,0,0.18);';
        }
        return s;
    }

    get brandBtnStyle() {
        if (!this.appearance) return '';
        const a = this.appearance;
        const radiusMap = { rounded: '8px', pill: '999px', square: '2px' };
        const r = radiusMap[a.buttonStyle] || '8px';
        return 'background:' + a.accentColor + ';border-color:' + a.accentColor + ';border-radius:' + r + ';';
    }

    // Title + description alignment: new optional appearance key headingAlign
    // ('right' | 'center'), default 'right' (RTL Hebrew).
    get headingStyle() {
        const align = (this.appearance && this.appearance.headingAlign === 'center') ? 'center' : 'right';
        return 'text-align:' + align + ';';
    }

    // Full-width decorative banner at the very top of the card (optional).
    get hasBanner() { return this.styled && !!this.appearance.bannerUrl; }
    get bannerUrl() { return this.hasBanner ? this.appearance.bannerUrl : null; }
    get bannerStyle() {
        const r = this.cornerRadius;
        // negative margins cancel the styled card's 1.25rem/1.5rem padding so the
        // banner spans the full card width and sits flush against the top edge.
        return 'display:block;width:calc(100% + 3rem);margin:-1.25rem -1.5rem 1rem -1.5rem;'
            + 'max-height:160px;object-fit:cover;'
            + 'border-top-left-radius:' + r + 'px;border-top-right-radius:' + r + 'px;';
    }

    get hasLogo() { return this.styled && !!this.appearance.logoUrl; }
    get logoUrl() { return this.hasLogo ? this.appearance.logoUrl : null; }

    handleChange(event) {
        const key = event.target.dataset.key;
        const f = this.fields.find((x) => x.key === key);
        if (!f) return;
        // clear an inline error as soon as the user edits the field
        if (this.fieldErrors[key]) {
            const e = { ...this.fieldErrors };
            delete e[key];
            this.fieldErrors = e;
        }
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
        this.processFiles(key, fileList, event.target);
    }

    // Drop counterpart of handleFileChange: shares processFiles() so validation,
    // reading, and AI verification behave identically to click-to-select.
    handleFileDrop(event) {
        event.preventDefault();
        const key = event.currentTarget.dataset.dropkey;
        this._dragKey = null;
        const dt = event.dataTransfer;
        const fileList = dt ? Array.from(dt.files || []) : [];
        if (fileList.length) this.processFiles(key, fileList, null);
    }

    // Alias used by the drop-zone template.
    handleDrop(event) { this.handleFileDrop(event); }

    handleDragOver(event) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }

    handleDragEnter(event) {
        event.preventDefault();
        this._dragKey = event.currentTarget.dataset.dropkey;
    }

    handleDragLeave(event) {
        if (event.currentTarget.dataset.dropkey === this._dragKey) this._dragKey = null;
    }

    // Shared upload pipeline for both click-to-select and drag & drop.
    processFiles(key, fileList, inputEl) {
        const f = this.fields.find((x) => x.key === key);
        this.error = undefined;
        if (!fileList.length) return;
        const tooBig = fileList.find((file) => file.size > MAX_FILE_BYTES);
        if (tooBig) {
            this.setFileStatus(key, { ok: false, message: 'הקובץ "' + tooBig.name + '" גדול מדי (מקסימום 4MB).' });
            if (inputEl) inputEl.value = null;
            return;
        }
        // immediate client-side file-type check (during field fill)
        const accept = (f && f.acceptList) || DEFAULT_ACCEPT;
        const badType = fileList.find((file) => {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            return !accept.includes(ext);
        });
        if (badType) {
            this.setFileStatus(key, { ok: false, message: 'סוג הקובץ אינו מתאים. נדרש: ' + accept.join(', ') + '.' });
            if (inputEl) inputEl.value = null;
            return;
        }
        this.setFileStatus(key, { checking: true, message: 'בודק את הקובץ…' });
        Promise.all(fileList.map((file) => this.readFile(file))).then((read) => {
            this.files = { ...this.files, [key]: read };
            this.values[key] = read.map((r) => r.name).join('; ');
            // AI content check (correct document type + details match applicant) on upload
            this.verifyFile(f, read[0]);
        });
    }

    // Remove a single chosen file from a field; re-verify the remaining first
    // file, or clear status/value entirely when none are left.
    handleRemoveFile(event) {
        const key = event.currentTarget.dataset.key;
        const index = Number(event.currentTarget.dataset.index);
        const arr = (this.files[key] || []).slice();
        if (index < 0 || index >= arr.length) return;
        arr.splice(index, 1);
        const nextFiles = { ...this.files };
        if (arr.length) nextFiles[key] = arr; else delete nextFiles[key];
        this.files = nextFiles;
        if (arr.length) {
            this.values[key] = arr.map((r) => r.name).join('; ');
            const f = this.fields.find((x) => x.key === key);
            this.setFileStatus(key, { checking: true, message: 'בודק את הקובץ…' });
            this.verifyFile(f, arr[0]);
        } else {
            delete this.values[key];
            const st = { ...this.fileStatus };
            delete st[key];
            this.fileStatus = st;
        }
    }

    async verifyFile(f, fileObj) {
        if (!f || !fileObj) return;
        try {
            const v = await validateFile({
                docLabel: f.docLabel,
                acceptExt: f.acceptList,
                fileName: fileObj.name,
                base64: fileObj.base64,
                applicantJson: JSON.stringify(this.values || {}),
                matchKeys: f.verifyKeys
            });
            const ok = v.typeOk !== false && v.aiOk !== false;
            this.setFileStatus(f.key, { ok, message: v.message });
        } catch (e) {
            // non-blocking: a verification error shouldn't stop submission
            this.setFileStatus(f.key, { ok: true, message: 'הקובץ התקבל (בדיקת תוכן לא הושלמה).' });
        }
    }

    setFileStatus(key, status) {
        const cssClass = status.checking
            ? 'slds-text-color_weak'
            : (status.ok === false ? 'slds-text-color_error' : 'slds-text-color_success');
        // Don't rely on color alone: prefix a text glyph for success/failure (WCAG 1.4.1).
        const prefix = status.checking ? '' : (status.ok === false ? '✗ ' : '✔ ');
        const message = prefix + (status.message || '');
        this.fileStatus = { ...this.fileStatus, [key]: { ...status, cssClass, message } };
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                const base64 = result.split(',')[1] || '';
                const isImage = /^image\//.test(file.type || '');
                resolve({
                    name: file.name,
                    base64,
                    size: file.size,
                    isImage,
                    previewUrl: isImage ? result : null
                });
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
        // full-form validation with inline per-field errors; jump to the first step with an error
        if (this.validateFields(this.fields)) {
            const firstBad = this.fields.find((f) => this.fieldErrors[f.key]);
            if (firstBad && firstBad.step !== this.stepIndex) {
                // jumped to the first step with an error: focus the first invalid field
                this.stepIndex = firstBad.step;
                this._pendingFocus = firstBad.key;
            } else {
                this._pendingFocus = 'summary';
            }
            return;
        }
        // block submission on files that failed type/content validation
        const stillChecking = this.fields.filter((f) => this.fileStatus[f.key] && this.fileStatus[f.key].checking);
        if (stillChecking.length) {
            this.error = 'המתן לסיום בדיקת הקבצים: ' + stillChecking.map((f) => f.label).join(', ');
            return;
        }
        const badFiles = this.fields.filter((f) => this.fileStatus[f.key] && this.fileStatus[f.key].ok === false);
        if (badFiles.length) {
            this.error = 'יש לתקן את הקבצים שנכשלו בבדיקה: ' + badFiles.map((f) => f.label).join(', ');
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
        // remember whether the applicant supplied an email (for the success screen)
        this.submittedEmail = mapped.email || null;
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
            this.showErrorSummary = false;
            this._pendingFocus = 'success';
        } catch (e) {
            this.error = (e && e.body && e.body.message) || 'אירעה שגיאה בשליחה.';
        } finally {
            this.loading = false;
        }
    }

    // Copy the reference number to the clipboard with accessible live feedback.
    copyReference() {
        const ref = this.reference;
        if (!ref) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(ref)
                .then(() => { this.copyMessage = 'מספר הסימוכין הועתק ✔'; })
                .catch(() => { this.copyMessage = 'ההעתקה נכשלה, נא להעתיק ידנית.'; });
        } else {
            this.copyMessage = 'ההעתקה אינה נתמכת, נא להעתיק ידנית.';
        }
    }

    // Print a confirmation of the submission.
    printConfirmation() {
        window.print();
    }
}
