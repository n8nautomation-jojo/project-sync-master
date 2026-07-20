
## الهدف
تبسيط تجربة ربط الفرع بـ WhatsApp Cloud API الرسمي (Meta) لأنها الطريقة الأكثر أماناً وعدم عرضة للحظر، مع إبقاء Green API كخيار ثانوي.

## المشكلة الحالية
- المستخدم يواجه 5 خطوات معقّدة يدوية في Meta Developer Console (إنشاء تطبيق، Business Account، Phone Number ID، Token، Webhook، System User، صلاحيات…).
- عليه نسخ **3 قيم** يدوياً (Phone Number ID + Access Token + Webhook URL/Verify Token) والانتقال بين علامتَي تبويب.
- لا يوجد **معالج (Wizard)** يقود خطوة بخطوة داخل نفس نموذج الإضافة، الدليل حالياً معروض ككارت منفصل.
- Webhook Verify Token ثابت (`lovable_whatsapp_verify`) - غير آمن ولا يُظهر للمستخدم مخصصاً لفرعه.
- لا يوجد فحص لصحة الـ Token قبل الحفظ (اختبار موجود لكن غير إجباري).

## الحل: تجربة ربط "مبسطة بخطوة واحدة" (One-Screen Meta Onboarding)

### 1) معالج Wizard مدمج داخل نافذة الإضافة
استبدال التبويب الحالي بمعالج من 3 مراحل مرئية (Stepper) في نفس الـ Dialog:

```text
[1] بياناتك من Meta   →   [2] اختبار تلقائي   →   [3] Webhook (نسخة واحدة)
```

- **Step 1**: 3 حقول فقط + زر مساعدة "شاهد الفيديو / الدليل" يفتح Drawer جانبي (بدل استهلاك مساحة الشاشة).
- **Step 2**: زر "اختبار الاتصال" يُنفَّذ تلقائياً عند لصق الـ Token — يعرض اسم الرقم المُتحقق منه + التاريخ + الحد اليومي، ثم يقفل الحقول ويقول ✓.
- **Step 3**: كارت واحد يعرض **Webhook URL + Verify Token مُخصَّص للفرع** (يُولَّد عشوائياً لكل اتصال بدل الثابت)، مع زر "نسخ الاثنين معاً" (Bulk Copy) + رابط مباشر لصفحة Meta Configuration الخاصة بالتطبيق.

### 2) توليد Verify Token فريد لكل اتصال
حالياً `webhook_verify_token` ثابت. سنولّد `crypto.randomUUID()` عند إضافة اتصال Meta ونحفظه، ونحدّث `meta-webhook` ليتحقق من الـ token المطابق للاتصال (البحث عبر `phone_number_id` في الـ payload بدل الاعتماد على ENV واحدة).

### 3) Auto-Fill من Meta Graph API
بعد إدخال Access Token فقط، نستدعي `GET /me/accounts` أو `GET /{business-id}/phone_numbers` عبر Edge Function جديدة `meta-list-phone-numbers` لعرض قائمة أرقام WhatsApp المتاحة تلقائياً في Dropdown — المستخدم يختار الرقم ولا يحتاج نسخ Phone Number ID يدوياً.

### 4) لصق ذكي (Smart Paste)
حقل واحد "الصق ما نسخته من Meta" يُحلَّل تلقائياً ويستخرج Phone Number ID / Token / Business ID لو ألصق المستخدم كتلة JSON أو نصاً مختلطاً.

### 5) دليل مرئي أقصر
تقليص الدليل الحالي (5 خطوات) إلى **3 خطوات فعلية** + رابط "الحصول على Token دائم" كخطوة اختيارية Post-Setup تظهر فقط بعد نجاح الربط.

### 6) شارة "Recommended" واضحة
جعل Meta هو التبويب الافتراضي (تم) + إخفاء Green API خلف زر "طرق أخرى" لتقليل التشتت (يبقى موجوداً لكن لا يُعرض بشكل متساوٍ).

---

## بدائل تقنية أخرى يمكن إضافتها لاحقاً (اقتراحات)

| الحل | المميزات | العيوب |
|------|---------|--------|
| **Meta Embedded Signup** | تدفق OAuth واحد كامل داخل popup من Meta - المستخدم يسجّل دخول Facebook مرة ويوافق ويرجع بكل البيانات جاهزة تلقائياً (لا نسخ يدوي إطلاقاً) | يتطلب مراجعة تطبيقك من Meta كـ **Tech Provider** (2-3 أسابيع)، وحساب Meta Business موثق |
| **360dialog / Twilio WhatsApp** | BSP رسمي - يعطيك API Key واحد فقط ويتكفل بكل الإعداد مع Meta | مدفوع (~$5/شهر + رسوم رسائل)، لكنه أرخص من Green API ورسمي |
| **WhatsApp Business Platform via Cloud Partner** | Meta تسمح لشركاء مثل Gupshup/Wati بتوفير Onboarding بضغطة زر | يتطلب حساب مع الشريك |
| **QR-based Multi-Device (Baileys)** | مفتوح المصدر مجاناً، ربط بمسح QR فقط | **غير رسمي** - نفس مخاطر الحظر ككرين API، لا ننصح به |

**التوصية:** المرحلة الأولى تنفيذ الـ Wizard المبسّط (النقاط 1-6 أعلاه). لاحقاً في مرحلة ثانية، التقديم لـ **Meta Embedded Signup** لأنه يحوّل التجربة إلى "زر واحد" حرفياً.

---

## التفاصيل التقنية

### ملفات ستُعدَّل
- `src/pages/WhatsAppSettings.tsx` — استبدال محتوى تبويب Meta بمكوّن Wizard جديد، إخفاء Green API خلف زر ثانوي.
- `src/hooks/useMetaApiConnection.ts` — إضافة `discoverPhoneNumbers` mutation، وتوليد `verify_token` عشوائي عند الإضافة، وحفظه في `whatsapp_connections.webhook_verify_token`.
- `src/components/whatsapp/MetaApiSetupGuide.tsx` — تقليص للخطوات وتحويله إلى Drawer/Sheet بدلاً من كارت كبير دائم الظهور.

### ملفات ستُنشَأ
- `src/components/whatsapp/MetaConnectionWizard.tsx` — Stepper component (3 خطوات) مع state داخلي.
- `supabase/functions/meta-list-phone-numbers/index.ts` — Edge Function تستدعي Graph API وتعيد قائمة الأرقام (JWT مطلوب، تحد سرعة، لا تحفظ الـ token).

### Backend
- `meta-webhook` — تعديل التحقق ليقرأ `verify_token` من `whatsapp_connections` بناءً على `phone_number_id` القادم من Meta بدلاً من ENV ثابتة (مع fallback للـ ENV للتوافق الرجعي).
- لا تغييرات في المخطط — العمود `webhook_verify_token` موجود بالفعل.

### خارج النطاق
- Meta Embedded Signup (يحتاج موافقة Meta - يُنفَّذ في مرحلة لاحقة).
- تعديل تدفق Green API.
- تغييرات على بوت التأكيد أو معالجة الرسائل.
