  'use client'

  import React, { useState, useEffect, useMemo } from 'react'
  import { supabase } from '@/lib/supabase'
import autoTable from 'jspdf-autotable';
import { TARIFS_OFFICIELS } from '@/lib/tarifs';
import { Eye, Printer, X } from 'lucide-react';

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
    paiements?: { montant: number; date_paiement: string }[];
  }

  interface DetailSouscripteur {
    id: string;
    num_fiche: string;
    noms: string;
    categorie: string;
    site: string;
    telephone: string;
    telephone_2?: string;
    email?: string;
    dimension?: string;
    num_parcelle?: string;
    num_cadastral?: string;
    num_acte_vente?: string;
    date_souscription: string;
    quotite_mensuelle: number;
    acompte_initial: number;
    prix_total: number;
    paiements: { montant: number; date_paiement: string }[];
    total_verse: number;
    dernier_versement_date: string | null;
    dernier_versement_montant: number | null;
    couverture: string;
    retard_mois: number;
    dette_mensuelle: number;
    etat: 'À JOUR' | 'EN RETARD';
  }

  export default function DashboardAdmin() {
    const [loading, setLoading] = useState(false);

    const [rechercheSuggestive, setRechercheSuggestive] = useState('');
const [suggestions, setSuggestions] = useState<BilanSouscripteur[]>([]);

    const [filtreDimension, setFiltreDimension] = useState<'TOUS' | '15x20' | '20x20'>('TOUS');
    const [showExportModal, setShowExportModal] = useState(false);
    const [colonnesExport, setColonnesExport] = useState({
      num_fiche: true, noms: true, telephone: true, telephone_2: true, dimension: true, 
      total_verse: true, dette: true, retard: true, mois_impayes: true
    });
    

const [filtreSite, setFiltreSite] = useState<string>('TOUS');
    const [liste, setListe] = useState<BilanSouscripteur[]>([]);
    const [filtreMois, setFiltreMois] = useState<number | null>(null);
    const [filtreCategorie, setFiltreCategorie] = useState<'TOUS' | 'MILITAIRE' | 'CIVIL'>('TOUS');
    
    const [dateDebut, setDateDebut] = useState('');
    const [dateFin, setDateFin] = useState('');
    const [pageActuelle, setPageActuelle] = useState(1);
    const [detailOuvert, setDetailOuvert] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailSelectionne, setDetailSelectionne] = useState<DetailSouscripteur | null>(null);
    const parPage = 100;

    const chargerDonnees = async () => {
  setLoading(true);
  let toutesLesDonnees: any[] = [];
  let hasMore = true;
  let page = 0;
  const taillePaquet = 1000; 

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
        .range(page * taillePaquet, (page + 1) * taillePaquet - 1); 

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        toutesLesDonnees = [...toutesLesDonnees, ...data];
        if (data.length < taillePaquet) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

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

    useEffect(() => {
      chargerDonnees();
    }, []);

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

      const matchSite = filtreSite === 'TOUS' ? true : s.site === filtreSite;
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
return matchRecherche && matchCat && matchMois && matchDate && matchDim && matchSite;    });


const financeStats = useMemo(() => {
  return listeFiltrée.reduce((acc, s) => {
    const totalContrat = Number(s.prix_total) || 0;
    const dejaPaye = Number(s.total_verse) || 0;

    return {
      valeurProjet: acc.valeurProjet + totalContrat,
      encaissementGlobal: acc.encaissementGlobal + dejaPaye,
      detteBrute: acc.detteBrute + (totalContrat - dejaPaye),
      nombreDossiers: acc.nombreDossiers + 1
    };
  }, { valeurProjet: 0, encaissementGlobal: 0, detteBrute: 0, nombreDossiers: 0 });
}, [listeFiltrée]);

const fluxMensuel = useMemo(() => {
  const moisNoms = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
  const stats = moisNoms.map(nom => ({ nom, total: 0 }));

  listeFiltrée.forEach(s => {
    const dateS = new Date(s.date_souscription);
    if (dateS.getFullYear() === 2026) { 
      stats[dateS.getMonth()].total += Number(s.acompte_initial) || 0;
    }

    (s.paiements || []).forEach((p: any) => {
      const dateP = new Date(p.date_paiement);
      if (dateP.getFullYear() === 2026) {
        stats[dateP.getMonth()].total += Number(p.montant) || 0;
      }
    });
  });
  return stats;
}, [listeFiltrée]);
    const totalPages = Math.ceil(listeFiltrée.length / parPage);
    const debutIndex = (pageActuelle - 1) * parPage;
    const finIndex = debutIndex + parPage;
    const donneesAffichees = listeFiltrée.slice(debutIndex, finIndex);

    const formatMontant = (value: number) => `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}$`;

    const formatDate = (value?: string | null) => {
      if (!value) return 'Non renseigné';
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR');
    };

    const fermerDetail = () => {
      setDetailOuvert(false);
      setDetailError(null);
    };

    const ouvrirDetailSouscripteur = async (id: string) => {
      setDetailOuvert(true);
      setDetailLoading(true);
      setDetailError(null);

      try {
        const { data, error } = await supabase
          .from('souscripteurs')
          .select(`
            id,
            num_fiche,
            noms,
            categorie,
            site,
            telephone,
            telephone_2,
            email,
            dimension,
            num_parcelle,
            num_cadastral,
            num_acte_vente,
            date_souscription,
            quotite_mensuelle,
            acompte_initial,
            prix_total,
            paiements (
              montant,
              date_paiement
            )
          `)
          .eq('id', id)
          .single();

        if (error || !data) {
          throw error || new Error('Souscripteur introuvable');
        }

        const paiements = (data.paiements || []).map((p: any) => ({
          montant: Number(p.montant) || 0,
          date_paiement: p.date_paiement,
        }));

        const paiementsTries = [...paiements].sort(
          (a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime()
        );

        const totalPaiements = paiements.reduce((acc, p) => acc + p.montant, 0);
        const totalVerse = totalPaiements + (Number(data.acompte_initial) || 0);
        const dernierPaiement = paiementsTries[0] || null;

        const bilanTemp: BilanSouscripteur = {
          ...(data as any),
          total_verse: totalVerse,
          paiements,
        };

        const { moisDeRetard, couvertJusquau } = calculerRetard(bilanTemp);

        setDetailSelectionne({
          id: data.id,
          num_fiche: String(data.num_fiche || ''),
          noms: data.noms || '-',
          categorie: data.categorie || '-',
          site: data.site || '-',
          telephone: data.telephone || '-',
          telephone_2: data.telephone_2 || '',
          email: data.email || '',
          dimension: data.dimension || '',
          num_parcelle: data.num_parcelle || '',
          num_cadastral: data.num_cadastral || '',
          num_acte_vente: data.num_acte_vente || '',
          date_souscription: data.date_souscription,
          quotite_mensuelle: Number(data.quotite_mensuelle) || 0,
          acompte_initial: Number(data.acompte_initial) || 0,
          prix_total: Number(data.prix_total) || 0,
          paiements,
          total_verse: totalVerse,
          dernier_versement_date: dernierPaiement?.date_paiement || null,
          dernier_versement_montant: dernierPaiement?.montant ?? null,
          couverture: couvertJusquau,
          retard_mois: moisDeRetard,
          dette_mensuelle: Number(data.quotite_mensuelle) || 0,
          etat: moisDeRetard > 0 ? 'EN RETARD' : 'À JOUR',
        });
      } catch (err: any) {
        setDetailSelectionne(null);
        setDetailError(err?.message || 'Erreur lors du chargement du détail');
      } finally {
        setDetailLoading(false);
      }
    };

    const imprimerFicheSouscripteur = () => {
      if (!detailSelectionne) return;

      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) return;

      const html = `
        <html>
          <head>
            <title>Fiche souscripteur - ${detailSelectionne.noms}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
              h1 { margin: 0 0 6px; font-size: 22px; }
              h2 { margin: 20px 0 8px; font-size: 14px; text-transform: uppercase; color: #334155; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
              .row { font-size: 13px; }
              .label { font-weight: 700; color: #475569; }
              .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
              .ok { background: #dcfce7; color: #166534; }
              .ko { background: #fee2e2; color: #991b1b; }
            </style>
          </head>
          <body>
            <h1>Fiche souscripteur</h1>
            <div class="row"><span class="label">Nom:</span> ${detailSelectionne.noms}</div>
            <div class="row"><span class="label">N° Fiche:</span> ${detailSelectionne.num_fiche}</div>

            <h2>Identité</h2>
            <div class="grid">
              <div class="row"><span class="label">Catégorie:</span> ${detailSelectionne.categorie || '-'}</div>
              <div class="row"><span class="label">Site:</span> ${detailSelectionne.site || '-'}</div>
            </div>

            <h2>Contacts</h2>
            <div class="grid">
              <div class="row"><span class="label">Téléphone 1:</span> ${detailSelectionne.telephone || '-'}</div>
              <div class="row"><span class="label">Téléphone 2:</span> ${detailSelectionne.telephone_2 || '-'}</div>
              <div class="row"><span class="label">Email:</span> ${detailSelectionne.email || '-'}</div>
            </div>

            <h2>Foncier</h2>
            <div class="grid">
              <div class="row"><span class="label">Dimension:</span> ${detailSelectionne.dimension || '-'}</div>
              <div class="row"><span class="label">Parcelle:</span> ${detailSelectionne.num_parcelle || '-'}</div>
              <div class="row"><span class="label">Cadastral:</span> ${detailSelectionne.num_cadastral || '-'}</div>
              <div class="row"><span class="label">Acte:</span> ${detailSelectionne.num_acte_vente || '-'}</div>
            </div>

            <h2>Souscription et recouvrement</h2>
            <div class="grid">
              <div class="row"><span class="label">Date souscription:</span> ${formatDate(detailSelectionne.date_souscription)}</div>
              <div class="row"><span class="label">Dernier versement:</span> ${formatDate(detailSelectionne.dernier_versement_date)}${detailSelectionne.dernier_versement_montant !== null ? ` (${formatMontant(detailSelectionne.dernier_versement_montant)})` : ''}</div>
              <div class="row"><span class="label">Couverture:</span> ${detailSelectionne.couverture}</div>
              <div class="row"><span class="label">Total versé:</span> ${formatMontant(detailSelectionne.total_verse)}</div>
              <div class="row"><span class="label">Dette mensuelle:</span> ${formatMontant(detailSelectionne.dette_mensuelle)}</div>
              <div class="row"><span class="label">État:</span> <span class="badge ${detailSelectionne.etat === 'À JOUR' ? 'ok' : 'ko'}">${detailSelectionne.etat}${detailSelectionne.retard_mois > 0 ? ` (${detailSelectionne.retard_mois} mois)` : ''}</span></div>
            </div>

            <script>
              window.onload = function () { window.print(); };
            </script>
          </body>
        </html>
      `;

      w.document.open();
      w.document.write(html);
      w.document.close();
    };

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

    return (
    <div className="min-h-screen bg-slate-50 pb-40"> 
      
      <div className="max-w-[1250px] mx-auto p-4 pt-8">
        <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none">Gestion / Recouvrement</h1>
      
      </div>
      

<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
  <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Portefeuille Global</p>
    <h3 className="text-2xl font-black">{financeStats.valeurProjet.toLocaleString()}$</h3>
    <p className="text-xs text-slate-500 mt-2 italic">Valeur totale des parcelles souscrites</p>
  </div>

  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
    <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-1">TOTAL PERCU</p>
    <h3 className="text-2xl font-black text-slate-900">{financeStats.encaissementGlobal.toLocaleString()}$</h3>
    <div className="flex items-center gap-2 mt-2">
       <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
         <div className="h-full bg-blue-600" style={{ width: `${(financeStats.encaissementGlobal / financeStats.valeurProjet) * 100}%` }}></div>
       </div>
       <span className="text-xs font-black text-blue-600">{((financeStats.encaissementGlobal / financeStats.valeurProjet) * 100).toFixed(1)}%</span>
    </div>
  </div>

  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
    <p className="text-xs font-black text-red-500 uppercase tracking-widest mb-1">Créances à Recouvrer</p>
    <h3 className="text-2xl font-black text-red-600">{financeStats.detteBrute.toLocaleString()}$</h3>
    <p className="text-xs text-slate-400 mt-2 font-black">Somme des restes à payer</p>
  </div>
  
</div>

<div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 mb-10 shadow-sm">
  <div className="flex justify-between items-center ">
    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Analyse de Trésorerie Mensuelle </h4>
  </div>
  
  <div className="flex items-end justify-between gap-3 h-25">
    {fluxMensuel.map((m, i) => (
      <div key={i} className="flex-1 flex flex-col items-center group relative">
        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all bg-slate-900 text-white text-xs px-2 py-1 rounded-lg z-10">
          {m.total}$
        </div>
        
        <div className="w-full bg-slate-50 rounded-t-xl relative flex items-end h-15 overflow-hidden border border-transparent group-hover:border-blue-100 transition-all">
          <div 
            className="w-full bg-gradient-to-t from-blue-700 to-blue-500 transition-all duration-1000 ease-out" 
            style={{ height: `${(m.total / (Math.max(...fluxMensuel.map(x => x.total)) || 1)) * 100}%` }}
          ></div>
        </div>
        <p className="text-xs font-black text-slate-400 mt-3 uppercase">{m.nom}</p>
      </div>
    ))}
  </div>
</div>
<div className="max-w-[1250px] mx-auto px-4 mb-6">
  <div className="relative group">
    
    <input
      type="text"
      placeholder="Rechercher un nom "
      className="w-full pl-14 pr-6 py-5 bg-white border-none rounded-[2rem] shadow-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-900/10 transition-all placeholder:text-slate-300 uppercase italic"
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
        <span className="text-xs font-black uppercase tracking-tighter">Effacer</span>
      </button>
    )}
  </div>
</div>


      <div className="max-w-[1250px] mx-auto p-4 animate-in fade-in duration-700">
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 mb-20">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-5 text-xs font-black uppercase tracking-widest">SOUSCRIPTEUR</th>
                <th className="p-5 text-xs font-black uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {donneesAffichees.map((s, index) => {
    return (
      <tr key={s.id} className="hover:bg-slate-50 transition-all border-b border-slate-50">
        <td className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-xs font-black text-slate-300 mt-1">#{debutIndex + index + 1}</span>
            <div>
              <div className="font-black text-slate-800 uppercase text-xs leading-tight">{s.noms}</div>
              <div className="text-xs font-bold text-blue-600 uppercase mt-1">
                Fiche {s.num_fiche} • {s.telephone || '-'}
              </div>
            </div>
          </div>
        </td>
        <td className="p-4 text-right">
          <button
            onClick={() => ouvrirDetailSouscripteur(s.id)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase text-slate-700 hover:bg-slate-100"
            aria-label={`Voir le détail de ${s.noms}`}
          >
            <Eye size={14} />
            Détail
          </button>
        </td>
      </tr>
    )
  })}
            </tbody>
          </table>
        </div>
      </div>

      {detailOuvert && (
        <div className="fixed inset-0 z-[110]">
          <button
            className="absolute inset-0 bg-slate-900/55"
            onClick={fermerDetail}
            aria-label="Fermer le détail"
          />

          <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto bg-white shadow-2xl md:w-[720px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 md:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Fiche détaillée</p>
                <h3 className="text-lg font-black text-slate-900">{detailSelectionne?.noms || 'Chargement...'}</h3>
              </div>
              <button
                onClick={fermerDetail}
                className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-4 md:p-6">
              {detailLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
                  Chargement des informations du souscripteur...
                </div>
              ) : detailError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
                  {detailError}
                </div>
              ) : detailSelectionne ? (
                <>
                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Identité</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Nom:</span> {detailSelectionne.noms}</p>
                      <p><span className="font-black text-slate-600">Fiche:</span> {detailSelectionne.num_fiche}</p>
                      <p><span className="font-black text-slate-600">Catégorie:</span> {detailSelectionne.categorie || '-'}</p>
                      <p><span className="font-black text-slate-600">Site:</span> {detailSelectionne.site || '-'}</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Contacts</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Téléphone 1:</span> {detailSelectionne.telephone || '-'}</p>
                      <p><span className="font-black text-slate-600">Téléphone 2:</span> {detailSelectionne.telephone_2 || '-'}</p>
                      <p className="sm:col-span-2"><span className="font-black text-slate-600">Email:</span> {detailSelectionne.email || '-'}</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Foncier</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Dimension:</span> {detailSelectionne.dimension || '-'}</p>
                      <p><span className="font-black text-slate-600">Parcelle:</span> {detailSelectionne.num_parcelle || '-'}</p>
                      <p><span className="font-black text-slate-600">Cadastral:</span> {detailSelectionne.num_cadastral || '-'}</p>
                      <p><span className="font-black text-slate-600">Acte:</span> {detailSelectionne.num_acte_vente || '-'}</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Souscription</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Date:</span> {formatDate(detailSelectionne.date_souscription)}</p>
                      <p>
                        <span className="font-black text-slate-600">Statut retard:</span>{' '}
                        <span className={detailSelectionne.retard_mois > 0 ? 'font-black text-red-600' : 'font-black text-green-600'}>
                          {detailSelectionne.retard_mois > 0 ? `${detailSelectionne.retard_mois} mois` : 'À jour'}
                        </span>
                      </p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Recouvrement</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p>
                        <span className="font-black text-slate-600">Dernier versement:</span>{' '}
                        {formatDate(detailSelectionne.dernier_versement_date)}
                        {detailSelectionne.dernier_versement_montant !== null ? ` (${formatMontant(detailSelectionne.dernier_versement_montant)})` : ''}
                      </p>
                      <p><span className="font-black text-slate-600">Couverture:</span> {detailSelectionne.couverture}</p>
                      <p><span className="font-black text-slate-600">Total versé:</span> {formatMontant(detailSelectionne.total_verse)}</p>
                      <p><span className="font-black text-slate-600">Dette mensuelle:</span> {formatMontant(detailSelectionne.dette_mensuelle)}</p>
                      <p className="sm:col-span-2">
                        <span className="font-black text-slate-600">État:</span>{' '}
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${detailSelectionne.etat === 'À JOUR' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {detailSelectionne.etat}
                        </span>
                      </p>
                    </div>
                  </section>

                  <button
                    onClick={imprimerFicheSouscripteur}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black uppercase text-white hover:bg-slate-800"
                  >
                    <Printer size={16} />
                    Imprimer fiche souscripteur
                  </button>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-4 z-50">
        <div className="max-w-[1250px] mx-auto flex flex-col gap-4">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl">
                <span className="text-xs font-black text-slate-500 uppercase px-2">Période</span>
                <input type="date" className="bg-transparent text-xs font-bold outline-none" value={dateDebut} onChange={(e) => {setDateDebut(e.target.value); setPageActuelle(1)}} />
                <span className="text-slate-400 text-xs">au</span>
                <input type="date" className="bg-transparent text-xs font-bold outline-none" value={dateFin} onChange={(e) => {setDateFin(e.target.value); setPageActuelle(1)}} />
              </div>
{/* Select Catégorie */}
<div className="w-28">
  <div className="relative group">
    <select 
      value={filtreCategorie} 
      onChange={(e) => setFiltreCategorie(e.target.value as any)}
      className="w-full p-4 pr-10 bg-white border border-slate-100 rounded-2xl outline-none font-black text-slate-700 text-xs uppercase cursor-pointer appearance-none focus:ring-4 ring-blue-900/5 shadow-sm transition-all hover:border-blue-200"
    >
      <option value="TOUS">catégorie</option>
      <option value="MILITAIRE">Militaire</option>
      <option value="CIVIL">Civil</option>
    </select>
    
    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  </div>
</div>
              
        {/* Select Dimension */}
<div className="w-28">
  <div className="relative group">
    <select 
      value={filtreDimension} 
      onChange={(e) => setFiltreDimension(e.target.value as any)}
      className="w-full p-4 pr-10 bg-white border border-slate-100 rounded-2xl outline-none font-black text-slate-700 text-xs uppercase cursor-pointer appearance-none focus:ring-4 ring-blue-900/5 shadow-sm transition-all hover:border-blue-200"
    >
      <option value="TOUS">dimension</option>
      <option value="15x20">15 x 20</option>
      <option value="20x20">20 x 20</option>
    </select>
    
    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  </div>
</div>
{/* Select Site */}
<div className="w-18">
  <div className="relative group">
    <select 
  value={filtreSite} 
  onChange={(e) => {setFiltreSite(e.target.value); setPageActuelle(1)}}
  className="w-full p-4 pr-10 bg-white border border-slate-100 rounded-2xl outline-none font-black text-slate-700 text-xs uppercase cursor-pointer appearance-none focus:ring-4 ring-blue-900/5 shadow-sm transition-all"
>
  <option value="TOUS">site</option>
  {/* On utilise Object.keys pour boucler sur les sites sans erreur */}
  {Object.keys(TARIFS_OFFICIELS).map((nomSite) => (
    <option key={nomSite} value={nomSite}>
      {nomSite}
    </option>
  ))}
</select>
    
    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  </div>
</div>

              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button onClick={() => {setFiltreMois(null); setPageActuelle(1)}} className={`px-3 py-1.5 rounded-lg text-xs font-black ${filtreMois === null ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>TOUS</button>
                <button onClick={() => {setFiltreMois(1); setPageActuelle(1)}} className={`px-3 py-1.5 rounded-lg text-xs font-black ${filtreMois === 1 ? 'bg-orange-400 text-white' : 'text-slate-400'}`}>1M</button>
                <button onClick={() => {setFiltreMois(2); setPageActuelle(1)}} className={`px-3 py-1.5 rounded-lg text-xs font-black ${filtreMois === 2 ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>2M</button>
                <button onClick={() => {setFiltreMois(3); setPageActuelle(1)}} className={`px-3 py-1.5 rounded-lg text-xs font-black ${filtreMois === 3 ? 'bg-red-600 text-white' : 'text-slate-400'}`}>3M+</button>
              </div>
            </div>

            <button onClick={() => setShowExportModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase shadow-md hover:bg-green-700 transition-all flex items-center gap-2">
              Exporter {listeFiltrée.length} dossiers
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-xs font-black text-slate-500 uppercase tracking-tighter">
              FICHIER <span className="text-blue-600">{debutIndex + 1} - {Math.min(finIndex, listeFiltrée.length)}</span> sur {listeFiltrée.length}
            </span>
            
            <div className="flex gap-2">
              <button 
                disabled={pageActuelle === 1}
                onClick={() => {setPageActuelle(p => p - 1); window.scrollTo(0,0)}}
                className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-black disabled:opacity-30 uppercase"
              >
                BACK
              </button>
              <div className="flex items-center px-4 bg-slate-900 text-white rounded-lg text-xs font-black">
                P {pageActuelle} / {totalPages || 1}
              </div>
              <button 
                disabled={pageActuelle === totalPages || totalPages === 0}
                onClick={() => {setPageActuelle(p => p + 1); window.scrollTo(0,0)}}
                className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-black disabled:opacity-30 uppercase"
              >
                NEXT
              </button>
            </div>
          </div>

        </div>
      </div>
  {showExportModal && (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-white">
        <h3 className="text-xl font-black text-slate-800 uppercase italic mb-6">Personnaliser</h3>
        
        <div className="grid grid-cols-2 gap-3 mb-8">
          {Object.keys(colonnesExport).map((key) => (
            <label key={key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors">
              <input 
                type="checkbox" 
                checked={(colonnesExport as any)[key]} 
                onChange={() => setColonnesExport(prev => ({ ...prev, [key]: !(prev as any)[key] }))}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-xs font-black text-slate-600 uppercase italic">{key.replace('_', ' ')}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setShowExportModal(false)} className="flex-1 p-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs">Annuler</button>
<button 
  onClick={exportToPDF} 
  className="flex-1 p-4 bg-blue-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-900/20"
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