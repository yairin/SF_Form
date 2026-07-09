@isTest
private class ApprovalDecisionServiceTest {

    @isTest
    static void decisionTableBranches() {
        // >= 90% & docs -> auto approve
        ApprovalDecisionService.Decision auto = ApprovalDecisionService.evaluate(95, true);
        System.assertEquals('AUTO_APPROVE', auto.outcome, '95% with docs -> auto approve');
        System.assertEquals('Approved', auto.aiStatus, 'auto approve maps to Approved');

        // 60-89% & docs -> exceptions committee
        ApprovalDecisionService.Decision comm = ApprovalDecisionService.evaluate(75, true);
        System.assertEquals('EXCEPTIONS_COMMITTEE', comm.outcome, '75% with docs -> committee');

        // < 60% & docs -> manual review
        ApprovalDecisionService.Decision manual = ApprovalDecisionService.evaluate(40, true);
        System.assertEquals('MANUAL_REVIEW', manual.outcome, '40% with docs -> manual review');

        // docs incomplete -> needs info regardless of pct
        ApprovalDecisionService.Decision needs = ApprovalDecisionService.evaluate(99, false);
        System.assertEquals('NEEDS_INFO', needs.outcome, 'missing docs -> needs info');
        System.assertEquals('Needs_Info', needs.aiStatus, 'needs info maps to Needs_Info');

        // no numeric pct but complete -> manual review fallback
        ApprovalDecisionService.Decision noPct = ApprovalDecisionService.evaluate(null, true);
        System.assertEquals('MANUAL_REVIEW', noPct.outcome, 'no pct -> manual review');
    }

    @isTest
    static void evaluateForResponseReadsJson() {
        Form_Response__c r = new Form_Response__c(
            Form_External_Id__c = 'dec-x',
            Response_Data__c = '{"disabilityPct":92,"firstName":"פלוני"}'
        );
        insert r;

        Test.startTest();
        ApprovalDecisionService.Decision d = ApprovalDecisionService.evaluateForResponse(r.Id, 'disabilityPct', true);
        Test.stopTest();

        System.assertEquals('AUTO_APPROVE', d.outcome, '92% from JSON -> auto approve');
        System.assert(d.reason.contains('92'), 'reason cites the percentage for audit');
    }
}
