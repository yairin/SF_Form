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
        if (this.isExternal && !this.endpoint) {
            this.toast('חסר endpoint', 'למנוע חיצוני נדרש endpoint.', 'warning');
            return;
        }
        if (this.isExternal && !this.hasApiKey && !this.apiKey) {
            this.toast('חסר מפתח', 'למנוע חיצוני נדרש מפתח API.', 'warning');
            return;
        }
        try {
            await saveSettings({
                engine: this.engine,
                endpoint: this.endpoint,
                model: this.model,
                apiKey: this.apiKey
            });
            this.apiKey = '';
            this.toast('נשמר', 'ההגדרות נשמרו בהצלחה.', 'success');
            this.load();
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    msg(e) {
        return (e && e.body && e.body.message) || 'אירעה שגיאה.';
    }
}
