# Action Plan Template — עיצוב מוכן לבנייה (טיפול בבקשת חניית נכה)

עיצוב נייטיבי של Action Plan Template שמחליף את יצירת ה-Task הידנית ומייצר אוטומטית
את שרשרת משימות הטיפול. **אינו ב-`force-app`** בכוונה: פריסת `ActionPlanTemplate`
שממוקד לאובייקט מותאם (`Form_Response__c`) החזירה שגיאת-פנים כללית בארגון
("An unexpected error occurred… ErrorId …"), ככל הנראה מפני שצריך להפעיל את
האובייקט המותאם ל-Action Plans בהגדרות (org-side) לפני שהתבנית נקלטת. עד אז —
מנגנון המשימות הפעיל נשאר ה-Approval Process + ה-Task שכבר נפרסו.

## מסלול הפעלה
1. Setup → **Action Plans** → ודא ש-`Form_Response__c` מופעל כאובייקט יעד (object enablement).
2. בנה את התבנית ב-Setup → **Action Plan Templates** (או פרוס את ה-XML למטה לאחר ההפעלה), הפעל (Activate/Publish).
3. חבר הקמה אוטומטית: קרא ל-`DisabledParkingActionPlanService.createChecklist(responseId)` מתוך `FormAIReviewService.runReview` אחרי החלטת הניתוב (עם fallback שקט).

## פרטי התבנית
- **יעד:** `Form_Response__c` (יש לו כבר `enableActivities=true`).
- **פריטי משימה (Task):**
  1. אימות מסמכים — High, StartDate + 2
  2. החלטת ניתוב — Normal, StartDate + 5
  3. החלטת ועדת חריגים / אישור סופי — High, StartDate + 10
  4. שליחת מכתב תשובה לפונה — Normal, StartDate + 14

## מטא-דאטה (v62.0)
נתיב מיועד: `force-app/main/default/actionPlanTemplates/Disabled_Parking_Case_Processing.apt-meta.xml`
(מבנה: `actionPlanTemplateItem` לכל משימה, עם `actionPlanTemplateItemValue` ל-Subject/Priority/ActivityDate;
פרמטרי חובה: `name`, `targetEntityType=Form_Response__c`, `uniqueName`, `isAdHocItemCreationEnabled`).
> הערה: אין לכלול `actionPlanType` — אינו תקין ב-API v62.0. ה-XML המלא זמין בהיסטוריית ה-git
> (commit של תבנית ה-Action Plan) אם רוצים לשחזר לאחר הפעלת האובייקט.

## Apex להקמת התוכנית (ConnectApi)
```apex
public with sharing class DisabledParkingActionPlanService {
    public static Id createChecklist(Id formResponseId) {
        Id templateId = [SELECT Id FROM ActionPlanTemplate
                         WHERE Name = 'טיפול בבקשה לתו חניה לנכה' LIMIT 1].Id;
        ConnectApi.ActionPlanInputRepresentation input = new ConnectApi.ActionPlanInputRepresentation();
        input.actionPlanTemplateId = templateId;
        input.targetId = formResponseId;
        input.name = 'טיפול בבקשה לתו חניה לנכה';
        input.startDate = Date.today();
        input.ownerId = UserInfo.getUserId();
        ConnectApi.ActionPlanCreateResponseRepresentation res = ConnectApi.ActionPlan.createActionPlan(input);
        return res.actionPlanId;
    }
}
```
> ⚠️ לאמת מול הארגון: שמות ה-ConnectApi המדויקים (`ConnectApi.ActionPlan` מול `ActionPlans`,
> שם ה-InputRepresentation), והאם נדרש Id של **הגרסה הפעילה** של התבנית ולא של הבסיס.
> חלופת REST לבדיקה מהירה: `POST /services/data/v62.0/connect/action-plans`.

## דרישות org-side (לא ניתנות בקוד)
- הפעלת האובייקט המותאם ל-Action Plans (ככל הנראה הסיבה לשגיאת הפריסה).
- Activate/Publish של התבנית (גרסאות).
- ערכי `Priority` חייבים להתאים ל-picklist של `Task.Priority` בארגון.
- אין לארוז את הרכיב ב-Managed Package (Known Issue לתבניות עם יעד מותאם).
