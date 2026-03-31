'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

import HubAccueil from '@/components/HubAccueil'
import Navigation from '@/components/Navigation'
import FormulaireCaisse from '@/components/FormulaireCaisse'
import DashboardAdmin from '@/components/DashboardAdmin'

export default function LogicielFES() {
  const [activeView, setActiveView] = useState<'hub' | 'militaire' | 'civil' | 'admin'>('hub');
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const handleLogout = useCallback(async (reason: any = "") => {
  try {
    setLoading(true); 

    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error("Erreur lors de la déconnexion Supabase:", error.message);
    }

    localStorage.clear(); 
    sessionStorage.clear();

    if (reason === "timeout") {
      alert("Session expirée.");
    }

    window.location.replace('/login');

  } catch (err) {
    console.error("Erreur critique déconnexion:", err);
    window.location.href = '/login'; 
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = '/login';
      } else {
        setSessionActive(true);
      }
    };
    checkUser();
  }, [router]);

useEffect(() => {
  let timer: NodeJS.Timeout;

  const resetTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      handleLogout("timeout");
    }, 60000); 
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

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      
      {activeView !== 'hub' && (
        <Navigation setActiveView={setActiveView} activeView={activeView} />
      )}

      <main className="p-4 md:p-8">
        {activeView === 'hub' && <HubAccueil setActiveView={setActiveView} />}
        
        {activeView === 'militaire' && <FormulaireCaisse type="MILITAIRE" />}
        
        {activeView === 'civil' && <FormulaireCaisse type="CIVIL" />}
        
        {activeView === 'admin' && <DashboardAdmin />}
      </main>

    </div>
  )
}