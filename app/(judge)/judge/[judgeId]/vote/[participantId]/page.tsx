'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation'; // useParams gets BOTH IDs now
import { createClient } from '@/lib/supabase';
import { Save, ArrowLeft, Lock } from 'lucide-react';
import type { Participant, Criteria } from '@/types/expo';

export default function VotingPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  // Get both IDs from the URL
  const participantId = params.participantId as string;
  const judgeId = params.judgeId as string; // Matches folder [judgeId]

  // State
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [votes, setVotes] = useState<Record<number, number>>({}); 
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [competitionStatus, setCompetitionStatus] = useState<'setup' | 'live' | 'ended'>('setup');

  // 1. Load Data
  useEffect(() => {
    const loadForm = async () => {
        if (!participantId || !judgeId) return;

        // Fetch Participant
        const { data: pData } = await supabase
            .from('participants')
            .select('*')
            .eq('participant_id', participantId)
            .single();

        if (pData) {
            setParticipant(pData);
            
            // Fetch Competition Status
            const { data: cStatus } = await supabase
                .from('competitions')
                .select('status')
                .eq('competition_id', pData.competition_id)
                .single();
            
            if (cStatus) {
                setCompetitionStatus(cStatus.status);
            }

            // Fetch Criteria
            const { data: cData } = await supabase
                .from('criteria')
                .select('*')
                .eq('competition_id', pData.competition_id)
                .order('criteria_id');
            
            if (cData) setCriteria(cData);

            // Fetch Existing Scores (Using URL judgeId instead of localStorage)
            const { data: existingScores } = await supabase
                .from('scores')
                .select('criteria_id, score_value')
                .eq('judge_id', judgeId) // <--- UPDATED
                .eq('participant_id', participantId);
            
            if (existingScores && existingScores.length > 0) {
                const loadedVotes: Record<number, number> = {};
                existingScores.forEach(s => {
                    loadedVotes[s.criteria_id] = s.score_value;
                });
                setVotes(loadedVotes);
            }
        }
        setLoading(false);
    };
    loadForm();
  }, [participantId, judgeId, supabase]);

  // 2. Handle Score Change
  const handleScoreChange = (criteriaId: number, value: number) => {
    if (competitionStatus !== 'live') return;
    const clamped = Math.min(100, Math.max(0, value));
    setVotes(prev => ({ ...prev, [criteriaId]: clamped }));
  };

  const handleLikertChange = (criteriaId: number, scale: number) => {
    if (competitionStatus !== 'live') return;
    const score = scale * 20; 
    setVotes(prev => ({ ...prev, [criteriaId]: score }));
  };

  // 3. Submit Scores
  const handleSubmit = async () => {
    if (!participant) return;
    
    if (competitionStatus !== 'live') {
        alert("Voting is currently closed for this event.");
        return;
    }

    setSubmitting(true);

    // Using URL judgeId instead of localStorage
    if (!judgeId) {
        alert("Session Error: Missing Judge ID.");
        router.push('/login');
        return;
    }

    const payload = criteria.map(crit => ({
        competition_id: participant.competition_id,
        judge_id: parseInt(judgeId), // <--- UPDATED
        participant_id: participant.participant_id,
        criteria_id: crit.criteria_id,
        score_value: votes[crit.criteria_id] || 0,
    }));

    const { error } = await supabase
        .from('scores')
        .upsert(payload, { onConflict: 'judge_id, participant_id, criteria_id' });

    if (error) {
        alert('Error saving score: ' + error.message);
        setSubmitting(false);
    } else {
        // Redirect back to the specific dashboard
        router.push(`/judge/${judgeId}/dashboard`); // <--- UPDATED
    }
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-800">Loading Ballot...</div>;
  if (!participant) return <div className="p-10 text-center font-bold text-red-600">Participant not found</div>;

  const currentTotal = criteria.reduce((acc, crit) => {
    const score = votes[crit.criteria_id] || 0;
    return acc + (score * (crit.weight_percentage / 100));
  }, 0);

  const isReadOnly = competitionStatus !== 'live';

  return (
    <div className="min-h-screen bg-slate-100 pb-24 text-slate-900">
      
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-300 px-4 py-4 sticky top-0 z-10 flex items-center justify-between shadow-sm">
        <button onClick={() => router.back()} className="text-slate-800 hover:bg-slate-100 p-2 rounded-full border border-transparent hover:border-slate-300">
            <ArrowLeft size={24} />
        </button>
        <div className="text-center">
            <h1 className="font-black text-slate-900 text-sm uppercase tracking-wide">Evaluating</h1>
            <div className="text-xs font-bold font-mono text-slate-900 bg-white border border-slate-400 px-3 py-1 rounded inline-block mt-1">
                {participant.booth_code}
            </div>
        </div>
        <div className="w-8"></div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        
        {/* Status Banner */}
        {isReadOnly && (
            <div className="bg-red-100 border-2 border-red-500 text-red-900 px-4 py-4 rounded-xl flex items-center gap-3 shadow-sm">
                <Lock className="shrink-0" size={24} />
                <div>
                    <h3 className="font-black text-lg uppercase">Voting Locked</h3>
                    <p className="text-sm font-medium leading-tight">
                        This event is currently <span className="underline decoration-2">{competitionStatus === 'setup' ? 'in Setup' : 'Ended'}</span>. Scores cannot be submitted.
                    </p>
                </div>
            </div>
        )}
        
        {/* Header Info */}
        <div className="text-center space-y-2 mt-4">
            <h2 className="text-3xl font-black text-black leading-tight">
                {participant.real_name}
            </h2>
            <p className="text-slate-700 font-bold text-base">{participant.alias}</p>
        </div>

        {/* Scoring Cards */}
        <div className={`space-y-4 ${isReadOnly ? 'opacity-70 pointer-events-none grayscale-[0.5]' : ''}`}>
            {criteria.map((crit) => {
                const currentScore = votes[crit.criteria_id] || 0;

                return (
                    <div key={crit.criteria_id} className="bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-300">
                        
                        {/* HEADER: Name & Description */}
                        <div className="flex justify-between items-start mb-5 gap-3">
                            <div>
                                <label className="font-bold text-black text-lg block leading-tight">
                                    {crit.name}
                                </label>
                                {crit.description && (
                                    <p className="text-slate-500 text-sm mt-1.5 leading-relaxed font-medium">
                                        {crit.description}
                                    </p>
                                )}
                            </div>
                            <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2 py-1 rounded-full border border-blue-200 shrink-0 mt-0.5">
                                {crit.weight_percentage}%
                            </span>
                        </div>

                        {crit.type === 'likert' ? (
                            // LIKERT SCALE
                            <div className="flex justify-between gap-2">
                                {[1, 2, 3, 4, 5].map((scale) => {
                                    const isActive = (currentScore / 20) === scale;
                                    return (
                                        <button
                                            key={scale}
                                            onClick={() => handleLikertChange(crit.criteria_id, scale)}
                                            disabled={isReadOnly}
                                            className={`flex-1 h-12 rounded-lg font-bold text-xl transition-all border-2 ${
                                                isActive 
                                                ? 'bg-blue-700 text-white border-blue-900 shadow-md scale-105' 
                                                : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100 hover:border-slate-500'
                                            }`}
                                        >
                                            {scale}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            // SLIDER + TYPING
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    step="1"
                                    disabled={isReadOnly}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-700 border border-slate-300"
                                    value={currentScore}
                                    onChange={(e) => handleScoreChange(crit.criteria_id, parseInt(e.target.value) || 0)}
                                />
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    disabled={isReadOnly}
                                    className="w-16 h-12 text-center bg-white text-black font-black text-lg rounded-lg shrink-0 border-2 border-slate-400 focus:outline-none focus:border-blue-600 shadow-sm"
                                    value={currentScore}
                                    onChange={(e) => handleScoreChange(crit.criteria_id, parseInt(e.target.value) || 0)}
                                />
                            </div>
                        )}

                        <div className="flex justify-between text-xs font-black text-slate-900 mt-2 px-1 uppercase tracking-wide">
                            <span>Poor (0)</span>
                            <span>Excellent (100)</span>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-200 p-4 pb-6 safe-area-bottom shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
            <div className="text-sm">
                <span className="text-slate-600 font-bold block text-xs uppercase tracking-wider">Weighted Total</span>
                <span className="text-4xl font-black text-slate-900">{currentTotal.toFixed(1)}</span>
            </div>
            
            <button 
                onClick={handleSubmit}
                disabled={submitting || isReadOnly}
                className={`px-6 py-4 rounded-xl font-bold flex items-center gap-2 shadow-xl w-full justify-center transition-all ${
                    isReadOnly 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed border-2 border-slate-300' 
                    : 'bg-slate-900 text-white hover:bg-black hover:scale-105'
                }`}
            >
                {submitting ? 'Saving...' : (
                    <>
                        {isReadOnly ? <Lock size={20} /> : <Save size={20} />}
                        {isReadOnly ? 'Voting Locked' : 'Submit Final'}
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
}