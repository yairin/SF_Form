/**
 * After a Form Response is created, flatten its JSON answers into
 * Form_Answer__c child rows for reporting, route it to the owning department,
 * spin up any workflow Tasks the form builder defined for the form, and (when the
 * form opts in) create/update a Person Account from the submission.
 */
trigger FormResponseTrigger on Form_Response__c (after insert) {
    FormResponseAnswerService.createAnswers(Trigger.new);
    FormRoutingService.route(Trigger.new);
    FormTaskService.createTasks(Trigger.new);
    PersonAccountService.syncFromResponses(Trigger.new);
}
