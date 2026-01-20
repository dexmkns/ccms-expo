'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Users, Zap, Trophy } from 'lucide-react';
import Link from 'next/link';

// Types
type Competition = {
  competition_id: number;
  title: string;
  status: 'setup' | 'live' | 'ended';
};

type Participant = {
  id: number;
  booth: string;
  real_name: string;
};

export default function LandingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. HIDDEN ADMIN LOGIN (Ctrl + Shift + M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        router.push('/login');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // 2. FETCH ACTIVE EVENTS (ONLY LIVE OR ENDED)
  useEffect(() => {
    const fetchCompetitions = async () => {
      setLoading(true);
      const { data: comps } = await supabase
        .from('competitions')
        .select('competition_id, title, status')
        // UPDATED: Removed 'setup' so hidden events don't show up in tabs
        .in('status', ['live', 'ended']) 
        .order('competition_id', { ascending: false });

      if (comps && comps.length > 0) {
        setCompetitions(comps);
        // Default to the latest event
        setSelectedComp(comps[0]);
      }
      setLoading(false);
    };

    fetchCompetitions();
  }, []);

  // 3. FETCH ROSTER (Real Names Only)
  useEffect(() => {
    if (!selectedComp) return;

    const fetchRoster = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('participants')   
        .select('participant_id, booth_code, real_name')
        .eq('competition_id', selectedComp.competition_id)
        .order('booth_code');

      if (data) {
        const formatted = data.map((p) => ({
          id: p.participant_id,
          booth: p.booth_code,
          real_name: p.real_name,
        }));
        setTeams(formatted);
      }
      setLoading(false);
    };

    fetchRoster();
  }, [selectedComp]);

  return (
    <div className="min-h-screen bg-[#050b14] text-white font-sans selection:bg-cyan-500 selection:text-black">
      
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/10 blur-[120px] rounded-full"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-teal-600/10 blur-[120px] rounded-full"></div>
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        
        {/* --- HEADER --- */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-block relative">
              <h2 className="text-1xl md:text-1xl font text-white tracking-widest uppercase drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]">
              College Of Computing and Multimedia Studies
            </h2>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-widest uppercase drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]">
              
              2nd
            </h2>
            
            {/* Main Title */}
            <h1 className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-100 to-cyan-400 tracking-tighter drop-shadow-[0_0_30px_rgba(6,182,212,0.6)]"
                style={{ fontFamily: 'Impact, sans-serif' }}>
              IOT
            </h1>
            
            <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-cyan-400 tracking-tighter uppercase -mt-4">
              EXHIBIT
            </h2>
            
          </div>

          {/* DYNAMIC EVENT SELECTOR */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-lg font-mono mt-8 uppercase tracking-widest">
            {competitions.length > 0 ? (
                competitions.map((comp) => (
                    <div key={comp.competition_id} className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedComp(comp)}
                            className={`transition-all duration-300 hover:text-cyan-300 ${
                                selectedComp?.competition_id === comp.competition_id
                                ? 'text-cyan-400 font-bold border-b-2 border-cyan-400'
                                : 'text-slate-500'
                            }`}
                        >
                            {comp.title}
                        </button>
                        <span className="text-cyan-900">●</span>
                    </div>
                ))
            ) : (
                <div className="text-slate-500 text-sm">No live events at the moment.</div>
            )}
            <span className="text-slate-400">2025</span>
          </div>
        </div>

        {/* --- ROSTER INFO BAR --- */}
        {selectedComp && (
            <div className="flex justify-between items-end mb-8 border-b border-cyan-900/50 pb-4">
            <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Users className="text-cyan-400" /> 
                    <span className="text-white">Participants Roster</span>
                </h3>
                <p className="text-sm text-slate-500">
                    Registered Teams for {selectedComp.title}
                </p>
            </div>

            {/* Link to Scoreboard */}
            {(selectedComp.status === 'live' || selectedComp.status === 'ended') && (
                <Link 
                    href={`/scoreboard?id=${selectedComp.competition_id}`} 
                    className="group flex items-center gap-2 bg-cyan-950/50 border border-cyan-500/30 hover:bg-cyan-500 hover:text-black px-6 py-3 rounded-full transition-all duration-300 backdrop-blur-md"
                >
                    <Trophy size={18} className="group-hover:animate-bounce" />
                    <span className="font-bold uppercase tracking-wide text-sm">Open Live Scoreboard</span>
                </Link>
            )}
            </div>
        )}

        {/* --- ROSTER GRID (Real Names) --- */}
        {loading ? (
           <div className="text-center py-20 animate-pulse text-cyan-700">Loading Roster...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.length > 0 ? (
                teams.map((team) => (
                <div key={team.id} className="group relative bg-[#0f172a]/80 border border-slate-800 p-6 rounded-2xl overflow-hidden hover:border-cyan-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_-5px_rgba(34,211,238,0.15)]">
                    
                    {/* Decorative Icon */}
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                        <Zap size={24} className="text-cyan-400" />
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center border border-slate-700 group-hover:border-cyan-500/50 transition-colors">
                                <span className="font-mono text-xl font-bold text-cyan-400">
                                    {team.booth.includes('-') ? team.booth.split('-')[1] : team.booth}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex-1">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Booth {team.booth}
                            </div>
                            
                            <h4 className="text-xl font-bold text-white leading-tight group-hover:text-cyan-300 transition-colors">
                                {team.real_name}
                            </h4>

                            <p className="text-xs text-slate-600 mt-2 font-mono">
                                STATUS: REGISTERED
                            </p>
                        </div>
                    </div>
                </div>
                ))
            ) : (
                <div className="col-span-full text-center text-slate-500 py-10">
                    {competitions.length === 0 ? "Check back later for upcoming events." : "No participants found for this event yet."}
                </div>
            )}
          </div>
        )}
        
      
      </div>
    </div>
  );
}