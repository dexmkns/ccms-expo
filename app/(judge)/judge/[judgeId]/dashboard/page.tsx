'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation'; // Added useParams
import { createClient } from '@/lib/supabase';
import { ChevronRight, CheckCircle, Circle, LogOut, Lock, X, Eye, FileText } from 'lucide-react';
import type { Participant, Score, Competition, Judge, Criteria } from '@/types/expo';

export default function JudgeDashboard() {
  const router = useRouter();
  const params = useParams(); // Get ID from URL
  const supabase = createClient();
  
  // Use the ID from the URL (Fixes the multi-login issue)
  const judgeId = params.judgeId as string;

  // Data State
  const [judge, setJudge] = useState<Judge | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]); 
  const [myScores, setMyScores] = useState<Score[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [boothCodeInput, setBoothCodeInput] = useState('');
  const [error, setError] = useState('');
  const [viewingParticipant, setViewingParticipant] = useState<Participant | null>(null);

  // --- 1. REUSABLE FETCH SCORES ---
  const fetchMyScores = useCallback(async (id: string) => {
    const { data: scores } = await supabase
        .from('scores')
        .select('*')
        .eq('judge_id', id);
    
    if (scores) setMyScores(scores);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
        // Check URL Param instead of LocalStorage
        if (!judgeId) {
            router.push('/login');
            return;
        }

        const { data: judgeData } = await supabase.from('judges').select('*').eq('judge_id', judgeId).single();
        if (!judgeData) {
            router.push('/login');
            return;
        }
        setJudge(judgeData);

        const { data: compData } = await supabase.from('competitions').select('*').eq('competition_id', judgeData.competition_id).single();
        setCompetition(compData);

        const { data: teams } = await supabase.from('participants').select('*').eq('competition_id', judgeData.competition_id).order('booth_code');
        if (teams) setParticipants(teams);

        const { data: critData } = await supabase.from('criteria').select('*').eq('competition_id', judgeData.competition_id).order('criteria_id');
        if (critData) setCriteria(critData);
        
        await fetchMyScores(judgeId);

        setLoading(false);

        const channel = supabase
            .channel(`dashboard_scores_${judgeId}`)
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'scores', filter: `judge_id=eq.${judgeId}` }, 
                () => { fetchMyScores(judgeId); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    };

    init();
  }, [supabase, router, judgeId, fetchMyScores]);

  // Actions
  const handleLogout = () => {
      // Clear the cookie when logging out
      document.cookie = `ccms-judge-${judgeId}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
      router.push('/login');
  };

  const handleEnterCode = () => {
    if (!boothCodeInput) return;
    const team = participants.find(p => p.booth_code === boothCodeInput.toUpperCase());
    if (team) {
        // Keep the Judge ID in the URL
        router.push(`/judge/${judgeId}/vote/${team.participant_id}`);
    } else {
        setError('Invalid Code.');
    }
  };

  const getStatus = (participantId: number) => {
    const teamScores = myScores.filter(s => s.participant_id === participantId);
    if (teamScores.length === 0) return 'pending'; 
    const isLocked = teamScores.some(s => s.is_locked);
    if (isLocked) return 'completed';
    return 'in-progress';
  };

  // --- INTERACTION LOGIC ---
  const handleCardClick = (team: Participant) => {
    const status = getStatus(team.participant_id);
    const isVotingClosed = competition?.status !== 'live';

    if (status === 'completed' || (isVotingClosed && status === 'in-progress')) {
         setViewingParticipant(team);
         return;
    }

    if (isVotingClosed && status === 'pending') return;

    // Navigate with Judge ID
    router.push(`/judge/${judgeId}/vote/${team.participant_id}`);
  };

  const handleDirectFullPage = (e: React.MouseEvent, participantId: number) => {
      e.stopPropagation(); 
      router.push(`/judge/${judgeId}/vote/${participantId}`);
  };

  // --- MODAL HELPERS ---
  const getSelectedTeamScores = () => {
      if (!viewingParticipant) return [];
      return myScores.filter(s => s.participant_id === viewingParticipant.participant_id);
  };

  const calculateTotal = () => {
      const scores = getSelectedTeamScores();
      let total = 0;
      criteria.forEach(c => {
          const s = scores.find(score => score.criteria_id === c.criteria_id);
          // Standard Weighted Calculation
          if (s) total += (s.score_value * (c.weight_percentage / 100));
      });
      
      // --- UPDATE: REMOVED MULTIPLICATION ---
      // The total is now strictly 1-10 based
      return total.toFixed(2); // Using 2 decimals for precision (e.g. 8.75)
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500 font-bold">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-4 pb-20 relative">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-black text-slate-900">Judge Panel</h1>
                <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">{competition?.title}</p>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-400">Welcome, {judge?.name}</p>
                    {competition && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${competition.status === 'live' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {competition.status === 'live' ? '● Voting Open' : '● Voting Closed'}
                        </span>
                    )}
                </div>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 p-2"><LogOut size={20} /></button>
        </div>

        {/* Quick Access */}
        {competition?.status === 'live' && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-300 space-y-3">
                <label className="text-xs font-black uppercase text-slate-500 tracking-wider">Enter Booth Code</label>
                <div className="flex gap-2">
                    <input 
                        type="text" placeholder="e.g. GAME-01"
                        className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 uppercase tracking-widest font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                        value={boothCodeInput}
                        onChange={(e) => { setBoothCodeInput(e.target.value); setError(''); }}
                    />
                    <button onClick={handleEnterCode} className="bg-blue-600 text-white px-5 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"><ChevronRight size={24} /></button>
                </div>
                {error && <p className="text-xs text-red-500 font-bold animate-pulse">{error}</p>}
            </div>
        )}

        {/* List */}
        <div className="space-y-3">
            <div className="flex justify-between items-end mb-4">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Assigned Teams</h2>
                <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded-full">{participants.length}</span>
            </div>
            
            {participants.length === 0 ? (
                 <div className="text-center py-10 text-slate-400 font-medium bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    No teams assigned.
                 </div>
            ) : (
                participants.map((team) => {
                    const status = getStatus(team.participant_id);
                    const isVotingClosed = competition?.status !== 'live';
                    const hasData = status === 'completed' || status === 'in-progress';
                    const isInteractable = !isVotingClosed || hasData;

                    let cardStyle = "border-slate-300 bg-white hover:border-blue-400"; 
                    let statusText = null;

                    if (status === 'completed') {
                        cardStyle = "border-green-300 bg-green-50/50";
                        statusText = <span className="text-[10px] font-black text-green-700 uppercase tracking-wide bg-green-200 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock size={10} /> Done</span>;
                    }
                    
                    if (!isInteractable) {
                        cardStyle = "border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed";
                    }

                    return (
                        <div 
                            key={team.participant_id}
                            onClick={() => isInteractable && handleCardClick(team)}
                            className={`group p-4 rounded-xl border-2 transition-all active:scale-95 cursor-pointer flex items-center justify-between shadow-sm ${cardStyle}`}
                        >
                            {/* LEFT: Info */}
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${isInteractable ? 'bg-slate-800 text-white' : 'bg-slate-300 text-slate-500'}`}>
                                        {team.booth_code}
                                    </span>
                                    {statusText}
                                    {isVotingClosed && !hasData && (
                                        <span className="text-[10px] font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded flex items-center gap-1"><Lock size={10} /> Closed</span>
                                    )}
                                </div>
                                <h3 className="font-bold text-slate-900 text-lg leading-tight">{team.real_name}</h3>
                                <p className="text-xs font-medium text-slate-500 mt-0.5">{team.alias || 'No alias'}</p>
                            </div>
                            
                            {/* RIGHT: Actions */}
                            <div className="pl-4 flex items-center gap-2">
                                {status === 'completed' || (isVotingClosed && hasData) ? (
                                    <>
                                        <div title="View Summary" className="p-2 bg-white rounded-full text-green-600 shadow-sm border border-green-100 hover:bg-green-50 transition-colors">
                                            <Eye size={20} />
                                        </div>
                                        <button 
                                            onClick={(e) => handleDirectFullPage(e, team.participant_id)}
                                            className="p-2 bg-green-600 text-white rounded-full shadow-md hover:bg-green-700 transition-colors z-10"
                                            title="Open Full Ballot"
                                        >
                                            <FileText size={20} />
                                        </button>
                                    </>
                                ) : (
                                    isInteractable && <ChevronRight size={24} className="text-slate-300 group-hover:text-blue-500" />
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </div>

      {/* --- SCORE SUMMARY MODAL --- */}
      {viewingParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                
                <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                    <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Summary</div>
                        <div className="font-bold text-slate-900 text-lg leading-none mt-1">{viewingParticipant.real_name}</div>
                    </div>
                    <button onClick={() => setViewingParticipant(null)} className="bg-slate-200 p-1 rounded-full text-slate-500 hover:bg-slate-300 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                    {criteria.map(crit => {
                        const teamScores = getSelectedTeamScores();
                        const score = teamScores.find(s => s.criteria_id === crit.criteria_id)?.score_value || 0;
                        return (
                            <div key={crit.criteria_id} className="flex justify-between items-center text-sm border-b border-dashed border-slate-100 last:border-0 pb-2 last:pb-0">
                                <span className="text-slate-600 font-medium">{crit.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-300 bg-slate-100 px-1.5 rounded">{crit.weight_percentage}%</span>
                                    <span className="font-mono font-bold text-slate-900">{score}</span>
                                </div>
                            </div>
                        );
                    })}
                    
                    <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                        <span className="font-black text-slate-400 text-xs uppercase tracking-widest">Final Total</span>
                        <span className="font-black text-3xl text-green-600">{calculateTotal()}</span>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setViewingParticipant(null)}
                        className="py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors text-sm"
                    >
                        Close
                    </button>
                    <button 
                        onClick={() => router.push(`/judge/${judgeId}/vote/${viewingParticipant.participant_id}`)}
                        className="py-3 px-4 rounded-xl font-bold bg-slate-900 text-white hover:bg-black transition-colors text-sm flex items-center justify-center gap-2 shadow-lg"
                    >
                        <FileText size={16} /> Full Ballot
                    </button>
                </div>

            </div>
        </div>
      )}

    </div>
  );
}