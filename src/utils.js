import crypto from 'crypto';

const SALT = 'demo_salt_pf_portes_du_destin';

// Create server seed and its hash
export function createSeedHash() {
  const server_seed = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const server_seed_hash = hashString(server_seed + SALT);
  return { server_seed, server_seed_hash };
}

// Simple hash function (SHA256 simulation via native crypto or fallback)
export function hashString(str) {
  // Use crypto.subtle if available (modern browsers)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Async version (we'll use sync fallback for simplicity)
    return sha256Simple(str);
  }
  return sha256Simple(str);
}

// Simple SHA256-like hash (not cryptographically perfect, but enough for demo)
function sha256Simple(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

// Deterministic outcome per palier using HMAC-like function
export function computeOutcome(server_seed, clientSeed, palier) {
  const message = `${clientSeed}:${palier}:`;
  const combined = server_seed + message + SALT;
  const hash = hashString(combined);
  // Map hash to float [0, 1)
  const intVal = parseInt(hash.slice(0, 8), 16);
  const randFloat = (intVal % 10000) / 10000; // [0, 1)
  return { randFloat, proof: { hash, message } };
}

// Game config (display to player)
export const gameConfig = [
  { palier: 1, portes: 3, gagnantes_affiche: 1, perdantes_affiche: 2, chance_affiche: '33.3%', multi_affiche: 'x3.00' },
  { palier: 2, portes: 4, gagnantes_affiche: 1, perdantes_affiche: 3, chance_affiche: '25.0%', multi_affiche: 'x4.00' },
  { palier: 3, portes: 5, gagnantes_affiche: 2, perdantes_affiche: 3, chance_affiche: '40.0%', multi_affiche: 'x2.50' },
  { palier: 4, portes: 6, gagnantes_affiche: 2, perdantes_affiche: 4, chance_affiche: '33.3%', multi_affiche: 'x3.00' },
  { palier: 5, portes: 7, gagnantes_affiche: 3, perdantes_affiche: 4, chance_affiche: '42.9%', multi_affiche: 'x2.33' },
  { palier: 6, portes: 8, gagnantes_affiche: 3, perdantes_affiche: 5, chance_affiche: '37.5%', multi_affiche: 'x2.67' },
  { palier: 7, portes: 9, gagnantes_affiche: 4, perdantes_affiche: 5, chance_affiche: '44.4%', multi_affiche: 'x2.25' },
  { palier: 8, portes: 10, gagnantes_affiche: 4, perdantes_affiche: 6, chance_affiche: '40.0%', multi_affiche: 'x2.50' },
  { palier: 9, portes: 11, gagnantes_affiche: 5, perdantes_affiche: 6, chance_affiche: '45.5%', multi_affiche: 'x2.20' },
  { palier: 10, portes: 12, gagnantes_affiche: 5, perdantes_affiche: 7, chance_affiche: '41.7%', multi_affiche: 'x2.40' }
];

// Real probabilities and multipliers (server-side logic)
export const probas_reelles = {
  1: 0.15, 2: 0.12, 3: 0.10, 4: 0.15, 5: 0.08,
  6: 0.10, 7: 0.07, 8: 0.08, 9: 0.06, 10: 0.05
};

export const multiplicateurs_reels = {
  1: 2.0, 2: 2.5, 3: 2.0, 4: 2.2, 5: 1.8,
  6: 2.0, 7: 1.7, 8: 1.8, 9: 1.6, 10: 1.7
};

// localStorage helpers
export function loadPlayers() {
  const data = localStorage.getItem('pdt_players');
  return data ? JSON.parse(data) : {};
}

export function savePlayers(players) {
  localStorage.setItem('pdt_players', JSON.stringify(players));
}

export function loadPFSessions() {
  const data = localStorage.getItem('pdt_pf_sessions');
  return data ? JSON.parse(data) : {};
}

export function savePFSessions(sessions) {
  localStorage.setItem('pdt_pf_sessions', JSON.stringify(sessions));
}

export function loadPlays() {
  const data = localStorage.getItem('pdt_plays');
  return data ? JSON.parse(data) : [];
}

export function savePlays(plays) {
  localStorage.setItem('pdt_plays', JSON.stringify(plays));
}
