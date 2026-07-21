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

    static {
        ALL.sort(); // sorted once so matches come back alphabetically
    }

    /** Localities whose name starts with the given prefix (up to limitN results). */
    public static List<String> startingWith(String prefix, Integer limitN) {
        List<String> out = new List<String>();
        if (String.isBlank(prefix)) return out;
        String p = prefix.trim();
        for (String name : ALL) {
            if (name.startsWith(p)) {
                out.add(name);
                if (out.size() >= limitN) break;
            }
        }
        return out;
    }
}
