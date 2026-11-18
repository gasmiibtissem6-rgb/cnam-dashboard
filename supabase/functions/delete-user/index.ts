
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

interface DeleteUserRequest {
  userId: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Méthode non autorisée" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ error: "Non autorisé" }, 401);
    }

    const token = authHeader.slice(7).trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("Missing Supabase environment variables");
      return respond({ error: "Configuration serveur invalide" }, 500);
    }

    const authClient = createClient(supabaseUrl, anonKey);

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return respond({ error: "Session invalide" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify administrator privileges server-side.
    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      console.error("Role verification failed:", rolesError);
      return respond({ error: "Vérification des droits impossible" }, 500);
    }

    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

    if (!isAdmin) {
      return respond(
        { error: "Seuls les administrateurs peuvent supprimer des comptes" },
        403
      );
    }

    let body: DeleteUserRequest;

    try {
      body = await req.json();
    } catch {
      return respond({ error: "JSON invalide" }, 400);
    }

    if (
      !body ||
      typeof body.userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.userId)
    ) {
      return respond({ error: "Identifiant utilisateur invalide" }, 400);
    }

    const { userId } = body;

    if (userId === user.id) {
      return respond(
        { error: "Vous ne pouvez pas supprimer votre propre compte" },
        403
      );
    }

    const { data: targetRoles, error: targetRolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (targetRolesError) {
      console.error("Target role verification failed:", targetRolesError);
      return respond({ error: "Vérification du compte impossible" }, 500);
    }

    // Protect every administrator from deletion through this endpoint.
    // Admin deletion requires a separate, explicitly approved workflow.
    const targetIsAdmin =
      targetRoles?.some((r) => r.role === "admin") ?? false;

    if (targetIsAdmin) {
      return respond(
        {
          error:
            "La suppression d'un administrateur nécessite une procédure spéciale",
        },
        403
      );
    }

    const { data: targetData, error: targetError } =
      await adminClient.auth.admin.getUserById(userId);

    if (targetError || !targetData?.user) {
      return respond({ error: "Utilisateur introuvable" }, 404);
    }

    const targetEmail = targetData.user.email ?? null;

    // Soft-delete the authentication account first.
    // This prevents login while preserving data for audit and recovery.
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId, true);

    if (deleteError) {
      console.error("Auth soft-delete failed:", deleteError);
      return respond({ error: "Suppression impossible" }, 500);
    }

    // Best-effort audit. An audit failure is reported in server logs.
    const { error: auditError } = await adminClient
      .from("audit_logs")
      .insert({
        user_id: user.id,
        action: "delete_user",
        target_table: "auth.users",
        target_id: userId,
        details: {
          deleted_email: targetEmail,
          performed_by: user.email ?? null,
          deletion_type: "soft",
        },
      });

    if (auditError) {
      console.error("Deletion audit failed:", auditError);
    }

    return respond({
      success: true,
      message: "Compte désactivé par suppression douce",
    });
  } catch (error) {
    console.error("Unexpected delete-user error:", error);
    return respond({ error: "Erreur interne du serveur" }, 500);
  }
});
