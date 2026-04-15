'use client'

import React from 'react'

type FormFicheAdresse = {
  id: string | null
  num_fiche: string
  noms: string
  genre: string
  date_souscription: string
  num_piece_id: string
  employeur: string
  matricule: string
  fonction: string
  avenue_num: string
  quartier: string
  commune: string
  telephone: string
  telephone_2: string
  email: string
  num_parcelle: string
  num_cadastral: string
  num_acte_vente: string
  site: string
  dimension: string
  nombre_parcelles: number
  categorie: 'MILITAIRE' | 'CIVIL'
}

interface StepAdresseFoncierProps {
  fiche: FormFicheAdresse;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  setFiche: React.Dispatch<React.SetStateAction<FormFicheAdresse>>;
  onNext: () => void;
  onPrev: () => void;
}

export default function StepAdresseFoncier({
  fiche,
  handleChange,
  setFiche,
  onNext,
  onPrev
}: StepAdresseFoncierProps) {

  // Validation: Telephone 1 must not be empty or just '+243'
  const isPhoneValid = fiche.telephone && fiche.telephone.length > 4 && fiche.telephone !== '+243';

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

        <section className="space-y-4">
          <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">II. Adresse & Contact</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Avenue et Numéro</label>
              <input name="avenue_num" value={fiche.avenue_num} placeholder="Ex: Av. Kasa-vubu N° 45..." onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Quartier</label>
                <input name="quartier" value={fiche.quartier} placeholder="Ex: Salongo" onChange={handleChange} className="w-full border-b border-slate-200 uppercase py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Commune</label>
                <input name="commune" value={fiche.commune} placeholder="Ex: Lemba" onChange={handleChange} className="w-full border-b uppercase border-slate-200 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Téléphone 1 (Obligatoire)</label>
                <input
                  name="telephone"
                  value={fiche.telephone}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val.startsWith('+243')) {
                      setFiche({ ...fiche, telephone: '+243' });
                    } else {
                      handleChange(e);
                    }
                  }}
                  className="w-full border-b border-slate-200 py-2 text-sm outline-none focus:border-blue-900 font-bold"
                />
              </div>

              <div className="relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Téléphone 2 (Optionnel)</label>
                <input
                  name="telephone_2"
                  value={fiche.telephone_2}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val.startsWith('+243')) {
                      setFiche({ ...fiche, telephone_2: '+243' });
                    } else {
                      handleChange(e);
                    }
                  }}
                  className="w-full border-b border-slate-200 py-2 text-sm outline-none focus:border-blue-900 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Adresse Email</label>
              <input
                name="email"
                value={fiche.email}
                placeholder="Ex: exemple@mail.com"
                onChange={handleChange}
                className="w-full border-b border-slate-200 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">III. Détails Fonciers</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Numéro de Parcelle</label>
              <input name="num_parcelle" value={fiche.num_parcelle} placeholder="Ex: P-450" onChange={handleChange} className="w-full border-b border-blue-300 py-2 font-black text-sm text-blue-700 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Numéro Cadastral</label>
              <input name="num_cadastral" value={fiche.num_cadastral} placeholder="Saisissez le N° cadastral..." onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Acte de Vente</label>
              <input name="num_acte_vente" value={fiche.num_acte_vente} placeholder="N° de l'acte de vente..." onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-slate-100 flex justify-between print:hidden">
        <button
          onClick={onPrev}
          className="bg-blue-300 text-white px-8 py-3 rounded-lg font-black uppercase tracking-wider hover:bg-slate-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          Retour
        </button>
        <button
          onClick={onNext}
          disabled={!isPhoneValid}
          title={!isPhoneValid ? "Veuillez entrer un numéro de téléphone valide" : ""}
          className="bg-blue-900 text-white px-8 py-3 rounded-lg font-black uppercase tracking-wider hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          Suivant
        </button>
      </div>

    </>
  )
}
