'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { TARIFS_OFFICIELS } from '@/lib/tarifs'
import { QRCodeSVG } from 'qrcode.react'
import StepIdentites from './StepIdentites'
import StepAdresseFoncier from './StepAdresseFoncier'

interface Paiement {
  id?: string;
  created_at: string;
  reference_bordereau: string;
  montant: number;
  statut: string;
  date_paiement?: string;
}

interface Props {
  type: 'MILITAIRE' | 'CIVIL';
  onOpenCaisse?: (numFiche: string) => void;
}

type FormFiche = {
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
  email: string
  telephone: string
  telephone_2: string
  num_parcelle: string
  num_cadastral: string
  num_acte_vente: string
  site: string
  dimension: string
  nombre_parcelles: number
  categorie: 'MILITAIRE' | 'CIVIL'
}

export default function FormulaireCaisse({ type, onOpenCaisse }: Props) {
  const [loading, setLoading] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [step, setStep] = useState(1);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [fiche, setFiche] = useState<FormFiche>({
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFiche({ ...fiche, [e.target.name]: e.target.value })
  }


  const fetchLastID = async () => {
    const { data } = await supabase
      .from('souscripteurs')
      .select('num_fiche')
      .order('num_fiche', { ascending: false })
      .limit(1)

    const lastNum = data?.[0]?.num_fiche || 0;
    const nextId = parseInt(lastNum.toString()) + 1;

    setFiche(prev => ({
      ...prev,
      num_fiche: nextId.toString().padStart(6, '0')
    }))
  }

  useEffect(() => { if (!fiche.id) fetchLastID() }, [fiche.id, type])

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

  const executerRecherche = async () => {
    if (!recherche) return;
    setLoading(true);

    const estUnNombre = /^\d+$/.test(recherche);
    const rechercheNettoyee = recherche.trim();

    let query = supabase.from('souscripteurs').select('*').is('deleted_at', null);

    if (estUnNombre) {
      query = query.or(`num_fiche.eq.${parseInt(rechercheNettoyee)},telephone.eq.${rechercheNettoyee}`);
    } else {
      query = query.or(`noms.ilike.%${rechercheNettoyee}%,email.ilike.%${rechercheNettoyee}%,num_parcelle.ilike.%${rechercheNettoyee}%`);
    }

    const { data: resultats, error } = await query;

    if (error) {
      console.error("Détail erreur SQL:", error);
      alert("Erreur de recherche : " + error.message);
    } else if (resultats && resultats.length > 0) {
      const dossierACharger = resultats[0];

      if (resultats.length > 1) {
        alert(`${resultats.length} dossiers trouvés. Affichage du N° ${dossierACharger.num_fiche}`);
      }

      setFiche(dossierACharger);

      const { data: pData } = await supabase
        .from('paiements')
        .select('*')
        .eq('num_fiche', dossierACharger.num_fiche)
        .order('created_at', { ascending: false });

      setPaiements(pData || []);
    } else {
      alert("Aucun souscripteur trouvé pour : " + recherche);
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

    const donneesNettoyées = Object.fromEntries(
      Object.entries(fiche).filter(([key]) => key !== 'id')
    ) as Omit<typeof fiche, 'id'>

    const { num_fiche, ...payloadSansNumero } = donneesNettoyées;

    const payloadFinal = {
      ...(fiche.id ? { ...payloadSansNumero, num_fiche } : payloadSansNumero),
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
      alert(fiche.id ? "Dossier mis à jour !" : `Nouveau dossier enregistré ! N° Officiel : ${data.num_fiche}`);
    }

    setLoading(false);
  };

  const handleAdminDelete = async () => {
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    const roleFromAppMeta = String(data.user?.app_metadata?.role || '').toLowerCase();
    const roleFromUserMeta = String(data.user?.user_metadata?.role || '').toLowerCase();
    const isAdminRole = roleFromAppMeta === 'admin' || roleFromUserMeta === 'admin';

    if (authError || !isAdminRole) {
      alert("ACCÈS REFUSÉ : Seul un utilisateur avec le rôle admin peut autoriser cette action.");
      setLoading(false);
      return;
    }

    try {
      if (confirm("ATTENTION : Suppression DÉFINITIVE du dossier complet et de tous ses paiements ?")) {
        await supabase.from('paiements').delete().eq('num_fiche', fiche.num_fiche);
        const { error } = await supabase.from('souscripteurs').delete().eq('id', fiche.id);

        if (!error) {
          alert("Dossier supprimé avec succès.");
          window.location.reload();
        } else {
          throw error;
        }
      }
    } catch (err: unknown) {
      alert("Erreur de suppression : " + (err instanceof Error ? err.message : 'Erreur inconnue'));
    } finally {
      setLoading(false);
      setShowAdminLogin(false);
      setAdminPassword('');
    }
  };



  return (

    <div className="min-h-screen bg-slate-50 flex flex-col justify-start md:py-10 p-2 md:p-8 font-sans text-slate-800">

      <div className="w-full max-w-250 mx-auto mb-4 flex flex-col md:flex-row gap-2 print:hidden">
        <input
          className="flex-1 p-4 grow rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.05)] border-none outline-none font-bold text-blue-900 focus:ring-2 ring-blue-500"
          placeholder="Rechercher par Nom, N° Fiche, N° Parcelle, Téléphone, Email..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && executerRecherche()}
        />
        <div className="flex gap-2 h-14 md:h-auto">
          <button onClick={executerRecherche} className="flex-1 md:flex-none bg-blue-900 text-white px-8 rounded-lg font-black hover:bg-black transition-all">
            RECHERCHER
          </button>
        </div>
      </div>

      {/* Menu de navigation externe si on n'est pas à l'étape 1 */}
      {step === 2 && (
        <div className="w-full max-w-250 mx-auto mb-4 flex justify-between items-center bg-white p-4 rounded shadow-sm print:hidden border border-slate-200">
          <button onClick={() => setStep(1)} className="bg-blue-300 text-white px-8 py-3 rounded-lg font-black uppercase tracking-wider hover:bg-slate-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >Retour</button>
          <span className="text-xs font-black text-slate-400 uppercase">Étape 2 / 3</span>
        </div>
      )}

      {step >= 3 && (
        <div className="w-full max-w-250 mx-auto mb-4 flex justify-between items-center bg-white p-4 rounded shadow-sm print:hidden border border-slate-200">
          <button onClick={() => setStep(2)} className="bg-blue-300 text-white px-8 py-3 rounded-lg font-black uppercase tracking-wider hover:bg-slate-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >Retour</button>
          <span className="text-xs font-black text-slate-400 uppercase">Étape 3 / 3</span>
        </div>
      )}

      {/* GLOBAL CARD */}
      <div id="fiche-officielle" className="relative w-full max-w-250 mx-auto bg-white shadow-2xl rounded-sm border-t-12 border-blue-900 p-4 md:p-10 print:border-t-0 print:shadow-none overflow-hidden">

        <div className="absolute top-0 right-0 overflow-hidden w-32 h-32 pointer-events-none print:block">
          <div className={`
            absolute top-7 -right-8 w-40 py-1.5 
            rotate-45 text-center shadow-lg
            text-xs font-black uppercase tracking-widest
            ${type === 'MILITAIRE'
              ? 'bg-red-700 text-white border-y-2 border-red-900'
              : 'bg-slate-800 text-white border-y-2 border-slate-600'}
          `}>
            {type}
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center border-b-2 border-slate-200 pb-4 mb-6 gap-6">
          <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
            <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center">
              <Image src="/FES.jpg" alt="Logo" width={96} height={96} className="max-w-full max-h-full object-contain" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg md:text-2xl font-black text-green-900 leading-none uppercase">Fondation El-Shaddaï / MBA</h1>
              <p className="text-xs md:text-xs font-bold tracking-[0.15em] text-slate-500 uppercase italic">Opération Logements Sociaux - FES / MUTRAV</p>
              <p className="text-xs md:text-xs font-bold text-slate-400 uppercase leading-tight max-w-md">ARRETE MINISTERIEL N° 103/CAB.MIN/AFF.SS.AH/PKY/KS/2017</p>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end">
            <div className="bg-yellow-700 text-white px-5 py-2 font-black text-sm mb-2 border-2 border-yellow-700 print:text-black print:bg-white print:border-black shadow-lg">
              FICHE N° {fiche.num_fiche.toString().padStart(6, '0')}
            </div>
            <QRCodeSVG value={`FES-N°${fiche.num_fiche}\nNom: ${fiche.noms || '...'}`} size={90} level="M" includeMargin={true} />
          </div>
        </div>

        {step === 1 && (
          <StepIdentites
            fiche={fiche}
            handleChange={handleChange}
            onNext={() => setStep(2)}
            dimensionsDisponibles={dimensionsDisponibles}
            modalites={modalites}
          />
        )}

        {step === 2 && (
          <StepAdresseFoncier
            fiche={fiche}
            handleChange={handleChange}
            setFiche={setFiche}
            onNext={() => setStep(3)}
            onPrev={() => setStep(1)}
          />
        )}

        {step >= 3 && (
          <div className="flex flex-col gap-4">
            <div className="pt-2 space-y-8">
              <section>
                <h2 className="text-blue-900 font-black text-xs uppercase mb-3">V. Résumé du Compte</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 border-2 border-slate-900 divide-x-2 md:divide-x-2 divide-y-2 md:divide-y-0 divide-slate-900 text-center">
                  <div className="p-1"><span className="text-xs block text-slate-500 uppercase">Prix</span><span className="font-black text-sm">{modalites.total}$</span></div>
                  <div className="p-1"><span className="text-xs block text-slate-500 uppercase">Acompte</span><span className="font-black text-sm">{modalites.acompte}$</span></div>
                  <div className="p-1 bg-green-50"><span className="text-xs block text-green-600 uppercase">Versé</span><span className="font-black text-sm text-green-700">{totalVerse.toFixed(2)}$</span></div>
                  <div className="p-1 bg-red-50"><span className="text-xs block text-red-600 uppercase">Reste</span><span className="font-black text-sm text-red-700">{resteAPayer.toFixed(2)}$</span></div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 print:hidden">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Encaissement</h3>
                <p className="mt-2 text-xs text-slate-600">
                  Acompte initial: perçu automatiquement à la création. Les versements manuels et l&apos;historique sont gérés dans la vue Caisse.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenCaisse?.(String(fiche.num_fiche || '').trim())}
                  disabled={!fiche.id || !onOpenCaisse}
                  className="mt-3 rounded-xl bg-blue-900 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Ouvrir la caisse pour cette fiche
                </button>
              </section>
            </div>

            <div className="mt-20 flex flex-col sm:flex-row justify-between gap-10 text-center border-t border-slate-100 pt-10">
              <div className="flex-1">
                <p className="text-xs font-black uppercase text-slate-400 mb-1">Souscripteur</p>
                <div className="border-b border-slate-900 pb-1 mb-2">
                  <span className="text-xs font-bold uppercase">{fiche.noms || "Nom du souscripteur"}</span>
                </div>
                <div className="h-20 border border-dashed border-green-900 rounded flex items-center justify-center italic text-xs text-slate-300">&quot;Lu et approuvé&quot;</div>
              </div>

              <div className="flex-1">
                <p className="text-xs font-black uppercase text-slate-400 mb-1">Pour la Fondation FES / MBA</p>
                <div className="border-b border-slate-900 pb-1 mb-2 italic text-xs font-bold">Sceau et Signature</div>
                <div className="h-20 flex items-center justify-center text-xs text-slate-300">Emplacement du Cachet</div>
              </div>
            </div>

            <div className="hidden print:block mt-8 md:mt-12 pt-4 border-t border-slate-100 text-center">
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs md:text-xs text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] leading-relaxed">
                  Document généré par le Système de Gestion FES / MBA
                </p>
                <p className="text-xs md:text-xs text-slate-500 font-bold uppercase">
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
                  className="w-full md:w-24 bg-red-100 text-red-600 p-4 font-black uppercase text-xs border border-red-200 hover:bg-red-600 hover:text-white transition-all"
                >
                  Supprimer
                </button>
              )}

              <button onClick={handleSave} disabled={loading} className="w-full md:flex-2 bg-yellow-700 text-white p-4 font-black uppercase text-xs shadow-xl disabled:bg-slate-300">
                {loading ? 'CHARGEMENT...' : (fiche.id ? 'Mettre à jour' : 'Enregistrer le dossier')}
              </button>
            </div>

          </div>
        )}

        {showAdminLogin && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md">
            <div className="bg-white p-8 rounded-xl max-w-sm w-full shadow-2xl border-t-8 border-red-600">
              <h3 className="text-red-600 font-black text-lg mb-2 uppercase text-center tracking-tighter">Autorisation Requise</h3>
              <p className="text-xs text-slate-500 mb-6 text-center font-bold uppercase">Identifiants administrateur</p>

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