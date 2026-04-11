'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

import Navigation from '@/components/Navigation'
import FormulaireCaisse from '@/components/FormulaireCaisse'
import DashboardAdmin from '@/components/DashboardAdmin'
import DashboardHome from '@/components/DashboardHome'
import EcheancesView from '@/components/EcheancesView'
import RapportsSynthesesView from '@/components/RapportsSynthesesView'
import RecouvrementView from '@/components/RecouvrementView'
import SubscribersView from '@/components/SubscribersView'
import TrashView from '@/components/TrashView'
import ParametresView from '@/components/ParametresView'

const sectionLabels: Record<string, { title: string; subtitle: string }> = {
  hub: {
    title: 'Bienvenue dans votre espace de gestion',
    subtitle: 'Choisissez une rubrique dans la sidebar pour démarrer votre saisie ou consulter les rapports.',
  },
  subscribers: {
    title: 'Vues des souscripteurs',
    subtitle: 'Analyse rapide et suivi des adhérents.',
  },
  echeances: {
    title: 'Échéances mensuelles',
    subtitle: 'Contrôlez rapidement les dates et les paiements.',
  },
  rapports: {
    title: 'Rapports et synthèses',
    subtitle: 'Bilan d’activité et synthèse des données.',
  },
  audits: {
    title: 'Journal d’audits',
    subtitle: 'Historique des contrôles et actions.',
  },
  recouvrement: {
    title: 'Recouvrement',
    subtitle: 'Pilotez les relances et le recouvrement des mensualités.',
  },
  verification: {
    title: 'Vérification QR code',
    subtitle: 'Validation du formulaire et du reçu.',
  },
  parametres: {
    title: 'Paramètres utilisateurs',
    subtitle: 'Attribuez les rôles et activez les comptes.',
  },
}

export default function LogicielFES() {
  const [activeView, setActiveView] = useState<'hub' | 'militaire' | 'civil' | 'admin' | 'subscribers' | 'corbeille' | 'echeances' | 'rapports' | 'audits' | 'recouvrement' | 'verification' | 'parametres'>('hub');
  const [sessionActive, setSessionActive] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const router = useRouter();

  const isUserActive = (user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) => {
    const appActive = user.app_metadata?.is_active !== false;
    const userActive = user.user_metadata?.is_active !== false;
    return appActive && userActive;
  };

  const handleLogout = useCallback(async (reason: string = '') => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Erreur lors de la déconnexion Supabase:", error.message);
      }

      localStorage.clear();
      sessionStorage.clear();

      if (reason === "timeout") {
        alert("Session expirée.");
      }

      if (reason === 'inactive') {
        alert('Compte désactivé. Contactez le coordonnateur.');
      }

      window.location.replace('/login');

    } catch (err) {
      console.error("Erreur critique déconnexion:", err);
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = '/login';
      } else {
        const sessionUser = sessionData.session.user;

        if (!isUserActive(sessionUser)) {
          await handleLogout('inactive');
          return;
        }

        const email = sessionUser.email || '';
        const roleFromAppMeta = String(sessionUser.app_metadata?.role || '').toLowerCase();
        const roleFromUserMeta = String(sessionUser.user_metadata?.role || '').toLowerCase();
        const isAdmin = roleFromAppMeta === 'admin' || roleFromUserMeta === 'admin';

        setCurrentUserId(sessionUser.id);
        setCurrentUserEmail(email);
        setIsAdminUser(isAdmin);
        setSessionActive(true);
      }
    };
    checkUser();
  }, [handleLogout, router]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        handleLogout("timeout");
      }, 600000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    resetTimer();

    events.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [handleLogout]);

  if (!sessionActive) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold">VÉRIFICATION...</div>;

  const renderContent = () => {
    const blockedViewsForNonAdmin = new Set(['recouvrement', 'rapports', 'echeances'])

    if (!isAdminUser && blockedViewsForNonAdmin.has(activeView)) {
      return (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          Accès refusé. Cette vue est restreinte. Contactez le coordonnateur pour obtenir l’autorisation.
        </div>
      )
    }

    if (activeView === 'militaire') return <FormulaireCaisse type="MILITAIRE" />
    if (activeView === 'civil') return <FormulaireCaisse type="CIVIL" />
    if (activeView === 'admin') return <DashboardAdmin />
    if (activeView === 'echeances') return <EcheancesView />
    if (activeView === 'audits' && !isAdminUser) {
      return (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          Accès refusé. Le journal d’audits est réservé aux administrateurs.
        </div>
      )
    }

    if (activeView === 'rapports') return <RapportsSynthesesView />
    if (activeView === 'recouvrement') return <RecouvrementView />
    if (activeView === 'hub') return <DashboardHome />
    if (activeView === 'corbeille') return <TrashView isAdmin={isAdminUser} currentUserEmail={currentUserEmail} />
    if (activeView === 'parametres') {
      if (!isAdminUser) {
        return (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
            Accès refusé. Cette vue est réservée aux administrateurs.
          </div>
        )
      }

      return <ParametresView />
    }

    if (activeView === 'subscribers') {
      return (
        <SubscribersView
          onAddSubscriber={(view) => setActiveView(view)}
          isAdmin={isAdminUser}
          currentUserEmail={currentUserEmail}
          onOpenTrash={() => setActiveView('corbeille')}
        />
      )
    }

    const section = sectionLabels[activeView] ?? sectionLabels.hub
    return (
      <div className="rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-700">Bienvenue</p>
          <h1 className="mt-4 text-3xl font-black text-slate-900">{section.title}</h1>
          <p className="mt-3 text-slate-600 leading-7">{section.subtitle}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Raccourci rapide</p>
            <p className="mt-3 font-bold text-slate-900">Remplir un formulaire ou consulter votre dashboard</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Navigation</p>
            <p className="mt-3 font-bold text-slate-900">Utilisez la sidebar pour accéder aux souscripteurs, échéances et audits</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Navigation
        setActiveView={setActiveView}
        activeView={activeView}
        currentUserEmail={currentUserEmail}
        currentUserId={currentUserId}
        isAdmin={isAdminUser}
      />

      {/* Main Content */}
      <main className="min-h-[calc(100vh-73px)]">
        <div className="mx-auto max-w-400 px-4 py-6 md:px-8">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}