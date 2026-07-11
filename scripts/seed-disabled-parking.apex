/**
 * מילוי "בקשה להקצאת חניה לנכה" ב-20 פניות מגוונות + שרשור התכתבות AI + משימת אישור לעובד.
 * הרצה: Developer Console → Debug → Open Execute Anonymous Window → הדבק → Execute.
 * ניתן להריץ שוב — הסקריפט מוחק תחילה פניות קיימות של הטופס הזה.
 */
String EXT = 'disabled-parking';
String FORM_NAME = 'בקשה להקצאת חניה לנכה';
String TENANT = 'DEMO';

// ניקוי הרצה קודמת (מחיקה מדורגת מוחקת גם Interactions; מוחקים Tasks בנפרד)
List<Form_Response__c> old = [SELECT Id FROM Form_Response__c WHERE Form_External_Id__c = :EXT];
if (!old.isEmpty()) {
    List<Task> oldTasks = [SELECT Id FROM Task WHERE WhatId IN :old];
    if (!oldTasks.isEmpty()) delete oldTasks;
    delete old;
}

// רשות לדוגמה (אם קיימת) לשיוך
Id authId = null;
List<Authority__c> auths = [SELECT Id FROM Authority__c WHERE Code__c = :TENANT LIMIT 1];
if (!auths.isEmpty()) authId = auths[0].Id;

Id me = UserInfo.getUserId();
Datetime base = Datetime.now().addDays(-25);

// נתונים מגוונים
List<String> firsts = new List<String>{'יוסי','מרים','דוד','רבקה','אבי','שרה','משה','חנה','יעקב','לאה','איתן','נועה','עומר','תמר','רון','דנה','גיל','אורית','נתן','ליאת'};
List<String> lasts  = new List<String>{'כהן','לוי','מזרחי','פרץ','ביטון','אברהם','דהן','אזולאי','גבאי','חדד','אוחיון','סבן','טל','ברק','שלום','נחום','אלון','פלד','רז','גולן'};
List<String> streets= new List<String>{'הרצל','ויצמן','ז׳בוטינסקי','בן גוריון','אלנבי','רוטשילד','דיזנגוף','סוקולוב','ביאליק','הנשיא','העצמאות','הגליל','הכרמל','ההסתדרות','ירושלים','טרומפלדור','אחד העם','בגין','נורדאו','המלך דוד'};
List<String> reasons= new List<String>{
    'מוגבלות בניידות – קושי בהליכה למרחקים',
    'שיתוק בגפיים תחתונות, ניידות בכיסא גלגלים',
    'מחלת לב קשה המגבילה מאמץ והליכה',
    'קטיעת רגל – שימוש בפרוטזה',
    'עיוורון מלא – נדרש ליווי וחניה סמוכה',
    'מחלת ריאות כרונית עם קוצר נשימה במאמץ'
};

// אחוזי נכות לפי אינדקס: קובעים את המסלול
// 0-7: 90%+ → אישור אוטומטי
// 8-14: 60-89% → ועדת חריגים
// 15-19: חוסר במסמך → השלמה מול הפונה ואז אישור
List<Form_Response__c> resps = new List<Form_Response__c>();
List<Integer> pcts = new List<Integer>();
List<String> tracks = new List<String>();

for (Integer i = 0; i < 20; i++) {
    Integer pct;
    String track;
    if (i <= 7)       { pct = 90 + Math.mod(i*3, 11); track = 'AUTO'; }
    else if (i <= 14) { pct = 60 + Math.mod(i*4, 29); track = 'COMMITTEE'; }
    else              { pct = 55 + Math.mod(i*5, 40); track = 'MISSING'; }
    pcts.add(pct); tracks.add(track);

    String fn = firsts[i]; String ln = lasts[i];
    String id9 = String.valueOf(300000000 + i*111111 + 12345);
    String mobile = ('05' + String.valueOf(20000000 + i*137891)).left(10);
    String email = 'applicant' + i + '@example.co.il';
    String street = streets[i]; Integer house = 3 + Math.mod(i*7, 90);
    String reason = reasons[Math.mod(i,6)];
    Boolean privateHouse = Math.mod(i,3) == 0;

    Map<String,Object> data = new Map<String,Object>{
        'firstName'   => fn,
        'lastName'    => ln,
        'mobile'      => mobile,
        'idNumber'    => id9,
        'street'      => street,
        'houseNumber' => String.valueOf(house),
        'email'       => email,
        'reason'      => reason,
        'privateHouse'=> privateHouse ? 'כן' : 'לא',
        'disabilityPct' => pct,        // לתצוגה בתוצאות
        // מסמכים (שמות קבצים לדוגמה)
        'idCopy'          => 'ת.ז.pdf',
        'idAppendix'      => 'ספח.pdf',
        'tagFront'        => 'תג-חזית.jpg',
        'tagBack'         => 'תג-גב.jpg',
        'vehicleLicense'  => 'רישיון-רכב.pdf',
        'drivingLicense'  => 'רישיון-נהיגה.pdf',
        'arnonaBill'      => 'ארנונה.pdf',
        'doctorOpinion'   => 'חוות-דעת-רפואית.pdf',
        'officialApproval'=> (track == 'MISSING' && i == 15) ? '' : 'אישור-משרד-הבריאות.pdf'
    };

    Form_Response__c r = new Form_Response__c();
    r.Form_External_Id__c = EXT;
    r.Form_Name__c = FORM_NAME;
    r.Respondent_Name__c = fn + ' ' + ln;
    r.Email__c = email;
    r.Phone__c = mobile;
    r.Subject__c = 'בקשה להקצאת חניה לנכה – ' + fn + ' ' + ln + ' (' + pct + '% נכות)';
    r.Response_Data__c = JSON.serialize(data);
    r.Tenant_Code__c = TENANT;
    if (authId != null) r.Authority__c = authId;
    r.Submitted_At__c = base.addDays(i);
    if (track == 'MISSING') {
        r.AI_Status__c = 'Approved';   // נפתר לאחר השלמה (מצב סופי)
        r.Status__c = 'In Progress';
        r.AI_Findings__c = 'זוהה חוסר במסמך "אישור רשמי". נשלחה בקשת השלמה לפונה; המסמך הועלה ואומת. כל המסמכים תקינים. ' +
            'אחוז נכות ' + pct + '% → ' + (pct >= 90 ? 'עומד בסף לאישור אוטומטי.' : 'הופנה לוועדת חריגים.');
    } else if (track == 'COMMITTEE') {
        r.AI_Status__c = 'Approved';
        r.Status__c = 'In Progress';
        r.AI_Findings__c = 'כל המסמכים צורפו ואומתו. אחוז נכות ' + pct + '% (בין 60% ל-89%) → מתחת לסף האישור האוטומטי; ' +
            'הבקשה הופנתה לוועדת חריגים להחלטה.';
    } else {
        r.AI_Status__c = 'Approved';
        r.Status__c = 'Done';
        r.AI_Findings__c = 'כל המסמכים צורפו ואומתו (ת.ז., ספח, תג נכה, רישיונות, ארנונה, חוות דעת רפואית, אישור רשמי). ' +
            'אחוז נכות ' + pct + '% (90% ומעלה) → עומד בסף לאישור אוטומטי. הבקשה אושרה.';
    }
    r.AI_Reviewed_At__c = base.addDays(i).addHours(2);
    // structured routing for the native approval process
    r.Approval_Route__c = (pct >= 90) ? 'Auto_Approve' : 'Exceptions_Committee';
    resps.add(r);
}
insert resps;

// שרשורי התכתבות + משימות אישור
List<Form_Interaction__c> ix = new List<Form_Interaction__c>();
List<Task> tasks = new List<Task>();

for (Integer i = 0; i < 20; i++) {
    Form_Response__c r = resps[i];
    Integer pct = pcts[i];
    String track = tracks[i];
    Datetime t0 = base.addDays(i).addHours(2);

    // 1) בדיקת AI ראשונית
    Form_Interaction__c a = new Form_Interaction__c(
        Form_Response__c = r.Id, Direction__c = 'System', Interaction_Type__c = 'AI_Review',
        Occurred_At__c = t0);
    if (track == 'MISSING') {
        a.Message__c = 'בדיקת AI: התקבלה בקשה להקצאת חניה לנכה. אומתו פרטי מבקש ורוב הצרופות. ' +
            'זוהה חוסר: לא צורף "אישור רשמי". נדרשת השלמה טרם המשך טיפול.';
    } else {
        a.Message__c = 'בדיקת AI: כל 9 שדות המבקש מלאים וכל הצרופות (ת.ז., ספח, תג נכה חזית+גב, רישיון רכב, ' +
            'רישיון נהיגה, ארנונה, חוות דעת רפואית, אישור רשמי) צורפו ונקראו בהצלחה. אחוז נכות מזוהה: ' + pct + '%.';
    }
    ix.add(a);

    Datetime tCur = t0;
    if (track == 'MISSING') {
        // 2) בקשת השלמה לפונה (קישור עדכון)
        tCur = tCur.addHours(1);
        ix.add(new Form_Interaction__c(
            Form_Response__c = r.Id, Direction__c = 'To_Applicant', Interaction_Type__c = 'Info_Request',
            Occurred_At__c = tCur,
            Message__c = 'שלום ' + r.Respondent_Name__c + ', לצורך המשך הטיפול בבקשתך חסר "אישור רשמי". ' +
                'ניתן להשלים דרך הקישור האישי: [קישור השלמת פרטים]. הבקשה תיבדק מחדש עם קבלת המסמך.'));
        // 3) תשובת הפונה
        tCur = tCur.addDays(1);
        ix.add(new Form_Interaction__c(
            Form_Response__c = r.Id, Direction__c = 'From_Applicant', Interaction_Type__c = 'Applicant_Reply',
            Occurred_At__c = tCur,
            Message__c = 'הפונה העלה את המסמך החסר ("אישור רשמי") דרך הקישור האישי.'));
        // 4) בדיקה חוזרת
        tCur = tCur.addHours(2);
        ix.add(new Form_Interaction__c(
            Form_Response__c = r.Id, Direction__c = 'System', Interaction_Type__c = 'Re_Review',
            Occurred_At__c = tCur,
            Message__c = 'בדיקה חוזרת: המסמך החסר התקבל ואומת. כל הצרופות תקינות. ' +
                (pct >= 90 ? 'אחוז נכות ' + pct + '% → עומד בסף לאישור אוטומטי.'
                           : 'אחוז נכות ' + pct + '% → מופנה לוועדת חריגים.')));
    }

    // 5) העברה לעובד/ועדה (Approval) + משימה
    tCur = tCur.addHours(2);
    Boolean toCommittee = (pct < 90);
    String approvalMsg = toCommittee
        ? 'הבדיקה האוטומטית הושלמה. אחוז נכות ' + pct + '% מתחת לסף האישור האוטומטי (90%). ' +
          'כל המידע והצרופות רוכזו והועברו למשימת החלטה של ועדת החריגים.'
        : 'הבדיקה האוטומטית הושלמה בהצלחה. אחוז נכות ' + pct + '% ומעלה. ' +
          'כל המידע רוכז והועבר למשימת אישור סופי של עובד המחלקה.';
    ix.add(new Form_Interaction__c(
        Form_Response__c = r.Id, Direction__c = 'System', Interaction_Type__c = 'Approval',
        Occurred_At__c = tCur, Message__c = approvalMsg));

    Task tk = new Task();
    tk.WhatId = r.Id;
    tk.OwnerId = me;
    tk.Subject = toCommittee
        ? 'החלטת ועדת חריגים – חניית נכה: ' + r.Respondent_Name__c + ' (' + pct + '%)'
        : 'אישור סופי – הקצאת חניית נכה: ' + r.Respondent_Name__c + ' (' + pct + '%)';
    tk.Status = 'Not Started';
    tk.Priority = toCommittee ? 'High' : 'Normal';
    tk.ActivityDate = base.addDays(i + 5).date();
    tk.Description = 'סיכום בדיקת AI:\n' + r.AI_Findings__c +
        '\n\nמבקש: ' + r.Respondent_Name__c + '\nטלפון: ' + r.Phone__c + '\nדוא"ל: ' + r.Email__c +
        '\nכתובת: (ראה נתוני הטופס)\nאחוז נכות: ' + pct + '%' +
        '\nמסלול: ' + (toCommittee ? 'ועדת חריגים' : 'אישור אוטומטי') +
        '\n\nכל הצרופות והמידע נגישים בכרטיס הפונה (רשומת התגובה) תחת "Interactions".';
    tasks.add(tk);
}
insert ix;
insert tasks;

System.debug('נוצרו ' + resps.size() + ' פניות, ' + ix.size() + ' רשומות התכתבות, ' + tasks.size() + ' משימות אישור.');
System.debug('אוטומטי(90%+): 8 | ועדת חריגים(60-89%): 7 | השלמת מסמך ואז אישור: 5');
