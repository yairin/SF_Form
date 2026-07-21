// Idempotent DEMO form for MuniForce City: "בקשה להנחה בארנונה" (municipal property-tax
// discount request) — a realistic local-authority process that showcases:
//   - multi-step wizard (numbered step tracker)
//   - a repeating "household members" table (repeater "add row")
//   - per-field validation: ID number, number range, short-text length + char rules
//   - choice field types (radio / checkbox group / dropdown / yes-no consent)
//   - file uploads reviewed by AI (ID + income proof), with ID-vs-name cross-check
//   - Person Account mapping on submission
// Existing template edits are preserved: the creator's uploaded logo is kept and the
// appearance is refreshed to a clean municipal look (the test banner is cleared).
final String EXT = 'masham-demo';

Map<String, Object> appearance = new Map<String, Object>{
    'bgType' => 'color', 'bgColor' => '#eef2f7', 'bgColor2' => '#dfe7f0',
    'overlay' => 0, 'accentColor' => '#0b5cab', 'cardColor' => '#ffffff',
    'textColor' => '#181818', 'fontFamily' => 'Rubik, sans-serif',
    'maxWidth' => 680, 'buttonStyle' => 'rounded', 'cornerRadius' => 14,
    'headingAlign' => 'right', 'logoUrl' => '', 'bannerUrl' => '', 'preset' => '', 'align' => 'center'
};

List<Object> step1 = new List<Object>{
    new Map<String, Object>{ 'key' => 'firstName', 'label' => 'שם פרטי', 'type' => 'firstName', 'required' => true, 'mapTo' => 'respondentName', 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'lastName', 'label' => 'שם משפחה', 'type' => 'lastName', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'idNumber', 'label' => 'תעודת זהות', 'type' => 'idNumber', 'required' => true },
    new Map<String, Object>{ 'key' => 'email', 'label' => 'דוא"ל', 'type' => 'email', 'required' => true, 'mapTo' => 'email', 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'phone', 'label' => 'טלפון נייד', 'type' => 'phone', 'required' => true, 'mapTo' => 'phone', 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'city', 'label' => 'עיר', 'type' => 'city', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'street', 'label' => 'רחוב', 'type' => 'street', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'houseNumber', 'label' => 'מספר בית', 'type' => 'houseNumber', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'apartment', 'label' => 'דירה', 'type' => 'apartment', 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'payerNumber', 'label' => 'מספר משלם/ת בארנונה (5–10 ספרות, ללא רווחים)',
        'type' => 'text', 'required' => true, 'minLen' => 5, 'maxLen' => 10, 'allowSpaces' => false, 'allowSpecial' => false },
    new Map<String, Object>{ 'key' => 'monthlyIncome', 'label' => 'הכנסה חודשית ברוטו למשק הבית (₪)',
        'type' => 'number', 'required' => true, 'min' => 0, 'max' => 200000 }
};

List<Object> householdCols = new List<Object>{
    new Map<String, Object>{ 'key' => 'memberName', 'label' => 'שם מלא', 'type' => 'text' },
    new Map<String, Object>{ 'key' => 'relation', 'label' => 'קרבה', 'type' => 'select',
        'options' => new List<String>{ 'בן/בת זוג', 'ילד/ה', 'הורה', 'אחר' } },
    new Map<String, Object>{ 'key' => 'memberId', 'label' => 'תעודת זהות', 'type' => 'text' },
    new Map<String, Object>{ 'key' => 'memberAge', 'label' => 'גיל', 'type' => 'number' }
};
List<Object> step2 = new List<Object>{
    new Map<String, Object>{ 'key' => 'household', 'label' => 'נפשות במשק הבית', 'type' => 'repeater',
        'required' => true, 'columns' => householdCols }
};

List<Object> step3 = new List<Object>{
    new Map<String, Object>{ 'key' => 'discountReason', 'label' => 'עילת ההנחה', 'type' => 'select', 'required' => true,
        'options' => new List<String>{ 'נכה/ת', 'אזרח/ית ותיק/ה', 'הורה יחיד/ה', 'מקבל/ת הבטחת הכנסה', 'הכנסה נמוכה', 'אחר' } },
    new Map<String, Object>{ 'key' => 'maritalStatus', 'label' => 'מצב משפחתי', 'type' => 'radio',
        'options' => new List<String>{ 'רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה' } },
    new Map<String, Object>{ 'key' => 'attachedDocs', 'label' => 'מסמכים שמצורפים לבקשה', 'type' => 'checkboxGroup',
        'options' => new List<String>{ 'צילום תעודת זהות', 'תלושי שכר', 'אישור קצבה מביטוח לאומי', 'אישור ניהול חשבון' } },
    new Map<String, Object>{ 'key' => 'idScan', 'label' => 'צילום תעודת זהות (כולל ספח)', 'type' => 'file', 'required' => true },
    new Map<String, Object>{ 'key' => 'incomeProof', 'label' => 'אסמכתאות הכנסה (3 חודשים אחרונים)', 'type' => 'file' },
    new Map<String, Object>{ 'key' => 'consent', 'label' => 'אני מצהיר/ה כי כל הפרטים נכונים ומאשר/ת את תנאי הבקשה', 'type' => 'checkbox', 'required' => true }
};

Map<String, Object> schema = new Map<String, Object>{
    'steps' => new List<Object>{
        new Map<String, Object>{ 'title' => 'פרטי המבקש/ת', 'fields' => step1 },
        new Map<String, Object>{ 'title' => 'נפשות במשק הבית', 'fields' => step2 },
        new Map<String, Object>{ 'title' => 'עילת ההנחה ומסמכים', 'fields' => step3 }
    }
};

Map<String, Object> paMap = new Map<String, Object>{ 'matchAccountField' => 'PersonEmail', 'matchFormKey' => 'email' };

List<Service_Type__c> st = [SELECT Id FROM Service_Type__c WHERE Name = 'בקשה כללית' LIMIT 1];

List<Form_Template__c> ex = [SELECT Id, Appearance_JSON__c FROM Form_Template__c WHERE External_Id__c = :EXT LIMIT 1];
Form_Template__c tpl = ex.isEmpty() ? new Form_Template__c(External_Id__c = EXT) : ex[0];

// Preserve a previously uploaded logo; drop any test banner; apply the clean look.
String existingLogo = '';
if (!ex.isEmpty() && String.isNotBlank(tpl.Appearance_JSON__c)) {
    try {
        Map<String, Object> ap = (Map<String, Object>) JSON.deserializeUntyped(tpl.Appearance_JSON__c);
        if (ap.get('logoUrl') != null) existingLogo = String.valueOf(ap.get('logoUrl'));
    } catch (Exception e) { /* ignore malformed */ }
}
appearance.put('logoUrl', existingLogo);

tpl.Name = 'בקשה להנחה בארנונה — MuniForce City';
tpl.Description__c = 'טופס עירוני להגשת בקשה להנחה בארנונה: פרטי המבקש/ת, נפשות במשק הבית, עילת ההנחה וצירוף מסמכים לאימות.';
tpl.Active__c = true;
tpl.Authority_Code__c = '0000';
tpl.Schema_JSON__c = JSON.serialize(schema);
tpl.Appearance_JSON__c = JSON.serialize(appearance);
tpl.Identity_Mode__c = 'Applicant_Choice';
tpl.AI_Review_Enabled__c = true;
tpl.AI_Check_Attachments__c = true;
tpl.AI_Contact_Applicant__c = true;
tpl.AI_Review_Instructions__c = 'ודא שצורף צילום תעודת זהות קריא; חלץ ממנו את השם ומספר הזהות וּוַדֵּא שהם תואמים לפרטים שהוזנו. ודא שצורפו אסמכתאות הכנסה קריאות התומכות בעילת ההנחה שנבחרה. ציין מפורשות כל מסמך חסר או אי-התאמה.';
tpl.Create_Person_Account__c = true;
tpl.Person_Account_Map_JSON__c = JSON.serialize(paMap);
if (!st.isEmpty()) tpl.Service_Type__c = st[0].Id;

if (ex.isEmpty()) { insert tpl; } else { update tpl; }
System.debug('SEED demo form ' + (ex.isEmpty() ? 'created' : 'updated') + ' (arnona discount): ' + tpl.Id);
