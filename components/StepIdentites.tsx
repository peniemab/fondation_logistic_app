'use client'

import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { TARIFS_OFFICIELS } from '@/lib/tarifs'

interface StepIdentitesProps {
  fiche: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  recherche: string;
  setRecherche: (val: string) => void;
  executerRecherche: () => Promise<void>;
  type: 'MILITAIRE' | 'CIVIL';
  onNext: () => void;
  dimensionsDisponibles: string[];
  modalites: { total: number; acompte: number; mensualite: number };
}

export default function StepIdentites({
  fiche,
  handleChange,
  recherche,
  setRecherche,
  executerRecherche,
  type,
  onNext,
  dimensionsDisponibles,
  modalites
}: StepIdentitesProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <section className="space-y-4">
          <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">I. Références Identitaires</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nom Complet (Obligatoire)</label>
              <input name="noms" value={fiche.noms} placeholder="Saisissez ici le NOM COMPLET du souscripteur..." onChange={handleChange} className="w-full border-b border-slate-300 py-2 uppercase outline-none focus:border-blue-900" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-blue-900 font-black text-xs uppercase">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Genre</label>
                <select name="genre" value={fiche.genre} onChange={handleChange} className="w-full border-b border-slate-300 py-2 outline-none focus:border-blue-900 font-medium bg-transparent">
                  <option value="M">HOMME (M)</option>
                  <option value="F">FEMME (F)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Date de Souscription</label>
                <input type="date" name="date_souscription" value={fiche.date_souscription} onChange={handleChange} className="w-full border-b border-slate-300 py-2 outline-none focus:border-blue-900 bg-transparent" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Lieu d'affectation ou Employeur</label>
                <input name="employeur" value={fiche.employeur} placeholder="Où travaille le souscripteur ?..." onChange={handleChange} required className="w-full uppercase border-b border-slate-200 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Matricule / Carte de service</label>
                <input name="matricule" value={fiche.matricule} placeholder="Saisissez le N° Matricule ici..." onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Pièce d'identité</label>
                <input name="num_piece_id" value={fiche.num_piece_id} placeholder="N° Pièce d'ID / Passeport / Électeur..." onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none font-medium" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Grade / Fonction</label>
                <input name="fonction" value={fiche.fonction} placeholder="Indiquez la fonction ou le grade..." onChange={handleChange} className="w-full border-b uppercase border-slate-200 py-2 text-sm outline-none" />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">Site & Dimensions</h2>

          <div className="flex items-center px-4 py-2 gap-2 mb-2 bg-slate-50 rounded border border-slate-200">
            <label className="font-medium uppercase text-[10px] text-gray-500 outline-none w-full">Parcelles souhaitées :</label>
            <input
              type="number"
              name="nombre_parcelles"
              min="1"
              value={fiche.nombre_parcelles}
              onChange={handleChange}
              className="border-b-2 border-blue-300 bg-transparent w-16 font-black text-center text-blue-900 outline-none"
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Choix du Site</label>
              <select name="site" value={fiche.site} onChange={handleChange} className="w-full border-b-2 border-blue-200 py-2 font-bold text-blue-900 outline-none bg-white print:hidden">
                <option value="">-- SÉLECTIONNEZ LE SITE --</option>
                {Object.keys(TARIFS_OFFICIELS).map(siteName => (
                  <option key={siteName} value={siteName}>{siteName}</option>
                ))}
              </select>
            </div>

            {fiche.site && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Dimensions</label>
                <select name="dimension" value={fiche.dimension} onChange={handleChange} className="w-full border-b-2 border-green-200 py-2 font-bold text-green-900 outline-none bg-white print:hidden">
                  {dimensionsDisponibles.map(dim => (
                    <option key={dim} value={dim}>{dim} (m²)</option>
                  ))}
                </select>
              </div>
            )}

            {fiche.site && (
              <div className="flex justify-between items-center bg-blue-50 p-3 border border-blue-100 rounded-lg shadow-inner mt-4 print:border-slate-900 print:border-2">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-black text-blue-400">Total</span>
                  <span className="font-bold text-sm text-blue-900">{modalites.total}$</span>
                </div>
                <div className="flex flex-col border-x px-6 border-blue-200">
                  <span className="text-[10px] uppercase font-black text-blue-400">Acompte</span>
                  <span className="font-bold text-sm text-blue-900">{modalites.acompte}$</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-black text-blue-400">Mensuel</span>
                  <span className="font-bold text-sm text-blue-900">{modalites.mensualite}$</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-8 flex justify-end print:hidden">
        <button
          onClick={onNext}
          disabled={!fiche.noms}
          title={!fiche.noms ? "Veuillez remplir le nom complet pour continuer" : ""}
          className="bg-blue-900 text-white px-8 py-3 rounded-lg font-black uppercase tracking-wider hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          Suivant
        </button>
      </div>
    </>
  )
}
