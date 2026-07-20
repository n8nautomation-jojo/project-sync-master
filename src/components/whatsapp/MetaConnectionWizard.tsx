import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  Loader2,
  Key,
  Copy,
  ExternalLink,
  Shield,
  ArrowRight,
  ArrowLeft,
  Phone,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBranches } from "@/hooks/useBranches";
import { useMetaApiConnection, DiscoveredPhone } from "@/hooks/useMetaApiConnection";

type Step = 1 | 2 | 3;

interface Props {
  onDone: () => void;
  onCancel: () => void;
  webhookUrl: string;
}

export function MetaConnectionWizard({ onDone, onCancel, webhookUrl }: Props) {
  const { toast } = useToast();
  const { branches, addBranch } = useBranches();
  const {
    addMetaConnection,
    discoverPhoneNumbers,
    getMetaWebhookUrl,
  } = useMetaApiConnection();

  const [step, setStep] = useState<Step>(1);
  const [accessToken, setAccessToken] = useState("");
  const [phones, setPhones] = useState<DiscoveredPhone[]>([]);
  const [selectedPhoneId, setSelectedPhoneId] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualPhoneNumberId, setManualPhoneNumberId] = useState("");
  const [manualMode, setManualMode] = useState(false);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [useCustomBranch, setUseCustomBranch] = useState(false);
  const [customBranchName, setCustomBranchName] = useState("");

  const [savedVerifyToken, setSavedVerifyToken] = useState("");

  const selectedPhone = useMemo(
    () => phones.find(p => p.id === selectedPhoneId),
    [phones, selectedPhoneId],
  );

  const finalPhoneNumber = manualMode ? manualPhone : (selectedPhone?.display_phone_number || "");
  const finalPhoneNumberId = manualMode ? manualPhoneNumberId : selectedPhoneId;

  const handleDiscover = async () => {
    if (!accessToken || accessToken.length < 20) {
      toast({ title: "أدخل الـ Access Token أولاً", variant: "destructive" });
      return;
    }
    try {
      const result = await discoverPhoneNumbers.mutateAsync({ accessToken });
      setPhones(result);
      if (result.length === 0) {
        setManualMode(true);
        toast({
          title: "لم نجد أرقاماً تلقائياً",
          description: "أدخل Phone Number ID يدوياً من لوحة Meta.",
        });
      } else {
        setManualMode(false);
        setSelectedPhoneId(result[0].id);
        toast({ title: `تم العثور على ${result.length} رقم`, description: "اختر الرقم المطلوب ربطه" });
      }
      setStep(2);
    } catch {
      // toast handled in hook
    }
  };

  const handleSave = async () => {
    if (!finalPhoneNumber || !finalPhoneNumberId) {
      toast({ title: "بيانات ناقصة", description: "اختر رقماً من القائمة أو أدخله يدوياً.", variant: "destructive" });
      return;
    }

    let branchIdToUse = selectedBranch;
    if (useCustomBranch) {
      if (!customBranchName.trim()) {
        toast({ title: "أدخل اسم الفرع", variant: "destructive" });
        return;
      }
      try {
        const newBranch = await addBranch.mutateAsync({ name: customBranchName.trim() });
        branchIdToUse = newBranch.id;
      } catch { return; }
    }
    if (!branchIdToUse) {
      toast({ title: "اختر فرعاً", variant: "destructive" });
      return;
    }

    try {
      const created = await addMetaConnection.mutateAsync({
        branchId: branchIdToUse,
        phoneNumber: finalPhoneNumber.startsWith("+") ? finalPhoneNumber : `+${finalPhoneNumber}`,
        phoneNumberId: finalPhoneNumberId,
        accessToken,
      });
      setSavedVerifyToken((created as any)?.webhook_verify_token || "");
      setStep(3);
    } catch {
      // toast handled in hook
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ", description: label });
  };

  const effectiveWebhookUrl = webhookUrl || getMetaWebhookUrl();

  const connectedBranchIds: string[] = [];
  const availableBranches = branches.filter(b => !connectedBranchIds.includes(b.id));

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/40">
        {[
          { n: 1, label: "الـ Token" },
          { n: 2, label: "اختيار الرقم" },
          { n: 3, label: "Webhook" },
        ].map((s, i, arr) => (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              step >= (s.n as Step)
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "bg-muted text-muted-foreground"
            }`}>
              {step > (s.n as Step) ? <CheckCircle className="w-4 h-4" /> : s.n}
            </div>
            <span className={`text-xs ${step >= (s.n as Step) ? "text-foreground" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < arr.length - 1 && <div className="flex-1 h-px bg-border/40 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Token + auto-discovery */}
      {step === 1 && (
        <div className="space-y-4">
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-sm">
              <strong>الطريقة الأسهل:</strong> ألصق فقط الـ Access Token من Meta وسنكتشف أرقامك تلقائياً.
              <a
                href="https://developers.facebook.com/apps"
                target="_blank" rel="noopener noreferrer"
                className="text-blue-400 underline gap-1 inline-flex items-center mr-2"
              >
                فتح لوحة Meta <ExternalLink className="w-3 h-3" />
              </a>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Key className="w-4 h-4" /> Access Token
            </Label>
            <Input
              type="password"
              placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxx..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value.trim())}
              className="text-left font-mono"
              dir="ltr"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              من Meta Developer Console → WhatsApp → API Setup → Temporary Access Token (أو System User Token دائم).
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              إلغاء
            </Button>
            <Button
              onClick={handleDiscover}
              disabled={!accessToken || discoverPhoneNumbers.isPending}
              className="flex-1 gap-2"
            >
              {discoverPhoneNumbers.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              اكتشاف الأرقام تلقائياً
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: pick phone + branch */}
      {step === 2 && (
        <div className="space-y-4">
          {!manualMode && phones.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="w-4 h-4" /> اختر رقم WhatsApp Business
              </Label>
              <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر رقماً" />
                </SelectTrigger>
                <SelectContent>
                  {phones.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span dir="ltr">+{p.display_phone_number}</span>
                        {p.verified_name && <span className="text-xs text-muted-foreground">— {p.verified_name}</span>}
                        {p.quality_rating && (
                          <Badge variant="outline" className="text-[10px]">{p.quality_rating}</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => setManualMode(true)}
              >
                إدخال يدوي بدلاً من ذلك
              </button>
            </div>
          )}

          {manualMode && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>رقم WhatsApp Business</Label>
                <Input
                  type="tel"
                  placeholder="+249911234567"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="text-left" dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number ID</Label>
                <Input
                  placeholder="123456789012345"
                  value={manualPhoneNumberId}
                  onChange={(e) => setManualPhoneNumberId(e.target.value)}
                  className="text-left font-mono" dir="ltr"
                />
              </div>
              {phones.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setManualMode(false)}
                >
                  ↩ العودة للاختيار التلقائي
                </button>
              )}
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-border/40">
            <Label>الفرع</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!useCustomBranch ? "default" : "outline"}
                size="sm"
                onClick={() => { setUseCustomBranch(false); setCustomBranchName(""); }}
                className="flex-1"
              >
                اختر من الموجود
              </Button>
              <Button
                type="button"
                variant={useCustomBranch ? "default" : "outline"}
                size="sm"
                onClick={() => { setUseCustomBranch(true); setSelectedBranch(""); }}
                className="flex-1"
              >
                أدخل اسم جديد
              </Button>
            </div>
            {!useCustomBranch ? (
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  {availableBranches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="أدخل اسم الفرع الجديد"
                value={customBranchName}
                onChange={(e) => setCustomBranchName(e.target.value)}
              />
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
              <ArrowRight className="w-4 h-4" /> رجوع
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                addMetaConnection.isPending ||
                !finalPhoneNumber || !finalPhoneNumberId ||
                (!useCustomBranch && !selectedBranch) ||
                (useCustomBranch && !customBranchName.trim())
              }
              className="flex-1 gap-2"
            >
              {addMetaConnection.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              حفظ ومتابعة
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Webhook config values */}
      {step === 3 && (
        <div className="space-y-4">
          <Alert className="bg-emerald-500/10 border-emerald-500/30">
            <Shield className="h-4 w-4 text-emerald-400" />
            <AlertDescription className="text-sm">
              <strong>خطوة أخيرة:</strong> ألصق القيمتين التاليتين في
              {" "}<strong>Meta → WhatsApp → Configuration → Webhook</strong>{" "}
              ثم اضغط <em>Verify and Save</em>.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label className="text-xs">Callback URL</Label>
            <div className="flex gap-2">
              <Input value={effectiveWebhookUrl} readOnly className="font-mono text-xs bg-muted/30" dir="ltr" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(effectiveWebhookUrl, "Callback URL")}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Verify Token <Badge variant="outline" className="text-[10px]">مخصص لفرعك</Badge></Label>
            <div className="flex gap-2">
              <Input value={savedVerifyToken} readOnly className="font-mono text-xs bg-muted/30" dir="ltr" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(savedVerifyToken, "Verify Token")}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => copyToClipboard(
              `Callback URL:\n${effectiveWebhookUrl}\n\nVerify Token:\n${savedVerifyToken}`,
              "الاثنين معاً",
            )}
          >
            <Copy className="w-4 h-4" /> نسخ الاثنين معاً
          </Button>

          <Alert className="bg-blue-500/10 border-blue-500/30">
            <AlertDescription className="text-xs">
              بعد الحفظ، فعّل حقل <strong>"messages"</strong> من Webhook Fields.
              اضغط <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">هنا</a> لفتح لوحة Meta.
            </AlertDescription>
          </Alert>

          <Button className="w-full gap-2" onClick={onDone}>
            <CheckCircle className="w-4 h-4" /> تم — إغلاق
          </Button>
        </div>
      )}
    </div>
  );
}
