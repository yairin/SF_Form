import { LightningElement, api } from 'lwc';
import saveForm from '@salesforce/apex/FormBuilderController.saveForm';
import listForms from '@salesforce/apex/FormBuilderController.listForms';
import listServiceTypes from '@salesforce/apex/FormBuilderController.listServiceTypes';
import getTemplate from '@salesforce/apex/FormBuilderController.getTemplate';
import getPublicUrl from '@salesforce/apex/FormBuilderController.getPublicUrl';
import setAIConfig from '@salesforce/apex/FormBuilderController.setAIConfig';
import setDesignConfig from '@salesforce/apex/FormBuilderController.setDesignConfig';
import setIdentityMode from '@salesforce/apex/FormBuilderController.setIdentityMode';
import setGalleryShared from '@salesforce/apex/FormBuilderController.setGalleryShared';
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
    ['checkbox', 'תיבת סימון'], ['checkboxGroup', 'בחירה מרובה'],
    // personal-details field types
    ['firstName', 'שם פרטי'], ['lastName', 'שם משפחה'], ['city', 'עיר (השלמה אוטומטית)'],
    ['street', 'רחוב (השלמה אוטומטית)'], ['houseNumber', 'מספר בית'], ['apartment', 'דירה'], ['age', 'גיל']
];
// One-click "personal details" group inserted into a step.
const PERSONAL_DETAILS_FIELDS = [
    { type: 'firstName', label: 'שם פרטי', required: true, mapTo: '' },
    { type: 'lastName', label: 'שם משפחה', required: true, mapTo: '' },
    { type: 'idNumber', label: 'תעודת זהות', required: true, mapTo: '' },
    { type: 'age', label: 'גיל', required: false, mapTo: '' },
    { type: 'phone', label: 'טלפון', required: true, mapTo: 'phone' },
    { type: 'email', label: 'דוא"ל', required: false, mapTo: 'email' },
    { type: 'city', label: 'עיר', required: true, mapTo: '' },
    { type: 'street', label: 'רחוב', required: true, mapTo: '' },
    { type: 'houseNumber', label: 'מספר בית', required: true, mapTo: '' },
    { type: 'apartment', label: 'דירה', required: false, mapTo: '' }
];
const MAP_OPTIONS = [
    ['', '— ללא מיפוי —'], ['respondentName', 'שם'], ['email', 'אימייל'], ['phone', 'טלפון'], ['subject', 'נושא']
];
const newField = () => ({ type: 'text', label: '', required: false, options: '', mapTo: '', cond: null });
const newStep = () => ({ title: '', fields: [newField()] });
const COND_OPS = [
    ['equals', 'שווה ל'], ['notEquals', 'שונה מ'], ['contains', 'מכיל'],
    ['notEmpty', 'אינו ריק'], ['empty', 'ריק']
];

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
    identityMode = 'Anonymous';
    sharedToGallery = false;
    appearance = defaultAppearance();
    uploadingBg = false;
    uploadingLogo = false;
    uploadingBanner = false;
    steps = [{ title: '', fields: [{ type: 'text', label: '', required: true, options: '', mapTo: 'respondentName' }] }];

    // ---- Drag & drop reordering state (mouse enhancement; buttons are the a11y path) ----
    _dragStep = null;      // index of the step currently being dragged
    _dragOverStep = -1;    // index of the step currently under the pointer (drop indicator)
    _dragFieldS = null;    // step index of the field being dragged
    _dragFieldI = null;    // field index of the field being dragged
    _dragOverField = '';   // "s:i" key of the field currently under the pointer (drop indicator)
    _fieldSeq = 0;         // monotonic id source for stable per-field references (conditions)

    savedExternalId;
    savedUrl;
    savedMsg;
    error;
    existing = [];
    showLivePreview = true; // toggled off/on to remount the live preview after a save

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
        this.ensureIds();
        this.refresh();
    }

    // Assign a stable _id to any field missing one (conditions reference these).
    ensureIds() {
        let changed = false;
        (this.steps || []).forEach((st) => (st.fields || []).forEach((f) => {
            if (f._id == null) { f._id = ++this._fieldSeq; changed = true; }
            if (f.cond === undefined) { f.cond = null; changed = true; }
        }));
        if (changed) this.steps = [...this.steps];
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
        this.identityMode = 'Anonymous';
        this.sharedToGallery = false;
        this.appearance = defaultAppearance();
        this.steps = [newStep()];
        this.ensureIds();
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
            this.identityMode = t.Identity_Mode__c || 'Anonymous';
            this.sharedToGallery = t.Shared_To_Gallery__c === true;
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
        let rawSteps;
        if (Array.isArray(parsed)) rawSteps = [{ title: '', fields: parsed }];
        else if (parsed && Array.isArray(parsed.steps)) rawSteps = parsed.steps;
        else if (parsed && Array.isArray(parsed.fields)) rawSteps = [{ title: '', fields: parsed.fields }];
        else rawSteps = [];
        // Assign a fresh _id per field and remember each saved key -> _id so we can
        // restore conditional rules (which reference the controlling field's key).
        const keyToId = {};
        const model = rawSteps.map((s) => ({
            title: s.title || '',
            fields: (s.fields || []).map((f) => {
                const id = ++this._fieldSeq;
                if (f.key) keyToId[f.key] = id;
                return {
                    _id: id,
                    type: f.type || 'text',
                    label: f.label || '',
                    required: !!f.required,
                    options: (f.options || []).join('\n'),
                    mapTo: f.mapTo || '',
                    _vw: (f.visibleWhen && f.visibleWhen.field) ? f.visibleWhen : null,
                    cond: null
                };
            })
        }));
        // Resolve conditions now that every key is mapped to an _id.
        model.forEach((st) => st.fields.forEach((fl) => {
            if (fl._vw && keyToId[fl._vw.field]) {
                fl.cond = { ctrlId: keyToId[fl._vw.field], op: fl._vw.op || 'equals', value: fl._vw.value || '' };
            }
            delete fl._vw;
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
        const total = this.steps.length;
        // all labelled fields across the whole form — candidates to control a condition
        const allFields = [];
        this.steps.forEach((st) => st.fields.forEach((f) => {
            if (f.label && f.label.trim()) allFields.push({ id: f._id, label: f.label.trim() });
        }));
        return this.steps.map((st, s) => {
            const fieldsLen = st.fields.length;
            return {
                index: s,
                title: st.title,
                label: 'שלב ' + (s + 1),
                canRemove: total > 1,
                isFirst: s === 0,
                isLast: s === total - 1,
                stepClass: 'slds-box slds-box_x-small slds-m-bottom_small slds-theme_shade fb-step'
                    + (this._dragOverStep === s ? ' fb-drop-target' : ''),
                fields: st.fields.map((f, i) => ({
                    s: s,
                    i: i,
                    label: f.label,
                    required: f.required,
                    options: f.options,
                    firstField: i === 0,
                    lastField: i === fieldsLen - 1,
                    fieldClass: 'slds-box slds-box_xx-small slds-m-bottom_x-small slds-theme_default fb-field'
                        + (this._dragOverField === (s + ':' + i) ? ' fb-drop-target' : ''),
                    showOptions: CHOICE.has(f.type),
                    typeOptions: TYPE_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === f.type })),
                    mapOptions: MAP_OPTIONS.map(([v, l]) => ({ value: v, label: l, selected: v === (f.mapTo || '') })),
                    // conditional-visibility rule editor
                    condEnabled: !!f.cond,
                    condCtrl: f.cond ? f.cond.ctrlId : '',
                    condValue: f.cond ? (f.cond.value || '') : '',
                    showCondValue: !!f.cond && f.cond.op !== 'notEmpty' && f.cond.op !== 'empty',
                    ctrlOptions: allFields
                        .filter((c) => c.id !== f._id)
                        .map((c) => ({ value: c.id, label: c.label, selected: !!f.cond && f.cond.ctrlId === c.id })),
                    opOptions: COND_OPS.map(([v, l]) => ({ value: v, label: l, selected: !!f.cond && f.cond.op === v }))
                }))
            };
        });
    }

    addStep() {
        this.steps = [...this.steps, newStep()];
        this.ensureIds();
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
        this.ensureIds();
    }

    // One-click insert of the standard personal-details field group into a step.
    addPersonalDetails(event) {
        const s = Number(event.target.dataset.s);
        const group = PERSONAL_DETAILS_FIELDS.map((f) => ({
            type: f.type, label: f.label, required: !!f.required, options: '', mapTo: f.mapTo || '', cond: null
        }));
        this.steps = this.steps.map((st, idx) => (idx === s ? { ...st, fields: [...st.fields, ...group] } : st));
        this.ensureIds();
    }

    // ---- Conditional-visibility rule editor ----
    toggleCond(event) {
        const s = Number(event.target.dataset.s);
        const i = Number(event.target.dataset.i);
        const on = event.target.checked;
        this.steps = this.steps.map((st, idx) => idx === s
            ? { ...st, fields: st.fields.map((f, fi) => (fi === i
                ? { ...f, cond: on ? { ctrlId: '', op: 'equals', value: '' } : null } : f)) }
            : st);
    }

    handleCond(event) {
        const s = Number(event.target.dataset.s);
        const i = Number(event.target.dataset.i);
        const p = event.target.dataset.p;
        let val = event.target.value;
        if (p === 'ctrlId') val = val === '' ? '' : Number(val);
        this.steps = this.steps.map((st, idx) => idx === s
            ? { ...st, fields: st.fields.map((f, fi) => (fi === i && f.cond
                ? { ...f, cond: { ...f.cond, [p]: val } } : f)) }
            : st);
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

    // ---- Reordering (immutable move helper shared by drag & keyboard) ----
    moveItem(arr, from, to) {
        if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
        const copy = [...arr];
        const [item] = copy.splice(from, 1);
        copy.splice(to, 0, item);
        return copy;
    }

    moveFieldInStep(s, from, to) {
        this.steps = this.steps.map((st, idx) =>
            idx === s ? { ...st, fields: this.moveItem(st.fields, from, to) } : st
        );
    }

    // ---- Keyboard-accessible reordering (required a11y path) ----
    moveStepUp(event) {
        const s = Number(event.currentTarget.dataset.s);
        this.steps = this.moveItem(this.steps, s, s - 1);
    }
    moveStepDown(event) {
        const s = Number(event.currentTarget.dataset.s);
        this.steps = this.moveItem(this.steps, s, s + 1);
    }
    moveFieldUp(event) {
        const s = Number(event.currentTarget.dataset.s);
        const i = Number(event.currentTarget.dataset.i);
        this.moveFieldInStep(s, i, i - 1);
    }
    moveFieldDown(event) {
        const s = Number(event.currentTarget.dataset.s);
        const i = Number(event.currentTarget.dataset.i);
        this.moveFieldInStep(s, i, i + 1);
    }

    // ---- Drag & drop: steps (dragged by their grip handle) ----
    handleStepDragStart(event) {
        this._dragStep = Number(event.currentTarget.dataset.s);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            try { event.dataTransfer.setData('text/plain', String(this._dragStep)); } catch (e) { /* ignore */ }
        }
    }
    handleStepDragOver(event) {
        if (this._dragStep === null) return; // ignore while a field (not a step) is being dragged
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        const s = Number(event.currentTarget.dataset.s);
        if (s !== this._dragOverStep) this._dragOverStep = s;
    }
    handleStepDragLeave(event) {
        if (!event.currentTarget.contains(event.relatedTarget)) this._dragOverStep = -1;
    }
    handleStepDrop(event) {
        if (this._dragStep === null) return;
        event.preventDefault();
        const from = this._dragStep;
        const to = Number(event.currentTarget.dataset.s);
        this._dragOverStep = -1;
        this._dragStep = null;
        if (!isNaN(to) && from !== to) this.steps = this.moveItem(this.steps, from, to);
    }

    // ---- Drag & drop: fields (within a step; dragged by their grip handle) ----
    handleFieldDragStart(event) {
        event.stopPropagation();
        this._dragFieldS = Number(event.currentTarget.dataset.s);
        this._dragFieldI = Number(event.currentTarget.dataset.i);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            try { event.dataTransfer.setData('text/plain', this._dragFieldS + ':' + this._dragFieldI); } catch (e) { /* ignore */ }
        }
    }
    handleFieldDragOver(event) {
        if (this._dragFieldS === null) return;
        const s = Number(event.currentTarget.dataset.s);
        if (s !== this._dragFieldS) return; // within-step reorder only
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        const key = s + ':' + Number(event.currentTarget.dataset.i);
        if (key !== this._dragOverField) this._dragOverField = key;
    }
    handleFieldDragLeave(event) {
        if (!event.currentTarget.contains(event.relatedTarget)) this._dragOverField = '';
    }
    handleFieldDrop(event) {
        if (this._dragFieldS === null) return;
        event.preventDefault();
        event.stopPropagation();
        const fromS = this._dragFieldS;
        const from = this._dragFieldI;
        const s = Number(event.currentTarget.dataset.s);
        const to = Number(event.currentTarget.dataset.i);
        this._dragOverField = '';
        this._dragFieldS = null;
        this._dragFieldI = null;
        if (s === fromS && !isNaN(to) && from !== to) this.moveFieldInStep(s, from, to);
    }

    // Shared cleanup when any drag operation ends (drop or cancel)
    handleDragEnd() {
        this._dragStep = null;
        this._dragOverStep = -1;
        this._dragFieldS = null;
        this._dragFieldI = null;
        this._dragOverField = '';
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
        // Capture the input before the await: LWC nulls event.target after the
        // synchronous dispatch, so touching it in finally would throw.
        const input = event.target;
        const file = (input.files || [])[0];
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
            if (input) input.value = null;
        }
    }

    async handleMediaUpload(event) {
        const input = event.target;
        const file = (input.files || [])[0];
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
            if (input) input.value = null;
        }
    }

    async handleLogoUpload(event) {
        const input = event.target;
        const file = (input.files || [])[0];
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
            if (input) input.value = null;
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
    handleIdentityMode(e) { this.identityMode = e.target.value; }
    handleGalleryShared(e) { this.sharedToGallery = e.target.checked; }
    get identityModeOptions() {
        return [
            ['Anonymous', 'אנונימי (ללא הזדהות)'],
            ['Identified', 'מזוהה — חובה הזדהות ממשלתית'],
            ['Applicant_Choice', 'לבחירת ממלא הטופס']
        ].map(([v, l]) => ({ value: v, label: l, selected: v === this.identityMode }));
    }

    buildSchema() {
        this.ensureIds();
        const seen = {};
        let n = 0;
        // Pass A: compute a stable key for every surviving (labelled) field, and
        // record _id -> key so conditions can reference the controlling field.
        const idToKey = {};
        this.steps.forEach((st) => st.fields
            .filter((f) => f.label && f.label.trim())
            .forEach((f) => {
                n += 1;
                let key = f.label.trim().toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '_').replace(/^_+|_+$/g, '');
                if (!key) key = 'field_' + n;
                while (seen[key]) key = key + '_' + n;
                seen[key] = 1;
                idToKey[f._id] = key;
                f.__key = key;
            }));
        // Pass B: emit the schema, attaching visibleWhen where a valid rule exists.
        const steps = this.steps.map((st) => ({
            title: (st.title || '').trim() || null,
            fields: st.fields
                .filter((f) => f.label && f.label.trim())
                .map((f) => {
                    const out = {
                        key: f.__key,
                        label: f.label.trim(),
                        type: f.type,
                        required: !!f.required,
                        mapTo: f.mapTo || undefined,
                        options: CHOICE.has(f.type)
                            ? String(f.options || '').split('\n').map((x) => x.trim()).filter(Boolean)
                            : undefined
                    };
                    if (f.cond && f.cond.ctrlId && idToKey[f.cond.ctrlId] && idToKey[f.cond.ctrlId] !== f.__key) {
                        out.visibleWhen = { field: idToKey[f.cond.ctrlId], op: f.cond.op || 'equals', value: f.cond.value || '' };
                    }
                    return out;
                })
        }));
        this.steps.forEach((st) => st.fields.forEach((f) => { delete f.__key; }));
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
                try {
                    await setIdentityMode({ recordId: saved.Id, mode: this.identityMode });
                } catch (e) { /* non-fatal */ }
                try {
                    await setGalleryShared({ recordId: saved.Id, shared: this.sharedToGallery });
                } catch (e) { /* non-fatal */ }
            }
            try { this.savedUrl = await getPublicUrl({ externalId: this.savedExternalId }); } catch (e) { /* ignore */ }
            this.savedMsg = this.isEdit ? 'השינויים נשמרו!' : 'הטופס נשמר ופורסם!';
            this.remountPreview();
            this.refresh();
            this.dispatchEvent(new CustomEvent('saved', {
                detail: { externalId: this.savedExternalId, url: this.savedUrl }
            }));
        } catch (e) {
            this.error = (e && e.body && e.body.message) || 'שגיאה בשמירה.';
        }
    }

    // Destroy + recreate the live preview so it re-fetches the just-saved template
    // (the external id is unchanged when editing, so the child won't reload on its own).
    remountPreview() {
        this.showLivePreview = false;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        Promise.resolve().then(() => { this.showLivePreview = true; });
    }

    copyUrl() {
        if (!this.savedUrl) return;
        navigator.clipboard.writeText(this.savedUrl);
    }

    cancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }
}
