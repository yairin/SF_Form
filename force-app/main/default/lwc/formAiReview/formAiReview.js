import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getReview from '@salesforce/apex/FormAIReviewService.getReview';
import runReview from '@salesforce/apex/FormAIReviewService.runReview';
import requestCompletion from '@salesforce/apex/FormAIReviewService.requestCompletion';

export default class FormAiReview extends LightningElement {
    @api recordId;
    status;
    findings;
    reviewedAt;
    email;
    updateRequested = false;
    loading = false;

    connectedCallback() {
        this.load();
    }

    async load() {
        try {
            const info = await getReview({ responseId: this.recordId });
            this.status = info.status;
            this.findings = info.findings;
            this.reviewedAt = info.reviewedAt;
            this.email = info.email;
            this.updateRequested = !!info.updateRequested;
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        }
    }

    get statusLabel() {
        return {
            Approved: 'אושר',
            Needs_Info: 'נדרשת השלמה',
            Error: 'שגיאה',
            Pending: 'בהמתנה'
        }[this.status] || 'טרם נבדק';
    }
    get statusClass() {
        if (this.status === 'Approved') return 'slds-text-color_success slds-text-title_bold';
        if (this.status === 'Needs_Info') return 'slds-text-color_error slds-text-title_bold';
        return 'slds-text-title_bold';
    }
    get canRequest() { return this.status === 'Needs_Info' && this.email; }
    get noEmail() { return !this.email; }

    async runNow() {
        this.loading = true;
        try {
            await runReview({ responseId: this.recordId });
            await this.load();
            this.toast('הבדיקה הושלמה', 'סטטוס: ' + this.statusLabel, 'success');
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        } finally {
            this.loading = false;
        }
    }

    async ask() {
        this.loading = true;
        try {
            await requestCompletion({ responseId: this.recordId });
            await this.load();
            this.toast('נשלח', 'בקשת השלמה נשלחה לפונה במייל.', 'success');
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        } finally {
            this.loading = false;
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
    msg(e) {
        return (e && e.body && e.body.message) || 'אירעה שגיאה.';
    }
}
