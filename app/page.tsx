'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

import HubAccueil from '@/components/HubAccueil'
import Navigation from '@/components/Navigation'
import FormulaireCaisse from '@/components/FormulaireCaisse'
import DashboardAdmin from '@/components/DashboardAdmin'

export default function LogicielFES() {
  const [activeView, setActiveView] = useState<'hub' | 'militaire' | 'civil' | 'admin'>('hub');
  const [sessionActive, setSessionActive] = useState(false);

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
  }, []);

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