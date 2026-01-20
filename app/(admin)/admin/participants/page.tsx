'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Users, Trash2, Plus, MonitorPlay, Dices, Pencil, Save, X, RefreshCw } from 'lucide-react';
import type { Participant, Competition } from '@/types/expo';

export default function ParticipantsPage() {
  const supabase = createClient();
  
  // State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Form State
  const [realName, setRealName] = useState(''); 
  const [alias, setAlias] = useState('');       
  const [boothCode, setBoothCode] = useState(''); 
  
  // Edit Mode State
  const [editingId, setEditingId] = useState<number | null>(null);

  // 1. Fetch Tracks
  useEffect(() => {
    const fetchTracks = async () => {
      const { data } = await supabase.from('competitions').select('*').order('competition_id');
      if (data && data.length > 0) {
        setCompetitions(data);
        setSelectedTrack(data[0].competition_id); 
      }
      setLoading(false);
    };
    fetchTracks();
  }, []);

  // 2. Fetch Participants when Track Changes
  useEffect(() => {
    if (!selectedTrack) return;
    fetchParticipants();
  }, [selectedTrack]);

  const fetchParticipants = async () => {
    const { data } = await supabase
      .from('participants')
      .select('*')
      .eq('competition_id', selectedTrack)
      .order('booth_code');
    
    if (data) setParticipants(data);
  };

  // --- NEW: BULK RANDOMIZE EXISTING ROSTER ---
  const randomizeRosterAliases = async () => {
    if (participants.length === 0) return;
    
    // Safety Check
    const confirmed = confirm(
        `⚠ WARNING: This will OVERWRITE the Aliases for all ${participants.length} teams in this list.\n\n` +
        `Real Names and Booth Codes will stay the same.\n` +
        `Are you sure you want to regenerate random aliases?`
    );
    if (!confirmed) return;

    setLoading(true);

    const prefixes = ['Neon', 'Cyber', 'Iron', 'Shadow', 'Crimson', 'Azure', 'Golden', 'Electric', 'Quantum', 'Hyper'];
    const nouns = ['Tiger', 'Eagle', 'Falcon', 'Wolf', 'Phoenix', 'Dragon', 'Viper', 'Storm', 'Glitch', 'Spark'];

    // 1. Generate new data
    const updates = participants.map(p => {
        const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNumber = Math.floor(Math.random() * 99) + 1;
        
        return {
            ...p, // Keep all other data (ID, Real Name, Booth) same
            alias: `Team ${randomPrefix}${randomNoun}-${randomNumber}`
        };
    });

    // 2. Optimistic Update (Update UI immediately)
    setParticipants(updates);

    // 3. Database Update (Bulk Upsert)
    const { error } = await supabase
        .from('participants')
        .upsert(updates);

    if (error) {
        alert("Failed to update aliases: " + error.message);
        fetchParticipants(); // Revert if failed
    }

    setLoading(false);
  };

  // --- FORM RANDOMIZER (Helper for adding new teams) ---
  const generateRandomFormData = () => {
    const prefixes = ['Neon', 'Cyber', 'Iron', 'Shadow', 'Crimson', 'Azure', 'Golden', 'Electric', 'Quantum', 'Hyper'];
    const nouns = ['Tiger', 'Eagle', 'Falcon', 'Wolf', 'Phoenix', 'Dragon', 'Viper', 'Storm', 'Glitch', 'Spark'];
    
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 99) + 1;
    
    setAlias(`Team ${randomPrefix}${randomNoun}-${randomNumber}`);
  };

  // 4. Create or Update Participant
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!realName || !boothCode) return;

    if (editingId) {
        // --- UPDATE MODE ---
        const { error } = await supabase
            .from('participants')
            .update({
                real_name: realName,
                alias: alias,
                booth_code: boothCode.toUpperCase(),
                competition_id: selectedTrack 
            })
            .eq('participant_id', editingId);

        if (error) alert('Error: ' + error.message);
        else {
            setEditingId(null);
            resetForm();
            fetchParticipants();
        }
    } else {
        // --- CREATE MODE ---
        const { error } = await supabase.from('participants').insert({
            competition_id: selectedTrack,
            real_name: realName,
            alias: alias,
            booth_code: boothCode.toUpperCase()
        });

        if (error) alert('Error: ' + error.message);
        else {
            resetForm();
            fetchParticipants();
        }
    }
  };

  // 5. Delete Participant
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure? This will delete all scores associated with this team.')) return;
    
    await supabase.from('participants').delete().eq('participant_id', id);
    setParticipants(prev => prev.filter(p => p.participant_id !== id));
    
    if (editingId === id) {
        setEditingId(null);
        resetForm();
    }
  };

  // 6. Helpers
  const startEdit = (p: Participant) => {
      setEditingId(p.participant_id);
      setRealName(p.real_name);
      setAlias(p.alias || '');
      setBoothCode(p.booth_code);
      if(p.competition_id !== selectedTrack) setSelectedTrack(p.competition_id);
  };

  const cancelEdit = () => {
      setEditingId(null);
      resetForm();
  };

  const resetForm = () => {
      setRealName('');
      setAlias('');
      setBoothCode('');
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT: Add/Edit Form */}
        <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm h-fit sticky top-8">
          <div className="flex items-center justify-between mb-6">
            <div className={`flex items-center gap-2 ${editingId ? 'text-amber-600' : 'text-indigo-600'}`}>
                {editingId ? <Pencil size={24} /> : <Users size={24} />}
                <h2 className="text-xl font-bold">{editingId ? 'Edit Team' : 'Add Team'}</h2>
            </div>
            {editingId && (
                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600" title="Cancel Edit">
                    <X size={20} />
                </button>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Event Track</label>
            <select 
                className="w-full p-3 bg-slate-100 border-none rounded-lg font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                value={selectedTrack}
                onChange={(e) => setSelectedTrack(Number(e.target.value))}
            >
                {competitions.map(c => (
                <option key={c.competition_id} value={c.competition_id}>{c.title}</option>
                ))}
            </select>
          </div>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Title</label>
                <input 
                    className="w-full p-3 bg-slate-50 border rounded-lg focus:border-indigo-500 focus:outline-none" 
                    placeholder="e.g. Automated Hydroponics"
                    value={realName}
                    onChange={e => setRealName(e.target.value)}
                    required
                />
            </div>

            <div>
                <div className="flex justify-between items-end mb-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Team Alias (Optional)</label>
                    <button 
                        type="button"
                        onClick={generateRandomFormData}
                        className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
                        title="Generate one random alias for this form"
                    >
                        <Dices size={14} /> Random
                    </button>
                </div>
                
                <input 
                    className="w-full p-3 bg-slate-50 border rounded-lg focus:border-indigo-500 focus:outline-none" 
                    placeholder="e.g. Team CyberWolf-01"
                    value={alias}
                    onChange={e => setAlias(e.target.value)}
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Booth Code</label>
                <div className="relative">
                    <MonitorPlay className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input 
                        className="w-full pl-10 p-3 bg-slate-50 border rounded-lg font-mono font-bold uppercase focus:border-indigo-500 focus:outline-none" 
                        placeholder="GAME-01"
                        value={boothCode}
                        onChange={e => setBoothCode(e.target.value)}
                        required
                    />
                </div>
            </div>

            <button 
                className={`w-full text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg ${
                    editingId 
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                }`}
            >
                {editingId ? <><Save size={18} /> Save Changes</> : <><Plus size={18} /> Add Participant</>}
            </button>
          </form>
        </div>

        {/* RIGHT: List */}
        <div className="md:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-800">
                        {competitions.find(c => c.competition_id === selectedTrack)?.title} Roster
                    </h2>
                    <span className="text-sm font-bold bg-slate-200 px-3 py-1 rounded-full text-slate-600">
                        {participants.length}
                    </span>
                </div>

                {/* --- NEW BUTTON: REGENERATE ALL ALIASES --- */}
                {participants.length > 0 && (
                    <button 
                        onClick={randomizeRosterAliases}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 rounded-lg text-sm font-bold transition-all shadow-sm"
                        title="Assign new random aliases to everyone in this list"
                    >
                        <RefreshCw size={16} /> Regenerate All Aliases
                    </button>
                )}
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4 font-bold text-slate-500">Booth Code</th>
                            <th className="p-4 font-bold text-slate-500">Project / Team</th>
                            <th className="p-4 font-bold text-slate-500 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {participants.map(p => (
                            <tr key={p.participant_id} className={`border-b last:border-0 transition-colors ${editingId === p.participant_id ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                                <td className="p-4">
                                    <span className="font-mono font-bold bg-slate-100 px-2 py-1 rounded text-slate-700">
                                        {p.booth_code}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="font-bold text-slate-900">{p.real_name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <span className="text-slate-400">Alias:</span> 
                                        <span className="font-mono text-indigo-600 font-medium">{p.alias || 'None'}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button 
                                        onClick={() => startEdit(p)}
                                        className="text-slate-400 hover:text-amber-600 p-2 transition-colors bg-slate-50 rounded-lg hover:bg-amber-100"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(p.participant_id)}
                                        className="text-slate-400 hover:text-red-600 p-2 transition-colors bg-slate-50 rounded-lg hover:bg-red-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {participants.length === 0 && (
                    <div className="p-12 text-center text-slate-400 border-dashed border-2 border-slate-100 m-4 rounded-xl">
                        No participants added to this track yet.
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}