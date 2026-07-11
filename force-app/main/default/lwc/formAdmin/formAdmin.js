import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getServiceTypes from '@salesforce/apex/FormAdminController.getServiceTypes';
import getDepartments from '@salesforce/apex/FormAdminController.getDepartments';
import saveServiceType from '@salesforce/apex/FormAdminController.saveServiceType';
import setServiceTypeActive from '@salesforce/apex/FormAdminController.setServiceTypeActive';

const COLUMNS = [
    { label: 'סוג שירות', fieldName: 'name' },
    { label: 'מחלקה', fieldName: 'department' },
    { label: 'שעות SLA', fieldName: 'slaHours', type: 'number', initialWidth: 110 },
    { label: 'סטטוס', fieldName: 'activeLabel', initialWidth: 100 },
    {
        type: 'action',
        typeAttributes: {
            rowActions: (row, done) => done([
                { label: 'עריכה', name: 'edit' },
                { label: row.active ? 'השבתה' : 'הפעלה', name: 'toggle' }
            ])
        }
    }
];

export default class FormAdmin extends LightningElement {
    columns = COLUMNS;
    rows = [];
    deptOptions = [];

    editId = null;
    name = '';
    departmentId = '';
    slaHours = 48;
    active = true;

    connectedCallback() {
        this.load();
    }

    async load() {
        try {
            this.rows = await getServiceTypes();
            const depts = await getDepartments();
            this.deptOptions = depts.map((d) => ({ label: d.Name, value: d.Id }));
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        }
    }

    get formTitle() { return this.editId ? 'עריכת סוג שירות' : 'סוג שירות חדש'; }

    handleName(e) { this.name = e.target.value; }
    handleDept(e) { this.departmentId = e.detail.value; }
    handleSla(e) { this.slaHours = e.target.value; }
    handleActive(e) { this.active = e.target.checked; }

    resetForm() {
        this.editId = null; this.name = ''; this.departmentId = ''; this.slaHours = 48; this.active = true;
    }

    async save() {
        if (!this.name || !this.name.trim()) { this.toast('חסר שם', 'נא להזין שם סוג שירות.', 'warning'); return; }
        try {
            await saveServiceType({
                recordId: this.editId,
                name: this.name.trim(),
                departmentId: this.departmentId || null,
                slaHours: this.slaHours ? parseFloat(this.slaHours) : null,
                active: this.active
            });
            this.toast('נשמר', 'סוג השירות נשמר.', 'success');
            this.resetForm();
            this.load();
        } catch (e) {
            this.toast('שגיאה', this.msg(e), 'error');
        }
    }

    async handleRowAction(event) {
        const a = event.detail.action.name;
        const row = event.detail.row;
        if (a === 'edit') {
            this.editId = row.id;
            this.name = row.name;
            this.departmentId = row.departmentId;
            this.slaHours = row.slaHours;
            this.active = row.active;
        } else if (a === 'toggle') {
            try {
                await setServiceTypeActive({ recordId: row.id, active: !row.active });
                this.toast('בוצע', row.active ? 'הושבת.' : 'הופעל.', 'success');
                this.load();
            } catch (e) {
                this.toast('שגיאה', this.msg(e), 'error');
            }
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
    msg(e) { return (e && e.body && e.body.message) || 'אירעה שגיאה.'; }
}
