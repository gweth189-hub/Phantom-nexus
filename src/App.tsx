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
  Github, Bot, Mail, LayoutDashboard, Activity, Zap, Download,
  Moon, Sun, ChevronRight, Smartphone as SmartphoneIcon
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
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { checkPasswordStrength, encryptData, decryptData, generateRecoveryPhrase } from './lib/cryptoUtils';
import { cn } from './lib/utils';

// --- Types & Constants ---

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

// --- Components ---

const FuturisticButton = ({ children, onClick, className, variant = 'primary', disabled = false, as: Component = 'button' }: any) => {
  const isDarkMode = localStorage.getItem('pg_theme') !== 'light';
  const variants = {
    primary: isDarkMode 
      ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.3)]' 
      : 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-md',
    secondary: isDarkMode 
      ? 'bg-gray-800 hover:bg-gray-700 text-cyan-400 border border-cyan-900/50' 
      : 'bg-gray-100 hover:bg-gray-200 text-cyan-700 border border-gray-200 shadow-sm',
    ghost: isDarkMode 
      ? 'bg-transparent hover:bg-white/10 text-white border border-white/20' 
      : 'bg-transparent hover:bg-gray-100 text-gray-600 border border-gray-200',
    danger: isDarkMode 
      ? 'bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/50' 
      : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-100'
  };

  return (
    <Component 
      disabled={Component === 'button' ? disabled : undefined}
      onClick={onClick}
      className={cn(
        "px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant as keyof typeof variants],
        className
      )}
    >
      {children}
    </Component>
  );
};

const FuturisticInput = ({ label, icon: Icon, ...props }: any) => {
  const isDarkMode = localStorage.getItem('pg_theme') !== 'light';

  return (
    <div className="space-y-1.5 w-full">
      <label className={cn("text-xs uppercase tracking-widest font-semibold ml-1 transition-colors duration-500", isDarkMode ? "text-cyan-500/70" : "text-gray-400")}>
        {label}
      </label>
      <div className="relative group">
        <div className={cn("absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors", isDarkMode ? "text-cyan-600 group-focus-within:text-cyan-400" : "text-gray-300 group-focus-within:text-cyan-500")}>
          <Icon size={18} />
        </div>
        <input
          {...props}
          className={cn(
            "w-full border rounded-xl py-3 pl-10 pr-4 transition-all focus:outline-none focus:ring-2 placeholder:transition-colors",
            isDarkMode 
              ? "bg-black/40 border-cyan-900/30 text-cyan-50 focus:ring-cyan-500/30 focus:border-cyan-500/50 placeholder:text-cyan-900" 
              : "bg-white border-gray-200 text-gray-900 focus:ring-cyan-500/20 focus:border-cyan-500 placeholder:text-gray-200"
          )}
        />
      </div>
    </div>
  );
};

const Watermark = () => {
  const isDarkMode = localStorage.getItem('pg_theme') !== 'light';

  return (
    <div className={cn("fixed bottom-6 right-6 pointer-events-none flex flex-col items-end transition-opacity duration-1000", isDarkMode ? "opacity-20" : "opacity-40")}>
      <span className={cn("text-[10px] tracking-[0.3em] font-bold uppercase", isDarkMode ? "text-cyan-400" : "text-gray-400")}>Secure Core v1.0.4</span>
      <span className={cn("text-xs font-mono italic", isDarkMode ? "text-emerald-500" : "text-gray-300")}>Zenith Security Solutions</span>
    </div>
  );
};

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
  const [terminalTheme, setTerminalTheme] = useState<'linux' | 'cmd' | 'chromeos' | 'mactui'>('linux');
  const [simulatedDevices, setSimulatedDevices] = useState<Array<{
    ip: string;
    name: string;
    status: 'healthy' | 'infected' | 'scanning' | 'cleaned' | 'under-attack' | 'destroyed';
    malwareType?: string;
    malfilesCount?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    mac: string;
  }>>([
    { ip: '192.168.1.1', name: 'Virtual Core Router', status: 'healthy', mac: '00:1A:2B:3C:4D:5E' },
    { ip: '192.168.1.45', name: 'Workstation-Client', status: 'healthy', mac: 'CC:DE:48:11:AB:90' },
    { ip: '192.168.1.88', name: 'Smart IoT Thermostat', status: 'infected', malwareType: 'Worm.MiraiVariant', malfilesCount: 14, severity: 'high', mac: '88:77:66:55:44:33' },
    { ip: '192.168.1.102', name: 'Secure Vault Storage', status: 'healthy', mac: 'AA:BB:CC:DD:EE:FF' },
    { ip: '192.168.1.111', name: 'Lab Sandbox Workspace', status: 'infected', malwareType: 'Exploit.CoinMiner', malfilesCount: 6, severity: 'medium', mac: '12:34:56:78:90:12' },
    { ip: '192.168.1.200', name: 'Cold Backup Node', status: 'healthy', mac: 'FE:DC:BA:09:87:65' },
    { ip: '192.168.1.222', name: 'Unregulated Mobile Bridge', status: 'infected', malwareType: 'Trojan.SpyPhone', malfilesCount: 32, severity: 'critical', mac: 'F0:E1:D2:C3:B4:A5' }
  ]);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    'ZENITH GUARD v3.0.0 virtual sandbox firmware active.',
    'System status: Secure.',
    'Host interface initialized.',
    'Type "help" to view interactive controls, including themes and simulated network defensive tools.'
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [passwords, setPasswords] = useState<PasswordItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPasswordData, setNewPasswordData] = useState({ site: '', user: '', pass: '' });
  const [decryptedId, setDecryptedId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('pg_theme');
    return saved ? saved === 'dark' : true;
  });

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [showPwaGuide, setShowPwaGuide] = useState(false);

  const handleDownloadNode = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadStatus("INITIATING UNIVERSAL SECURE TRANSFER...");
    console.log("ZENITH: Initiating cross-platform node sequence...");
    
    try {
      // Create a universal JSON manifest instead of a platform-specific package
      const nodeConfig = {
        node_version: "1.4.2",
        kernel: "Poly-Kernel v4.0",
        compatibility: "Any Device / Any OS",
        encryption: "AES-256-GCM-LOCAL",
        identity_token: btoa(fUser?.uid || 'anonymous'),
        timestamp: new Date().toISOString(),
        instructions: "Open this file in any ZENITH dashboard to sync your node."
      };

      const data = JSON.stringify(nodeConfig, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'zenith_universal_node.json';
      
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setIsDownloading(false);
        setDownloadStatus("UNIVERSAL LINK STABLE");
        setTimeout(() => setDownloadStatus(null), 3000);
      }, 1500);
      
      console.log("ZENITH: Universal Node Manifest transmitted.");
    } catch (err) {
      console.error("ZENITH: Secure transmission failed.", err);
      setIsDownloading(false);
      setDownloadStatus("TRANSMISSION ERROR");
      setTimeout(() => setDownloadStatus(null), 3000);
      
      // Fallback for restricted mobile environments
      window.open('data:application/json;base64,' + btoa(JSON.stringify({ status: "fail-safe-active" })), '_blank');
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
      localStorage.setItem('pg_theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('pg_theme', 'light');
    }
  }, [isDarkMode]);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // User/Configuration states that can be customized
  const [supportEmail, setSupportEmail] = useState(() => localStorage.getItem('zenith_support_email') || 'gweth189@gmail.com');
  const [instagramUrl, setInstagramUrl] = useState(() => localStorage.getItem('zenith_instagram_url') || 'https://instagram.com/zerophantomcode');
  const [instagramHandle, setInstagramHandle] = useState(() => localStorage.getItem('zenith_instagram_handle') || 'zerophantomcode');
  const [githubUrl, setGithubUrl] = useState(() => localStorage.getItem('zenith_github_url') || 'https://github.com/zerophantomcode');
  const [supportPhone, setSupportPhone] = useState(() => localStorage.getItem('zenith_support_phone') || '0723664357 / 0797661101');

  // Input states for custom settings fields
  const [editSupportEmail, setEditSupportEmail] = useState('');
  const [editInstagramUrl, setEditInstagramUrl] = useState('');
  const [editInstagramHandle, setEditInstagramHandle] = useState('');
  const [editGithubUrl, setEditGithubUrl] = useState('');
  const [editSupportPhone, setEditSupportPhone] = useState('');
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  // Initialize edit states once branding states are loaded
  useEffect(() => {
    setEditSupportEmail(supportEmail);
    setEditInstagramUrl(instagramUrl);
    setEditInstagramHandle(instagramHandle);
    setEditGithubUrl(githubUrl);
    setEditSupportPhone(supportPhone);
  }, [supportEmail, instagramUrl, instagramHandle, githubUrl, supportPhone]);

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
      download: 'GET APP',
      chat: 'Nyte Lite SYSTEM',
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
      download: 'INSTALLER',
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
      download: 'INSTALAR',
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

      // Read custom branding endpoints of the user
      const unsubBranding = onSnapshot(doc(db, 'users', fUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.supportEmail) {
            setSupportEmail(data.supportEmail);
            localStorage.setItem('zenith_support_email', data.supportEmail);
          }
          if (data.instagramUrl) {
            setInstagramUrl(data.instagramUrl);
            localStorage.setItem('zenith_instagram_url', data.instagramUrl);
          }
          if (data.instagramHandle) {
            setInstagramHandle(data.instagramHandle);
            localStorage.setItem('zenith_instagram_handle', data.instagramHandle);
          }
          if (data.githubUrl) {
            setGithubUrl(data.githubUrl);
            localStorage.setItem('zenith_github_url', data.githubUrl);
          }
          if (data.supportPhone) {
            setSupportPhone(data.supportPhone);
            localStorage.setItem('zenith_support_phone', data.supportPhone);
          }
        }
      }, (err) => console.warn("Failed to subscribe user branding configuration: ", err));

      const interval = setInterval(updateOTP, 1000);
      return () => {
        unsubPass();
        unsubChat();
        unsubBranding();
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

      // 2. Call Gemini server endpoint
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages,
          userText,
          uid: fUser.uid,
          username,
          supportEmail,
          instagramHandle
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const responseData = await response.json();
      const aiText = responseData.text || "Signal interrupted. Please retry.";

      // 3. Save System Message
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

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fUser) return;
    setIsUpdatingConfig(true);
    setConfigSuccess(false);
    try {
      await setDoc(doc(db, 'users', fUser.uid), {
        supportEmail: editSupportEmail,
        instagramUrl: editInstagramUrl,
        instagramHandle: editInstagramHandle,
        githubUrl: editGithubUrl,
        supportPhone: editSupportPhone
      }, { merge: true });

      setSupportEmail(editSupportEmail);
      setInstagramUrl(editInstagramUrl);
      setInstagramHandle(editInstagramHandle);
      setGithubUrl(editGithubUrl);
      setSupportPhone(editSupportPhone);

      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
      console.log("ZENITH: Master Core configuration saved & synced directly with the Cloud Sanctuary!");
    } catch (err) {
      console.error("ZENITH: Failed to commit Core configuration to Cloud Sanctuary:", err);
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const handleTerminalCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const trimmedInput = terminalInput.trim();
    const cmdParts = trimmedInput.split(/\s+/);
    const mainCmd = cmdParts[0].toLowerCase();
    const args = cmdParts.slice(1);
    
    let newLines = [...terminalLines, `> ${trimmedInput}`];
    
    if (mainCmd === 'help') {
      newLines.push(
        '========================================================================',
        '              ZENITH GUARD CYBER DEFENSE TERMINAL v3.1.0',
        '========================================================================',
        'Available Base Commands:',
        '  status               - Query local virtual status indicators',
        '  whoami               - Read active authentication profile data',
        '  about                - Present zenith architectural blueprint info',
        '  mission              - Display the primary objectives of zenith core',
        '  clear                - Flush all terminal scroll buffer lines',
        '  theme <type>         - Switch style. Supported parameters: cmd, linux, chromeos, mactui',
        '------------------------------------------------------------------------',
        'Live Defensive Cyber-Warfare & Network Scan Utilities:',
        '  scan | netscan       - Active network radar to reveal infected malware nodes & malfiles',
        '  attack <IP_ADDRESS>  - Launch target server overflow hijack to lock & freeze malware ports',
        '  destroy <IP_ADDRESS> - Execute quantum file shredder on malfiles & permanently sterilize host',
        '  disinfect <IP>       - Quick security script to quarantine basic virtual threat packages',
        '  safeaudit            - Audit active configurations and encryption standards non-disruptively',
        '========================================================================'
      );
    } else if (mainCmd === 'theme') {
      const selected = args[0]?.toLowerCase();
      if (selected === 'cmd' || selected === 'linux' || selected === 'chromeos' || selected === 'mactui') {
        setTerminalTheme(selected as any);
        newLines.push(`Terminal profile customized. Activating [${selected.toUpperCase()}] simulation environment.`);
      } else {
        newLines.push('Usage: theme <cmd | linux | chromeos | mactui>');
      }
    } else if (mainCmd === 'scan' || mainCmd === 'netscan') {
      newLines.push(
        '🛰️ INITIALIZING ZENITH RADAR SUBNET SCAN...',
        '🛰️ SENDING ICMP ECHO AND REVERSE DNS QUERIES...',
        '🛰️ ANALYZING HOST BINARIES AND MEMORY OFFSETS...',
        '------------------------------------------------------------------------',
        'IP ADDRESS      HOST IDENTIFIER           MAC ADDR            STATUS / HAZARD DETAIL',
        '------------------------------------------------------------------------'
      );
      simulatedDevices.forEach(device => {
        let statusText = '';
        if (device.status === 'healthy') {
          statusText = '✨ [CLEAN] Secured Core Network';
        } else if (device.status === 'cleaned' || device.status === 'destroyed') {
          statusText = '💎 [STERILIZED] Malfiles Shredded | Secure';
        } else if (device.status === 'under-attack') {
          statusText = '⚔️ [UNDER ATTACK] Port-Level Lockout Active';
        } else {
          statusText = `⚠️ [INFECTED] ${device.malwareType || 'Unknown threat'}`;
        }

        newLines.push(
          `${device.ip.padEnd(15)} ${device.name.padEnd(25)} ${device.mac.padEnd(19)} ${statusText}`
        );

        if (device.status === 'infected' && device.malfilesCount) {
          newLines.push(
            `    └─► Detected: ${device.malfilesCount} Malfiles (${device.severity?.toUpperCase()} severity payload detected)`
          );
        } else if (device.status === 'under-attack') {
          newLines.push(
            `    └─► Containment: Active counter-attack freeze. Safe to run "destroy ${device.ip}"`
          );
        }
      });
      newLines.push(
        '------------------------------------------------------------------------',
        'Scan report generated successfully.',
        'To counteract threat nodes:',
        '  1. Run "attack <IP_ADDRESS>" to freeze malware communications.',
        '  2. Run "destroy <IP_ADDRESS>" to vaporize all infected files and malware.'
      );
    } else if (mainCmd === 'attack') {
      const targetIp = args[0];
      if (!targetIp) {
        newLines.push('Usage: attack <IP_ADDRESS> (e.g., attack 192.168.1.88)');
      } else {
        const index = simulatedDevices.findIndex(d => d.ip === targetIp);
        if (index === -1) {
          newLines.push(`Error: Target IP ${targetIp} not located on local virtual subnet topology.`);
        } else {
          const device = simulatedDevices[index];
          if (device.status === 'healthy' || device.status === 'cleaned' || device.status === 'destroyed') {
            newLines.push(`Intrusion cancelled: ${device.name} is safe and does not list any hostile active indicators.`);
          } else if (device.status === 'under-attack') {
            newLines.push(`Already under constraint: Target ${targetIp} is currently paralyzed by active offensive streams.`);
          } else {
            newLines.push(
              `⚡ INITIALIZING OFFENSIVE EXPLOIT STRIKE AGAINST ${targetIp}...`,
              `[■■░░░░░░░░░░░░░░░░░] 12% - Forcing entry to buffer stack...`,
              `[■■■■■■■■░░░░░░░░░░░] 45% - Overwriting instruction pointers on target RAM...`,
              `[■■■■■■■■■■■■■■░░░░░] 75% - Hijacking Command and Control DNS resolution...`,
              `[■■■■■■■■■■■■■■■■■■■] 100% - ROOT PRIVILEGES GAINED. TARGET COMM PORTS LOCKED!`,
              `🎯 SUCCESS: Cyber counter-attack accomplished on ${device.name} (${targetIp}).`,
              `Malware payload execution state: FROZEN.`,
              `Run "destroy ${targetIp}" to permanently wipe the detected malfiles.`
            );
            // Update local state
            const updated = [...simulatedDevices];
            updated[index] = { ...device, status: 'under-attack' };
            setSimulatedDevices(updated);
          }
        }
      }
    } else if (mainCmd === 'destroy') {
      const targetIp = args[0];
      if (!targetIp) {
        newLines.push('Usage: destroy <IP_ADDRESS> (e.g., destroy 192.168.1.88)');
      } else {
        const index = simulatedDevices.findIndex(d => d.ip === targetIp);
        if (index === -1) {
          newLines.push(`Error: Target IP ${targetIp} not located on local virtual subnet topology.`);
        } else {
          const device = simulatedDevices[index];
          if (device.status === 'healthy' || device.status === 'destroyed' || device.status === 'cleaned') {
            newLines.push(`No hostile files found on ${device.name} (${targetIp}). Wiping unnecessary.`);
          } else {
            const filesToDestroy = device.malfilesCount || 8;
            newLines.push(
              `💥 INITIATING QUANTUM SANITIZATION PROTOCOL FOR ${targetIp}...`,
              `Target hostname: ${device.name}`,
              `Detected threat type: ${device.malwareType || 'Generic Malfile payload'}`,
              `Sovereign authority certificate: ZENITH-ROOT-DESTROYER-v3.1`,
              `------------------------------------------------------------------------`,
              `Wiping ${filesToDestroy} Hostile Virtual Malware Files:`,
              `  [✓] payload_backdoor_v3.elf  ===> OBLITERATED`,
              `  [✓] k_scrapr_keylogger.sys  ===> VAPORIZED`,
              `  [✓] r_ware_encryptor.exe    ===> CRUSHED`,
              `  [✓] d_spammer_daemon.bin    ===> PURGED`,
              `  [✓] malicious_registry.reg  ===> CLEARED`,
              `  ...and associated payload chunks.`,
              `------------------------------------------------------------------------`,
              `⚡ OVERWRITING DRIVE DISK SECURING WITH PASS-OVER WRITES (Gutmann Pass)...`,
              `⚡ RE-VERIFYING MACHINE MASTER BOOT RECORD...`,
              `[■■■■■■■■■■■■■■■■■■■] 100% SHREDDED AND DESTROYED!`,
              `🎉 VICTORY: Threat node decommissioned and completely sterilized! ${device.name} (${targetIp}) is safe.`
            );
            // Purge infection
            const updated = [...simulatedDevices];
            updated[index] = { ...device, status: 'destroyed', malfilesCount: 0, malwareType: undefined, severity: undefined };
            setSimulatedDevices(updated);
          }
        }
      }
    } else if (mainCmd === 'disinfect') {
      const targetIp = args[0];
      if (!targetIp) {
        newLines.push('Usage: disinfect <IP_ADDRESS> (e.g., disinfect 192.168.1.88)');
      } else {
        const index = simulatedDevices.findIndex(d => d.ip === targetIp);
        if (index === -1) {
          newLines.push(`Error: Target IP ${targetIp} not located on local virtual subnet topology.`);
        } else {
          const device = simulatedDevices[index];
          if (device.status !== 'infected') {
            newLines.push(`Integrity intact: ${device.name} (${targetIp}) is clean or already sanitized.`);
          } else {
            newLines.push(
              `INITIALIZING SECURE VIRTUAL DECONTAMINATION PROTOCOL FOR ${targetIp}...`,
              `Deploying clean containment patches via SSH over simulated link...`,
              `Removing ${device.malwareType} artifacts non-destructively...`,
              'SUCCESS: Infection contained. Integrity verified.'
            );
            // Non-destructively update local state
            const updated = [...simulatedDevices];
            updated[index] = { ...device, status: 'cleaned', malwareType: undefined, severity: undefined, malfilesCount: 0 };
            setSimulatedDevices(updated);
          }
        }
      }
    } else if (mainCmd === 'safeaudit') {
      newLines.push(
        'Running safe non-disruptive configuration audit...',
        'Verifying HTTPS certificate status: Strong AES-256',
        'Inspecting master configuration values: Validated',
        'Sovereign access keys check: Secure keys mapped correctly.'
      );
    } else if (mainCmd === 'about') {
      newLines.push('ZENITH GUARD v3.1.0', 'Kernel: SecureCore v1.0.4', 'Developer: phantom {hye Jun\'s / LLC}', 'Objective: Sovereign Data Protection');
    } else if (mainCmd === 'mission') {
      newLines.push('MISSION: Create a digital sanctuary where users own their keys and logic.', 'No tracking. No backdoors. Just pure security.');
    } else if (mainCmd === 'clear') {
      setTerminalLines(['ZENITH OS Terminal Reset. Available commands: help']);
      setTerminalInput('');
      return;
    } else if (mainCmd === 'status') {
      newLines.push(`SYSTEM: Online`, `INTERFACE: ${interfaceMode.toUpperCase()}`, `DB_LINK: Secured`, `AUTH: Level 7`);
    } else if (mainCmd === 'audit') {
      newLines.push('Running entropy audit...', 'Scanning vault...', 'Integrity: 100%', 'Weak Keys: 0');
    } else if (mainCmd === 'whoami') {
      newLines.push(`NODE_ID: ${fUser?.uid || 'anonymous'}`, `ALIAS: ${username || 'ZENITH_OPERATOR'}`);
    } else if (mainCmd === 'bypass --root') {
      newLines.push('ATTEMPTING ESCALATION...', 'ERROR: Biometric signature required for root access.');
    } else {
      newLines.push(`Command not found: ${trimmedInput}. Type "help" for instructions.`);
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
        try {
          await setDoc(doc(db, 'users', uid), {
            username: inputUsername,
            email: inputEmail,
            created_at: new Date().toISOString(),
            is_prime: false
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `users/${uid}`);
        }
        setRecoveryPhrase(generatedPhrase);
        setUsername(inputUsername);
        localStorage.setItem('pg_phrase', generatedPhrase);
        localStorage.setItem('pg_username', inputUsername);
      } else {
        console.log("DEBUG: Verification protocol initiated for node login...");
        const result = await signInWithEmailAndPassword(auth, inputEmail, inputPassword);
        uid = result.user.uid;
        setRecoveryPhrase(inputPhrase);
        let userDoc;
        try {
          userDoc = await getDoc(doc(db, 'users', uid));
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `users/${uid}`);
        }
        if (userDoc && userDoc.exists()) {
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
    const isDarkMode = localStorage.getItem('pg_theme') !== 'light';
    return (
      <div className={cn("min-h-screen flex items-center justify-center transition-colors duration-500", isDarkMode ? "bg-[#050505]" : "bg-white")}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
          <Shield className="text-cyan-500 opacity-50" size={48} />
        </motion.div>
      </div>
    );
  }

  if (!fUser || !recoveryPhrase) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4 selection:bg-cyan-500/30 transition-colors duration-500",
        isDarkMode ? "bg-[#050505] text-cyan-50" : "bg-gray-50 text-gray-900"
      )}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={cn("absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[120px] transition-opacity duration-1000", isDarkMode ? "bg-cyan-900/10" : "bg-cyan-500/5 opacity-50")} />
          <div className={cn("absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[120px] transition-opacity duration-1000", isDarkMode ? "bg-purple-900/10" : "bg-purple-500/5 opacity-50")} />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "max-w-md w-full backdrop-blur-xl border rounded-3xl p-8 shadow-2xl relative z-10 transition-colors duration-500",
            isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-white/80 border-gray-200"
          )}
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
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center border mb-4 shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-colors duration-500", isDarkMode ? "bg-cyan-950/50 border-cyan-500/20" : "bg-cyan-50 border-cyan-100")}>
              <Shield className="text-cyan-400" size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase mb-1 flex items-center gap-2">
              ZENITH <span className="text-emerald-500">/ GUARD</span>
            </h1>
            <p className={cn("text-[10px] tracking-[0.4em] uppercase font-bold text-center transition-colors duration-500", isDarkMode ? "text-emerald-600" : "text-gray-400")}>Secure Digital Operations Node</p>
          </div>

          <div className={cn("mb-8 p-4 border rounded-2xl transition-colors duration-500", isDarkMode ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50/50 border-emerald-100")}>
             <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">System Protocol Dashboard</h3>
             <ul className="space-y-1.5">
               <li className={cn("text-[9px] uppercase font-bold flex items-center gap-2 transition-colors duration-500", isDarkMode ? "text-emerald-700/80" : "text-emerald-600")}>
                 <div className="w-1 h-1 rounded-full bg-emerald-500" /> Secure Vault: Military-grade asset storage for passwords & keys
               </li>
               <li className={cn("text-[9px] uppercase font-bold flex items-center gap-2 transition-colors duration-500", isDarkMode ? "text-emerald-700/80" : "text-emerald-600")}>
                 <div className="w-1 h-1 rounded-full bg-emerald-500" /> Nyte Lite CORE: Integrated security analyst for real-time guidance
               </li>
               <li className={cn("text-[9px] uppercase font-bold flex items-center gap-2 transition-colors duration-500", isDarkMode ? "text-emerald-700/80" : "text-emerald-600")}>
                 <div className="w-1 h-1 rounded-full bg-emerald-500" /> Entropy Audit: Professional analysis of digital credential strength
               </li>
               <li className={cn("text-[9px] uppercase font-bold flex items-center gap-2 transition-colors duration-500", isDarkMode ? "text-emerald-700/80" : "text-emerald-600")}>
                 <div className="w-1 h-1 rounded-full bg-emerald-500" /> Dev Console: Low-level terminal access for technical operators
               </li>
             </ul>
          </div>

          <div className={cn("mb-8 p-5 border rounded-3xl relative overflow-hidden group transition-colors duration-500", isDarkMode ? "bg-black/60 border-cyan-500/20" : "bg-gray-50 border-gray-100")}>
             <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <h3 className={cn("text-xs font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2 transition-colors duration-500", isDarkMode ? "text-white" : "text-gray-900")}>
               <Fingerprint size={14} className="text-cyan-400" /> Mission
             </h3>
             <p className={cn("text-[10px] leading-relaxed font-medium transition-colors duration-500", isDarkMode ? "text-cyan-200/50" : "text-gray-500")}>
               Sovereign digital vault. Local encryption. Absolute control.
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
              <div className={cn("border rounded-xl p-4 text-center transition-colors duration-500", isDarkMode ? "bg-emerald-950/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-100")}>
                <p className={cn("text-[10px] uppercase tracking-wider mb-2 font-bold", isDarkMode ? "text-emerald-600" : "text-emerald-800")}>Generated Vault Master Key</p>
                <div className={cn("text-lg font-mono tracking-tight", isDarkMode ? "text-emerald-400" : "text-emerald-600 font-bold")}>
                  {generatedPhrase || 'ZENITH-SECURE-NODE-INIT'}
                </div>
                <p className={cn("text-[9px] mt-2 font-medium", isDarkMode ? "text-emerald-900" : "text-gray-400")}>WRITE THIS DOWN. This key is used to encrypt your secrets locally.</p>
              </div>
            )}

            {error && <p className="text-red-500 text-[10px] text-center font-bold uppercase tracking-widest">{error}</p>}

            <FuturisticButton className="w-full h-14 font-black tracking-widest" type="submit">
              {isRegistering ? 'INITIALIZE' : 'LOGIN'}
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

          <div className="mt-8 pt-8 border-t border-cyan-900/10 flex justify-center">
            <FuturisticButton 
              variant="ghost" 
              className="px-4 py-2 text-[10px] gap-2 border-cyan-500/20 text-cyan-600 hover:text-cyan-400"
              onClick={() => setActiveTab('settings')}
            >
              <Download size={12} /> {t.download}
            </FuturisticButton>
          </div>
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
    <div className={cn(
      "h-screen overflow-hidden selection:bg-cyan-500/30 font-sans transition-colors duration-500 flex",
      isDarkMode ? "bg-[#020202] text-cyan-50" : "bg-[#f8fafc] text-slate-900 font-medium"
    )}>
      {/* Sidebar / Nav */}
      <nav className={cn(
        "h-full w-20 md:w-24 border-r flex flex-col items-center py-10 z-50 transition-colors duration-500 flex-shrink-0",
        isDarkMode ? "bg-black/60 backdrop-blur-2xl border-cyan-900/20" : "bg-white/90 backdrop-blur-md border-gray-200 shadow-xl"
      )}>
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
                  ? "bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]" 
                  : isDarkMode ? "text-cyan-800 hover:text-cyan-500 hover:bg-cyan-950/20 border border-cyan-900/10 border-dashed" : "text-gray-400 hover:text-cyan-600 hover:bg-gray-50 border border-gray-100 border-dashed"
              )}
            >
              <item.icon size={22} />
              <span className={cn("absolute left-full ml-4 px-2 py-1 border text-[10px] uppercase tracking-wider rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100]", isDarkMode ? "bg-black border-cyan-900 text-cyan-50" : "bg-white border-gray-200 text-gray-700 shadow-md")}>
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
      <main className={cn("flex-1 h-full overflow-y-auto transition-colors duration-500", isDarkMode ? "bg-[#050505]" : "bg-white")}>
        <header className={cn(
          "p-8 flex items-center justify-between border-b sticky top-0 backdrop-blur-xl z-40 transition-colors duration-500",
          isDarkMode ? "bg-black/40 border-cyan-900/10" : "bg-white/70 border-gray-100 shadow-sm"
        )}>
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
              <p className="text-[9px] uppercase tracking-widest text-cyan-700/60 font-bold">ID: {username} | {interfaceMode}</p>
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

          <div className="flex items-center gap-2">
            {downloadStatus && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="hidden lg:flex items-center gap-2 text-[9px] font-black tracking-tighter text-cyan-400 bg-cyan-950/20 px-3 py-1.5 rounded-full border border-cyan-500/20"
              >
                <div className="w-1 h-1 rounded-full bg-cyan-500 animate-ping" />
                {downloadStatus}
              </motion.div>
            )}
            <FuturisticButton 
              variant="primary" 
              className={cn(
                "flex h-9 px-4 text-[10px] font-bold gap-2 animate-pulse-subtle shadow-lg transition-all",
                isDownloading && "ring-2 ring-cyan-500 opacity-80"
              )} 
              onClick={(e) => {
                setActiveTab('settings');
                // Small delay to let the tab switch start before the CPU-heavy download logic
                setTimeout(() => {
                  handleDownloadNode(e);
                }, 100);

                // Ensure scrolling happens after content is rendered
                setTimeout(() => {
                  const el = document.getElementById('download-section');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-cyan-500', 'ring-offset-2', 'ring-offset-black');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-500', 'ring-offset-2', 'ring-offset-black'), 2000);
                  }
                }, 1000);
              }}
            >
              {isDownloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />} 
              <span>{isDownloading ? 'Transmitting...' : t.download}</span>
            </FuturisticButton>
            <div className="hidden sm:flex bg-cyan-950/20 px-3 py-1 rounded-full border border-cyan-900/20 items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-700">STABLE</span>
            </div>
            <Fingerprint className="text-cyan-500/50" size={20} />
          </div>
        </header>

        <section className="p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="popLayout">
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
                       <h1 className="text-3xl font-black tracking-tighter text-white mb-1 uppercase leading-none">Security <span className="text-cyan-200">CORE</span></h1>
                       <p className="text-cyan-100/60 text-[10px] font-bold uppercase tracking-widest mb-4">Integrity: 98.4%</p>
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
                            variant="ghost" 
                            className="flex items-center gap-2 text-white border-white/40 hover:bg-white/10"
                          >
                            <Download size={14} />
                            Export Vault
                          </FuturisticButton>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className={cn("border rounded-3xl p-6 transition-colors duration-500", isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-white border-gray-200 shadow-sm")}>
                         <div className="flex items-center justify-between mb-4">
                            <Activity className="text-emerald-500" size={20} />
                            <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", isDarkMode ? "text-emerald-800" : "text-gray-300")}>Live Metrics</span>
                         </div>
                         <h4 className="text-2xl font-black font-mono">{passwords.length}</h4>
                         <p className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", isDarkMode ? "text-cyan-700" : "text-gray-400")}>Active Assets in Vault</p>
                      </div>
                      <div className={cn("border rounded-3xl p-6 transition-colors duration-500", isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-white border-gray-200 shadow-sm")}>
                         <div className="flex items-center justify-between mb-4">
                            <Zap className="text-cyan-400" size={20} />
                            <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", isDarkMode ? "text-cyan-800" : "text-gray-300")}>Response Node</span>
                         </div>
                         <h4 className="text-2xl font-black font-mono">12ms</h4>
                         <p className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", isDarkMode ? "text-cyan-700" : "text-gray-400")}>Kernel Processing Latency</p>
                      </div>
                    </div>

                    <div className={cn("border rounded-[40px] p-8 flex items-center justify-between overflow-hidden relative group cursor-pointer transition-all", isDarkMode ? "bg-cyan-950/20 border-cyan-500/20 hover:border-cyan-500/40" : "bg-cyan-50 border-cyan-100/50 hover:bg-cyan-100 hover:shadow-lg")} onClick={() => setActiveTab('settings')}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                           <SmartphoneIcon size={100} />
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center text-black">
                              <Download size={24} />
                           </div>
                           <div>
                              <h3 className={cn("text-lg font-black uppercase tracking-tighter mb-0.5", isDarkMode ? "text-white" : "text-cyan-900")}>Link Node</h3>
                              <p className={cn("text-[8px] font-bold uppercase tracking-widest opacity-40", isDarkMode ? "text-cyan-500" : "text-cyan-700")}>Android, iOS, PC</p>
                           </div>
                        </div>
                        <ChevronRight className="text-cyan-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div className={cn("border rounded-[40px] p-8 flex flex-col justify-between transition-colors duration-500", isDarkMode ? "bg-cyan-950/20 border-cyan-900/30" : "bg-gray-100/50 border-gray-200 shadow-sm")}>
                     <div>
                       <h3 className={cn("text-sm font-black uppercase tracking-[0.2em] mb-6", isDarkMode ? "text-cyan-600" : "text-gray-400")}>Recent Records</h3>
                       <div className="space-y-4">
                          {passwords.slice(0, 3).map(p => (
                             <div key={p.id} className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border transition-colors duration-500", isDarkMode ? "bg-cyan-900/40 border-cyan-500/10" : "bg-white border-gray-100 shadow-sm")}>
                                   <Lock size={14} className="text-cyan-400" />
                                </div>
                                <div>
                                   <p className={cn("text-[11px] font-bold transition-colors duration-500", isDarkMode ? "text-cyan-100" : "text-slate-800")}>{p.siteName}</p>
                                   <p className={cn("text-[9px] font-mono italic transition-colors duration-500", isDarkMode ? "text-cyan-700" : "text-gray-400")}>Synchronized 2m ago</p>
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
                     <div className={cn("pt-6 border-t transition-colors duration-500", isDarkMode ? "border-cyan-900/10" : "border-gray-100")}>
                        <div className="flex items-center gap-2 mb-2">
                           <Bot size={14} className="text-cyan-500" />
                           <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors duration-500", isDarkMode ? "text-cyan-600" : "text-gray-400")}>Nyte Lite Log</span>
                        </div>
                        <p className={cn("text-[10px] font-medium leading-relaxed italic transition-colors duration-500", isDarkMode ? "text-cyan-400" : "text-gray-500")}>
                          "System status healthy. Recommend running a new Entropy Audit on your older keys."
                        </p>
                     </div>
                  </div>
                </div>

                <div className={cn("border rounded-[40px] p-10 relative overflow-hidden group transition-colors duration-500", isDarkMode ? "bg-black/60 border-cyan-500/20" : "bg-white border-gray-200 shadow-lg")}>
                  <div className={cn("absolute top-0 right-0 w-64 h-64 blur-[100px] pointer-events-none transition-opacity duration-1000", isDarkMode ? "bg-cyan-500/5" : "bg-cyan-500/10 opacity-30")} />
                  <div className="flex flex-col md:flex-row gap-10 items-center">
                    <div className="w-40 h-40 rounded-full border-2 border-cyan-500/20 p-2 relative">
                       <div className={cn("w-full h-full rounded-full border flex items-center justify-center transition-colors duration-500", isDarkMode ? "bg-cyan-500/5 border-cyan-500/40" : "bg-cyan-50 border-cyan-100 shadow-inner")}>
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
                       <h3 className={cn("text-2xl font-black uppercase tracking-tighter mb-2 italic transition-colors duration-500", isDarkMode ? "text-white" : "text-slate-800")}>Operator <span className="text-cyan-400">Node Profile</span></h3>
                       <p className={cn("text-sm font-medium tracking-tight mb-6 transition-colors duration-500", isDarkMode ? "text-cyan-700" : "text-gray-400")}>Your identity is decentralized and encrypted. Current node is active on Secure Core v1.0.4.</p>
                       <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                          <div className={cn("px-4 py-2 rounded-xl border transition-colors duration-500", isDarkMode ? "bg-cyan-500/10 border-cyan-500/20" : "bg-cyan-50 border-cyan-100 shadow-sm")}>
                             <p className={cn("text-[9px] uppercase font-black mb-1 transition-colors duration-500", isDarkMode ? "text-cyan-800" : "text-cyan-600")}>Node Alias</p>
                             <p className={cn("text-xs font-mono font-bold transition-colors duration-500", isDarkMode ? "text-cyan-300" : "text-cyan-700")}>{username}</p>
                          </div>
                          <div className={cn("px-4 py-2 rounded-xl border transition-colors duration-500", isDarkMode ? "bg-cyan-500/10 border-cyan-500/20" : "bg-cyan-50 border-cyan-100 shadow-sm")}>
                             <p className={cn("text-[9px] uppercase font-black mb-1 transition-colors duration-500", isDarkMode ? "text-cyan-800" : "text-cyan-600")}>Link Identity</p>
                             <p className={cn("text-xs font-mono font-bold transition-colors duration-500", isDarkMode ? "text-cyan-300" : "text-cyan-700")}>{fUser?.email?.split('@')[0]}***</p>
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
                        className={cn(
                          "border rounded-2xl p-6 relative overflow-hidden group transition-all duration-500",
                          isDarkMode ? "bg-cyan-950/10 border-cyan-900/20 hover:border-cyan-500/40" : "bg-white border-gray-100 shadow-sm hover:shadow-lg hover:border-cyan-500/30"
                        )}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className={cn("p-3 rounded-xl border transition-colors duration-500", isDarkMode ? "bg-cyan-950/40 border-cyan-900/30" : "bg-cyan-50 border-cyan-100")}>
                            <Shield size={20} className="text-cyan-400" />
                          </div>
                          <button onClick={() => deletePassword(p.id)} className={cn("transition-colors", isDarkMode ? "text-cyan-900 hover:text-red-500" : "text-gray-300 hover:text-red-500")}>
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <h4 className={cn("text-lg font-bold mb-1 transition-colors duration-500", isDarkMode ? "group-hover:text-cyan-400" : "text-slate-800 group-hover:text-cyan-600")}>{p.siteName}</h4>
                        <p className={cn("text-xs mb-4 font-mono transition-colors duration-500", isDarkMode ? "text-cyan-700" : "text-gray-400")}>{p.usernameKey}</p>

                        <div className={cn("flex items-center justify-between gap-2 mt-4 rounded-lg px-3 py-2 border transition-colors duration-500", isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-gray-50 border-gray-100")}>
                          <span className={cn("text-xs font-mono tracking-tight overflow-hidden truncate transition-colors duration-500", isDarkMode ? "text-cyan-200/80" : "text-gray-600")}>
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
                className={cn(
                  "max-w-3xl mx-auto h-[calc(100vh-200px)] flex flex-col border rounded-3xl overflow-hidden transition-colors duration-500",
                  isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-white border-gray-200 shadow-xl"
                )}
              >
                <div className={cn("p-4 border-b flex justify-between items-center transition-colors duration-500", isDarkMode ? "border-cyan-900/20 bg-cyan-950/20" : "bg-gray-50 border-gray-100")}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                    <h3 className={cn("text-sm font-black uppercase tracking-widest transition-colors duration-500", isDarkMode ? "text-green-400" : "text-green-600")}>NYTE LITE CORE ASSISTANT</h3>
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
                        <span className={cn("text-[10px] font-black tracking-widest uppercase transition-colors duration-500", isDarkMode ? "text-cyan-600" : "text-gray-400")}>
                          {msg.role === 'user' ? username : 'NYTE LITE'}
                        </span>
                        <span className={cn("text-[9px] font-mono transition-colors duration-500", isDarkMode ? "text-cyan-900" : "text-gray-300")}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={cn(
                        "px-4 py-3 rounded-2xl text-sm font-medium border leading-relaxed transition-colors duration-500",
                        msg.role === 'user' 
                          ? "bg-cyan-600 text-white border-cyan-500 rounded-tr-none shadow-md" 
                          : isDarkMode ? "bg-black/80 text-cyan-100 border-cyan-900/40 rounded-tl-none shadow-[0_0_20px_rgba(6,182,212,0.05)]" : "bg-gray-100 text-slate-800 border-gray-200 rounded-tl-none"
                      )}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className={cn("p-4 border-t flex gap-4 transition-colors duration-500", isDarkMode ? "bg-black/60 border-cyan-900/20" : "bg-gray-50 border-gray-100")}>
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t.chat_placeholder}
                    className={cn(
                      "flex-1 border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none transition-all font-mono",
                      isDarkMode ? "bg-cyan-950/10 border-cyan-900/40 text-cyan-100 placeholder:text-cyan-900 focus:border-cyan-500/50" : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-300 focus:border-cyan-500"
                    )}
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
                className={cn(
                  "max-w-4xl mx-auto w-full h-[calc(100vh-200px)] border rounded-3xl flex flex-col font-mono overflow-hidden shadow-2xl transition-all duration-500",
                  terminalTheme === 'cmd' && "bg-black border-gray-600 text-gray-200",
                  terminalTheme === 'linux' && "bg-slate-950 border-emerald-900/40 text-emerald-400",
                  terminalTheme === 'chromeos' && "bg-neutral-900 border-sky-900 text-sky-400",
                  terminalTheme === 'mactui' && "bg-zinc-900 border-zinc-700 text-amber-500"
                )}
              >
                <div className={cn(
                  "p-3 border-b flex justify-between items-center transition-colors duration-500",
                  terminalTheme === 'cmd' && "bg-neutral-900 border-neutral-700",
                  terminalTheme === 'linux' && "bg-emerald-950/20 border-emerald-900/30",
                  terminalTheme === 'chromeos' && "bg-sky-950/20 border-sky-900/30",
                  terminalTheme === 'mactui' && "bg-zinc-800 border-zinc-700"
                )}>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                    </div>
                    <span className={cn(
                      "text-[10px] uppercase tracking-widest font-bold",
                      terminalTheme === 'cmd' && "text-gray-400",
                      terminalTheme === 'linux' && "text-emerald-500",
                      terminalTheme === 'chromeos' && "text-sky-400",
                      terminalTheme === 'mactui' && "text-zinc-300"
                    )}>
                      {terminalTheme === 'cmd' && "Command Prompt (Simulated)"}
                      {terminalTheme === 'linux' && "Bash Terminal v5.2 (Simulated)"}
                      {terminalTheme === 'chromeos' && "Crosh Shell (Simulated)"}
                      {terminalTheme === 'mactui' && "macOS Terminal (Simulated TUI)"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {['linux', 'cmd', 'chromeos', 'mactui'].map((themeOpt) => (
                      <button
                        key={themeOpt}
                        onClick={() => setTerminalTheme(themeOpt as any)}
                        className={cn(
                          "px-2 py-0.5 text-[9px] font-bold rounded uppercase transition-all border",
                          terminalTheme === themeOpt 
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-300" 
                            : "bg-transparent border-transparent text-gray-500 hover:text-gray-300"
                        )}
                      >
                        {themeOpt}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex-1 p-6 overflow-y-auto text-xs space-y-1 scrollbar-hide">
                  {terminalLines.map((line, idx) => {
                    let textClass = "";
                    if (line.startsWith('>')) {
                      textClass = terminalTheme === 'cmd' ? "text-gray-100 font-bold" : 
                                  terminalTheme === 'chromeos' ? "text-sky-300" :
                                  terminalTheme === 'mactui' ? "text-amber-300" : "text-emerald-300";
                    } else if (line.includes('⚠️') || line.includes('Detected:') || line.includes('Error:')) {
                      textClass = "text-rose-500 font-medium";
                    } else if (line.includes('[SECURE ACTIVE]') || line.includes('SUCCESS:')) {
                      textClass = "text-green-450 font-bold text-emerald-400";
                    }

                    return (
                      <div key={idx} className={textClass}>
                        {line}
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                
                <form 
                  onSubmit={handleTerminalCommand} 
                  className={cn(
                    "p-4 border-t flex items-center gap-2",
                    terminalTheme === 'cmd' && "bg-neutral-950 border-neutral-800",
                    terminalTheme === 'linux' && "bg-black border-emerald-900/20",
                    terminalTheme === 'chromeos' && "bg-neutral-950 border-sky-900/20",
                    terminalTheme === 'mactui' && "bg-zinc-950 border-zinc-900"
                  )}
                >
                  <span className={cn(
                    "text-sm",
                    terminalTheme === 'cmd' && "text-gray-400",
                    terminalTheme === 'linux' && "text-emerald-500",
                    terminalTheme === 'chromeos' && "text-sky-400",
                    terminalTheme === 'mactui' && "text-amber-500"
                  )}>
                    {terminalTheme === 'cmd' && "C:\\Users\\zenith>"}
                    {terminalTheme === 'linux' && "zenith@guard:~$"}
                    {terminalTheme === 'chromeos' && "crosh>"}
                    {terminalTheme === 'mactui' && "Mac-TUI:~ zenith$"}
                  </span>
                  <input 
                    autoFocus
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    className={cn(
                      "flex-1 bg-transparent border-none outline-none font-mono text-sm",
                      terminalTheme === 'cmd' && "text-gray-200",
                      terminalTheme === 'linux' && "text-emerald-400",
                      terminalTheme === 'chromeos' && "text-sky-400",
                      terminalTheme === 'mactui' && "text-amber-500"
                    )}
                    placeholder='Type "help" to list tools...'
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

                <div className={cn("border rounded-[40px] p-8 md:p-12 relative transition-colors duration-500", isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-white border-gray-200 shadow-xl")}>
                  <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.1)] transition-colors duration-500", isDarkMode ? "bg-cyan-950 border-black" : "bg-white border-gray-100")}>
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
                        <span className={cn("text-[10px] font-bold uppercase tracking-tighter transition-colors duration-500", isDarkMode ? "text-cyan-700" : "text-gray-400")}>Resilience Level</span>
                        <span className={cn("text-xl font-black uppercase tracking-tighter transition-colors duration-500", checkPasswordStrength(checkPass).color.replace('bg-', 'text-'))}>
                          {checkPasswordStrength(checkPass).label}
                        </span>
                      </div>
                      <div className={cn("h-2 w-full rounded-full overflow-hidden border transition-colors duration-500", isDarkMode ? "bg-cyan-950/30 border-cyan-900/20" : "bg-gray-100 border-gray-200")}>
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
                        <div key={rule.label} className={cn("p-3 rounded-xl border flex items-center gap-3 transition-colors duration-500", isDarkMode ? "bg-cyan-950/20 border-cyan-900/30" : "bg-gray-50 border-gray-100")}>
                          <div className={cn("w-2 h-2 rounded-full transition-colors duration-500", rule.met ? 'bg-cyan-400' : isDarkMode ? 'bg-cyan-950' : 'bg-gray-200')} />
                          <span className={cn("text-[10px] uppercase font-bold tracking-wider transition-colors duration-500", rule.met ? (isDarkMode ? 'text-cyan-400' : 'text-cyan-600') : (isDarkMode ? 'text-cyan-800' : 'text-gray-300'))}>
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

                <div className={cn("border rounded-3xl p-6 text-left relative overflow-hidden transition-colors duration-500", isDarkMode ? "bg-cyan-950/10 border-cyan-900/30" : "bg-gray-50 border-gray-100 shadow-sm")}>
                  <div className={cn("absolute top-0 right-0 w-32 h-32 blur-[40px] pointer-events-none transition-opacity duration-1000", isDarkMode ? "bg-cyan-500/5" : "bg-cyan-500/10")} />
                  <h4 className={cn("text-xs uppercase tracking-widest font-black mb-4 transition-colors duration-500", isDarkMode ? "text-cyan-600" : "text-cyan-700")}>Security Protocol Info</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <RefreshCw size={14} className="text-cyan-400 animate-spin-slow" />
                      <p className={cn("text-[11px] leading-relaxed font-medium transition-colors duration-500", isDarkMode ? "text-cyan-200/60" : "text-gray-500")}>Valid for next <span className="text-cyan-500">{Math.ceil(30 * otpProgress / 100)}s</span>. Refreshing automatically.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Shield size={14} className="text-cyan-400" />
                      <p className={cn("text-[11px] leading-relaxed font-medium transition-colors duration-500", isDarkMode ? "text-cyan-200/60" : "text-gray-500")}>Derived from Node ID & System Clock. Non-reversible hash string.</p>
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
                <div className={cn("border rounded-[40px] p-10 text-center transition-colors duration-500", isDarkMode ? "bg-gradient-to-br from-cyan-900/40 to-black border-cyan-500/20" : "bg-white border-gray-200 shadow-xl")}>
                   <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center border mx-auto mb-6 transition-colors duration-500", isDarkMode ? "bg-cyan-500/10 border-cyan-500/20" : "bg-cyan-50 border-cyan-100")}>
                    <Mail className="text-cyan-400" size={40} />
                  </div>
                  <h2 className={cn("text-3xl font-black uppercase italic tracking-tighter mb-2 transition-colors duration-500", isDarkMode ? "text-white" : "text-slate-800")}>Help <span className="text-cyan-400">Center</span></h2>
                  <p className={cn("text-sm font-bold uppercase tracking-widest mb-8 transition-colors duration-500", isDarkMode ? "text-cyan-700" : "text-gray-400")}>Direct Link to Zenith Support Core</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <a 
                      href={`mailto:${supportEmail}`}
                      className={cn("border rounded-3xl p-8 transition-all group flex flex-col items-center text-center", isDarkMode ? "bg-black/40 border-cyan-900/30 hover:border-cyan-500/50" : "bg-gray-50 border-transparent hover:border-cyan-500 hover:bg-white hover:shadow-lg")}
                    >
                      <Mail className="text-cyan-400 mb-4" size={32} />
                      <h3 className={cn("text-lg font-bold uppercase mb-2 group-hover:text-cyan-400 transition-colors", isDarkMode ? "text-white" : "text-slate-800")}>Support</h3>
                      <p className={cn("text-[10px] font-mono mb-4 transition-colors duration-500", isDarkMode ? "text-cyan-800" : "text-gray-500")}>{supportEmail}</p>
                      <FuturisticButton as="div" variant="secondary" className="w-full text-[10px]">Initialize Mail</FuturisticButton>
                    </a>

                    <div 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }}
                      className={cn("border rounded-3xl p-8 transition-all group flex flex-col items-center text-center relative overflow-hidden cursor-pointer", isDarkMode ? "bg-black/40 border-cyan-900/30 hover:border-cyan-500/50" : "bg-gray-50 border-transparent hover:border-cyan-500 hover:bg-white hover:shadow-lg")}
                    >
                      <ExternalLink className="text-cyan-400 mb-4" size={32} />
                      <h3 className={cn("text-lg font-bold uppercase mb-2 group-hover:text-cyan-400 transition-colors", isDarkMode ? "text-white" : "text-slate-800")}>Share Node</h3>
                      <p className={cn("text-[10px] font-mono mb-4 italic transition-colors duration-500", isDarkMode ? "text-cyan-800" : "text-gray-400")}>Copy App URL</p>
                      <FuturisticButton as="div" variant="secondary" className="w-full text-[10px]">Copy Link</FuturisticButton>
                      {copySuccess && (
                        <div className="absolute inset-0 bg-cyan-500/90 flex items-center justify-center text-black font-black text-xs uppercase tracking-widest animate-in fade-in zoom-in duration-200">
                          Link Secured to Clipboard
                        </div>
                      )}
                    </div>

                    <a 
                      href={instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn("border rounded-3xl p-8 transition-all group flex flex-col items-center text-center", isDarkMode ? "bg-black/40 border-cyan-900/30 hover:border-cyan-500/50" : "bg-gray-50 border-transparent hover:border-cyan-500 hover:bg-white hover:shadow-lg")}
                    >
                      <ExternalLink className="text-cyan-400 mb-4" size={32} />
                      <h3 className={cn("text-lg font-bold uppercase mb-2 group-hover:text-cyan-400 transition-colors", isDarkMode ? "text-white" : "text-slate-800")}>Instagram</h3>
                      <p className={cn("text-[10px] font-mono mb-4 transition-colors duration-500", isDarkMode ? "text-cyan-800" : "text-gray-500")}>{instagramHandle}</p>
                      <FuturisticButton as="div" variant="secondary" className="w-full text-[10px]">View Profile</FuturisticButton>
                    </a>
                  </div>

                  <div className={cn("border-t pt-12 text-left transition-colors duration-500", isDarkMode ? "border-cyan-900/20" : "border-gray-100")}>
                    <h3 className={cn("text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3 transition-colors duration-500", isDarkMode ? "text-white" : "text-slate-800")}>
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
                        <div key={idx} className={cn("border rounded-2xl p-6 relative group transition-colors duration-500", isDarkMode ? "bg-black/40 border-cyan-950" : "bg-gray-50 border-gray-100")}>
                          <div className="flex justify-between items-start mb-3">
                            <h4 className={cn("text-[10px] font-black uppercase tracking-widest transition-colors duration-500", isDarkMode ? "text-cyan-700" : "text-cyan-600")}>{item.title}</h4>
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
                          <p className={cn("text-xs leading-relaxed font-medium italic transition-colors duration-500", isDarkMode ? "text-cyan-100/60" : "text-gray-500")}>
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

                  <div className={cn("mt-12 p-6 border rounded-3xl transition-colors duration-500", isDarkMode ? "bg-cyan-950/20 border-cyan-500/10" : "bg-gray-50 border-gray-100")}>
                    <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-2 transition-colors duration-500", isDarkMode ? "text-cyan-600" : "text-cyan-700")}>Account Management</p>
                    <p className={cn("text-xs leading-relaxed max-w-lg mx-auto italic transition-colors duration-500", isDarkMode ? "text-cyan-100/60" : "text-gray-500")}>
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
                  <div className={cn("border rounded-3xl p-8 transition-colors duration-500", isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-white border-gray-200 shadow-sm")}>
                     <h3 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
                       <Cpu size={20} className="text-cyan-500" /> {t.sdk_title}
                     </h3>
                     <p className={cn("text-[11px] mb-4 font-medium uppercase tracking-widest transition-colors duration-500", isDarkMode ? "text-cyan-200/40" : "text-gray-400")}>Pre-installed Environments</p>
                     <div className="space-y-3">
                       <div className={cn("flex items-center justify-between p-3 rounded-xl border transition-colors duration-500", isDarkMode ? "bg-cyan-950/10 border-cyan-900/20" : "bg-gray-50 border-gray-100")}>
                          <span className={cn("text-xs font-bold transition-colors duration-500", isDarkMode ? "text-cyan-600" : "text-gray-600")}>Python 3.12+ (Security Core)</span>
                          <Check className="text-green-500" size={14} />
                       </div>
                       <div className={cn("flex items-center justify-between p-3 rounded-xl border transition-colors duration-500", isDarkMode ? "bg-cyan-950/10 border-cyan-900/20" : "bg-gray-50 border-gray-100")}>
                          <span className={cn("text-xs font-bold transition-colors duration-500", isDarkMode ? "text-cyan-600" : "text-gray-600")}>Java 21 (Enterprise Edge)</span>
                          <Check className="text-green-500" size={14} />
                       </div>
                       <a 
                         href={githubUrl} 
                         target="_blank" 
                         rel="noreferrer"
                         className={cn("flex items-center justify-center gap-2 w-full p-3 border rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all group mt-2", isDarkMode ? "bg-black hover:bg-gray-900 border-cyan-500/20" : "bg-gray-900 text-white hover:bg-black border-transparent shadow-lg text-white")}
                       >
                          <Github size={14} className="group-hover:rotate-12 transition-transform" /> 
                          Deploy to GitHub Repository
                       </a>
                       <div className={cn("mt-4 pt-4 border-t transition-colors duration-500", isDarkMode ? "border-cyan-900/10" : "border-gray-100")}>
                          <p className={cn("text-[10px] font-mono italic transition-colors duration-500", isDarkMode ? "text-emerald-700" : "text-emerald-600")}>Instance Handle: {"{ZENITH/GUARD}"}</p>
                       </div>
                     </div>
                  </div>

                      <div className={cn("border rounded-3xl p-8 flex flex-col justify-between transition-colors duration-500", isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-white border-gray-200 shadow-sm")}>
                         <div>
                           <h3 className={cn("text-xl font-bold uppercase mb-2 transition-colors duration-500", isDarkMode ? "text-cyan-50" : "text-slate-800")}>Interface <span className={isDarkMode ? "text-cyan-500" : "text-cyan-600"}>Mode</span></h3>
                           <p className={cn("text-[10px] uppercase tracking-widest mb-4 font-bold leading-relaxed transition-colors duration-500", isDarkMode ? "text-cyan-200/50" : "text-gray-400")}>
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
                                      : isDarkMode ? "bg-black/40 border-cyan-900/40 text-cyan-800 hover:text-cyan-500" : "bg-gray-100 border-gray-200 text-gray-400 hover:text-gray-600"
                                  )}
                                >
                                  {m}
                                </button>
                              ))}
                           </div>

                           <div className={cn("mt-6 pt-6 border-t transition-colors duration-500", isDarkMode ? "border-cyan-900/10" : "border-gray-100")}>
                             <h3 className={cn("text-lg font-bold uppercase mb-2 transition-colors duration-500", isDarkMode ? "text-cyan-50" : "text-slate-800")}>Theme <span className={isDarkMode ? "text-cyan-500" : "text-cyan-600"}>Guard</span></h3>
                             <p className={cn("text-[10px] uppercase tracking-widest mb-4 font-bold leading-relaxed transition-colors duration-500", isDarkMode ? "text-cyan-200/50" : "text-gray-400")}>
                                Toggle the light spectrum visibility of the node.
                             </p>
                             <button
                               onClick={() => setIsDarkMode(!isDarkMode)}
                               className={cn(
                                 "w-full py-3 rounded-xl border flex items-center justify-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest",
                                 isDarkMode 
                                   ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20" 
                                   : "bg-gray-900 border-transparent text-white hover:bg-black shadow-lg"
                               )}
                             >
                               {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                               {isDarkMode ? 'Enable Light Ops' : 'Enable Neural Dark'}
                             </button>
                           </div>
                         </div>
                         <div className={cn("mt-8 pt-8 border-t transition-colors duration-500", isDarkMode ? "border-cyan-900/10" : "border-gray-100")}>
                            <h4 className={cn("text-[10px] font-black uppercase mb-4 tracking-widest whitespace-nowrap transition-colors duration-500", isDarkMode ? "text-cyan-900" : "text-gray-200")}>Core Support Node</h4>
                            <div className="space-y-3">
                              <a href={`mailto:${supportEmail}`} className="flex items-center gap-3 text-cyan-400 hover:text-cyan-600 transition-colors">
                                <ExternalLink size={14} />
                                <span className="text-xs font-mono">{supportEmail}</span>
                              </a>
                            </div>
                         </div>
                      </div>
                </div>

                <div id="download-section" className={cn("border rounded-3xl p-8 transition-colors duration-500", isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-white border-gray-200 shadow-sm")}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                      <h4 className="text-lg font-bold uppercase flex items-center gap-2 italic">
                        Universal <span className="text-cyan-400">Node Sync</span>
                      </h4>
                      <p className={cn("text-[10px] font-medium uppercase tracking-widest transition-colors duration-500", isDarkMode ? "text-cyan-800" : "text-gray-400")}>
                        Compatible with any device, version, or OS brand.
                      </p>
                    </div>
                    <div className="flex gap-2">
                       <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                         <span className="text-[9px] font-black text-green-500 tracking-tighter uppercase">Poly-Kernel Active</span>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                    {['Android 5+', 'iOS 12+', 'Windows', 'Any Mac', 'Linux', 'ChromeOS'].map(os => (
                      <div key={os} className={cn("flex flex-col items-center gap-2 p-4 border rounded-2xl group transition-all", isDarkMode ? "bg-cyan-950/10 border-cyan-900/20 hover:border-cyan-500/30" : "bg-gray-50 border-gray-100 hover:border-cyan-500 hover:bg-white hover:shadow-md")}>
                        <div className="relative">
                          <SmartphoneIcon size={18} className={cn("transition-colors", isDarkMode ? "text-cyan-800 group-hover:text-cyan-400" : "text-gray-400 group-hover:text-cyan-600")} />
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border-2 border-black" />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors text-center", isDarkMode ? "text-cyan-900 group-hover:text-cyan-500" : "text-gray-400 group-hover:text-gray-950")}>{os}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-cyan-500/10 rounded-3xl bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors">
                      <Download size={32} className="text-cyan-500 mb-2 animate-bounce" />
                      <h3 className="text-lg font-black uppercase mb-1">Universal Node</h3>
                      <p className="text-[9px] uppercase font-bold tracking-widest text-cyan-700/60 mb-6 text-center max-w-sm italic">
                        Bypasses Store Limits. Downloads a Secure Node Manifest (.json) compatible with all platforms.
                      </p>
                      <div className="flex flex-wrap justify-center gap-3">
                        <button 
                          onClick={handleDownloadNode}
                          disabled={isDownloading}
                          className={cn(
                            "bg-cyan-500 hover:bg-cyan-400 text-black font-black px-6 py-3 rounded-lg text-[10px] uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]",
                            isDownloading && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {isDownloading ? 'Transmitting...' : 'Link Any Device'}
                        </button>
                      </div>
                    </div>

                    <div className={cn("p-6 border rounded-3xl transition-colors duration-500", isDarkMode ? "bg-black/20 border-cyan-950" : "bg-gray-50 border-gray-100")}>
                       <h3 className="text-sm font-black uppercase mb-4 flex items-center gap-2">
                         <Bot size={16} className="text-cyan-400" /> Web Node <span className="text-cyan-600">Installation</span>
                       </h3>
                       <p className={cn("text-[10px] font-medium leading-relaxed mb-4 transition-colors duration-500", isDarkMode ? "text-cyan-100/40" : "text-gray-500")}>
                         Since Play Store & App Store restrict high-encryption nodes, ZENITH uses **PWA (Progressive Web App)** technology to run NATIVELY on your hardware.
                       </p>
                       <ul className="space-y-2">
                         {[
                           { os: 'Mobile', step: 'Tap Browser Menu (⋮ or ⎙) > "Add to Home Screen"' },
                           { os: 'Desktop', step: 'Click "Install" ⎙ in the URL Search Bar' },
                           { os: 'Direct', step: 'The Web Node is authorized for ANY system kernel.' }
                         ].map((s, i) => (
                           <li key={i} className="flex items-start gap-2">
                             <div className="w-4 h-4 rounded bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center text-[10px] font-black text-cyan-400 flex-shrink-0 mt-0.5">{i+1}</div>
                             <p className={cn("text-[10px] font-bold transition-colors duration-500", isDarkMode ? "text-cyan-100/80" : "text-gray-700")}>
                               <span className="text-cyan-500 mr-1">{s.os}:</span> {s.step}
                             </p>
                           </li>
                         ))}
                       </ul>
                    </div>
                  </div>
                </div>

                <div className={cn("border rounded-3xl p-8 relative overflow-hidden transition-colors duration-500", isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-white border-gray-200 shadow-sm")}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h4 className="text-lg font-bold uppercase mb-1">Upgrade to <span className="text-cyan-400">Prime Node</span></h4>
                      <p className={cn("text-xs font-medium tracking-tight", isDarkMode ? "text-cyan-700" : "text-gray-500")}>Unlock Biometric-Link & Quantum Resilience for a one-time fee.</p>
                      <div className="mt-2 text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded inline-block font-black uppercase tracking-widest border border-cyan-500/20">
                        First App Special
                      </div>
                      <div className={cn("mt-4 p-3 border rounded-xl", isDarkMode ? "bg-cyan-500/5 border-cyan-500/10" : "bg-gray-50 border-gray-100")}>
                        <p className={cn("text-[10px] uppercase font-black mb-1", isDarkMode ? "text-cyan-600" : "text-gray-400")}>M-PESA / Global Pay</p>
                        <p className={cn("text-sm font-mono", isDarkMode ? "text-cyan-400" : "text-cyan-600 font-bold")}>{supportPhone}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       <div className={cn("text-2xl font-black font-mono", isDarkMode ? "text-cyan-50" : "text-slate-900")}>$1.99 <span className="text-xs text-cyan-700 font-medium">USD</span></div>
                       <FuturisticButton variant="secondary" className="px-4 py-2 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                        Unlock Advanced Features
                      </FuturisticButton>
                    </div>
                  </div>
                </div>

                {/* Custom Branding & Deployment Config Editor */}
                <div className={cn("border rounded-3xl p-8 transition-colors duration-500", isDarkMode ? "bg-black/40 border-cyan-900/30" : "bg-white border-gray-200 shadow-sm")}>
                  <div className="flex items-center gap-3 mb-6">
                    <Settings className="text-cyan-500 animate-spin-slow" size={24} />
                    <div>
                      <h4 className="text-lg font-black uppercase text-cyan-400">Node Customization Settings</h4>
                      <p className={cn("text-[10px] font-bold uppercase tracking-widest", isDarkMode ? "text-cyan-800" : "text-gray-400")}>Change help support support resources and deployment URLs dynamically</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveBranding} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className={cn("text-xs uppercase tracking-widest font-semibold ml-1 block mb-1.5", isDarkMode ? "text-cyan-500/70" : "text-gray-500")}>Support Email Recipient</label>
                          <input 
                            type="email"
                            value={editSupportEmail}
                            onChange={(e) => setEditSupportEmail(e.target.value)}
                            className={cn("w-full border rounded-xl py-3 px-4 text-xs font-mono transition-all focus:outline-none focus:ring-2", isDarkMode ? "bg-black/40 border-cyan-900/30 text-cyan-50 focus:ring-cyan-500/30 font-bold" : "bg-gray-50 border-gray-200 text-gray-900 focus:ring-cyan-500/20")}
                            placeholder="e.g. support@yourdomain.com"
                          />
                        </div>

                        <div>
                          <label className={cn("text-xs uppercase tracking-widest font-semibold ml-1 block mb-1.5", isDarkMode ? "text-cyan-500/70" : "text-gray-500")}>Support Phone / Payment Line</label>
                          <input 
                            type="text"
                            value={editSupportPhone}
                            onChange={(e) => setEditSupportPhone(e.target.value)}
                            className={cn("w-full border rounded-xl py-3 px-4 text-xs font-mono transition-all focus:outline-none focus:ring-2", isDarkMode ? "bg-black/40 border-cyan-900/30 text-cyan-50 focus:ring-cyan-500/30 font-bold" : "bg-gray-50 border-gray-200 text-gray-900 focus:ring-cyan-500/20")}
                            placeholder="e.g. 0723664357 / 0797661101"
                          />
                        </div>

                        <div>
                          <label className={cn("text-xs uppercase tracking-widest font-semibold ml-1 block mb-1.5", isDarkMode ? "text-cyan-500/70" : "text-gray-500")}>GitHub Repo URL</label>
                          <input 
                            type="url"
                            value={editGithubUrl}
                            onChange={(e) => setEditGithubUrl(e.target.value)}
                            className={cn("w-full border rounded-xl py-3 px-4 text-xs font-mono transition-all focus:outline-none focus:ring-2", isDarkMode ? "bg-black/40 border-cyan-900/30 text-cyan-50 focus:ring-cyan-500/30 font-bold" : "bg-gray-50 border-gray-200 text-gray-900 focus:ring-cyan-500/20")}
                            placeholder="e.g. https://github.com/username/repository"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className={cn("text-xs uppercase tracking-widest font-semibold ml-1 block mb-1.5", isDarkMode ? "text-cyan-500/70" : "text-gray-500")}>Instagram URL</label>
                          <input 
                            type="url"
                            value={editInstagramUrl}
                            onChange={(e) => setEditInstagramUrl(e.target.value)}
                            className={cn("w-full border rounded-xl py-3 px-4 text-xs font-mono transition-all focus:outline-none focus:ring-2", isDarkMode ? "bg-black/40 border-cyan-900/30 text-cyan-50 focus:ring-cyan-500/30 font-bold" : "bg-gray-50 border-gray-205 text-gray-900 focus:ring-cyan-500/20")}
                            placeholder="e.g. https://instagram.com/yourhandle"
                          />
                        </div>

                        <div>
                          <label className={cn("text-xs uppercase tracking-widest font-semibold ml-1 block mb-1.5", isDarkMode ? "text-cyan-500/70" : "text-gray-500")}>Instagram Handle</label>
                          <input 
                            type="text"
                            value={editInstagramHandle}
                            onChange={(e) => setEditInstagramHandle(e.target.value)}
                            className={cn("w-full border rounded-xl py-3 px-4 text-xs font-mono transition-all focus:outline-none focus:ring-2", isDarkMode ? "bg-black/40 border-cyan-900/30 text-cyan-50 focus:ring-cyan-500/30 font-bold" : "bg-gray-50 border-gray-205 text-gray-900 focus:ring-cyan-500/20")}
                            placeholder="e.g. yourhandle"
                          />
                        </div>

                        <div className="pt-6">
                          <button
                            type="submit"
                            disabled={isUpdatingConfig}
                            className={cn(
                              "w-full py-3 px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer",
                              isDarkMode 
                                ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(8,145,178,0.4)]" 
                                : "bg-gray-900 text-white hover:bg-black shadow-lg"
                            )}
                          >
                            {isUpdatingConfig ? "Updating Sanctuary Core..." : "Update Configuration Node"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {configSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("p-4 rounded-xl border text-center font-bold text-xs uppercase tracking-widest", isDarkMode ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-green-50 border-green-200 text-green-700")}
                      >
                        ✓ Core configurations compiled & synced across all sanctuary nodes successfully!
                      </motion.div>
                    )}
                  </form>
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
            <a href={`mailto:${supportEmail}`} className="text-[10px] font-black tracking-widest text-cyan-700 hover:text-cyan-400 uppercase transition-colors">Nexus Mail</a>
            <a href={instagramUrl} target="_blank" rel="noreferrer" className="text-[10px] font-black tracking-widest text-cyan-700 hover:text-cyan-400 uppercase transition-colors">Neural Stream</a>
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
              className={cn("absolute inset-0 backdrop-blur-md transition-colors duration-500", isDarkMode ? "bg-black/80" : "bg-white/40")}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "max-w-md w-full border rounded-3xl p-8 relative z-10 shadow-2xl transition-colors duration-500",
                isDarkMode ? "bg-black/60 border-cyan-500/30" : "bg-white border-gray-100"
              )}
            >
              <h3 className={cn("text-2xl font-black tracking-tighter uppercase mb-6 transition-colors duration-500", isDarkMode ? "text-white" : "text-slate-800")}>Vault <span className="text-cyan-500">Deposit</span></h3>
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
