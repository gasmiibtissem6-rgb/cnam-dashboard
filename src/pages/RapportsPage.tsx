
import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Download,
  FileText,
  Users,
  Receipt,
  Building2,
  Loader2,
  FileSpreadsheet,
  Clock,
  Calendar,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths } from "date-fns";
import { fr } from "date-fns/locale";

interface ReportStats {
  totalMembers: number;
  totalProviders: number;
  totalReimbursements: number;
  totalDocuments: number;
  pendingReimbursements: number;
  approvedReimbursements: number;
  rejectedReimbursements: number;
  processingReimbursements: number;
  totalAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  approvalRate: number | null;
}

interface MonthlyData {
  month: string;
  count: number;
  amount: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface DistributionData {
  name: string;
  value: number;
}

type DateRange = "3months" | "6months" | "12months";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
];

const EMPTY_STATS: ReportStats = {
  totalMembers: 0,
  totalProviders: 0,
  totalReimbursements: 0,
  totalDocuments: 0,
  pendingReimbursements: 0,
  approvedReimbursements: 0,
  rejectedReimbursements: 0,
  processingReimbursements: 0,
  totalAmount: 0,
  approvedAmount: 0,
  pendingAmount: 0,
  approvalRate: null,
};

function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function csvCell(value: string | number): string {
  const text = String(value);
  const safeText = /^[\s]*[=+\-@\t\r]/.test(text)
    ? `'${text}`
    : text;

  return `"${safeText.replace(/"/g, '""')}"`;
}

function downloadCsv(
  rows: Array<Array<string | number>>,
  filename: string
): void {
  const content = rows
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");

  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RapportsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReportStats>(EMPTY_STATS);

  const [reimbursementsByMonth, setReimbursementsByMonth] =
    useState<MonthlyData[]>([]);

  const [reimbursementsByStatus, setReimbursementsByStatus] =
    useState<StatusData[]>([]);

  const [documentsByType, setDocumentsByType] =
    useState<DistributionData[]>([]);

  const [providersByType, setProvidersByType] =
    useState<DistributionData[]>([]);

  const [dateRange, setDateRange] =
    useState<DateRange>("6months");

  const [isExporting, setIsExporting] = useState(false);
  const [dataError, setDataError] = useState(false);

  const { toast } = useToast();

  const monthsToShow = useMemo(() => {
    switch (dateRange) {
      case "3months":
        return 3;
      case "12months":
        return 12;
      default:
        return 6;
    }
  }, [dateRange]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setDataError(false);

    try {
      const [
        membersResult,
        providersCountResult,
        reimbursementsCountResult,
        documentsCountResult,
        reimbursementsResult,
        documentsResult,
        providersResult,
      ] = await Promise.all([
        supabase
          .from("insured_members")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("health_providers")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("reimbursements")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("documents")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("reimbursements")
          .select(
            "status, amount_requested, amount_approved, created_at"
          ),

        supabase
          .from("documents")
          .select("document_type"),

        supabase
          .from("health_providers")
          .select("type"),
      ]);

      const errors = [
        membersResult.error,
        providersCountResult.error,
        reimbursementsCountResult.error,
        documentsCountResult.error,
        reimbursementsResult.error,
        documentsResult.error,
        providersResult.error,
      ].filter((error) => error !== null);

      if (errors.length > 0) {
        throw errors[0];
      }

      const reimbursements = reimbursementsResult.data ?? [];
      const documents = documentsResult.data ?? [];
      const providers = providersResult.data ?? [];

      const pending = reimbursements.filter(
        (item) => item.status === "pending"
      );

      const approved = reimbursements.filter(
        (item) => item.status === "approved"
      );

      const rejected = reimbursements.filter(
        (item) => item.status === "rejected"
      );

      const processing = reimbursements.filter(
        (item) => item.status === "processing"
      );

      const totalAmount = reimbursements.reduce(
        (sum, item) => sum + Number(item.amount_requested ?? 0),
        0
      );

      const approvedAmount = reimbursements.reduce(
        (sum, item) => sum + Number(item.amount_approved ?? 0),
        0
      );

      const pendingAmount = pending.reduce(
        (sum, item) => sum + Number(item.amount_requested ?? 0),
        0
      );

      const decidedCount = approved.length + rejected.length;

      const approvalRate =
        decidedCount > 0
          ? (approved.length / decidedCount) * 100
          : null;

      setStats({
        totalMembers: membersResult.count ?? 0,
        totalProviders: providersCountResult.count ?? 0,
        totalReimbursements:
          reimbursementsCountResult.count ?? 0,
        totalDocuments: documentsCountResult.count ?? 0,
        pendingReimbursements: pending.length,
        approvedReimbursements: approved.length,
        rejectedReimbursements: rejected.length,
        processingReimbursements: processing.length,
        totalAmount,
        approvedAmount,
        pendingAmount,
        approvalRate,
      });

      setReimbursementsByStatus([
        {
          name: "En attente",
          value: pending.length,
          color: "hsl(var(--warning))",
        },
        {
          name: "Approuvés",
          value: approved.length,
          color: "hsl(var(--success))",
        },
        {
          name: "Rejetés",
          value: rejected.length,
          color: "hsl(var(--destructive))",
        },
        {
          name: "En cours",
          value: processing.length,
          color: "hsl(var(--info))",
        },
      ]);

      const monthlyMap: Record<
        string,
        { count: number; amount: number }
      > = {};

      for (let i = monthsToShow - 1; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const key = format(date, "yyyy-MM");

        monthlyMap[key] = {
          count: 0,
          amount: 0,
        };
      }

      reimbursements.forEach((item) => {
        const date = new Date(item.created_at);

        if (Number.isNaN(date.getTime())) {
          return;
        }

        const key = format(date, "yyyy-MM");
        const month = monthlyMap[key];

        if (month) {
          month.count += 1;
          month.amount += Number(item.amount_requested ?? 0);
        }
      });

      const monthlyData: MonthlyData[] = Object.entries(
        monthlyMap
      ).map(([month, values]) => ({
        month: format(new Date(`${month}-01T12:00:00`), "MMM yyyy", {
          locale: fr,
        }),
        count: values.count,
        amount: values.amount / 1000,
      }));

      setReimbursementsByMonth(monthlyData);

      const documentCounts: Record<string, number> = {};

      documents.forEach((item) => {
        const type = item.document_type || "Non renseigné";

        documentCounts[type] =
          (documentCounts[type] ?? 0) + 1;
      });

      setDocumentsByType(
        Object.entries(documentCounts).map(([name, value]) => ({
          name,
          value,
        }))
      );

      const providerCounts: Record<string, number> = {};

      providers.forEach((item) => {
        const type = item.type || "Non renseigné";

        providerCounts[type] =
          (providerCounts[type] ?? 0) + 1;
      });

      const providerLabels: Record<string, string> = {
        hospital: "Hôpitaux",
        doctor: "Médecins",
        pharmacy: "Pharmacies",
        laboratory: "Laboratoires",
      };

      setProvidersByType(
        Object.entries(providerCounts).map(([type, value]) => ({
          name: providerLabels[type] ?? type,
          value,
        }))
      );
    } catch (error: unknown) {
      console.error("Erreur rapport CNAM :", error);

      setDataError(true);
      setStats(EMPTY_STATS);
      setReimbursementsByMonth([]);
      setReimbursementsByStatus([]);
      setDocumentsByType([]);
      setProvidersByType([]);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les données du rapport.",
      });
    } finally {
      setLoading(false);
    }
  }, [monthsToShow, toast]);

  useEffect(() => {
    void fetchReportData();
  }, [fetchReportData]);

  const handleExportCsv = () => {
    setIsExporting(true);

    try {
      const rows: Array<Array<string | number>> = [
        [
          "Rapport CNAM",
          new Date().toLocaleDateString("fr-FR"),
        ],
        [],
        ["Statistiques générales"],
        ["Métrique", "Valeur"],
        ["Total assurés", stats.totalMembers],
        ["Total prestataires", stats.totalProviders],
        ["Total remboursements", stats.totalReimbursements],
        ["Total documents", stats.totalDocuments],
        ["Remboursements en attente", stats.pendingReimbursements],
        ["Remboursements approuvés", stats.approvedReimbursements],
        ["Remboursements rejetés", stats.rejectedReimbursements],
        [
          "Taux d'approbation (%)",
          stats.approvalRate?.toFixed(2) ?? "N/A",
        ],
        ["Montant total demandé (TND)", stats.totalAmount],
        ["Montant total approuvé (TND)", stats.approvedAmount],
        ["Montant en attente (TND)", stats.pendingAmount],
        [],
        ["Évolution mensuelle"],
        ["Mois", "Nombre", "Montant (milliers TND)"],
        ...reimbursementsByMonth.map((item) => [
          item.month,
          item.count,
          item.amount,
        ]),
        [],
        ["Répartition des prestataires"],
        ["Type", "Nombre"],
        ...providersByType.map((item) => [
          item.name,
          item.value,
        ]),
        [],
        ["Répartition des documents"],
        ["Type", "Nombre"],
        ...documentsByType.map((item) => [
          item.name,
          item.value,
        ]),
      ];

      downloadCsv(
        rows,
        `rapport-cnam-${format(new Date(), "yyyy-MM-dd")}.csv`
      );

      toast({
        title: "Export réussi",
        description: "Le fichier CSV a été généré.",
      });
    } catch (error: unknown) {
      console.error("Erreur export CSV :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'exporter le rapport.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  const summaryCards = [
    {
      label: "Assurés",
      value: formatNumber(stats.totalMembers),
      icon: Users,
      color: "text-primary",
    },
    {
      label: "Prestataires",
      value: formatNumber(stats.totalProviders),
      icon: Building2,
      color: "text-accent",
    },
    {
      label: "Remboursements",
      value: formatNumber(stats.totalReimbursements),
      icon: Receipt,
      color: "text-success",
    },
    {
      label: "Documents",
      value: formatNumber(stats.totalDocuments),
      icon: FileText,
      color: "text-warning",
    },
    {
      label: "Taux d'approbation",
      value:
        stats.approvalRate === null
          ? "—"
          : `${stats.approvalRate.toFixed(1)}%`,
      icon: BarChart3,
      color: "text-info",
    },
    {
      label: "Remboursements en cours",
      value: formatNumber(stats.processingReimbursements),
      icon: Clock,
      color: "text-primary",
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Rapports & Statistiques
            </h1>
            <p className="text-muted-foreground">
              Analysez les données et exportez des rapports détaillés.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={dateRange}
              onValueChange={(value) =>
                setDateRange(value as DateRange)
              }
            >
              <SelectTrigger className="w-44">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">
                  3 derniers mois
                </SelectItem>
                <SelectItem value="6months">
                  6 derniers mois
                </SelectItem>
                <SelectItem value="12months">
                  12 derniers mois
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              disabled={isExporting || dataError}
              onClick={handleExportCsv}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <Button
              disabled={dataError}
              onClick={handleExportPdf}
            >
              <Download className="h-4 w-4 mr-2" />
              Imprimer / PDF
            </Button>
          </div>
        </div>

        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">
            Rapport CNAM
          </h1>
          <p>
            Date : {new Date().toLocaleDateString("fr-FR")}
          </p>
        </div>

        {dataError && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">
                Les données n'ont pas pu être chargées.
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => void fetchReportData()}
              >
                Réessayer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} className="stat-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                      <Icon
                        className={`h-6 w-6 ${item.color}`}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="text-2xl font-bold">
                        {item.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Financial Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="stat-card-primary">
            <CardContent className="pt-6">
              <p className="text-sm opacity-80">
                Montant total demandé
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.totalAmount)}
              </p>
              <TrendingUp className="h-6 w-6 opacity-50 mt-2" />
            </CardContent>
          </Card>

          <Card className="stat-card-success">
            <CardContent className="pt-6">
              <p className="text-sm opacity-80">
                Montant total approuvé
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.approvedAmount)}
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card-accent">
            <CardContent className="pt-6">
              <p className="text-sm opacity-80">
                Montant mensuel moyen demandé
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(
                  reimbursementsByMonth.reduce(
                    (sum, item) => sum + item.amount * 1000,
                    0
                  ) / monthsToShow
                )}
              </p>
              <p className="text-xs opacity-70 mt-1">
                Sur les {monthsToShow} derniers mois
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card-warning">
            <CardContent className="pt-6">
              <p className="text-sm opacity-80">
                En attente de traitement
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.pendingAmount)}
              </p>
              <p className="text-xs opacity-70 mt-1">
                {formatNumber(stats.pendingReimbursements)} dossiers
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="reimbursements" className="space-y-4">
          <TabsList className="print:hidden">
            <TabsTrigger value="reimbursements">
              Remboursements
            </TabsTrigger>
            <TabsTrigger value="distribution">
              Distribution
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="reimbursements"
            className="space-y-4"
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Évolution des remboursements
                  </CardTitle>
                  <CardDescription>
                    Nombre et montant par mois
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart data={reimbursementsByMonth}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                        />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                        />
                        <Tooltip />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="count"
                          name="Nombre"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="amount"
                          name="Montant (K TND)"
                          fill="hsl(var(--accent))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Répartition par statut
                  </CardTitle>
                  <CardDescription>
                    Statut des demandes de remboursement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <PieChart>
                        <Pie
                          data={reimbursementsByStatus.filter(
                            (item) => item.value > 0
                          )}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {reimbursementsByStatus
                            .filter((item) => item.value > 0)
                            .map((item) => (
                              <Cell
                                key={item.name}
                                fill={item.color}
                              />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent
            value="distribution"
            className="space-y-4"
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Prestataires par type
                  </CardTitle>
                  <CardDescription>
                    Répartition des prestataires de santé
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <PieChart>
                        <Pie
                          data={providersByType}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={false}
                        >
                          {providersByType.map((item, index) => (
                            <Cell
                              key={item.name}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Statistiques des remboursements
                  </CardTitle>
                  <CardDescription>
                    Détail par statut
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-warning/10 p-4">
                      <span>En attente</span>
                      <Badge className="badge-warning">
                        {formatNumber(
                          stats.pendingReimbursements
                        )}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-success/10 p-4">
                      <span>Approuvés</span>
                      <Badge className="badge-success">
                        {formatNumber(
                          stats.approvedReimbursements
                        )}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-destructive/10 p-4">
                      <span>Rejetés</span>
                      <Badge className="badge-destructive">
                        {formatNumber(
                          stats.rejectedReimbursements
                        )}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-primary/10 p-4">
                      <span>En cours</span>
                      <Badge variant="outline">
                        {formatNumber(
                          stats.processingReimbursements
                        )}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent
            value="documents"
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle>Documents par type</CardTitle>
                <CardDescription>
                  Répartition des documents téléversés
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={documentsByType}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={150}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        name="Nombre"
                        fill="hsl(var(--primary))"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
