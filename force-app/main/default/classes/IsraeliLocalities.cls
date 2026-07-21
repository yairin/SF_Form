/**
 * Bundled list of Israeli localities (מרשם היישובים) used as the fast, reliable
 * source for the city autocomplete. The external data.gov.il dataset is great for
 * completeness but its SQL API is intermittently disabled and its full-text search
 * cannot match a partial Hebrew prefix — which left the city field showing nothing.
 * This bundled list makes common cities work instantly and offline; the controller
 * falls back to the live dataset only for a prefix not covered here.
 */
public with sharing class IsraeliLocalities {

    // Not exhaustive, but covers the large majority of residents. Extend as needed.
    public static final List<String> ALL = new List<String>{
        'אבן יהודה','אום אל-פחם','אופקים','אור יהודה','אור עקיבא','אזור','אילת','אלעד',
        'אליכין','אלפי מנשה','אריאל','אשדוד','אשקלון','באקה אל-גרביה','באר יעקב','באר שבע',
        'בית שאן','בית שמש','בית דגן','ביתר עילית','בני ברק','בנימינה-גבעת עדה','בת ים',
        'גבעת שמואל','גבעתיים','גדרה','גן יבנה','גני תקווה','ג׳לג׳וליה','דימונה','הוד השרון',
        'הרצליה','זכרון יעקב','חדרה','חולון','חיפה','טבריה','טייבה','טירה','טירת כרמל','טמרה',
        'יבנה','יהוד-מונוסון','יקנעם עילית','ירושלים','כוכב יאיר','כפר יונה','כפר סבא',
        'כפר קאסם','כפר ורדים','כרמיאל','להבים','לוד','מבשרת ציון','מגדל העמק','מודיעין עילית',
        'מודיעין-מכבים-רעות','מזכרת בתיה','מטולה','מיתר','מעלה אדומים','מעלות-תרשיחא','נהריה',
        'נוף הגליל','נס ציונה','נצרת','נשר','נתיבות','נתניה','סביון','סחנין','עומר','עכו',
        'עפולה','עראבה','ערד','עתלית','פרדס חנה-כרכור','פרדסיה','פתח תקווה','צפת','קדימה-צורן',
        'קלנסווה','קצרין','קרית אונו','קרית אתא','קרית ביאליק','קרית גת','קרית ים','קרית מוצקין',
        'קרית מלאכי','קרית עקרון','קרית שמונה','ראש העין','ראש פינה','ראשון לציון','רהט','רחובות',
        'רכסים','רמלה','רמת גן','רמת השרון','רעננה','שדרות','שוהם','שפרעם','תל אביב - יפו','תל מונד',
        'תל שבע'
    };

    // Common Israeli street names, reused across most cities (people/heritage names
    // and the ubiquitous tree/flower streets). Used as the reliable primary source for
    // the street autocomplete when the city-specific data.gov.il dataset is unavailable.
    // The street field stays free-text, so any exact street can still be typed.
    public static final List<String> STREETS = new List<String>{
        'הרצל','ויצמן','בן גוריון','ז׳בוטינסקי','סוקולוב','אלנבי','דיזנגוף','רוטשילד','ביאליק',
        'הנשיא','יפו','העצמאות','הגליל','הכרמל','הרצוג','בן יהודה','ארלוזורוב','אחד העם','נורדאו',
        'טרומפלדור','ההגנה','הפלמ״ח','הנביאים','הרב קוק','בר כוכבא','יהודה הלוי','קפלן','רבין',
        'בגין','אבן גבירול','פרישמן','גורדון','בלפור','שינקין','המלך ג׳ורג׳','המלך דוד','שלמה המלך',
        'יהודה המכבי','החשמונאים','המכבים','אוסישקין','ביל״ו','הבנים','הראשונים','המייסדים','הגאולה',
        'הצנחנים','גולני','אצ״ל','לח״י','הגבורה','ויתקין','אבא הלל','ז׳בוטינסקי','ההסתדרות','הירקון',
        'החשמל','לילינבלום','מזא״ה','מונטיפיורי','אחוזה','ז׳בוטינסקי','הרב עוזיאל','ירושלים','חיפה',
        'תל אביב','העלייה','הציונות','הבעש״ט','הרמב״ם','הרמב״ן','הרש״י','אבן עזרא','הלל','שמאי',
        'הזיתים','הברוש','האלון','הדקל','השקד','התאנה','הגפן','הרימון','הזית','האורן','החרוב','ההדס',
        'כלנית','נרקיס','רקפת','סביון','השושן','הפרחים','החבצלת','האירוס','הדס','הכלנית','הדולב',
        'הלימון','התמר','האגס','התפוז','הצבעוני','הסחלב','הורד','הנורית','היסמין','הלוטוס','הגומא',
        'האתרוג','הערבה','הדפנה','האקליפטוס','החיטה','השעורה','הזמיר','הדרור','היונה','הנשר','העופר',
        'הצבי','האיילה','הברקת','היהלום','הפנינה','הזהב','הכסף','האלמוג','השחף','הדולפין'
    };

    static {
        ALL.sort();     // sorted once so matches come back alphabetically
        STREETS.sort();
    }

    /** Localities whose name starts with the given prefix (up to limitN results). */
    public static List<String> startingWith(String prefix, Integer limitN) {
        return matches(ALL, prefix, limitN);
    }

    /** Common street names starting with the given prefix (up to limitN results). */
    public static List<String> streetsStartingWith(String prefix, Integer limitN) {
        return matches(STREETS, prefix, limitN);
    }

    private static List<String> matches(List<String> source, String prefix, Integer limitN) {
        List<String> out = new List<String>();
        if (String.isBlank(prefix)) return out;
        Set<String> seen = new Set<String>();
        String p = prefix.trim();
        for (String name : source) {
            if (name.startsWith(p) && !seen.contains(name)) {
                seen.add(name);
                out.add(name);
                if (out.size() >= limitN) break;
            }
        }
        return out;
    }
}
