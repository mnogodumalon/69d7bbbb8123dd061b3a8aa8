import type { Bestellung, Bestellrunde, Gerichte } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPencil } from '@tabler/icons-react';

interface BestellungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Bestellung | null;
  onEdit: (record: Bestellung) => void;
  bestellrundeList: Bestellrunde[];
  gerichteList: Gerichte[];
}

export function BestellungViewDialog({ open, onClose, record, onEdit, bestellrundeList, gerichteList }: BestellungViewDialogProps) {
  function getBestellrundeDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return bestellrundeList.find(r => r.record_id === id)?.fields.runde_name ?? '—';
  }

  function getGerichteDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return gerichteList.find(r => r.record_id === id)?.fields.gericht_name ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bestellung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bestellrunde</Label>
            <p className="text-sm">{getBestellrundeDisplayName(record.fields.bestellrunde_auswahl)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vorname</Label>
            <p className="text-sm">{record.fields.teilnehmer_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachname</Label>
            <p className="text-sm">{record.fields.teilnehmer_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gewünschte Gerichte</Label>
            <p className="text-sm">{getGerichteDisplayName(record.fields.gerichte_auswahl)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sonderwünsche / Anmerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.sonderwunsch ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}