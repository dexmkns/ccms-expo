'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { 
  Trophy, 
  Users, 
  Gavel, 
  ArrowRight, 
  Activity, 
  Plus, 
  PlayCircle, 
  StopCircle, 
  PauseCircle, 
  Trash2, 
  Eye, 
  EyeOff,
  Settings,
  LogOut // Import LogOut icon
} from 'lucide-react';

// Types (ensure this matches your database)
interface Competition {
  competition_id: number;
  title: string;
  status: 'setup' | 'live' | 'ended';
  reveal_names: boolean;
}

export default function AdminDashboard() {
  const supabase = createClient();
  const router = useRouter();
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  // --- 1. FETCH DATA ---
  const fetchCompetitions = async () => {
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .order('competition_id', { ascending: true });
      
    if (data) setCompetitions(data);
    setLoading(false);
  };

  useEffect(() => { fetchCompetitions(); }, []);

  // --- 2. ACTIONS ---

  // Handle Logout
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert('Error logging out');
    } else {
      router.push('/login'); // Redirect to login
      router.refresh();      // Clear local cache to force middleware check
    }
  };

  // Handle Status Change
  const handleStatusChange = async (id: number, newStatus: 'setup' | 'live' | 'ended', e: React.MouseEvent) => {
    e.preventDefault();
    setCompetitions(prev => prev.map(c => c.competition_id === id ? { ...c, status: newStatus } : c));
    await supabase.from('competitions').update({ status: newStatus }).eq('competition_id', id);
  };

  // Handle Name Reveal Toggle
  const toggleReveal = async (id: number, currentStatus: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    // Optimistic UI Update
    setCompetitions(prev => prev.map(c => 
      c.competition_id === id ? { ...c, reveal_names: !currentStatus } : c
    ));
    // Database Update
    await supabase.from('competitions').update({ reveal_names: !currentStatus }).eq('competition_id', id);
  };

  // Handle Delete Event
  const handleDeleteEvent = async (id: number, title: string, e: React.MouseEvent) => {
    e.preventDefault();
    const confirmed = confirm(`DELETE WARNING:\n\nAre you sure you want to delete "${title}"?\n\nThis will permanently delete ALL:\n- Judges\n- Scores\n- Participants\nassociated with this track.\n\nThis action cannot be undone.`);
    
    if (confirmed) {
        setCompetitions(prev => prev.filter(c => c.competition_id !== id));
        const { error } = await supabase.from('competitions').delete().eq('competition_id', id);
        if (error) {
            alert("Error deleting: " + error.message);
            fetchCompetitions(); // Revert on error
        }
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading Command Center...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">CCMS Expo Command Center</h1>
            <p className="text-slate-500 mt-2">Select an event track to monitor scoring and tabulation.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
             <Link href="/admin/participants" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-colors shadow-sm"><Users size={18} /> Teams</Link>
             <Link href="/admin/users" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-blue-50 hover:text-blue-600 transition-colors shadow-sm"><Gavel size={18} /> Judges</Link>
             <Link href="/admin/events" className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-md"><Plus size={18} /> New Track</Link>
             
             {/* SEPARATOR */}
             <div className="h-8 w-px bg-slate-300 mx-2"></div>

             {/* LOGOUT BUTTON */}
             <button 
               onClick={handleLogout}
               className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-colors shadow-sm"
               title="Sign Out"
             >
               <LogOut size={18} /> Logout
             </button>
          </div>
        </div>

        {/* --- TRACK GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {competitions.map((comp) => (
            <Link 
              href={`/admin/tabulation/${comp.competition_id}`} 
              key={comp.competition_id}
              className="group relative bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 block"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Trophy size={32} />
                </div>
                
                <div className="flex gap-2">
                    {/* CONTROLS CONTAINER */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100" onClick={(e) => e.preventDefault()}>
                        
                        {/* Status Buttons */}
                        <button onClick={(e) => handleStatusChange(comp.competition_id, 'setup', e)} className={`p-1.5 rounded-md transition-colors ${comp.status === 'setup' ? 'bg-white shadow text-slate-700' : 'text-slate-300 hover:text-slate-500'}`} title="Set to Setup Mode"><PauseCircle size={16} /></button>
                        <button onClick={(e) => handleStatusChange(comp.competition_id, 'live', e)} className={`p-1.5 rounded-md transition-colors ${comp.status === 'live' ? 'bg-green-100 text-green-700 shadow' : 'text-slate-300 hover:text-green-500'}`} title="Set to LIVE Mode"><PlayCircle size={16} /></button>
                        <button onClick={(e) => handleStatusChange(comp.competition_id, 'ended', e)} className={`p-1.5 rounded-md transition-colors ${comp.status === 'ended' ? 'bg-red-100 text-red-700 shadow' : 'text-slate-300 hover:text-red-500'}`} title="End Event"><StopCircle size={16} /></button>
                        
                        {/* SEPARATOR */}
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>

                        {/* REVEAL TOGGLE BUTTON */}
                        <button 
                            onClick={(e) => toggleReveal(comp.competition_id, comp.reveal_names, e)}
                            className={`p-1.5 rounded-md transition-colors ${
                                comp.reveal_names 
                                ? 'bg-indigo-100 text-indigo-700 shadow border border-indigo-200' 
                                : 'text-slate-400 hover:text-indigo-600'
                            }`}
                            title={comp.reveal_names ? "Public sees REAL NAMES" : "Public sees ALIASES"}
                        >
                            {comp.reveal_names ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>

                        {/* EDIT BUTTON (Settings) */}
                        <button 
                            onClick={(e) => {
                                e.preventDefault(); 
                                router.push(`/admin/events/${comp.competition_id}`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md transition-colors hover:bg-indigo-50"
                            title="Edit Criteria & Description"
                        >
                            <Settings size={16} />
                        </button>

                    </div>

                    {/* DELETE BUTTON */}
                    <button 
                        onClick={(e) => handleDeleteEvent(comp.competition_id, comp.title, e)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Delete Event"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{comp.title}</h2>
              
              <div className="flex items-center gap-2 mb-8">
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${comp.status === 'live' ? 'bg-green-50 border-green-200 text-green-700' : comp.status === 'ended' ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  {comp.status === 'live' ? '● LIVE VOTING' : comp.status}
                </span>
                {comp.reveal_names && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-indigo-50 border-indigo-200 text-indigo-700">
                        Names Visible
                    </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-6 text-sm font-medium text-slate-500">
                <span className="flex items-center gap-1 text-blue-600 font-bold group-hover:translate-x-1 transition-transform">
                    Open Tabulation <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          ))}
          
          {competitions.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
                <Activity size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium text-lg">No active competitions found.</p>
                <p className="text-sm text-slate-400 mt-2">Click "New Track" above to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}