import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getSettings from '@salesforce/apex/FormSettingsController.getSettings';
import saveSettings from '@salesforce/apex/FormSettingsController.saveSettings';

const ENGINE_OPTIONS = [
    { label: 'Agentforce (מנוע נייטיב)', value: 'Agentforce' },
    { label: 'מנוע חיצוני (LLM דרך API)', value: 'External' }
];

export default class FormSettings extends LightningElement {
    engineOptions = ENGINE_OPTIONS;
    engine = 'Agentforce';
    endpoint = '';
    model = '';
    apiKey = '';
    hasApiKey = false;
    saving = false;
    statusMessage = '';
    errorMessage = '';

    connectedCallback() {
        this.load();
    }

    async load() {
        try {
            const s = await getSettings();
            this.engine = s.engine || 'Agentforce';
            this.endpoint = s.endpoint || '';
            this.model = s.model || '';
            this.hasApiKey = !!s.hasApiKey;
        } catch (e) {
            this.errorMessage = this.msg(e);
            this.toast('שגיאה', this.msg(e), 'error');
        }
    }

    get isExternal() { return this.engine === 'External'; }
    get apiKeyPlaceholder() {
        return this.hasApiKey ? 'מפתח שמור — השאר ריק כדי לא לשנות' : 'הזן מפתח API';
    }

    handleEngine(e) { this.engine = e.detail.value; }
    handleEndpoint(e) { this.endpoint = e.target.value; }
    handleModel(e) { this.model = e.target.value; }
    handleApiKey(e) { this.apiKey = e.target.value; }

    async save() {
        this.errorMessage = '';
        if (this.isExternal && !this.endpoint) {
            this.errorMessage = 'למנוע חיצוני נדרש endpoint.';
            this.toast('חסר endpoint', 'למנוע חיצוני נדרש endpoint.', 'warning');
            return;
        }
        if (this.isExternal && !this.hasApiKey && !this.apiKey) {
            this.errorMessage = 'למנוע חיצוני נדרש מפתח API.';
            this.toast('חסר מפתח', 'למנוע חיצוני נדרש מפתח API.', 'warning');
            return;
        }
        this.saving = true;
        this.statusMessage = 'שומר הגדרות…';
        try {
            await saveSettings({
                engine: this.engine,
                endpoint: this.endpoint,
                model: this.model,
                apiKey: this.apiKey
            });
            this.apiKey = '';
            this.statusMessage = 'ההגדרות נשמרו בהצלחה';
            this.toast('נשמר', 'ההגדרות נשמרו בהצלחה.', 'success');
            this.load();
        } catch (e) {
            this.statusMessage = '';
            this.errorMessage = this.msg(e);
            this.toast('שגיאה', this.msg(e), 'error');
        } finally {
            this.saving = false;
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    msg(e) {
        return (e && e.body && e.body.message) || 'אירעה שגיאה.';
    }
}
