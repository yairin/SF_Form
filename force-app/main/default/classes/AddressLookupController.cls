/**
 * Server-side proxy for Israeli address autocomplete (city + street), backed by
 * the open data.gov.il CKAN datastore (population authority streets dataset 321).
 *
 * Runs the callout server-side (via the Data_Gov_IL named credential) so the
 * public form respects the strict CSP of the Experience site — no cross-origin
 * fetch from the browser. Callable by Guest users. Best-effort: any failure
 * returns an empty list so the form never breaks (secure-dev directive 5.35:
 * validation/error handling that does not leak internals).
 *
 * The resource id + Hebrew field names live in Gov_Data_Config__mdt.Default so an
 * admin can correct them without a code change.
 */
public without sharing class AddressLookupController {

    private static Gov_Data_Config__mdt cfg() {
        Gov_Data_Config__mdt c = Gov_Data_Config__mdt.getInstance('Default');
        if (c == null) {
            // safe fallback defaults (verify against data.gov.il dataset 321)
            c = new Gov_Data_Config__mdt(
                Streets_Resource_Id__c = '1b14e41c-85b3-4c21-bdce-9fe48185ffca',
                City_Field__c = 'שם_ישוב',
                Street_Field__c = 'שם_רחוב',
                Base_Path__c = '/api/3/action/datastore_search',
                Base_Url__c = 'https://data.gov.il'
            );
        }
        return c;
    }

    @AuraEnabled(cacheable=true)
    public static List<String> searchCities(String prefix) {
        if (String.isBlank(prefix) || prefix.trim().length() < 2) return new List<String>();
        String p = prefix.trim();
        // Primary: the bundled locality list — instant and resilient to data.gov.il
        // outages / SQL-API changes (which previously left the city field blank).
        List<String> bundled = IsraeliLocalities.startingWith(p, 15);
        if (!bundled.isEmpty()) return bundled;
        // Fallback: the live open dataset, for a locality not in the bundled list.
        return apiCities(p);
    }

    // Live data.gov.il lookup (SQL LIKE prefix match, with a full-text fallback).
    private static List<String> apiCities(String p) {
        Gov_Data_Config__mdt c = cfg();
        String sql = 'SELECT DISTINCT "' + c.City_Field__c + '" FROM "' + c.Streets_Resource_Id__c + '"'
            + ' WHERE "' + c.City_Field__c + '" LIKE \'' + sqlEsc(p) + '%\''
            + ' ORDER BY "' + c.City_Field__c + '" LIMIT 15';
        List<Object> recs = callHttp(sqlUrl(c, sql));
        if (recs.isEmpty()) {
            recs = callHttp(base(c) + '&fields=' + enc(c.City_Field__c) + '&q=' + enc(p));
        }
        return distinctValues(recs, c.City_Field__c);
    }

    @AuraEnabled(cacheable=true)
    public static List<String> searchStreets(String city, String prefix) {
        if (String.isBlank(city) || String.isBlank(prefix) || prefix.trim().length() < 2) return new List<String>();
        String p = prefix.trim();
        // Primary: bundled common street names — instant and resilient to the same
        // data.gov.il API issues that affected cities. The field stays free-text, so any
        // exact street can still be typed. Fallback: the live, city-specific dataset.
        List<String> bundled = IsraeliLocalities.streetsStartingWith(p, 15);
        if (!bundled.isEmpty()) return bundled;
        return apiStreets(city.trim(), p);
    }

    // Live data.gov.il street lookup, filtered to the selected city.
    private static List<String> apiStreets(String city, String p) {
        Gov_Data_Config__mdt c = cfg();
        String sql = 'SELECT DISTINCT "' + c.Street_Field__c + '" FROM "' + c.Streets_Resource_Id__c + '"'
            + ' WHERE "' + c.City_Field__c + '" = \'' + sqlEsc(city) + '\''
            + ' AND "' + c.Street_Field__c + '" LIKE \'' + sqlEsc(p) + '%\''
            + ' ORDER BY "' + c.Street_Field__c + '" LIMIT 15';
        List<Object> recs = callHttp(sqlUrl(c, sql));
        if (recs.isEmpty()) {
            // Build the filters object via JSON.serialize so a city containing a quote or
            // backslash can't break out of the JSON literal (proper escaping, not string glue).
            String filters = JSON.serialize(new Map<String, Object>{ c.City_Field__c => city });
            recs = callHttp(base(c) + '&fields=' + enc(c.Street_Field__c) + '&q=' + enc(p) + '&filters=' + enc(filters));
        }
        return distinctValues(recs, c.Street_Field__c);
    }

    private static String host(Gov_Data_Config__mdt c) {
        return String.isBlank(c.Base_Url__c) ? 'https://data.gov.il' : c.Base_Url__c.removeEnd('/');
    }

    // datastore_search_sql endpoint (proper prefix matching via SQL LIKE).
    private static String sqlUrl(Gov_Data_Config__mdt c, String sql) {
        return host(c) + '/api/3/action/datastore_search_sql?sql=' + enc(sql);
    }

    // datastore_search endpoint (full-text fallback).
    private static String base(Gov_Data_Config__mdt c) {
        return host(c) + c.Base_Path__c
            + '?resource_id=' + enc(c.Streets_Resource_Id__c) + '&limit=100&distinct=true';
    }

    private static String enc(String s) {
        return EncodingUtil.urlEncode(s == null ? '' : s, 'UTF-8');
    }

    // Escape single quotes for safe embedding in the SQL string literal.
    private static String sqlEsc(String s) {
        return s == null ? '' : s.replace('\'', '\'\'');
    }

    private static List<Object> callHttp(String url) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(url);
            req.setMethod('GET');
            req.setTimeout(10000);
            HttpResponse res = new Http().send(req);
            if (res.getStatusCode() != 200) return new List<Object>();
            Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            Object result = body.get('result');
            if (!(result instanceof Map<String, Object>)) return new List<Object>();
            Object records = ((Map<String, Object>) result).get('records');
            return (records instanceof List<Object>) ? (List<Object>) records : new List<Object>();
        } catch (Exception e) {
            return new List<Object>();
        }
    }

    private static List<String> distinctValues(List<Object> records, String field) {
        Set<String> seen = new Set<String>();
        List<String> out = new List<String>();
        for (Object o : records) {
            if (!(o instanceof Map<String, Object>)) continue;
            Object v = ((Map<String, Object>) o).get(field);
            if (v == null) continue;
            String s = String.valueOf(v).trim();
            if (String.isNotBlank(s) && !seen.contains(s)) {
                seen.add(s);
                out.add(s);
            }
            if (out.size() >= 15) break;
        }
        out.sort();
        return out;
    }
}
