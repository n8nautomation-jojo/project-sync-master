# Plan: Financial Immutability & Audit Hardening

Addresses 3 of the audit's blocking issues: invoice hard-deletes, missing immutability on expenses/invoices, and weak audit trail.

## 1. Database migration

### 1a. Add soft-delete columns to `invoices`
```
ALTER TABLE public.invoices
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid;
CREATE INDEX idx_invoices_org_active ON public.invoices(organization_id) WHERE is_deleted = false;
```

### 1b. `soft_delete_invoice(_invoice_id uuid)` RPC
SECURITY DEFINER. Verifies caller has `owner|admin|manager` role on the invoice's org via `has_organization_role`. Sets `is_deleted=true`, `deleted_at=now()`, `deleted_by=auth.uid()`. Raises `NOT_AUTHORIZED` / `INVOICE_NOT_FOUND` to match the pattern used by `soft_delete_expense`.

### 1c. Immutability triggers

**`prevent_paid_invoice_edit`** (BEFORE UPDATE on `invoices`):
- Allow the soft-delete transition (`is_deleted` false→true).
- If `OLD.status = 'paid'`, only permit changes to `notes` / `updated_at`; block edits to amounts, dates, parties, line items pointer. Raise `PAID_INVOICE_LOCKED`.
- Also block `status` regressions from `paid` back to `draft|sent|overdue`.
- Companion trigger on `invoice_items` blocks INSERT/UPDATE/DELETE when parent invoice is `paid` (lookup via `invoice_id`).

**`prevent_approved_expense_edit`** (BEFORE UPDATE on `expenses`), mirroring `prevent_confirmed_transfer_edit`:
- Allow soft-delete transition.
- When `OLD.status = 'approved'`, block changes to `amount`, `category_id`, `branch_id`, `expense_date`, `receipt_image_url`. Allow `notes` updates only. Raise `APPROVED_EXPENSE_LOCKED`.

Also block hard `DELETE` on both tables for `authenticated` via RLS policy removal — force usage of the RPC. (Service role keeps full access.)

### 1d. Audit log hardening

- `ALTER TABLE public.audit_logs ALTER COLUMN organization_id SET NOT NULL;` (back-fill any nulls to a sentinel first; query confirmed no rows currently violate after we delete orphan logs, otherwise we'll add a `WHERE organization_id IS NULL` cleanup).
- Update `audit_log_trigger()` to capture `auth.uid()` into `user_id` on every INSERT/UPDATE/DELETE branch.
- Attach `audit_log_trigger` to: `invoices`, `invoice_items`, `expenses`, `salary_payments`, `user_roles`, `platform_invoices`, `whatsapp_credentials`.
- Add `audit_logs.user_id` index for lookups.

### 1e. Tighten RLS on hard-delete
Drop any existing `FOR DELETE` policies on `invoices` and `expenses` (force RPC path). Keep `service_role` ALL.

## 2. Frontend changes (`src/hooks/useInvoices.ts`)

- Replace `list.queryFn` filter to add `.eq("is_deleted", false)`.
- Replace `remove.mutationFn` body:
  ```ts
  const { error } = await (supabase as any).rpc('soft_delete_invoice', { _invoice_id: id });
  ```
- Map errors (`NOT_AUTHORIZED`, `INVOICE_NOT_FOUND`, `PAID_INVOICE_LOCKED`) to Arabic toast messages, mirroring `useExpenses.deleteExpense`.
- In `update.mutationFn`, surface `PAID_INVOICE_LOCKED` / `APPROVED_EXPENSE_LOCKED` exceptions with friendly Arabic messages.

No UI component changes required — `Invoices.tsx` already calls `remove.mutate(id)`.

## 3. Verification
- Run `supabase--linter` after the migration.
- Manual check via `supabase--read_query` that triggers attached and `audit_logs.organization_id` is NOT NULL.
- Quick smoke in the preview: delete a draft invoice (succeeds, row hidden), attempt to edit a paid invoice (blocked with Arabic toast).

## Out of scope (tracked separately)
- Stripe paywall, password reset, 2FA, receipt-pipeline race fixes — addressed in their own tasks.

## Technical notes
- All new functions: `SECURITY DEFINER`, `SET search_path = public`.
- Trigger names: `prevent_paid_invoice_edit`, `prevent_paid_invoice_items_edit`, `prevent_approved_expense_edit`, `audit_invoices`, `audit_invoice_items`, `audit_expenses`, `audit_salary_payments`, `audit_user_roles`, `audit_platform_invoices`, `audit_whatsapp_credentials`.
- The `audit_log_trigger` rewrite keeps signature compatible — no DROP needed, just `CREATE OR REPLACE`.
