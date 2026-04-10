// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Bestellrunde {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    runde_name?: string;
    restaurant_name?: string;
    restaurant_url?: string;
    bestelldatum?: string; // Format: YYYY-MM-DD oder ISO String
    deadline?: string; // Format: YYYY-MM-DD oder ISO String
    notiz?: string;
  };
}

export interface Bestellung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bestellrunde_auswahl?: string; // applookup -> URL zu 'Bestellrunde' Record
    teilnehmer_vorname?: string;
    teilnehmer_nachname?: string;
    gerichte_auswahl?: string; // applookup -> URL zu 'Gerichte' Record
    sonderwunsch?: string;
  };
}

export interface Gerichte {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    gericht_name?: string;
    gericht_beschreibung?: string;
    gericht_preis?: number;
    gericht_kategorie?: LookupValue;
  };
}

export const APP_IDS = {
  BESTELLRUNDE: '69d7bba402cbf271627c8809',
  BESTELLUNG: '69d7bba5d50955bf72d78846',
  GERICHTE: '69d7bb9fa70dfa4924d3481e',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'gerichte': {
    gericht_kategorie: [{ key: "hauptgericht", label: "Hauptgericht" }, { key: "dessert", label: "Dessert" }, { key: "getraenk", label: "Getränk" }, { key: "beilage", label: "Beilage" }, { key: "sonstiges", label: "Sonstiges" }, { key: "vorspeise", label: "Vorspeise" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'bestellrunde': {
    'runde_name': 'string/text',
    'restaurant_name': 'string/text',
    'restaurant_url': 'string/url',
    'bestelldatum': 'date/datetimeminute',
    'deadline': 'date/datetimeminute',
    'notiz': 'string/textarea',
  },
  'bestellung': {
    'bestellrunde_auswahl': 'applookup/select',
    'teilnehmer_vorname': 'string/text',
    'teilnehmer_nachname': 'string/text',
    'gerichte_auswahl': 'applookup/select',
    'sonderwunsch': 'string/textarea',
  },
  'gerichte': {
    'gericht_name': 'string/text',
    'gericht_beschreibung': 'string/textarea',
    'gericht_preis': 'number',
    'gericht_kategorie': 'lookup/select',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateBestellrunde = StripLookup<Bestellrunde['fields']>;
export type CreateBestellung = StripLookup<Bestellung['fields']>;
export type CreateGerichte = StripLookup<Gerichte['fields']>;