import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { ButtonSpinner } from '../components/Loader.jsx';
import logo from '../assets/atlas-honda-logo.png';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError('');
    setSubmitting(true);
    try { const user = await login(username, password); navigate(user.role === 'admin' ? '/admin' : '/sales'); }
    catch (err) { setError(err.response?.data?.message || 'Could not reach the API. Check that the backend is running on port 5001.'); }
    finally { setSubmitting(false); }
  }

  return <div className="min-h-screen grid lg:grid-cols-2 bg-white">
    <div className="hidden lg:flex bg-brand-dark text-white p-12 flex-col justify-between relative overflow-hidden">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-red/30" />
      <div className="flex items-center gap-3"><img src={logo} alt="Asif Auto Traders" className="h-14 w-20 rounded-xl bg-white object-contain p-1.5" /><span className="font-bold text-2xl">Asif Auto Traders</span></div>
      <div><h1 className="text-5xl font-black leading-tight">Modern spare parts inventory and billing.</h1><p className="mt-5 text-slate-300 text-lg">Inspired by clean motorcycle dealer workflows: fast search, live stock, receipts and returns.</p></div>
      <p className="text-slate-400">Admin + Sales Team role-based access</p>
    </div>
    <div className="grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-slate-50 p-8 shadow-soft border">
        <div className="mb-8"><div className="h-12 w-12 rounded-2xl bg-brand-red text-white grid place-items-center mb-4"><Lock /></div><h2 className="text-3xl font-bold">Sign in</h2><p className="text-slate-500">Use admin or sales credentials.</p></div>
        {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</div>}
        <label className="text-sm font-medium">Username</label><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" className="mt-2 mb-4 w-full rounded-xl border p-3" />
        <label className="text-sm font-medium">Password</label>
        <div className="relative mt-2 mb-6">
          <input type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" className="w-full rounded-xl border p-3 pr-10" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-700">{showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
        </div>
        <button disabled={submitting} className="w-full rounded-xl bg-brand-red py-3 font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2">
          {submitting && <ButtonSpinner />}
          {submitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  </div>;
}
