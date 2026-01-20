'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { generateExpoExcel } from '@/lib/excel-generator';
import type { Participant, Judge, Score, Criteria, MatrixRow } from '@/types/expo';
import { Download, RefreshCcw, Trash2, X, Unlock, Clock, BarChart3, Zap, Trophy, Medal } from 'lucide-react';

export default function TabulationPage() {
  const supabase = createClient();
  const params = useParams();
  const competitionId = params.trackId;

  // Data State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedCell, setSelectedCell] = useState<{
    judge: Judge;
    participant: Participant;
    scoreTotal: number;
    hasRequest: boolean;
    isLocked: boolean;
    breakdown: { name: string; value: number }[];
  } | null>(null);

  // 1. Fetch Data
  const fetchData = async () => {
    if (!competitionId) return;
    if (participants.length === 0) setLoading(true);
    
    try {
      const { data: pData } = await supabase.from('participants').select('*').eq('competition_id', competitionId);
      const { data: jData } = await supabase.from('judges').select('*').eq('competition_id', competitionId).order('name');
      const { data: cData } = await supabase.from('criteria').select('*').eq('competition_id', competitionId);
      const { data: sData } = await supabase.from('scores').select('*').eq('competition_id', competitionId);

      if (pData) setParticipants(pData);
      if (jData) setJudges(jData);
      if (cData) setCriteria(cData);
      if (sData) setScores(sData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('tabulation_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `competition_id=eq.${competitionId}` }, 
      () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [competitionId]);

  // 2. Calculation Engine
  useEffect(() => {
    if (loading || participants.length === 0) return;

    const calculatedMatrix: MatrixRow[] = participants.map((team) => {
      const teamScores = scores.filter((s) => s.participant_id === team.participant_id);
      const judgeTotals: Record<number, number> = {};
      const judgeRequests: Record<number, boolean> = {}; 
      const judgeRawValues: number[] = [];

      judges.forEach((judge) => {
        let currentJudgeTotal = 0;
        let criteriaCount = 0;
        let hasPendingRequest = false;

        criteria.forEach((crit) => {
          const scoreEntry = teamScores.find((s) => s.judge_id === judge.judge_id && s.criteria_id === crit.criteria_id);
          if (scoreEntry) {
            // Weighted calculation (base score 1-10)
            currentJudgeTotal += (scoreEntry.score_value * crit.weight_percentage) / 100;
            criteriaCount++;
            if (scoreEntry.unlock_request) hasPendingRequest = true;
          }
        });

        if (criteriaCount > 0) {
            // HERE: If you want individual judge columns to also be out of 100, multiply by 10 here.
            // Currently set to multiply so the breakdown looks consistent with the total.
            const scaledJudgeTotal = currentJudgeTotal; 

            const formattedTotal = parseFloat(scaledJudgeTotal.toFixed(2));
            judgeTotals[judge.judge_id] = formattedTotal;
            judgeRequests[judge.judge_id] = hasPendingRequest;
            judgeRawValues.push(formattedTotal);
        }
      });

      const validJudgeCount = judgeRawValues.length;
      const sum = judgeRawValues.reduce((a, b) => a + b, 0);
      
      // Calculate Average (which is already scaled to 100 because judgeRawValues are scaled)
      const finalAvg = validJudgeCount > 0 ? sum / validJudgeCount : 0;
      
      return {
        participant: team,
        judgeScores: judgeTotals,
        judgeRequests: judgeRequests,
        finalAverage: parseFloat(finalAvg.toFixed(2)),
        variance: 0,
      };
    });

    calculatedMatrix.sort((a, b) => b.finalAverage - a.finalAverage);
    setMatrix(calculatedMatrix);
  }, [participants, judges, scores, criteria, loading]);

  // 3. Handle Actions
  const handleUnlockScore = async () => {
    if (!selectedCell) return;
    const { error } = await supabase
        .from('scores')
        .update({ is_locked: false, unlock_request: false }) 
        .eq('judge_id', selectedCell.judge.judge_id)
        .eq('participant_id', selectedCell.participant.participant_id);

    if (error) alert('Error unlocking: ' + error.message);
    else {
        setSelectedCell(null);
        fetchData();
    }
  };

  const handleDeleteScore = async () => {
    if (!selectedCell) return;
    if (!confirm(`Permanently delete scores for ${selectedCell.participant.real_name}?`)) return;
    const { error } = await supabase
        .from('scores')
        .delete()
        .eq('judge_id', selectedCell.judge.judge_id)
        .eq('participant_id', selectedCell.participant.participant_id);

    if (error) alert('Error deleting: ' + error.message);
    else {
        setSelectedCell(null);
        fetchData();
    }
  };

  // 4. Handle Cell Click (Breakdown Modal)
  const handleCellClick = (judge: Judge, participant: Participant, totalScore: number) => {
     let requestActive = false;
     let lockedState = false;
     
     // Note: Breakdown values here are raw (1-10) from database
     const breakdown = criteria.map(c => {
         const s = scores.find(s => s.judge_id === judge.judge_id && s.participant_id === participant.participant_id && s.criteria_id === c.criteria_id);
         if (s?.unlock_request) requestActive = true;
         if (s?.is_locked) lockedState = true;
         return { name: c.name, value: s ? s.score_value : 0 };
     });
     
     setSelectedCell({ 
         judge, 
         participant, 
         scoreTotal: totalScore, // This will be the scaled (out of 100) score passed from the clicked cell
         breakdown, 
         hasRequest: requestActive,
         isLocked: lockedState
    });
  };

  const handleExport = () => {
    generateExpoExcel(matrix, judges, criteria, scores, "Detailed_Results");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050b14] flex flex-col items-center justify-center text-cyan-500">
        <div className="animate-spin mb-4"><RefreshCcw size={32} /></div>
        <div className="font-mono text-sm tracking-widest uppercase">Initializing System...</div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#050b14] text-white font-sans selection:bg-cyan-500 selection:text-black overflow-hidden relative">
      
      {/* HEADER */}
      <div className="flex-none p-6 bg-[#050b14]/80 backdrop-blur-md border-b border-white/10 z-20 sticky top-0">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
                <BarChart3 className="text-cyan-400" size={28} />
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">LIVE TABULATION</h1>
            </div>
            <p className="text-slate-400 font-mono text-xs mt-1 tracking-widest flex items-center gap-2">
                SYSTEM ACTIVE 
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
            </p>
          </div>
          <div className="flex gap-3">
              <button onClick={() => fetchData()} className="flex items-center gap-2 px-4 py-2 border border-white/10 hover:border-cyan-500/50 rounded-lg hover:bg-cyan-500/10 font-bold text-slate-300 hover:text-cyan-400 transition-all text-sm uppercase tracking-wider">
                  <RefreshCcw size={16} /> Refresh
              </button>
              <button onClick={handleExport} className="group flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all font-bold text-sm uppercase tracking-wider">
                  <Download size={16} className="group-hover:translate-y-0.5 transition-transform" /> Detailed Export
              </button>
          </div>
        </div>
      </div>

      {/* MATRIX TABLE CONTAINER */}
      <div className="flex-1 overflow-auto p-4 md:p-8 z-10 custom-scrollbar">
        <div className="max-w-[1920px] mx-auto border border-white/10 rounded-xl shadow-2xl bg-[#0f172a]/40 backdrop-blur-sm overflow-hidden relative">
          
          <table className="text-sm text-left border-collapse w-full">
            <thead className="text-xs text-cyan-400 uppercase bg-[#0f172a] sticky top-0 z-40">
              <tr>
                <th className="px-4 py-4 sticky left-0 bg-[#0f172a] z-50 border-b border-white/10 w-[80px] text-center font-black tracking-widest border-r border-white/5">Rank</th>
                <th className="px-6 py-4 sticky left-[80px] bg-[#0f172a] z-50 border-b border-white/10 shadow-[4px_0_15px_-5px_rgba(0,0,0,0.5)] min-w-[300px] font-black tracking-widest border-r border-white/5">Team Identifier</th>
                {judges.map((j) => (
                  <th key={j.judge_id} className="px-4 py-3 text-center border-b border-white/10 border-r border-white/5 min-w-[140px] whitespace-nowrap bg-[#0f172a]">
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-slate-300 max-w-[120px] truncate">{j.name}</span>
                        <span className="text-[10px] text-slate-600 font-mono mt-0.5">JUDGE ID: {j.judge_id}</span>
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-right bg-cyan-950/30 text-cyan-400 font-black border-b border-white/10 min-w-[120px] sticky right-0 z-40 backdrop-blur-md">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {matrix.map((row, index) => (
                <tr key={row.participant.participant_id} className={`group hover:bg-white/5 transition-colors ${index === 0 ? 'bg-cyan-950/20' : ''}`}>
                  
                  {/* RANK */}
                  <td className="px-4 py-4 font-black text-center sticky left-0 bg-[#050b14] group-hover:bg-[#0f172a] z-30 border-r border-white/5 transition-colors">
                    {index === 0 ? (
                        <div className="flex flex-col items-center animate-in zoom-in duration-500">
                            <Trophy className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" size={24} />
                            <span className="text-[10px] text-yellow-400 font-black tracking-widest mt-1">WINNER</span>
                        </div>
                    ) : index === 1 ? (
                        <div className="flex flex-col items-center opacity-80">
                            <Medal className="text-slate-300" size={20} />
                            <span className="text-[10px] text-slate-300 font-bold mt-1">2ND</span>
                        </div>
                    ) : index === 2 ? (
                        <div className="flex flex-col items-center opacity-80">
                            <Medal className="text-amber-700" size={20} />
                            <span className="text-[10px] text-amber-700 font-bold mt-1">3RD</span>
                        </div>
                    ) : (
                        <span className="text-slate-600 text-lg">#{index + 1}</span>
                    )}
                  </td>

                  {/* TEAM INFO */}
                  <td className="px-6 py-4 sticky left-[80px] bg-[#050b14] group-hover:bg-[#0f172a] z-30 shadow-[4px_0_15px_-5px_rgba(0,0,0,0.5)] border-r border-white/5 transition-colors">
                      <div className="flex items-center justify-between">
                          <div>
                            <div className={`font-bold text-base transition-colors ${index === 0 ? 'text-yellow-400' : 'text-white group-hover:text-cyan-200'}`}>
                                {row.participant.real_name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-2">
                                <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{row.participant.booth_code}</span>
                                {row.participant.alias && <span className="text-slate-600">// {row.participant.alias}</span>}
                            </div>
                          </div>
                      </div>
                  </td>

                  {/* JUDGE SCORES */}
                  {judges.map((j) => {
                    const score = row.judgeScores[j.judge_id];
                    const hasRequest = row.judgeRequests?.[j.judge_id];
                    
                    return (
                      <td 
                        key={j.judge_id} 
                        className={`px-4 py-4 text-center border-r border-white/5 cursor-pointer transition-all duration-300 ${hasRequest ? 'bg-amber-900/20 hover:bg-amber-900/40' : 'hover:bg-cyan-500/10'}`}
                        onClick={() => score && handleCellClick(j, row.participant, score)}
                      >
                        {score ? (
                          <div className="flex items-center justify-center gap-1 relative">
                              {hasRequest && <Clock size={12} className="text-amber-500 absolute -top-3 -right-2 animate-bounce" />}
                              <span className={`font-mono font-bold text-lg ${hasRequest ? 'text-amber-400' : 'text-white'}`}>
                                {score}
                              </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-700 font-mono">--</span>
                        )}
                      </td>
                    );
                  })}

                  {/* FINAL SCORE */}
                  <td className="px-6 py-4 text-right font-black text-2xl bg-[#050b14] group-hover:bg-[#0f172a] text-cyan-400 sticky right-0 z-20 shadow-[-4px_0_15px_-5px_rgba(0,0,0,0.5)] transition-colors border-l border-white/10">
                    {index === 0 && <span className="text-yellow-400 mr-2 text-sm font-normal align-middle">★</span>}
                    {row.finalAverage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GLASSMORPHIC ACTION MODAL */}
      {selectedCell && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-[#0f172a] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-sm w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                  
                  {/* Modal Header */}
                  <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-cyan-400">
                        <Zap size={18} />
                        <h3 className="font-bold uppercase tracking-wider text-sm">Score Audit Log</h3>
                      </div>
                      <button onClick={() => setSelectedCell(null)} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
                  </div>

                  <div className="p-6 space-y-6">
                      
                      {selectedCell.hasRequest && (
                          <div className="bg-amber-500/10 border border-amber-500/50 text-amber-200 p-3 rounded-lg flex items-start gap-3 text-xs font-bold uppercase tracking-wide">
                              <Clock size={18} className="shrink-0 text-amber-500 animate-pulse" />
                              <p>Judge requests unlock permission.</p>
                          </div>
                      )}

                      <div className="text-center space-y-1">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Judge Identifier</div>
                          <div className="font-black text-xl text-white">{selectedCell.judge.name}</div>
                      </div>
                      
                      {/* Breakdown List */}
                      <div className="bg-black/30 rounded-xl p-4 space-y-3 border border-white/5">
                          {selectedCell.breakdown.map((b, i) => (
                              <div key={i} className="flex justify-between text-sm items-center">
                                  <span className="text-slate-400 font-medium">{b.name}</span>
                                  {/* Showing RAW Score (1-10) in breakdown as requested */}
                                  <span className="font-mono font-bold text-cyan-300">{b.value}</span>
                              </div>
                          ))}
                          <div className="border-t border-white/10 pt-3 flex justify-between font-black text-white text-lg">
                              <span>TOTAL (Scaled)</span>
                              <span className="text-cyan-400">{selectedCell.scoreTotal}</span>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                          {/* APPROVE BUTTON */}
                          {selectedCell.isLocked && (
                              <button 
                                onClick={handleUnlockScore}
                                className="w-full bg-cyan-600/20 border border-cyan-500/50 text-cyan-400 py-3 rounded-xl font-bold hover:bg-cyan-500 hover:text-black transition-all flex items-center justify-center gap-2 uppercase text-sm tracking-wider"
                              >
                                  <Unlock size={16} /> 
                                  {selectedCell.hasRequest ? "Grant Unlock" : "Force Unlock"}
                              </button>
                          )}

                          <button 
                            onClick={handleDeleteScore}
                            className="w-full bg-red-500/10 border border-red-500/30 text-red-400 py-3 rounded-xl font-bold hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 uppercase text-sm tracking-wider"
                          >
                              <Trash2 size={16} /> Delete Entry
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
