import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface AddMetaConnectionParams {
  branchId: string;
  phoneNumber: string;
  phoneNumberId: string;
  accessToken: string;
}

interface TestMetaConnectionParams {
  phoneNumberId: string;
  accessToken: string;
}

export interface DiscoveredPhone {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  waba_id: string;
}

// Generate a URL-safe random verify token unique per connection.
function generateVerifyToken(): string {
  const uuid = (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `hst_${String(uuid).replace(/-/g, "")}`.substring(0, 48);
}

export const useMetaApiConnection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  const addMetaConnection = useMutation({
    mutationFn: async ({ branchId, phoneNumber, phoneNumberId, accessToken }: AddMetaConnectionParams) => {
      if (!currentOrganization?.id) {
        throw new Error("لا توجد مؤسسة محددة");
      }

      const verifyToken = generateVerifyToken();

      // Insert connection without token
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .insert({
          branch_id: branchId,
          phone_number: phoneNumber,
          connection_type: "meta",
          meta_phone_number_id: phoneNumberId,
          webhook_verify_token: verifyToken,
          status: "pending",
          organization_id: currentOrganization.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("هذا الفرع مرتبط بالفعل برقم WhatsApp");
        }
        throw error;
      }

      // Insert credentials separately
      const { error: credError } = await supabase
        .from("whatsapp_credentials")
        .insert({
          connection_id: data.id,
          access_token: accessToken,
        });

      if (credError) throw credError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connections"] });
      toast({ title: "تم الحفظ بنجاح", description: "بقي فقط إعداد Webhook في Meta ثم سيتصل تلقائياً." });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ في الربط", description: error.message, variant: "destructive" });
    },
  });

  const testMetaConnection = useMutation({
    mutationFn: async ({ phoneNumberId, accessToken }: TestMetaConnectionParams) => {
      const response = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || "فشل الاتصال بـ Meta API");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "الاتصال ناجح ✓",
        description: `تم التحقق من الرقم: ${data.display_phone_number || data.verified_name || "رقم صالح"}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "فشل الاتصال", description: error.message, variant: "destructive" });
    },
  });

  const discoverPhoneNumbers = useMutation({
    mutationFn: async ({ accessToken }: { accessToken: string }): Promise<DiscoveredPhone[]> => {
      const { data, error } = await supabase.functions.invoke("meta-list-phone-numbers", {
        body: { accessToken },
      });
      if (error) throw new Error(error.message || "فشل جلب الأرقام");
      if ((data as any)?.error) throw new Error((data as any).error);
      return ((data as any)?.phones || []) as DiscoveredPhone[];
    },
    onError: (error: Error) => {
      toast({ title: "تعذّر جلب الأرقام", description: error.message, variant: "destructive" });
    },
  });

  const getMetaWebhookUrl = () => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!baseUrl) return "";
    return new URL("/functions/v1/meta-webhook", baseUrl).toString();
  };

  return { addMetaConnection, testMetaConnection, discoverPhoneNumbers, getMetaWebhookUrl };
};
