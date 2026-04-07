import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useBranchAccess } from "@/hooks/useBranchAccess";

export type TransferStats = {
  total: number;
  pending: number;
  confirmed: number;
};

export type Transfer = Tables<"transfers"> & {
  branches?: { name: string } | null;
};

const PAGE_SIZE = 50;

export function useTransfers(page: number = 0) {
  const { currentOrganization } = useAuth();
  const { restrictedBranchId } = useBranchAccess();
  
  return useQuery({
    queryKey: ["transfers", currentOrganization?.id, restrictedBranchId, page],
    queryFn: async () => {
      if (!currentOrganization?.id) return { data: [], count: 0 };
      
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("transfers")
        .select(`*, branches (name)`, { count: "exact" })
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false })
        .range(from, to);
      
      if (restrictedBranchId) {
        query = query.eq("branch_id", restrictedBranchId);
      }

      const { data, error, count } = await query;
      
      if (error) throw error;
      return { data: data as Transfer[], count: count || 0 };
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useTransferStats() {
  const { currentOrganization } = useAuth();
  const { restrictedBranchId } = useBranchAccess();

  return useQuery({
    queryKey: ["transfer-stats", currentOrganization?.id, restrictedBranchId],
    queryFn: async (): Promise<TransferStats> => {
      if (!currentOrganization?.id) return { total: 0, pending: 0, confirmed: 0 };

      let totalQuery = supabase
        .from("transfers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", currentOrganization.id);

      let confirmedQuery = supabase
        .from("transfers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", currentOrganization.id)
        .eq("is_confirmed", true);

      if (restrictedBranchId) {
        totalQuery = totalQuery.eq("branch_id", restrictedBranchId);
        confirmedQuery = confirmedQuery.eq("branch_id", restrictedBranchId);
      }

      const { count: total } = await totalQuery;
      const { count: confirmed } = await confirmedQuery;

      const t = total || 0;
      const c = confirmed || 0;
      return { total: t, pending: t - c, confirmed: c };
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useTransfersPagination() {
  const [page, setPage] = useState(0);
  const query = useTransfers(page);
  const statsQuery = useTransferStats();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();
  const totalPages = Math.ceil((query.data?.count || 0) / PAGE_SIZE);

  // Realtime subscription: auto-refresh when transfers change
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const channel = supabase
      .channel('transfers-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transfers',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["transfers", currentOrganization.id] });
          queryClient.invalidateQueries({ queryKey: ["transfer-stats", currentOrganization.id] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats", currentOrganization.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, queryClient]);

  return {
    ...query,
    transfers: query.data?.data || [],
    totalCount: query.data?.count || 0,
    stats: statsQuery.data || { total: 0, pending: 0, confirmed: 0 },
    page,
    setPage,
    totalPages,
    pageSize: PAGE_SIZE,
    hasNextPage: page < totalPages - 1,
    hasPrevPage: page > 0,
  };
}

export function useConfirmTransfer() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();
  
  return useMutation({
    mutationFn: async (transferId: string) => {
      const { error } = await supabase
        .from("transfers")
        .update({ 
          is_confirmed: true,
          confirmed_at: new Date().toISOString()
        })
        .eq("id", transferId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers", currentOrganization?.id] });
      toast.success("تم تأكيد التحويل بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء تأكيد التحويل");
    },
  });
}

export function useRejectTransfer() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (transferId: string) => {
      // Soft delete instead of hard delete
      const { error } = await supabase
        .from("transfers")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id || null,
        } as any)
        .eq("id", transferId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers", currentOrganization?.id] });
      toast.success("تم حذف التحويل");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف التحويل");
    },
  });
}

export function useResetAllTransfers() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!currentOrganization?.id) throw new Error('لا توجد مؤسسة محددة');

      const { data, error } = await supabase
        .rpc('soft_delete_all_transfers', {
          _organization_id: currentOrganization.id
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers", currentOrganization?.id] });
      queryClient.invalidateQueries({ queryKey: ["transfer-stats", currentOrganization?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats", currentOrganization?.id] });
      toast.success("تم إعادة تعيين جميع التحويلات بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء إعادة تعيين التحويلات");
    },
  });
}

export function useUpdateTransfer() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Tables<"transfers">> }) => {
      const { error } = await supabase
        .from("transfers")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers", currentOrganization?.id] });
      toast.success("تم تحديث التحويل بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء تحديث التحويل");
    },
  });
}

export type ExtractedTransferData = {
  amount: number | null;
  date: string | null;
  sender_name: string | null;
  reference_number: string | null;
  transaction_id: string | null;
  receiver_account: string | null;
  sender_account: string | null;
  bank_comment: string | null;
  confidence: number;
};

export function useExtractTransferAmount() {
  return useMutation({
    mutationFn: async ({ imageBase64, transferId }: { imageBase64: string; transferId?: string }): Promise<ExtractedTransferData> => {
      const { data, error } = await supabase.functions.invoke('extract-transfer-amount', {
        body: { imageBase64, transferId },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.data as ExtractedTransferData;
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "حدث خطأ أثناء استخراج البيانات");
    },
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();
  
  return useMutation({
    mutationFn: async (data: {
      branch_id: string;
      amount: number;
      transfer_date: string;
      sender_name?: string;
      sender_phone?: string;
      image_url?: string;
      notes?: string;
    }) => {
      if (!currentOrganization?.id) throw new Error('لا توجد مؤسسة محددة');
      
      const { data: newTransfer, error } = await supabase
        .from("transfers")
        .insert({
          ...data,
          organization_id: currentOrganization.id,
          is_confirmed: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return newTransfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers", currentOrganization?.id] });
      toast.success("تم إضافة التحويل بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء إضافة التحويل");
    },
  });
}
