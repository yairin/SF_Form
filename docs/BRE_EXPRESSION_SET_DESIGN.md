# BRE Expression Set — עיצוב מוכן להפעלה (מיפוי ApprovalDecisionService)

מסמך זה מכיל את עיצוב ה-Business Rules Engine הנייטיבי שמשקף את `ApprovalDecisionService`.
**הוא אינו נפרס אוטומטית** — קבצי ה-XML אינם ב-`force-app` בכוונה, כי צריך לאמת את דקדוק
ה-steps ב-Expression Set Builder בארגון לפני פריסה (אחרת פריסה אטומית עלולה להיכשל).
בינתיים הרנטיים הפעיל הוא ה-Apex `ApprovalDecisionService` (נפרס ועובד).

## מסלול הפעלה מומלץ
1. צור את ה-Expression Set ב-Setup → **Expression Sets** לפי הלוגיקה למטה (או פרוס את ה-XML ואמת בבנאי).
2. הפעל/פרסם (Activate) את ה-Expression Set.
3. `sf project retrieve start -m ExpressionSetDefinition:Disabled_Parking_Routing` כדי לקבל XML קנוני מאומת, והוסף אז ל-`force-app`.
4. החלף את הקריאה ב-`FormAIReviewService` מ-`ApprovalDecisionService.evaluate(...)` ל-`ParkingRoutingBre.route(...)` (Apex למטה), עם fallback ל-Apex הקיים.

## לוגיקה (זהה ל-Apex)
- מסמכים לא שלמים → `NEEDS_INFO`
- `disabilityPct >= 90` ומסמכים שלמים → `AUTO_APPROVE`
- `60–89` ומסמכים שלמים → `EXCEPTIONS_COMMITTEE`
- `< 60` (או ללא אחוז מספרי) ומסמכים שלמים → `MANUAL_REVIEW`

## Option A — ExpressionSetDefinition (מומלץ; כולו בקוד)
נתיב: `expressionSetDefinition/Disabled_Parking_Routing.expressionSetDefinition-meta.xml`
מבנה: משתני קלט `disabilityPct` (Numeric), `docsComplete` (Boolean); פלט `outcome` (Text);
שלב `Branch` בשם `Route` עם 4 מסלולים לפי `sequenceNumber` (הראשון שעובר מנצח):
NeedsInfo (docsComplete==false) → Auto (>=90) → Committee (>=60) → Manual (DefaultPath).
כל מסלול מבצע `AssignParameterValues` שמציב את הערך ל-`outcome`.

> ⚠️ לאימות בארגון: דקדוק הביטויים (`docsComplete == false`, השמת מחרוזת `"AUTO_APPROVE"`),
> והאלמנט `interfaceSourceType`. אם נדחה — להשתמש ב-AdvancedCondition עם criteria
> (`sourceFieldName`, `operator=Equals`, `value=false`, `valueType=Literal`).

## Option B — DecisionTable נייטיבי (טבלה מילולית; לא כולו בקוד)
דורש אובייקט גיבוי `Parking_Rule__c` (שורות = כללים, נטענות כ-**נתונים**) + DecisionTable
עם `filterResultBy=FirstMatch`, נצרך מתוך ExpressionSet ב-step `GetOutputsFromDecisionTable`.
פחות מומלץ ליחידה קטנה (דורש טעינת שורות + Activate + Refresh בזמן ריצה).

## Apex להרצת ה-Expression Set (GA — Invocable custom action)
```apex
public with sharing class ParkingRoutingBre {
    public static String route(Decimal disabilityPct, Boolean docsComplete) {
        Invocable.Action a = Invocable.Action.createCustomAction(
            'generateExpressionSetData', 'Disabled_Parking_Routing');
        a.setInvocationParameter('disabilityPct', disabilityPct);
        a.setInvocationParameter('docsComplete', docsComplete);
        List<Invocable.Action.Result> res = a.invoke();
        if (!res.isEmpty() && res[0].isSuccess()) {
            Map<String,Object> out = (Map<String,Object>) res[0].getOutputParameters();
            return (String) out.get('outcome');
        }
        return null; // fallback: ApprovalDecisionService.evaluate(...)
    }
}
```
> ⚠️ שמות פרמטרי הקלט/פלט (`disabilityPct`/`docsComplete`/`outcome`) — לאמת מול הארגון
> אחרי הפריסה (הרצה ב-Anonymous Apex ובדיקת `getOutputParameters()`).

## דרישות שאינן ניתנות ללכידה בקוד
- הרשאות BRE (Designer/Runtime PSL) למשתמש.
- Activate/Publish של ה-Expression Set אחרי הפריסה.
- Option B: טעינת שורות הכללים כנתונים + Activate + Refresh של הטבלה.
