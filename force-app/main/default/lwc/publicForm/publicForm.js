import { LightningElement, api } from 'lwc';
import submitResponse from '@salesforce/apex/FormResponseController.submitResponse';

export default class PublicForm extends LightningElement {
    @api formName = 'טופס רישום לאירוע';
    @api externalId = 'event-registration';

    fullName = '';
    email = '';
    phone = '';
    track = '';
    needsTransport = false;
    pickup = '';

    reference;
    error;
    loading = false;

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
            return;
        }
        if (this.needsTransport && !this.pickup) {
            this.error = 'נא למלא כתובת איסוף.';
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
        } catch (e) {
            this.error = (e && e.body && e.body.message) || 'אירעה שגיאה בשליחה. נסה שוב.';
        } finally {
            this.loading = false;
        }
    }
}
