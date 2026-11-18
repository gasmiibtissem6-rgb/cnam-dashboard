import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, Loader2, Search, Filter, Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserDocument {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string;
  status: string;
  file_size: number | null;
  created_at: string;
}

interface Props {
  documents: UserDocument[];
  loading: boolean;
  getStatusBadge: (status: string) => React.ReactNode;
  onUpload: () => void;
}

const typeIcons: Record<string, string> = {
  "Attestation": "📄",
  "Facture": "🧾",
  "Ordonnance": "💊",
  "Certificat": "📋",
  "Rapport": "📊",
  "Carte CNAM": "💳",
  "Bilan": "🔬",
};

export function UserDocumentsTab({ documents, loading, getStatusBadge, onUpload }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  const filtered = documents.filter((d) => {
    const matchesSearch = d.file_name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || d.document_type === typeFilter;
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const documentTypes = [...new Set(documents.map((d) => d.document_type))];

  const handleView = async (doc: UserDocument) => {
  try {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_url, 300);

    if (error) throw error;

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  } catch (err: unknown) {
    console.error("Document view error:", err);

    toast({
      variant: "destructive",
      title: "Erreur",
      description: "Impossible d'ouvrir le document.",
    });
  }
};

  const handleDownload = async (doc: UserDocument) => {
  try {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_url, 300, { download: true });

    if (error) throw error;

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  } catch (err: unknown) {
    console.error("Document download error:", err);

    toast({
      variant: "destructive",
      title: "Erreur",
      description: "Impossible de télécharger le document.",
    });
  }
};

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg font-semibold">Mes documents</h2>
        <Button onClick={onUpload}>
          <Upload className="h-4 w-4 mr-1" /> Téléverser
        </Button>
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher un document..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 shadow-none focus-visible:ring-0 p-0 h-8" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="border-0 shadow-none h-8">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {documentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="border-0 shadow-none h-8">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Approuvé</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Documents Grid */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{documents.length === 0 ? "Aucun document téléversé" : "Aucun résultat"}</p>
              {documents.length === 0 && <Button className="mt-4" onClick={onUpload}>Téléverser un document</Button>}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((d) => (
                <div key={d.id} className="p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{typeIcons[d.document_type] || "📄"}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[160px]">{d.file_name}</p>
                        <p className="text-xs text-muted-foreground">{d.document_type}</p>
                      </div>
                    </div>
                    {getStatusBadge(d.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>{format(new Date(d.created_at), "dd/MM/yyyy")}</span>
                    <span>{formatSize(d.file_size)}</span>
                  </div>
                  {d.validation_notes && (
                    <p className="text-xs text-muted-foreground p-2 rounded bg-muted/50 mb-3 line-clamp-2">{d.validation_notes}</p>
                  )}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => handleView(d)}>
                      <Eye className="h-3 w-3 mr-1" /> Voir
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => handleDownload(d)}>
                      <Download className="h-3 w-3 mr-1" /> Télécharger
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
