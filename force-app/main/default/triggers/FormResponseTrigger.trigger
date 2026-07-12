/**
 * After a Form Response is created, flatten its JSON answers into
 * Form_Answer__c child rows for reporting, route it to the owning department,
 * and spin up any workflow Tasks the form builder defined for the form.
 */
trigger FormResponseTrigger on Form_Response__c (after insert) {
    FormResponseAnswerService.createAnswers(Trigger.new);
    FormRoutingService.route(Trigger.new);
    FormTaskService.createTasks(Trigger.new);
}
