@isTest
private class TaxAuthorityControllerTest {

    @isTest
    static void pendingWhenApiNotConnected() {
        Test.startTest();
        TaxAuthorityController.IncomeData d = TaxAuthorityController.getIncomeData('000000018');
        Test.stopTest();

        System.assertEquals(false, d.available, 'API not yet connected → not available');
        System.assert(d.message != null && d.message.contains('רשות המסים'),
            'pending message references the Tax Authority');
        System.assertEquals(0, d.form106.size(), 'no income rows while pending');
    }

    @isTest
    static void rejectsBlankId() {
        TaxAuthorityController.IncomeData d = TaxAuthorityController.getIncomeData('   ');
        System.assertEquals(false, d.available, 'blank id → not available');
        System.assert(d.message != null && d.message.contains('מספר זהות'),
            'message explains the id is required');
        System.assertEquals(0, d.form106.size());
    }

    @isTest
    static void rejectsNonNumericId() {
        TaxAuthorityController.IncomeData d = TaxAuthorityController.getIncomeData('12ab');
        System.assertEquals(false, d.available, 'non-numeric id is rejected');
    }

    @isTest
    static void rejectsNullId() {
        TaxAuthorityController.IncomeData d = TaxAuthorityController.getIncomeData(null);
        System.assertEquals(false, d.available, 'null id is rejected without error');
    }
}
