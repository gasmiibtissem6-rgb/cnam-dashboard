
import { useCallback, useEffect, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isWithinInterval,
  addDays,
  getDaysInMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Clock,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle,
  Loader2,
  Filter,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

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

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type CalendarEvent =
  Database["public"]["Tables"]["calendar_events"]["Row"];

type EventFormData = {
  title: string;
  description: string;
  event_type: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
};

const initialForm: EventFormData = {
  title: "",
  description: "",
  event_type: "reminder",
  start_date: "",
  end_date: "",
  all_day: true,
};

const eventTypes = [
  { value: "deadline", label: "Échéance", color: "bg-destructive" },
  { value: "renewal", label: "Renouvellement", color: "bg-warning" },
  { value: "audit", label: "Audit", color: "bg-info" },
  { value: "meeting", label: "Réunion", color: "bg-primary" },
  { value: "reminder", label: "Rappel", color: "bg-accent" },
  { value: "other", label: "Autre", color: "bg-muted-foreground" },
];

function getEventTypeInfo(type: string) {
  return (
    eventTypes.find((item) => item.value === type) ??
    eventTypes[eventTypes.length - 1]
  );
}

function EventFormFields({
  form,
  onChange,
}: {
  form: EventFormData;
  onChange: (form: EventFormData) => void;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="event-title">Titre *</Label>
        <Input
          id="event-title"
          value={form.title}
          onChange={(event) =>
            onChange({ ...form, title: event.target.value })
          }
          placeholder="Titre de l'événement"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="event-type">Type</Label>
        <Select
          value={form.event_type}
          onValueChange={(value) =>
            onChange({ ...form, event_type: value })
          }
        >
          <SelectTrigger id="event-type">
            <SelectValue placeholder="Sélectionner un type" />
          </SelectTrigger>

          <SelectContent>
            {eventTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="event-start">Date de début *</Label>
          <Input
            id="event-start"
            type="datetime-local"
            value={form.start_date}
            onChange={(event) =>
              onChange({ ...form, start_date: event.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="event-end">Date de fin</Label>
          <Input
            id="event-end"
            type="datetime-local"
            value={form.end_date}
            onChange={(event) =>
              onChange({ ...form, end_date: event.target.value })
            }
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="event-all-day"
          checked={form.all_day}
          onCheckedChange={(checked) =>
            onChange({ ...form, all_day: checked === true })
          }
        />

        <Label htmlFor="event-all-day">
          Toute la journée
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="event-description">Description</Label>
        <Textarea
          id="event-description"
          value={form.description}
          onChange={(event) =>
            onChange({ ...form, description: event.target.value })
          }
          placeholder="Description facultative"
          rows={3}
        />
      </div>
    </div>
  );
}

export default function CalendrierPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState("all");

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [selectedEvent, setSelectedEvent] =
    useState<CalendarEvent | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventForm, setEventForm] =
    useState<EventFormData>(initialForm);

  const { toast } = useToast();
  const { user } = useAuth();

  const fetchEvents = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .order("start_date", { ascending: true });

      if (error) {
        throw error;
      }

      setEvents(data ?? []);
    } catch (error: unknown) {
      console.error("Erreur chargement calendrier :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les événements.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const handleAddEvent = () => {
    setSelectedEvent(null);

    setEventForm({
      ...initialForm,
      start_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });

    setIsAddDialogOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);

    setEventForm({
      title: event.title,
      description: event.description ?? "",
      event_type: event.event_type,
      start_date: format(
        new Date(event.start_date),
        "yyyy-MM-dd'T'HH:mm"
      ),
      end_date: event.end_date
        ? format(new Date(event.end_date), "yyyy-MM-dd'T'HH:mm")
        : "",
      all_day: event.all_day ?? false,
    });

    setIsEditDialogOpen(true);
  };

  const handleSaveEvent = async (isEdit: boolean) => {
    if (!eventForm.title.trim() || !eventForm.start_date) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir les champs obligatoires.",
      });
      return;
    }

    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Vous devez être connecté.",
      });
      return;
    }

    const startDate = new Date(eventForm.start_date);
    const endDate = eventForm.end_date
      ? new Date(eventForm.end_date)
      : null;

    if (
      Number.isNaN(startDate.getTime()) ||
      (endDate && Number.isNaN(endDate.getTime()))
    ) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Les dates saisies sont invalides.",
      });
      return;
    }

    if (endDate && endDate < startDate) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "La date de fin doit suivre la date de début.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const eventData = {
        title: eventForm.title.trim(),
        description: eventForm.description.trim() || null,
        event_type: eventForm.event_type,
        start_date: startDate.toISOString(),
        end_date: endDate ? endDate.toISOString() : null,
        all_day: eventForm.all_day,
      };

      if (isEdit) {
        if (!selectedEvent) {
          throw new Error("Aucun événement sélectionné.");
        }

        const { error } = await supabase
          .from("calendar_events")
          .update(eventData)
          .eq("id", selectedEvent.id);

        if (error) {
          throw error;
        }

        setIsEditDialogOpen(false);

        toast({
          title: "Succès",
          description: "Événement modifié avec succès.",
        });
      } else {
        const { error } = await supabase
          .from("calendar_events")
          .insert({
            ...eventData,
            created_by: user.id,
          });

        if (error) {
          throw error;
        }

        setIsAddDialogOpen(false);

        toast({
          title: "Succès",
          description: "Événement créé avec succès.",
        });
      }

      await fetchEvents();
    } catch (error: unknown) {
      console.error("Erreur enregistrement événement :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible d'enregistrer l'événement.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    const confirmed = window.confirm(
      `Voulez-vous supprimer l'événement "${event.title}" ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", event.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Succès",
        description: "Événement supprimé avec succès.",
      });

      await fetchEvents();
    } catch (error: unknown) {
      console.error("Erreur suppression événement :", error);

      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de supprimer l'événement.",
      });
    }
  };

  const eventsForSelectedDate = events.filter((event) => {
    const start = new Date(event.start_date);
    const end = event.end_date
      ? new Date(event.end_date)
      : start;

    return (
      isSameDay(start, selectedDate) ||
      isSameDay(end, selectedDate) ||
      (start <= end &&
        isWithinInterval(selectedDate, { start, end }))
    );
  });

  const filteredEvents =
    typeFilter === "all"
      ? eventsForSelectedDate
      : eventsForSelectedDate.filter(
          (event) => event.event_type === typeFilter
        );

  const datesWithEvents = events.map(
    (event) => new Date(event.start_date)
  );

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const monthEvents = events.filter((event) => {
    const date = new Date(event.start_date);

    return isWithinInterval(date, {
      start: monthStart,
      end: monthEnd,
    });
  });

  const yearEvents = events.filter(
    (event) =>
      new Date(event.start_date).getFullYear() ===
      selectedDate.getFullYear()
  );

  const now = new Date();
  const weekEnd = addDays(now, 7);

  const upcomingWeek = events.filter((event) => {
    const date = new Date(event.start_date);
    return date >= now && date <= weekEnd;
  });

  const stats = {
    total: monthEvents.length,
    deadlines: monthEvents.filter(
      (event) => event.event_type === "deadline"
    ).length,
    renewals: monthEvents.filter(
      (event) => event.event_type === "renewal"
    ).length,
    meetings: monthEvents.filter(
      (event) => event.event_type === "meeting"
    ).length,
    totalYear: yearEvents.length,
    upcomingWeek: upcomingWeek.length,
    avgPerDay: Number(
      (
        monthEvents.length / getDaysInMonth(selectedDate)
      ).toFixed(1)
    ),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Calendrier & Échéances
            </h1>

            <p className="text-muted-foreground">
              Gérez les événements, échéances et rappels.
            </p>
          </div>

          <Button onClick={handleAddEvent}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvel événement
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <CalendarIcon className="h-6 w-6 text-primary" />

                <div>
                  <p className="text-sm text-muted-foreground">
                    Ce mois
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-6 w-6 text-destructive" />

                <div>
                  <p className="text-sm text-muted-foreground">
                    Échéances
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.deadlines}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Clock className="h-6 w-6 text-warning" />

                <div>
                  <p className="text-sm text-muted-foreground">
                    Renouvellements
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.renewals}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <CheckCircle className="h-6 w-6 text-info" />

                <div>
                  <p className="text-sm text-muted-foreground">
                    Réunions
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.meetings}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Total annuel
              </p>
              <p className="text-3xl font-bold">
                {stats.totalYear}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                7 prochains jours
              </p>
              <p className="text-3xl font-bold">
                {stats.upcomingWeek}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Moyenne par jour
              </p>
              <p className="text-3xl font-bold">
                {stats.avgPerDay}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Calendrier</CardTitle>
            </CardHeader>

            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                  }
                }}
                locale={fr}
                modifiers={{
                  hasEvent: datesWithEvents,
                }}
                modifiersStyles={{
                  hasEvent: {
                    fontWeight: "bold",
                    textDecoration: "underline",
                    textDecorationColor: "hsl(var(--primary))",
                  },
                }}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Événements du{" "}
                {format(selectedDate, "d MMMM yyyy", {
                  locale: fr,
                })}
              </CardTitle>

              <Select
                value={typeFilter}
                onValueChange={setTypeFilter}
              >
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrer" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">
                    Tous les types
                  </SelectItem>

                  {eventTypes.map((type) => (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  Aucun événement pour cette date.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((event) => {
                    const typeInfo = getEventTypeInfo(
                      event.event_type
                    );

                    return (
                      <div
                        key={event.id}
                        className="flex items-start gap-4 rounded-lg border bg-card p-4"
                      >
                        <div
                          className={`mt-1.5 h-3 w-3 rounded-full ${typeInfo.color}`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-medium">
                                {event.title}
                              </h4>

                              <p className="text-sm text-muted-foreground">
                                {event.all_day
                                  ? "Toute la journée"
                                  : format(
                                      new Date(event.start_date),
                                      "HH:mm"
                                    )}

                                {event.end_date &&
                                  ` - ${format(
                                    new Date(event.end_date),
                                    "HH:mm"
                                  )}`}
                              </p>
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Actions pour ${event.title}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleEditEvent(event)
                                  }
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() =>
                                    void handleDeleteEvent(event)
                                  }
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {event.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {event.description}
                            </p>
                          )}

                          <Badge
                            variant="outline"
                            className="mt-2"
                          >
                            {typeInfo.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Nouvel événement
              </DialogTitle>

              <DialogDescription>
                Créez un nouvel événement.
              </DialogDescription>
            </DialogHeader>

            <EventFormFields
              form={eventForm}
              onChange={setEventForm}
            />

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Annuler
              </Button>

              <Button
                disabled={isSubmitting}
                onClick={() => void handleSaveEvent(false)}
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Modifier l'événement
              </DialogTitle>

              <DialogDescription>
                Modifiez les informations de l'événement.
              </DialogDescription>
            </DialogHeader>

            <EventFormFields
              form={eventForm}
              onChange={setEventForm}
            />

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Annuler
              </Button>

              <Button
                disabled={isSubmitting}
                onClick={() => void handleSaveEvent(true)}
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
