import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBestellung } from '@/lib/enrich';
import type { EnrichedBestellung } from '@/types/enriched';
import type { Bestellrunde, Gerichte } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BestellrundeDialog } from '@/components/dialogs/BestellrundeDialog';
import { BestellungDialog } from '@/components/dialogs/BestellungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconClock, IconCalendar,
  IconChefHat, IconUsers, IconShoppingCart, IconNotes,
  IconExternalLink, IconArrowRight, IconCircleCheck,
} from '@tabler/icons-react';

const APPGROUP_ID = '69d7bbbb8123dd061b3a8aa8';
const REPAIR_ENDPOINT = '/claude/build/repair';

export default function DashboardOverview() {
  const {
    bestellrunde, bestellung, gerichte,
    bestellrundeMap, gerichteMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedBestellung = enrichBestellung(bestellung, { bestellrundeMap, gerichteMap });

  // All hooks before early returns
  const [selectedRundeId, setSelectedRundeId] = useState<string | null>(null);
  const [rundeDialogOpen, setRundeDialogOpen] = useState(false);
  const [editRunde, setEditRunde] = useState<Bestellrunde | null>(null);
  const [deleteRundeTarget, setDeleteRundeTarget] = useState<Bestellrunde | null>(null);

  const [bestellungDialogOpen, setBestellungDialogOpen] = useState(false);
  const [editBestellung, setEditBestellung] = useState<EnrichedBestellung | null>(null);
  const [deleteBestellungTarget, setDeleteBestellungTarget] = useState<EnrichedBestellung | null>(null);
  const [prefilledRundeId, setPrefilledRundeId] = useState<string | null>(null);

  const now = new Date();

  // Sort rounds: upcoming first, then by date
  const sortedRunden = useMemo(() => {
    return [...bestellrunde].sort((a, b) => {
      const da = a.fields.bestelldatum ? new Date(a.fields.bestelldatum).getTime() : 0;
      const db = b.fields.bestelldatum ? new Date(b.fields.bestelldatum).getTime() : 0;
      return da - db;
    });
  }, [bestellrunde]);

  const activeRunden = useMemo(() => sortedRunden.filter(r => {
    if (!r.fields.deadline) return true;
    return new Date(r.fields.deadline) >= now;
  }), [sortedRunden, now]);

  const pastRunden = useMemo(() => sortedRunden.filter(r => {
    if (!r.fields.deadline) return false;
    return new Date(r.fields.deadline) < now;
  }), [sortedRunden, now]);

  const selectedRunde = useMemo(() => {
    if (selectedRundeId) return bestellrundeMap.get(selectedRundeId) ?? null;
    // Auto-select: nearest upcoming round
    if (activeRunden.length > 0) return activeRunden[0];
    if (sortedRunden.length > 0) return sortedRunden[0];
    return null;
  }, [selectedRundeId, bestellrundeMap, activeRunden, sortedRunden]);

  const bestellungenForRunde = useMemo(() => {
    if (!selectedRunde) return [];
    return enrichedBestellung.filter(b =>
      extractRecordId(b.fields.bestellrunde_auswahl) === selectedRunde.record_id
    );
  }, [enrichedBestellung, selectedRunde]);

  // Stats
  const totalBestellungen = bestellung.length;
  const totalGerichte = gerichte.length;
  const activeRundenCount = activeRunden.length;

  // Deadline status helper
  function getDeadlineStatus(runde: Bestellrunde): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } {
    if (!runde.fields.deadline) return { label: 'Keine Deadline', variant: 'secondary' };
    const diff = new Date(runde.fields.deadline).getTime() - now.getTime();
    const hours = diff / (1000 * 60 * 60);
    if (diff < 0) return { label: 'Abgelaufen', variant: 'destructive' };
    if (hours < 2) return { label: 'Läuft bald ab', variant: 'destructive' };
    if (hours < 24) return { label: `Noch ${Math.round(hours)}h`, variant: 'default' };
    const days = Math.floor(hours / 24);
    return { label: `Noch ${days} Tag${days !== 1 ? 'e' : ''}`, variant: 'secondary' };
  }

  function isActive(runde: Bestellrunde): boolean {
    if (!runde.fields.deadline) return true;
    return new Date(runde.fields.deadline) >= now;
  }

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          title="Aktive Runden"
          value={String(activeRundenCount)}
          description="Offene Bestellrunden"
          icon={<IconShoppingCart size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Bestellungen"
          value={String(totalBestellungen)}
          description="Alle Bestellungen"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gerichte"
          value={String(totalGerichte)}
          description="Im Menü verfügbar"
          icon={<IconChefHat size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Main content: Runden-Selector + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Runden-Liste */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Bestellrunden</h2>
            <Button size="sm" onClick={() => { setEditRunde(null); setRundeDialogOpen(true); }}>
              <IconPlus size={14} className="shrink-0 mr-1" />
              Neue Runde
            </Button>
          </div>

          {sortedRunden.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <IconShoppingCart size={36} className="text-muted-foreground mx-auto mb-3" stroke={1.5} />
              <p className="text-sm font-medium text-foreground mb-1">Noch keine Runden</p>
              <p className="text-xs text-muted-foreground mb-3">Erstelle die erste Bestellrunde</p>
              <Button size="sm" variant="outline" onClick={() => { setEditRunde(null); setRundeDialogOpen(true); }}>
                <IconPlus size={14} className="mr-1" /> Runde erstellen
              </Button>
            </div>
          )}

          {/* Active rounds */}
          {activeRunden.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Aktiv</p>
              {activeRunden.map(runde => {
                const deadlineStatus = getDeadlineStatus(runde);
                const count = enrichedBestellung.filter(b => extractRecordId(b.fields.bestellrunde_auswahl) === runde.record_id).length;
                const isSelected = selectedRunde?.record_id === runde.record_id;
                return (
                  <div
                    key={runde.record_id}
                    onClick={() => setSelectedRundeId(runde.record_id)}
                    className={`rounded-2xl border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-accent/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{runde.fields.runde_name || 'Unbenannte Runde'}</p>
                        <p className="text-xs text-muted-foreground truncate">{runde.fields.restaurant_name || '—'}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={deadlineStatus.variant} className="text-xs">{deadlineStatus.label}</Badge>
                        {isSelected && <IconCircleCheck size={14} className="text-primary shrink-0" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <IconUsers size={12} className="shrink-0" />{count} Bestellung{count !== 1 ? 'en' : ''}
                      </span>
                      {runde.fields.bestelldatum && (
                        <span className="flex items-center gap-1">
                          <IconCalendar size={12} className="shrink-0" />{formatDate(runde.fields.bestelldatum)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Past rounds */}
          {pastRunden.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Vergangen</p>
              {pastRunden.slice(0, 5).map(runde => {
                const count = enrichedBestellung.filter(b => extractRecordId(b.fields.bestellrunde_auswahl) === runde.record_id).length;
                const isSelected = selectedRunde?.record_id === runde.record_id;
                return (
                  <div
                    key={runde.record_id}
                    onClick={() => setSelectedRundeId(runde.record_id)}
                    className={`rounded-2xl border p-3 cursor-pointer transition-all opacity-70 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm opacity-100'
                        : 'border-border hover:border-primary/50 hover:bg-accent/30 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{runde.fields.runde_name || 'Unbenannte Runde'}</p>
                        <p className="text-xs text-muted-foreground truncate">{runde.fields.restaurant_name || '—'}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">Abgeschlossen</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <IconUsers size={12} className="shrink-0" />{count} Bestell{count !== 1 ? 'ungen' : 'ung'}
                      </span>
                      {runde.fields.bestelldatum && (
                        <span className="flex items-center gap-1">
                          <IconCalendar size={12} className="shrink-0" />{formatDate(runde.fields.bestelldatum)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Runden-Detail */}
        <div className="lg:col-span-2">
          {!selectedRunde ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <IconShoppingCart size={48} className="text-muted-foreground mx-auto mb-4" stroke={1.5} />
              <p className="font-medium text-foreground mb-2">Keine Runde ausgewählt</p>
              <p className="text-sm text-muted-foreground">Wähle eine Bestellrunde links aus oder erstelle eine neue.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Runden-Header */}
              <div className="rounded-2xl border border-border bg-card p-4 overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg truncate">{selectedRunde.fields.runde_name || 'Unbenannte Runde'}</h3>
                      {isActive(selectedRunde)
                        ? <Badge variant="default" className="shrink-0">Aktiv</Badge>
                        : <Badge variant="secondary" className="shrink-0">Abgeschlossen</Badge>
                      }
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{selectedRunde.fields.restaurant_name || 'Kein Restaurant angegeben'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {selectedRunde.fields.restaurant_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={selectedRunde.fields.restaurant_url} target="_blank" rel="noopener noreferrer">
                          <IconExternalLink size={14} className="mr-1 shrink-0" />
                          Bestellen
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => { setEditRunde(selectedRunde); setRundeDialogOpen(true); }}>
                      <IconPencil size={14} className="shrink-0" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteRundeTarget(selectedRunde)}>
                      <IconTrash size={14} className="shrink-0 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Runden-Metadaten */}
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                  {selectedRunde.fields.bestelldatum && (
                    <span className="flex items-center gap-1.5">
                      <IconCalendar size={14} className="shrink-0" />
                      Bestellung: {formatDate(selectedRunde.fields.bestelldatum)}
                    </span>
                  )}
                  {selectedRunde.fields.deadline && (
                    <span className={`flex items-center gap-1.5 ${
                      new Date(selectedRunde.fields.deadline) < now ? 'text-destructive' : ''
                    }`}>
                      <IconClock size={14} className="shrink-0" />
                      Deadline: {formatDate(selectedRunde.fields.deadline)}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <IconUsers size={14} className="shrink-0" />
                    {bestellungenForRunde.length} Teilnehmer
                  </span>
                </div>

                {selectedRunde.fields.notiz && (
                  <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground flex items-start gap-2">
                    <IconNotes size={14} className="shrink-0 mt-0.5" />
                    <span>{selectedRunde.fields.notiz}</span>
                  </div>
                )}
              </div>

              {/* Bestellungen */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                  <h4 className="font-medium text-sm">Bestellungen ({bestellungenForRunde.length})</h4>
                  <Button size="sm" onClick={() => {
                    setEditBestellung(null);
                    setPrefilledRundeId(selectedRunde.record_id);
                    setBestellungDialogOpen(true);
                  }}>
                    <IconPlus size={14} className="mr-1 shrink-0" />
                    Bestellen
                  </Button>
                </div>

                {bestellungenForRunde.length === 0 ? (
                  <div className="py-10 text-center bg-card">
                    <IconShoppingCart size={32} className="text-muted-foreground mx-auto mb-2" stroke={1.5} />
                    <p className="text-sm text-muted-foreground mb-3">Noch keine Bestellungen für diese Runde</p>
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditBestellung(null);
                      setPrefilledRundeId(selectedRunde.record_id);
                      setBestellungDialogOpen(true);
                    }}>
                      <IconPlus size={14} className="mr-1" />
                      Erste Bestellung aufgeben
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border bg-card">
                    {bestellungenForRunde.map(b => {
                      const gerichtId = extractRecordId(b.fields.gerichte_auswahl);
                      const gericht = gerichtId ? gerichteMap.get(gerichtId) : undefined;
                      return (
                        <div key={b.record_id} className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">
                                {b.fields.teilnehmer_vorname} {b.fields.teilnehmer_nachname}
                              </span>
                              {gericht && (
                                <span className="text-sm text-muted-foreground truncate flex items-center gap-1">
                                  <IconArrowRight size={12} className="shrink-0" />
                                  {gericht.fields.gericht_name}
                                  {gericht.fields.gericht_preis != null && (
                                    <span className="font-medium text-foreground ml-1">
                                      {formatCurrency(gericht.fields.gericht_preis)}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            {b.fields.sonderwunsch && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                Anmerkung: {b.fields.sonderwunsch}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                              setEditBestellung(b);
                              setPrefilledRundeId(null);
                              setBestellungDialogOpen(true);
                            }}>
                              <IconPencil size={13} className="shrink-0" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteBestellungTarget(b)}>
                              <IconTrash size={13} className="shrink-0 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Kostenübersicht */}
                {bestellungenForRunde.length > 0 && (() => {
                  const total = bestellungenForRunde.reduce((sum, b) => {
                    const gerichtId = extractRecordId(b.fields.gerichte_auswahl);
                    const gericht = gerichtId ? gerichteMap.get(gerichtId) : undefined;
                    return sum + (gericht?.fields.gericht_preis ?? 0);
                  }, 0);
                  return total > 0 ? (
                    <div className="border-t border-border bg-muted/30 px-4 py-3 flex justify-between items-center">
                      <span className="text-sm text-muted-foreground font-medium">Gesamtkosten</span>
                      <span className="font-semibold text-base">{formatCurrency(total)}</span>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Gerichte-Übersicht */}
              <GerichtePanel gerichte={gerichte} bestellungen={bestellungenForRunde} />
            </div>
          )}
        </div>
      </div>

      {/* Dialoge */}
      <BestellrundeDialog
        open={rundeDialogOpen}
        onClose={() => { setRundeDialogOpen(false); setEditRunde(null); }}
        onSubmit={async (fields) => {
          if (editRunde) {
            await LivingAppsService.updateBestellrundeEntry(editRunde.record_id, fields);
          } else {
            await LivingAppsService.createBestellrundeEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editRunde?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Bestellrunde']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Bestellrunde']}
      />

      <BestellungDialog
        open={bestellungDialogOpen}
        onClose={() => { setBestellungDialogOpen(false); setEditBestellung(null); setPrefilledRundeId(null); }}
        onSubmit={async (fields) => {
          if (editBestellung) {
            await LivingAppsService.updateBestellungEntry(editBestellung.record_id, fields);
          } else {
            await LivingAppsService.createBestellungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={
          editBestellung
            ? editBestellung.fields
            : prefilledRundeId
              ? { bestellrunde_auswahl: createRecordUrl(APP_IDS.BESTELLRUNDE, prefilledRundeId) }
              : undefined
        }
        bestellrundeList={bestellrunde}
        gerichteList={gerichte}
        enablePhotoScan={AI_PHOTO_SCAN['Bestellung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Bestellung']}
      />

      <ConfirmDialog
        open={!!deleteRundeTarget}
        title="Bestellrunde löschen"
        description={`Möchtest du die Runde "${deleteRundeTarget?.fields.runde_name}" wirklich löschen? Alle zugehörigen Bestellungen bleiben erhalten.`}
        onConfirm={async () => {
          if (deleteRundeTarget) {
            await LivingAppsService.deleteBestellrundeEntry(deleteRundeTarget.record_id);
            if (selectedRundeId === deleteRundeTarget.record_id) setSelectedRundeId(null);
            fetchAll();
          }
          setDeleteRundeTarget(null);
        }}
        onClose={() => setDeleteRundeTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteBestellungTarget}
        title="Bestellung löschen"
        description={`Bestellung von ${deleteBestellungTarget?.fields.teilnehmer_vorname} ${deleteBestellungTarget?.fields.teilnehmer_nachname} wirklich löschen?`}
        onConfirm={async () => {
          if (deleteBestellungTarget) {
            await LivingAppsService.deleteBestellungEntry(deleteBestellungTarget.record_id);
            fetchAll();
          }
          setDeleteBestellungTarget(null);
        }}
        onClose={() => setDeleteBestellungTarget(null)}
      />
    </div>
  );
}

// --- Gerichte Panel ---
function GerichtePanel({
  gerichte,
  bestellungen,
}: {
  gerichte: Gerichte[];
  bestellungen: EnrichedBestellung[];
}) {
  // Count how often each dish was ordered in this round
  const countMap = useMemo(() => {
    const m = new Map<string, number>();
    bestellungen.forEach(b => {
      const id = extractRecordId(b.fields.gerichte_auswahl);
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    });
    return m;
  }, [bestellungen]);

  if (gerichte.length === 0) return null;

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Gerichte[]>();
    gerichte.forEach(g => {
      const cat = g.fields.gericht_kategorie?.label ?? 'Sonstiges';
      const arr = map.get(cat) ?? [];
      arr.push(g);
      map.set(cat, arr);
    });
    return map;
  }, [gerichte]);

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <IconChefHat size={15} className="shrink-0 text-muted-foreground" />
          Speisekarte ({gerichte.length} Gerichte)
        </h4>
      </div>
      <div className="bg-card divide-y divide-border">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category}>
            <div className="px-4 py-2 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{category}</p>
            </div>
            <div className="divide-y divide-border/50">
              {items.map(g => {
                const ordered = countMap.get(g.record_id) ?? 0;
                return (
                  <div key={g.record_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{g.fields.gericht_name || '—'}</p>
                      {g.fields.gericht_beschreibung && (
                        <p className="text-xs text-muted-foreground truncate">{g.fields.gericht_beschreibung}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {ordered > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {ordered}× bestellt
                        </Badge>
                      )}
                      {g.fields.gericht_preis != null && (
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(g.fields.gericht_preis)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Skeleton & Error ---
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen.</p>}
    </div>
  );
}
