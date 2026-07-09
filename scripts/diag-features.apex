/**
 * מזהה אילו יכולות PSS/Einstein מופעלות בארגון לפי נוכחות אובייקטים ייעודיים.
 * (כל פיצ'ר חושף sObjects כשהוא פעיל — בדיקה אמינה ולא תלוית רישוי-קריאה.)
 */
Map<String, Schema.SObjectType> g = Schema.getGlobalDescribe();

Map<String, List<String>> checks = new Map<String, List<String>>{
    'Business Rules Engine (BRE)'        => new List<String>{ 'ExpressionSet', 'ExpressionSetDefinition', 'DecisionTable' },
    'Document Checklist Items (DCI)'     => new List<String>{ 'DocumentChecklistItem', 'DocumentType' },
    'Intelligent Document Reader (IDR)'  => new List<String>{ 'OcrSampleDocument', 'DocumentReaderConfig', 'FormExtractionCriteria' },
    'Action Plans'                       => new List<String>{ 'ActionPlan', 'ActionPlanTemplate' },
    'OmniStudio (OmniScript/FlexCard)'   => new List<String>{ 'OmniProcess', 'OmniUiCard' },
    'Public Sector Intake'               => new List<String>{ 'IndividualApplication', 'BusinessLicenseApplication', 'RegulatoryTrxnFee' },
    'Grantmaking'                        => new List<String>{ 'IndividualApplication', 'FundingAward', 'FundingOpportunity' },
    'Einstein / Agentforce GenAI'        => new List<String>{ 'GenAiPromptTemplate', 'GenAiPlannerDefinition', 'GenAiPlugin', 'GenAiFunction', 'GenAiConversation' },
    'Case Management + Entitlements'     => new List<String>{ 'Case', 'Entitlement', 'MilestoneType' }
};

for (String feature : checks.keySet()) {
    List<String> present = new List<String>();
    List<String> missing = new List<String>();
    for (String api : checks.get(feature)) {
        if (g.containsKey(api.toLowerCase())) present.add(api); else missing.add(api);
    }
    String verdict = present.isEmpty() ? 'לא פעיל/לא זמין'
        : (missing.isEmpty() ? 'פעיל ✓' : 'חלקי');
    System.debug('FEATURE|' + feature + '|' + verdict
        + '|קיימים=' + String.join(present, ',')
        + '|חסרים=' + String.join(missing, ','));
}
