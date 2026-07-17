@isTest
private class FormValidationServiceTest {

    private static String schema() {
        // one field per constrained type + a couple of free-text ones
        return JSON.serialize(new Map<String, Object>{
            'steps' => new List<Object>{
                new Map<String, Object>{ 'fields' => new List<Object>{
                    new Map<String, Object>{ 'key' => 'fn', 'label' => 'שם', 'type' => 'firstName', 'required' => true },
                    new Map<String, Object>{ 'key' => 'em', 'label' => 'אימייל', 'type' => 'email', 'required' => false },
                    new Map<String, Object>{ 'key' => 'ph', 'label' => 'טלפון', 'type' => 'phone', 'required' => false },
                    new Map<String, Object>{ 'key' => 'num', 'label' => 'מספר', 'type' => 'number', 'required' => false },
                    new Map<String, Object>{ 'key' => 'age', 'label' => 'גיל', 'type' => 'age', 'required' => false },
                    new Map<String, Object>{ 'key' => 'id', 'label' => 'ת"ז', 'type' => 'idNumber', 'required' => false },
                    new Map<String, Object>{ 'key' => 'dt', 'label' => 'תאריך', 'type' => 'date', 'required' => false }
                } }
            }
        });
    }

    @isTest
    static void validPayloadHasNoErrors() {
        Map<String, Object> v = new Map<String, Object>{
            'fn' => 'ישראל', 'em' => 'a@b.co.il', 'ph' => '050-1234567',
            'num' => '42', 'age' => '30', 'id' => '000000018', 'dt' => '2026-01-15'
        };
        System.assertEquals(0, FormValidationService.validate(schema(), v).size(), 'valid payload passes');
    }

    @isTest
    static void requiredMissingIsCaught() {
        List<String> errs = FormValidationService.validate(schema(), new Map<String, Object>{ 'em' => 'a@b.com' });
        System.assert(errs.size() >= 1, 'missing required firstName reported');
        System.assert(errs[0].contains('שדה חובה'), 'required message');
    }

    @isTest
    static void perTypeFormatErrors() {
        Map<String, Object> bad = new Map<String, Object>{
            'fn' => 'ישראל',
            'em' => 'not-an-email',
            'ph' => '123',
            'num' => 'abc',
            'age' => '200',
            'id' => '123456789',
            'dt' => 'לא-תאריך'
        };
        List<String> errs = FormValidationService.validate(schema(), bad);
        String joined = String.join(errs, ' | ');
        System.assert(joined.contains('אימייל'), 'email format error: ' + joined);
        System.assert(joined.contains('טלפון'), 'phone error');
        System.assert(joined.contains('מספרי'), 'number error');
        System.assert(joined.contains('גיל'), 'age range error');
        System.assert(joined.contains('תעודת זהות'), 'id checksum error');
        System.assert(joined.contains('תאריך'), 'date error');
    }

    @isTest
    static void ageBoundariesAndIdChecksum() {
        System.assertEquals(0,
            FormValidationService.validate(schema(), new Map<String, Object>{ 'fn' => 'x', 'age' => '0' }).size(),
            'age 0 valid');
        System.assertEquals(0,
            FormValidationService.validate(schema(), new Map<String, Object>{ 'fn' => 'x', 'age' => '120' }).size(),
            'age 120 valid');
        System.assertEquals(1,
            FormValidationService.validate(schema(), new Map<String, Object>{ 'fn' => 'x', 'age' => '121' }).size(),
            'age 121 invalid');
        System.assertEquals(true, FormValidationService.isValidIsraeliId('000000018'), 'valid IL id');
        System.assertEquals(false, FormValidationService.isValidIsraeliId('123456789'), 'invalid IL id');
    }

    @isTest
    static void emptyOptionalAndMalformedSchema() {
        // optional empty fields don't error
        System.assertEquals(0,
            FormValidationService.validate(schema(), new Map<String, Object>{ 'fn' => 'x' }).size(),
            'empty optionals pass');
        // malformed schema -> no fields -> no errors (never throws)
        System.assertEquals(0, FormValidationService.validate('not json', new Map<String, Object>()).size(), 'malformed schema safe');
    }
}
