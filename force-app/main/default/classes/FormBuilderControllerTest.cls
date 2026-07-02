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
}
