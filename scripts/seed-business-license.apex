// Idempotent DEMO form #2 for MuniForce City: "בקשה לרישיון עסק" (business-license
// application) — a second, richer local-authority process that showcases the full
// range of form-filling capabilities in one flow:
//   - 4-step wizard with a numbered RTL step tracker
//   - personal-detail field types (first/last name, id, no needless validation)
//   - city / street address autocomplete (data.gov.il)
//   - short-text length rules + numeric range validation
//   - every choice type: dropdown (select), single (radio), multi (checkbox group),
//     and a yes/no consent checkbox
//   - a repeating "owners / rights-holders" table (repeater "add row")
//   - two file uploads reviewed by AI, with an ID-vs-name cross-check
//   - Person Account mapping on submission
// The MuniForce City emblem is embedded as the form logo (SVG data URI).
final String EXT = 'biz-license';
final String LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMzYwIDEyMCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSLXoteZ16jXmdeZ16og157Xldeg15nXpNeV16jXoSDigJQgTXVuaUZvcmNlIENpdHkiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJtZlNoaWVsZCIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMyYTZmYzQiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMTIzZjc4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJtZlNreSIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNlYWYyZmIiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjY2ZlMGY0Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KCiAgPCEtLSBFbWJsZW06IGNpdmljIHNoaWVsZCB3aXRoIGEgY2l0eSBza3lsaW5lICsgcmlzaW5nIHN1biAtLT4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxNCwxMCkiPgogICAgPHBhdGggZD0iTTUwIDIgTDk0IDE2IFY1MiBDOTQgNzggNzQgOTYgNTAgMTA0IEMyNiA5NiA2IDc4IDYgNTIgVjE2IFoiCiAgICAgICAgICBmaWxsPSJ1cmwoI21mU2hpZWxkKSIgc3Ryb2tlPSIjMGUzMzVmIiBzdHJva2Utd2lkdGg9IjIiLz4KICAgIDxwYXRoIGQ9Ik01MCAxMCBMODYgMjEgVjUyIEM4NiA3MyA3MCA4OCA1MCA5NSBDMzAgODggMTQgNzMgMTQgNTIgVjIxIFoiCiAgICAgICAgICBmaWxsPSJ1cmwoI21mU2t5KSIvPgogICAgPCEtLSByaXNpbmcgc3VuIC0tPgogICAgPGNpcmNsZSBjeD0iNTAiIGN5PSI0NCIgcj0iMTAiIGZpbGw9IiNmNGE3MmMiLz4KICAgIDxnIHN0cm9rZT0iI2Y0YTcyYyIgc3Ryb2tlLXdpZHRoPSIyLjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCI+CiAgICAgIDxsaW5lIHgxPSI1MCIgeTE9IjI0IiB4Mj0iNTAiIHkyPSIzMCIvPgogICAgICA8bGluZSB4MT0iMzQiIHkxPSIzMCIgeDI9IjM4IiB5Mj0iMzQiLz4KICAgICAgPGxpbmUgeDE9IjY2IiB5MT0iMzAiIHgyPSI2MiIgeTI9IjM0Ii8+CiAgICA8L2c+CiAgICA8IS0tIHNreWxpbmU6IHRocmVlIG11bmljaXBhbCBidWlsZGluZ3MgKyBjZW50cmFsIHRvd2VyIC0tPgogICAgPGcgZmlsbD0iIzFjNWFhOCI+CiAgICAgIDxyZWN0IHg9IjI0IiB5PSI1OCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjI2IiByeD0iMS41Ii8+CiAgICAgIDxyZWN0IHg9IjYyIiB5PSI1OCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjI2IiByeD0iMS41Ii8+CiAgICAgIDxyZWN0IHg9IjQyIiB5PSI0NiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjM4IiByeD0iMS41Ii8+CiAgICAgIDxyZWN0IHg9IjQ4LjUiIHk9IjM2IiB3aWR0aD0iMyIgaGVpZ2h0PSIxMiIvPgogICAgICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIyLjQiIGZpbGw9IiNmNGE3MmMiLz4KICAgIDwvZz4KICAgIDwhLS0gd2luZG93cyAtLT4KICAgIDxnIGZpbGw9IiNlYWYyZmIiPgogICAgICA8cmVjdCB4PSIyNyIgeT0iNjIiIHdpZHRoPSIzIiBoZWlnaHQ9IjMiLz48cmVjdCB4PSIzMiIgeT0iNjIiIHdpZHRoPSIzIiBoZWlnaHQ9IjMiLz4KICAgICAgPHJlY3QgeD0iMjciIHk9IjY4IiB3aWR0aD0iMyIgaGVpZ2h0PSIzIi8+PHJlY3QgeD0iMzIiIHk9IjY4IiB3aWR0aD0iMyIgaGVpZ2h0PSIzIi8+CiAgICAgIDxyZWN0IHg9IjY1IiB5PSI2MiIgd2lkdGg9IjMiIGhlaWdodD0iMyIvPjxyZWN0IHg9IjcwIiB5PSI2MiIgd2lkdGg9IjMiIGhlaWdodD0iMyIvPgogICAgICA8cmVjdCB4PSI2NSIgeT0iNjgiIHdpZHRoPSIzIiBoZWlnaHQ9IjMiLz48cmVjdCB4PSI3MCIgeT0iNjgiIHdpZHRoPSIzIiBoZWlnaHQ9IjMiLz4KICAgICAgPHJlY3QgeD0iNDUiIHk9IjUyIiB3aWR0aD0iMy41IiBoZWlnaHQ9IjMuNSIvPjxyZWN0IHg9IjUxLjUiIHk9IjUyIiB3aWR0aD0iMy41IiBoZWlnaHQ9IjMuNSIvPgogICAgICA8cmVjdCB4PSI0NSIgeT0iNjAiIHdpZHRoPSIzLjUiIGhlaWdodD0iMy41Ii8+PHJlY3QgeD0iNTEuNSIgeT0iNjAiIHdpZHRoPSIzLjUiIGhlaWdodD0iMy41Ii8+CiAgICAgIDxyZWN0IHg9IjQ1IiB5PSI2OCIgd2lkdGg9IjMuNSIgaGVpZ2h0PSIzLjUiLz48cmVjdCB4PSI1MS41IiB5PSI2OCIgd2lkdGg9IjMuNSIgaGVpZ2h0PSIzLjUiLz4KICAgIDwvZz4KICA8L2c+CgogIDwhLS0gV29yZG1hcmsgLS0+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTIyLDApIiBmb250LWZhbWlseT0iJ1J1YmlrJywnU2Vnb2UgVUknLCdBc3Npc3RhbnQnLEFyaWFsLHNhbnMtc2VyaWYiPgogICAgPHRleHQgeD0iMCIgeT0iNTIiIGZvbnQtc2l6ZT0iMjkiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiMxMjNmNzgiPtei15nXqNeZ15nXqiDXnteV16DXmdek15XXqNehPC90ZXh0PgogICAgPHRleHQgeD0iMCIgeT0iNzgiIGZvbnQtc2l6ZT0iMTciIGZvbnQtd2VpZ2h0PSI2MDAiIGxldHRlci1zcGFjaW5nPSIxLjUiIGZpbGw9IiMxYzVhYTgiPk1VTklGT1JDRSBDSVRZPC90ZXh0PgogICAgPHRleHQgeD0iMCIgeT0iOTgiIGZvbnQtc2l6ZT0iMTEuNSIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzVhNmI4MiI+16nXmdeo15XXqteZ150g15PXmdeS15nXmNec15nXmdedINec16rXldep15E8L3RleHQ+CiAgPC9nPgo8L3N2Zz4K';

Map<String, Object> appearance = new Map<String, Object>{
    'bgType' => 'gradient', 'bgColor' => '#eef3fa', 'bgColor2' => '#dde8f5',
    'overlay' => 0, 'accentColor' => '#1c5aa8', 'cardColor' => '#ffffff',
    'textColor' => '#16202e', 'fontFamily' => '"Rubik","Assistant",sans-serif',
    'maxWidth' => 700, 'buttonStyle' => 'rounded', 'cornerRadius' => 14,
    'headingAlign' => 'right', 'logoUrl' => LOGO, 'bannerUrl' => '', 'preset' => 'blue', 'align' => 'center'
};

// ---- Step 1: applicant details (person) ----
List<Object> step1 = new List<Object>{
    new Map<String, Object>{ 'key' => 'firstName', 'label' => 'שם פרטי', 'type' => 'firstName', 'required' => true, 'mapTo' => 'respondentName', 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'lastName', 'label' => 'שם משפחה', 'type' => 'lastName', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'idNumber', 'label' => 'תעודת זהות', 'type' => 'idNumber', 'required' => true },
    new Map<String, Object>{ 'key' => 'email', 'label' => 'דוא"ל', 'type' => 'email', 'required' => true, 'mapTo' => 'email', 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'phone', 'label' => 'טלפון נייד', 'type' => 'phone', 'required' => true, 'mapTo' => 'phone', 'width' => 'half' }
};

// ---- Step 2: business address ----
List<Object> step2 = new List<Object>{
    new Map<String, Object>{ 'key' => 'businessName', 'label' => 'שם העסק', 'type' => 'text',
        'required' => true, 'minLen' => 2, 'maxLen' => 60 },
    new Map<String, Object>{ 'key' => 'city', 'label' => 'עיר', 'type' => 'city', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'street', 'label' => 'רחוב', 'type' => 'street', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'houseNumber', 'label' => 'מספר בית', 'type' => 'houseNumber', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'businessPhone', 'label' => 'טלפון העסק', 'type' => 'phone', 'width' => 'half' }
};

// ---- Step 3: business details + owners repeater ----
List<Object> ownerCols = new List<Object>{
    new Map<String, Object>{ 'key' => 'ownerName', 'label' => 'שם מלא', 'type' => 'text' },
    new Map<String, Object>{ 'key' => 'ownerId', 'label' => 'ת"ז', 'type' => 'text' },
    new Map<String, Object>{ 'key' => 'ownerRole', 'label' => 'תפקיד', 'type' => 'select',
        'options' => new List<String>{ 'בעלים', 'מנהל/ת', 'שותף/ה' } },
    new Map<String, Object>{ 'key' => 'sharePct', 'label' => 'אחוז אחזקה', 'type' => 'number' }
};
List<Object> step3 = new List<Object>{
    new Map<String, Object>{ 'key' => 'businessType', 'label' => 'סוג העסק', 'type' => 'select', 'required' => true,
        'options' => new List<String>{ 'מסעדה / בית קפה', 'חנות קמעונאית', 'מספרה / טיפוח', 'מוסך', 'בית מלאכה', 'משרד / שירותים', 'אחר' } },
    new Map<String, Object>{ 'key' => 'foodHandling', 'label' => 'האם העסק כולל הכנה או הגשה של מזון?', 'type' => 'radio', 'required' => true,
        'options' => new List<String>{ 'כן', 'לא' } },
    new Map<String, Object>{ 'key' => 'areaSqm', 'label' => 'שטח העסק (מ"ר)', 'type' => 'number',
        'required' => true, 'min' => 1, 'max' => 100000, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'employees', 'label' => 'מספר עובדים', 'type' => 'number',
        'required' => true, 'min' => 0, 'max' => 5000, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'openDate', 'label' => 'מועד פתיחה מתוכנן', 'type' => 'date' },
    new Map<String, Object>{ 'key' => 'owners', 'label' => 'בעלי זכויות בעסק', 'type' => 'repeater',
        'required' => true, 'columns' => ownerCols }
};

// ---- Step 4: documents + declarations ----
List<Object> step4 = new List<Object>{
    new Map<String, Object>{ 'key' => 'attachedDocs', 'label' => 'מסמכים שמצורפים לבקשה', 'type' => 'checkboxGroup',
        'options' => new List<String>{ 'תרשים סביבה', 'תוכנית עסק (גרמושקה)', 'חוזה שכירות / נסח טאבו', 'אישור כיבוי אש', 'תעודת עוסק מורשה' } },
    new Map<String, Object>{ 'key' => 'businessPlan', 'label' => 'תוכנית העסק (גרמושקה)', 'type' => 'file', 'required' => true },
    new Map<String, Object>{ 'key' => 'idScan', 'label' => 'צילום תעודת זהות של המבקש/ת', 'type' => 'file', 'required' => true },
    new Map<String, Object>{ 'key' => 'consent', 'label' => 'אני מצהיר/ה כי הפרטים נכונים ומאשר/ת את תנאי הגשת הבקשה לרישוי עסק', 'type' => 'checkbox', 'required' => true },
    new Map<String, Object>{ 'key' => 'signature', 'label' => 'חתימת המבקש/ת', 'type' => 'signature', 'required' => true }
};

Map<String, Object> schema = new Map<String, Object>{
    'steps' => new List<Object>{
        new Map<String, Object>{ 'title' => 'פרטי המבקש/ת', 'fields' => step1 },
        new Map<String, Object>{ 'title' => 'מען העסק', 'fields' => step2 },
        new Map<String, Object>{ 'title' => 'פרטי העסק ובעלי הזכויות', 'fields' => step3 },
        new Map<String, Object>{ 'title' => 'מסמכים והצהרות', 'fields' => step4 }
    }
};

Map<String, Object> paMap = new Map<String, Object>{ 'matchAccountField' => 'PersonEmail', 'matchFormKey' => 'email' };

List<Service_Type__c> st = [SELECT Id FROM Service_Type__c WHERE Name = 'בקשה כללית' LIMIT 1];

List<Form_Template__c> ex = [SELECT Id FROM Form_Template__c WHERE External_Id__c = :EXT LIMIT 1];
Form_Template__c tpl = ex.isEmpty() ? new Form_Template__c(External_Id__c = EXT) : ex[0];

tpl.Name = 'בקשה לרישיון עסק — MuniForce City';
tpl.Description__c = 'טופס עירוני להגשת בקשה לרישיון עסק: פרטי המבקש/ת, מען העסק, פרטי העסק ובעלי הזכויות, וצירוף מסמכים לאימות.';
tpl.Active__c = true;
tpl.Authority_Code__c = '0000';
tpl.Schema_JSON__c = JSON.serialize(schema);
tpl.Appearance_JSON__c = JSON.serialize(appearance);
tpl.Identity_Mode__c = 'Applicant_Choice';
tpl.AI_Review_Enabled__c = true;
tpl.AI_Check_Attachments__c = true;
tpl.AI_Contact_Applicant__c = true;
tpl.AI_Review_Instructions__c = 'ודא שצורפה תוכנית עסק (גרמושקה) קריאה. ודא שצורף צילום תעודת זהות קריא; חלץ ממנו את השם ומספר הזהות וּוַדֵּא שהם תואמים לפרטים שהוזנו בשלב פרטי המבקש/ת. אם סוג העסק כולל מזון — ציין אם נדרש אישור בריאות/תברואה. ציין מפורשות כל מסמך חסר או אי-התאמה.';
tpl.Create_Person_Account__c = true;
tpl.Person_Account_Map_JSON__c = JSON.serialize(paMap);
if (!st.isEmpty()) tpl.Service_Type__c = st[0].Id;

if (ex.isEmpty()) { insert tpl; } else { update tpl; }
System.debug('SEED business-license demo form ' + (ex.isEmpty() ? 'created' : 'updated') + ': ' + tpl.Id);
