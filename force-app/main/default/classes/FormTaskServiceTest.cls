@isTest
private class FormTaskServiceTest {

    @isTest
    static void createsTasksFromFormConfig() {
        String schema = '[{"key":"full_name","label":"שם","type":"text","required":true,"mapTo":"respondentName"}]';
        Form_Template__c t = FormBuilderController.saveForm(
            null, 'טופס עם משימות', '', schema, 'tasks-x', null);

        String tasksJson = JSON.serialize(new List<Object>{
            new Map<String, Object>{ 'subject' => 'אימות מסמכים', 'priority' => 'High',
                                     'offsetDays' => 2, 'description' => 'בדיקת המסמכים' },
            new Map<String, Object>{ 'subject' => 'שליחת מכתב תשובה', 'priority' => 'Normal',
                                     'offsetDays' => 7, 'description' => '' },
            new Map<String, Object>{ 'subject' => '', 'priority' => 'Low' } // skipped (no subject)
        });
        FormBuilderController.setDesignConfig(t.Id, tasksJson, null);

        Test.startTest();
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס עם משימות', 'tasks-x', '{"full_name":"פלוני"}', 'פלוני', null, null, 'x');
        Test.stopTest();

        List<Task> tasks = [SELECT Subject, Priority, ActivityDate, WhatId FROM Task WHERE WhatId = :r.id ORDER BY ActivityDate];
        System.assertEquals(2, tasks.size(), 'two tasks created (blank-subject entry skipped)');
        System.assertEquals('אימות מסמכים', tasks[0].Subject);
        System.assertEquals('High', tasks[0].Priority);
        System.assertEquals(Date.today().addDays(2), tasks[0].ActivityDate, 'offset applied');
        System.assertEquals('שליחת מכתב תשובה', tasks[1].Subject);
    }

    @isTest
    static void noTasksWhenUnconfigured() {
        String schema = '[{"key":"a","label":"שדה","type":"text"}]';
        FormBuilderController.saveForm(null, 'טופס ללא משימות', '', schema, 'notasks-x', null);
        Test.startTest();
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס ללא משימות', 'notasks-x', '{"a":"x"}', null, null, null, 'x');
        Test.stopTest();
        System.assertEquals(0, [SELECT COUNT() FROM Task WHERE WhatId = :r.id], 'no tasks without config');
    }

    @isTest
    static void malformedConfigIsIgnored() {
        String schema = '[{"key":"a","label":"שדה","type":"text"}]';
        Form_Template__c t = FormBuilderController.saveForm(null, 'טופס פגום', '', schema, 'badtasks-x', null);
        FormBuilderController.setDesignConfig(t.Id, 'this is not json', null);
        Test.startTest();
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס פגום', 'badtasks-x', '{"a":"x"}', null, null, null, 'x');
        Test.stopTest();
        System.assertEquals(0, [SELECT COUNT() FROM Task WHERE WhatId = :r.id], 'malformed config creates no tasks and does not throw');
    }
}
