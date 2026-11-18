
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths } from "date-fns";
import { fr } from "date-fns/locale";

interface DashboardStats {
  totalMembers: number;
  totalProviders: number;
  totalReimbursements: number;
  processingRate: number;
  pendingDocuments: number;
  pendingReimbursements: number;
  monthlyReimbursementAmount: number;
  membersChange: number;
  providersChange: number;
  reimbursementsChange: number;
}

interface ChartData {
  month: string;
  remboursements: number;
  demandes: number;
}

interface DistributionData {
  name: string;
  value: number;
  color: string;
}

interface AlertData {
  id: string;
  type: "warning" | "error" | "info";
  title: string;
  description: string;
  time: string;
}

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [distributionData, setDistributionData] = useState<
    DistributionData[]
  >([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [
        membersResult,
        providersResult,
        reimbursementsResult,
        documentsResult,
        pendingDocsResult,
        pendingReimbResult,
      ] = await Promise.all([
        supabase
          .from("insured_members")
          .select("*", { count: "exact", head: true }),

        supabase
          .from("health_providers")
          .select("*", { count: "exact", head: true }),

        supabase
          .from("reimbursements")
          .select(
            "status, amount_requested, amount_approved, created_at"
          ),

        supabase
          .from("documents")
          .select("status, document_type"),

        supabase
          .from("documents")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),

        supabase
          .from("reimbursements")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

      const results = [
        membersResult,
        providersResult,
        reimbursementsResult,
        documentsResult,
        pendingDocsResult,
        pendingReimbResult,
      ];

      for (const result of results) {
        if (result.error) {
          throw result.error;
        }
      }

      const membersCount = membersResult.count ?? 0;
      const providersCount = providersResult.count ?? 0;
      const reimbursements = reimbursementsResult.data ?? [];
      const documents = documentsResult.data ?? [];
      const pendingDocsCount = pendingDocsResult.count ?? 0;
      const pendingReimbCount = pendingReimbResult.count ?? 0;

      // Statistiques des remboursements
      const totalReimb = reimbursements.length;

      const approvedReimb = reimbursements.filter(
        (reimbursement) => reimbursement.status === "approved"
      ).length;

      const processingRate =
        totalReimb > 0
          ? Math.round((approvedReimb / totalReimb) * 1000) / 10
          : 0;

      // Montant des demandes du mois actuel
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);

      const monthlyAmount = reimbursements
        .filter(
          (reimbursement) =>
            new Date(reimbursement.created_at) >= currentMonthStart
        )
        .reduce(
          (sum, reimbursement) =>
            sum + Number(reimbursement.amount_requested ?? 0),
          0
        );

      setStats({
        totalMembers: membersCount,
        totalProviders: providersCount,
        totalReimbursements: totalReimb,
        processingRate,
        pendingDocuments: pendingDocsCount,
        pendingReimbursements: pendingReimbCount,
        monthlyReimbursementAmount: monthlyAmount,

        // Valeurs provisoires : données historiques nécessaires
        membersChange: 12.5,
        providersChange: 3.2,
        reimbursementsChange: 8.7,
      });

      // Graphique des 12 derniers mois
      const monthlyData: Record<
        string,
        { requests: number; approved: number }
      > = {};

      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthKey = format(monthDate, "yyyy-MM");

        monthlyData[monthKey] = {
          requests: 0,
          approved: 0,
        };
      }

      reimbursements.forEach((reimbursement) => {
        const monthKey = format(
          new Date(reimbursement.created_at),
          "yyyy-MM"
        );

        if (monthlyData[monthKey]) {
          monthlyData[monthKey].requests += Number(
            reimbursement.amount_requested ?? 0
          );

          monthlyData[monthKey].approved += Number(
            reimbursement.amount_approved ?? 0
          );
        }
      });

      const chartDataArray: ChartData[] = Object.entries(
        monthlyData
      ).map(([month, data]) => ({
        month: format(new Date(`${month}-01`), "MMM", {
          locale: fr,
        }),
        demandes: data.requests,
        remboursements: data.approved,
      }));

      setChartData(chartDataArray);

      // Répartition des documents par type
      const docTypeCount: Record<string, number> = {};

      documents.forEach((document) => {
        const documentType = document.document_type;

        if (documentType) {
          docTypeCount[documentType] =
            (docTypeCount[documentType] ?? 0) + 1;
        }
      });

      const colors = [
        "hsl(217, 91%, 40%)",
        "hsl(174, 72%, 40%)",
        "hsl(142, 76%, 36%)",
        "hsl(38, 92%, 50%)",
        "hsl(0, 84%, 60%)",
      ];

      const distribution: DistributionData[] = Object.entries(
        docTypeCount
      )
        .slice(0, 5)
        .map(([name, value], index) => ({
          name,
          value,
          color: colors[index % colors.length],
        }));

      setDistributionData(distribution);

      // Alertes
      const alertsList: AlertData[] = [];

      if (pendingDocsCount > 0) {
        alertsList.push({
          id: "pending-docs",
          type: "warning",
          title: "Documents en attente",
          description: `${pendingDocsCount} documents nécessitent une vérification`,
          time: "Maintenant",
        });
      }

      if (pendingReimbCount > 0) {
        alertsList.push({
          id: "pending-reimb",
          type: "info",
          title: "Remboursements en attente",
          description: `${pendingReimbCount} demandes de remboursement à traiter`,
          time: "Maintenant",
        });
      }

      // Vérifier les cartes expirant dans les 30 prochains jours
      const now = new Date();

      const next30Days = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      const { count: expiringCardsCount, error: expiringError } =
        await supabase
          .from("insured_members")
          .select("*", { count: "exact", head: true })
          .gte("card_expiry_date", now.toISOString())
          .lte("card_expiry_date", next30Days.toISOString());

      if (expiringError) {
        console.error(
          "Error fetching expiring cards:",
          expiringError
        );
      } else if (expiringCardsCount && expiringCardsCount > 0) {
        alertsList.push({
          id: "expiring-cards",
          type: "error",
          title: "Cartes expirantes",
          description: `${expiringCardsCount} cartes d'assurance expirent dans les 30 prochains jours`,
          time: "Récent",
        });
      }

      setAlerts(alertsList);
    } catch (error: unknown) {
      console.error("Error fetching dashboard data:", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          "Impossible de charger les données du tableau de bord.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    stats,
    chartData,
    distributionData,
    alerts,
    loading,
    refetch: fetchDashboardData,
  };
}
