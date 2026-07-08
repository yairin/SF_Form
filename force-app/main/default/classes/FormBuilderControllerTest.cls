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
    static void adminServiceTypeManagement() {
        Department__c d = new Department__c(Name = 'מחלקת בדיקה', Active__c = true);
        insert d;
        Test.startTest();
        Id stId = FormAdminController.saveServiceType(null, 'שירות חדש', d.Id, 24, true);
        FormAdminController.setServiceTypeActive(stId, false);
        Test.stopTest();
        System.assert(FormAdminController.getServiceTypes().size() >= 1, 'service types listed');
        System.assert(!FormAdminController.getDepartments().isEmpty(), 'departments listed');
        System.assertEquals(false,
            [SELECT Active__c FROM Service_Type__c WHERE Id = :stId].Active__c, 'deactivated');
    }

    @isTest
    static void resultsAggregationAndInsights() {
        String schema = '[{"key":"track","label":"מסלול","type":"select","options":["בוקר","ערב"]},'
            + '{"key":"num","label":"מספר משתתפים","type":"number"},'
            + '{"key":"note","label":"הערה","type":"textarea"}]';
        FormBuilderController.saveForm(null, 'טופס תוצאות', '', schema, 'res-x', null);
        FormResponseController.submitResponse('t', 'res-x', '{"track":"בוקר","num":"5","note":"א"}', null, null, null, 'x');
        FormResponseController.submitResponse('t', 'res-x', '{"track":"בוקר","num":"3"}', null, null, null, 'x');
        // a second, empty form to cover the no-responses path
        FormBuilderController.saveForm(null, 'טופס ריק', '', schema, 'res-empty', null);

        Test.startTest();
        FormResultsController.Results r = FormResultsController.getResults('res-x');
        FormResultsController.Insights insights = FormResultsController.generateAiInsights('res-x');
        FormResultsController.Results empty = FormResultsController.getResults('res-empty');
        FormResultsController.Insights emptyInsights = FormResultsController.generateAiInsights('res-empty');
        FormResultsController.Results missing = FormResultsController.getResults('no-such-form');
        // reload to confirm the insights were persisted on the template
        FormResultsController.Results reloaded = FormResultsController.getResults('res-x');
        Test.stopTest();

        System.assertEquals(2, r.total, 'two submissions aggregated');
        System.assertEquals(3, r.fields.size(), 'three fields analyzed');
        System.assert(r.summary.contains('2'), 'summary mentions the count');
        System.assert(String.isNotBlank(insights.text), 'insights returned (rule-based fallback with no engine)');
        System.assertEquals(2, insights.count, 'insights record count captured');
        System.assertNotEquals(null, insights.generatedAt, 'generation timestamp set');
        System.assert(String.isNotBlank(reloaded.insights), 'insights persisted and returned on later visits');
        System.assertEquals(2, reloaded.insightsCount, 'persisted record count returned');
        System.assertNotEquals(null, reloaded.insightsGeneratedAt, 'persisted timestamp returned');
        System.assertEquals(0, empty.total, 'empty form has no submissions');
        System.assert(String.isNotBlank(emptyInsights.text), 'empty insights handled');
        System.assertEquals(0, missing.total, 'missing form returns zero');
    }

    @isTest
    static void recordLevelDrilldown() {
        String schema = '[{"key":"full_name","label":"שם","type":"text"},'
            + '{"key":"note","label":"הערה","type":"textarea"}]';
        FormBuilderController.saveForm(null, 'טופס רשומה', '', schema, 'rec-x', null);
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס רשומה', 'rec-x', '{"full_name":"פלוני","note":"בדיקה"}', 'פלוני', 'a@b.com', null, 'x');

        // an uploaded file
        FormFileService.FileInput fi = new FormFileService.FileInput();
        fi.name = 'doc.txt';
        fi.base64 = EncodingUtil.base64Encode(Blob.valueOf('תוכן הקובץ'));
        FormFileService.attachFiles(r.id, new List<FormFileService.FileInput>{ fi });

        // an AI interaction with the applicant
        insert new Form_Interaction__c(Form_Response__c = r.id, Direction__c = 'System',
            Interaction_Type__c = 'AI_Review', Message__c = 'בדיקת AI ראשונית', Occurred_At__c = System.now());

        Test.startTest();
        List<FormResultsController.ResponseRow> rows = FormResultsController.listResponses('rec-x');
        FormResultsController.ResponseDetail d = FormResultsController.getResponseDetail(r.id);
        Test.stopTest();

        System.assert(!rows.isEmpty(), 'individual responses listed');
        System.assertEquals('פלוני', d.respondentName, 'respondent returned');
        System.assert(!d.fields.isEmpty(), 'field values returned');
        System.assertEquals(1, d.files.size(), 'uploaded file listed');
        System.assert(d.files[0].downloadUrl.contains('/download/'), 'file download link built');
        System.assertEquals(1, d.interactions.size(), 'AI interaction thread listed');
        System.assertEquals('בדיקת AI', d.interactions[0].interactionType, 'interaction type shown in Hebrew');
        System.assertEquals('מערכת', d.interactions[0].direction, 'direction shown in Hebrew');
    }

    @isTest
    static void aiReviewConfigPersists() {
        String schema = '[{"key":"a","label":"שדה","type":"text","required":true}]';
        Form_Template__c t = FormBuilderController.saveForm(null, 'טופס AI', 'תיאור', schema, 'ai-cfg', null);
        Test.startTest();
        FormBuilderController.setAIConfig(t.Id, true, 'ודא שצורף צילום תעודת זהות קריא.', true, true);
        Test.stopTest();
        Form_Template__c fetched = FormBuilderController.getTemplate(t.Id);
        System.assertEquals(true, fetched.AI_Review_Enabled__c, 'AI review enabled persisted');
        System.assert(fetched.AI_Review_Instructions__c.contains('תעודת זהות'), 'instructions persisted');
        System.assertEquals(true, fetched.AI_Check_Attachments__c, 'check attachments persisted');
        System.assertEquals(true, fetched.AI_Contact_Applicant__c, 'contact applicant persisted');
    }

    @isTest
    static void aiSettingsSaveAndRead() {
        Test.startTest();
        FormSettingsController.saveSettings('External', 'https://api.example.com', 'claude-opus-4-8', 'secret-key');
        Test.stopTest();
        FormSettingsController.Settings s = FormSettingsController.getSettings();
        System.assertEquals('External', s.engine, 'engine persisted');
        System.assertEquals('https://api.example.com', s.endpoint, 'endpoint persisted');
        System.assertEquals(true, s.hasApiKey, 'key stored flag is true (key itself is not returned)');

        // default when unset
        FormSettingsController.saveSettings('Agentforce', null, null, null);
        System.assertEquals('Agentforce', FormSettingsController.getSettings().engine);
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
