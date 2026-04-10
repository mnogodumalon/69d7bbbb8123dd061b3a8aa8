import type { Bestellung } from './app';

export type EnrichedBestellung = Bestellung & {
  bestellrunde_auswahlName: string;
  gerichte_auswahlName: string;
};
