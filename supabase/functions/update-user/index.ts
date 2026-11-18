
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

interface UpdateUserRequest {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
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

    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      console.error("Role verification failed:", rolesError);
      return respond({ error: "Vérification des droits impossible" }, 500);
    }

    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

    let body: UpdateUserRequest;

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
      return respond({ error: "userId invalide" }, 400);
    }

    const { userId, firstName, lastName, email, phone, avatarUrl } = body;

    if (!isAdmin && user.id !== userId) {
      return respond(
        { error: "Vous ne pouvez modifier que votre propre profil" },
        403
      );
    }

    // Email changes must use a separate verified workflow.
    // This endpoint does not change email for any role.
    if (email !== undefined) {
      return respond(
        {
          error:
            "La modification d'email doit passer par une procédure de vérification dédiée",
        },
        403
      );
    }

    const profileUpdate: Record<string, string | null> = {};

    if (firstName !== undefined) {
      if (typeof firstName !== "string" || firstName.trim().length > 100) {
        return respond({ error: "Prénom invalide" }, 400);
      }
      profileUpdate.first_name = firstName.trim();
    }

    if (lastName !== undefined) {
      if (typeof lastName !== "string" || lastName.trim().length > 100) {
        return respond({ error: "Nom invalide" }, 400);
      }
      profileUpdate.last_name = lastName.trim();
    }

    if (phone !== undefined) {
      if (
        typeof phone !== "string" ||
        phone.length > 30 ||
        !/^[+0-9()\s.-]*$/.test(phone)
      ) {
        return respond({ error: "Téléphone invalide" }, 400);
      }
      profileUpdate.phone = phone.trim() || null;
    }

    if (avatarUrl !== undefined) {
      if (
        avatarUrl !== null &&
        (typeof avatarUrl !== "string" || avatarUrl.length > 2048)
      ) {
        return respond({ error: "Avatar invalide" }, 400);
      }

      if (typeof avatarUrl === "string" && avatarUrl.length > 0) {
        try {
          const parsed = new URL(avatarUrl);
          if (parsed.protocol !== "https:") {
            return respond({ error: "URL avatar non sécurisée" }, 400);
          }
        } catch {
          return respond({ error: "URL avatar invalide" }, 400);
        }
      }

      profileUpdate.avatar_url = avatarUrl || null;
    }

    if (Object.keys(profileUpdate).length === 0) {
      return respond({ error: "Aucune modification fournie" }, 400);
    }

    const { data: updatedProfiles, error: updateError } = await adminClient
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", userId)
      .select("user_id");

    if (updateError) {
      console.error("Profile update failed:", updateError);
      return respond({ error: "Modification impossible" }, 500);
    }

    if (!updatedProfiles?.length) {
      return respond({ error: "Profil introuvable" }, 404);
    }

    return respond({
      success: true,
      message: "Profil mis à jour avec succès",
    });
  } catch (error) {
    console.error("Unexpected update-user error:", error);
    return respond({ error: "Erreur interne du serveur" }, 500);
  }
});
