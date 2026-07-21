/**
 * מילוי טופס "בקשה לרישיון עסק" (biz-license) ב-20 פניות מלאות ומגוונות, כל אחת עם
 * נתונים מלאים, ממצאי בדיקת AI, שרשור התכתבות (Form_Interaction__c) ומשימת החלטה לעובד.
 * שלושה מסלולים ריאליסטיים:
 *   0-7  (8):  אישור אוטומטי — עסק ללא מזון, כל המסמכים תקינים.
 *   8-13 (6):  טעון אישור תברואה — עסק מזון (מסעדה/בית קפה) → הופנה למחלקת רישוי/בריאות.
 *   14-19(6):  אי-התאמה במסמך שתוקנה — ה-AI זיהה שם בצילום ת"ז שאינו תואם, הפונה החליף
 *              את הקובץ, בוצעה בדיקה חוזרת והבקשה אושרה (כמו בסרטון).
 * ניתן להריץ שוב — מוחק תחילה את פניות הטופס הקיימות.
 */
String EXT = 'biz-license';
String FORM_NAME = 'בקשה לרישיון עסק';
String TENANT = '0000';

// ניקוי הרצה קודמת
List<Form_Response__c> old = [SELECT Id FROM Form_Response__c WHERE Form_External_Id__c = :EXT];
if (!old.isEmpty()) {
    List<Task> oldTasks = [SELECT Id FROM Task WHERE WhatId IN :old];
    if (!oldTasks.isEmpty()) delete oldTasks;
    delete old;
}

Id authId = null;
List<Authority__c> auths = [SELECT Id FROM Authority__c WHERE Code__c = :TENANT LIMIT 1];
if (!auths.isEmpty()) authId = auths[0].Id;

Id me = UserInfo.getUserId();
Datetime base = Datetime.now().addDays(-25);

List<String> firsts = new List<String>{'יוסי','מרים','דוד','רבקה','אבי','שרה','משה','חנה','יעקב','לאה','איתן','נועה','עומר','תמר','רון','דנה','גיל','אורית','נתן','ליאת'};
List<String> lasts  = new List<String>{'כהן','לוי','מזרחי','פרץ','ביטון','אברהם','דהן','אזולאי','גבאי','חדד','אוחיון','סבן','טל','ברק','שלום','נחום','אלון','פלד','רז','גולן'};
List<String> cities = new List<String>{'תל אביב - יפו','חיפה','ירושלים','ראשון לציון','נתניה','באר שבע','רחובות','כפר סבא','הרצליה','רמת גן','פתח תקווה','חולון','אשדוד','נס ציונה','רעננה','נהריה','כרמיאל','עפולה','אשקלון','אילת'};
List<String> streets= new List<String>{'הרצל','ויצמן','ז׳בוטינסקי','בן גוריון','אלנבי','רוטשילד','דיזנגוף','סוקולוב','ביאליק','הנשיא','העצמאות','הגליל','הכרמל','ההסתדרות','ירושלים','טרומפלדור','אחד העם','בגין','נורדאו','המלך דוד'};

List<Form_Response__c> resps = new List<Form_Response__c>();
List<String> tracks = new List<String>();

for (Integer i = 0; i < 20; i++) {
    String track = (i <= 7) ? 'AUTO' : (i <= 13 ? 'HEALTH' : 'MISMATCH');
    tracks.add(track);

    String fn = firsts[i]; String ln = lasts[i];
    String id9 = String.valueOf(200000000 + i*111119 + 54321).left(9);
    String mobile = ('05' + String.valueOf(20000000 + i*137891)).left(10);
    String bizPhone = ('0' + String.valueOf(30000000 + i*211117)).left(9);
    String email = 'biz' + i + '@example.co.il';
    String city = cities[i]; String street = streets[i]; Integer house = 3 + Math.mod(i*7, 90);

    String bizType; String bizName;
    if (track == 'HEALTH') { bizType = 'מסעדה / בית קפה'; bizName = (Math.mod(i,2)==0 ? 'מסעדת ' : 'קפה ') + ln; }
    else if (i == 2) { bizType = 'מספרה / טיפוח'; bizName = 'מספרת ' + fn; }
    else if (i == 4) { bizType = 'מוסך'; bizName = 'מוסך ' + ln; }
    else if (i == 15) { bizType = 'בית מלאכה'; bizName = 'נגריית ' + ln; }
    else { bizType = (Math.mod(i,2)==0) ? 'חנות קמעונאית' : 'משרד / שירותים'; bizName = (Math.mod(i,2)==0 ? 'חנות ' : 'משרד ') + ln; }

    Boolean food = (track == 'HEALTH');
    Integer area = 40 + Math.mod(i*17, 260);
    Integer emps = 1 + Math.mod(i*3, 18);

    // בעלי זכויות (1–2)
    List<Object> owners = new List<Object>();
    owners.add(new Map<String,Object>{ 'ownerName' => fn + ' ' + ln, 'ownerId' => id9, 'ownerRole' => 'בעלים', 'sharePct' => (Math.mod(i,3)==0 ? 100 : 60) });
    if (Math.mod(i,3) != 0) {
        owners.add(new Map<String,Object>{ 'ownerName' => firsts[Math.mod(i+7,20)] + ' ' + lasts[Math.mod(i+5,20)], 'ownerId' => String.valueOf(300000000 + i*97 + 111).left(9), 'ownerRole' => 'שותף/ה', 'sharePct' => 40 });
    }

    List<String> docs = new List<String>{ 'תוכנית עסק (גרמושקה)', 'חוזה שכירות / נסח טאבו' };
    if (food) docs.add('אישור כיבוי אש');
    if (Math.mod(i,2)==0) docs.add('תעודת עוסק מורשה');

    Map<String,Object> data = new Map<String,Object>{
        'firstName'   => fn,
        'lastName'    => ln,
        'idNumber'    => id9,
        'email'       => email,
        'phone'       => mobile,
        'businessName'=> bizName,
        'city'        => city,
        'street'      => street,
        'houseNumber' => String.valueOf(house),
        'businessPhone'=> bizPhone,
        'businessType'=> bizType,
        'foodHandling'=> food ? 'כן' : 'לא',
        'areaSqm'     => area,
        'employees'   => emps,
        'openDate'    => String.valueOf(base.addDays(i + 30).date()),
        // repeater נשמר כמחרוזת JSON — בדיוק כפי שהטופס האמיתי שולח
        'owners'      => JSON.serialize(owners),
        // multi-select נשמר כמחרוזת מחוברת ב-"; " — כפי שהטופס האמיתי שולח
        'attachedDocs'=> String.join(docs, '; '),
        'businessPlan'=> 'תוכנית-עסק-גרמושקה.pdf',
        'idScan'      => (track == 'MISMATCH') ? 'תעודת-זהות-' + fn + '-' + ln + '.jpg' : 'תעודת-זהות.jpg',
        'consent'     => 'כן'
    };

    Form_Response__c r = new Form_Response__c();
    r.Form_External_Id__c = EXT;
    r.Form_Name__c = FORM_NAME;
    r.Respondent_Name__c = fn + ' ' + ln;
    r.Email__c = email;
    r.Phone__c = mobile;
    r.Subject__c = 'בקשה לרישיון עסק – ' + bizName + ' (' + bizType + ')';
    r.Response_Data__c = JSON.serialize(data);
    r.Tenant_Code__c = TENANT;
    if (authId != null) r.Authority__c = authId;
    r.Submitted_At__c = base.addDays(i);
    r.AI_Reviewed_At__c = base.addDays(i).addHours(2);

    if (track == 'HEALTH') {
        r.AI_Status__c = 'Approved';
        r.Status__c = 'In Progress';
        r.Approval_Route__c = 'Exceptions_Committee';
        r.AI_Findings__c = 'כל פרטי המבקש/ת והצרופות אומתו. צילום תעודת הזהות תואם לשם שהוזן. ' +
            'העסק כולל הכנה/הגשה של מזון (' + bizType + ') → נדרש אישור תברואה. הבקשה הופנתה למחלקת רישוי עסקים לבדיקת בריאות/תברואה.';
    } else if (track == 'MISMATCH') {
        r.AI_Status__c = 'Approved';
        r.Status__c = 'Done';
        r.Approval_Route__c = 'Auto_Approve';
        r.AI_Findings__c = 'בבדיקה הראשונית זוהתה אי-התאמה: השם שחולץ מצילום תעודת הזהות לא תאם לשם המבקש/ת. ' +
            'נשלחה בקשת השלמה; הפונה החליף/ה את הקובץ בצילום תואם. בבדיקה החוזרת השם תואם וכל המסמכים תקינים. הבקשה אושרה.';
    } else {
        r.AI_Status__c = 'Approved';
        r.Status__c = 'Done';
        r.Approval_Route__c = 'Auto_Approve';
        r.AI_Findings__c = 'כל פרטי המבקש/ת מלאים וכל הצרופות (תוכנית עסק, צילום ת"ז) נקראו ואומתו. ' +
            'השם בתעודת הזהות תואם לפרטים שהוזנו. העסק אינו כולל מזון → אין דרישת תברואה. הבקשה אושרה.';
    }
    resps.add(r);
}
insert resps;

// שרשורי התכתבות + משימות
List<Form_Interaction__c> ix = new List<Form_Interaction__c>();
List<Task> tasks = new List<Task>();

for (Integer i = 0; i < 20; i++) {
    Form_Response__c r = resps[i];
    String track = tracks[i];
    Datetime t0 = base.addDays(i).addHours(2);

    ix.add(new Form_Interaction__c(
        Form_Response__c = r.Id, Direction__c = 'System', Interaction_Type__c = 'AI_Review',
        Occurred_At__c = t0,
        Message__c = 'בדיקת AI: התקבלה בקשה לרישיון עסק. אומתו פרטי המבקש/ת, פרטי העסק, בעלי הזכויות והצרופות.'));

    Datetime tCur = t0;
    if (track == 'MISMATCH') {
        tCur = tCur.addHours(1);
        ix.add(new Form_Interaction__c(
            Form_Response__c = r.Id, Direction__c = 'To_Applicant', Interaction_Type__c = 'Info_Request',
            Occurred_At__c = tCur,
            Message__c = 'שלום ' + r.Respondent_Name__c + ', השם בצילום תעודת הזהות שצורף אינו תואם לשם שהוזן בבקשה. ' +
                'נא להעלות צילום תעודת זהות של המבקש/ת דרך הקישור האישי: [קישור השלמת פרטים].'));
        tCur = tCur.addDays(1);
        ix.add(new Form_Interaction__c(
            Form_Response__c = r.Id, Direction__c = 'From_Applicant', Interaction_Type__c = 'Applicant_Reply',
            Occurred_At__c = tCur,
            Message__c = 'הפונה העלה/תה צילום תעודת זהות תקין ותואם דרך הקישור האישי.'));
        tCur = tCur.addHours(2);
        ix.add(new Form_Interaction__c(
            Form_Response__c = r.Id, Direction__c = 'System', Interaction_Type__c = 'Re_Review',
            Occurred_At__c = tCur,
            Message__c = 'בדיקה חוזרת: הקובץ החדש אומת. השם בתעודת הזהות תואם כעת לפרטי המבקש/ת. כל המסמכים תקינים.'));
    } else if (track == 'HEALTH') {
        tCur = tCur.addHours(1);
        ix.add(new Form_Interaction__c(
            Form_Response__c = r.Id, Direction__c = 'System', Interaction_Type__c = 'Re_Review',
            Occurred_At__c = tCur,
            Message__c = 'העסק כולל טיפול/הגשת מזון → סווג כטעון אישור תברואה. הבקשה מופנית למחלקת רישוי עסקים.'));
    }

    tCur = tCur.addHours(2);
    Boolean toCommittee = (track == 'HEALTH');
    ix.add(new Form_Interaction__c(
        Form_Response__c = r.Id, Direction__c = 'System', Interaction_Type__c = 'Approval',
        Occurred_At__c = tCur,
        Message__c = toCommittee
            ? 'הבדיקה האוטומטית הושלמה. העסק טעון אישור תברואה — כל המידע רוכז והועבר למשימת החלטה של מחלקת רישוי עסקים.'
            : 'הבדיקה האוטומטית הושלמה בהצלחה. כל המידע רוכז; הבקשה אושרה והועברה למשימת הנפקת רישיון.'));

    Task tk = new Task();
    tk.WhatId = r.Id;
    tk.OwnerId = me;
    tk.Subject = toCommittee
        ? 'בדיקת תברואה – רישוי עסק: ' + r.Respondent_Name__c
        : 'הנפקת רישיון עסק: ' + r.Respondent_Name__c;
    tk.Status = toCommittee ? 'Not Started' : 'Completed';
    tk.Priority = toCommittee ? 'High' : 'Normal';
    tk.ActivityDate = base.addDays(i + 5).date();
    tk.Description = 'סיכום בדיקת AI:\n' + r.AI_Findings__c +
        '\n\nמבקש/ת: ' + r.Respondent_Name__c + '\nטלפון: ' + r.Phone__c + '\nדוא"ל: ' + r.Email__c +
        '\nמסלול: ' + (toCommittee ? 'טעון אישור תברואה' : 'אושר') +
        '\n\nכל הצרופות והמידע נגישים בכרטיס הפונה (רשומת התגובה) תחת "Interactions".';
    tasks.add(tk);
}
insert ix;
insert tasks;

System.debug('נוצרו ' + resps.size() + ' פניות רישוי עסק, ' + ix.size() + ' רשומות התכתבות, ' + tasks.size() + ' משימות.');
System.debug('אישור אוטומטי: 8 | טעון תברואה: 6 | אי-התאמה שתוקנה: 6');
