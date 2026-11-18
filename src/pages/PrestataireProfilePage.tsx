
import { useState, useEffect } from "react";
import { PrestataireDashboardLayout } from "@/components/layout/PrestataireDashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Phone,
  Shield,
  Edit2,
  Save,
  X,
  Loader2,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PrestataireProfilePage() {
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    phone: profile?.phone ?? "",
  });

  useEffect(() => {
    if (!editing) {
      setFormData({
        first_name: profile?.first_name ?? "",
        last_name: profile?.last_name ?? "",
        phone: profile?.phone ?? "",
      });
    }
  }, [
    profile?.first_name,
    profile?.last_name,
    profile?.phone,
    editing,
  ]);

  const initials = profile
    ? `${profile.first_name?.charAt(0) ?? ""}${
        profile.last_name?.charAt(0) ?? ""
      }`.toUpperCase() || "?"
    : "?";

  const handleEdit = () => {
    setFormData({
      first_name: profile?.first_name ?? "",
      last_name: profile?.last_name ?? "",
      phone: profile?.phone ?? "",
    });

    setEditing(true);
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Utilisateur non connecté.",
      });
      return;
    }

    if (
      !formData.first_name.trim() ||
      !formData.last_name.trim()
    ) {
      toast({
        variant: "destructive",
        title: "Validation",
        description: "Le prénom et le nom sont obligatoires.",
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          phone: formData.phone.trim() || null,
        })
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Profil mis à jour",
        description:
          "Vos informations ont été enregistrées.",
      });

      setEditing(false);
    } catch (error: unknown) {
      console.error(
        "Erreur mise à jour du profil :",
        error
      );

      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour le profil.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: profile?.first_name ?? "",
      last_name: profile?.last_name ?? "",
      phone: profile?.phone ?? "",
    });

    setEditing(false);
  };

  return (
    <PrestataireDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Mon profil
          </h1>
          <p className="text-muted-foreground">
            Gérez vos informations personnelles
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <Card className="lg:row-span-2">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage
                  src={profile?.avatar_url || undefined}
                />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <h3 className="text-lg font-semibold">
                {profile?.first_name} {profile?.last_name}
              </h3>

              <p className="text-sm text-muted-foreground">
                {profile?.email || user?.email}
              </p>

              <Badge
                variant="outline"
                className="mt-3 gap-1.5"
              >
                <Shield className="h-3 w-3" />
                Prestataire
              </Badge>

              <Separator className="my-4 w-full" />

              <div className="w-full space-y-3 text-left">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    {profile?.email || user?.email || "—"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {profile?.phone || "Non renseigné"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Membre depuis{" "}
                    {user?.created_at
                      ? format(
                          new Date(user.created_at),
                          "dd MMMM yyyy",
                          { locale: fr }
                        )
                      : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editable Info */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Informations personnelles
              </CardTitle>

              {!editing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Annuler
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Enregistrer
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Prénom
                  </Label>

                  {editing ? (
                    <Input
                      value={formData.first_name}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          first_name: event.target.value,
                        })
                      }
                    />
                  ) : (
                    <p className="font-medium">
                      {profile?.first_name || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Nom
                  </Label>

                  {editing ? (
                    <Input
                      value={formData.last_name}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          last_name: event.target.value,
                        })
                      }
                    />
                  ) : (
                    <p className="font-medium">
                      {profile?.last_name || "—"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Email
                  </Label>

                  <p className="font-medium text-muted-foreground">
                    {profile?.email || user?.email || "—"}
                  </p>

                  <p className="text-xs text-muted-foreground italic">
                    L'email ne peut pas être modifié ici.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Téléphone
                  </Label>

                  {editing ? (
                    <Input
                      value={formData.phone}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          phone: event.target.value,
                        })
                      }
                      placeholder="+216 XX XXX XXX"
                    />
                  ) : (
                    <p className="font-medium">
                      {profile?.phone || "Non renseigné"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sécurité du compte
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">
                    Rôle
                  </p>
                  <p className="font-semibold text-sm">
                    Prestataire de santé
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">
                    Compte créé le
                  </p>
                  <p className="font-semibold text-sm">
                    {user?.created_at
                      ? format(
                          new Date(user.created_at),
                          "dd/MM/yyyy",
                          { locale: fr }
                        )
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PrestataireDashboardLayout>
  );
}
