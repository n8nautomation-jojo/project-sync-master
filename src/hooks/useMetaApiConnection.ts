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

export const useMetaApiConnection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  // Add Meta API Connection
  const addMetaConnection = useMutation({
    mutationFn: async ({ branchId, phoneNumber, phoneNumberId, accessToken }: AddMetaConnectionParams) => {
      if (!currentOrganization?.id) {
        throw new Error("لا توجد مؤسسة محددة");
      }

      const { data, error } = await supabase
        .from("whatsapp_connections")
        .insert({
          branch_id: branchId,
          phone_number: phoneNumber,
          connection_type: "meta",
          meta_phone_number_id: phoneNumberId,
          access_token: accessToken,
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connections"] });
      toast({
        title: "تم الربط بنجاح",
        description: "تم ربط WhatsApp Cloud API بالفرع بنجاح.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في الربط",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test Meta API Connection
  const testMetaConnection = useMutation({
    mutationFn: async ({ phoneNumberId, accessToken }: TestMetaConnectionParams) => {
      // Test by getting phone number details from Meta Graph API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "فشل الاتصال بـ Meta API");
      }

      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "الاتصال ناجح ✓",
        description: `تم التحقق من الرقم: ${data.display_phone_number || data.verified_name || "رقم صالح"}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "فشل الاتصال",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get Webhook URL for Meta
  const getMetaWebhookUrl = () => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!baseUrl) return "";
    return new URL("/functions/v1/meta-webhook", baseUrl).toString();
  };

  return {
    addMetaConnection,
    testMetaConnection,
    getMetaWebhookUrl,
  };
};
