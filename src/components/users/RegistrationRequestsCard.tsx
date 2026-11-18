
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UserPlus,
  Clock,
  Check,
  X,
  Loader2,
  Mail,
  Phone,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  FileText,
  Building2,
  Eye,
  Hash,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RegistrationRequest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  request_type: string;
  cnam_number: string | null;
  document_url: string | null;
  organization_name: string | null;
  organization_type: string | null;
  license_number: string | null;
}

interface RegistrationRequestsCardProps {
  onUserCreated: () => void;
}

export function RegistrationRequestsCard({
  onUserCreated,
}: RegistrationRequestsCardProps) {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] =
    useState<RegistrationRequest | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isDocPreviewOpen, setIsDocPreviewOpen] = useState(false);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("user");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const { toast } = useToast();
  const { session, isAdminSuperieur } = useAuth();

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("registration_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setRequests((data as RegistrationRequest[]) || []);
    } catch (error: unknown) {
      console.error("Error fetching registration requests:", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les demandes.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const handleApprove = (request: RegistrationRequest) => {
    setSelectedRequest(request);

    const roleMap: Record<string, AppRole> = {
      user: "user",
      prestataire: "prestataire",
      admin: "admin",
      it_engineer: "security_engineer",
    };

    setSelectedRole(roleMap[request.request_type] || "user");
    setIsApproveDialogOpen(true);
  };

  const handleReject = (request: RegistrationRequest) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setIsRejectDialogOpen(true);
  };

  const handlePreviewDocument = async (documentUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("registration-documents")
        .createSignedUrl(documentUrl, 300);

      if (error) {
        throw error;
      }

      setDocPreviewUrl(data.signedUrl);
      setIsDocPreviewOpen(true);
    } catch (error: unknown) {
      console.error("Error loading document:", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger le document.",
      });
    }
  };

  const confirmApprove = async () => {
    if (!selectedRequest || !session?.access_token) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", selectedRequest.email)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (existingProfile) {
        throw new Error(
          "Un utilisateur avec cette adresse email existe déjà. Veuillez vérifier ou supprimer le compte existant avant de réapprouver."
        );
      }

      const chars = "abcdefghijklmnopqrstuvwxyz";
      const upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const numbers = "0123456789";
      const special = "!@#$%^&*";

      const randomCharacter = (characters: string): string => {
        const randomValue = new Uint32Array(1);
        const max = Math.floor(0x100000000 / characters.length) * characters.length;

        do {
          crypto.getRandomValues(randomValue);
        } while (randomValue[0] >= max);

        return characters[randomValue[0] % characters.length];
      };

      let tempPassword = "CNAM_";

      for (let i = 0; i < 4; i++) {
        tempPassword += randomCharacter(chars);
      }

      for (let i = 0; i < 3; i++) {
        tempPassword += randomCharacter(upperChars);
      }

      for (let i = 0; i < 2; i++) {
        tempPassword += randomCharacter(numbers);
      }

      tempPassword += randomCharacter(special);

      const { data, error } = await supabase.functions.invoke(
        "create-user",
        {
          body: {
            email: selectedRequest.email,
            password: tempPassword,
            firstName: selectedRequest.first_name,
            lastName: selectedRequest.last_name,
            phone: selectedRequest.phone,
            roles: [selectedRole],
          },
        }
      );

      if (error) {
        let errorMessage = "Impossible de créer le compte.";

        try {
          const context = error.context;

          if (context && typeof context.json === "function") {
            const body: unknown = await context.json();

            if (
              typeof body === "object" &&
              body !== null &&
              "error" in body &&
              typeof body.error === "string"
            ) {
              errorMessage = body.error;
            }
          }
        } catch (parseError: unknown) {
          console.error(
            "Impossible de lire la réponse d'erreur :",
            parseError
          );
        }

        throw new Error(errorMessage);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const { error: emailError } = await supabase.functions.invoke(
        "send-welcome-email",
        {
          body: {
            email: selectedRequest.email,
            firstName: selectedRequest.first_name,
            lastName: selectedRequest.last_name,
            tempPassword,
            role: selectedRole,
          },
        }
      );

      if (emailError) {
        console.error("Welcome email error:", emailError);
      }

      const { error: decisionEmailError } =
        await supabase.functions.invoke("send-registration-decision", {
          body: {
            email: selectedRequest.email,
            firstName: selectedRequest.first_name,
            lastName: selectedRequest.last_name,
            decision: "approved",
            requestType: selectedRequest.request_type,
          },
        });

      if (decisionEmailError) {
        console.error(
          "Approval notification error:",
          decisionEmailError
        );
      }

      const { error: updateError } = await supabase
        .from("registration_requests")
        .update({
          status: "approved",
          reviewed_by: session.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Compte créé",
        description: `Le compte pour ${selectedRequest.first_name} ${selectedRequest.last_name} a été créé. L'envoi des emails a été demandé.`,
      });

      setIsApproveDialogOpen(false);
      void fetchRequests();
      onUserCreated();
    } catch (error: unknown) {
      console.error("Error approving registration:", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de créer le compte.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmReject = async () => {
    if (!selectedRequest || !session) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("registration_requests")
        .update({
          status: "rejected",
          reviewed_by: session.user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
        })
        .eq("id", selectedRequest.id);

      if (error) {
        throw error;
      }

      const { error: emailError } = await supabase.functions.invoke(
        "send-registration-decision",
        {
          body: {
            email: selectedRequest.email,
            firstName: selectedRequest.first_name,
            lastName: selectedRequest.last_name,
            decision: "rejected",
            rejectionReason: rejectionReason || undefined,
            requestType: selectedRequest.request_type,
          },
        }
      );

      if (emailError) {
        console.error("Rejection notification error:", emailError);
      }

      toast({
        title: "Demande rejetée",
        description: `La demande de ${selectedRequest.first_name} ${selectedRequest.last_name} a été rejetée.`,
      });

      setIsRejectDialogOpen(false);
      void fetchRequests();
    } catch (error: unknown) {
      console.error("Error rejecting registration request:", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de rejeter la demande.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            <Clock className="h-3 w-3 mr-1" />
            En attente
          </Badge>
        );

      case "approved":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            <Check className="h-3 w-3 mr-1" />
            Approuvée
          </Badge>
        );

      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            <X className="h-3 w-3 mr-1" />
            Rejetée
          </Badge>
        );

      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "prestataire":
        return (
          <Badge variant="secondary" className="gap-1">
            <Building2 className="h-3 w-3" />
            Prestataire
          </Badge>
        );

      case "admin":
        return (
          <Badge
            variant="secondary"
            className="gap-1 bg-destructive/10 text-destructive border-destructive/20"
          >
            <ShieldCheck className="h-3 w-3" />
            Admin
          </Badge>
        );

      case "it_engineer":
        return (
          <Badge
            variant="secondary"
            className="gap-1 bg-primary/10 text-primary border-primary/20"
          >
            <ShieldCheck className="h-3 w-3" />
            IT Sécurité
          </Badge>
        );

      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <UserPlus className="h-3 w-3" />
            Assuré
          </Badge>
        );
    }
  };

  const orgTypeLabels: Record<string, string> = {
    hospital: "Hôpital",
    doctor: "Cabinet médical",
    pharmacy: "Pharmacie",
    laboratory: "Laboratoire",
  };

  const filteredRequests = requests.filter((request) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return request.status === "pending";
    if (activeTab === "user") return request.request_type === "user";
    if (activeTab === "prestataire") {
      return request.request_type === "prestataire";
    }
    if (activeTab === "internal") {
      return (
        request.request_type === "admin" ||
        request.request_type === "it_engineer"
      );
    }
    return true;
  });

  const pendingCount = requests.filter(
    (request) => request.status === "pending"
  ).length;

  const pendingUsers = requests.filter(
    (request) =>
      request.status === "pending" &&
      request.request_type === "user"
  ).length;

  const pendingPrestataires = requests.filter(
    (request) =>
      request.status === "pending" &&
      request.request_type === "prestataire"
  ).length;

  const pendingInternal = requests.filter(
    (request) =>
      request.status === "pending" &&
      (request.request_type === "admin" ||
        request.request_type === "it_engineer")
  ).length;

  const getRoleOptions = () => {
    const base = [
      { value: "user", label: "Utilisateur (Assuré)" },
      { value: "prestataire", label: "Prestataire" },
      { value: "admin", label: "Administrateur" },
      { value: "security_engineer", label: "Ingénieur Sécurité (IT)" },
    ];

    if (isAdminSuperieur) {
      base.push({
        value: "admin_superieur",
        label: "Admin Supérieur",
      });
    }

    return base;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Vérification des demandes
            {pendingCount > 0 && (
              <Badge variant="destructive">{pendingCount}</Badge>
            )}
          </CardTitle>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchRequests()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
          </Button>
        </CardHeader>

        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="mb-4"
          >
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="all">
                Toutes ({requests.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                En attente ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="user">
                Assurés ({pendingUsers})
              </TabsTrigger>
              <TabsTrigger value="prestataire">
                Prestataires ({pendingPrestataires})
              </TabsTrigger>
              <TabsTrigger value="internal">
                Internes ({pendingInternal})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune demande.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">
                          {request.first_name} {request.last_name}
                        </h4>
                        {getTypeBadge(request.request_type)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {request.email}
                        </span>

                        {request.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {request.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          Email vérifié
                        </Badge>

                        {request.document_url && (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Document joint
                          </Badge>
                        )}
                      </div>
                    </div>

                    {getStatusBadge(request.status)}
                  </div>

                  <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                    {request.request_type === "user" &&
                      request.cnam_number && (
                        <p className="flex items-center gap-2">
                          <Hash className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">
                            N° CNAM:
                          </span>
                          {request.cnam_number}
                        </p>
                      )}

                    {request.request_type === "prestataire" && (
                      <>
                        {request.organization_name && (
                          <p>
                            <span className="font-medium">
                              Établissement:
                            </span>{" "}
                            {request.organization_name}
                          </p>
                        )}

                        {request.organization_type && (
                          <p>
                            <span className="font-medium">
                              Type:
                            </span>{" "}
                            {orgTypeLabels[
                              request.organization_type
                            ] || request.organization_type}
                          </p>
                        )}

                        {request.license_number && (
                          <p>
                            <span className="font-medium">
                              N° Licence:
                            </span>{" "}
                            {request.license_number}
                          </p>
                        )}
                      </>
                    )}

                    {request.message && (
                      <p className="flex items-start gap-1 text-muted-foreground">
                        <MessageSquare className="h-3 w-3 mt-0.5" />
                        {request.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString(
                        "fr-FR",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>

                    <div className="flex gap-2">
                      {request.document_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void handlePreviewDocument(
                              request.document_url!
                            )
                          }
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Document
                        </Button>
                      )}

                      {request.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleReject(request)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleApprove(request)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approuver
                          </Button>
                        </>
                      )}

                      {request.status === "rejected" &&
                        request.rejection_reason && (
                          <span className="text-xs text-red-600">
                            Motif: {request.rejection_reason}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog
        open={isApproveDialogOpen}
        onOpenChange={setIsApproveDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Approuver et créer le compte
            </DialogTitle>

            <DialogDescription>
              Créer un compte pour {selectedRequest?.first_name}{" "}
              {selectedRequest?.last_name}
              {selectedRequest?.request_type === "prestataire" &&
                selectedRequest?.organization_name && (
                  <> — {selectedRequest.organization_name}</>
                )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rôle à attribuer</Label>

              <Select
                value={selectedRole}
                onValueChange={(value) =>
                  setSelectedRole(value as AppRole)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {getRoleOptions().map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted p-3 rounded-md text-sm space-y-1">
              <p className="font-medium mb-1">
                Résumé de la vérification :
              </p>

              <p>
                Email: {selectedRequest?.email}{" "}
                <span className="text-emerald-600">
                  ✓ vérifié
                </span>
              </p>

              {selectedRequest?.cnam_number && (
                <p>
                  N° CNAM: {selectedRequest.cnam_number}
                </p>
              )}

              {selectedRequest?.organization_name && (
                <p>
                  Établissement: {selectedRequest.organization_name}
                </p>
              )}

              {selectedRequest?.license_number && (
                <p>
                  Licence: {selectedRequest.license_number}
                </p>
              )}

              {selectedRequest?.document_url && (
                <p>📎 Document justificatif joint</p>
              )}

              <p className="text-muted-foreground mt-2">
                Un mot de passe temporaire sera généré et envoyé
                par email.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
            >
              Annuler
            </Button>

            <Button
              onClick={() => void confirmApprove()}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer le compte"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={isRejectDialogOpen}
        onOpenChange={setIsRejectDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la demande</DialogTitle>

            <DialogDescription>
              Refuser la demande de {selectedRequest?.first_name}{" "}
              {selectedRequest?.last_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motif du rejet</Label>

              <Textarea
                placeholder="Précisez la raison..."
                value={rejectionReason}
                onChange={(event) =>
                  setRejectionReason(event.target.value)
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
            >
              Annuler
            </Button>

            <Button
              variant="destructive"
              onClick={() => void confirmReject()}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejet...
                </>
              ) : (
                "Rejeter"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog
        open={isDocPreviewOpen}
        onOpenChange={setIsDocPreviewOpen}
      >
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Aperçu du document</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {docPreviewUrl &&
              (docPreviewUrl.match(
                /\.(jpg|jpeg|png|webp)(\?|$)/i
              ) ? (
                <img
                  src={docPreviewUrl}
                  alt="Document"
                  className="w-full rounded-md"
                />
              ) : (
                <iframe
                  src={docPreviewUrl}
                  className="w-full h-[60vh] rounded-md border"
                  title="Document preview"
                />
              ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDocPreviewOpen(false)}
            >
              Fermer
            </Button>

            {docPreviewUrl && (
              <Button asChild>
                <a
                  href={docPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ouvrir dans un nouvel onglet
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
