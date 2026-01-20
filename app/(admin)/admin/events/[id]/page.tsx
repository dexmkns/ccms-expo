'use client';

import { useEffect, useState, use } from 'react'; // 1. Import 'use'
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Plus, X, Layers, Save, Loader2, ArrowLeft } from 'lucide-react';

// Update the props type to be a Promise
export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  // 2. Unwrap the params using 'use()'
  const { id } = use(params);
  const eventId = id; 

  const supabase = createClient();
  const router = useRouter();

  // State
  const [title, setTitle] = useState('');
  // Added description to state type
  const [criteriaList, setCriteriaList] = useState<{criteria_id?: number, name: string, weight: string, description: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1. FETCH DATA ON LOAD
  useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId) return; // Wait for ID

      // Get Event Details
      const { data: comp, error: compError } = await supabase
        .from('competitions')
        .select('*')
        .eq('competition_id', eventId)
        .single();

      if (compError) {
        console.error("Error fetching event:", compError); // Log for debugging
        alert('Event not found! Check console for details.');
        router.push('/admin/events');
        return;
      }

      setTitle(comp.title);

      // Get Related Criteria
      const { data: crit } = await supabase
        .from('criteria')
        .select('*')
        .eq('competition_id', eventId)
        .order('criteria_id', { ascending: true });

      if (crit) {
        const formatted = crit.map((c) => ({
          criteria_id: c.criteria_id,
          name: c.name,
          weight: c.weight_percentage.toString(),
          description: c.description || '' 
        }));
        setCriteriaList(formatted);
      }
      setLoading(false);
    };

    fetchEventData();
  }, [eventId, router]);

  // --- FORM HANDLERS ---

  const addCriteriaRow = () => {
    setCriteriaList([...criteriaList, { name: '', weight: '', description: '' }]);
  };

  const removeCriteriaRow = (index: number) => {
    const list = [...criteriaList];
    list.splice(index, 1);
    setCriteriaList(list);
  };

  const updateCriteria = (index: number, field: string, value: string) => {
    const list = [...criteriaList];
    // @ts-ignore
    list[index][field] = value;
    setCriteriaList(list);
  };

  // --- UPDATE LOGIC ---
 // --- UPDATE LOGIC ---
  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // 1. Validate Weights
    const totalWeight = criteriaList.reduce((sum, item) => sum + Number(item.weight), 0);
    if (totalWeight !== 100) {
      alert(`Total weight must equal 100%. Current: ${totalWeight}%`);
      setSaving(false);
      return;
    }

    // 2. Update Competition Title
    const { error: titleError } = await supabase
      .from('competitions')
      .update({ title })
      .eq('competition_id', eventId);

    if (titleError) {
      alert('Error updating title');
      setSaving(false);
      return;
    }

    // 3. SEPARATE New vs Existing Criteria
    // This fixes the "Null value in criteria_id" error
    
    // A. Identify IDs to KEEP (for deletion logic)
    const activeIds = criteriaList
      .map((c) => c.criteria_id)
      .filter((id) => id !== undefined);

    // B. DELETE rows that were removed from the UI
    if (activeIds.length > 0) {
        await supabase
        .from('criteria')
        .delete()
        .eq('competition_id', eventId)
        .not('criteria_id', 'in', `(${activeIds.join(',')})`);
    } else {
        // If activeIds is empty, it means user deleted ALL rows. 
        // We should delete everything for this event.
        await supabase
        .from('criteria')
        .delete()
        .eq('competition_id', eventId);
    }

    // C. Prepare Data
    const rowsToUpdate = criteriaList
        .filter(c => c.criteria_id) // Has ID = Existing
        .map(c => ({
            criteria_id: c.criteria_id,
            competition_id: parseInt(eventId),
            name: c.name,
            weight_percentage: parseFloat(c.weight),
            description: c.description
        }));

    const rowsToInsert = criteriaList
        .filter(c => !c.criteria_id) // No ID = New
        .map(c => ({
            // Do NOT include criteria_id here at all
            competition_id: parseInt(eventId),
            name: c.name,
            weight_percentage: parseFloat(c.weight),
            description: c.description
        }));

    // D. Run Updates (Upsert handles updates efficiently)
    if (rowsToUpdate.length > 0) {
        const { error: updateError } = await supabase
            .from('criteria')
            .upsert(rowsToUpdate);
        
        if (updateError) {
            alert('Error updating existing criteria: ' + updateError.message);
            setSaving(false);
            return;
        }
    }

    // E. Run Inserts (Only for new rows)
    if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabase
            .from('criteria')
            .insert(rowsToInsert);

        if (insertError) {
            alert('Error adding new criteria: ' + insertError.message);
            setSaving(false);
            return;
        }
    }

    alert('Event Updated Successfully!');
    router.push('/admin/events');
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto"/> Loading Event...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        
        <div className="flex items-center gap-4 mb-8 pb-4 border-b">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <ArrowLeft size={20} className="text-slate-500" />
            </button>
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Edit Event Details</h1>
                <p className="text-slate-500 text-sm">Modify competition name and scoring rubric.</p>
            </div>
        </div>

        <form onSubmit={handleUpdateEvent} className="space-y-6">
            {/* Event Title */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Event Title</label>
                <input 
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:outline-none transition-colors font-bold text-lg"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                />
            </div>

            {/* Criteria Section */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-bold text-slate-700">Scoring Criteria</label>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                        criteriaList.reduce((sum, item) => sum + Number(item.weight), 0) === 100 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-indigo-50 text-indigo-600'
                    }`}>
                        Total: {criteriaList.reduce((sum, item) => sum + Number(item.weight), 0)}%
                    </span>
                </div>

                <div className="space-y-4">
                    {criteriaList.map((c, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 group focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            
                            <div className="flex gap-3 mb-2">
                                <input 
                                    className="flex-1 p-2 bg-white border border-slate-200 rounded-md text-sm focus:border-indigo-500 focus:outline-none"
                                    placeholder="Criteria Name"
                                    value={c.name}
                                    onChange={e => updateCriteria(i, 'name', e.target.value)}
                                    required
                                />
                                <div className="relative w-24">
                                    <input 
                                        type="number"
                                        className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm text-center focus:border-indigo-500 focus:outline-none"
                                        placeholder="%"
                                        value={c.weight}
                                        onChange={e => updateCriteria(i, 'weight', e.target.value)}
                                        required
                                    />
                                </div>
                                {criteriaList.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => removeCriteriaRow(i)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>

                            <div>
                                <input 
                                    className="w-full bg-transparent border-b border-dashed border-slate-300 text-xs py-1 px-1 text-slate-600 focus:border-indigo-400 focus:outline-none placeholder:text-slate-400"
                                    placeholder="Description..."
                                    value={c.description}
                                    onChange={e => updateCriteria(i, 'description', e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <button 
                    type="button" 
                    onClick={addCriteriaRow}
                    className="mt-3 text-sm font-bold text-indigo-600 flex items-center gap-1 hover:underline"
                >
                    <Plus size={16} /> Add New Criteria
                </button>
            </div>

            <button 
                disabled={saving}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 mt-8 disabled:opacity-50"
            >
                {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                {saving ? 'Saving Changes...' : 'Update Event'}
            </button>
        </form>

      </div>
    </div>
  );
}