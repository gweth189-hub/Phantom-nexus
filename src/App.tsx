/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phantom Guard by phantom.nyte LLC
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, Lock, Key, Smartphone, Trash2, Plus, 
  ShieldCheck, ShieldAlert, Cpu, Fingerprint, 
  Settings, LogOut, ExternalLink, RefreshCw,
  Eye, EyeOff, Copy, Check
} from 'lucide-react';
import { checkPasswordStrength, encryptData, decryptData, generateRecoveryPhrase } from './lib/cryptoUtils';
import { cn } from './lib/utils';

// --- Types ---
interface PasswordItem {
  id: string;
  site_name: string;
  username_key: string;
  encrypted_password: string;
}

interface User {
  id: string;
  username: string;
  recovery_phrase: string;
}

// --- Components ---

const FuturisticButton = ({ children, onClick, className, variant = 'primary', disabled = false }: any) => {
  const variants = {
    primary: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.3)]',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-cyan-400 border border-cyan-900/50',
    danger: 'bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/50'
  };

  return (
    <button 
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant as keyof typeof variants],
        className
      )}
    >
      {children}
    </button>
  );
};

const FuturisticInput = ({ label, icon: Icon, ...props }: any) => (
  <div className="space-y-1.5 w-full">
    <label className="text-xs uppercase tracking-widest text-cyan-500/70 font-semibold ml-1">
      {label}
    </label>
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cyan-600 group-focus-within:text-cyan-400 transition-colors">
        <Icon size={18} />
      </div>
      <input
        {...props}
        className="w-full bg-black/40 border border-cyan-900/30 rounded-xl py-3 pl-10 pr-4 text-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all placeholder:text-cyan-900"
      />
    </div>
  </div>
);

const Watermark = () => (
  <div className="fixed bottom-6 right-6 opacity-20 pointer-events-none flex flex-col items-end">
    <span className="text-[10px] tracking-[0.3em] font-bold text-cyan-400 uppercase">Secure Core v1.0.4</span>
    <span className="text-xs font-mono text-cyan-500 italic">phantom.nyte LLC</span>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auth Form State
  const [username, setUsername] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [generatedPhrase, setGeneratedPhrase] = useState('');

  // Dashboard State
  const [activeTab, setActiveTab] = useState<'vault' | 'checker' | '2fa' | 'settings'>('vault');
  
  // Vault State
  const [passwords, setPasswords] = useState<PasswordItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPasswordData, setNewPasswordData] = useState({ site: '', user: '', pass: '' });
  const [decryptedId, setDecryptedId] = useState<string | null>(null);

  // Checker State
  const [checkPass, setCheckPass] = useState('');
  
  // 2FA State
  const [otpToken, setOtpToken] = useState('000 000');
  const [otpProgress, setOtpProgress] = useState(100);

  useEffect(() => {
    const savedUser = localStorage.getItem('pg_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchPasswords();
      const interval = setInterval(updateOTP, 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const updateOTP = () => {
    // Simulated TOTP for demo purposes, backend has real logic
    const now = new Date();
    const sec = now.getSeconds();
    const progress = ((30 - (sec % 30)) / 30) * 100;
    setOtpProgress(progress);
    
    // Simple pseudo-token based on user ID and time window
    if (user) {
      const window = Math.floor(now.getTime() / 30000);
      const token = (Math.abs(window * parseInt(user.id.substring(0, 8), 16)) % 1000000).toString().padStart(6, '0');
      setOtpToken(token.slice(0, 3) + ' ' + token.slice(3));
    }
  };

  const fetchPasswords = async () => {
    if (!user) return;
    try {
      const resp = await fetch(`/api/passwords/${user.id}`);
      const data = await resp.json();
      setPasswords(data);
    } catch (err) {
      console.error("Fetch failed", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const endpoint = isRegistering ? '/api/register' : '/api/login';
    const body = isRegistering 
      ? { username, recoveryPhrase: generatedPhrase }
      : { username, recoveryPhrase };

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      
      if (data.success) {
        const userData = { 
          id: data.userId, 
          username, 
          recovery_phrase: isRegistering ? generatedPhrase : recoveryPhrase 
        };
        setUser(userData);
        localStorage.setItem('pg_user', JSON.stringify(userData));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Network error. Security systems offline.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPassword = async () => {
    if (!user) return;
    const encrypted = encryptData(newPasswordData.pass, user.recovery_phrase);
    try {
      await fetch('/api/passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          siteName: newPasswordData.site,
          usernameKey: newPasswordData.user,
          encryptedPassword: encrypted
        })
      });
      setNewPasswordData({ site: '', user: '', pass: '' });
      setShowAddModal(false);
      fetchPasswords();
    } catch (err) {
      setError("Failed to save entry.");
    }
  };

  const deletePassword = async (id: string) => {
    try {
      await fetch(`/api/passwords/${id}`, { method: 'DELETE' });
      fetchPasswords();
    } catch (err) {
      setError("Failed to delete entry.");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-cyan-50 flex items-center justify-center p-4 selection:bg-cyan-500/30">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-cyan-900/10 blur-[120px]" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-purple-900/10 blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-black/40 backdrop-blur-xl border border-cyan-900/30 rounded-3xl p-8 shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-cyan-950/50 rounded-2xl flex items-center justify-center border border-cyan-500/20 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <Shield className="text-cyan-400" size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase mb-1 flex items-center gap-2">
              Phantom <span className="text-cyan-500">Guard</span>
            </h1>
            <p className="text-cyan-600 text-[10px] tracking-[0.4em] uppercase font-bold">Anonymous Security Node</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <FuturisticInput 
              label="Node Identity (Username)"
              icon={Cpu}
              value={username}
              onChange={(e: any) => setUsername(e.target.value)}
              placeholder="e.g. ghost_0x82"
              required
            />

            {!isRegistering ? (
              <FuturisticInput 
                label="Security Key (Recovery Phrase)"
                icon={Key}
                type="password"
                value={recoveryPhrase}
                onChange={(e: any) => setRecoveryPhrase(e.target.value)}
                placeholder="word1-word2-word3-word4"
                required
              />
            ) : (
              <div className="bg-cyan-950/20 border border-cyan-900/30 rounded-xl p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-cyan-600 mb-2 font-bold">Your Unique Recovery Phrase</p>
                <div className="text-lg font-mono text-cyan-400 tracking-tight">
                  {generatedPhrase || 'PHANTOM-SECURE-NODE-INIT'}
                </div>
                <p className="text-[10px] text-cyan-700 mt-2 italic italic">Store this safely. It cannot be recovered.</p>
              </div>
            )}

            {error && <p className="text-red-500 text-xs text-center font-medium">{error}</p>}

            <FuturisticButton loading={loading} className="w-full h-14">
              {isRegistering ? 'Initialize Node' : 'Bypass Firewall'}
            </FuturisticButton>
          </form>

          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              if (!isRegistering) setGeneratedPhrase(generateRecoveryPhrase());
            }}
            className="w-full mt-6 text-xs text-cyan-600 hover:text-cyan-400 transition-colors uppercase tracking-widest font-bold"
          >
            {isRegistering ? 'Already have a Node? Login' : 'Request New Anonymous Identity'}
          </button>
        </motion.div>
        <Watermark />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-cyan-50 selection:bg-cyan-500/30 font-sans">
      {/* Sidebar / Nav */}
      <nav className="fixed left-0 top-0 h-full w-20 md:w-24 bg-black/60 backdrop-blur-2xl border-r border-cyan-900/20 flex flex-col items-center py-10 z-50">
        <div className="w-12 h-12 bg-cyan-950/40 rounded-xl flex items-center justify-center border border-cyan-500/30 mb-12 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <Shield className="text-cyan-400" size={24} />
        </div>

        <div className="flex-1 flex flex-col gap-8">
          {[
            { id: 'vault', icon: Lock, label: 'Vault' },
            { id: 'checker', icon: ShieldCheck, label: 'Guard' },
            { id: '2fa', icon: Smartphone, label: '2FA' },
            { id: 'settings', icon: Settings, label: 'Core' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group relative",
                activeTab === item.id 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30" 
                  : "text-cyan-800 hover:text-cyan-500 hover:bg-cyan-950/20"
              )}
            >
              <item.icon size={22} />
              <span className="absolute left-full ml-4 px-2 py-1 bg-cyan-900 text-cyan-50 text-[10px] uppercase tracking-wider rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                {item.label}
              </span>
            </button>
          ))}
        </div>

        <button 
          onClick={() => { localStorage.removeItem('pg_user'); setUser(null); }}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-red-900 hover:text-red-500 hover:bg-red-950/20 transition-all"
        >
          <LogOut size={22} />
        </button>
      </nav>

      {/* Main Content */}
      <main className="pl-20 md:pl-24 min-h-screen">
        <header className="p-8 flex items-center justify-between border-b border-cyan-900/10">
          <div>
            <h2 className="text-xl font-bold tracking-tight uppercase">
              {activeTab === 'vault' && 'Secure Vault'}
              {activeTab === 'checker' && 'Strength Analyzer'}
              {activeTab === '2fa' && '2FA Authenticator'}
              {activeTab === 'settings' && 'Core Systems'}
            </h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-700 font-bold">Node: {user.username}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-cyan-950/30 px-4 py-1.5 rounded-full border border-cyan-900/40 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-600">Encrypted Path Open</span>
            </div>
            <Fingerprint className="text-cyan-500 animate-pulse" size={24} />
          </div>
        </header>

        <section className="p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'vault' && (
              <motion.div 
                key="vault"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-3xl font-black tracking-tighter uppercase italic">Stored <span className="text-cyan-500">Assets</span></h3>
                  <FuturisticButton onClick={() => setShowAddModal(true)}>
                    <Plus size={18} /> New Entry
                  </FuturisticButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {passwords.map((p) => {
                    const isDecrypted = decryptedId === p.id;
                    const passVisible = decryptedId === p.id;
                    
                    return (
                      <motion.div 
                        layout
                        key={p.id}
                        className="bg-cyan-950/10 border border-cyan-900/20 rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/40 transition-all duration-500"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="p-3 bg-cyan-950/40 rounded-xl border border-cyan-900/30">
                            <Shield size={20} className="text-cyan-400" />
                          </div>
                          <button onClick={() => deletePassword(p.id)} className="text-cyan-900 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <h4 className="text-lg font-bold mb-1 group-hover:text-cyan-400 transition-colors">{p.site_name}</h4>
                        <p className="text-xs text-cyan-700 mb-4 font-mono">{p.username_key}</p>

                        <div className="flex items-center justify-between gap-2 mt-4 bg-black/40 rounded-lg px-3 py-2 border border-cyan-900/30">
                          <span className="text-xs font-mono tracking-tight text-cyan-200/80 overflow-hidden truncate">
                            {passVisible ? decryptData(p.encrypted_password, user.recovery_phrase) : '••••••••••••'}
                          </span>
                          <button 
                            onClick={() => setDecryptedId(isDecrypted ? null : p.id)}
                            className="text-cyan-600 hover:text-cyan-400 transition-colors"
                          >
                            {passVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                  
                  {passwords.length === 0 && (
                    <div className="col-span-full border border-dashed border-cyan-900/30 rounded-3xl p-12 text-center">
                      <Lock className="mx-auto text-cyan-900/50 mb-4" size={48} />
                      <p className="text-cyan-800 font-bold uppercase tracking-widest text-xs">Vault Empty. Security Clear.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'checker' && (
              <motion.div 
                key="checker"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto"
              >
                <div className="text-center mb-12">
                   <h3 className="text-3xl font-black tracking-tighter uppercase mb-2">Entropy <span className="text-cyan-500">Gauge</span></h3>
                   <p className="text-cyan-700 text-[10px] uppercase tracking-widest font-bold">Predicting Brute-Force Resilience</p>
                </div>

                <div className="bg-black/40 border border-cyan-900/30 rounded-[40px] p-8 md:p-12 relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-cyan-950 rounded-full border-4 border-black flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                    <ShieldCheck className={cn("transition-colors duration-500", checkPasswordStrength(checkPass).color.replace('bg-', 'text-'))} size={40} />
                  </div>

                  <div className="mt-8 space-y-8">
                    <FuturisticInput 
                      label="Candidate String"
                      icon={Key}
                      type="text"
                      value={checkPass}
                      onChange={(e: any) => setCheckPass(e.target.value)}
                      placeholder="Type a password to analyze..."
                    />

                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold uppercase tracking-tighter text-cyan-700">Resilience Level</span>
                        <span className={cn("text-xl font-black uppercase tracking-tighter transition-colors duration-500", checkPasswordStrength(checkPass).color.replace('bg-', 'text-'))}>
                          {checkPasswordStrength(checkPass).label}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-cyan-950/30 rounded-full overflow-hidden border border-cyan-900/20">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(checkPasswordStrength(checkPass).score / 6) * 100}%` }}
                          className={cn("h-full transition-all duration-700", checkPasswordStrength(checkPass).color)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Length > 12', met: checkPass.length > 12 },
                        { label: 'Complexity', met: /[!@#$%^&*(),.?":{}|<>]/.test(checkPass) },
                        { label: 'Casing Mix', met: /[A-Z]/.test(checkPass) && /[a-z]/.test(checkPass) },
                        { label: 'Numeric Int', met: /[0-9]/.test(checkPass) }
                      ].map((rule) => (
                        <div key={rule.label} className="bg-cyan-950/20 p-3 rounded-xl border border-cyan-900/30 flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", rule.met ? 'bg-cyan-400' : 'bg-cyan-950')} />
                          <span className={cn("text-[10px] uppercase font-bold tracking-wider", rule.met ? 'text-cyan-400' : 'text-cyan-800')}>
                            {rule.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === '2fa' && (
              <motion.div 
                key="2fa"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md mx-auto text-center"
              >
                <h3 className="text-3xl font-black tracking-tighter uppercase mb-8">Node <span className="text-cyan-500">Authenticator</span></h3>
                
                <div className="relative inline-block mb-12">
                  <svg className="w-56 h-56 transform -rotate-90">
                    <circle
                      cx="112"
                      cy="112"
                      r="100"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      className="text-cyan-950/50"
                    />
                    <motion.circle
                      cx="112"
                      cy="112"
                      r="100"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray="628"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: 628 - (628 * otpProgress) / 100 }}
                      className="text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-700 mb-1">Passcode</p>
                    <span className="text-4xl font-black font-mono tracking-tighter text-cyan-400 select-all">
                      {otpToken}
                    </span>
                    <button className="mt-2 text-cyan-600 hover:text-cyan-400 transition-colors uppercase text-[9px] font-black tracking-widest">
                      Click to Copy
                    </button>
                  </div>
                </div>

                <div className="bg-cyan-950/10 border border-cyan-900/30 rounded-3xl p-6 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[40px] pointer-events-none" />
                  <h4 className="text-xs uppercase tracking-widest font-black text-cyan-600 mb-4">Security Protocol Info</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <RefreshCw size={14} className="text-cyan-400 animate-spin-slow" />
                      <p className="text-[11px] text-cyan-200/60 leading-relaxed font-medium">Valid for next <span className="text-cyan-500">{Math.ceil(30 * otpProgress / 100)}s</span>. Refreshing automatically.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Shield size={14} className="text-cyan-400" />
                      <p className="text-[11px] text-cyan-200/60 leading-relaxed font-medium">Derived from Node ID & System Clock. Non-reversible hash string.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-3xl mx-auto space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-black/40 border border-cyan-900/30 rounded-3xl p-8">
                     <h3 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
                       <Cpu size={20} className="text-cyan-500" /> System Integrity
                     </h3>
                     <div className="space-y-4">
                       <div className="flex justify-between items-center py-2 border-b border-cyan-900/10">
                         <span className="text-xs text-cyan-700 font-bold uppercase">Node Version</span>
                         <span className="text-xs font-mono text-cyan-400">v4.0.2-anonym</span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-cyan-900/10">
                         <span className="text-xs text-cyan-700 font-bold uppercase">Uptime</span>
                         <span className="text-xs font-mono text-cyan-400">99.9992%</span>
                       </div>
                       <div className="flex justify-between items-center py-2">
                         <span className="text-xs text-cyan-700 font-bold uppercase">Encryption</span>
                         <span className="text-xs font-mono text-cyan-400">AES-256-GCM</span>
                       </div>
                     </div>
                  </div>

                  <div className="bg-cyan-950/20 border border-cyan-900/30 rounded-3xl p-8 flex flex-col justify-between">
                     <div>
                       <h3 className="text-xl font-bold uppercase mb-2">phantom.nyte <span className="text-cyan-500">LLC</span></h3>
                       <p className="text-[10px] uppercase tracking-widest text-cyan-700 mb-6 font-black italic">The Future of Digital Sovereignty</p>
                       <p className="text-xs text-cyan-200/50 leading-relaxed mb-6 font-medium">
                         Dedicated to providing hack-proof, anonymous infrastructure for the borderless digital age. 
                         Phantom Guard is our flagship security node.
                       </p>
                     </div>
                     <a href="https://phantomnyte.com" className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400 transition-colors uppercase text-[10px] font-black tracking-widest">
                       Deep Web Presence <ExternalLink size={12} />
                     </a>
                  </div>
                </div>

                <div className="bg-black/40 border border-cyan-900/30 rounded-3xl p-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h4 className="text-lg font-bold uppercase mb-1">Upgrade to <span className="text-cyan-400">Prime Node</span></h4>
                      <p className="text-xs text-cyan-700 font-medium tracking-tight">Unlock Biometric-Link & Multi-Node Sync for a one-time fee.</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-2xl font-black text-cyan-50 font-mono">$19.99 <span className="text-xs text-cyan-700 font-medium">USD</span></div>
                      <FuturisticButton variant="secondary" className="px-4 py-2 text-xs">
                        Unlock Advanced Features
                      </FuturisticButton>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-4 overflow-x-auto pb-2 border-t border-cyan-900/10 pt-6">
                    {['256GB Ghost Drive', 'Quantum Resilience', 'Darknet Shield', '24/7 AI Warden'].map(f => (
                      <div key={f} className="shrink-0 bg-cyan-950/20 border border-cyan-900/40 px-3 py-1.5 rounded-full text-[9px] uppercase font-black text-cyan-500 flex items-center gap-2">
                        <Check size={10} /> {f}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-black/60 border border-cyan-500/30 rounded-3xl p-8 relative z-10 shadow-[0_0_50px_rgba(6,182,212,0.1)]"
            >
              <h3 className="text-2xl font-black tracking-tighter uppercase mb-6">New <span className="text-cyan-500">Security Entry</span></h3>
              <div className="space-y-4">
                <FuturisticInput 
                  label="Target Instance (Site/App)"
                  icon={Shield}
                  value={newPasswordData.site}
                  onChange={(e: any) => setNewPasswordData({ ...newPasswordData, site: e.target.value })}
                  placeholder="e.g. ProtonMail"
                />
                <FuturisticInput 
                  label="Access Identity"
                  icon={Cpu}
                  value={newPasswordData.user}
                  onChange={(e: any) => setNewPasswordData({ ...newPasswordData, user: e.target.value })}
                  placeholder="e.g. administrator_01"
                />
                <FuturisticInput 
                  label="Entropy String (Password)"
                  icon={Lock}
                  type="password"
                  value={newPasswordData.pass}
                  onChange={(e: any) => setNewPasswordData({ ...newPasswordData, pass: e.target.value })}
                />
              </div>
              <div className="flex gap-3 mt-8">
                <FuturisticButton 
                  onClick={() => setShowAddModal(false)}
                  variant="secondary"
                  className="flex-1"
                >
                  Abort
                </FuturisticButton>
                <FuturisticButton 
                  onClick={handleAddPassword}
                  className="flex-1"
                >
                  Commit Entry
                </FuturisticButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Watermark />
    </div>
  );
}
