/**
 * Creates the workflow Task records a form builder defined for a form (stored on
 * Form_Template__c.Tasks_JSON__c) whenever a new Form Response is submitted.
 * Runs from the after-insert trigger in system context so it works for anonymous
 * (Guest) submissions too. Task creation is best-effort — a failure here must
 * never block the applicant's submission.
 *
 * Tasks_JSON shape: [{ "subject":"...", "priority":"High|Normal|Low",
 *                      "offsetDays":2, "description":"..." }]
 */
public without sharing class FormTaskService {

    public static void createTasks(List<Form_Response__c> responses) {
        Set<String> extIds = new Set<String>();
        for (Form_Response__c r : responses) {
            if (String.isNotBlank(r.Form_External_Id__c)) extIds.add(r.Form_External_Id__c);
        }
        if (extIds.isEmpty()) return;

        Map<String, Form_Template__c> byExt = new Map<String, Form_Template__c>();
        for (Form_Template__c t : [
            SELECT External_Id__c, Tasks_JSON__c, OwnerId
            FROM Form_Template__c
            WHERE External_Id__c IN :extIds AND Tasks_JSON__c != null
        ]) {
            byExt.put(t.External_Id__c, t);
        }
        if (byExt.isEmpty()) return;

        List<Task> toInsert = new List<Task>();
        for (Form_Response__c r : responses) {
            Form_Template__c t = byExt.get(r.Form_External_Id__c);
            if (t == null || String.isBlank(t.Tasks_JSON__c)) continue;
            List<Object> defs;
            try {
                defs = (List<Object>) JSON.deserializeUntyped(t.Tasks_JSON__c);
            } catch (Exception e) {
                continue; // malformed config — skip this form
            }
            for (Object o : defs) {
                if (!(o instanceof Map<String, Object>)) continue;
                Map<String, Object> m = (Map<String, Object>) o;
                String subject = str(m.get('subject'));
                if (String.isBlank(subject)) continue;
                Task tk = new Task(
                    WhatId = r.Id,
                    Subject = clip(subject, 255),
                    Priority = normalizePriority(str(m.get('priority'))),
                    Description = str(m.get('description')),
                    Status = 'Not Started',
                    ActivityDate = Date.today().addDays(offsetDays(m.get('offsetDays')))
                );
                // Assign to the form's owner so the task lands with an internal user
                // (the running user on a Guest submission cannot own the follow-up).
                if (t.OwnerId != null) tk.OwnerId = t.OwnerId;
                toInsert.add(tk);
            }
        }
        if (!toInsert.isEmpty()) {
            // allOrNone=false: never let a task-assignment/FLS edge case fail the submission.
            Database.insert(toInsert, false);
        }
    }

    private static Integer offsetDays(Object v) {
        if (v == null) return 0;
        try { return Integer.valueOf(String.valueOf(v)); } catch (Exception e) { return 0; }
    }

    private static String normalizePriority(String p) {
        if (String.isBlank(p)) return 'Normal';
        String v = p.trim().toLowerCase();
        if (v == 'high' || v == 'גבוהה') return 'High';
        if (v == 'low' || v == 'נמוכה') return 'Low';
        return 'Normal';
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static String clip(String v, Integer max) {
        if (v == null) return null;
        return v.length() > max ? v.substring(0, max) : v;
    }
}
