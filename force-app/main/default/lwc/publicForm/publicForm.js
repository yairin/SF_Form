import { LightningElement, api } from 'lwc';
import submitResponse from '@salesforce/apex/FormResponseController.submitResponse';

export default class PublicForm extends LightningElement {
    @api formName = 'טופס רישום לאירוע';
    @api externalId = 'masham-demo';

    fullName = '';
    email = '';
    phone = '';
    track = '';
    needsTransport = false;
    pickup = '';

    reference;
    error;
    loading = false;
    _pendingFocus = null; // 'error' | 'success' -> handled in renderedCallback

    get ariaBusy() { return this.loading ? 'true' : 'false'; }

    // Move focus to the error region (on validation failure) or the success
    // heading (on submit) so screen-reader users are taken to the update.
    renderedCallback() {
        if (!this._pendingFocus) return;
        const target = this._pendingFocus;
        this._pendingFocus = null;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        requestAnimationFrame(() => {
            const sel = target === 'success' ? '.form-success-heading' : '.form-error';
            const el = this.template.querySelector(sel);
            if (el && typeof el.focus === 'function') el.focus();
        });
    }

    trackOptions = [
        { label: 'מסלול בוקר', value: 'מסלול בוקר' },
        { label: 'מסלול ערב', value: 'מסלול ערב' },
        { label: 'מקוון', value: 'מקוון' }
    ];

    handleChange(event) {
        const { name, type } = event.target;
        this[name] = type === 'checkbox' ? event.target.checked : event.target.value;
    }

    get showPickup() {
        return this.needsTransport;
    }

    async handleSubmit() {
        this.error = undefined;
        if (!this.fullName || !this.email) {
            this.error = 'נא למלא שם מלא ואימייל.';
            this._pendingFocus = 'error';
            return;
        }
        if (this.needsTransport && !this.pickup) {
            this.error = 'נא למלא כתובת איסוף.';
            this._pendingFocus = 'error';
            return;
        }
        this.loading = true;
        const payload = {
            full_name: this.fullName,
            email: this.email,
            phone: this.phone,
            track: this.track,
            needs_transport: this.needsTransport,
            pickup: this.pickup
        };
        try {
            const res = await submitResponse({
                formName: this.formName,
                externalId: this.externalId,
                payloadJson: JSON.stringify(payload),
                respondentName: this.fullName,
                email: this.email,
                phone: this.phone,
                subject: this.formName
            });
            this.reference = res.name;
            this._pendingFocus = 'success';
        } catch (e) {
            this.error = (e && e.body && e.body.message) || 'אירעה שגיאה בשליחה. נסה שוב.';
            this._pendingFocus = 'error';
        } finally {
            this.loading = false;
        }
    }
}
