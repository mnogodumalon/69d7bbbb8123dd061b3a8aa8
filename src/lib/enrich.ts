import type { EnrichedBestellung } from '@/types/enriched';
import type { Bestellrunde, Bestellung, Gerichte } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface BestellungMaps {
  bestellrundeMap: Map<string, Bestellrunde>;
  gerichteMap: Map<string, Gerichte>;
}

export function enrichBestellung(
  bestellung: Bestellung[],
  maps: BestellungMaps
): EnrichedBestellung[] {
  return bestellung.map(r => ({
    ...r,
    bestellrunde_auswahlName: resolveDisplay(r.fields.bestellrunde_auswahl, maps.bestellrundeMap, 'runde_name'),
    gerichte_auswahlName: resolveDisplay(r.fields.gerichte_auswahl, maps.gerichteMap, 'gericht_name'),
  }));
}
