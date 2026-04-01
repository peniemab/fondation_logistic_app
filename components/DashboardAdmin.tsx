  'use client'

  import React, { useState, useEffect } from 'react'
  import { supabase } from '@/lib/supabase'
import autoTable from 'jspdf-autotable';

  interface BilanSouscripteur {
    id: string;
    num_fiche: string;
    noms: string;
    categorie: string;
    site: string;
    telephone: string; 
    telephone_2: string; 
    nombre_parcelles?: number;
    dimension?: string;
    quotite_mensuelle: number; 
    date_souscription: string;
    acompte_initial: number;
    prix_total: number;
    total_verse: number;
    derniere_date_paiement?: string;
    dernier_paiement?: string | null; 
  }

  export default function DashboardAdmin() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const [rechercheSuggestive, setRechercheSuggestive] = useState('');
const [suggestions, setSuggestions] = useState<BilanSouscripteur[]>([]);

    const [filtreDimension, setFiltreDimension] = useState<'TOUS' | '15x20' | '20x20'>('TOUS');
    const [showExportModal, setShowExportModal] = useState(false);
    const [colonnesExport, setColonnesExport] = useState({
      num_fiche: true, noms: true, telephone: true, telephone_2: true, dimension: true, 
      total_verse: true, dette: true, retard: true, mois_impayes: true
    });
    
    const [liste, setListe] = useState<BilanSouscripteur[]>([]);
    const [filtreMois, setFiltreMois] = useState<number | null>(null);
    const [filtreCategorie, setFiltreCategorie] = useState<'TOUS' | 'MILITAIRE' | 'CIVIL'>('TOUS');
    
    const [dateDebut, setDateDebut] = useState('');
    const [dateFin, setDateFin] = useState('');
    const [pageActuelle, setPageActuelle] = useState(1);
    const parPage = 100;

    const handleAdminLogin = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });
      if (error || data.user?.email !== "coordon@fes.com") {
        alert("Accès refusé.");
      } else {
        setIsAdmin(true);
        chargerDonnees();
      }
      setLoading(false);
    };

    const chargerDonnees = async () => {
  setLoading(true);
  let toutesLesDonnees: any[] = [];
  let errorOccured = false;
  let hasMore = true;
  let page = 0;
  const taillePaquet = 1000; // La limite autorisée par Supabase

  try {
    while (hasMore) {
      const { data, error } = await supabase
        .from('souscripteurs')
        .select(`
          *,
          paiements (
            montant,
            date_paiement
          )
        `)
        .order('num_fiche', { ascending: true })
        .range(page * taillePaquet, (page + 1) * taillePaquet - 1); // Ex: 0-999, puis 1000-1999

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        toutesLesDonnees = [...toutesLesDonnees, ...data];
        // Si on a reçu moins que la taille demandée, c'est qu'on a fini
        if (data.length < taillePaquet) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    // Traitement du bilan (ton code de calcul habituel)
    const bilanComplet = toutesLesDonnees.map((s: any) => {
      const sesPaiements = s.paiements || [];
      const totalPaiements = sesPaiements.reduce((acc: number, curr: any) => acc + (Number(curr.montant) || 0), 0);
      
      const dateDernier = sesPaiements.length > 0 
        ? [...sesPaiements].sort((a: any, b: any) => 
            new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime()
          )[0].date_paiement 
        : null;

      return {
        ...s,
        total_verse: totalPaiements + (Number(s.acompte_initial) || 0),
        dernier_paiement: dateDernier, 
        derniere_date_paiement: dateDernier ? new Date(dateDernier).toLocaleDateString('fr-FR') : 'Aucun'
      };
    });

    setListe(bilanComplet);

  } catch (err: any) {
    alert("Erreur de chargement : " + err.message);
  } finally {
    setLoading(false);
  }
};

    const calculerRetard = (s: BilanSouscripteur) => {
      const moisNoms = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
      const debut = new Date(s.date_souscription);
      const aujourdhui = new Date();
      const jourSouscription = debut.getDate();

      let moisEcoules = (aujourdhui.getFullYear() - debut.getFullYear()) * 12 + (aujourdhui.getMonth() - debut.getMonth());
      if (aujourdhui.getDate() < jourSouscription) moisEcoules--;
      moisEcoules = Math.max(0, moisEcoules);

      const montantPourMensualites = Math.max(0, s.total_verse - (s.acompte_initial || 0));
      const nbMoisCouverts = s.quotite_mensuelle > 0 ? Math.floor(montantPourMensualites / s.quotite_mensuelle) : 0;
      
      const dateCouverture = new Date(debut);
      dateCouverture.setMonth(debut.getMonth() + nbMoisCouverts);

      const moisDeRetardNb = Math.max(0, moisEcoules - nbMoisCouverts);
      let moisEnRetardListe: string[] = [];
      
      if (moisDeRetardNb > 0) {
        for (let i = 1; i <= moisDeRetardNb; i++) {
          const d = new Date(dateCouverture);
          d.setMonth(dateCouverture.getMonth() + i);
          moisEnRetardListe.push(`${moisNoms[d.getMonth()]} ${d.getFullYear()}`);
        }
      }

      return { 
        moisDeRetard: moisDeRetardNb, 
        detteArgent: Math.max(0, (moisEcoules * s.quotite_mensuelle) + (s.acompte_initial || 0) - s.total_verse), 
        moisEnRetardTexte: moisEnRetardListe.join(", "),
        couvertJusquau: dateCouverture.toLocaleDateString()
      };
    };

    const listeFiltrée = liste.filter(s => {
      const { moisDeRetard } = calculerRetard(s);

      const matchRecherche = rechercheSuggestive === '' ? true : 
    s.noms.toLowerCase().includes(rechercheSuggestive.toLowerCase()) || 
    s.num_fiche.toString().includes(rechercheSuggestive);

      const matchCat = filtreCategorie === 'TOUS' ? true : s.categorie === filtreCategorie;
      const matchMois = filtreMois === null ? true : (filtreMois === 3 ? moisDeRetard >= 3 : moisDeRetard === filtreMois);
      
      const matchDim = filtreDimension === 'TOUS' ? true : s.dimension === filtreDimension;

      const sDate = new Date(s.date_souscription).getTime();
      const dDeb = dateDebut ? new Date(dateDebut).getTime() : null;
      const dFin = dateFin ? new Date(dateFin).getTime() : null;
      const matchDate = (!dDeb || sDate >= dDeb) && (!dFin || sDate <= dFin);
      return matchRecherche && matchCat && matchMois && matchDate && matchDim;
    });

    const totalPages = Math.ceil(listeFiltrée.length / parPage);
    const debutIndex = (pageActuelle - 1) * parPage;
    const finIndex = debutIndex + parPage;
    const donneesAffichees = listeFiltrée.slice(debutIndex, finIndex);

    const exportToPDF = async () => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const centreX = pageWidth / 2;

  const mapColonnes: { [key: string]: string } = {
    num_fiche: "FICHE",
    noms: "NOM COMPLET",
    telephone: "TÉLÉPHONE",
    telephone_2: "TÉLÉPHONE 2",
    dimension: "DIM.",
    total_verse: "TOTAL VERSÉ ($)",
    dette: "DETTE ($)",
    retard: "RETARD",
    mois_impayes: "MOIS IMPAYÉS"
  };

  const colonnesActives = Object.keys(colonnesExport).filter(
    (key) => (colonnesExport as any)[key] === true
  );

  const enTetes = colonnesActives.map(key => mapColonnes[key]);

  const corpsTableau = listeFiltrée.map(s => {
    const { moisDeRetard, detteArgent, moisEnRetardTexte } = calculerRetard(s);
    
    return colonnesActives.map(key => {
      switch (key) {
        case 'num_fiche': return s.num_fiche;
        case 'noms': return s.noms.toUpperCase();
        case 'telephone': return s.telephone;
        case 'telephone_2': return s.telephone_2 || '-';
        case 'dimension': return s.dimension || 'N/A';
        case 'total_verse': return s.total_verse.toFixed(2);
        case 'dette': return detteArgent.toFixed(2);
        case 'retard': return moisDeRetard > 0 ? `${moisDeRetard} Mois` : 'À JOUR';
        case 'mois_impayes': return moisEnRetardTexte || '-';
        default: return '';
      }
    });
  });

  doc.setFontSize(18);
  doc.setTextColor(20, 40, 80);
  doc.setFont("helvetica", "bold");
  doc.text("FES / MBA - RECOUVREMENT", centreX, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, centreX, 22, { align: 'center' });

autoTable(doc, {
    startY: 30,
    head: [enTetes],
    body: corpsTableau,
    theme: 'striped',
    margin: { top: 30, left: 14, right: 14 },
    
    tableWidth: 'auto', 

    headStyles: { 
      fillColor: [15, 23, 42], 
      fontSize: 8, 
      halign: 'center', 
      fontStyle: 'bold' 
    },
    bodyStyles: { 
      fontSize: 8, 
      valign: 'middle', 
      cellPadding: 4 
    },

    didParseCell: (data) => {
      if (data.section === 'body') {
        const colKey = colonnesActives[data.column.index];

        if (['noms', 'telephone', 'telephone_2', 'mois_impayes'].includes(colKey)) {
          data.cell.styles.halign = 'left';
        }

        if (['num_fiche', 'dimension', 'retard'].includes(colKey)) {
          data.cell.styles.halign = 'center';
        }

        if (['total_verse', 'dette'].includes(colKey)) {
          data.cell.styles.halign = 'right';
          if (colKey === 'dette') {
            data.cell.styles.textColor = [200, 0, 0];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },

    styles: { 
      overflow: 'linebreak',
      lineWidth: 0.1,
    },
    
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      const pWidth = doc.internal.pageSize.getWidth();
      const pHeight = doc.internal.pageSize.getHeight();
      doc.text(`Page ${data.pageNumber}`, pWidth - 25, pHeight - 10);
    }
  });
  doc.save(`FES_MBA_CUSTOM_${new Date().toISOString().split('T')[0]}.pdf`);
  setShowExportModal(false);
};

    if (!isAdmin) {
      return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border-t-8 border-blue-900">
            <h2 className="text-2xl font-black text-blue-900 mb-6 uppercase text-center">Admin SYGMA</h2>
            <input type="email" placeholder="Email" className="w-full p-4 bg-slate-100 rounded-xl mb-3 outline-none" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            <input type="password" placeholder="Pass" className="w-full p-4 bg-slate-100 rounded-xl mb-6 outline-none" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={handleAdminLogin} disabled={loading} className="w-full bg-blue-900 text-white p-4 rounded-xl font-black uppercase">
              {loading ? "Chargement..." : "Entrer"}
            </button>
          </div>
        </div>
      );
    }

    return (
    <div className="min-h-screen bg-slate-50 pb-40"> 
      
      <div className="max-w-[1250px] mx-auto p-4 pt-8">
        <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none">Gestion / Recouvrement</h1>
      
      </div>
      <div className="max-w-[1250px] mx-auto px-4 mb-6">
  <div className="relative group">
    
    <input
      type="text"
      placeholder="Rechercher un nom "
      className="w-full pl-14 pr-6 py-5 bg-white border-none rounded-[2rem] shadow-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-900/10 transition-all placeholder:text-slate-300 uppercase italic"
      value={rechercheSuggestive}
      onChange={(e) => {
        setRechercheSuggestive(e.target.value);
        setPageActuelle(1); 
      }}
    />
    {rechercheSuggestive && (
      <button 
        onClick={() => setRechercheSuggestive('')}
        className="absolute inset-y-0 right-0 pr-6 flex items-center text-slate-300 hover:text-red-500"
      >
        <span className="text-[10px] font-black uppercase tracking-tighter">Effacer</span>
      </button>
    )}
  </div>
</div>

      <div className="max-w-[1250px] mx-auto p-4 animate-in fade-in duration-700">
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 mb-20">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">SOUSCRIPTEUR</th>
                <th className="p-5 text-[10px] font-black uppercase text-center border-x border-slate-800/10">Dernier Versement</th>
                <th className="p-5 text-[10px] font-black uppercase text-center">COUVERTURE</th>
                <th className="p-5 text-[10px] font-black uppercase text-right">TOTAL VERSÉ</th>
                <th className="p-5 text-[10px] font-black uppercase text-right">DETTE MENSUELLE</th>
                <th className="p-5 text-[10px] font-black uppercase text-center">ÉTAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {donneesAffichees.map((s, index) => {
    const { moisDeRetard, detteArgent, moisEnRetardTexte, couvertJusquau } = calculerRetard(s);
    return (
      <tr key={s.id} className="hover:bg-slate-50 transition-all border-b border-slate-50">
        <td className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-[10px] font-black text-slate-300 mt-1">#{debutIndex + index + 1}</span>
            <div>
              <div className="font-black text-slate-800 uppercase text-sm leading-tight">{s.noms}</div>
              <div className="text-[10px] font-bold text-blue-600 uppercase mt-1">
                Fiche {s.num_fiche} — {s.telephone} { s.telephone_2 && ` / ${s.telephone_2}` }
              </div>
              <div className="flex gap-2 mt-1">
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                  {s.nombre_parcelles || 1} Parc.
                </span>
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                  Dim: {s.dimension || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </td>
        <td className="p-4 text-center border-x border-slate-50">
    {s.dernier_paiement ? (
      <div className="flex flex-col items-center">
        <div className="text-[11px] font-black text-slate-700 uppercase">
          {new Date(s.dernier_paiement).toLocaleDateString('fr-FR')}
        </div>
        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full mt-1 ${
          (new Date().getTime() - new Date(s.dernier_paiement).getTime()) / (1000 * 3600 * 24) > 30 
          ? 'bg-red-50 text-red-500' 
          : 'bg-green-50 text-green-600'
        }`}>
          {(new Date().getTime() - new Date(s.dernier_paiement).getTime()) / (1000 * 3600 * 24) > 30 
            ? 'Inactif > 30j' 
            : 'Actif'}
        </span>
      </div>
    ) : (
      <span className="text-[9px] font-black text-slate-300 uppercase italic">Aucun historique</span>
    )}
  </td>
        <td className="p-4 text-center">
          <div className="text-[9px] font-black text-slate-400 uppercase">Couvert jusqu'au</div>
          <div className={`text-xs font-black ${moisDeRetard > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {couvertJusquau}
          </div>
          <div className="text-[8px] text-slate-400 font-medium italic">Souscrit le {new Date(s.date_souscription).toLocaleDateString()}</div>
        </td>
        <td className="p-4 text-right">
    <div className="flex flex-col items-end">
      <div className="text-[11px] font-black text-slate-700">
        {s.total_verse.toFixed(2)}$ <span className="text-slate-300 mx-0.5">/</span> {s.prix_total.toFixed(2)}$
      </div>
      <div className="text-[9px] text-blue-600 font-bold uppercase tracking-tighter">
        {((s.total_verse / s.prix_total) * 100).toFixed(0)}% du contrat
      </div>
      <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
        <div 
          className="h-full bg-green-500 rounded-full" 
          style={{ width: `${Math.min(100, (s.total_verse / s.prix_total) * 100)}%` }}
        />
      </div>
    </div>
  </td>
        <td className="p-4 text-right">
          <div className="text-sm font-black text-red-600">-{detteArgent.toFixed(2)} $</div>
          <div className="text-[9px] text-red-400 font-bold uppercase italic">à payer</div>
        </td>
        <td className="p-4 text-center">
          <div className={`inline-block px-3 py-1 rounded-full text-[9px] font-black ${
            moisDeRetard === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {moisDeRetard === 0 ? 'À JOUR' : `${moisDeRetard} MOIS DUS`}
          </div>
          {moisDeRetard > 0 && (
            <div className="text-[8px] font-black text-red-400 mt-1 uppercase tracking-tighter">
              {moisEnRetardTexte}
            </div>
          )}
        </td>
      </tr>
    )
  })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-4 z-50">
        <div className="max-w-[1250px] mx-auto flex flex-col gap-4">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl">
                <span className="text-[9px] font-black text-slate-500 uppercase px-2">Période</span>
                <input type="date" className="bg-transparent text-[10px] font-bold outline-none" value={dateDebut} onChange={(e) => {setDateDebut(e.target.value); setPageActuelle(1)}} />
                <span className="text-slate-400 text-[9px]">au</span>
                <input type="date" className="bg-transparent text-[10px] font-bold outline-none" value={dateFin} onChange={(e) => {setDateFin(e.target.value); setPageActuelle(1)}} />
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl">
                {['TOUS', 'MILITAIRE', 'CIVIL'].map((c) => (
                  <button key={c} onClick={() => {setFiltreCategorie(c as any); setPageActuelle(1)}} className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${filtreCategorie === c ? 'bg-blue-900 text-white shadow-md' : 'text-slate-400'}`}>{c}</button>
                ))}
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
    {['TOUS', '15x20', '20x20'].map((d) => (
      <button 
        key={d} 
        onClick={() => {setFiltreDimension(d as any); setPageActuelle(1)}} 
        className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${filtreDimension === d ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
      >
        {d}
      </button>
    ))}
  </div>

              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button onClick={() => {setFiltreMois(null); setPageActuelle(1)}} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${filtreMois === null ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>TOUS</button>
                <button onClick={() => {setFiltreMois(1); setPageActuelle(1)}} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${filtreMois === 1 ? 'bg-orange-400 text-white' : 'text-slate-400'}`}>1M</button>
                <button onClick={() => {setFiltreMois(2); setPageActuelle(1)}} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${filtreMois === 2 ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>2M</button>
                <button onClick={() => {setFiltreMois(3); setPageActuelle(1)}} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${filtreMois === 3 ? 'bg-red-600 text-white' : 'text-slate-400'}`}>3M+</button>
              </div>
            </div>

            <button onClick={() => setShowExportModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-green-700 transition-all flex items-center gap-2">
              Exporter {listeFiltrée.length} dossiers
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
              Affichage <span className="text-blue-600">{debutIndex + 1} - {Math.min(finIndex, listeFiltrée.length)}</span> sur {listeFiltrée.length}
            </span>
            
            <div className="flex gap-2">
              <button 
                disabled={pageActuelle === 1}
                onClick={() => {setPageActuelle(p => p - 1); window.scrollTo(0,0)}}
                className="px-4 py-2 bg-slate-100 rounded-lg text-[9px] font-black disabled:opacity-30 uppercase"
              >
                Précédent
              </button>
              <div className="flex items-center px-4 bg-slate-900 text-white rounded-lg text-[10px] font-black">
                PAGE {pageActuelle} / {totalPages || 1}
              </div>
              <button 
                disabled={pageActuelle === totalPages || totalPages === 0}
                onClick={() => {setPageActuelle(p => p + 1); window.scrollTo(0,0)}}
                className="px-4 py-2 bg-slate-100 rounded-lg text-[9px] font-black disabled:opacity-30 uppercase"
              >
                Suivant
              </button>
            </div>
          </div>

        </div>
      </div>
  {showExportModal && (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-white">
        <h3 className="text-xl font-black text-slate-800 uppercase italic mb-6">Personnaliser l'export</h3>
        
        <div className="grid grid-cols-2 gap-3 mb-8">
          {Object.keys(colonnesExport).map((key) => (
            <label key={key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors">
              <input 
                type="checkbox" 
                checked={(colonnesExport as any)[key]} 
                onChange={() => setColonnesExport(prev => ({ ...prev, [key]: !(prev as any)[key] }))}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-[10px] font-black text-slate-600 uppercase italic">{key.replace('_', ' ')}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setShowExportModal(false)} className="flex-1 p-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Annuler</button>
         {/* Remplace l'ancien bouton par celui-ci */}
<button 
  onClick={exportToPDF} 
  className="flex-1 p-4 bg-blue-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-blue-900/20"
>
  Télécharger
</button>
        </div>
      </div>
    </div>
  )}
    </div>
  );
  }