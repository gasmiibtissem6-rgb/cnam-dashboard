
import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  firstName: string;
  lastName: string;
  onAvatarChange: (url: string | null) => void;
  size?: "sm" | "md" | "lg";
}

export function AvatarUpload({
  userId,
  currentAvatarUrl,
  firstName,
  lastName,
  onAvatarChange,
  size = "md",
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentAvatarUrl || null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!localPreviewRef.current) {
      setPreviewUrl(currentAvatarUrl || null);
    }
  }, [currentAvatarUrl]);

  useEffect(() => {
    return () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
    };
  }, []);

  const clearLocalPreview = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
  };

  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32",
  };

  const getAvatarPath = (url: string): string | null => {
    try {
      const parsedUrl = new URL(url);
      const marker = "/avatars/";
      const markerIndex = parsedUrl.pathname.indexOf(marker);

      if (markerIndex === -1) {
        return null;
      }

      return decodeURIComponent(
        parsedUrl.pathname.substring(markerIndex + marker.length)
      );
    } catch {
      return null;
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Type de fichier non autorisé",
        description:
          "Veuillez sélectionner une image (JPEG, PNG, WebP, GIF).",
      });

      event.target.value = "";
      return;
    }

    const maxFileSize = 5 * 1024 * 1024;

    if (file.size > maxFileSize) {
      toast({
        variant: "destructive",
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 5 Mo.",
      });

      event.target.value = "";
      return;
    }

    setIsUploading(true);

    try {
      // Créer un aperçu local
      clearLocalPreview();

      const localPreview = URL.createObjectURL(file);
      localPreviewRef.current = localPreview;
      setPreviewUrl(localPreview);

      // Déterminer l'extension depuis le type MIME validé
      const extensions: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      };

      const fileExt = extensions[file.type];
      const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`;

      // Envoyer la nouvelle photo
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Récupérer l'URL publique
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Informer le composant parent
      onAvatarChange(publicUrl);

      // Mettre à jour l'aperçu
      clearLocalPreview();
      setPreviewUrl(publicUrl);

      // Supprimer l'ancienne photo après le nouvel upload
      if (currentAvatarUrl) {
        const oldPath = getAvatarPath(currentAvatarUrl);

        if (oldPath && oldPath !== fileName) {
          const { error: removeError } = await supabase.storage
            .from("avatars")
            .remove([oldPath]);

          if (removeError) {
            console.warn(
              "Impossible de supprimer l'ancien avatar :",
              removeError
            );
          }
        }
      }

      toast({
        title: "Photo mise à jour",
        description:
          "Votre photo de profil a été mise à jour avec succès.",
      });
    } catch (error: unknown) {
      console.error("Upload error:", error);

      clearLocalPreview();
      setPreviewUrl(currentAvatarUrl || null);

      toast({
        variant: "destructive",
        title: "Erreur d'upload",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de télécharger l'image.",
      });
    } finally {
      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentAvatarUrl) return;

    setIsUploading(true);

    try {
      const oldPath = getAvatarPath(currentAvatarUrl);

      if (oldPath) {
        const { error: removeError } = await supabase.storage
          .from("avatars")
          .remove([oldPath]);

        if (removeError) {
          throw removeError;
        }
      }

      clearLocalPreview();
      setPreviewUrl(null);
      onAvatarChange(null);

      toast({
        title: "Photo supprimée",
        description: "Votre photo de profil a été supprimée.",
      });
    } catch (error: unknown) {
      console.error("Delete avatar error:", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la photo.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className={sizeClasses[size]}>
          <AvatarImage
            src={previewUrl || undefined}
            alt={`${firstName} ${lastName}`}
          />

          <AvatarFallback className="text-lg font-medium bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Camera className="h-4 w-4 mr-2" />
          {previewUrl ? "Changer" : "Ajouter"}
        </Button>

        {previewUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveAvatar}
            disabled={isUploading}
          >
            <X className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        )}
      </div>
    </div>
  );
}
