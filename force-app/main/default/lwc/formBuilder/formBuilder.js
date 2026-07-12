import { LightningElement, api } from 'lwc';
import saveForm from '@salesforce/apex/FormBuilderController.saveForm';
import listForms from '@salesforce/apex/FormBuilderController.listForms';
import listServiceTypes from '@salesforce/apex/FormBuilderController.listServiceTypes';
import getTemplate from '@salesforce/apex/FormBuilderController.getTemplate';
import getPublicUrl from '@salesforce/apex/FormBuilderController.getPublicUrl';
import setAIConfig from '@salesforce/apex/FormBuilderController.setAIConfig';
import setDesignConfig from '@salesforce/apex/FormBuilderController.setDesignConfig';
import uploadDesignAsset from '@salesforce/apex/FormBuilderController.uploadDesignAsset';

const CHOICE = new Set(['select', 'radio', 'checkboxGroup']);
const PRIORITY_OPTIONS = [['High', 'גבוהה'], ['Normal', 'רגילה'], ['Low', 'נמוכה']];
const BG_TYPE_OPTIONS = [
    ['none', 'ללא (ברירת מחדל)'], ['color', 'צבע אחיד'], ['gradient', 'מעבר צבעים (Gradient)'],
    ['image', 'תמונת רקע'], ['video', 'סרטון רקע']
];
const FONT_OPTIONS = [
    ['', 'ברירת מחדל (מערכת)'],
    ['Arial, Helvetica, sans-serif', 'Arial'],
    ['"Segoe UI", Tahoma, sans-serif', 'Segoe UI'],
    ['Georgia, "Times New Roman", serif', 'Georgia (Serif)'],
    ['"Courier New", monospace', 'Courier (Monospace)'],
    ['"Rubik", "Assistant", sans-serif', 'Rubik / Assistant']
];
// Ready-made themes: choosing one fills several appearance values at once.
const PRESETS = {
    blue: {
        bgType: 'gradient', bgColor: '#e6eefa', bgColor2: '#f5f7fa', cardColor: '#ffffff',
        accentColor: '#1c5aa8', textColor: '#16202e', fontFamily: '"Rubik","Assistant",sans-serif'
    },
    green: {
        bgType: 'gradient', bgColor: '#e5f2ea', bgColor2: '#f6faf7', cardColor: '#ffffff',
        accentColor: '#2e7d52', textColor: '#16202e'
    },
    sand: {
        bgType: 'color', bgColor: '#f6efe2', cardColor: '#fffdf8', accentColor: '#b06a12', textColor: '#2a2113'
    },
    dark: {
        bgType: 'color', bgColor: '#0e1621', cardColor: '#17202c', accentColor: '#5b9be0', textColor: '#e7edf5'
    },
    white: {
        bgType: 'none', cardColor: '#ffffff', accentColor: '#111827', textColor: '#111111'
    }
};
const PRESET_OPTIONS = [
    ['', '— מותאם אישית —'], ['blue', 'כחול עירוני'], ['green', 'ירוק רשות'],
    ['sand', 'חול מדברי'], ['dark', 'כהה אלגנטי'], ['white', 'מינימלי לבן']
];
const BUTTON_STYLE_OPTIONS = [['rounded', 'עגול'], ['pill', 'כדורי'], ['square', 'מרובע']];
const HEADING_ALIGN_OPTIONS = [['right', 'לימין'], ['center', 'למרכז']];
const defaultAppearance = () => ({
    bgType: 'none', bgUrl: '', bgColor: '#f3f4f6', bgColor2: '#e0e7ff',
    overlay: 0, cardColor: '#ffffff', accentColor: '#1b5297', textColor: '#181818',
    fontFamily: '', maxWidth: 560, logoUrl: '', align: 'center',
    preset: '', bannerUrl: '', buttonStyle: 'rounded', cornerRadius: 12, headingAlign: 'right'
});
const newTask = () => ({ subject: '', priority: 'Normal', offsetDays: 0, description: '' });
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
    tasks = [];
    appearance = defaultAppearance();
    uploadingBg = false;
    uploadingLogo = false;
    uploadingBanner = false;
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
        this.tasks = [];
        this.appearance = defaultAppearance();
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
            try {
                const tk = JSON.parse(t.Tasks_JSON__c || '[]');
                this.tasks = Array.isArray(tk) ? tk.map((x) => ({ ...newTask(), ...x })) : [];
            } catch (e) { this.tasks = []; }
            try {
                const ap = JSON.parse(t.Appearance_JSON__c || 'null');
                this.appearance = ap ? { ...defaultAppearance(), ...ap } : defaultAppearance();
            } catch (e) { this.appearance = defaultAppearance(); }
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

    // ---- Tasks (per-form workflow) ----
    get taskRows() {
        return this.tasks.map((t, i) => ({
            i,
            subject: t.subject,
            offsetDays: t.offsetDays,
            description: t.description,
            priorityOptions: PRIORITY_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === t.priority }))
        }));
    }
    get hasTasks() { return this.tasks.length > 0; }

    addTask() { this.tasks = [...this.tasks, newTask()]; }
    removeTask(event) {
        const i = Number(event.target.dataset.i);
        this.tasks = this.tasks.filter((_, idx) => idx !== i);
    }
    handleTask(event) {
        const i = Number(event.target.dataset.i);
        const p = event.target.dataset.p;
        let val = event.target.value;
        if (p === 'offsetDays') val = Number(val) || 0;
        this.tasks = this.tasks.map((t, idx) => (idx === i ? { ...t, [p]: val } : t));
    }

    // ---- Appearance / design ----
    get bgTypeOptions() {
        return BG_TYPE_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === this.appearance.bgType }));
    }
    get fontOptions() {
        return FONT_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === (this.appearance.fontFamily || '') }));
    }
    get presetOptions() {
        return PRESET_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === (this.appearance.preset || '') }));
    }
    get buttonStyleOptions() {
        return BUTTON_STYLE_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === (this.appearance.buttonStyle || 'rounded') }));
    }
    get headingAlignOptions() {
        return HEADING_ALIGN_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === (this.appearance.headingAlign || 'right') }));
    }
    get showBgColor() { return this.appearance.bgType === 'color' || this.appearance.bgType === 'gradient'; }
    get showBgColor2() { return this.appearance.bgType === 'gradient'; }
    get showBgMedia() { return this.appearance.bgType === 'image' || this.appearance.bgType === 'video'; }
    get showOverlay() { return this.appearance.bgType === 'image' || this.appearance.bgType === 'video'; }
    get isVideoBg() { return this.appearance.bgType === 'video'; }
    get mediaAccept() { return this.appearance.bgType === 'video' ? 'video/*' : 'image/*'; }
    get mediaLabel() { return this.appearance.bgType === 'video' ? 'סרטון רקע' : 'תמונת רקע'; }
    get overlayPct() { return Math.round((Number(this.appearance.overlay) || 0) * 100); }
    // live preview style for the swatch in the builder
    get previewStyle() {
        const a = this.appearance;
        let bg;
        if (a.bgType === 'color') bg = a.bgColor;
        else if (a.bgType === 'gradient') bg = 'linear-gradient(135deg,' + a.bgColor + ',' + a.bgColor2 + ')';
        else if (a.bgType === 'image' && a.bgUrl) bg = 'center/cover no-repeat url(' + a.bgUrl + ')';
        else bg = '#f3f4f6';
        return 'background:' + bg + ';padding:1rem;border-radius:8px;min-height:90px;';
    }
    get previewCardStyle() {
        const a = this.appearance;
        const r = Number(a.cornerRadius);
        const radius = isNaN(r) ? 12 : r;
        return 'background:' + a.cardColor + ';color:' + a.textColor + ';border-radius:' + radius + 'px;'
            + 'max-width:100%;box-shadow:0 2px 10px rgba(0,0,0,0.15);font-family:' + (a.fontFamily || 'inherit')
            + ';overflow:hidden;';
    }
    get previewBannerStyle() {
        return 'display:block;width:100%;height:56px;object-fit:cover;';
    }
    get previewBodyStyle() {
        const a = this.appearance;
        return 'padding:0.75rem 1rem;text-align:' + (a.headingAlign === 'center' ? 'center' : 'right') + ';';
    }
    get previewBtnStyle() {
        const a = this.appearance;
        let br = '8px';
        if (a.buttonStyle === 'pill') br = '999px';
        else if (a.buttonStyle === 'square') br = '0';
        return 'background:' + a.accentColor + ';color:#fff;border:none;border-radius:' + br + ';padding:6px 14px;margin-top:6px;';
    }

    handleAppearance(event) {
        const p = event.target.dataset.p;
        let val = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        if (p === 'overlay' || p === 'maxWidth' || p === 'cornerRadius') val = Number(val) || 0;
        this.appearance = { ...this.appearance, [p]: val };
    }

    handleBgType(event) {
        this.appearance = { ...this.appearance, bgType: event.target.value };
    }

    // Choosing a ready-made theme fills several appearance values at once.
    handlePreset(event) {
        const id = event.target.value;
        const preset = PRESETS[id];
        if (!preset) {
            this.appearance = { ...this.appearance, preset: '' };
            return;
        }
        this.appearance = { ...this.appearance, ...preset, preset: id };
    }

    async handleBannerUpload(event) {
        const file = (event.target.files || [])[0];
        if (!file) return;
        this.error = undefined;
        this.uploadingBanner = true;
        try {
            const base64 = await this.readAsBase64(file);
            const url = await uploadDesignAsset({ fileName: file.name, base64 });
            this.appearance = { ...this.appearance, bannerUrl: url };
        } catch (e) {
            this.error = (e && e.body && e.body.message) || 'העלאת הבאנר נכשלה. אפשר להדביק כתובת URL במקום.';
        } finally {
            this.uploadingBanner = false;
            event.target.value = null;
        }
    }

    async handleMediaUpload(event) {
        const file = (event.target.files || [])[0];
        if (!file) return;
        this.error = undefined;
        this.uploadingBg = true;
        try {
            const base64 = await this.readAsBase64(file);
            const url = await uploadDesignAsset({ fileName: file.name, base64 });
            this.appearance = { ...this.appearance, bgUrl: url };
        } catch (e) {
            this.error = (e && e.body && e.body.message) || 'העלאת המדיה נכשלה. אפשר להדביק כתובת URL במקום.';
        } finally {
            this.uploadingBg = false;
            event.target.value = null;
        }
    }

    async handleLogoUpload(event) {
        const file = (event.target.files || [])[0];
        if (!file) return;
        this.error = undefined;
        this.uploadingLogo = true;
        try {
            const base64 = await this.readAsBase64(file);
            const url = await uploadDesignAsset({ fileName: file.name, base64 });
            this.appearance = { ...this.appearance, logoUrl: url };
        } catch (e) {
            this.error = (e && e.body && e.body.message) || 'העלאת הלוגו נכשלה. אפשר להדביק כתובת URL במקום.';
        } finally {
            this.uploadingLogo = false;
            event.target.value = null;
        }
    }

    readAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    buildTasksJson() {
        const clean = this.tasks
            .filter((t) => t.subject && t.subject.trim())
            .map((t) => ({
                subject: t.subject.trim(),
                priority: t.priority || 'Normal',
                offsetDays: Number(t.offsetDays) || 0,
                description: (t.description || '').trim()
            }));
        return JSON.stringify(clean);
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
                try {
                    await setDesignConfig({
                        recordId: saved.Id,
                        tasksJson: this.buildTasksJson(),
                        appearanceJson: JSON.stringify(this.appearance)
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
