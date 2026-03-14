'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx' 

interface BilanSouscripteur {
  id: string;
  num_fiche: string;
  noms: string;
  categorie: string;
  site: string;
  telephone: string; 
  telephone_2: string; 
  quotite_mensuelle: number; 
  date_souscription: string;
  acompte_initial: number;
  prix_total: number;
  total_verse: number;
}

export default function DashboardAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [liste, setListe] = useState<BilanSouscripteur[]>([]);
  const [filtreMois, setFiltreMois] = useState<number | null>(null);
  const [filtreCategorie, setFiltreCategorie] = useState<'TOUS' | 'MILITAIRE' | 'CIVIL'>('TOUS');

  const handleAdminLogin = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    const EMAIL_AUTORISE = "coordon@fes.com"; 

    if (error || data.user?.email !== EMAIL_AUTORISE) {
      alert("Accès refusé. Identifiants incorrects.");
    } else {
      setIsAdmin(true);
      chargerDonnees();
    }
    setLoading(false);
  };

  const chargerDonnees = async () => {
    setLoading(true);
    const { data: souscripteurs } = await supabase.from('souscripteurs').select('*');
    const { data: paiements } = await supabase.from('paiements').select('num_fiche, montant');

    if (souscripteurs) {
      const bilanComplet = souscripteurs.map(s => {
        const totalPaiements = paiements
          ?.filter(p => p.num_fiche === s.num_fiche)
          .reduce((acc, curr) => acc + curr.montant, 0) || 0;
        
        return {
          ...s,
          total_verse: totalPaiements + (s.acompte_initial || 0)
        };
      });
      setListe(bilanComplet);
    }
    setLoading(false);
  };

  const calculerRetard = (s: BilanSouscripteur) => {
    const debut = new Date(s.date_souscription);
    const aujourdhui = new Date();
    const moisEcoules = (aujourdhui.getFullYear() - debut.getFullYear()) * 12 + (aujourdhui.getMonth() - debut.getMonth());
    const attenduTheorique = (s.acompte_initial || 0) + (Math.max(0, moisEcoules) * (s.quotite_mensuelle || 0));
    const detteArgent = attenduTheorique - s.total_verse;
    const moisDeRetard = s.quotite_mensuelle > 0 ? Math.max(0, Math.floor(detteArgent / s.quotite_mensuelle)) : 0;
    return { moisDeRetard, detteArgent };
  };

  const listeFiltrée = liste.filter(s => {
    const { moisDeRetard } = calculerRetard(s);
    const matchMois = filtreMois === null ? true : (filtreMois === 3 ? moisDeRetard >= 3 : moisDeRetard === filtreMois);
    const matchCat = filtreCategorie === 'TOUS' ? true : s.categorie === filtreCategorie;
    return matchMois && matchCat;
  });

  const exportToExcel = () => {
    const dataToExport = listeFiltrée.map(s => {
      const { moisDeRetard, detteArgent } = calculerRetard(s);
      return {
        "Fiche N°": s.num_fiche,
        "Nom Complet": s.noms,
        "Téléphone": s.telephone,
        "Telephone 2": s.telephone_2,
        "Catégorie": s.categorie,
        "Site": s.site,
        "Mensualité": s.quotite_mensuelle + " $",
        "Total Versé": s.total_verse + " $",
        "Dette ($)": detteArgent.toFixed(2) + " $",
        "Mois de Retard": moisDeRetard
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recouvrement");
    
    const fileName = `Export_${filtreCategorie}_Retard_${filtreMois ?? 'Global'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border-t-8 border-blue-900">
          <h2 className="text-2xl font-black text-blue-900 mb-6 uppercase text-center">Accès Administrateur</h2>
          <input type="email" placeholder="Email Coordon" className="w-full p-4 bg-slate-100 rounded-xl mb-3 outline-none focus:ring-2 ring-blue-500 font-bold" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          <input type="password" placeholder="Mot de passe" className="w-full p-4 bg-slate-100 rounded-xl mb-6 outline-none focus:ring-2 ring-blue-500 font-bold" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
          <button onClick={handleAdminLogin} disabled={loading} className="w-full bg-blue-900 text-white p-4 rounded-xl font-black uppercase hover:bg-black transition-all">
            {loading ? "Vérification..." : "Se Connecter"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-4 animate-in fade-in duration-700">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none">Dashboard Admin / Recouvrement</h1>
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest mt-1">Fondation El-Shaddaï / MBA</p>
        </div>

        <div className="flex gap-2">
            <button onClick={exportToExcel} className="bg-green-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-green-200 hover:bg-green-700 transition-all flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H5a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exporter 
            </button>
        </div>
      </div>

      {/* FILTRES PAR CATÉGORIE */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200 w-fit mb-6">
          {['TOUS', 'MILITAIRE', 'CIVIL'].map((c) => (
            <button key={c} onClick={() => setFiltreCategorie(c as any)} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${filtreCategorie === c ? 'bg-blue-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{c}</button>
          ))}
      </div>

      {/* CARTES DE STATUT (Filtres Mois) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <button onClick={() => setFiltreMois(null)} className={`p-5 rounded-3xl border-2 transition-all text-left ${filtreMois === null ? 'border-blue-900 bg-blue-900 text-white' : 'border-white bg-white text-slate-600 shadow-sm'}`}>
          <div className="text-2xl font-black">{liste.filter(s => (filtreCategorie === 'TOUS' ? true : s.categorie === filtreCategorie)).length}</div>
          <div className="text-[10px] uppercase font-bold opacity-60 italic">SOUSCRIPTEURS</div>
        </button>
        {/* ... Boutons 1, 2, 3 mois identiques à ton code précédent mais avec filtreCategorie intégré ... */}
        <button onClick={() => setFiltreMois(1)} className={`p-5 rounded-3xl border-2 transition-all text-left ${filtreMois === 1 ? 'border-orange-500 bg-orange-500 text-white' : 'border-white bg-white text-orange-600 shadow-sm'}`}>
          <div className="text-2xl font-black">1 MOIS</div>
          <div className="text-[10px] uppercase font-bold opacity-60">Relance</div>
        </button>
        <button onClick={() => setFiltreMois(2)} className={`p-5 rounded-3xl border-2 transition-all text-left ${filtreMois === 2 ? 'border-red-500 bg-red-500 text-white' : 'border-white bg-white text-red-600 shadow-sm'}`}>
          <div className="text-2xl font-black">2 MOIS</div>
          <div className="text-[10px] uppercase font-bold opacity-60">Critique</div>
        </button>
        <button onClick={() => setFiltreMois(3)} className={`p-5 rounded-3xl border-2 transition-all text-left ${filtreMois === 3 ? 'border-black bg-black text-white' : 'border-white bg-white text-black shadow-sm'}`}>
          <div className="text-2xl font-black">3 MOIS+</div>
          <div className="text-[10px] uppercase font-bold opacity-60">Contentieux</div>
        </button>
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-5 text-[10px] font-black uppercase tracking-widest">NOMS / Contacts</th>
              <th className="p-5 text-[10px] font-black uppercase text-center">Catégorie</th>
              <th className="p-5 text-[10px] font-black uppercase text-right">Mensualité</th>
              <th className="p-5 text-[10px] font-black uppercase text-right">Payé</th>
              <th className="p-5 text-[10px] font-black uppercase text-right">Dette ($)</th>
              <th className="p-5 text-[10px] font-black uppercase text-center">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listeFiltrée.map(s => {
              const { moisDeRetard, detteArgent } = calculerRetard(s);
              return (
                <tr key={s.id} className="hover:bg-slate-50 transition-all">
                  <td className="p-5">
                    <div className="font-black text-slate-800 uppercase">{s.noms}</div>
                    <div className="text-[10px] font-bold text-blue-600">N° {s.num_fiche} — Tel: {s.telephone || 'N/A'} — Tel_2: {s.telephone_2 || 'N/A'} </div>
                  </td>
                  <td className="p-5 text-center"><span className="text-[10px] font-black px-2 py-1 bg-slate-100 rounded text-slate-500">{s.categorie}</span></td>
                  <td className="p-5 text-right font-bold text-slate-700">{s.quotite_mensuelle} $</td>
                  <td className="p-5 text-right font-bold text-green-600">{s.total_verse.toFixed(2)} $</td>
                  <td className="p-5 text-right font-black text-red-600">-{detteArgent.toFixed(2)} $</td>
                  <td className="p-5 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black ${
                      moisDeRetard === 0 ? 'bg-green-100 text-green-700' :
                      moisDeRetard >= 3 ? 'bg-black text-white' : 
                      moisDeRetard === 2 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {moisDeRetard === 0 ? 'À JOUR' : `${moisDeRetard} MOIS`}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}