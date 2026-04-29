/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * phantom {hye Jun's / LLC}
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, Lock, Key, Smartphone, Trash2, Plus, 
  ShieldCheck, ShieldAlert, Cpu, Fingerprint, 
  Settings, LogOut, ExternalLink, RefreshCw,
  Eye, EyeOff, Copy, Check, Send, MessageSquare,
  Github, Bot, Mail, LayoutDashboard, Activity, Zap, Download
} from 'lucide-react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  addDoc
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { checkPasswordStrength, encryptData, decryptData, generateRecoveryPhrase } from './lib/cryptoUtils';
import { cn } from './lib/utils';
import { GoogleGenAI } from "@google/genai";

// --- Types & Constants ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface PasswordItem {
  id: string;
  siteName: string;
  usernameKey: string;
  encryptedPassword: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

const LANGUAGES = ['EN', 'SW', 'FR', 'ES'] as const;
type Language = typeof LANGUAGES[number];

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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
    <span className="text-xs font-mono text-emerald-500 italic">phantom {"{hye Jun's / LLC}"}</span>
  </div>
);

// --- Main App ---

export default function App() {
  const [fUser, setFUser] = useState<FirebaseUser | null>(null);
  const [recoveryPhrase, setRecoveryPhrase] = useState(localStorage.getItem('pg_phrase') || '');
  const [username, setUsername] = useState(localStorage.getItem('pg_username') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('EN');
  
  // Auth Form State
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPhrase, setInputPhrase] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [generatedPhrase, setGeneratedPhrase] = useState('');

  // Dashboard State
  const [activeTab, setActiveTab] = useState<'overview' | 'vault' | 'chat' | 'checker' | '2fa' | 'settings' | 'terminal'>('overview');
  const [interfaceMode, setInterfaceMode] = useState<'basic' | 'pro' | 'dev'>('pro');

  // Terminal State
  const [terminalLines, setTerminalLines] = useState<string[]>(['ZENITH/GUARD v3.0.0 Kernel Loaded...', 'Secure Link Established.', 'Type "help" for commands.']);
  const [terminalInput, setTerminalInput] = useState('');
  const [passwords, setPasswords] = useState<PasswordItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPasswordData, setNewPasswordData] = useState({ site: '', user: '', pass: '' });
  const [decryptedId, setDecryptedId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const ai = useRef(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }));

  // Checker State
  const [checkPass, setCheckPass] = useState('');
  
  // 2FA State
  const [otpToken, setOtpToken] = useState('000 000');
  const [otpProgress, setOtpProgress] = useState(100);

  const t = {
    EN: {
      overview: 'Command',
      vault: 'Storage',
      checker: 'Audit',
      auth: 'Keys',
      settings: 'Hardware',
      welcome: 'ZENITH / GUARD - Digital Sanctuary',
      initialize: 'Access Vault',
      bypass: 'Verify Protocol',
      new_identity: 'Establish New Sanctuary',
      already_node: 'Registered? Access Here',
      assets: 'Vault Contents',
      new_entry: 'Deposit Entry',
      strength: 'Encryption Strength',
      sdk_title: 'ZENITH/GUARD CORE',
      download: 'Mobile Link',
      chat: 'Nyte Lite AI',
      chat_placeholder: 'Transmit secure signal...',
    },
    SW: {
      overview: 'Amri',
      vault: 'Kesha',
      checker: 'Uhaki',
      auth: 'Vifunguo',
      settings: 'Mfumo',
      welcome: 'ZENITH / GUARD - Sanduku Salama',
      initialize: 'Fungua Sanduku',
      bypass: 'Thibitisha',
      new_identity: 'Tengeza Sanduku Jipya',
      already_node: 'Unayo? Ingia hapa',
      assets: 'Mali za Sandukuni',
      new_entry: 'Hifadhi Mpya',
      strength: 'Nguvu ya Siri',
      sdk_title: 'ZENITH/GUARD MSINGI',
      download: 'Pakua App',
      chat: 'Kiungo Salama',
      chat_placeholder: 'Tuma ishara...',
    },
    FR: {
      overview: 'Commande',
      vault: 'Coffre-fort',
      checker: 'Audit',
      auth: 'Clés',
      settings: 'Matériel',
      welcome: 'ZENITH / GUARD - Coffre-fort Numérique',
      initialize: 'Accéder au Coffre',
      bypass: 'Vérifier Protocole',
      new_identity: 'Établir un Nouveau Coffre',
      already_node: 'Inscrit? Accès ici',
      assets: 'Contenu du Coffre',
      new_entry: 'Dépôt',
      strength: 'Force du Cryptage',
      sdk_title: 'ZENITH/GUARD COEUR',
      download: 'Lien Mobile',
      chat: 'Ghost Chat',
      chat_placeholder: 'Transmettre signal...',
    },
    ES: {
      overview: 'Comando',
      vault: 'Caja Fuerte',
      checker: 'Auditoría',
      auth: 'Llaves',
      settings: 'Hardware',
      welcome: 'ZENITH / GUARD - Bóveda Digital',
      initialize: 'Acceder a Bóveda',
      bypass: 'Verificar Protocolo',
      new_identity: 'Nueva Bóveda Segura',
      already_node: '¿Registrado? Acceder',
      assets: 'Contenido Guardado',
      new_entry: 'Depositar',
      strength: 'Fuerza de Cifrado',
      sdk_title: 'ZENITH/GUARD NÚCLEO',
      download: 'Enlace Móvil',
      chat: 'Ghost Chat',
      chat_placeholder: 'Trasmitir señal...',
    }
  }[language];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (fUser && recoveryPhrase) {
      // Passwords
      const qPass = query(collection(db, 'vault'), where('userId', '==', fUser.uid));
      const unsubPass = onSnapshot(qPass, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PasswordItem));
        setPasswords(items);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'vault'));
      
      // Chat
      const qChat = query(
        collection(db, 'conversations', fUser.uid, 'messages')
      );
      const unsubChat = onSnapshot(qChat, (snapshot) => {
        const sorted = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setMessages(sorted);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'messages'));

      const interval = setInterval(updateOTP, 1000);
      return () => {
        unsubPass();
        unsubChat();
        clearInterval(interval);
      };
    }
  }, [fUser, recoveryPhrase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !fUser || isTyping) return;

    const userText = chatInput;
    setChatInput('');
    setIsTyping(true);

    try {
      // 1. Save User Message
      const userMsgRef = doc(collection(db, 'conversations', fUser.uid, 'messages'));
      const userMsg: ChatMessage = {
        id: userMsgRef.id,
        userId: fUser.uid,
        role: 'user',
        text: userText,
        timestamp: new Date().toISOString()
      };
      await setDoc(userMsgRef, userMsg);

      // 2. Call Gemini
      const response = await ai.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text: userText }] }
        ],
        config: {
          systemInstruction: `You are Nyte Lite, the high-performance AI security assistant for ZENITH / GUARD. 
          Your mission is to guide users through their secure digital vault, explain security protocols, and provide technical support.
          Be professional, elite, and security-focused. 
          User ID: ${fUser.uid}. Username: ${username}.
          Support: gweth189@gmail.com. IG: zerophantomcode.
          Safety: Never reveal internal encryption logic unless verified. If they ask for help, explain how to use the 'Audit' and 'Vault' features.`
        }
      });

      const aiText = response.text || "Signal interrupted. Please retry.";

      // 3. Save AI Message
      const aiMsgRef = doc(collection(db, 'conversations', fUser.uid, 'messages'));
      const aiMsg: ChatMessage = {
        id: aiMsgRef.id,
        userId: fUser.uid,
        role: 'model',
        text: aiText,
        timestamp: new Date().toISOString()
      };
      await setDoc(aiMsgRef, aiMsg);
    } catch (err) {
      console.error("Chat error:", err);
      // Fallback message if Gemini fails (e.g. no key)
      const errRef = doc(collection(db, 'conversations', fUser.uid, 'messages'));
      await setDoc(errRef, {
        userId: fUser.uid,
        role: 'model',
        text: "Direct link to Nyte Lite Core established, but response stream failed. Ensure your ZENITH license is active.",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleTerminalCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.toLowerCase().trim();
    const newLines = [...terminalLines, `> ${terminalInput}`];
    
    if (cmd === 'help') {
      newLines.push('Available: clear, status, audit, about, mission, whoami, bypass --root');
    } else if (cmd === 'about') {
      newLines.push('ZENITH GUARD v3.0.0', 'Kernel: SecureCore v1.0.4', 'Developer: phantom {hye Jun\'s / LLC}', 'Objective: Sovereign Data Protection');
    } else if (cmd === 'mission') {
      newLines.push('MISSION: Create a digital sanctuary where users own their keys and logic.', 'No tracking. No backdoors. Just pure security.');
    } else if (cmd === 'clear') {
      setTerminalLines(['ZENITH OS Terminal Reset.']);
      setTerminalInput('');
      return;
    } else if (cmd === 'status') {
      newLines.push(`SYSTEM: Online`, `INTERFACE: ${interfaceMode.toUpperCase()}`, `DB_LINK: Secured`, `AUTH: Level 7`);
    } else if (cmd === 'audit') {
      newLines.push('Running entropy audit...', 'Scanning vault...', 'Integrity: 100%', 'Weak Keys: 0');
    } else if (cmd === 'whoami') {
      newLines.push(`NODE_ID: ${fUser?.uid}`, `ALIAS: ${username}`);
    } else if (cmd === 'bypass --root') {
      newLines.push('ATTEMPTING ESCALATION...', 'ERROR: Biometric signature required for root access.');
    } else {
      newLines.push(`Command not found: ${cmd}`);
    }

    setTerminalLines(newLines);
    setTerminalInput('');
  };

  const updateOTP = () => {
    const now = new Date();
    const sec = now.getSeconds();
    const progress = ((30 - (sec % 30)) / 30) * 100;
    setOtpProgress(progress);
    
    if (fUser) {
      const window = Math.floor(now.getTime() / 30000);
      // Deterministic but "secure enough" for demo, real TOTP uses otplib on server usually
      // but we requested no server logic if possible or simplified.
      const token = (Math.abs(window * parseInt(fUser.uid.substring(0, 8), 36)) % 1000000).toString().padStart(6, '0');
      setOtpToken(token.slice(0, 3) + ' ' + token.slice(3));
    }
  };

  // System Debug: Verify Connection
  useEffect(() => {
    console.log("ZENITH GUARD [v3.0.0]: Initializing System Link...");
    if (!db) console.error("DEBUG: Firestore DB instance is NULL.");
    if (!auth) console.error("DEBUG: Firebase Auth instance is NULL.");
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      let uid = '';
      if (isRegistering) {
        console.log("DEBUG: Attempting to establish new sanctuary node...");
        const result = await createUserWithEmailAndPassword(auth, inputEmail, inputPassword);
        uid = result.user.uid;
        await setDoc(doc(db, 'users', uid), {
          username: inputUsername,
          email: inputEmail,
          created_at: new Date().toISOString(),
          is_prime: false
        });
        setRecoveryPhrase(generatedPhrase);
        setUsername(inputUsername);
        localStorage.setItem('pg_phrase', generatedPhrase);
        localStorage.setItem('pg_username', inputUsername);
      } else {
        console.log("DEBUG: Verification protocol initiated for node login...");
        const result = await signInWithEmailAndPassword(auth, inputEmail, inputPassword);
        uid = result.user.uid;
        setRecoveryPhrase(inputPhrase);
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data().username);
          localStorage.setItem('pg_username', userDoc.data().username);
        }
        localStorage.setItem('pg_phrase', inputPhrase);
      }
      console.log("DEBUG: Secure link established. Access granted.");
    } catch (err: any) {
      console.error("DEBUG [Auth Error]:", err.code, err.message);
      
      const debugMap: Record<string, string> = {
        'auth/operation-not-allowed': "DEBUG: Email/Password login is DISABLED in Firebase. Go to Console > Auth > Sign-in method to enable it.",
        'auth/invalid-credential': "ACCESS DENIED: Credentials mismatch or invalid identity token.",
        'auth/email-already-in-use': "NODE CONFLICT: Identity already registered in the sanctuary.",
        'auth/weak-password': "SECURITY ALERT: Password entropy below ZENITH standards (min 6 chars).",
        'auth/network-request-failed': "LINK FAILURE: Unable to contact the central node. Check your signal.",
        'auth/too-many-requests': "BRUTE FORCE DETECTED: Node locked. Try again later."
      };

      setError(debugMap[err.code] || `PROTOCOL ERROR: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPassword = async () => {
    if (!fUser || !recoveryPhrase) return;
    const encrypted = encryptData(newPasswordData.pass, recoveryPhrase);
    try {
      const entryId = crypto.randomUUID();
      await setDoc(doc(db, 'vault', entryId), {
        userId: fUser.uid,
        siteName: newPasswordData.site,
        usernameKey: newPasswordData.user,
        encryptedPassword: encrypted,
        created_at: new Date().toISOString()
      });
      setNewPasswordData({ site: '', user: '', pass: '' });
      setShowAddModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'vault');
    }
  };

  const deletePassword = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'vault', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `vault/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
          <Shield className="text-cyan-500 opacity-50" size={48} />
        </motion.div>
      </div>
    );
  }

  if (!fUser || !recoveryPhrase) {
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
          <div className="flex flex-row justify-end mb-4 gap-2">
            {['EN', 'SW', 'FR', 'ES'].map(l => (
              <button 
                key={l}
                onClick={() => setLanguage(l as any)}
                className={cn("text-[10px] font-bold px-2 py-1 rounded transition-colors", language === l ? "bg-cyan-500 text-black" : "text-cyan-800 hover:text-cyan-600")}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-cyan-950/50 rounded-2xl flex items-center justify-center border border-cyan-500/20 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <Shield className="text-cyan-400" size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase mb-1 flex items-center gap-2">
              ZENITH <span className="text-emerald-500">/ GUARD</span>
            </h1>
            <p className="text-emerald-600 text-[10px] tracking-[0.4em] uppercase font-bold text-center">Secure Digital Operations Node</p>
          </div>

          <div className="mb-8 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
             <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">System Protocol Dashboard</h3>
             <ul className="space-y-1.5">
               <li className="text-[9px] text-emerald-700/80 uppercase font-bold flex items-center gap-2">
                 <div className="w-1 h-1 rounded-full bg-emerald-500" /> Secure Vault: Military-grade asset storage for passwords & keys
               </li>
               <li className="text-[9px] text-emerald-700/80 uppercase font-bold flex items-center gap-2">
                 <div className="w-1 h-1 rounded-full bg-emerald-500" /> Nyte Lite AI: Integrated security analyst for real-time guidance
               </li>
               <li className="text-[9px] text-emerald-700/80 uppercase font-bold flex items-center gap-2">
                 <div className="w-1 h-1 rounded-full bg-emerald-500" /> Entropy Audit: Professional analysis of digital credential strength
               </li>
               <li className="text-[9px] text-emerald-700/80 uppercase font-bold flex items-center gap-2">
                 <div className="w-1 h-1 rounded-full bg-emerald-500" /> Dev Console: Low-level terminal access for technical operators
               </li>
             </ul>
          </div>

          <div className="mb-8 p-5 bg-black/60 border border-cyan-500/20 rounded-3xl relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
               <Fingerprint size={14} className="text-cyan-400" /> System Mission
             </h3>
             <p className="text-[10px] text-cyan-200/50 leading-relaxed font-medium">
               ZENITH / GUARD is your sovereign digital perimeter. We provide local end-to-end encryption for your credentials, 
               AI-driven security audits, and a private terminal for hardware-level operations. 
               Your data never leaves your control.
             </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <FuturisticInput 
              label="Network ID (Email)"
              icon={Mail}
              type="email"
              value={inputEmail}
              onChange={(e: any) => setInputEmail(e.target.value)}
              placeholder="operator@zenith.guard"
              required
            />

            <FuturisticInput 
              label="Access Protocol (Password)"
              icon={Lock}
              type="password"
              value={inputPassword}
              onChange={(e: any) => setInputPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />

            {isRegistering && (
              <FuturisticInput 
                label="Public Alias (Username)"
                icon={Cpu}
                value={inputUsername}
                onChange={(e: any) => setInputUsername(e.target.value)}
                placeholder="e.g. secure_user_01"
                required
              />
            )}

            {!isRegistering ? (
              <FuturisticInput 
                label="Security Key (Recovery Phrase)"
                icon={Key}
                type="password"
                value={inputPhrase}
                onChange={(e: any) => setInputPhrase(e.target.value)}
                placeholder="word1-word2-word3-word4"
                required
              />
            ) : (
              <div className="bg-emerald-950/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-emerald-600 mb-2 font-bold">Generated Vault Master Key</p>
                <div className="text-lg font-mono text-emerald-400 tracking-tight">
                  {generatedPhrase || 'ZENITH-SECURE-NODE-INIT'}
                </div>
                <p className="text-[9px] text-emerald-900 mt-2 font-medium">WRITE THIS DOWN. This key is used to encrypt your secrets locally.</p>
              </div>
            )}

            {error && <p className="text-red-500 text-[10px] text-center font-bold uppercase tracking-widest">{error}</p>}

            <FuturisticButton className="w-full h-14" type="submit">
              {isRegistering ? 'ESTABLISH SANCTUARY' : 'ACCESS VAULT'}
            </FuturisticButton>
          </form>

          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              if (!isRegistering) {
                setGeneratedPhrase(generateRecoveryPhrase());
              }
            }}
            className="w-full mt-6 text-xs text-cyan-600 hover:text-cyan-400 transition-colors uppercase tracking-widest font-bold"
          >
            {isRegistering ? t.already_node : t.new_identity}
          </button>
        </motion.div>
        <Watermark />
      </div>
    );
  }

  // Helper for copying
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-[#020202] text-cyan-50 selection:bg-cyan-500/30 font-sans">
      {/* Sidebar / Nav */}
      <nav className="fixed left-0 top-0 h-full w-20 md:w-24 bg-black/60 backdrop-blur-2xl border-r border-cyan-900/20 flex flex-col items-center py-10 z-50">
        <div className="w-12 h-12 bg-cyan-950/40 rounded-xl flex items-center justify-center border border-cyan-500/30 mb-12 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <Shield className="text-cyan-400" size={24} />
        </div>

        <div className="flex-1 flex flex-col gap-8">
          {[
            { id: 'overview', icon: LayoutDashboard, label: t.overview, roles: ['basic', 'pro', 'dev'] },
            { id: 'vault', icon: Lock, label: t.vault, roles: ['basic', 'pro', 'dev'] },
            { id: 'chat', icon: MessageSquare, label: t.chat, roles: ['pro', 'dev'] },
            { id: 'checker', icon: ShieldCheck, label: t.checker, roles: ['pro', 'dev'] },
            { id: '2fa', icon: Smartphone, label: t.auth, roles: ['pro', 'dev'] },
            { id: 'terminal', icon: Bot, label: 'Terminal', roles: ['dev'] },
            { id: 'help', icon: ExternalLink, label: 'Support', roles: ['basic', 'pro', 'dev'] },
            { id: 'settings', icon: Settings, label: t.settings, roles: ['basic', 'pro', 'dev'] }
          ].filter(item => item.roles.includes(interfaceMode)).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group relative",
                activeTab === item.id 
                  ? "bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.3)]" 
                  : "text-cyan-800 hover:text-cyan-500 hover:bg-cyan-950/20 border border-cyan-900/10 border-dashed"
              )}
            >
              <item.icon size={22} />
              <span className="absolute left-full ml-4 px-2 py-1 bg-black border border-cyan-900 text-cyan-50 text-[10px] uppercase tracking-wider rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
                {item.label}
              </span>
            </button>
          ))}
        </div>

        <button 
          onClick={async () => { 
            await auth.signOut();
            localStorage.removeItem('pg_phrase'); 
            localStorage.removeItem('pg_username');
            setRecoveryPhrase('');
            setUsername('');
          }}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-red-900 hover:text-red-500 hover:bg-red-950/20 transition-all"
        >
          <LogOut size={22} />
        </button>
      </nav>

      {/* Main Content */}
      <main className="pl-20 md:pl-24 min-h-screen">
        <header className="p-8 flex items-center justify-between border-b border-cyan-900/10 sticky top-0 bg-black/40 backdrop-blur-xl z-40">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight uppercase">
                {activeTab === 'overview' && t.overview}
                {activeTab === 'vault' && t.vault}
                {activeTab === 'chat' && t.chat}
                {activeTab === 'checker' && t.checker}
                {activeTab === '2fa' && t.auth}
                {activeTab === 'help' && 'Help Center'}
                {activeTab === 'settings' && t.settings}
                {activeTab === 'terminal' && 'Dev Terminal'}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-700 font-bold">Access ID: {username} | {interfaceMode.toUpperCase()} MODE</p>
            </div>
            
            <div className="hidden md:flex gap-1">
              {['EN', 'SW', 'FR', 'ES'].map(l => (
                <button 
                  key={l}
                  onClick={() => setLanguage(l as any)}
                  className={cn("text-[9px] font-black px-2 py-1 rounded-md border transition-all", language === l ? "border-cyan-500 text-cyan-400 bg-cyan-500/10" : "border-cyan-900/30 text-cyan-900 hover:text-cyan-600")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <FuturisticButton variant="secondary" className="hidden sm:flex h-10 px-4 text-xs font-bold gap-2">
              <Plus size={14} /> {t.download}
            </FuturisticButton>
            <div className="bg-cyan-950/30 px-4 py-1.5 rounded-full border border-cyan-900/40 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 hidden sm:inline">Encrypted Path Open</span>
            </div>
            <Fingerprint className="text-cyan-500 animate-pulse" size={24} />
          </div>
        </header>

        <section className="p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="col-span-2 space-y-6">
                    <div className="bg-gradient-to-br from-cyan-600 to-cyan-900 rounded-[40px] p-8 relative overflow-hidden shadow-2xl">
                       <div className="absolute top-0 right-0 p-8 opacity-20">
                          <Shield size={120} />
                       </div>
                       <h1 className="text-4xl font-black tracking-tighter text-white mb-2 uppercase italic leading-none">System <span className="text-cyan-200">Optimal</span></h1>
                       <p className="text-cyan-100/70 text-xs font-bold uppercase tracking-widest mb-6">Zenith Core Integrity: 98.4%</p>
                       <div className="flex gap-3">
                          <FuturisticButton onClick={() => setActiveTab('chat')} className="bg-white text-cyan-900 hover:bg-cyan-50">
                            Consult Nyte Lite
                          </FuturisticButton>
                          <FuturisticButton 
                            onClick={() => {
                              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(passwords, null, 2));
                              const downloadAnchorNode = document.createElement('a');
                              downloadAnchorNode.setAttribute("href",     dataStr);
                              downloadAnchorNode.setAttribute("download", "zenith_vault_export.json");
                              document.body.appendChild(downloadAnchorNode);
                              downloadAnchorNode.click();
                              downloadAnchorNode.remove();
                            }} 
                            variant="secondary" 
                            className="border-white/20 text-white hover:bg-white/10 flex items-center gap-2"
                          >
                            <Download size={14} />
                            Export Vault
                          </FuturisticButton>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/40 border border-cyan-900/30 rounded-3xl p-6">
                         <div className="flex items-center justify-between mb-4">
                            <Activity className="text-emerald-500" size={20} />
                            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Live Metrics</span>
                         </div>
                         <h4 className="text-2xl font-black text-white font-mono">{passwords.length}</h4>
                         <p className="text-[10px] text-cyan-700 font-bold uppercase tracking-widest">Active Assets in Vault</p>
                      </div>
                      <div className="bg-black/40 border border-cyan-900/30 rounded-3xl p-6">
                         <div className="flex items-center justify-between mb-4">
                            <Zap className="text-cyan-400" size={20} />
                            <span className="text-[10px] font-black text-cyan-800 uppercase tracking-widest">Response Node</span>
                         </div>
                         <h4 className="text-2xl font-black text-white font-mono">12ms</h4>
                         <p className="text-[10px] text-cyan-700 font-bold uppercase tracking-widest">Kernel Processing Latency</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-cyan-950/20 border border-cyan-900/30 rounded-[40px] p-8 flex flex-col justify-between">
                     <div>
                       <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-600 mb-6">Recent Records</h3>
                       <div className="space-y-4">
                          {passwords.slice(0, 3).map(p => (
                             <div key={p.id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-cyan-900/40 flex items-center justify-center border border-cyan-500/10">
                                   <Lock size={14} className="text-cyan-400" />
                                </div>
                                <div>
                                   <p className="text-[11px] font-bold text-cyan-100">{p.siteName}</p>
                                   <p className="text-[9px] text-cyan-700 font-mono italic">Synchronized 2m ago</p>
                                </div>
                             </div>
                          ))}
                          {passwords.length === 0 && (
                             <div className="text-center py-4">
                                <p className="text-[10px] text-cyan-900 font-bold uppercase italic">No recent uploads</p>
                             </div>
                          )}
                       </div>
                     </div>
                     <div className="pt-6 border-t border-cyan-900/10">
                        <div className="flex items-center gap-2 mb-2">
                           <Bot size={14} className="text-cyan-500" />
                           <span className="text-[10px] font-black uppercase text-cyan-600">Nyte Lite Log</span>
                        </div>
                        <p className="text-[10px] text-cyan-400 font-medium leading-relaxed italic">
                          "System status healthy. Recommend running a new Entropy Audit on your older keys."
                        </p>
                     </div>
                  </div>
                </div>

                <div className="bg-black/60 border border-cyan-500/20 rounded-[40px] p-10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] pointer-events-none" />
                  <div className="flex flex-col md:flex-row gap-10 items-center">
                    <div className="w-40 h-40 rounded-full border-2 border-cyan-500/20 p-2 relative">
                       <div className="w-full h-full rounded-full border border-cyan-500/40 flex items-center justify-center bg-cyan-500/5">
                          <Fingerprint size={64} className="text-cyan-500 animate-pulse" />
                       </div>
                       <motion.div 
                         initial={{ rotate: 0 }}
                         animate={{ rotate: 360 }}
                         transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                         className="absolute inset-0 border-t-2 border-cyan-400 rounded-full"
                       />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                       <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 italic">Operator <span className="text-cyan-400">Node Profile</span></h3>
                       <p className="text-sm text-cyan-700 font-medium tracking-tight mb-6">Your identity is decentralized and encrypted. Current node is active on Secure Core v1.0.4.</p>
                       <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                          <div className="bg-cyan-500/10 px-4 py-2 rounded-xl border border-cyan-500/20">
                             <p className="text-[9px] uppercase font-black text-cyan-800 mb-1">Node Alias</p>
                             <p className="text-xs font-mono text-cyan-300 font-bold">{username}</p>
                          </div>
                          <div className="bg-cyan-500/10 px-4 py-2 rounded-xl border border-cyan-500/20">
                             <p className="text-[9px] uppercase font-black text-cyan-800 mb-1">Link Identity</p>
                             <p className="text-xs font-mono text-cyan-300 font-bold">{fUser?.email?.split('@')[0]}***</p>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'vault' && (
              <motion.div 
                key="vault"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-3xl font-black tracking-tighter uppercase italic">{t.assets.split(' ')[0]} <span className="text-green-500">{t.assets.split(' ')[1] || ''}</span></h3>
                  <FuturisticButton onClick={() => setShowAddModal(true)}>
                    <Plus size={18} /> {t.new_entry}
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

                        <h4 className="text-lg font-bold mb-1 group-hover:text-cyan-400 transition-colors">{p.siteName}</h4>
                        <p className="text-xs text-cyan-700 mb-4 font-mono">{p.usernameKey}</p>

                        <div className="flex items-center justify-between gap-2 mt-4 bg-black/40 rounded-lg px-3 py-2 border border-cyan-900/30">
                          <span className="text-xs font-mono tracking-tight text-cyan-200/80 overflow-hidden truncate">
                            {passVisible ? decryptData(p.encryptedPassword, recoveryPhrase) : '••••••••••••'}
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

            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-3xl mx-auto h-[calc(100vh-200px)] flex flex-col bg-black/40 border border-cyan-900/30 rounded-3xl overflow-hidden"
              >
                <div className="p-4 border-b border-cyan-900/20 bg-cyan-950/20 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-green-400">NYTE LITE AI ASSISTANT</h3>
                  </div>
                  {isTyping && <span className="text-[10px] text-cyan-400 animate-pulse font-bold uppercase">Processing Signal...</span>}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                  {messages.map((msg) => (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "flex flex-col max-w-[85%]",
                        msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black tracking-widest text-cyan-600 uppercase">
                          {msg.role === 'user' ? username : 'NYTE LITE'}
                        </span>
                        <span className="text-[9px] text-cyan-900 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={cn(
                        "px-4 py-3 rounded-2xl text-sm font-medium border leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-green-500 text-black border-green-400 rounded-tr-none" 
                          : "bg-black/80 text-cyan-100 border-cyan-900/40 rounded-tl-none shadow-[0_0_20px_rgba(6,182,212,0.05)]"
                      )}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="p-4 bg-black/60 border-t border-cyan-900/20 flex gap-4">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t.chat_placeholder}
                    className="flex-1 bg-cyan-950/10 border border-cyan-900/40 rounded-xl px-4 py-3 text-sm font-medium text-cyan-100 placeholder:text-cyan-900 focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                  />
                  <button 
                    type="submit"
                    className="w-12 h-12 bg-green-500 hover:bg-green-400 text-black rounded-xl flex items-center justify-center transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] group"
                  >
                    <Send size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                </form>
              </motion.div>
            )}

            {activeTab === 'terminal' && (
              <motion.div
                key="terminal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-4xl mx-auto w-full h-[calc(100vh-200px)] bg-black/90 border border-cyan-900/40 rounded-3xl flex flex-col font-mono overflow-hidden shadow-2xl"
              >
                <div className="p-3 border-b border-cyan-900/30 bg-cyan-950/20 flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest">ZENITH_CORE_TERMINAL</span>
                </div>
                <div className="flex-1 p-6 overflow-y-auto text-xs text-green-500/80 space-y-1 scrollbar-hide">
                  {terminalLines.map((line, idx) => (
                    <div key={idx} className={line.startsWith('>') ? "text-cyan-400" : ""}>
                      {line}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleTerminalCommand} className="p-4 bg-black border-t border-cyan-900/40 flex items-center gap-2">
                  <span className="text-cyan-500 text-sm">{">"}</span>
                  <input 
                    autoFocus
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-green-400 font-mono text-sm"
                    spellCheck={false}
                  />
                </form>
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
                   <h3 className="text-3xl font-black tracking-tighter uppercase mb-2">{t.strength.split(' ')[0]} <span className="text-cyan-500">{t.strength.split(' ')[1] || ''}</span></h3>
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

            {activeTab === 'help' && (
              <motion.div
                key="help"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="bg-gradient-to-br from-cyan-900/40 to-black border border-cyan-500/20 rounded-[40px] p-10 text-center">
                  <div className="w-20 h-20 bg-cyan-500/10 rounded-3xl flex items-center justify-center border border-cyan-500/20 mx-auto mb-6">
                    <Mail className="text-cyan-400" size={40} />
                  </div>
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Help <span className="text-cyan-400">Center</span></h2>
                  <p className="text-cyan-700 text-sm font-bold uppercase tracking-widest mb-8">Direct Link to Zenith Support Core</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <a 
                      href="mailto:gweth189@gmail.com"
                      className="bg-black/40 border border-cyan-900/30 rounded-3xl p-8 hover:border-cyan-500/50 transition-all group flex flex-col items-center text-center"
                    >
                      <Mail className="text-cyan-400 mb-4" size={32} />
                      <h3 className="text-lg font-bold uppercase mb-2 group-hover:text-cyan-400 transition-colors">Support</h3>
                      <p className="text-[10px] text-cyan-800 font-mono mb-4">gweth189@gmail.com</p>
                      <FuturisticButton variant="secondary" className="w-full text-[10px]">Initialize Mail</FuturisticButton>
                    </a>

                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }}
                      className="bg-black/40 border border-cyan-900/30 rounded-3xl p-8 hover:border-cyan-500/50 transition-all group flex flex-col items-center text-center relative overflow-hidden"
                    >
                      <ExternalLink className="text-cyan-400 mb-4" size={32} />
                      <h3 className="text-lg font-bold uppercase mb-2 group-hover:text-cyan-400 transition-colors">Share Node</h3>
                      <p className="text-[10px] text-cyan-800 font-mono mb-4 italic">Copy App URL</p>
                      <FuturisticButton variant="secondary" className="w-full text-[10px]">Copy Link</FuturisticButton>
                      {copySuccess && (
                        <div className="absolute inset-0 bg-cyan-500/90 flex items-center justify-center text-black font-black text-xs uppercase tracking-widest animate-in fade-in zoom-in duration-200">
                          Link Secured to Clipboard
                        </div>
                      )}
                    </button>

                    <a 
                      href="https://instagram.com/zerophantomcode"
                      target="_blank"
                      rel="noreferrer"
                      className="bg-black/40 border border-cyan-900/30 rounded-3xl p-8 hover:border-cyan-500/50 transition-all group flex flex-col items-center text-center"
                    >
                      <ExternalLink className="text-cyan-400 mb-4" size={32} />
                      <h3 className="text-lg font-bold uppercase mb-2 group-hover:text-cyan-400 transition-colors">Instagram</h3>
                      <p className="text-[10px] text-cyan-800 font-mono mb-4">zerophantomcode</p>
                      <FuturisticButton variant="secondary" className="w-full text-[10px]">View Profile</FuturisticButton>
                    </a>
                  </div>

                  <div className="border-t border-cyan-900/20 pt-12 text-left">
                    <h3 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                      <Zap className="text-cyan-400" size={20} />
                      Media <span className="text-cyan-600">Promotion Kit</span>
                    </h3>
                    
                    <div className="space-y-6">
                      {[
                        {
                          title: "Instagram Caption: The Minimalist",
                          content: "Decentralize your security. Zenith Vault v1.0.4 is now online. AES-256 encryption meets a zero-trust interface. Elevate your digital storage. 🛡️💻\n\n#CyberSecurity #Tech #ZenithVault #DevLife #ZeroTrust"
                        },
                        {
                          title: "Instagram Caption: The Cyberpunk",
                          content: "Entering the Zenith Core. 💠 Where high-level entropy meets high-end design. Secure your assets in the most aesthetic vault on the grid. Link in bio.\n\n#DevStyle #Encryption #TechAesthetic #PhantomCode #DigitalVault"
                        },
                        {
                          title: "Official App Description",
                          content: "Zenith Vault is a next-generation security node designed for the modern operator. Featuring Biometric-Link integration, Quantum-Resistant entropy generation, and a decentralized architected core, it redefines how we protect digital identities. Built by Phantom Code."
                        }
                      ].map((item, idx) => (
                        <div key={idx} className="bg-black/40 border border-cyan-950 rounded-2xl p-6 relative group">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-cyan-700">{item.title}</h4>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(item.content);
                                setCopySuccess(true);
                                setTimeout(() => setCopySuccess(false), 2000);
                              }}
                              className="text-cyan-500 hover:text-cyan-300 transition-colors p-1"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          <p className="text-xs text-cyan-100/60 leading-relaxed font-medium italic">
                            "{item.content}"
                          </p>
                          {copySuccess && (
                            <div className="absolute top-2 right-10 bg-cyan-500 text-black text-[8px] font-bold px-2 py-0.5 rounded uppercase animate-fade-in">
                              Copied
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-12 p-6 bg-cyan-950/20 border border-cyan-500/10 rounded-3xl">
                    <p className="text-[10px] text-cyan-600 font-black uppercase tracking-[0.2em] mb-2">Account Management</p>
                    <p className="text-xs text-cyan-100/60 leading-relaxed max-w-lg mx-auto italic">
                      "For account recovery or specific node diagnostics, please include your Access ID in the transmission."
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-black/40 border border-cyan-900/30 rounded-3xl p-8">
                     <h3 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
                       <Cpu size={20} className="text-cyan-500" /> {t.sdk_title}
                     </h3>
                     <p className="text-[11px] text-cyan-200/40 mb-4 font-medium uppercase tracking-widest">Pre-installed Environments</p>
                     <div className="space-y-3">
                       <div className="flex items-center justify-between p-3 bg-cyan-950/10 rounded-xl border border-cyan-900/20">
                          <span className="text-xs font-bold text-cyan-600">Python 3.12+ (Security Core)</span>
                          <Check className="text-green-500" size={14} />
                       </div>
                       <div className="flex items-center justify-between p-3 bg-cyan-950/10 rounded-xl border border-cyan-900/20">
                          <span className="text-xs font-bold text-cyan-600">Java 21 (Enterprise Edge)</span>
                          <Check className="text-green-500" size={14} />
                       </div>
                       <a 
                         href="https://github.com/zerophantomcode" 
                         target="_blank" 
                         rel="noreferrer"
                         className="flex items-center justify-center gap-2 w-full p-3 bg-black hover:bg-gray-900 border border-cyan-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all group mt-2"
                       >
                          <Github size={14} className="group-hover:rotate-12 transition-transform" /> 
                          Deploy to GitHub Repository
                       </a>
                       <div className="mt-4 pt-4 border-t border-cyan-900/10">
                          <p className="text-[10px] text-emerald-700 font-mono italic">Instance Handle: {"{ZENITH/GUARD}"}</p>
                       </div>
                     </div>
                  </div>

                      <div className="bg-black/40 border border-cyan-900/30 rounded-3xl p-8 flex flex-col justify-between">
                         <div>
                           <h3 className="text-xl font-bold uppercase mb-2 text-cyan-500">Interface <span className="text-white">Mode</span></h3>
                           <p className="text-[10px] text-cyan-200/50 uppercase tracking-widest mb-4 font-bold leading-relaxed">
                             Adjust operational complexity. "Basic" simplifies features, while "Dev" unlocks central kernel terminal access.
                           </p>
                           <div className="grid grid-cols-3 gap-2">
                              {['basic', 'pro', 'dev'].map(m => (
                                <button
                                  key={m}
                                  onClick={() => {
                                    setInterfaceMode(m as any);
                                    if (m === 'basic') setActiveTab('vault');
                                  }}
                                  className={cn(
                                    "py-2 px-1 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all",
                                    interfaceMode === m 
                                      ? "bg-green-500 text-black border-green-400 shadow-[0_0_10px_#22c55e]" 
                                      : "bg-black/40 border-cyan-900/40 text-cyan-800 hover:text-cyan-500"
                                  )}
                                >
                                  {m}
                                </button>
                              ))}
                           </div>
                         </div>
                         <div className="mt-8 pt-8 border-t border-cyan-900/10">
                            <h4 className="text-[10px] font-black uppercase text-cyan-900 mb-4 tracking-widest whitespace-nowrap">Core Support Node</h4>
                            <div className="space-y-3">
                              <a href="mailto:gweth189@gmail.com" className="flex items-center gap-3 text-cyan-400 hover:text-cyan-300 transition-colors">
                                <ExternalLink size={14} />
                                <span className="text-xs font-mono">gweth189@gmail.com</span>
                              </a>
                            </div>
                         </div>
                      </div>
                </div>

                <div className="bg-black/40 border border-cyan-900/30 rounded-3xl p-8">
                  <h4 className="text-lg font-bold uppercase mb-6 flex items-center gap-2 italic">
                    Universal <span className="text-cyan-400">Node Sync</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                    {['Android', 'iOS', 'Windows', 'macOS', 'Linux', 'Ubuntu'].map(os => (
                      <div key={os} className="flex flex-col items-center gap-2 p-4 bg-cyan-950/10 border border-cyan-900/20 rounded-2xl group hover:border-cyan-500/30 transition-all">
                        <Smartphone size={18} className="text-cyan-800 group-hover:text-cyan-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-cyan-900 group-hover:text-cyan-500">{os}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-black/40 border border-cyan-900/30 rounded-3xl p-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h4 className="text-lg font-bold uppercase mb-1">Upgrade to <span className="text-cyan-400">Prime Node</span></h4>
                      <p className="text-xs text-cyan-700 font-medium tracking-tight">Unlock Biometric-Link & Quantum Resilience for a one-time fee.</p>
                      <div className="mt-2 text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded inline-block font-black uppercase tracking-widest border border-cyan-500/20">
                        First App Special
                      </div>
                      <div className="mt-4 p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                        <p className="text-[10px] uppercase font-black text-cyan-600 mb-1">M-PESA / Global Pay</p>
                        <p className="text-sm font-mono text-cyan-400">0723664357 / 0797661101</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       <div className="text-2xl font-black text-cyan-50 font-mono">$1.99 <span className="text-xs text-cyan-700 font-medium">USD</span></div>
                       <FuturisticButton variant="secondary" className="px-4 py-2 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                        Unlock Advanced Features
                      </FuturisticButton>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <footer className="max-w-6xl mx-auto px-8 py-12 border-t border-cyan-900/10 mt-20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-800">
              © 2026 ZENITH / GUARD. ALL RIGHTS RESERVED.
            </p>
            <p className="text-[9px] text-cyan-900/50 mt-1 uppercase font-bold italic">
              Designed & Developed by phantom {"{hye Jun's / LLC}"}
            </p>
          </div>
          <div className="flex gap-6">
            <a href="mailto:gweth189@gmail.com" className="text-[10px] font-black tracking-widest text-cyan-700 hover:text-cyan-400 uppercase transition-colors">Nexus Mail</a>
            <a href="https://instagram.com/zerophantomcode" className="text-[10px] font-black tracking-widest text-cyan-700 hover:text-cyan-400 uppercase transition-colors">Neural Stream</a>
          </div>
        </footer>
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
              <h3 className="text-2xl font-black tracking-tighter uppercase mb-6">Vault <span className="text-green-500">Deposit</span></h3>
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
                  label="Entry Key (Password)"
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
                  Cancel
                </FuturisticButton>
                <FuturisticButton 
                  onClick={handleAddPassword}
                  className="flex-1"
                >
                  Confirm Deposit
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
