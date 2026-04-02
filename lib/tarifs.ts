export interface TarifDetails {
  total: number;
  acompte: number;
  mensualite: number;
}

export interface TarifStructure {
  [site: string]: {
    [dimension: string]: TarifDetails;
  };
}

export const TARIFS_OFFICIELS: TarifStructure = {
  "NDJILI BRASSERIE": {
    "15x20": { total: 800, acompte: 80, mensualite: 32 },
    "20x20": { total: 2500, acompte: 150, mensualite: 100 }
  },
  "EL-SHADDAI 1 / RVA": {
    "15x20": { total: 3300, acompte: 330, mensualite: 132 },
  },
  "EL-SHADDAI 1 / STANDARD": {
    "15x20": { total: 3300, acompte: 550, mensualite: 150 },
  }
};