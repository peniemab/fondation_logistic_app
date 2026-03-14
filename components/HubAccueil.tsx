export default function HubAccueil({ setActiveView }: { setActiveView: (v: any) => void }) {
  return (
    <div className="max-w-[1000px] mx-auto mt-16 animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-12">
        <img src="/FES.jpg" alt="Logo" className="w-24 h-24 mx-auto mb-4 rounded-full shadow-lg" />
        <h1 className="text-4xl font-black text-blue-900 uppercase italic">Fondation El-Shaddaï / MBA__GESTION__</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* CARTE MILITAIRES */}
        <button onClick={() => setActiveView('militaire')} className="bg-white p-10 rounded-3xl shadow-2xl hover:scale-105 transition-all border-b-[12px] border-green-800 text-left group">
          <h2 className="text-2xl font-black text-green-900 uppercase">Militaires</h2>
        </button>

        {/* CARTE CIVILS */}
        <button onClick={() => setActiveView('civil')} className="bg-white p-10 rounded-3xl shadow-2xl hover:scale-105 transition-all border-b-[12px] border-blue-700 text-left group">
          <h2 className="text-2xl font-black text-blue-900 uppercase">Civils</h2>
        </button>

        {/* CARTE ADMIN */}
        <button onClick={() => setActiveView('admin')} className="bg-slate-900 p-10 rounded-3xl shadow-2xl hover:scale-105 transition-all border-b-[12px] border-red-600 text-left group">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">Dashboard / Admin</h2>
        </button>
      </div>
    </div>
  );
}