
# مراجعة ميزة تأكيد واتساب — الحالة الفعلية والخطوات المتبقية

## ما تم تنفيذه فعلاً (فحصت الكود)

| العنصر | الحالة |
|---|---|
| Migration: `notification_enabled` + جدول `whatsapp_notification_log` + RLS | ✅ منفَّذ (`20260702120000_...sql`) |
| Toggle UI في WhatsApp Settings | ✅ منفَّذ |
| Hook `toggleConfirmationNotifications` | ✅ منفَّذ |
| `sendConfirmationMessage()` في `process-receipt` (Meta فقط) | ✅ منفَّذ، async ومعزول |
| تسجيل نجاح/فشل الإرسال | ✅ منفَّذ |
| **دعم Green API** | ❌ مفقود — الكود يرجع مبكراً: `if (connection.connection_type !== "meta") return` |
| **حفظ chatId في التحويلة** (لازم للرد داخل مجموعة Green API) | ❌ مفقود |
| UI: عرض سجل الفشل للأدمن (اختياري لكن مفيد) | ❌ مفقود |

الخلاصة: الخطة الأصلية (الخيار أ لـ Meta) نُفِّذت كاملة. الناقص هو تمديدها لـ Green API — وهذا ما طلبته.

## ما سنبنيه الآن

### 1. تمديد `sendConfirmationMessage` لدعم Green API
- إزالة شرط `connection_type !== "meta"` وتفريع المسار:
  - **Meta**: كما هو الآن (`graph.facebook.com/v18.0/{phone_number_id}/messages`).
  - **Green API**: `POST https://api.green-api.com/waInstance{green_api_instance_id}/sendMessage/{green_api_token}` بجسم `{ chatId, message }`.
- جلب `green_api_token` و `green_api_instance_id` من `whatsapp_credentials` / `whatsapp_connections` (يُجلبان أصلاً في نفس الاستعلام).
- تحديد المستقبل:
  - **Green API خاص (1-to-1)**: `chatId = sender_phone@c.us`.
  - **Green API مجموعة**: يجب استخدام `chatId` الأصلي للمجموعة (وإلا سيصل الرد كرسالة خاصة للمرسل بدل نفس المحادثة).

### 2. تمرير chatId إلى الرد
- الأبسط والأقل تدخّلاً: قراءة `chatId` من صف `whatsapp_messages` الحالي (`msg`) أثناء المعالجة وتمريره لـ `sendConfirmationMessage` كـ optional param. لا حاجة لتعديل schema.
- fallback: لو `chatId` غير موجود، استخدام `sender_phone@c.us`.

### 3. تحديث SELECT في `processMessage`
إضافة `green_api_instance_id` للاستعلام + استعلام `green_api_token` من `whatsapp_credentials` (بالفعل جدول موجود).

### 4. تحسينات صغيرة (بدون كسر)
- إضافة timeout (5 ثوانٍ) على `fetch` لتفادي تعليق edge function عند بطء المزوّد.
- تسجيل `connection_type` في `error_message` عند الفشل لتسهيل التشخيص.
- إضافة `transfer_id` إلى `whatsapp_notification_log` (العمود موجود في الـ schema لكنه غير مُعبَّأ حالياً).

### 5. ما لن نغيّره (حماية للمنجَز)
- لن نلمس migration الحالي أو RLS.
- لن نغيّر UI الـ toggle الحالي — يبقى مطفأً افتراضياً.
- لن نلمس `client.ts` أو أي شيء خارج نطاق الميزة.
- لن نمس مسار Meta الحالي (only-add logic).

## تفاصيل تقنية

**ملف واحد فقط سيُعدَّل:**
`supabase/functions/process-receipt/index.ts`
- توسيع signature: `sendConfirmationMessage(sb, connection, credentials, transfer, chatId?)`
- إضافة فرع Green API داخلها.
- تحديث SELECT + credentials query + نقطة الاستدعاء لتمرير `msg.chat_id` أو مكافئه.

**لا migration، لا تغيير UI، لا تغيير hooks** — الـ toggle الحالي يعمل كما هو لكلا النوعين تلقائياً بعد النشر.

## اختبار
1. Green API خاص: إرسال صورة من رقم شخصي → تأكد وصول الرد لنفس الرقم.
2. Green API مجموعة (مع `monitored_chat_id` مضبوط): إرسال صورة في المجموعة → تأكد أن الرد في نفس المجموعة.
3. Meta: لا تغيير سلوك (regression check).
4. فحص `whatsapp_notification_log`: صف `sent` لكل حالة.

## المخاطر
| خطر | تخفيف |
|---|---|
| رد بصوت عالٍ في مجموعة كبيرة → إزعاج | الميزة opt-in، الأدمن يفعّلها عن وعي |
| Green API غير رسمي، احتمال فشل مؤقت | فشل الإرسال معزول بالكامل ولا يوقف حفظ التحويلة (السلوك الحالي) |
| رسائل مكررة عند retry | `process-receipt` يعمل مرة واحدة لكل رسالة بفضل `processed` flag الموجود |
