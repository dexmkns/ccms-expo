'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Trophy, Medal, Crown, Activity } from 'lucide-react';

// Types
type RankedTeam = {
  id: number;
  displayName: string; 
  subLabel: string;   
  score: number;
  rank: number;
};

type Track = {
  id: number;
  title: string;
};

export default function ScoreboardPage() {
  const supabase = createClient();
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [rankings, setRankings] = useState<RankedTeam[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Initial Load: Get Tracks
  useEffect(() => {
    const fetchTracks = async () => {
        const { data } = await supabase
        .from('competitions')
        .select('*')
        .in('status', ['live', 'ended']) 
        .order('competition_id', { ascending: false });        
        if (data && data.length > 0) {
            const mapped = data.map(d => ({ 
                id: d.competition_id, 
                title: d.title 
            }));
            setTracks(mapped);
            setActiveTrack(mapped[0]);
        }
        setLoading(false);
    };
    fetchTracks();
  }, []);

  // 2. Poll for Rankings (Live Data Loop)
  useEffect(() => {
    if (!activeTrack) return;

    const fetchRankings = async () => {
        // A. CHECK THE TOGGLE
        const { data: trackSettings } = await supabase
            .from('competitions')
            .select('reveal_names')
            .eq('competition_id', activeTrack.id)
            .single();
        
        const showRealNames = trackSettings?.reveal_names || false;

        // B. FETCH DATA
        const { data: participants } = await supabase.from('participants').select('*').eq('competition_id', activeTrack.id);
        const { data: scores } = await supabase.from('scores').select('*').eq('competition_id', activeTrack.id);
        const { data: criteria } = await supabase.from('criteria').select('*').eq('competition_id', activeTrack.id);
        
        if (!participants || !scores || !criteria) return;

        // C. CALCULATE SCORES
        const calculated = participants.map(team => {
            const teamScores = scores.filter(s => s.participant_id === team.participant_id);
            const judgesVoted = new Set(teamScores.map(s => s.judge_id));
            let totalAverage = 0;

            judgesVoted.forEach(judgeId => {
                let judgeTotal = 0;
                criteria.forEach(c => {
                    const s = teamScores.find(ts => ts.judge_id === judgeId && ts.criteria_id === c.criteria_id);
                    if (s) judgeTotal += (s.score_value * c.weight_percentage) / 100;
                });
                totalAverage += judgeTotal;
            });

            // Calculate raw average (1-10 scale)
            const rawScore = judgesVoted.size > 0 ? totalAverage / judgesVoted.size : 0;
            
            // MULTIPLY BY 10 HERE (Convert to 10-100 scale)
            const finalScore = rawScore ;

            // D. APPLY DISPLAY LOGIC
            const displayName = showRealNames 
                ? team.real_name 
                : (team.alias || `Entry #${team.participant_id}`);

            const subLabel = showRealNames 
                ? (team.alias || "") 
                : ""; 

            return {
                id: team.participant_id,
                displayName,
                subLabel,
                score: parseFloat(finalScore.toFixed(2)),
                rank: 0
            };
        });

        // E. SORT & RANK
        calculated.sort((a, b) => b.score - a.score);
        const ranked = calculated.map((item, index) => ({ ...item, rank: index + 1 }));

        setRankings(ranked);
    };

    fetchRankings();
    const interval = setInterval(fetchRankings, 3000); 
    return () => clearInterval(interval);

  }, [activeTrack]); 

  if (loading) return <div className="min-h-screen bg-[#050b14] flex items-center justify-center text-cyan-500 font-mono animate-pulse">Initializing Neural Link...</div>;

  return (
    <div className="min-h-screen bg-[#050b14] text-white p-4 md:p-8 font-sans selection:bg-cyan-500 selection:text-black overflow-hidden relative">
      
      {/* Background FX */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-cyan-500/10 blur-[150px] rounded-full"></div>
         <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-teal-600/10 blur-[150px] rounded-full"></div>
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="text-center mb-12 space-y-2">
            <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-400 tracking-tighter drop-shadow-[0_0_25px_rgba(6,182,212,0.4)]"
                style={{ fontFamily: 'Impact, sans-serif' }}>
                LEADERBOARD
            </h1>
            <p className="text-slate-500 font-mono tracking-[0.3em] text-sm md:text-base uppercase">
                Live Data Feed <span className="text-cyan-500 animate-pulse">● Online</span>
            </p>
        </div>

        {/* TRACK TABS */}
        <div className="flex justify-center mb-12">
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-full">
                {tracks.map(track => (
                    <button
                        key={track.id}
                        onClick={() => setActiveTrack(track)}
                        className={`px-6 py-2 rounded-full font-bold text-sm transition-all duration-300 ${
                            activeTrack?.id === track.id 
                            ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        {track.title}
                    </button>
                ))}
            </div>
        </div>

        {/* RANKINGS GRID */}
        <div className="grid grid-cols-1 gap-4 max-w-5xl mx-auto">
            {rankings.map((team, index) => {
                const isTop1 = index === 0;
                const isTop2 = index === 1;
                const isTop3 = index === 2;
                
                let containerClass = "bg-[#0f172a]/40 border-slate-800/50 hover:bg-[#0f172a]/60";
                let scoreColor = "text-slate-400";
                let rankBadge = <span className="font-mono text-xl font-bold opacity-50">#{team.rank}</span>;

                if (isTop1) {
                    containerClass = "bg-gradient-to-r from-cyan-950/40 to-[#0f172a] border-cyan-500/50 shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)] scale-[1.02] z-10 my-4";
                    scoreColor = "text-cyan-400";
                    rankBadge = <Crown size={32} className="text-cyan-400 fill-cyan-400/20 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />;
                } else if (isTop2) {
                    containerClass = "bg-gradient-to-r from-teal-950/40 to-[#0f172a] border-teal-500/40";
                    scoreColor = "text-teal-400";
                    rankBadge = <Medal size={28} className="text-teal-400" />;
                } else if (isTop3) {
                    containerClass = "bg-gradient-to-r from-slate-800/40 to-[#0f172a] border-amber-600/40";
                    scoreColor = "text-amber-500";
                    rankBadge = <Medal size={28} className="text-amber-600" />;
                }

                return (
                    <div key={team.id} className={`flex items-center p-4 md:p-6 rounded-2xl border backdrop-blur-md transition-all duration-500 group ${containerClass}`}>
                        
                        <div className="w-16 md:w-24 flex justify-center shrink-0">
                            {rankBadge}
                        </div>

                        <div className="flex-1 px-4 min-w-0">
                            <h2 className={`font-black text-xl md:text-3xl truncate transition-all duration-300 ${isTop1 ? 'text-white tracking-wide' : 'text-slate-200'}`}>
                                {team.displayName}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                {team.subLabel && (
                                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${isTop1 ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-700/50' : 'bg-slate-800 text-slate-500'}`}>
                                        {team.subLabel}
                                    </span>
                                )}
                                {isTop1 && <span className="text-[10px] uppercase font-bold text-cyan-500 animate-pulse tracking-widest">● Leading</span>}
                            </div>
                        </div>

                        <div className="text-right pl-4">
                            <div className="flex items-end justify-end gap-1">
                                <span className={`text-4xl md:text-5xl font-black tracking-tighter leading-none ${scoreColor}`}>
                                    {team.score}
                                </span>
                                <span className="text-xs font-bold text-slate-600 mb-1.5">%</span>
                            </div>
                            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1">Total Average</div>
                        </div>

                        {isTop1 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-cyan-400 shadow-[0_0_15px_cyan]"></div>}
                    </div>
                );
            })}

            {rankings.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl bg-[#0f172a]/30">
                    <Activity size={48} className="mx-auto mb-4 text-slate-700 animate-pulse" />
                    <p className="text-slate-500 font-mono uppercase tracking-widest">Awaiting Tabulation Data...</p>
                </div>
            )}
        </div>
        
        <div className="mt-16 text-center">
            <p className="text-xs text-slate-700 font-mono uppercase">System Optimized for 1920x1080 Viewports</p>
        </div>

      </div>
    </div>
  );
}
