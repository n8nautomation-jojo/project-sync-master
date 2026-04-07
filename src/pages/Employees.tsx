import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useEmployees } from "@/hooks/useEmployees";
import { useBranches } from "@/hooks/useBranches";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, UserCheck, UserX } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const Employees = () => {
  const { employees, isLoading, addEmployee } = useEmployees();
  const { branches } = useBranches();
  const [showAdd, setShowAdd] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    position: "",
    base_salary: "",
    hire_date: new Date().toISOString().split("T")[0],
    phone: "",
    branch_id: "",
  });

  const handleAdd = async () => {
    if (!form.full_name || !form.base_salary) return;
    await addEmployee.mutateAsync({
      full_name: form.full_name,
      position: form.position || undefined,
      base_salary: Number(form.base_salary),
      hire_date: form.hire_date,
      phone: form.phone || undefined,
      branch_id: form.branch_id || undefined,
    });
    setForm({ full_name: "", position: "", base_salary: "", hire_date: new Date().toISOString().split("T")[0], phone: "", branch_id: "" });
    setShowAdd(false);
  };

  const activeCount = employees.filter(e => e.is_active).length;
  const totalSalaries = employees.filter(e => e.is_active).reduce((s, e) => s + Number(e.base_salary), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">الموظفين</h1>
            <p className="text-muted-foreground">إدارة بيانات الموظفين والرواتب</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 ml-1" />إضافة موظف</Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader><DialogTitle>إضافة موظف جديد</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">الاسم الكامل *</label>
                  <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="اسم الموظف" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">المنصب</label>
                  <Input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} placeholder="مثال: محاسب" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الراتب الأساسي *</label>
                  <Input type="number" value={form.base_salary} onChange={e => setForm(p => ({ ...p, base_salary: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">تاريخ التعيين</label>
                  <Input type="date" value={form.hire_date} onChange={e => setForm(p => ({ ...p, hire_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الهاتف</label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="رقم الهاتف" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الفرع</label>
                  <Select value={form.branch_id} onValueChange={v => setForm(p => ({ ...p, branch_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع (اختياري)" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={!form.full_name || !form.base_salary || addEmployee.isPending} className="w-full">
                  {addEmployee.isPending ? "جاري الإضافة..." : "إضافة الموظف"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الموظفين</p>
                <p className="text-xl font-bold">{employees.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg"><UserCheck className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">الموظفين النشطين</p>
                <p className="text-xl font-bold">{activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg"><UserX className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الرواتب الشهرية</p>
                <p className="text-xl font-bold">{totalSalaries.toLocaleString()} ر.س</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">المنصب</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">الراتب</TableHead>
                    <TableHead className="text-right">تاريخ التعيين</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                  ) : employees.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا يوجد موظفين مسجلين</TableCell></TableRow>
                  ) : employees.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.full_name}</TableCell>
                      <TableCell>{emp.position || "—"}</TableCell>
                      <TableCell>{emp.branches?.name || "—"}</TableCell>
                      <TableCell className="font-semibold">{Number(emp.base_salary).toLocaleString()} ر.س</TableCell>
                      <TableCell>{format(new Date(emp.hire_date), "dd MMM yyyy", { locale: ar })}</TableCell>
                      <TableCell>
                        <Badge variant={emp.is_active ? "default" : "secondary"}>
                          {emp.is_active ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Employees;
