# שרת SFTP על AWS (Transfer Family + S3)

תבנית CloudFormation שיוצרת:

| משאב | תיאור |
|------|-------|
| **AWS Transfer Family Server** | שרת SFTP מנוהל, endpoint ציבורי, מדיניות אבטחה `TransferSecurityPolicy-2024-01` |
| **S3 Bucket** | אחסון הקבצים: מוצפן (SSE-S3), חסום לגישה ציבורית, versioning, רק TLS |
| **SFTP User** | משתמש ראשון עם מפתח SSH, נעול (chroot) לתיקייה `s3://<bucket>/<username>/` |
| **IAM Roles** | הרשאות למשתמשים ל-bucket + הרשאת לוגים |
| **CloudWatch Logs** | לוג כניסות והעברות קבצים |

## 💰 עלות משוערת
- **כ-$0.30 לשעה לשרת** (≈ $216 לחודש) כל עוד השרת קיים, גם בלי שימוש.
- $0.04 ל-GB שמועבר (העלאה/הורדה) + עלות אחסון S3 רגילה.
- כדי לחסוך: אפשר לעצור את השרת (`Stop`) כשלא בשימוש, אבל החיוב השעתי נמשך כל עוד הוא לא נמחק.

## 1. יצירת מפתח SSH (במחשב של המשתמש)
```bash
ssh-keygen -t ed25519 -f ~/.ssh/sftp_aws -C "sftpuser"
cat ~/.ssh/sftp_aws.pub      # את התוכן הזה מדביקים בפרמטר SftpUserPublicKey
```

## 2. פריסה

### דרך הקונסול
1. AWS Console → **CloudFormation** → **Create stack** → **With new resources**.
2. **Upload a template file** → `sftp-transfer-family.yaml`.
3. שם stack, למשל `masham-sftp`, ומילוי הפרמטרים.
4. בעמוד האחרון מסמנים **I acknowledge that AWS CloudFormation might create IAM resources** → **Submit**.
5. אחרי כ-5 דקות, בלשונית **Outputs** מופיעים כתובת השרת ופקודת החיבור.

### דרך AWS CLI
```bash
aws cloudformation deploy \
  --region il-central-1 \
  --stack-name masham-sftp \
  --template-file infra/sftp/sftp-transfer-family.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
      SftpUserName=sftpuser \
      SftpUserPublicKey="$(cat ~/.ssh/sftp_aws.pub)"

aws cloudformation describe-stacks --region il-central-1 \
  --stack-name masham-sftp --query "Stacks[0].Outputs"
```
> Transfer Family זמין באזור ישראל (`il-central-1`). אפשר להחליף לאזור אחר לפי הצורך.

## 3. התחברות
```bash
sftp -i ~/.ssh/sftp_aws sftpuser@<ServerId>.server.transfer.<region>.amazonaws.com
```
או ב-WinSCP / FileZilla: Protocol `SFTP`, Port `22`, User, ובחירת קובץ המפתח הפרטי (ב-WinSCP צריך להמיר ל-`.ppk`).

## 4. הוספת משתמשים נוספים
```bash
aws transfer create-user --region il-central-1 \
  --server-id <ServerId> \
  --user-name supplier1 \
  --role <UserRoleArn> \
  --home-directory-type LOGICAL \
  --home-directory-mappings '[{"Entry":"/","Target":"/<BucketName>/supplier1"}]' \
  --ssh-public-key-body "$(cat supplier1.pub)"
```
(`ServerId`, `UserRoleArn`, `BucketName` מופיעים ב-Outputs.)

## הערות אבטחה
- **אימות במפתח SSH בלבד**, בלי סיסמאות. כדי לאפשר סיסמה צריך Custom Identity Provider (Lambda).
- **הגבלת IP:** ב-endpoint ציבורי אי אפשר להגביל לפי IP. אם צריך רשימת IP מורשות, מחליפים ל-`EndpointType: VPC` עם Elastic IP ו-Security Group.
- ה-bucket מוגדר `DeletionPolicy: Retain`, כך שמחיקת ה-stack **לא** מוחקת את הקבצים.

## חיבור ל-SharePoint (אופציונלי)
כדי שקבצים שעולים ל-SFTP יגיעו לספריית SharePoint, אפשר להוסיף Lambda על אירוע `s3:ObjectCreated` שמעלה את הקובץ דרך Microsoft Graph, או להשתמש ב-Power Automate עם מחבר Amazon S3 (premium).
