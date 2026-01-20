// DIRECTORY LOCATION: app/(admin)/admin/events/page.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Plus, X, Layers, Save } from 'lucide-react';

export default function EventsPage() {
  const supabase = createClient();
  
  // Event State
  const [title, setTitle] = useState('');
  
  // Criteria State (Added 'description' field)
  const [criteriaList, setCriteriaList] = useState<{name: string, weight: string, description: string}[]>([
    { name: '', weight: '', description: '' }
  ]);

  const [loading, setLoading] = useState(false);

  // Helper: Add new criteria row
  const addCriteriaRow = () => {
    setCriteriaList([...criteriaList, { name: '', weight: '', description: '' }]);
  };

  // Helper: Remove row
  const removeCriteriaRow = (index: number) => {
    const list = [...criteriaList];
    list.splice(index, 1);
    setCriteriaList(list);
  };

  // Helper: Update row
  const updateCriteria = (index: number, field: 'name' | 'weight' | 'description', value: string) => {
    const list = [...criteriaList];
    list[index][field] = value;
    setCriteriaList(list);
  };

  // SUBMIT
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Validate Weights
    const totalWeight = criteriaList.reduce((sum, item) => sum + Number(item.weight), 0);
    if (totalWeight !== 100) {
        alert(`Total weight must equal 100%. Current total: ${totalWeight}%`);
        setLoading(false);
        return;
    }

    // 2. Create Competition
    const { data: compData, error: compError } = await supabase
        .from('competitions')
        .insert({ title, status: 'setup' })
        .select()
        .single();

    if (compError || !compData) {
        alert('Error creating event: ' + compError?.message);
        setLoading(false);
        return;
    }

    // 3. Create Criteria linked to that Competition
    const criteriaPayload = criteriaList.map(c => ({
        competition_id: compData.competition_id,
        name: c.name,
        weight_percentage: parseFloat(c.weight),
        description: c.description // <--- Added to payload
    }));

    const { error: critError } = await supabase.from('criteria').insert(criteriaPayload);

    if (critError) {
        alert('Event created but criteria failed: ' + critError.message);
    } else {
        alert('Event Created Successfully!');
        // Reset Form
        setTitle('');
        setCriteriaList([{ name: '', weight: '', description: '' }]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        
        <div className="flex items-center gap-3 mb-8 pb-4 border-b">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                <Layers size={24} />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Create New Event Track</h1>
                <p className="text-slate-500 text-sm">Define the competition name and scoring rubric.</p>
            </div>
        </div>

        <form onSubmit={handleCreateEvent} className="space-y-6">
            
            {/* Event Title */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Event Title</label>
                <input 
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:outline-none transition-colors font-bold text-lg"
                    placeholder="e.g. Mobile App Innovation 2025"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                />
            </div>

            {/* Dynamic Criteria */}
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
                            
                            {/* Row 1: Name and Weight */}
                            <div className="flex gap-3 mb-2">
                                <input 
                                    className="flex-1 p-2 bg-white border border-slate-200 rounded-md text-sm focus:border-indigo-500 focus:outline-none"
                                    placeholder="Criteria Name (e.g. UI Design)"
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

                            {/* Row 2: Description (New) */}
                            <div>
                                <input 
                                    className="w-full bg-transparent border-b border-dashed border-slate-300 text-xs py-1 px-1 text-slate-600 focus:border-indigo-400 focus:outline-none placeholder:text-slate-400"
                                    placeholder="Description: Explain how this criteria is judged..."
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
                    <Plus size={16} /> Add Criteria Row
                </button>
            </div>

            <button 
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Creating...' : <><Save size={20} /> Create Event Track</>}
            </button>
        </form>

      </div>
    </div>
  );
}