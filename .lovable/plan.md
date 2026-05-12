
# نظام فواتير اشتراكات حساباتي

## الفكرة
كل مرة تشترك فيها مؤسسة في خطة (Pro/Enterprise) أو يتم تجديد اشتراكها، يُصدر النظام **تلقائياً** فاتورة احترافية باسم **Suda-Technologies LLC** بالدولار، بصيغة معتمدة بنكياً (Mercury / Stripe Statement) — تظهر للمستخدم في تبويب جديد "فواتير الاشتراك" مع تحميل PDF.

> ملاحظة مهمة: هذا منفصل تماماً عن مديول الفواتير الحالي (الذي يستخدمه المستخدم ليصدر فواتير لعملائه هو). هنا الفاتورة من **حساباتي → المستخدم**.

---

## 1) قاعدة البيانات (migration)

### أ) جدول `subscription_plans` (كتالوج الخطط)
- `id`, `code` (free/pro/enterprise), `name_en`, `description_en`
- `price_usd` numeric, `billing_cycle` (monthly/yearly/lifetime)
- `max_users`, `max_branches`, `features` jsonb
- `is_active`, `sort_order`

Seed افتراضي:
- Free: $0
- Pro Monthly: $29 / 10 users / 5 branches
- Pro Yearly: $290
- Enterprise: $99/شهر، unlimited

### ب) جدول `platform_invoices`
- `id`, `organization_id`, `plan_id`
- `invoice_number` text unique — توليد تلقائي بصيغة `STP-2026-0001`
- `issue_date`, `period_start`, `period_end`, `due_date`
- `amount_usd`, `tax_usd` (=0)، `total_usd`
- `from_company` default `'Suda-Technologies LLC'`
- `from_address`, `from_email` (ثوابت)
- `to_organization_name`, `to_email`
- `status` (`issued` / `paid` / `void`), `paid_at`, `payment_reference`
- `description` (مثلاً "Hisabaty Pro Subscription — Monthly")

### ج) RLS
- SELECT: أعضاء المؤسسة (owners/admins).
- INSERT/UPDATE: service_role فقط (يتم عبر trigger).

### د) Trigger + Function
- `generate_platform_invoice()`: عند `INSERT` على organizations بخطة مدفوعة، أو عند `UPDATE plan_type` لخطة مدفوعة، أو عند `UPDATE subscription_ends_at` (تجديد)، يُنشئ صف في `platform_invoices`.
- توليد رقم الفاتورة: sequence `platform_invoice_seq` ثم `'STP-' || EXTRACT(YEAR) || '-' || LPAD(nextval, 4, '0')`.

---

## 2) الواجهة الأمامية

### أ) صفحة جديدة `src/pages/SubscriptionInvoices.tsx`
- جدول بكل الفواتير: رقم، تاريخ، الخطة، المبلغ USD، الحالة، تنزيل PDF.
- Badge للحالة (Issued / Paid).
- زر "Download PDF" لكل فاتورة.

### ب) Hook `src/hooks/usePlatformInvoices.ts`
- `list` (يفلتر بالمؤسسة الحالية)، `getById`.

### ج) PDF Generator `src/utils/platformInvoicePdf.ts`
يطابق المسودة (محترف بصياغة بنكية):
```
Suda-Technologies LLC                          INVOICE
[Address line 1]                               STP-2026-0001
Wilmington, DE, USA                            Date: May 10, 2026
hello@suda-technologies.com                    Due: May 25, 2026

BILL TO:
[Organization Name]
[Email]

DESCRIPTION                       PERIOD            QTY   PRICE     TOTAL
Hisabaty Pro Subscription         May 1 — May 31    1    $29.00    $29.00

                                                  Subtotal:  $29.00
                                                  Tax:        $0.00
                                                  TOTAL DUE: $29.00 USD

Payment Methods: Bank Transfer / Stripe / Wire
Bank Statement Reference: STP-2026-0001
```
- إنجليزي بالكامل، شعار "Suda-Technologies" أعلى يمين، خط احترافي، حد سفلي بـ "Thank you for your business".

### د) Sidebar
- إضافة رابط "Subscription Invoices" / "فواتير الاشتراك" — يظهر للـ owner/admin دائماً (ليس مرتبط بـ toggle).

### هـ) في `OrganizationSettings.tsx`
- زر "ترقية الخطة" (إن لم يوجد) أو ربط مع تغيير `plan_type` يفعّل الـ trigger ويُنشئ الفاتورة.
- إشعار toast: "تم إصدار فاتورة الاشتراك STP-2026-XXXX".

---

## 3) ملفات سيتم إنشاؤها / تعديلها
**جديدة:**
- `supabase/migrations/...subscription_plans_and_platform_invoices.sql`
- `src/hooks/usePlatformInvoices.ts`
- `src/pages/SubscriptionInvoices.tsx`
- `src/utils/platformInvoicePdf.ts`

**معدّلة:**
- `src/App.tsx` — route `/subscription-invoices`
- `src/components/layout/Sidebar.tsx` — رابط جديد للأدمن
- `src/integrations/supabase/types.ts` (تلقائي بعد migration)

---

## 4) ملاحظات أمنية
- لا يستطيع أي مستخدم إنشاء فاتورة Suda يدوياً (RLS يمنع insert من authenticated).
- الترقيم تسلسلي وفريد (sequence) → لا توجد أرقام مكررة.
- جميع الحقول الثابتة (Suda address/email) تُحقن من DB defaults وليس من الواجهة.

هل أبدأ التنفيذ مباشرة؟
