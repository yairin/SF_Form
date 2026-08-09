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

// ---- Appearance ----
Map<String, Object> appearance = new Map<String, Object>{
    'bgType' => 'gradient', 'bgColor' => '#eef4fb', 'bgColor2' => '#dbe7f6',
    'overlay' => 0, 'accentColor' => '#0b5cab', 'cardColor' => '#ffffff',
    'textColor' => '#16202e', 'fontFamily' => '"Rubik","Assistant",sans-serif',
    'maxWidth' => 720, 'buttonStyle' => 'rounded', 'cornerRadius' => 14,
    'headingAlign' => 'right', 'preset' => 'blue', 'align' => 'center'
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
