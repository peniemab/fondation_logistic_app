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
  "KINGAKATI": {
    "15x20": { total: 1000, acompte: 100, mensualite: 40 },
    "20x20": { total: 1500, acompte: 200, mensualite: 65 }
  }
};