/**
 * Optional, config-driven sync of a Form Response into a Person Account, mirroring
 * the reference flow where a submission produces/updates a person record (with a
 * native address map). Fully additive and defensive:
 *   - Runs only for templates with Create_Person_Account__c = true.
 *   - 100% dynamic (Schema describe + SObject.put by API name) so it compiles and
 *     runs even when Person Accounts is NOT enabled in the org.
 *   - Never throws: any failure is swallowed (debug-logged) so the Form Response
 *     insert and all other automation are unaffected.
 */
public without sharing class PersonAccountService {

    // Default form-field-TYPE -> Account field API name. Overridable per template
    // via Person_Account_Map_JSON__c ("map": { "<fieldKey>": "<AccountField>" }).
    private static final Map<String, String> DEFAULT_TYPE_MAP = new Map<String, String>{
        'firstName' => 'FirstName',
        'lastName'  => 'LastName',
        'email'     => 'PersonEmail',
        'phone'     => 'PersonMobilePhone',
        'city'      => 'PersonMailingCity',
        'street'    => 'PersonMailingStreet'
    };

    public static void syncFromResponses(List<Form_Response__c> responses) {
        try {
            doSync(responses);
        } catch (Exception e) {
            System.debug('PERSONACCT|sync aborted: ' + e.getMessage());
        }
    }

    private static void doSync(List<Form_Response__c> responses) {
        Set<String> extIds = new Set<String>();
        for (Form_Response__c r : responses) {
            if (String.isNotBlank(r.Form_External_Id__c)) extIds.add(r.Form_External_Id__c);
        }
        if (extIds.isEmpty()) return;

        Map<String, Form_Template__c> tplByExt = new Map<String, Form_Template__c>();
        for (Form_Template__c t : [
            SELECT External_Id__c, Schema_JSON__c, Create_Person_Account__c, Person_Account_Map_JSON__c
            FROM Form_Template__c WHERE External_Id__c IN :extIds
        ]) {
            if (t.Create_Person_Account__c == true) tplByExt.put(t.External_Id__c, t);
        }
        if (tplByExt.isEmpty()) return; // no form here wants a Person Account

        Id personRtId = personAccountRecordTypeId();
        if (personRtId == null) return; // Person Accounts not enabled -> silently skip

        Map<String, Schema.SObjectField> acctFields =
            Schema.getGlobalDescribe().get('Account').getDescribe().fields.getMap();

        List<Form_Response__c> toUpdate = new List<Form_Response__c>();
        for (Form_Response__c r : responses) {
            Form_Template__c t = tplByExt.get(r.Form_External_Id__c);
            if (t == null) continue;
            try {
                Id acctId = upsertAccount(r, t, personRtId, acctFields);
                if (acctId != null) {
                    toUpdate.add(new Form_Response__c(Id = r.Id, Account__c = acctId));
                }
            } catch (Exception e) {
                System.debug('PERSONACCT|response ' + r.Id + ' skipped: ' + e.getMessage());
            }
        }
        if (!toUpdate.isEmpty()) {
            Database.update(toUpdate, false); // best-effort; never block on the stamp
        }
    }

    private static Id upsertAccount(Form_Response__c r, Form_Template__c t, Id personRtId,
                                    Map<String, Schema.SObjectField> acctFields) {
        Map<String, Object> data = safeMap(r.Response_Data__c);
        if (data.isEmpty()) return null;

        Map<String, String> keyToType = fieldTypesFromSchema(t.Schema_JSON__c);
        Map<String, Object> cfg = safeMap(t.Person_Account_Map_JSON__c);
        Map<String, String> overrides = new Map<String, String>();
        if (cfg.get('map') instanceof Map<String, Object>) {
            Map<String, Object> mm = (Map<String, Object>) cfg.get('map');
            for (String k : mm.keySet()) {
                if (mm.get(k) != null) overrides.put(k, String.valueOf(mm.get(k)));
            }
        }
        String matchAccountField = cfg.get('matchAccountField') == null ? null : String.valueOf(cfg.get('matchAccountField'));
        String matchFormKey = cfg.get('matchFormKey') == null ? null : String.valueOf(cfg.get('matchFormKey'));

        // Build the field -> value assignments (guarded by describe).
        Map<String, Object> assigns = new Map<String, Object>();
        for (String key : data.keySet()) {
            Object val = data.get(key);
            if (val == null || String.isBlank(String.valueOf(val))) continue;
            String acctField = overrides.containsKey(key)
                ? overrides.get(key)
                : DEFAULT_TYPE_MAP.get(keyToType.get(key));
            if (String.isBlank(acctField)) continue;
            if (!isWriteable(acctFields, acctField)) continue;
            assigns.put(acctField, coerce(acctFields, acctField, val));
        }
        // Compose the mailing street from street + house number + apartment when present.
        String street = composeStreet(data, keyToType);
        if (street != null && isWriteable(acctFields, 'PersonMailingStreet')) {
            assigns.put('PersonMailingStreet', street);
        }
        if (assigns.isEmpty()) return null;

        // Match an existing Person Account to update, else insert a new one.
        Id existingId = findExisting(matchAccountField, matchFormKey, data, acctFields);
        SObject acct = Schema.getGlobalDescribe().get('Account').newSObject();
        if (existingId != null) acct.put('Id', existingId);
        else acct.put('RecordTypeId', personRtId);
        for (String f : assigns.keySet()) acct.put(f, assigns.get(f));

        if (existingId != null) update acct; else insert acct;
        return (Id) acct.get('Id');
    }

    private static Id findExisting(String matchAccountField, String matchFormKey,
                                   Map<String, Object> data, Map<String, Schema.SObjectField> acctFields) {
        if (String.isBlank(matchAccountField) || String.isBlank(matchFormKey)) return null;
        if (!acctFields.containsKey(matchAccountField.toLowerCase())) return null;
        Object mv = data.get(matchFormKey);
        if (mv == null || String.isBlank(String.valueOf(mv))) return null;
        String val = String.valueOf(mv);
        String q = 'SELECT Id FROM Account WHERE ' + matchAccountField + ' = :val LIMIT 1';
        try {
            List<SObject> found = Database.query(q);
            return found.isEmpty() ? null : (Id) found[0].get('Id');
        } catch (Exception e) {
            return null;
        }
    }

    private static String composeStreet(Map<String, Object> data, Map<String, String> keyToType) {
        String street, house, apt;
        for (String key : keyToType.keySet()) {
            String ty = keyToType.get(key);
            Object v = data.get(key);
            if (v == null || String.isBlank(String.valueOf(v))) continue;
            if (ty == 'street') street = String.valueOf(v);
            else if (ty == 'houseNumber') house = String.valueOf(v);
            else if (ty == 'apartment') apt = String.valueOf(v);
        }
        if (String.isBlank(street)) return null;
        String s = street;
        if (String.isNotBlank(house)) s += ' ' + house;
        if (String.isNotBlank(apt)) s += '/' + apt;
        return s;
    }

    private static Id personAccountRecordTypeId() {
        try {
            List<RecordType> rts = [
                SELECT Id FROM RecordType
                WHERE SobjectType = 'Account' AND IsPersonType = true AND IsActive = true LIMIT 1
            ];
            return rts.isEmpty() ? null : rts[0].Id;
        } catch (Exception e) {
            return null; // IsPersonType unavailable -> Person Accounts not enabled
        }
    }

    private static Boolean isWriteable(Map<String, Schema.SObjectField> fields, String api) {
        if (String.isBlank(api)) return false;
        Schema.SObjectField f = fields.get(api.toLowerCase());
        if (f == null) return false;
        Schema.DescribeFieldResult d = f.getDescribe();
        return d.isCreateable() || d.isUpdateable();
    }

    private static Object coerce(Map<String, Schema.SObjectField> fields, String api, Object val) {
        Schema.DisplayType t = fields.get(api.toLowerCase()).getDescribe().getType();
        String s = String.valueOf(val);
        if (t == Schema.DisplayType.DATE) {
            try { return Date.valueOf(s); } catch (Exception e) { return null; }
        }
        if (t == Schema.DisplayType.DOUBLE || t == Schema.DisplayType.CURRENCY
                || t == Schema.DisplayType.PERCENT || t == Schema.DisplayType.INTEGER) {
            try { return Decimal.valueOf(s); } catch (Exception e) { return null; }
        }
        if (t == Schema.DisplayType.BOOLEAN) {
            return s == 'true' || s == 'כן' || s == '1';
        }
        return s;
    }

    private static Map<String, String> fieldTypesFromSchema(String schemaJson) {
        Map<String, String> out = new Map<String, String>();
        for (Object fo : FormValidationService.flattenFields(schemaJson)) {
            if (!(fo instanceof Map<String, Object>)) continue;
            Map<String, Object> f = (Map<String, Object>) fo;
            String key = (String) f.get('key');
            String ty = (String) f.get('type');
            if (String.isNotBlank(key)) out.put(key, ty);
        }
        return out;
    }

    private static Map<String, Object> safeMap(String json) {
        if (String.isBlank(json)) return new Map<String, Object>();
        try {
            Object o = JSON.deserializeUntyped(json);
            return (o instanceof Map<String, Object>) ? (Map<String, Object>) o : new Map<String, Object>();
        } catch (Exception e) {
            return new Map<String, Object>();
        }
    }
}
