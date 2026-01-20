// DIRECTORY LOCATION: app/(admin)/admin/users/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { UserPlus, Trash2, Shield, Key } from 'lucide-react';
import type { Judge, Competition } from '@/types/expo';

export default function UsersPage() {
  const supabase = createClient();
  
  // State
  const [judges, setJudges] = useState<Judge[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<number>(0);

  // 1. Fetch Data
  const fetchData = async () => {
    setLoading(true);
    const { data: cData } = await supabase.from('competitions').select('*');
    const { data: jData } = await supabase.from('judges').select('*').order('competition_id');
    
    if (cData) {
        setCompetitions(cData);
        // Default to first track if available
        if (cData.length > 0 && selectedTrack === 0) setSelectedTrack(cData[0].competition_id);
    }
    if (jData) setJudges(jData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // 2. Create Judge
  const handleAddJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPin || !selectedTrack) return;

    const { error } = await supabase.from('judges').insert({
        name: newName,
        pin_code: newPin,
        competition_id: selectedTrack
    });

    if (error) alert(error.message);
    else {
        setNewName('');
        setNewPin('');
        fetchData(); // Refresh list
    }
  };

  // 3. Delete Judge
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this judge?')) return;
    await supabase.from('judges').delete().eq('judge_id', id);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT: Create Form */}
        <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-6 text-blue-600">
            <UserPlus size={24} />
            <h2 className="text-xl font-bold">Add Judge</h2>
          </div>
          
          <form onSubmit={handleAddJudge} className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input 
                    className="w-full p-3 bg-slate-50 border rounded-lg" 
                    placeholder="e.g. Dr. Jane Doe"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    required
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign PIN</label>
                <div className="relative">
                    <Key className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input 
                        className="w-full pl-10 p-3 bg-slate-50 border rounded-lg font-mono tracking-widest" 
                        placeholder="000000"
                        maxLength={6}
                        value={newPin}
                        onChange={e => setNewPin(e.target.value)}
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign to Track</label>
                <select 
                    className="w-full p-3 bg-slate-50 border rounded-lg"
                    value={selectedTrack}
                    onChange={e => setSelectedTrack(Number(e.target.value))}
                >
                    {competitions.map(c => (
                        <option key={c.competition_id} value={c.competition_id}>
                            {c.title}
                        </option>
                    ))}
                </select>
            </div>

            <button className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">
                Create Account
            </button>
          </form>
        </div>

        {/* RIGHT: List */}
        <div className="md:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Judge Roster</h2>
            
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4 font-bold text-slate-500">Name</th>
                            <th className="p-4 font-bold text-slate-500">Assigned Track</th>
                            <th className="p-4 font-bold text-slate-500">PIN</th>
                            <th className="p-4 font-bold text-slate-500 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {judges.map(judge => {
                            const trackName = competitions.find(c => c.competition_id === judge.competition_id)?.title || 'Unknown';
                            return (
                                <tr key={judge.judge_id} className="border-b last:border-0 hover:bg-slate-50">
                                    <td className="p-4 font-bold text-slate-900 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                            {judge.name.charAt(0)}
                                        </div>
                                        {judge.name}
                                    </td>
                                    <td className="p-4 text-slate-500">{trackName}</td>
                                    <td className="p-4 font-mono bg-slate-50 w-fit rounded">{judge.pin_code}</td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleDelete(judge.judge_id)}
                                            className="text-red-400 hover:text-red-600 p-2"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                
                {judges.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic">No judges added yet.</div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}