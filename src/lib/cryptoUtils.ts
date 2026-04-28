import CryptoJS from 'crypto-js';

export const checkPasswordStrength = (password: string) => {
  let score = 0;
  if (!password) return { score, label: 'Empty', color: 'bg-gray-500' };

  if (password.length > 8) score += 1;
  if (password.length > 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 4) return { score, label: 'Fair', color: 'bg-yellow-500' };
  if (score <= 5) return { score, label: 'Strong', color: 'bg-green-500' };
  return { score, label: 'Invincible', color: 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]' };
};

export const encryptData = (data: string, key: string) => {
  return CryptoJS.AES.encrypt(data, key).toString();
};

export const decryptData = (ciphertext: string, key: string) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

export const generateRecoveryPhrase = () => {
  const words = [
    'phantom', 'nyte', 'guard', 'cyber', 'vault', 'shadow', 'neon', 'pulse',
    'matrix', 'secure', 'ghost', 'alpha', 'omega', 'zenith', 'vortex', 'core'
  ];
  const selected = [];
  for (let i = 0; i < 4; i++) {
    selected.push(words[Math.floor(Math.random() * words.length)]);
  }
  return selected.join('-');
};
