import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WabaPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
}

// Lightweight in-memory rate limiter per authenticated user (10/min).
const RATE: Map<string, { count: number; resetAt: number }> = new Map();
function rateCheck(userId: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const rec = RATE.get(userId);
  if (!rec || rec.resetAt < now) {
    RATE.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (rec.count >= limit) return false;
  rec.count += 1;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rateCheck(user.id)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = String(body?.accessToken || "").trim();
    if (!accessToken || accessToken.length < 20 || accessToken.length > 4000) {
      return new Response(JSON.stringify({ error: "Access token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Discover WABA IDs owned by this token via /me/businesses -> owned_whatsapp_business_accounts
    //    Fallback: /debug_token to find app-scoped ids, or /me/accounts.
    // The most reliable public path: GET /{whatsapp_business_account_id}/phone_numbers
    // requires the WABA id. We try /me?fields=... to enumerate.

    const wabaIds = new Set<string>();

    // Try /me/businesses
    try {
      const r = await fetch(
        `https://graph.facebook.com/v20.0/me/businesses?fields=owned_whatsapp_business_accounts{id,name}&access_token=${encodeURIComponent(accessToken)}`,
      );
      if (r.ok) {
        const j = await r.json();
        for (const biz of j?.data || []) {
          for (const w of biz?.owned_whatsapp_business_accounts?.data || []) {
            if (w?.id) wabaIds.add(String(w.id));
          }
        }
      }
    } catch { /* ignore */ }

    // Try debug_token (system-user tokens expose granular_scopes with target_ids as WABA ids)
    try {
      const r = await fetch(
        `https://graph.facebook.com/v20.0/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(accessToken)}`,
      );
      if (r.ok) {
        const j = await r.json();
        const scopes = j?.data?.granular_scopes || [];
        for (const s of scopes) {
          if (s?.scope === "whatsapp_business_messaging" || s?.scope === "whatsapp_business_management") {
            for (const id of s?.target_ids || []) wabaIds.add(String(id));
          }
        }
      }
    } catch { /* ignore */ }

    if (wabaIds.size === 0) {
      return new Response(
        JSON.stringify({
          error: "لم نتمكن من العثور على أي WhatsApp Business Account مرتبط بهذا الـ Token. تأكد من صلاحيات whatsapp_business_management + messaging.",
          phones: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) For each WABA, fetch phone_numbers
    const phones: (WabaPhoneNumber & { waba_id: string })[] = [];
    for (const wabaId of wabaIds) {
      try {
        const r = await fetch(
          `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status&access_token=${encodeURIComponent(accessToken)}`,
        );
        if (r.ok) {
          const j = await r.json();
          for (const p of j?.data || []) {
            phones.push({
              id: String(p.id),
              display_phone_number: String(p.display_phone_number || ""),
              verified_name: p.verified_name || undefined,
              quality_rating: p.quality_rating || undefined,
              code_verification_status: p.code_verification_status || undefined,
              waba_id: wabaId,
            });
          }
        }
      } catch { /* ignore */ }
    }

    return new Response(JSON.stringify({ phones }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meta-list-phone-numbers error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
