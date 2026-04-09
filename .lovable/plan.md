
# خطة تنفيذية: موديول المطابع لنظام حساباتي PRO

## المبدأ الأساسي
النظام الحالي يبقى كمحاسب عام لأي نشاط. موديول المطابع يُفعّل بحقل `industry_type` في جدول المنظمات. عند تفعيله تظهر الميزات المتخصصة فقط.

---

## المرحلة 1: البنية التحتية (Database)

### تعديلات على الجداول الحالية:
- إضافة حقل `industry_type` لجدول `organizations` (القيم: `general`, `printing`)

### جداول جديدة:

#### 1. `wallets` — محافظ الموظفين
- `employee_id` → ربط بجدول الموظفين
- `current_balance` → الرصيد القابل للصرف
- `total_earned` → إجمالي المكتسبات

#### 2. `ledger_entries` — السجل المالي التفصيلي
- `wallet_id` → ربط بالمحفظة
- `amount` → المبلغ
- `entry_type` → (commission, deduction, advance, salary_payment)
- `description` → وصف العملية
- `reference_id` → ربط بالطلب أو البلاغ
- `status` → (pending, confirmed, cancelled)

#### 3. `print_orders` — أوامر التشغيل
- `organization_id`, `branch_id`
- `customer_name` → اسم الزبون
- `material_type` → نوع الخام (بنر، ستيكر، فليكس...)
- `width`, `height`, `quantity` → المقاسات والكمية
- `total_area` → المساحة الكلية (محسوبة)
- `unit_price` → سعر المتر المربع
- `total_price` → السعر الكلي
- `file_path` → مسار الملف المحلي (نص فقط)
- `designer_id`, `printer_id` → الموظف المسؤول
- `status` → (draft, approved, printing, printed, delivered, cancelled)
- `commission_rate` → معدل العمولة لكل متر مربع

#### 4. `error_reports` — بلاغات الأخطاء
- `print_order_id` → ربط بأمر التشغيل
- `reported_by` → المُبلّغ
- `error_type` → (size_error, text_error, material_damage, print_quality)
- `responsible_party` → (designer, printer, accountant, shared)
- `damage_cost` → تكلفة التلف
- `evidence_url` → صورة الإثبات
- `resolution_notes` → ملاحظات الحل

#### 5. `inventory_materials` — مخزون الخامات
- `name` → اسم الخام
- `material_type` → النوع
- `total_length` → الطول الكلي (بالمتر)
- `remaining_length` → المتبقي
- `width` → عرض الرول
- `cost_per_meter` → تكلفة المتر
- `supplier` → المورد

---

## المرحلة 2: واجهات المستخدم (Frontend)

### صفحات جديدة:
1. `/print-orders` — إدارة أوامر التشغيل (إنشاء، متابعة، تأكيد)
2. `/staff-wallets` — محافظ الموظفين (عرض الأرصدة، العمولات، الخصومات)
3. `/error-reports` — بلاغات الأخطاء والخصومات
4. `/inventory` — إدارة مخزون الخامات

### تعديلات على صفحات قائمة:
- لوحة التحكم: إضافة ملخص أوامر التشغيل النشطة + حالة المخزون
- القائمة الجانبية: إظهار روابط المطابع فقط عند `industry_type = 'printing'`

---

## المرحلة 3: المنطق الخلفي (Business Logic)

### Database Triggers:
1. **حساب العمولة التلقائي**: عند تغيير حالة الطلب إلى `printed` → إضافة عمولة للمصمم
2. **خصم المخزون**: عند تأكيد الطباعة → خصم المساحة من رول الخام
3. **تطبيق الخصومات**: عند إنشاء بلاغ خطأ معتمد → خصم التكلفة من محفظة المسؤول

### تنبيهات ذكية:
- طلب متوقف أكثر من 4 ساعات
- مخزون خام أقل من 20%
- عمولات معلقة تنتظر التأكيد

---

## ترتيب التنفيذ المقترح:
1. ✅ إصلاح الإشعارات (تم)
2. إنشاء جداول قاعدة البيانات + RLS
3. بناء صفحة أوامر التشغيل
4. نظام المحافظ والعمولات
5. نظام بلاغات الأخطاء والخصومات
6. إدارة المخزون
7. التنبيهات الذكية والـ Cron Jobs

---

## ملاحظات أمنية:
- كل الجداول ستكون محمية بـ RLS مرتبطة بالمنظمة
- العمليات المالية (عمولات/خصومات) تتم عبر Database Triggers فقط لمنع التلاعب
- Audit Log يسجل كل تغيير في حالات الطلبات والمحافظ
