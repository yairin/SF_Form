// Idempotent DEMO form that showcases the latest capabilities:
//   - multi-step wizard (numbered step tracker)
//   - repeating rows (repeater "add row")
//   - per-field validation: ID number, number range, short-text length + char rules
//   - choice field types (radio / checkbox group / dropdown / yes-no)
//   - file uploads reviewed by AI (attachment check)
//   - Person Account mapping on submission
// The MASHAM logo is set via the builder's logo uploader (produces a public URL);
// leaving logoUrl blank keeps the seed self-contained.
final String EXT = 'masham-demo';

Map<String, Object> appearance = new Map<String, Object>{
    'bgType' => 'gradient', 'bgColor' => '#0b5cab', 'bgColor2' => '#12327a',
    'overlay' => 0, 'accentColor' => '#0b5cab', 'cardColor' => '#ffffff',
    'textColor' => '#181818', 'fontFamily' => 'Rubik, sans-serif',
    'maxWidth' => 660, 'buttonStyle' => 'rounded', 'cornerRadius' => 14,
    'headingAlign' => 'right', 'logoUrl' => '', 'bannerUrl' => '', 'preset' => '', 'align' => 'center'
};

List<Object> step1 = new List<Object>{
    new Map<String, Object>{ 'key' => 'firstName', 'label' => 'שם פרטי', 'type' => 'firstName', 'required' => true, 'mapTo' => 'respondentName' },
    new Map<String, Object>{ 'key' => 'lastName', 'label' => 'שם משפחה', 'type' => 'lastName', 'required' => true },
    new Map<String, Object>{ 'key' => 'idNumber', 'label' => 'תעודת זהות', 'type' => 'idNumber', 'required' => true },
    new Map<String, Object>{ 'key' => 'age', 'label' => 'גיל', 'type' => 'age' },
    new Map<String, Object>{ 'key' => 'email', 'label' => 'דוא"ל', 'type' => 'email', 'required' => true, 'mapTo' => 'email' },
    new Map<String, Object>{ 'key' => 'phone', 'label' => 'טלפון נייד', 'type' => 'phone', 'mapTo' => 'phone' },
    new Map<String, Object>{ 'key' => 'city', 'label' => 'עיר', 'type' => 'city', 'required' => true },
    new Map<String, Object>{ 'key' => 'street', 'label' => 'רחוב', 'type' => 'street' },
    new Map<String, Object>{ 'key' => 'houseNumber', 'label' => 'מספר בית', 'type' => 'houseNumber' },
    new Map<String, Object>{ 'key' => 'apartment', 'label' => 'דירה', 'type' => 'apartment' },
    new Map<String, Object>{ 'key' => 'candidateCode', 'label' => 'קוד מועמד (3–8 תווים, ללא רווחים/סימנים)',
        'type' => 'text', 'required' => true, 'minLen' => 3, 'maxLen' => 8, 'allowSpaces' => false, 'allowSpecial' => false },
    new Map<String, Object>{ 'key' => 'experience', 'label' => 'שנות ותק מוזיקלי (0–60)',
        'type' => 'number', 'min' => 0, 'max' => 60 }
};

List<Object> ensembleCols = new List<Object>{
    new Map<String, Object>{ 'key' => 'name', 'label' => 'שם', 'type' => 'text' },
    new Map<String, Object>{ 'key' => 'instrument', 'label' => 'כלי נגינה', 'type' => 'select',
        'options' => new List<String>{ 'גיטרה', 'פסנתר', 'כינור', 'תופים', 'שירה', 'אחר' } },
    new Map<String, Object>{ 'key' => 'years', 'label' => 'שנות ניגון', 'type' => 'number' }
};
List<Object> step2 = new List<Object>{
    new Map<String, Object>{ 'key' => 'ensemble', 'label' => 'חברי ההרכב', 'type' => 'repeater',
        'required' => true, 'columns' => ensembleCols }
};

List<Object> step3 = new List<Object>{
    new Map<String, Object>{ 'key' => 'idScan', 'label' => 'צילום תעודת זהות', 'type' => 'file', 'required' => true },
    new Map<String, Object>{ 'key' => 'residencyProof', 'label' => 'אישור תושב/ת רשות', 'type' => 'file' },
    new Map<String, Object>{ 'key' => 'level', 'label' => 'רמת נגינה', 'type' => 'radio',
        'options' => new List<String>{ 'מתחיל', 'בינוני', 'מקצועי' } },
    new Map<String, Object>{ 'key' => 'interests', 'label' => 'תחומי עניין', 'type' => 'checkboxGroup',
        'options' => new List<String>{ 'סולן', 'נגן', 'מלחין', 'מעבד' } },
    new Map<String, Object>{ 'key' => 'source', 'label' => 'כיצד שמעת עלינו?', 'type' => 'select',
        'options' => new List<String>{ 'אתר הרשות', 'רשתות חברתיות', 'חבר/ה', 'אחר' } },
    new Map<String, Object>{ 'key' => 'consent', 'label' => 'אני מאשר/ת את תקנון ההשתתפות', 'type' => 'checkbox', 'required' => true }
};

Map<String, Object> schema = new Map<String, Object>{
    'steps' => new List<Object>{
        new Map<String, Object>{ 'title' => 'פרטים אישיים', 'fields' => step1 },
        new Map<String, Object>{ 'title' => 'הרכב מוזיקלי', 'fields' => step2 },
        new Map<String, Object>{ 'title' => 'מסמכים ואישורים', 'fields' => step3 }
    }
};

Map<String, Object> paMap = new Map<String, Object>{ 'matchAccountField' => 'PersonEmail', 'matchFormKey' => 'email' };

List<Service_Type__c> st = [SELECT Id FROM Service_Type__c WHERE Name = 'בקשה כללית' LIMIT 1];

List<Form_Template__c> ex = [SELECT Id FROM Form_Template__c WHERE External_Id__c = :EXT LIMIT 1];
Form_Template__c tpl = ex.isEmpty() ? new Form_Template__c(External_Id__c = EXT) : ex[0];
tpl.Name = 'טופס מועמדות — מוזיקאי/ת מצטיין/ת (דמו מש״ם)';
tpl.Description__c = 'טופס דוגמה מדורג הממחיש אשף שלבים, שורות חוזרות, ולידציות שדה, בדיקת AI לקבצים ומיפוי Person Account.';
tpl.Active__c = true;
tpl.Authority_Code__c = '0000';
tpl.Schema_JSON__c = JSON.serialize(schema);
tpl.Appearance_JSON__c = JSON.serialize(appearance);
tpl.Identity_Mode__c = 'Applicant_Choice';
tpl.AI_Review_Enabled__c = true;
tpl.AI_Check_Attachments__c = true;
tpl.AI_Contact_Applicant__c = true;
tpl.AI_Review_Instructions__c = 'ודא שצורף צילום תעודת זהות קריא ואישור תושב תקף. חלץ מהמסמכים את השם ומספר תעודת הזהות והשווה לפרטים שהוזנו; ציין במפורש אי-התאמות או מסמך חסר.';
tpl.Create_Person_Account__c = true;
tpl.Person_Account_Map_JSON__c = JSON.serialize(paMap);
if (!st.isEmpty()) tpl.Service_Type__c = st[0].Id;

if (ex.isEmpty()) { insert tpl; } else { update tpl; }
System.debug('SEED demo form ' + (ex.isEmpty() ? 'created' : 'updated') + ': ' + tpl.Id);
