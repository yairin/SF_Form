@isTest
private class AddressLookupControllerTest {

    private class CkanMock implements HttpCalloutMock {
        String field;
        CkanMock(String f) { this.field = f; }
        public HttpResponse respond(HttpRequest req) {
            // two records + a duplicate to exercise dedupe
            String body = '{"success":true,"result":{"records":['
                + '{"' + field + '":"תל אביב - יפו"},'
                + '{"' + field + '":"תל אביב - יפו"},'
                + '{"' + field + '":"תל מונד"}'
                + ']}}';
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody(body);
            res.setHeader('Content-Type', 'application/json');
            return res;
        }
    }

    private class ErrorMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(500);
            res.setBody('boom');
            return res;
        }
    }

    @isTest
    static void bundledCitiesReturnedInstantly() {
        // A common prefix resolves from the bundled list with no callout at all.
        Test.startTest();
        List<String> cities = AddressLookupController.searchCities('תל');
        Test.stopTest();
        System.assert(!cities.isEmpty(), 'bundled cities returned for a common prefix');
        System.assert(cities.contains('תל אביב - יפו'), 'includes the expected city');
        for (String c : cities) {
            System.assert(c.startsWith('תל'), 'every result matches the prefix: ' + c);
        }
    }

    @isTest
    static void apiFallbackForUnbundledPrefix() {
        // A prefix not covered by the bundled list falls back to the live dataset.
        Test.setMock(HttpCalloutMock.class, new CkanMock('שם_ישוב'));
        Test.startTest();
        List<String> cities = AddressLookupController.searchCities('זז');
        Test.stopTest();
        System.assertEquals(2, cities.size(), 'API fallback used and duplicates removed');
        System.assert(cities.contains('תל אביב - יפו') && cities.contains('תל מונד'), 'API cities returned');
    }

    @isTest
    static void streetsFilteredByCity() {
        Test.setMock(HttpCalloutMock.class, new CkanMock('שם_רחוב'));
        Test.startTest();
        List<String> streets = AddressLookupController.searchStreets('תל אביב - יפו', 'הרצ');
        Test.stopTest();
        System.assert(!streets.isEmpty(), 'streets returned for the selected city');
    }

    @isTest
    static void shortPrefixReturnsEmpty() {
        List<String> r1 = AddressLookupController.searchCities('א');
        List<String> r2 = AddressLookupController.searchStreets('עיר', 'א');
        System.assertEquals(0, r1.size(), 'city prefix < 2 chars is ignored');
        System.assertEquals(0, r2.size(), 'street prefix < 2 chars is ignored');
    }

    @isTest
    static void httpErrorIsSwallowed() {
        Test.setMock(HttpCalloutMock.class, new ErrorMock());
        Test.startTest();
        // Unbundled prefix so the callout path (not the bundled list) is exercised.
        List<String> cities = AddressLookupController.searchCities('זז');
        Test.stopTest();
        System.assertEquals(0, cities.size(), 'non-200 yields empty list, never throws');
    }
}
