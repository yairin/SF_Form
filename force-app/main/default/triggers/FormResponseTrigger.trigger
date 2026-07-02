/**
 * After a Form Response is created, flatten its JSON answers into
 * Form_Answer__c child rows for reporting.
 */
trigger FormResponseTrigger on Form_Response__c (after insert) {
    FormResponseAnswerService.createAnswers(Trigger.new);
    FormRoutingService.route(Trigger.new);
}
