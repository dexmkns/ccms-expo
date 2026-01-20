'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Lock, ShieldCheck, ChevronRight, UserCog } from 'lucide-react';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  
  const [mode, setMode] = useState<'admin' | 'judge'>('judge');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/admin/dashboard');
    }
  };

  const handleJudgeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 1. Verify PIN
    const { data: judge, error } = await supabase
      .from('judges')
      .select('judge_id, name')
      .eq('pin_code', pin)
      .single();

    if (error || !judge) {
      setError('Invalid PIN Code.');
      setLoading(false);
      return;
    }

    // 2. SET COOKIE (Crucial Step for Middleware)
    // We create a specific cookie for this judge ID
    document.cookie = `ccms-judge-${judge.judge_id}=true; path=/; max-age=86400; SameSite=Lax`;

    // 3. Navigate to Dynamic Route
    // This allows multiple judges to be logged in on different tabs
    router.push(`/judge/${judge.judge_id}/dashboard`);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        
        {/* Toggle Header */}
        <div className="flex border-b">
          <button
            onClick={() => setMode('judge')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              mode === 'judge' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={18} /> Judge Access
          </button>
          <button
            onClick={() => setMode('admin')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              mode === 'admin' ? 'bg-white text-slate-900 border-b-2 border-slate-900' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            <UserCog size={18} /> Admin Portal
          </button>
        </div>

        {/* Login Forms */}
        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-slate-900 mb-2">
              {mode === 'judge' ? 'Welcome, Judge' : 'Organizer Login'}
            </h2>
            <p className="text-slate-500 text-sm">
              {mode === 'judge' 
                ? 'Enter the 6-digit PIN code provided on your badge.' 
                : 'Sign in to manage the expo tracks and tabulation.'}
            </p>
          </div>

          {mode === 'judge' ? (
            <form onSubmit={handleJudgeLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Badge PIN Code</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="• • • • • •"
                  className="w-full text-center text-3xl font-mono tracking-[0.5em] py-3 border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none transition-colors"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
              >
                {loading ? 'Verifying...' : <>Enter Expo <ChevronRight /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-blue-600"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-blue-600"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Authenticating...' : <>Sign In <Lock size={18} /></>}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm font-medium text-center rounded-lg animate-pulse">
              {error}
            </div>
          )}
        </div>
      </div>
      
      <p className="mt-8 text-xs text-slate-400 text-center">
        CCMS Expo Management System v1.0 <br />
        Unauthorized access is prohibited.
      </p>
    </div>
  );
}