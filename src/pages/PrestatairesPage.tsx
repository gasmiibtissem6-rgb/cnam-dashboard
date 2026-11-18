
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
  Building2,
  Stethoscope,
  Pill,
  FlaskConical,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  Trash2,
  MapPin,
  Loader2,
  FileText,
  Activity,
  Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProviderDialog } from "@/components/providers/ProviderDialog";
import type { Database } from "@/integrations/supabase/types";

type Provider =
  Database["public"]["Tables"]["health_providers"]["Row"];

const typeConfig = {
  hospital: {
    label: "Hôpital",
    icon: Building2,
    color: "text-primary",
  },
  doctor: {
    label: "Médecin",
    icon: Stethoscope,
    color: "text-accent",
  },
  pharmacy: {
    label: "Pharmacie",
    icon: Pill,
    color: "text-success",
  },
  laboratory: {
    label: "Laboratoire",
    icon: FlaskConical,
    color: "text-warning",
  },
};

const statusConfig = {
  approved: {
    label: "Agréé",
    icon: CheckCircle,
    className: "badge-success",
  },
  pending: {
    label: "En attente",
    icon: Clock,
    className: "badge-warning",
  },
  suspended: {
    label: "Suspendu",
    icon: XCircle,
    className: "badge-destructive",
  },
};

function formatNumber(num: number): string {
  return num.toLocaleString("fr-FR");
}

export default function PrestatairesPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] =
    useState<Provider | null>(null);

  const [viewedProvider, setViewedProvider] =
    useState<Provider | null>(null);

  const { toast } = useToast();

  const fetchProviders = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("health_providers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setProviders(data ?? []);
    } catch (error: unknown) {
      console.error("Erreur chargement prestataires :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les prestataires.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  const filteredProviders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return providers.filter((provider) => {
      const matchesSearch =
        !query ||
        [
          provider.name,
          provider.provider_code,
          provider.address,
          provider.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesType =
        typeFilter === "all" || provider.type === typeFilter;

      const matchesStatus =
        statusFilter === "all" || provider.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [providers, searchQuery, typeFilter, statusFilter]);

  const handleCreate = () => {
    setSelectedProvider(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (provider: Provider) => {
    setSelectedProvider(provider);
    setIsDialogOpen(true);
  };

  const handleView = (provider: Provider) => {
    setViewedProvider(provider);
  };

  const handleDelete = async (provider: Provider) => {
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer le prestataire "${provider.name}" ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const { error } = await supabase
        .from("health_providers")
        .delete()
        .eq("id", provider.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Succès",
        description: "Prestataire supprimé avec succès.",
      });

      await fetchProviders();
    } catch (error: unknown) {
      console.error("Erreur suppression prestataire :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de supprimer le prestataire.",
      });
    }
  };

  const stats = useMemo(() => {
    const hospital = providers.filter(
      (provider) => provider.type === "hospital"
    ).length;

    const doctor = providers.filter(
      (provider) => provider.type === "doctor"
    ).length;

    const pharmacy = providers.filter(
      (provider) => provider.type === "pharmacy"
    ).length;

    const laboratory = providers.filter(
      (provider) => provider.type === "laboratory"
    ).length;

    const approved = providers.filter(
      (provider) => provider.status === "approved"
    ).length;

    const pending = providers.filter(
      (provider) => provider.status === "pending"
    ).length;

    const suspended = providers.filter(
      (provider) => provider.status === "suspended"
    ).length;

    const invoicesTotal = providers.reduce(
      (sum, provider) => sum + (provider.invoices_processed ?? 0),
      0
    );

    const errorRates = providers
      .map((provider) => provider.error_rate)
      .filter((rate): rate is number => rate !== null);

    const avgErrorRate =
      errorRates.length > 0
        ? errorRates.reduce((sum, rate) => sum + rate, 0) /
          errorRates.length
        : null;

    return {
      hospital,
      doctor,
      pharmacy,
      laboratory,
      approved,
      pending,
      suspended,
      total: providers.length,
      invoicesTotal,
      avgErrorRate,
    };
  }, [providers]);

  const providerTypeCards = [
    {
      key: "hospital",
      count: stats.hospital,
      ...typeConfig.hospital,
    },
    {
      key: "doctor",
      count: stats.doctor,
      ...typeConfig.doctor,
    },
    {
      key: "pharmacy",
      count: stats.pharmacy,
      ...typeConfig.pharmacy,
    },
    {
      key: "laboratory",
      count: stats.laboratory,
      ...typeConfig.laboratory,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Prestataires de santé
            </h1>

            <p className="text-muted-foreground">
              Gérez les hôpitaux, médecins, pharmacies et laboratoires.
            </p>
          </div>

          <Button className="gap-2" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            Nouveau prestataire
          </Button>
        </div>

        {/* Stats by Provider Type */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {providerTypeCards.map((config) => {
            const Icon = config.icon;

            return (
              <div
                key={config.key}
                className="stat-card flex items-center gap-4"
              >
                <div
                  className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center bg-muted",
                    config.color
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-2xl font-bold">
                    {formatNumber(config.count)}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {config.label}
                    {config.count > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="stat-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Total prestataires
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {formatNumber(stats.total)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card bg-gradient-to-br from-success/5 to-success/10 border-success/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Agréés
                  </p>
                  <p className="text-2xl font-bold text-success">
                    {formatNumber(stats.approved)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-warning" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    En attente
                  </p>
                  <p className="text-2xl font-bold text-warning">
                    {formatNumber(stats.pending)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card bg-gradient-to-br from-destructive/5 to-destructive/10 border-destructive/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Suspendus
                  </p>
                  <p className="text-2xl font-bold text-destructive">
                    {formatNumber(stats.suspended)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-accent" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Factures traitées
                  </p>
                  <p className="text-2xl font-bold text-accent">
                    {formatNumber(stats.invoicesTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card bg-gradient-to-br from-info/5 to-info/10 border-info/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-info/20 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-info" />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Taux d'erreur moyen
                  </p>
                  <p className="text-2xl font-bold text-info">
                    {stats.avgErrorRate === null
                      ? "—"
                      : `${stats.avgErrorRate.toFixed(1)}%`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="stat-card">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                placeholder="Rechercher un prestataire..."
                className="pl-10"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={setTypeFilter}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Tous les types
                </SelectItem>
                <SelectItem value="hospital">
                  Hôpitaux
                </SelectItem>
                <SelectItem value="doctor">
                  Médecins
                </SelectItem>
                <SelectItem value="pharmacy">
                  Pharmacies
                </SelectItem>
                <SelectItem value="laboratory">
                  Laboratoires
                </SelectItem>
              </SelectContent>
            </Select>

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
                <SelectItem value="approved">
                  Agréé
                </SelectItem>
                <SelectItem value="pending">
                  En attente
                </SelectItem>
                <SelectItem value="suspended">
                  Suspendu
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Providers Table */}
        <div className="stat-card">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Aucun prestataire trouvé.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full">
                <thead>
                  <tr className="table-header border-y border-border">
                    <th className="px-6 py-3 text-left">Code</th>
                    <th className="px-6 py-3 text-left">Prestataire</th>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Adresse</th>
                    <th className="px-6 py-3 text-right">Factures</th>
                    <th className="px-6 py-3 text-right">Taux d'erreur</th>
                    <th className="px-6 py-3 text-left">Statut</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {filteredProviders.map((provider) => {
                    const type =
                      typeConfig[provider.type] ??
                      typeConfig.hospital;

                    const status =
                      statusConfig[provider.status] ??
                      statusConfig.pending;

                    const TypeIcon = type.icon;
                    const StatusIcon = status.icon;

                    const errorRate = provider.error_rate ?? 0;

                    return (
                      <tr
                        key={provider.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-primary">
                            {provider.provider_code}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-10 w-10 rounded-xl bg-muted flex items-center justify-center",
                                type.color
                              )}
                            >
                              <TypeIcon className="h-5 w-5" />
                            </div>

                            <div>
                              <p className="text-sm font-medium">
                                {provider.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {provider.phone || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm">
                            {type.label}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {provider.address || "—"}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold">
                            {formatNumber(
                              provider.invoices_processed ?? 0
                            )}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              errorRate > 3
                                ? "text-destructive"
                                : errorRate > 1.5
                                  ? "text-warning"
                                  : "text-success"
                            )}
                          >
                            {provider.error_rate === null
                              ? "—"
                              : `${errorRate}%`}
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
                              title="Voir"
                              aria-label={`Voir ${provider.name}`}
                              onClick={() => handleView(provider)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Modifier"
                              aria-label={`Modifier ${provider.name}`}
                              onClick={() => handleEdit(provider)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              title="Supprimer"
                              aria-label={`Supprimer ${provider.name}`}
                              onClick={() =>
                                void handleDelete(provider)
                              }
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
          )}
        </div>

        {/* Create/Edit Dialog */}
        <ProviderDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          provider={selectedProvider}
          onSuccess={() => void fetchProviders()}
        />

        {/* View Dialog */}
        {viewedProvider && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="presentation"
            onClick={() => setViewedProvider(null)}
          >
            <Card
              className="w-full max-w-lg"
              role="dialog"
              aria-modal="true"
              aria-label="Détails du prestataire"
              onClick={(event) => event.stopPropagation()}
            >
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    Détails du prestataire
                  </h2>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewedProvider(null)}
                    aria-label="Fermer"
                  >
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-3 text-sm">
                  <p>
                    <strong>Nom :</strong> {viewedProvider.name}
                  </p>

                  <p>
                    <strong>Code :</strong>{" "}
                    {viewedProvider.provider_code}
                  </p>

                  <p>
                    <strong>Type :</strong>{" "}
                    {typeConfig[viewedProvider.type]?.label ??
                      viewedProvider.type}
                  </p>

                  <p>
                    <strong>Adresse :</strong>{" "}
                    {viewedProvider.address || "—"}
                  </p>

                  <p>
                    <strong>Téléphone :</strong>{" "}
                    {viewedProvider.phone || "—"}
                  </p>

                  <p>
                    <strong>Statut :</strong>{" "}
                    {statusConfig[viewedProvider.status]?.label ??
                      viewedProvider.status}
                  </p>

                  <p>
                    <strong>Factures traitées :</strong>{" "}
                    {formatNumber(
                      viewedProvider.invoices_processed ?? 0
                    )}
                  </p>

                  <p>
                    <strong>Taux d'erreur :</strong>{" "}
                    {viewedProvider.error_rate === null
                      ? "—"
                      : `${viewedProvider.error_rate}%`}
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setViewedProvider(null)}
                  >
                    Fermer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
