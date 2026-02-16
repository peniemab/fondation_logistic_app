'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TARIFS_OFFICIELS } from '@/lib/tarifs'
import { QRCodeSVG } from 'qrcode.react'

interface Paiement {
  created_at: string;
  reference_bordereau: string;
  montant: number;
  statut: string;
}

export default function LogicielFES() {
  const [loading, setLoading] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [sessionActive, setSessionActive] = useState(false);
  
  const [fiche, setFiche] = useState({
    id: null,
    num_fiche: '',
    noms: '', 
    num_piece_id: '',
    employeur: '', 
    matricule: '',
    fonction: '',
    avenue_num: '', quartier: '', commune: '', email: '', telephone: '',
    num_parcelle: '', num_cadastral: '', 
    num_acte_vente: '',
    site: '', dimension: '15x20'
  })

  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [montantSaisie, setMontantSaisie] = useState('')
  const [refBordereau, setRefBordereau] = useState('')

  // 1. LA LOGIQUE DE CHARGEMENT ID (Sortie du useEffect pour être réutilisable)
  const fetchLastID = async () => {
    const { data } = await supabase.from('souscripteurs').select('num_fiche').order('id', { ascending: false }).limit(1)
    const nextId = data?.[0]?.num_fiche ? parseInt(data[0].num_fiche) + 1 : 1
    setFiche(prev => ({ ...prev, num_fiche: nextId.toString().padStart(3, '0') }))
  }

  // 2. LA VÉRIFICATION DE SESSION AU DÉMARRAGE
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = '/login';
      } else {
        setSessionActive(true);
        fetchLastID(); // Maintenant fetchLastID est accessible ici !
      }
    };
    checkUser();
  }, []);

  const modalites = (fiche.site && TARIFS_OFFICIELS[fiche.site]) 
    ? TARIFS_OFFICIELS[fiche.site][fiche.dimension] 
    : { total: 0, acompte: 0, mensualite: 0 };

  const executerRecherche = async () => {
    if (!recherche) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('souscripteurs')
      .select('*')
      .or(`num_fiche.eq.${recherche},noms.ilike.%${recherche}%,num_parcelle.eq.${recherche},email.eq.${recherche}`)
      .maybeSingle();

    if (error) alert("Erreur de recherche");
    else if (data) {
      setFiche(data);
      const { data: pData } = await supabase.from('paiements').select('*').eq('num_fiche', data.num_fiche).order('created_at', { ascending: false });
      setPaiements(pData || []);
    } else alert("Aucun souscripteur trouvé.");
    setLoading(false);
  }

  const nouveauDossier = () => {
    if (confirm("Voulez-vous vraiment effacer le formulaire pour un nouveau dossier ?")) {
      window.location.reload(); 
    }
  }

  const imprimerFiche = () => {
    if (!fiche.id) {
      alert("⚠️ Action impossible : Vous devez d'abord ENREGISTRER le dossier avant de pouvoir l'imprimer.");
      return;
    }
    window.print();
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFiche({ ...fiche, [e.target.name]: e.target.value })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }
  
  const handleSave = async () => {
  if (!fiche.noms || !fiche.site) return alert("Le nom et le site sont obligatoires")
  setLoading(true)
  
  // On prépare les données : si l'ID est null, on le retire de l'objet
  // pour laisser la base de données le générer elle-même.
  const { id, ...donneesAEnvoyer } = fiche;
  const payload = fiche.id ? fiche : donneesAEnvoyer;

  const { data, error } = await supabase
    .from('souscripteurs')
    .upsert([{
      ...payload,
      prix_total: modalites.total,
      acompte_initial: modalites.acompte,
      quotite_mensuelle: modalites.mensualite
    }], { onConflict: 'num_fiche' }) 
    .select()
    .single()

  if (error) {
    alert("Erreur : " + error.message)
    console.error(error)
  } else {
    setFiche(data);
    alert("Dossier enregistré avec succès !");
  }
  setLoading(false)
}

  const ajouterPaiement = async () => {
    if (!montantSaisie || !refBordereau) return alert("Remplissez le montant et la référence");
    const { error } = await supabase.from('paiements').insert([{
      num_fiche: fiche.num_fiche,
      montant: parseFloat(montantSaisie),
      reference_bordereau: refBordereau.toUpperCase(),
      statut: 'VALIDÉ'
    }])
    if (error) alert(error.code === '23505' ? "Bordereau déjà utilisé !" : error.message)
    else {
      alert("Paiement enregistré");
      setMontantSaisie(''); setRefBordereau('');
      executerRecherche();
    }
  }

  const totalVerse = paiements.reduce((acc, curr) => acc + curr.montant, 0) + (fiche.id ? modalites.acompte : 0);
  const resteAPayer = modalites.total - totalVerse;

  // PROTECTION ÉCRAN BLANC PENDANT LE CHARGEMENT DE LA SESSION
  if (!sessionActive) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold tracking-widest">FONDATION EL-SHADDAI : VÉRIFICATION...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800">
      
      {/* BARRE DE RECHERCHE */}
      <div className="max-w-[1000px] mx-auto mb-4 flex gap-2 print:hidden">
        <input 
          className="flex-1 p-4 rounded-lg shadow-inner border-none outline-none font-bold text-blue-900 focus:ring-2 ring-blue-500"
          placeholder="Nom, N° Fiche, N° Parcelle..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && executerRecherche()}
        />
        <button onClick={executerRecherche} className="bg-blue-900 text-white px-8 rounded-lg font-black hover:bg-black transition-all">
          RECHERCHER
        </button>
        <button 
          onClick={handleLogout} 
          className="bg-red-600 text-white px-4 rounded-lg font-bold text-[10px] uppercase hover:bg-red-700 transition-all border-2 border-red-700"
        >
          Quitter
        </button>
      </div>

      <div id="fiche-officielle" className="max-w-[1000px] mx-auto bg-white shadow-2xl rounded-sm border-t-[12px] border-blue-900 p-6 md:p-10 print:border-t-0 print:shadow-none">
    
        {/* ================= ENTETE OFFICIELLE AVEC LOGO ================= */}
        <div className="flex justify-between items-center border-b-2 border-slate-200 pb-4 mb-6">
          
          {/* SECTION GAUCHE : LOGO ET TITRES */}
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 flex items-center justify-center">
    <img 
      src="/FES.jpg" 
      alt="Logo Fondation El-Shaddaï" 
      className="max-w-full max-h-full object-contain"
      onError={(e) => {
        // Si l'image ne charge pas, on affiche un texte de secours
        e.currentTarget.src = "https://via.placeholder.com/100?text=LOGO+FES";
      }}
    />
  </div>
            
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-green-900 leading-none uppercase">
                Fondation El-Shaddaï / MBA
              </h1>
              <p className="text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase italic">
                Opération Logements Sociaux - FES / MUTRAV
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase leading-tight max-w-md">
                ARRETE MINISTERIEL N° 103/CAB.MIN/AFF.SS.AH/PKY/KS/2017 DU 31/03/2017
              </p>
            </div>
          </div>

          {/* SECTION DROITE : NUMÉRO DE FICHE ET QR CODE DYNAMIQUE */}
          <div className="text-right flex flex-col items-end">
            <div className="bg-yellow-700 text-white px-5 py-2 font-black text-sm mb-2 print:text-black print:bg-white border-2 border-yellow-700 print:border-black shadow-lg print:shadow-none">
              FICHE N° {fiche.num_fiche}
            </div>
            
            <QRCodeSVG 
  value={`FES-N°${fiche.num_fiche}\nNom: ${fiche.noms || '...'}\nDate: ${new Date().toLocaleDateString('fr-FR')}`} 
  size={110} 
  level="M"   // On passe à un niveau de correction "Medium" pour épurer le dessin
  includeMargin={true}
/>
          </div>
        </div>
        {/* =============================================================== */}

        {/* FORMULAIRE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
          <section className="space-y-4">
            <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">I. Références Identitaires</h2>
            <div className="space-y-4">
              <input name="noms" value={fiche.noms} placeholder="NOMS" onChange={handleChange} className="w-full border-b border-slate-300 py-2 font-bold uppercase outline-none focus:border-blue-900 print:border-none" />
              <div className="grid grid-cols-2 gap-4">
                <input name="employeur" value={fiche.employeur} placeholder="EMPLOYEUR" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none print:border-none" />
                <input name="matricule" value={fiche.matricule} placeholder="MATRICULE/CARTE DE SERVICE" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-xs outline-none print:border-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
              <input name="num_piece_id" value={fiche.num_piece_id} placeholder="N° PIÈCE D'IDENTITÉ/PASSEPORT" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-xs outline-none print:border-none font-medium" />
              <input name="fonction" value={fiche.fonction} placeholder="FONCTION" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none print:border-none" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">II. Adresse & Contact</h2>
            <div className="space-y-4">
              <input name="avenue_num" value={fiche.avenue_num} placeholder="AVENUE ET NUMÉRO" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none print:border-none" />
              <div className="grid grid-cols-2 gap-4">
                <input name="quartier" value={fiche.quartier} placeholder="QUARTIER" onChange={handleChange} className="border-b border-slate-200 py-2 text-sm outline-none print:border-none" />
                <input name="commune" value={fiche.commune} placeholder="COMMUNE" onChange={handleChange} className="border-b border-slate-200 py-2 text-sm outline-none print:border-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
              <input name="telephone" value={fiche.telephone} placeholder="TÉLÉPHONE" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-sm outline-none print:border-none" />
              <input name="email" value={fiche.email} placeholder="EMAIL" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-xs outline-none print:border-none" />
            </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">III. Détails Fonciers</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
              <input name="num_parcelle" value={fiche.num_parcelle} placeholder="N° PARCELLE" onChange={handleChange} className="w-full border-b border-blue-300 py-2 font-black text-xs text-blue-700 outline-none print:text-black" />
                <input name="num_cadastral" value={fiche.num_cadastral} placeholder="N° CADASTRAL" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-xs outline-none print:border-none" />
                <input name="num_acte_vente" value={fiche.num_acte_vente} placeholder="N° ACTE DE VENTE" onChange={handleChange} className="w-full border-b border-slate-200 py-2 text-xs outline-none print:border-none" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider border-b-2 border-blue-900 w-fit pb-1">IV. Site & Dimensions</h2>
            <div className="space-y-4">
              <select name="site" value={fiche.site} onChange={handleChange} className="w-full border-b-2 border-blue-200 py-2 font-bold text-blue-900 outline-none bg-white appearance-none print:hidden">
                <option value="">-- CHOISIR LE SITE --</option>
                <option value="NDJILI BRASSERIE">NDJILI BRASSERIE</option>
              </select>
              
              <div className="hidden print:block font-black text-blue-900 border-b border-slate-300 py-2 uppercase">
                SITE : {fiche.site || 'Non défini'}
              </div>

              {fiche.site && (
                <div className="flex gap-4 items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Dimension :</label>
                  <select name="dimension" value={fiche.dimension} onChange={handleChange} className="flex-1 border-b border-blue-200 py-1 font-bold text-blue-900 outline-none bg-transparent print:border-none">
                    {Object.keys(TARIFS_OFFICIELS[fiche.site]).map(dim => (
                      <option key={dim} value={dim}>{dim} m²</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-blue-50 p-2 border border-blue-100 rounded-lg print:bg-white print:border-slate-900 print:border-2">
                <div className="flex justify-between text-[10px] font-black text-blue-800 print:text-black">
                  <span>PRIX: {modalites.total}$</span>
                  <span>ACOMPTE: {modalites.acompte}$</span>
                  <span>MENSUALITÉ: {modalites.mensualite}$</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ... (Paiements et reste de la page) ... */}
        {fiche.noms && (
          <div className="mt-1 pt-1 border-t-2 border-slate-100 space-y-10">
            {/* Résumé du Compte */}
            <section>
              <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider mb-2">V. Résumé du Compte Souscripteur</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 border-2 border-slate-900 divide-x-2 divide-slate-900 text-center">
                <div className="p-1"><span className="text-[5px] block text-slate-500 uppercase">Prix Total</span><span className="font-black">{modalites.total}$</span></div>
                <div className="p-1"><span className="text-[5px] block text-slate-500 uppercase">Acompte</span><span className="font-black">{modalites.acompte}$</span></div>
                <div className="p-1 bg-green-50 print:bg-white"><span className="text-[5px] block text-green-600 uppercase">Versé</span><span className="font-black text-green-700 print:text-black">{totalVerse.toFixed(2)}$</span></div>
                <div className="p-1 bg-red-50 print:bg-white"><span className="text-[5px] block text-red-600 uppercase">Reste</span><span className="font-black text-red-700 print:text-black">{resteAPayer.toFixed(2)}$</span></div>
              </div>
            </section>

            

            {/* Guichet de saisie rapide */}
            <section className="bg-slate-900 p-3 rounded-lg text-white print:hidden shadow-2xl">
              <h3 className="text-yellow-500 font-black text-[10px] uppercase mb-2 italic tracking-widest">Saisie Nouveau Paiement</h3>
              <div className="flex flex-col md:flex-row gap-4">
                <input type="number" placeholder="MONTANT $" value={montantSaisie} onChange={(e) => setMontantSaisie(e.target.value)} className="bg-slate-800 p-1 rounded font-bold w-full md:w-32 outline-none focus:ring-2 ring-yellow-500" />
                <input type="text" placeholder="RÉFÉRENCE BORDEREAU" value={refBordereau} onChange={(e) => setRefBordereau(e.target.value)} className="bg-slate-800 p-1 rounded font-bold flex-1 uppercase outline-none focus:ring-2 ring-yellow-500" />
                <button onClick={ajouterPaiement} className="bg-yellow-500 text-slate-900 px-8 py-3 font-black uppercase text-xs hover:bg-white transition-all">Valider</button>
              </div>
            </section>
          </div>
        )}

        {/* ================= BLOC SIGNATURES (Officiel) ================= */}
        <div className="mt-12 grid grid-cols-2 gap-16 text-center border-t border-slate-100 pt-10">
          {/* Côté Souscripteur */}
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Souscripteur
            </p>
            <div className="w-full border-b border-slate-900 pb-1 mb-3">
              <span className="text-[10px] font-bold text-slate-800 uppercase">
                {fiche.noms || "Nom du souscripteur"}
              </span>
            </div>
            <div className="h-20 w-48 border border-dashed border-slate-200 rounded flex items-center justify-center italic text-[9px] text-slate-300 mb-23 print:border-none">
              Signature précédée de la mention <br/> "Lu et approuvé"
            </div>
          </div>

          {/* Côté Fondation */}
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Pour la Fondation FES / MBA
            </p>
            <div className="w-full border-b border-slate-900 pb-1 mb-1">
              <span className="text-[10px] font-bold text-slate-800 uppercase">
                Sceau et Signature
              </span>
            </div>
            
          </div>
        </div>
        {/* Historique */}
            <section>
              <h2 className="text-blue-900 font-black text-xs uppercase tracking-wider mb-4">VI. Historique des Versements</h2>
              <table className="w-full border-collapse border border-slate-200 text-xs print:text-xs">
                <thead className="bg-slate-900 text-white text-[10px] uppercase print:bg-slate-200 print:text-black">
                  <tr><th className="p-1 border">Date</th><th className="p-1 border">Référence</th><th className="p-1 border text-right">Montant</th><th className="p-1 border">Statut</th></tr>
                </thead>
                <tbody>
                  {paiements.map((p, i) => (
                    <tr key={i} className="text-center italic">
                      <td className="p-1 border text-[11px]">{new Date(p.created_at).toLocaleString()}</td>
                      <td className="p-1 border font-bold uppercase">{p.reference_bordereau}</td>
                      <td className="p-1 border text-right font-black">{p.montant}$</td>
                      <td className="p-1 border text-[9px] font-black text-green-600 uppercase">{p.statut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

        {/* PIED DE PAGE TECHNIQUE (Visible uniquement à l'impression) */}
        <div className="hidden print:block mt-10 pt-4 border-t border-slate-200 text-center">
          <p className="text-[8px] text-slate-400 uppercase tracking-[0.3em]">
            FES / MBA Kinshasa-RDC le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
          </p>
        </div>
        {/* ============================================================= */}

        {/* ACTIONS FINALES */}
        <div className="mt-16 pt-8 border-t-2 border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
          <p className="text-[10px] text-slate-400 italic max-w-sm">* Validation requise par les services financiers.</p>
          <div className="flex gap-4 w-full md:w-auto">
            <button onClick={imprimerFiche} className="flex-1 bg-green-900 text-white px-8 py-4 font-black uppercase text-xs hover:bg-green-700 transition-all">Imprimer</button>
            <button onClick={nouveauDossier} className="bg-white text-slate-500 px-6 py-4 font-black uppercase text-xs border border-slate-200">New</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 bg-yellow-700 text-white px-12 py-4 font-black uppercase text-xs hover:bg-black transition-all shadow-xl disabled:bg-slate-300">
              {loading ? 'OPÉRATION...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}