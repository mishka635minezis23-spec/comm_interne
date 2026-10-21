import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeJson(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToBytes(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function getGoogleAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    encodeJson({ alg: "RS256", typ: "JWT" }),
    encodeJson({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  ].join(".");

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)
  ));
  const assertion = unsigned + "." + encodeBase64Url(signature);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error("Authentification Firebase refusée : " + JSON.stringify(payload));
  }
  return payload.access_token as string;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée." }), { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const serviceAccountText = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Configuration Supabase serveur manquante.");
    if (!serviceAccountText) throw new Error("Le secret FCM_SERVICE_ACCOUNT_JSON n'est pas encore configuré.");

    const authorization = request.headers.get("Authorization") || "";
    const jwt = authorization.replace(/^Bearer\s+/i, "");
    if (!jwt) return new Response(JSON.stringify({ error: "Authentification requise." }), { status: 401, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Session invalide." }), { status: 401, headers: corsHeaders });
    }

    const actorId = userData.user.id;
    const { data: actor, error: actorError } = await admin
      .from("staff_members").select("role,is_active").eq("id", actorId).maybeSingle();
    if (actorError || !actor?.is_active) {
      return new Response(JSON.stringify({ error: "Compte UJADI inactif ou introuvable." }), { status: 403, headers: corsHeaders });
    }

    const body = await request.json();
    const event = body?.event as string;
    const visitId = body?.visit_id as string;
    if (!visitId || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(visitId)) {
      return new Response(JSON.stringify({ error: "Identifiant de visite invalide." }), { status: 400, headers: corsHeaders });
    }
    if (!["visit_created", "visit_resolved", "member_acknowledged"].includes(event)) {
      return new Response(JSON.stringify({ error: "Événement non pris en charge." }), { status: 400, headers: corsHeaders });
    }

    const { data: visit, error: visitError } = await admin
      .from("visits").select("id,created_by,visitor_name").eq("id", visitId).maybeSingle();
    if (visitError || !visit) {
      return new Response(JSON.stringify({ error: "Demande introuvable." }), { status: 404, headers: corsHeaders });
    }

    const { data: recipients, error: recipientsError } = await admin
      .from("visit_recipients").select("member_id").eq("visit_id", visitId);
    if (recipientsError) throw recipientsError;
    const recipientIds = [...new Set((recipients || []).map(row => row.member_id as string))];
    const isRecipient = recipientIds.includes(actorId);
    const isReceptionRole = ["admin", "reception", "secretary"].includes(actor.role);

    if (event === "visit_created" && (!isReceptionRole || visit.created_by !== actorId)) {
      return new Response(JSON.stringify({ error: "Seule la réception qui a créé la demande peut alerter les destinataires." }), { status: 403, headers: corsHeaders });
    }
    if (event === "member_acknowledged" && !isRecipient) {
      return new Response(JSON.stringify({ error: "Tu n'es pas destinataire de cette demande." }), { status: 403, headers: corsHeaders });
    }
    if (event === "visit_resolved" && !isRecipient && !isReceptionRole) {
      return new Response(JSON.stringify({ error: "Action non autorisée pour cette demande." }), { status: 403, headers: corsHeaders });
    }

    const targetIds = event === "member_acknowledged" ? [actorId] : recipientIds;
    if (!targetIds.length) {
      return new Response(JSON.stringify({ sent: 0, message: "Aucun destinataire associé." }), { status: 200, headers: corsHeaders });
    }

    const { data: devices, error: devicesError } = await admin
      .from("devices").select("id,member_id,push_token")
      .in("member_id", targetIds).eq("platform", "android").eq("is_active", true)
      .not("push_token", "is", null);
    if (devicesError) throw devicesError;
    if (!devices?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "Aucun appareil Android enregistré." }), { status: 200, headers: corsHeaders });
    }

    const serviceAccount = JSON.parse(serviceAccountText) as Record<string, string>;
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const outgoingEvent = event === "visit_created" ? "visit_alert_start" : "visit_alert_stop";
    const results = await Promise.all(devices.map(async device => {
      const message = {
        message: {
          token: device.push_token,
          data: {
            event: outgoingEvent,
            visit_id: visitId,
            visitor_name: visit.visitor_name || "Visiteur"
          },
          android: {
            priority: "HIGH",
            ttl: "300s"
          }
        }
      };

      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + accessToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(message)
        }
      );
      if (!response.ok) {
        const details = await response.text();
        if (response.status === 404 || details.includes("UNREGISTERED")) {
          await admin.from("devices").update({ is_active: false }).eq("id", device.id);
        }
        return { device_id: device.id, sent: false, error: details.slice(0, 400) };
      }
      return { device_id: device.id, sent: true };
    }));

    return new Response(JSON.stringify({
      event: outgoingEvent,
      sent: results.filter(result => result.sent).length,
      failed: results.filter(result => !result.sent).length
    }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("send-visit-alert:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erreur interne."
    }), { status: 500, headers: corsHeaders });
  }
});
