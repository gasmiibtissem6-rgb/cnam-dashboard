
import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Download,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MemberDialog } from "@/components/members/MemberDialog";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";

type InsuredMember =
  Database["public"]["Tables"]["insured_members"]["Row"];

const statusConfig = {
  active: {
    label: "Actif",
    icon: CheckCircle,
    className: "badge-success",
  },
  suspended: {
    label: "Suspendu",
    icon: Clock,
    className: "badge-warning",
  },
  expired: {
    label: "Expiré",
    icon: XCircle,
    className: "badge-destructive",
  },
};

const escapeCsv = (value: string | number | null | undefined) => {
  let text = String(value ?? "");

  // Empêcher l'exécution de formules lors de l'ouverture dans Excel.
  if (/^[\s]*[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

export default function AssuresPage() {
  const [members, setMembers] = useState<InsuredMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] =
    useState<InsuredMember | null>(null);

  const { toast } = useToast();

  // Récupération des assurés depuis Supabase.
  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("insured_members")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setMembers(data ?? []);
    } catch (error: unknown) {
      console.error("Erreur lors du chargement des assurés :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les assurés.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  // Recherche et filtrage des assurés.
  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !query ||
        member.first_name.toLowerCase().includes(query) ||
        member.last_name.toLowerCase().includes(query) ||
        member.cin.toLowerCase().includes(query) ||
        member.insurance_number.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || member.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [members, searchQuery, statusFilter]);

  // Ouvrir le formulaire de modification.
  const handleEdit = (member: InsuredMember) => {
    setSelectedMember(member);
    setIsDialogOpen(true);
  };

  // Ouvrir le formulaire de création.
  const handleCreate = () => {
    setSelectedMember(null);
    setIsDialogOpen(true);
  };

  // Supprimer un assuré.
  const handleDelete = async (member: InsuredMember) => {
    const confirmed = window.confirm(
      `Supprimer l'assuré ${member.first_name} ${member.last_name} ?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("insured_members")
        .delete()
        .eq("id", member.id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Assuré supprimé.",
      });

      await fetchMembers();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de supprimer cet assuré.";

      console.error("Erreur lors de la suppression :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: message,
      });
    }
  };

  // Exporter les assurés filtrés en CSV.
  const handleExport = () => {
    try {
      const headers = [
        "N° Assurance",
        "Prénom",
        "Nom",
        "CIN",
        "Date de naissance",
        "Téléphone",
        "Email",
        "Statut",
      ];

      const rows = filteredMembers.map((member) => [
        member.insurance_number,
        member.first_name,
        member.last_name,
        member.cin,
        member.date_of_birth,
        member.phone ?? "",
        member.email ?? "",
        member.status,
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map(escapeCsv).join(";"))
        .join("\r\n");

      const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `assures-${format(new Date(), "yyyy-MM-dd")}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      toast({
        title: "Export réussi",
        description: `${filteredMembers.length} assurés exportés.`,
      });
    } catch (error: unknown) {
      console.error("Erreur lors de l'export :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'exporter les assurés.",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Gestion des assurés
            </h1>
            <p className="text-muted-foreground">
              Gérez les comptes des assurés et leurs informations
            </p>
          </div>

          <Button className="gap-2" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            Nouvel assuré
          </Button>
        </div>

        {/* Recherche et filtres */}
        <div className="stat-card">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                placeholder="Rechercher par nom, CIN ou numéro d'assurance..."
                className="pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Tous les statuts
                </SelectItem>
                <SelectItem value="active">
                  Actif
                </SelectItem>
                <SelectItem value="suspended">
                  Suspendu
                </SelectItem>
                <SelectItem value="expired">
                  Expiré
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExport}
              disabled={loading || filteredMembers.length === 0}
            >
              <Download className="h-4 w-4" />
              Exporter
            </Button>
          </div>
        </div>

        {/* Tableau des assurés */}
        <div className="stat-card">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun assuré trouvé.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-6">
                <table className="w-full">
                  <thead>
                    <tr className="table-header border-y border-border">
                      <th className="px-6 py-3 text-left">
                        N° Assurance
                      </th>
                      <th className="px-6 py-3 text-left">
                        Nom complet
                      </th>
                      <th className="px-6 py-3 text-left">
                        CIN
                      </th>
                      <th className="px-6 py-3 text-left">
                        Date de naissance
                      </th>
                      <th className="px-6 py-3 text-left">
                        Téléphone
                      </th>
                      <th className="px-6 py-3 text-left">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {filteredMembers.map((member) => {
                      const status =
                        statusConfig[
                          member.status as keyof typeof statusConfig
                        ] ?? statusConfig.expired;

                      const StatusIcon = status.icon;

                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-primary">
                              {member.insurance_number}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {member.first_name?.[0] ?? ""}
                                  {member.last_name?.[0] ?? ""}
                                </span>
                              </div>

                              <span className="text-sm font-medium">
                                {member.first_name} {member.last_name}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className="text-sm text-muted-foreground">
                              {member.cin}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className="text-sm text-muted-foreground">
                              {member.date_of_birth
                                ? format(
                                    new Date(member.date_of_birth),
                                    "dd/MM/yyyy"
                                  )
                                : "—"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className="text-sm text-muted-foreground">
                              {member.phone || "—"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={cn(
                                status.className,
                                "flex items-center gap-1.5 w-fit"
                              )}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />
                              {status.label}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Consulter l'assuré"
                                aria-label="Consulter l'assuré"
                                onClick={() => handleEdit(member)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Modifier l'assuré"
                                aria-label="Modifier l'assuré"
                                onClick={() => handleEdit(member)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                title="Supprimer l'assuré"
                                aria-label="Supprimer l'assuré"
                                onClick={() => {
                                  void handleDelete(member);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Nombre d'assurés affichés */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Affichage de {filteredMembers.length} assuré
                  {filteredMembers.length > 1 ? "s" : ""}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Formulaire d'ajout et de modification */}
        <MemberDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          member={selectedMember}
          onSuccess={fetchMembers}
        />
      </div>
    </DashboardLayout>
  );
}
