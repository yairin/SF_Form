@isTest
private class FormBuilderControllerTest {

    @isTest
    static void saveListAndRender() {
        String schema = '[{"key":"full_name","label":"שם מלא","type":"text","required":true,"mapTo":"respondentName"}]';

        Test.startTest();
        Form_Template__c created = FormBuilderController.saveForm(
            null, 'רישום לאירוע', 'טופס בדיקה', schema, 'event-x', null);
        // update path
        FormBuilderController.saveForm(created.Id, 'רישום מעודכן', 'תיאור 2', schema, 'event-x', null);
        FormBuilderController.listServiceTypes();
        Test.stopTest();

        System.assertNotEquals(null, created.Id, 'template created');
        System.assert(FormBuilderController.listForms().size() >= 1, 'list returns templates');

        Form_Template__c rendered = FormRenderController.getForm('event-x');
        System.assertEquals('רישום מעודכן', rendered.Name, 'update persisted and rendered');
        System.assertEquals(schema, rendered.Schema_JSON__c);
    }

    @isTest
    static void getFormThrowsWhenMissing() {
        Boolean threw = false;
        try {
            FormRenderController.getForm('does-not-exist');
        } catch (Exception e) {
            threw = true;
        }
        System.assertEquals(true, threw, 'missing form throws');
    }

    @isTest
    static void detailedListEditCloneToggleDelete() {
        String schema = '[{"key":"a","label":"שדה","type":"text","required":true}]';
        Form_Template__c t = FormBuilderController.saveForm(
            null, 'טופס לניהול', 'תיאור', schema, 'manage-x', null);

        Test.startTest();
        // detailed list + public URL
        List<FormBuilderController.TemplateInfo> rows = FormBuilderController.listFormsDetailed();
        System.assert(rows.size() >= 1, 'detailed list returns rows');

        // getTemplate for editing
        Form_Template__c fetched = FormBuilderController.getTemplate(t.Id);
        System.assertEquals('manage-x', fetched.External_Id__c, 'template fetched for edit');

        // clone -> inactive copy with a fresh external id
        Form_Template__c copy = FormBuilderController.cloneForm(t.Id);
        System.assertEquals(false, copy.Active__c, 'clone starts inactive');
        System.assertNotEquals(t.External_Id__c, copy.External_Id__c, 'clone gets a new external id');

        // activate the copy, then deactivate the original
        FormBuilderController.setActive(copy.Id, true);
        FormBuilderController.setActive(t.Id, false);
        System.assertEquals(false,
            [SELECT Active__c FROM Form_Template__c WHERE Id = :t.Id].Active__c, 'original deactivated');

        // delete the original
        FormBuilderController.deleteForm(t.Id);
        Test.stopTest();

        System.assertEquals(0,
            [SELECT COUNT() FROM Form_Template__c WHERE Id = :t.Id], 'original deleted');
    }

    @isTest
    static void publicUrlBuilds() {
        // getPublicUrl uses the Form_Public_Site_Base_Url custom label; result may be
        // null if the label has no value, but the call must not error.
        String url = FormBuilderController.getPublicUrl('some-form');
        if (url != null) {
            System.assert(url.contains('formId=some-form'), 'url appends the form external id');
        }
        System.assertEquals(null, FormBuilderController.getPublicUrl(null), 'blank id yields null');
    }
}
