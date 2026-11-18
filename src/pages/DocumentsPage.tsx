
import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Search,
  MoreVertical,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  File,
  FileCheck,
  FileX,
  Loader2,
  Filter,
  Download,
  Upload,
} from "lucide-react";

import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { viewDocument, downloadDocument } from "@/lib/storageUtils";
import type { Database } from "@/integrations/supabase/types";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type DocumentStatus = Database["public"]["Enums"]["document_status"];

interface DocumentWithMember extends Document {
  insured_member?: {
    first_name: string;
    last_name: string;
    insurance_number: string;
  } | null;
}

interface MemberOption {
  id: string;
  name: string;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatNumber(num: number): string {
  return num.toLocaleString("fr-FR");
}

function getStatusBadge(status: DocumentStatus) {
  switch (status) {
    case "approved":
      return (
        <Badge className="badge-success">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approuvé
        </Badge>
      );

    case "rejected":
      return (
        <Badge className="badge-destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Rejeté
        </Badge>
      );

    default:
      return (
        <Badge className="badge-warning">
          <Clock className="h-3 w-3 mr-1" />
          En attente
        </Badge>
      );
  }
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentWithMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const [selectedDocument, setSelectedDocument] =
    useState<DocumentWithMember | null>(null);

  const [verificationNotes, setVerificationNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const { toast } = useToast();
  const { user } = useAuth();

  const fetchMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("insured_members")
        .select("id, first_name, last_name")
        .order("last_name", { ascending: true })
        .limit(100);

      if (error) throw error;

      const memberOptions: MemberOption[] = (data ?? []).map(
        (member) => ({
          id: member.id,
          name: `${member.first_name} ${member.last_name}`,
        })
      );

      setMembers(memberOptions);
    } catch (error: unknown) {
      console.error("Erreur chargement assurés :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger la liste des assurés.",
      });
    }
  }, [toast]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          insured_member:insured_members(
            first_name,
            last_name,
            insurance_number
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDocuments(data ?? []);
    } catch (error: unknown) {
      console.error("Erreur chargement documents :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les documents.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchMembers();
    void fetchDocuments();
  }, [fetchMembers, fetchDocuments]);

  const documentTypes = useMemo(() => {
    return [...new Set(documents.map((doc) => doc.document_type))];
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return documents.filter((doc) => {
      if (activeTab !== "all" && doc.status !== activeTab) {
        return false;
      }

      if (typeFilter !== "all" && doc.document_type !== typeFilter) {
        return false;
      }

      if (query) {
        const searchableText = [
          doc.file_name,
          doc.document_type,
          doc.insured_member?.first_name,
          doc.insured_member?.last_name,
          doc.insured_member?.insurance_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [documents, activeTab, typeFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = documents.length;

    const pending = documents.filter(
      (doc) => doc.status === "pending"
    ).length;

    const approved = documents.filter(
      (doc) => doc.status === "approved"
    ).length;

    const rejected = documents.filter(
      (doc) => doc.status === "rejected"
    ).length;

    const totalBytes = documents.reduce(
      (sum, doc) => sum + (doc.file_size ?? 0),
      0
    );

    const today = new Date().toLocaleDateString("en-CA");

    const todayUploads = documents.filter((doc) => {
      return (
        doc.upload_date &&
        new Date(doc.upload_date).toLocaleDateString("en-CA") === today
      );
    }).length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const processedThisMonth = documents.filter((doc) => {
      if (!doc.validation_date) return false;

      const validationDate = new Date(doc.validation_date);

      return (
        validationDate.getMonth() === currentMonth &&
        validationDate.getFullYear() === currentYear &&
        (doc.status === "approved" || doc.status === "rejected")
      );
    }).length;

    const decided = approved + rejected;

    const approvalRate =
      decided > 0 ? ((approved / decided) * 100).toFixed(1) : null;

    const rejectionRate =
      total > 0 ? ((rejected / total) * 100).toFixed(1) : null;

    return {
      total,
      pending,
      approved,
      rejected,
      totalSize: formatFileSize(totalBytes),
      todayUploads,
      processedThisMonth,
      typeCount: documentTypes.length,
      approvalRate,
      rejectionRate,
    };
  }, [documents, documentTypes]);

  const handleVerify = (doc: DocumentWithMember) => {
    setSelectedDocument(doc);
    setVerificationNotes(doc.validation_notes ?? "");
    setIsVerifyDialogOpen(true);
  };

  const handleUpdateStatus = async (status: DocumentStatus) => {
    if (!selectedDocument) return;

    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Accès refusé",
        description: "Vous devez être connecté.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("documents")
        .update({
          status,
          validation_notes: verificationNotes.trim() || null,
          validation_date: new Date().toISOString(),
          validator_id: user.id,
        })
        .eq("id", selectedDocument.id)
        .eq("status", "pending");

      if (error) throw error;

      toast({
        title: "Succès",
        description:
          status === "approved"
            ? "Document approuvé avec succès."
            : "Document rejeté avec succès.",
      });

      setIsVerifyDialogOpen(false);
      setSelectedDocument(null);

      await fetchDocuments();
    } catch (error: unknown) {
      console.error("Erreur validation document :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de modifier le statut du document.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDocument = async (doc: DocumentWithMember) => {
    if (!doc.file_url) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Ce document ne possède pas de fichier.",
      });
      return;
    }

    try {
      await viewDocument(doc.file_url);
    } catch (error: unknown) {
      console.error("Erreur visualisation document :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'ouvrir le document.",
      });
    }
  };

  const handleDownloadDocument = async (doc: DocumentWithMember) => {
    if (!doc.file_url) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Ce document ne possède pas de fichier.",
      });
      return;
    }

    try {
      await downloadDocument(doc.file_url, doc.file_name);
    } catch (error: unknown) {
      console.error("Erreur téléchargement document :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de télécharger le document.",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Documents & Pièces justificatives
            </h1>

            <p className="text-muted-foreground">
              Gérez et vérifiez les documents des assurés.
            </p>
          </div>

          <Button onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Téléverser un document
          </Button>
        </div>

        {/* Upload Dialog */}
        <DocumentUploadDialog
          open={isUploadDialogOpen}
          onOpenChange={setIsUploadDialogOpen}
          memberId={selectedMemberId || members[0]?.id}
          onSuccess={() => void fetchDocuments()}
        />

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <File className="h-6 w-6 text-primary" />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Total documents
                  </p>
                  <p className="text-2xl font-bold">
                    {formatNumber(stats.total)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-warning" />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    En attente
                  </p>
                  <p className="text-2xl font-bold">
                    {formatNumber(stats.pending)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <FileCheck className="h-6 w-6 text-success" />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Approuvés
                  </p>
                  <p className="text-2xl font-bold">
                    {formatNumber(stats.approved)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Taux d'approbation : {stats.approvalRate ?? "—"}
                    {stats.approvalRate !== null ? "%" : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <FileX className="h-6 w-6 text-destructive" />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Rejetés
                  </p>
                  <p className="text-2xl font-bold">
                    {formatNumber(stats.rejected)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.rejectionRate ?? "—"}
                    {stats.rejectionRate !== null ? "% du total" : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Taille des documents
              </p>
              <p className="text-3xl font-bold text-primary">
                {stats.totalSize}
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Téléversements aujourd'hui
              </p>
              <p className="text-3xl font-bold text-accent">
                {stats.todayUploads}
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Traités ce mois
              </p>
              <p className="text-3xl font-bold text-success">
                {stats.processedThisMonth}
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Types de documents
              </p>
              <p className="text-3xl font-bold text-warning">
                {stats.typeCount}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">
              Tous ({stats.total})
            </TabsTrigger>

            <TabsTrigger value="pending">
              En attente ({stats.pending})
            </TabsTrigger>

            <TabsTrigger value="approved">
              Approuvés ({stats.approved})
            </TabsTrigger>

            <TabsTrigger value="rejected">
              Rejetés ({stats.rejected})
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    placeholder="Rechercher par document ou assuré..."
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                    className="pl-9"
                  />
                </div>

                <Select
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Type de document" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">
                      Tous les types
                    </SelectItem>

                    {documentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Documents Table */}
          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Liste des documents</CardTitle>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucun document trouvé.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="table-header">
                          <th className="text-left py-3 px-4">Document</th>
                          <th className="text-left py-3 px-4">Assuré</th>
                          <th className="text-left py-3 px-4">Type</th>
                          <th className="text-left py-3 px-4">Taille</th>
                          <th className="text-left py-3 px-4">Date</th>
                          <th className="text-left py-3 px-4">Statut</th>
                          <th className="text-right py-3 px-4">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-border">
                        {filteredDocuments.map((doc) => (
                          <tr
                            key={doc.id}
                            className="hover:bg-muted/50"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <FileText className="h-5 w-5 text-primary" />
                                </div>

                                <span className="font-medium truncate max-w-[200px]">
                                  {doc.file_name}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <p className="font-medium">
                                {doc.insured_member
                                  ? `${doc.insured_member.first_name} ${doc.insured_member.last_name}`
                                  : "—"}
                              </p>

                              <p className="text-xs text-muted-foreground">
                                {doc.insured_member?.insurance_number ?? "—"}
                              </p>
                            </td>

                            <td className="py-3 px-4">
                              <Badge variant="outline">
                                {doc.document_type}
                              </Badge>
                            </td>

                            <td className="py-3 px-4 text-muted-foreground">
                              {formatFileSize(doc.file_size)}
                            </td>

                            <td className="py-3 px-4 text-muted-foreground">
                              {new Date(doc.upload_date).toLocaleDateString(
                                "fr-FR"
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {getStatusBadge(doc.status)}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Actions pour ${doc.file_name}`}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      void handleViewDocument(doc)
                                    }
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Visualiser
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() =>
                                      void handleDownloadDocument(doc)
                                    }
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Télécharger
                                  </DropdownMenuItem>

                                  {doc.status === "pending" && (
                                    <DropdownMenuItem
                                      onClick={() => handleVerify(doc)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Vérifier
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Verification Dialog */}
        <Dialog
          open={isVerifyDialogOpen}
          onOpenChange={setIsVerifyDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vérifier le document</DialogTitle>

              <DialogDescription>
                {selectedDocument?.file_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium">
                      {selectedDocument?.document_type}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Taille</p>
                    <p className="font-medium">
                      {formatFileSize(selectedDocument?.file_size ?? null)}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Assuré</p>
                    <p className="font-medium">
                      {selectedDocument?.insured_member?.first_name ?? "—"}{" "}
                      {selectedDocument?.insured_member?.last_name ?? ""}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">
                      Date de téléversement
                    </p>
                    <p className="font-medium">
                      {selectedDocument
                        ? new Date(
                            selectedDocument.upload_date
                          ).toLocaleDateString("fr-FR")
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verification-notes">
                  Notes de validation
                </Label>

                <Textarea
                  id="verification-notes"
                  value={verificationNotes}
                  onChange={(event) =>
                    setVerificationNotes(event.target.value)
                  }
                  placeholder="Notes facultatives..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="destructive"
                disabled={isSubmitting}
                onClick={() =>
                  void handleUpdateStatus("rejected")
                }
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <XCircle className="h-4 w-4 mr-2" />
                Rejeter
              </Button>

              <Button
                disabled={isSubmitting}
                onClick={() =>
                  void handleUpdateStatus("approved")
                }
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <CheckCircle className="h-4 w-4 mr-2" />
                Approuver
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
