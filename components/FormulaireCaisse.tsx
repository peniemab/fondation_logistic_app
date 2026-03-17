'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TARIFS_OFFICIELS } from '@/lib/tarifs'
import { QRCodeSVG } from 'qrcode.react'

interface Paiement {
  created_at: string;
  reference_bordereau: string;
  montant: number;
  statut: string;
  date_paiement?: string;
}

interface Props {
  type: 'MILITAIRE' | 'CIVIL';
}

export default function FormulaireCaisse({ type }: Props) {
  const [loading, setLoading] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [montantSaisie, setMontantSaisie] = useState('')
    const [sessionActive, setSessionActive] = useState(false);
  
  const [refBordereau, setRefBordereau] = useState('')
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().split('T')[0]);
  
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');


  const [fiche, setFiche] = useState({
    id: null,
    num_fiche: '',
    noms: '', 
    genre: 'M', 
    date_souscription: new Date().toISOString().split('T')[0], 
    num_piece_id: '',
    employeur: '', 
    matricule: '',
    fonction: '',
    avenue_num: '', quartier: '', commune: '', email: '', telephone: '+243', telephone_2: '+243',
    num_parcelle: '', num_cadastral: '', 
    num_acte_vente: '',
    site: '', dimension: '15x20',
    nombre_parcelles: 1,
    categorie: type
  })
  const handleLogout = useCallback(async (reason: any = "") => {
      await supabase.auth.signOut()
      if (reason === "timeout") {
        alert("Session expirée.")
      }
      window.location.href = '/login'
    }, [])


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFiche({ ...fiche, [e.target.name]: e.target.value })
      }

      const ajouterPaiement = async () => {
       if (!montantSaisie || !refBordereau || !datePaiement) return alert("Remplissez tous les champs");
       
       const { error } = await supabase.from('paiements').insert([{
         num_fiche: fiche.num_fiche,
         montant: parseFloat(montantSaisie),
         reference_bordereau: refBordereau.toUpperCase(),
         date_paiement: datePaiement, 
         statut: 'VALIDÉ'
       }])
     
       if (error) {
         alert(error.code === '23505' ? "Bordereau déjà utilisé !" : error.message)
       } else {
         alert("Paiement enregistré avec succès");
         setMontantSaisie(''); 
         setRefBordereau('');
         executerRecherche();
       }
     }


  const fetchLastID = async () => {
      const { data } = await supabase
        .from('souscripteurs')
        .select('num_fiche')
        .order('num_fiche', { ascending: false })
        .limit(1)
      
      const lastNum = data?.[0]?.num_fiche ? parseInt(data[0].num_fiche) : 0
      const nextId = lastNum + 1
      
      setFiche(prev => ({ 
        ...prev, 
        id: null,
        num_fiche: nextId.toString().padStart(3, '0') 
      }))
    }

  useEffect(() => { if (!fiche.id) fetchLastID() }, [type])

  // --- 2. CALCULS MÉTIER ---
  const dimensionsDisponibles = fiche.site ? Object.keys(TARIFS_OFFICIELS[fiche.site] || {}) : [];
  const baseModalites = (fiche.site && TARIFS_OFFICIELS[fiche.site] && TARIFS_OFFICIELS[fiche.site][fiche.dimension]) 
    ? TARIFS_OFFICIELS[fiche.site][fiche.dimension] 
    : { total: 0, acompte: 0, mensualite: 0 };

  const nbP = parseInt(fiche.nombre_parcelles.toString()) || 1;
  const modalites = {
    total: baseModalites.total * nbP,
    acompte: baseModalites.acompte * nbP,
    mensualite: baseModalites.mensualite * nbP
  };

  const totalVerse = paiements.reduce((acc, curr) => acc + curr.montant, 0) + (fiche.id ? modalites.acompte : 0);
  const resteAPayer = modalites.total - totalVerse;

  // Calcul du Statut de Recouvrement
  const calculerStatut = () => {
    const debut = new Date(fiche.date_souscription);
    const aujourdhui = new Date();
    const diffMois = (aujourdhui.getFullYear() - debut.getFullYear()) * 12 + (aujourdhui.getMonth() - debut.getMonth());
    const attendu = modalites.acompte + (Math.max(0, diffMois) * modalites.mensualite);
    const retard = attendu - totalVerse;
    const moisRetard = modalites.mensualite > 0 ? Math.max(0, Math.floor(retard / modalites.mensualite)) : 0;

    if (retard <= 0) return { label: "À JOUR", color: "bg-green-600" };
    if (moisRetard >= 3) return { label: "CONTENTIEUX (3+)", color: "bg-black" };
    if (moisRetard === 2) return { label: "CRITIQUE (2M)", color: "bg-red-600" };
    return { label: "RELANCE (1M)", color: "bg-orange-500" };
  };

  const executerRecherche = async () => {
      if (!recherche) return;
      setLoading(true);
  
      const { data: resultats, error } = await supabase
        .from('souscripteurs')
        .select('*')
        .or(`num_fiche.eq.${recherche},noms.ilike.%${recherche}%,num_parcelle.eq.${recherche},telephone.eq.${recherche},email.eq.${recherche}`);
  
      if (error) {
        alert("Erreur de recherche");
      } else if (resultats && resultats.length > 0) {
        const dossierACharger = resultats[0];
  
        if (resultats.length > 1) {
          alert(`${resultats.length} dossiers trouvés pour "${recherche}".\nAffichage du dossier N° ${dossierACharger.num_fiche}.\n\nPour une autre parcelle, veuillez saisir le numéro de fiche exact.`);
        }
  
        setFiche(dossierACharger);
  
        // Récupération des paiements liée à cette fiche précise
        const { data: pData } = await supabase
          .from('paiements')
          .select('*')
          .eq('num_fiche', dossierACharger.num_fiche)
          .order('created_at', { ascending: false });
          
        setPaiements(pData || []);
      } else {
        alert("Aucun souscripteur trouvé.");
      }
      setLoading(false);
    }

const imprimerFiche = () => {
    if (!fiche.id) {
      alert("Action impossible : ENREGISTRER le dossier avant de l'imprimer.");
      return;
    }
    window.print();
  }
  const nouveauDossier = () => {
    if (confirm("Effacer le formulaire pour un nouveau dossier ?")) {
      window.location.reload(); 
    }
  }

const handleSave = async () => {
    if (!fiche.noms || !fiche.site) return alert("Le nom et le site sont obligatoires");
    setLoading(true);
    
    const { id, ...donneesNettoyées } = fiche;
    
    const payloadFinal = {
      ...(fiche.id ? fiche : donneesNettoyées), 
      categorie: type, 
      prix_total: modalites.total,
      acompte_initial: modalites.acompte,
      quotite_mensuelle: modalites.mensualite
    };

    const { data, error } = await supabase
      .from('souscripteurs')
      .upsert([payloadFinal], { onConflict: 'num_fiche' }) 
      .select()
      .single();

    if (error) {
      alert("Erreur : " + error.message);
    } else {
      setFiche(data);
      alert(fiche.id ? "Dossier mis à jour !" : "Nouveau dossier enregistré !");
    }
    
    setLoading(false);
};

  const handleAdminDelete = async () => {
      setLoading(true);
      
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });
  
      const EMAIL_AUTORISE = "coordon@fes.com"; 
  
      if (authError || data.user?.email !== EMAIL_AUTORISE) {
        alert("ACCÈS REFUSÉ : Seul le coordon peut autoriser une suppression.");
        setLoading(false);
        return;
      }
  
      if (confirm("suppression définitive du dossier?")) {
        await supabase.from('paiements').delete().eq('num_fiche', fiche.num_fiche);
        const { error } = await supabase.from('souscripteurs').delete().eq('id', fiche.id);
        
        if (!error) {
          alert("Dossier supprimé avec succès par le coordonnateur.");
          window.location.reload();
        } else {
          alert("Erreur de suppression.");
        }
      }
  
      setLoading(false);
      setShowAdminLogin(false);
      setAdminPassword(''); 
    };



 return (

  <div id="fiche-officielle" className="relative max-w-[1000px] mx-auto bg-white shadow-2xl rounded-sm border-t-[12px] border-blue-900 p-4 md:p-10 print:border-t-0 print:shadow-none overflow-hidden">
  
  <div className="absolute top-0 right-0 overflow-hidden w-32 h-32 pointer-events-none print:block">
    <div className={`
      absolute top-7 -right-8 w-40 py-1.5 
      rotate-45 text-center shadow-lg
      text-[10px] font-black uppercase tracking-widest
      ${type === 'MILITAIRE' 
        ? 'bg-red-700 text-white border-y-2 border-red-900' 
        : 'bg-slate-800 text-white border-y-2 border-slate-600'}
    `}>
      {type}
    </div>
  </div>
  
     <div className="min-h-screen bg-slate-100 p-2 md:p-8 font-sans text-slate-800">
       
       <div className="max-w-[1000px] mx-auto mb-4 flex flex-col md:flex-row gap-2 print:hidden">
         <input 
           className="flex-1 p-4 rounded-lg shadow-inner border-none outline-none font-bold text-blue-900 focus:ring-2 ring-blue-500"
           placeholder="Nom, N° Fiche, Numéro de parcelle, Téléphone, Email..."
           value={recherche}
           onChange={(e) => setRecherche(e.target.value)}
           onKeyDown={(e) => e.key === 'Enter' && executerRecherche()}
         />
         <div className="flex gap-2 h-14 md:h-auto">
           <button onClick={executerRecherche} className="flex-1 md:flex-none bg-blue-900 text-white px-8 rounded-lg font-black hover:bg-black transition-all">
             RECHERCHER
           </button>
           <button onClick={() => handleLogout()} className="bg-red-600 text-white px-4 rounded-lg font-bold text-[10px] uppercase border-2 border-red-700">
             Quitter
           </button>
         </div>
       </div>
 
       <div id="fiche-officielle" className="max-w-[1000px] mx-auto bg-white shadow-2xl rounded-sm border-t-[12px] border-blue-900 p-4 md:p-10 print:border-t-0 print:shadow-none overflow-hidden">
     
         <div className="flex flex-col md:flex-row justify-between items-center border-b-2 border-slate-200 pb-4 mb-6 gap-6">
           <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
             <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center">
               <img src="/FES.jpg" alt="Logo" className="max-w-full max-h-full object-contain" onError={(e) => e.currentTarget.src = "https://via.placeholder.com/100?text=LOGO"} />
             </div>
             <div className="space-y-1">
               <h1 className="text-lg md:text-2xl font-black text-green-900 leading-none uppercase">Fondation El-Shaddaï / MBA</h1>
               <p className="text-[9px] md:text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase italic">Opération Logements Sociaux - FES / MUTRAV</p>
               <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase leading-tight max-w-md">ARRETE MINISTERIEL N° 103/CAB.MIN/AFF.SS.AH/PKY/KS/2017</p>
             </div>
           </div>
 
           <div className="flex flex-col items-center md:items-end">
             <div className="bg-yellow-700 text-white px-5 py-2 font-black text-sm mb-2 border-2 border-yellow-700 print:text-black print:bg-white print:border-black shadow-lg">
               FICHE N° {fiche.num_fiche}
             </div>
             <QRCodeSVG value={`FES-N°${fiche.num_fiche}\nNom: ${fiche.noms || '...'}`} size={90} level="M" includeMargin={true} />
           </div>
         </div>
 
         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
           <section className="space-y-4">
             <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">I. Références Identitaires</h2>
             <div className="space-y-4">
               <input name="noms" value={fiche.noms} placeholder="NOMS" onChange={handleChange} className="w-full border-b border-slate-300 py-2 uppercase outline-none focus:border-blue-900" />
               <div className="grid grid-cols-2 gap-4 text-blue-900 font-black text-xs uppercase">
   <select name="genre" value={fiche.genre} onChange={handleChange} className="w-full border-b border-slate-300 py-2 outline-none focus:border-blue-900 font-medium">
     <option value="M">HOMME (M)</option>
     <option value="F">FEMME (F)</option>
   </select>
   <input type="date" name="date_souscription" value={fiche.date_souscription} onChange={handleChange} className="w-full border-b border-slate-300 py-2 outline-none focus:border-blue-900" />
 </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <input name="employeur" value={fiche.employeur} placeholder="EMPLOYEUR" onChange={handleChange} required className="w-full uppercase border-b border-slate-200 py-2 text-sm outline-none" />
                 <input name="matricule" value={fiche.matricule} placeholder="MATRICULE / C. DE SERVICE" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none" />
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <input name="num_piece_id" value={fiche.num_piece_id} placeholder="N° PIÈCE D'ID / PASSEPORT" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none font-medium" />
 <input name="fonction" value={fiche.fonction} placeholder="FONCTION" onChange={handleChange} className="w-full border-b uppercase border-slate-200 py-2 text-sm outline-none" />              </div>
             </div>
           </section>
 
           <section className="space-y-4">
             <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">II. Adresse & Contact</h2>
             <div className="space-y-4">
               <input name="avenue_num" value={fiche.avenue_num} placeholder="AVENUE ET NUMÉRO" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none" />
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <input name="quartier" value={fiche.quartier} placeholder="QUARTIER" onChange={handleChange} className="w-full border-b border-slate-200 uppercase py-2 text-sm outline-none" />
                 <input name="commune" value={fiche.commune} placeholder="COMMUNE" onChange={handleChange} className="w-full border-b uppercase border-slate-200 py-2 text-sm outline-none" />
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
   <div className="relative">
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
       className="w-full border-b border-slate-200 pt-5 pb-1 text-sm outline-none focus:border-blue-900 font-bold" 
     />
   </div>
 
   <div className="relative">
     <input 
       name="telephone_2" 
       value={fiche.telephone_2} 
       onChange={(e) => {
       const val = e.target.value;
       if (!val.startsWith('+243')) {
         setFiche({ ...fiche, telephone: '+243' });
       } else {
         handleChange(e);
       }
     }}
       className="w-full border-b border-slate-200 pt-5 pb-1 text-sm outline-none focus:border-blue-900 font-bold" 
     />
   </div>
 
   <div className="sm:col-span-2">
     <input 
       name="email" 
       value={fiche.email} 
       placeholder="EMAIL" 
       onChange={handleChange} 
       className="w-full border-b border-slate-200 py-2 text-sm outline-none focus:border-blue-500" 
     />
   </div>
 </div>
             </div>
           </section>
 
           <section className="space-y-4">
             <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">III. Détails Fonciers</h2>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <input name="num_parcelle" value={fiche.num_parcelle} placeholder="N° PARCELLE" onChange={handleChange} className="border-b border-blue-300 py-2 font-black text-xs text-blue-700 outline-none" />
               <input name="num_cadastral" value={fiche.num_cadastral} placeholder="N° CADASTRAL" onChange={handleChange} className="border-b border-slate-200 py-2 text-xs outline-none" />
               <input name="num_acte_vente" value={fiche.num_acte_vente} placeholder="N° ACTE DE VENTE" onChange={handleChange} className="border-b border-slate-200 py-2 text-xs outline-none" />
             </div>
           </section>
           <section className="space-y-4">
             <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">IV. Site & Dimensions</h2>
             <div className="flex items-center px-2 gap-2 mb-2  rounded border border-slate-200">
   <label className="font-medium uppercase text-sm text-gray-400 outline-none">Nombre de parcelles :</label>
   <input 
     type="number" 
     name="nombre_parcelles" 
     min="1" 
     value={fiche.nombre_parcelles} 
     onChange={handleChange} 
     className="border-b-2 bg-transparent  font-black text-center outline-none"
   />
 </div>
             <div className="space-y-4">
               <select name="site" value={fiche.site} onChange={handleChange} className="w-full border-b-2 border-blue-200 py-2 font-bold text-blue-900 outline-none bg-white print:hidden">
                 <option value="">-- CHOISIR LE SITE --</option>
                 {Object.keys(TARIFS_OFFICIELS).map(siteName => (
                   <option key={siteName} value={siteName}>{siteName}</option>
                 ))}
               </select>
 
               {fiche.site && (
                 <select name="dimension" value={fiche.dimension} onChange={handleChange} className="w-full border-b-2 border-green-200 py-2 font-bold text-green-900 outline-none bg-white print:hidden">
                   {dimensionsDisponibles.map(dim => (
                     <option key={dim} value={dim}>{dim} (m²)</option>
                   ))}
                 </select>
               )}
 
               {fiche.site && (
                 <div className="flex justify-between items-center bg-blue-50 p-2 border border-blue-100 rounded-lg print:border-slate-900 print:border-2">
                   <div className="flex flex-col">
                     <span className="text-[8px] uppercase font-black text-blue-400">Total</span>
                     <span className="font-bold text-xs">{modalites.total}$</span>
                   </div>
                   <div className="flex flex-col border-x px-4 border-blue-200">
                     <span className="text-[8px] uppercase font-black text-blue-400">Acompte</span>
                     <span className="font-bold text-xs">{modalites.acompte}$</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[8px] uppercase font-black text-blue-400">Mensuel</span>
                     <span className="font-bold text-xs">{modalites.mensualite}$</span>
                   </div>
                 </div>
               )}
             </div>
           </section>
         </div>
 
         {fiche.noms && (
           <div className="mt-10 pt-6 border-t-2 border-slate-100 space-y-8">
             <section>
               <h2 className="text-blue-900 font-black text-xs uppercase mb-3">V. Résumé du Compte</h2>
               <div className="grid grid-cols-2 md:grid-cols-4 border-2 border-slate-900 divide-x-2 md:divide-x-2 divide-y-2 md:divide-y-0 divide-slate-900 text-center">
                 <div className="p-1"><span className="text-[8px] block text-slate-500 uppercase">Prix</span><span className="font-black text-sm">{modalites.total}$</span></div>
                 <div className="p-1"><span className="text-[8px] block text-slate-500 uppercase">Acompte</span><span className="font-black text-sm">{modalites.acompte}$</span></div>
                 <div className="p-1 bg-green-50"><span className="text-[8px] block text-green-600 uppercase">Versé</span><span className="font-black text-sm text-green-700">{totalVerse.toFixed(2)}$</span></div>
                 <div className="p-1 bg-red-50"><span className="text-[8px] block text-red-600 uppercase">Reste</span><span className="font-black text-sm text-red-700">{resteAPayer.toFixed(2)}$</span></div>
               </div>
             </section>
 
             <section className="bg-slate-900 p-2 rounded-lg text-white print:hidden">
   <h3 className="text-yellow-500 font-black text-[10px] uppercase mb-3 italic">Saisie Nouveau Paiement</h3>
   <div className="flex flex-col md:flex-row gap-2">
     <input 
       type="date" 
       value={datePaiement} 
       onChange={(e) => setDatePaiement(e.target.value)} 
       className="bg-slate-800 p-3 rounded font-bold md:w-44 outline-none text-xs text-yellow-500" 
     />
     <input type="number" placeholder="MONTANT $" value={montantSaisie} onChange={(e) => setMontantSaisie(e.target.value)} className="bg-slate-800 p-3 rounded font-bold md:w-32 outline-none" />
     <input type="text" placeholder="RÉFÉRENCE BORDEREAU" value={refBordereau} onChange={(e) => setRefBordereau(e.target.value)} className="bg-slate-800 p-3 rounded font-bold flex-1 uppercase outline-none" />
     <button onClick={ajouterPaiement} className="bg-yellow-500 text-slate-900 p-3 font-black uppercase text-xs hover:bg-white transition-all">Valider</button>
   </div>
 </section>
           </div>
         )}
 
         <div className="mt-20 flex flex-col sm:flex-row justify-between gap-10 text-center border-t border-slate-100 pt-10">
           <div className="flex-1">
             <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Souscripteur</p>
             <div className="border-b border-slate-900 pb-1 mb-2">
               <span className="text-[10px] font-bold uppercase">{fiche.noms || "Nom du souscripteur"}</span>
             </div>
             <div className="h-20 border border-dashed border-green-900 rounded flex items-center justify-center italic text-[8px] text-slate-300">"Lu et approuvé"</div>
           </div>
 
           <div className="flex-1">
             <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Pour la Fondation FES / MBA</p>
             <div className="border-b border-slate-900 pb-1 mb-2 italic text-[10px] font-bold">Sceau et Signature</div>
             <div className="h-20 flex items-center justify-center text-[8px] text-slate-300">Emplacement du Cachet</div>
           </div>
         </div>
 
         <section className="mt-25 overflow-x-auto">
           <h2 className="text-blue-900 font-black text-xs uppercase mb-4">VI. Historique des Versements</h2>
           <table className="w-full border-collapse border border-slate-200 text-[10px]">
             <thead className="bg-slate-900 text-white print:bg-slate-100 print:text-black">
               <tr>
                 <th className="p-1 border">Date</th>
                 <th className="p-1 border">Référence</th>
                 <th className="p-1 border text-right">Montant</th>
               </tr>
             </thead>
             <tbody>
               {paiements.map((p, i) => (
                 <tr key={i} className="text-center italic">
                   <td className="p-1 border">{new Date(p.created_at).toLocaleDateString()}</td>
                   <td className="p-1 border font-bold uppercase">{p.reference_bordereau}</td>
                   <td className="p-1 border text-right font-black">{p.montant}$</td>
                 </tr>
               ))}
             </tbody>
           </table>
         </section>
 
         <div className="hidden print:block mt-8 md:mt-12 pt-4 border-t border-slate-100 text-center">
           <div className="flex flex-col items-center gap-1">
             <p className="text-[7px] md:text-[8px] text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] leading-relaxed">
               Document généré par le Système de Gestion FES / MBA 
             </p>
             <p className="text-[7px] md:text-[8px] text-slate-500 font-bold uppercase">
               Kinshasa-RDC, le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
             </p>
           </div>
         </div>
 
         <div className="mt-10 pt-6 border-t-2 border-slate-100 flex flex-col md:flex-row gap-3 print:hidden">
           <button onClick={imprimerFiche} className="w-full md:flex-1 bg-green-900 text-white p-4 font-black uppercase text-xs">Imprimer</button>
           <button onClick={nouveauDossier} className="w-full md:w-24 bg-white text-slate-400 p-4 font-black uppercase text-xs border border-slate-200">New</button>
           
           {fiche.id && (
             <button 
               onClick={() => setShowAdminLogin(true)} 
               className="w-full md:w-24 bg-red-100 text-red-600 p-4 font-black uppercase text-[10px] border border-red-200 hover:bg-red-600 hover:text-white transition-all"
             >
               Supprimer
             </button>
           )}
 
           <button onClick={handleSave} disabled={loading} className="w-full md:flex-[2] bg-yellow-700 text-white p-4 font-black uppercase text-xs shadow-xl disabled:bg-slate-300">
             {loading ? 'CHARGEMENT...' : (fiche.id ? 'Mettre à jour' : 'Enregistrer le dossier')}
           </button>
         </div>
 
       </div>
 
       {showAdminLogin && (
         <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md">
           <div className="bg-white p-8 rounded-xl max-w-sm w-full shadow-2xl border-t-8 border-red-600">
             <h3 className="text-red-600 font-black text-lg mb-2 uppercase text-center tracking-tighter">Autorisation Requise</h3>
             <p className="text-[10px] text-slate-500 mb-6 text-center font-bold uppercase">Identifiants administrateur</p>
             
             <div className="space-y-3">
               <input 
                 type="email" 
                 placeholder="EMAIL AUTORISÉ" 
                 className="w-full p-3 bg-slate-100 rounded border-none font-bold text-sm outline-none focus:ring-2 ring-red-500"
                 value={adminEmail}
                 onChange={(e) => setAdminEmail(e.target.value)}
               />
               <input 
                 type="password" 
                 placeholder="Mot de passe" 
                 className="w-full p-3 bg-slate-100 rounded border-none font-bold text-sm outline-none focus:ring-2 ring-red-500"
                 value={adminPassword}
                 onChange={(e) => setAdminPassword(e.target.value)}
               />
               <div className="flex gap-2 pt-4">
                 <button onClick={() => { setShowAdminLogin(false); setAdminPassword(''); }} className="flex-1 p-3 text-xs font-bold text-slate-400 uppercase">Annuler</button>
                 <button 
                   onClick={handleAdminDelete}
                   disabled={loading}
                   className="flex-1 p-3 bg-red-600 text-white rounded font-black text-xs uppercase shadow-lg active:scale-95 transition-transform disabled:bg-slate-400"
                 >
                   {loading ? 'Vérification...' : 'Supprimer'}
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}
 
     </div>
      </div>
   )
}