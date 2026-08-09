// Idempotent seed for the Ask-Once (שאל פעם אחת) property-tax (ארנונה) discount form.
//
// Realises the confirmed design (docs/ASK_ONCE_ARNONA_SPEC.md):
//   - Identity_Mode = Identified → applicant authenticates ONCE (national auth);
//     personal details are prefilled from the verified identity and LOCKED.
//   - Income fields are read-only, populated by the Tax Authority API SEAM
//     (TaxAuthorityController — not yet live; shows a "pending" state until then).
//   - Multiple source reports may be attached (106 / תיאום מס 116 / דוח שנתי 1301);
//     only 106 is auto-summed (computedSum over the locked employers table).
//   - Confidentiality declaration + mandatory consent before submit.
//   - Routes to the ארנונה / גבייה department via Service_Type__c.
//
// Security (5.35): tax documents are PII → file fields set aiCheck:false so their
// contents are NEVER sent to the external AI model. Identity_Verified__c is derived
// server-side on submit. NOTE (gap to close before production): add third-party
// anti-virus scanning for uploaded files, and Shield encryption for the stored ID /
// income data.
final String EXT = 'arnona-discount';
final String LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMzYwIDEyMCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSLXoteZ16jXmdeZ16og157Xldeg15nXpNeV16jXoSDigJQgTXVuaUZvcmNlIENpdHkiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJtZlNoaWVsZCIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMyYTZmYzQiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMTIzZjc4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJtZlNreSIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNlYWYyZmIiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjY2ZlMGY0Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KCiAgPCEtLSBFbWJsZW06IGNpdmljIHNoaWVsZCB3aXRoIGEgY2l0eSBza3lsaW5lICsgcmlzaW5nIHN1biAtLT4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxNCwxMCkiPgogICAgPHBhdGggZD0iTTUwIDIgTDk0IDE2IFY1MiBDOTQgNzggNzQgOTYgNTAgMTA0IEMyNiA5NiA2IDc4IDYgNTIgVjE2IFoiCiAgICAgICAgICBmaWxsPSJ1cmwoI21mU2hpZWxkKSIgc3Ryb2tlPSIjMGUzMzVmIiBzdHJva2Utd2lkdGg9IjIiLz4KICAgIDxwYXRoIGQ9Ik01MCAxMCBMODYgMjEgVjUyIEM4NiA3MyA3MCA4OCA1MCA5NSBDMzAgODggMTQgNzMgMTQgNTIgVjIxIFoiCiAgICAgICAgICBmaWxsPSJ1cmwoI21mU2t5KSIvPgogICAgPCEtLSByaXNpbmcgc3VuIC0tPgogICAgPGNpcmNsZSBjeD0iNTAiIGN5PSI0NCIgcj0iMTAiIGZpbGw9IiNmNGE3MmMiLz4KICAgIDxnIHN0cm9rZT0iI2Y0YTcyYyIgc3Ryb2tlLXdpZHRoPSIyLjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCI+CiAgICAgIDxsaW5lIHgxPSI1MCIgeTE9IjI0IiB4Mj0iNTAiIHkyPSIzMCIvPgogICAgICA8bGluZSB4MT0iMzQiIHkxPSIzMCIgeDI9IjM4IiB5Mj0iMzQiLz4KICAgICAgPGxpbmUgeDE9IjY2IiB5MT0iMzAiIHgyPSI2MiIgeTI9IjM0Ii8+CiAgICA8L2c+CiAgICA8IS0tIHNreWxpbmU6IHRocmVlIG11bmljaXBhbCBidWlsZGluZ3MgKyBjZW50cmFsIHRvd2VyIC0tPgogICAgPGcgZmlsbD0iIzFjNWFhOCI+CiAgICAgIDxyZWN0IHg9IjI0IiB5PSI1OCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjI2IiByeD0iMS41Ii8+CiAgICAgIDxyZWN0IHg9IjYyIiB5PSI1OCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjI2IiByeD0iMS41Ii8+CiAgICAgIDxyZWN0IHg9IjQyIiB5PSI0NiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjM4IiByeD0iMS41Ii8+CiAgICAgIDxyZWN0IHg9IjQ4LjUiIHk9IjM2IiB3aWR0aD0iMyIgaGVpZ2h0PSIxMiIvPgogICAgICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIyLjQiIGZpbGw9IiNmNGE3MmMiLz4KICAgIDwvZz4KICAgIDwhLS0gd2luZG93cyAtLT4KICAgIDxnIGZpbGw9IiNlYWYyZmIiPgogICAgICA8cmVjdCB4PSIyNyIgeT0iNjIiIHdpZHRoPSIzIiBoZWlnaHQ9IjMiLz48cmVjdCB4PSIzMiIgeT0iNjIiIHdpZHRoPSIzIiBoZWlnaHQ9IjMiLz4KICAgICAgPHJlY3QgeD0iMjciIHk9IjY4IiB3aWR0aD0iMyIgaGVpZ2h0PSIzIi8+PHJlY3QgeD0iMzIiIHk9IjY4IiB3aWR0aD0iMyIgaGVpZ2h0PSIzIi8+CiAgICAgIDxyZWN0IHg9IjY1IiB5PSI2MiIgd2lkdGg9IjMiIGhlaWdodD0iMyIvPjxyZWN0IHg9IjcwIiB5PSI2MiIgd2lkdGg9IjMiIGhlaWdodD0iMyIvPgogICAgICA8cmVjdCB4PSI2NSIgeT0iNjgiIHdpZHRoPSIzIiBoZWlnaHQ9IjMiLz48cmVjdCB4PSI3MCIgeT0iNjgiIHdpZHRoPSIzIiBoZWlnaHQ9IjMiLz4KICAgICAgPHJlY3QgeD0iNDUiIHk9IjUyIiB3aWR0aD0iMy41IiBoZWlnaHQ9IjMuNSIvPjxyZWN0IHg9IjUxLjUiIHk9IjUyIiB3aWR0aD0iMy41IiBoZWlnaHQ9IjMuNSIvPgogICAgICA8cmVjdCB4PSI0NSIgeT0iNjAiIHdpZHRoPSIzLjUiIGhlaWdodD0iMy41Ii8+PHJlY3QgeD0iNTEuNSIgeT0iNjAiIHdpZHRoPSIzLjUiIGhlaWdodD0iMy41Ii8+CiAgICAgIDxyZWN0IHg9IjQ1IiB5PSI2OCIgd2lkdGg9IjMuNSIgaGVpZ2h0PSIzLjUiLz48cmVjdCB4PSI1MS41IiB5PSI2OCIgd2lkdGg9IjMuNSIgaGVpZ2h0PSIzLjUiLz4KICAgIDwvZz4KICA8L2c+CgogIDwhLS0gV29yZG1hcmsgLS0+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTIyLDApIiBmb250LWZhbWlseT0iJ1J1YmlrJywnU2Vnb2UgVUknLCdBc3Npc3RhbnQnLEFyaWFsLHNhbnMtc2VyaWYiPgogICAgPHRleHQgeD0iMCIgeT0iNTIiIGZvbnQtc2l6ZT0iMjkiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiMxMjNmNzgiPtei15nXqNeZ15nXqiDXnteV16DXmdek15XXqNehPC90ZXh0PgogICAgPHRleHQgeD0iMCIgeT0iNzgiIGZvbnQtc2l6ZT0iMTciIGZvbnQtd2VpZ2h0PSI2MDAiIGxldHRlci1zcGFjaW5nPSIxLjUiIGZpbGw9IiMxYzVhYTgiPk1VTklGT1JDRSBDSVRZPC90ZXh0PgogICAgPHRleHQgeD0iMCIgeT0iOTgiIGZvbnQtc2l6ZT0iMTEuNSIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzVhNmI4MiI+16nXmdeo15XXqteZ150g15PXmdeS15nXmNec15nXmdedINec16rXldep15E8L3RleHQ+CiAgPC9nPgo8L3N2Zz4K';

// ---- Routing target: ארנונה / גבייה department + service type (idempotent) ----
List<Department__c> deps = [SELECT Id FROM Department__c WHERE Name = 'ארנונה / גבייה' LIMIT 1];
Department__c dep = deps.isEmpty()
    ? new Department__c(Name = 'ארנונה / גבייה', Email__c = 'arnona@example.gov.il')
    : deps[0];
if (deps.isEmpty()) insert dep;

List<Service_Type__c> sts = [SELECT Id FROM Service_Type__c WHERE Name = 'בקשת הנחה בארנונה' LIMIT 1];
Service_Type__c st = sts.isEmpty()
    ? new Service_Type__c(Name = 'בקשת הנחה בארנונה', Department__c = dep.Id, Default_SLA_Hours__c = 120)
    : sts[0];
if (sts.isEmpty()) insert st; else { st.Department__c = dep.Id; update st; }

// ---- Appearance: MuniForce City emblem + a vivid, professional municipal palette ----
// Rich blue page gradient (matches the emblem's shield/sun) behind a clean white card,
// vivid pill call-to-action buttons, and the civic sun accent.
Map<String, Object> appearance = new Map<String, Object>{
    'bgType' => 'gradient', 'bgColor' => '#0a4c8a', 'bgColor2' => '#0e7bc4',
    'overlay' => 0, 'accentColor' => '#1565c0', 'cardColor' => '#ffffff',
    'textColor' => '#16202e', 'fontFamily' => '"Rubik","Assistant",sans-serif',
    'maxWidth' => 720, 'buttonStyle' => 'pill', 'cornerRadius' => 18,
    'headingAlign' => 'right', 'logoUrl' => LOGO, 'preset' => 'blue', 'align' => 'center'
};

// ---- Step 1: personal details (identified → locked, prefilled from national auth) ----
List<Object> step1 = new List<Object>{
    new Map<String, Object>{ 'key' => 'firstName', 'label' => 'שם פרטי', 'type' => 'firstName',
        'required' => true, 'mapTo' => 'respondentName', 'width' => 'half', 'readOnly' => true, 'source' => 'identity' },
    new Map<String, Object>{ 'key' => 'lastName', 'label' => 'שם משפחה', 'type' => 'lastName',
        'required' => true, 'width' => 'half', 'readOnly' => true, 'source' => 'identity' },
    new Map<String, Object>{ 'key' => 'idNumber', 'label' => 'תעודת זהות', 'type' => 'idNumber',
        'required' => true, 'readOnly' => true, 'source' => 'identity',
        'helpText' => 'ממולא אוטומטית מתוך ההזדהות הלאומית ואינו ניתן לעריכה.' },
    new Map<String, Object>{ 'key' => 'email', 'label' => 'דוא"ל', 'type' => 'email',
        'mapTo' => 'email', 'width' => 'half', 'readOnly' => true, 'source' => 'identity' }
};

// ---- Step 2: property (for which the discount is requested) — applicant-entered ----
List<Object> step2 = new List<Object>{
    new Map<String, Object>{ 'key' => 'city', 'label' => 'עיר', 'type' => 'city', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'street', 'label' => 'רחוב', 'type' => 'street', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'houseNumber', 'label' => 'מספר בית', 'type' => 'houseNumber', 'required' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'apartment', 'label' => 'דירה', 'type' => 'apartment', 'width' => 'half' }
};

// ---- Step 3: income (Ask-Once, read-only from Tax Authority; only 106 is summed) ----
List<Object> form106Cols = new List<Object>{
    new Map<String, Object>{ 'key' => 'employer', 'label' => 'מעסיק', 'type' => 'text' },
    new Map<String, Object>{ 'key' => 'taxableIncome', 'label' => 'הכנסה חייבת (₪)', 'type' => 'number' }
};
List<Object> step3 = new List<Object>{
    new Map<String, Object>{ 'key' => 'form106', 'label' => 'טופס 106 — הכנסה חייבת לפי מעסיק', 'type' => 'repeater',
        'readOnly' => true, 'source' => 'tax106', 'columns' => form106Cols,
        'helpText' => 'הנתונים נמשכים אוטומטית ממערכת רשות המסים ואינם ניתנים לעריכה.' },
    new Map<String, Object>{ 'key' => 'employerCount', 'label' => 'מספר מעסיקים (106)', 'type' => 'number',
        'readOnly' => true, 'width' => 'half' },
    new Map<String, Object>{ 'key' => 'form106Total', 'label' => 'סך ההכנסה החייבת (106)', 'type' => 'computedSum',
        'sumOf' => new Map<String, Object>{ 'repeater' => 'form106', 'column' => 'taxableIncome' } }
};

// ---- Step 4: source documents (PII → no external AI check) ----
List<Object> step4 = new List<Object>{
    new Map<String, Object>{ 'key' => 'doc106', 'label' => 'טופס 106', 'type' => 'file',
        'required' => true, 'aiCheck' => false, 'accept' => new List<String>{ 'pdf', 'png', 'jpg', 'jpeg' },
        'helpText' => 'צירוף מסמך המקור. המסמך אינו נשלח לבדיקת AI חיצונית.' },
    new Map<String, Object>{ 'key' => 'docTaxCoord', 'label' => 'תיאום מס (טופס 116)', 'type' => 'file',
        'aiCheck' => false, 'accept' => new List<String>{ 'pdf', 'png', 'jpg', 'jpeg' } },
    new Map<String, Object>{ 'key' => 'docAnnual', 'label' => 'דוח שנתי (טופס 1301)', 'type' => 'file',
        'aiCheck' => false, 'accept' => new List<String>{ 'pdf', 'png', 'jpg', 'jpeg' } }
};

// ---- Step 5: confidentiality declaration + consent ----
List<Object> step5 = new List<Object>{
    new Map<String, Object>{ 'key' => 'confidentiality',
        'label' => 'אני מאשר/ת כי המידע המועבר בבקשה זו — לרבות נתוני הכנסה ומסמכי מקור — מוגן בחובת סודיות, יישמר וישמש אך ורק לצורך בחינת הזכאות להנחה בארנונה בהתאם לדין, ולא יועבר לגורם שאינו מוסמך.',
        'type' => 'checkbox', 'required' => true,
        'helpText' => 'המידע מעובד לפי חוק הגנת הפרטיות והנחיות אבטחת המידע החלות על הרשות. ההסכמה מהווה תנאי להגשת הבקשה.' }
};

Map<String, Object> schema = new Map<String, Object>{
    'steps' => new List<Object>{
        new Map<String, Object>{ 'title' => 'פרטים אישיים (מזוהים)', 'fields' => step1 },
        new Map<String, Object>{ 'title' => 'פרטי הנכס', 'fields' => step2 },
        new Map<String, Object>{ 'title' => 'נתוני הכנסה (רשות המסים)', 'fields' => step3 },
        new Map<String, Object>{ 'title' => 'מסמכי מקור', 'fields' => step4 },
        new Map<String, Object>{ 'title' => 'הצהרת סודיות ואישור', 'fields' => step5 }
    }
};

List<Form_Template__c> ex = [SELECT Id FROM Form_Template__c WHERE External_Id__c = :EXT LIMIT 1];
Form_Template__c tpl = ex.isEmpty() ? new Form_Template__c(External_Id__c = EXT) : ex[0];

tpl.Name = 'בקשה להנחה בארנונה';
tpl.Description__c = 'בקשה מזוהה להנחה בארנונה לפי עקרון "שאל פעם אחת": הפרטים האישיים ונתוני ההכנסה מולאו אוטומטית ונעולים, סיכום 106 אוטומטי, צירוף מסמכי מקור, והצהרת סודיות.';
tpl.Active__c = true;
tpl.Authority_Code__c = '0000';
tpl.Schema_JSON__c = JSON.serialize(schema);
tpl.Appearance_JSON__c = JSON.serialize(appearance);
tpl.Identity_Mode__c = 'Identified';
// PII: do NOT run the external AI attachment review on tax documents (5.35).
tpl.AI_Review_Enabled__c = false;
tpl.AI_Check_Attachments__c = false;
tpl.AI_Contact_Applicant__c = false;
tpl.Create_Person_Account__c = false;
tpl.Service_Type__c = st.Id;

if (ex.isEmpty()) { insert tpl; } else { update tpl; }
System.debug('SEED arnona-discount form ' + (ex.isEmpty() ? 'created' : 'updated') + ': ' + tpl.Id);
