import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Bestellrunde, Gerichte } from '@/types/app';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BestellrundeDialog } from '@/components/dialogs/BestellrundeDialog';
import { GerichteDialog } from '@/components/dialogs/GerichteDialog';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  IconPlus, IconTrash, IconChevronRight, IconCheck,
  IconShoppingCart, IconUsers, IconChefHat, IconArrowLeft,
  IconHome,
} from '@tabler/icons-react';

// ---- Types ----

interface TeilnehmerEintrag {
  id: string;
  vorname: string;
  nachname: string;
  gerichtId: string | null;
  sonderwunsch: string;
}

interface ErstellteBestellung {
  vorname: string;
  nachname: string;
  gerichtName: string;
  preis: number;
}

let _nextId = 1;
function newId() {
  return String(_nextId++);
}

function newEintrag(): TeilnehmerEintrag {
  return { id: newId(), vorname: '', nachname: '', gerichtId: null, sonderwunsch: '' };
}

// ---- Step 1 ----

interface Step1Props {
  runden: Bestellrunde[];
  selectedRundeId: string | null;
  onSelect: (id: string) => void;
  onWeiter: () => void;
  rundeDialogOpen: boolean;
  setRundeDialogOpen: (v: boolean) => void;
  fetchRunden: () => void;
}

function Step1({
  runden,
  selectedRundeId,
  onSelect,
  onWeiter,
  rundeDialogOpen,
  setRundeDialogOpen,
  fetchRunden,
}: Step1Props) {
  const selectedRunde = runden.find(r => r.record_id === selectedRundeId) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Bestellrunde wählen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Wähle die Bestellrunde aus, für die du eine Sammelbestellung aufgeben möchtest.
        </p>
      </div>

      <EntitySelectStep
        items={runden.map(r => ({
          id: r.record_id,
          title: r.fields.runde_name ?? '(Kein Name)',
          subtitle: r.fields.restaurant_name ?? undefined,
          stats: r.fields.bestelldatum
            ? [{ label: 'Bestelldatum', value: formatDate(r.fields.bestelldatum) }]
            : undefined,
        }))}
        onSelect={onSelect}
        searchPlaceholder="Runde suchen..."
        emptyText="Keine Bestellrunden vorhanden."
        emptyIcon={<IconShoppingCart size={32} />}
        createLabel="Neue Runde erstellen"
        onCreateNew={() => setRundeDialogOpen(true)}
        createDialog={
          <BestellrundeDialog
            open={rundeDialogOpen}
            onClose={() => setRundeDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createBestellrundeEntry(fields);
              fetchRunden();
            }}
            defaultValues={undefined}
            enablePhotoScan={AI_PHOTO_SCAN['Bestellrunde']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Bestellrunde']}
          />
        }
      />

      {selectedRunde && (
        <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <IconCheck size={16} className="text-primary" stroke={2.5} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{selectedRunde.fields.runde_name}</p>
              {selectedRunde.fields.restaurant_name && (
                <p className="text-xs text-muted-foreground truncate">{selectedRunde.fields.restaurant_name}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {selectedRunde.fields.bestelldatum && (
              <span>
                Bestelldatum:{' '}
                <span className="font-medium text-foreground">
                  {formatDate(selectedRunde.fields.bestelldatum)}
                </span>
              </span>
            )}
            {selectedRunde.fields.deadline && (
              <span>
                Deadline:{' '}
                <span className="font-medium text-foreground">
                  {formatDate(selectedRunde.fields.deadline)}
                </span>
              </span>
            )}
          </div>
          {selectedRunde.fields.notiz && (
            <p className="text-xs text-muted-foreground italic">
              {selectedRunde.fields.notiz}
            </p>
          )}
          <Button className="w-full gap-2" onClick={onWeiter}>
            Weiter
            <IconChevronRight size={16} stroke={2.5} />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- Step 2 ----

interface Step2Props {
  runde: Bestellrunde;
  gerichte: Gerichte[];
  eintraege: TeilnehmerEintrag[];
  setEintraege: (v: TeilnehmerEintrag[]) => void;
  activeEintragId: string | null;
  setActiveEintragId: (v: string | null) => void;
  onSpeichern: () => Promise<void>;
  saving: boolean;
  onZurueck: () => void;
  gerichteDialogOpen: boolean;
  setGerichteDialogOpen: (v: boolean) => void;
  fetchGerichte: () => void;
}

function Step2({
  runde,
  gerichte,
  eintraege,
  setEintraege,
  activeEintragId,
  setActiveEintragId,
  onSpeichern,
  saving,
  onZurueck,
  gerichteDialogOpen,
  setGerichteDialogOpen,
  fetchGerichte,
}: Step2Props) {
  // Group gerichte by category
  const kategorienMap: Record<string, Gerichte[]> = {};
  for (const g of gerichte) {
    const kat =
      g.fields.gericht_kategorie
        ? typeof g.fields.gericht_kategorie === 'object'
          ? (g.fields.gericht_kategorie as { key: string; label: string }).label
          : String(g.fields.gericht_kategorie)
        : 'Sonstiges';
    if (!kategorienMap[kat]) kategorienMap[kat] = [];
    kategorienMap[kat].push(g);
  }

  const gesamtPreis = eintraege.reduce((sum, e) => {
    const g = gerichte.find(g => g.record_id === e.gerichtId);
    return sum + (g?.fields.gericht_preis ?? 0);
  }, 0);

  const activeIdx = eintraege.findIndex(e => e.id === activeEintragId);

  function updateEintrag(id: string, patch: Partial<TeilnehmerEintrag>) {
    setEintraege(eintraege.map(e => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeEintrag(id: string) {
    const next = eintraege.filter(e => e.id !== id);
    setEintraege(next);
    if (activeEintragId === id) {
      setActiveEintragId(next.length > 0 ? next[next.length - 1].id : null);
    }
  }

  function addEintrag() {
    const neu = newEintrag();
    setEintraege([...eintraege, neu]);
    setActiveEintragId(neu.id);
  }

  function selectGericht(gerichtId: string) {
    if (!activeEintragId) {
      // Pick first eintrag without gericht, or last
      const ohne = eintraege.find(e => !e.gerichtId);
      const targetId = ohne ? ohne.id : eintraege[eintraege.length - 1]?.id;
      if (targetId) {
        updateEintrag(targetId, { gerichtId });
        setActiveEintragId(targetId);
      }
      return;
    }
    updateEintrag(activeEintragId, { gerichtId });
  }

  const canSave =
    eintraege.length > 0 &&
    eintraege.every(e => e.vorname.trim() && e.nachname.trim() && e.gerichtId);

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Bestellungen aufgeben</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Für: <span className="font-medium text-foreground">{runde.fields.runde_name}</span>
          {runde.fields.restaurant_name && (
            <> &mdash; {runde.fields.restaurant_name}</>
          )}
        </p>
      </div>

      {/* Live feedback bar */}
      <div className="rounded-xl border bg-muted/50 px-4 py-3 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-sm">
          <IconUsers size={16} className="text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Teilnehmer:</span>
          <span className="font-semibold">{eintraege.length}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <IconShoppingCart size={16} className="text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Gesamtkosten:</span>
          <span className="font-semibold text-primary">{formatCurrency(gesamtPreis)}</span>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Gerichte */}
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <IconChefHat size={16} className="text-primary shrink-0" />
              <span className="font-semibold text-sm">Gerichte</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => setGerichteDialogOpen(true)}
            >
              <IconPlus size={14} />
              Neues Gericht
            </Button>
          </div>

          <GerichteDialog
            open={gerichteDialogOpen}
            onClose={() => setGerichteDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createGerichteEntry(fields);
              fetchGerichte();
            }}
            defaultValues={undefined}
            enablePhotoScan={AI_PHOTO_SCAN['Gerichte']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Gerichte']}
          />

          <div className="flex-1 overflow-y-auto p-3 space-y-4 max-h-[420px]">
            {Object.keys(kategorienMap).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Keine Gerichte vorhanden. Füge zuerst ein Gericht hinzu.
              </div>
            ) : (
              Object.entries(kategorienMap).map(([kat, items]) => (
                <div key={kat}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                    {kat}
                  </p>
                  <div className="space-y-1.5">
                    {items.map(g => {
                      const isSelected =
                        activeEintragId &&
                        eintraege.find(e => e.id === activeEintragId)?.gerichtId === g.record_id;
                      return (
                        <button
                          key={g.record_id}
                          onClick={() => selectGericht(g.record_id)}
                          className={`w-full text-left rounded-lg px-3 py-2.5 border transition-colors overflow-hidden ${
                            isSelected
                              ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20'
                              : 'bg-card hover:bg-accent border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{g.fields.gericht_name ?? '—'}</p>
                              {g.fields.gericht_beschreibung && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {g.fields.gericht_beschreibung}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-primary shrink-0 mt-0.5">
                              {formatCurrency(g.fields.gericht_preis)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Teilnehmerliste */}
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
            <IconUsers size={16} className="text-primary shrink-0" />
            <span className="font-semibold text-sm">Teilnehmer</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[420px]">
            {eintraege.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Noch keine Teilnehmer. Klicke auf "Hinzufügen".
              </div>
            )}
            {eintraege.map((e, idx) => {
              const gericht = gerichte.find(g => g.record_id === e.gerichtId);
              const isActive = e.id === activeEintragId;
              return (
                <div
                  key={e.id}
                  onClick={() => setActiveEintragId(e.id)}
                  className={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors ${
                    isActive
                      ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border bg-card hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); removeEintrag(e.id); }}
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Entfernen"
                    >
                      <IconTrash size={14} stroke={2} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Vorname *"
                      value={e.vorname}
                      onChange={ev => { ev.stopPropagation(); updateEintrag(e.id, { vorname: ev.target.value }); }}
                      onClick={ev => ev.stopPropagation()}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Nachname *"
                      value={e.nachname}
                      onChange={ev => { ev.stopPropagation(); updateEintrag(e.id, { nachname: ev.target.value }); }}
                      onClick={ev => ev.stopPropagation()}
                      className="h-8 text-sm"
                    />
                  </div>
                  {gericht ? (
                    <div className="flex items-center gap-2 rounded-md bg-primary/8 border border-primary/20 px-2.5 py-1.5">
                      <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
                        {gericht.fields.gericht_name}
                      </span>
                      <span className="text-xs text-primary font-semibold shrink-0">
                        {formatCurrency(gericht.fields.gericht_preis)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                      Kein Gericht gewählt — klicke links auf ein Gericht.
                    </div>
                  )}
                  <Textarea
                    placeholder="Sonderwunsch (optional)"
                    value={e.sonderwunsch}
                    onChange={ev => { ev.stopPropagation(); updateEintrag(e.id, { sonderwunsch: ev.target.value }); }}
                    onClick={ev => ev.stopPropagation()}
                    className="text-sm resize-none h-16"
                  />
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={addEintrag}
            >
              <IconPlus size={15} stroke={2} />
              Hinzufügen
            </Button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button variant="outline" className="gap-2 sm:w-auto w-full" onClick={onZurueck}>
          <IconArrowLeft size={15} stroke={2} />
          Zurück
        </Button>
        <Button
          className="gap-2 flex-1"
          disabled={!canSave || saving}
          onClick={onSpeichern}
        >
          {saving ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              Wird gespeichert…
            </>
          ) : (
            <>
              <IconCheck size={16} stroke={2.5} />
              {eintraege.length === 1
                ? '1 Bestellung speichern'
                : `${eintraege.length} Bestellungen speichern`}
            </>
          )}
        </Button>
      </div>

      {!canSave && eintraege.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Alle Pflichtfelder (Vorname, Nachname, Gericht) müssen ausgefüllt sein.
        </p>
      )}
    </div>
  );
}

// ---- Step 3 ----

interface Step3Props {
  erstellteBestellungen: ErstellteBestellung[];
  onNeueSammelbestellung: () => void;
}

function Step3({ erstellteBestellungen, onNeueSammelbestellung }: Step3Props) {
  const gesamtPreis = erstellteBestellungen.reduce((sum, b) => sum + b.preis, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center gap-3 py-4">
        <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
          <IconCheck size={28} className="text-green-600" stroke={2.5} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {erstellteBestellungen.length === 1
              ? '1 Bestellung erfolgreich aufgegeben!'
              : `${erstellteBestellungen.length} Bestellungen erfolgreich aufgegeben!`}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Die Sammelbestellung wurde gespeichert.
          </p>
        </div>
      </div>

      {/* Order list */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
          <IconShoppingCart size={16} className="text-primary shrink-0" />
          <span className="font-semibold text-sm">Bestellübersicht</span>
        </div>
        <div className="divide-y">
          {erstellteBestellungen.map((b, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3 overflow-hidden">
              <Badge variant="secondary" className="shrink-0 text-xs font-semibold">
                #{idx + 1}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {b.vorname} {b.nachname}
                </p>
                <p className="text-xs text-muted-foreground truncate">{b.gerichtName}</p>
              </div>
              <span className="text-sm font-semibold text-primary shrink-0">
                {formatCurrency(b.preis)}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-semibold">Gesamt</span>
          <span className="text-base font-bold text-primary">{formatCurrency(gesamtPreis)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="gap-2 flex-1"
          onClick={onNeueSammelbestellung}
        >
          <IconPlus size={15} stroke={2} />
          Neue Sammelbestellung
        </Button>
        <a href="#/" className="flex-1">
          <Button className="w-full gap-2">
            <IconHome size={15} stroke={2} />
            Zum Dashboard
          </Button>
        </a>
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function SammelbestellungPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Data
  const [runden, setRunden] = useState<Bestellrunde[]>([]);
  const [gerichte, setGerichte] = useState<Gerichte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Step 1
  const [selectedRundeId, setSelectedRundeId] = useState<string | null>(null);
  const [rundeDialogOpen, setRundeDialogOpen] = useState(false);

  // Step 2
  const [eintraege, setEintraege] = useState<TeilnehmerEintrag[]>([newEintrag()]);
  const [activeEintragId, setActiveEintragId] = useState<string | null>(null);
  const [gerichteDialogOpen, setGerichteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 3
  const [erstellteBestellungen, setErstellteBestellungen] = useState<ErstellteBestellung[]>([]);

  // Fetch
  const fetchRunden = useCallback(async () => {
    const res = await LivingAppsService.getBestellrunde();
    setRunden(res);
  }, []);

  const fetchGerichte = useCallback(async () => {
    const res = await LivingAppsService.getGerichte();
    setGerichte(res);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchRunden(), fetchGerichte()]);

        // Deep-link: ?rundeId=xxx pre-selects a round
        const rundeId = searchParams.get('rundeId');
        if (rundeId) {
          setSelectedRundeId(rundeId);
        }

        // Deep-link: ?step=2 goes to step 2
        const stepParam = parseInt(searchParams.get('step') ?? '', 10);
        if (stepParam >= 1 && stepParam <= 3) {
          setCurrentStep(stepParam);
        }
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('step', String(currentStep));
    if (selectedRundeId) params.set('rundeId', selectedRundeId);
    setSearchParams(params, { replace: true });
  }, [currentStep, selectedRundeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 1 handlers
  function handleSelectRunde(id: string) {
    setSelectedRundeId(id);
  }

  function handleWeiterStep1() {
    if (!selectedRundeId) return;
    // Reset step 2 state when going to step 2
    const erster = newEintrag();
    setEintraege([erster]);
    setActiveEintragId(erster.id);
    setCurrentStep(2);
  }

  // Step 2: save all orders
  async function handleSpeichern() {
    if (!selectedRundeId) return;
    setSaving(true);
    try {
      const ergebnis: ErstellteBestellung[] = [];
      for (const e of eintraege) {
        if (!e.gerichtId) continue;
        await LivingAppsService.createBestellungEntry({
          bestellrunde_auswahl: createRecordUrl(APP_IDS.BESTELLRUNDE, selectedRundeId),
          teilnehmer_vorname: e.vorname.trim(),
          teilnehmer_nachname: e.nachname.trim(),
          gerichte_auswahl: createRecordUrl(APP_IDS.GERICHTE, e.gerichtId),
          sonderwunsch: e.sonderwunsch.trim() || undefined,
        });
        const gericht = gerichte.find(g => g.record_id === e.gerichtId);
        ergebnis.push({
          vorname: e.vorname.trim(),
          nachname: e.nachname.trim(),
          gerichtName: gericht?.fields.gericht_name ?? '—',
          preis: gericht?.fields.gericht_preis ?? 0,
        });
      }
      setErstellteBestellungen(ergebnis);
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSaving(false);
    }
  }

  function handleNeueSammelbestellung() {
    setSelectedRundeId(null);
    const erster = newEintrag();
    setEintraege([erster]);
    setActiveEintragId(erster.id);
    setErstellteBestellungen([]);
    setCurrentStep(1);
  }

  const selectedRunde = runden.find(r => r.record_id === selectedRundeId) ?? null;

  return (
    <IntentWizardShell
      title="Sammelbestellung aufgeben"
      subtitle="Gib Bestellungen für mehrere Teilnehmer auf einmal auf."
      steps={[
        { label: 'Bestellrunde' },
        { label: 'Bestellungen' },
        { label: 'Zusammenfassung' },
      ]}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={() => window.location.reload()}
    >
      {currentStep === 1 && (
        <Step1
          runden={runden}
          selectedRundeId={selectedRundeId}
          onSelect={handleSelectRunde}
          onWeiter={handleWeiterStep1}
          rundeDialogOpen={rundeDialogOpen}
          setRundeDialogOpen={setRundeDialogOpen}
          fetchRunden={fetchRunden}
        />
      )}
      {currentStep === 2 && selectedRunde && (
        <Step2
          runde={selectedRunde}
          gerichte={gerichte}
          eintraege={eintraege}
          setEintraege={setEintraege}
          activeEintragId={activeEintragId}
          setActiveEintragId={setActiveEintragId}
          onSpeichern={handleSpeichern}
          saving={saving}
          onZurueck={() => setCurrentStep(1)}
          gerichteDialogOpen={gerichteDialogOpen}
          setGerichteDialogOpen={setGerichteDialogOpen}
          fetchGerichte={fetchGerichte}
        />
      )}
      {currentStep === 3 && (
        <Step3
          erstellteBestellungen={erstellteBestellungen}
          onNeueSammelbestellung={handleNeueSammelbestellung}
        />
      )}
    </IntentWizardShell>
  );
}
