import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Building2 } from "lucide-react";

export type TimePeriod = "today" | "week" | "month" | "all";

interface Branch {
  id: string;
  name: string;
}

interface DashboardFiltersProps {
  timePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  selectedBranch: string;
  onBranchChange: (branchId: string) => void;
  branches: Branch[];
}

const timePeriodLabels: Record<TimePeriod, string> = {
  today: "اليوم",
  week: "هذا الأسبوع",
  month: "هذا الشهر",
  all: "الكل",
};

export function DashboardFilters({
  timePeriod,
  onTimePeriodChange,
  selectedBranch,
  onBranchChange,
  branches,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {/* Time Period Filter */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <Select value={timePeriod} onValueChange={(v) => onTimePeriodChange(v as TimePeriod)}>
          <SelectTrigger className="w-[140px] bg-card border-border">
            <SelectValue placeholder="اختر الفترة" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-50">
            {Object.entries(timePeriodLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Branch Filter */}
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <Select value={selectedBranch} onValueChange={onBranchChange}>
          <SelectTrigger className="w-[160px] bg-card border-border">
            <SelectValue placeholder="اختر الفرع" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-50">
            <SelectItem value="all">جميع الفروع</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
