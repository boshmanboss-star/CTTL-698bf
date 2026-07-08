import React, { useState, useEffect } from 'react';
import {
  createSeedHash,
  computeOutcome,
  gameConfig,
  probas_reelles,
  multiplicateurs_reels,
  loadPlayers,
  savePlayers,
  loadPFSessions,
  savePFSessions,
  loadPlays,
  savePlays
} from './utils';
import './App.css';

const ADMIN_KEY = 'admin_demo_key';

export default function App() {
  const [playerId, setPlayerId] = useState(localStorage.getItem('pdt_playerId') || '');
  const [player, setPlayer] = useState(null);
  const [adminKey, setAdminKey] = useState('');
  const [pfSessions, setPfSessions] = useState(loadPFSessions());
  const [currentPfId, setCurrentPfId] = useState('');
  const [plays, setPlays] = useState(loadPlays());
  const [log, setLog] = useState([]);
  const [tab, setTab] = useState('game'); // 'game', 'admin', 'history'

  useEffect(() => {
    if (playerId) loadPlayer();
  }, []);

  const addLog = (msg) => setLog(l => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l.slice(0, 49)]);

  const loadPlayer = () => {
    const players = loadPlayers();
    const p = players[playerId];
    if (p) {
      setPlayer(p);
      addLog(`Joueur chargé : ${p.name}`);
    }
  };

  const signup = async () => {
    const name = prompt('Pseudo ? (défaut: joueur)') || `joueur_${Math.random().toString(36).slice(7)}`;
    const players = loadPlayers();
    const id = `player_${Date.now()}`;
    const newPlayer = { id, name, credits_cents: 100000, created_at: Date.now() };
    players[id] = newPlayer;
    savePlayers(players);
    localStorage.setItem('pdt_playerId', id);
    setPlayerId(id);
    setPlayer(newPlayer);
    addLog(`Joueur créé : ${name} (${id})`);
  };

  const createPf = () => {
    if (adminKey !== ADMIN_KEY) return alert(`Clé admin incorrecte. Essaie 'admin_demo_key'.`);
    const seed = createSeedHash();
    const id = `pf_${Date.now()}`;
    const newSession = {
      id,
      server_seed_hash: seed.server_seed_hash,
      server_seed: seed.server_seed,
      created_at: Date.now(),
      revealed: false
    };
    const sessions = { ...pfSessions, [id]: newSession };
    setPfSessions(sessions);
    savePFSessions(sessions);
    setCurrentPfId(id);
    addLog(`Session PF créée : ${id.slice(0, 12)}...`);
    alert(`Session PF créée : ${id}\nServer seed hash : ${seed.server_seed_hash.slice(0, 16)}...`);
  };

  const revealPf = () => {
    if (adminKey !== ADMIN_KEY) return alert('Clé admin incorrecte.');
    if (!currentPfId || !pfSessions[currentPfId]) return alert('Aucune session PF active.');
    const session = pfSessions[currentPfId];
    const updated = { ...pfSessions, [currentPfId]: { ...session, revealed: true } };
    setPfSessions(updated);
    savePFSessions(updated);
    addLog(`Server seed révélé pour ${currentPfId.slice(0, 12)}...`);
    alert(`Server seed révélé :\n${session.server_seed}\n\nVérification hash :\n${session.server_seed_hash}`);
  };

  const play = async () => {
    if (!playerId || !player) return alert('Crée un joueur d\'abord.');
    if (!currentPfId || !pfSessions[currentPfId]) return alert('Crée une session PF d\'abord (admin).');
    
    const clientSeed = prompt('Client seed (laisser vide pour aléa)') || `seed_${Date.now()}`;
    const session = pfSessions[currentPfId];
    const players = loadPlayers();
    const results = [];
    let totalPayout = 0;
    const miseParPalierCents = 100; // 1€
    const palierMax = 10;

    for (let palier = 1; palier <= palierMax; palier++) {
      const { randFloat, proof } = computeOutcome(session.server_seed, clientSeed, palier);
      const prob = probas_reelles[palier];
      const multi = multiplicateurs_reels[palier];
      const win = randFloat < prob;
      const payoutCents = win ? Math.round(multi * miseParPalierCents) : 0;
      if (win) totalPayout += payoutCents;
      results.push({ palier, randFloat, prob, multi, win, payout_cents: payoutCents });
    }

    const totalWager = miseParPalierCents * palierMax;
    const newCredits = player.credits_cents - totalWager + totalPayout;
    const updatedPlayer = { ...player, credits_cents: newCredits };
    players[playerId] = updatedPlayer;
    savePlayers(players);
    setPlayer(updatedPlayer);

    const play_record = {
      id: `play_${Date.now()}`,
      player_id: playerId,
      pf_session_id: currentPfId,
      client_seed: clientSeed,
      results,
      total_payout_cents: totalPayout,
      created_at: Date.now()
    };
    const newPlays = [...plays, play_record];
    setPlays(newPlays);
    savePlays(newPlays);

    addLog(`Play : payout ${totalPayout} cents, balance ${newCredits} cents`);
    alert(`Résultat :\nPayout : ${totalPayout} cents\nNouvelle balance : ${(newCredits / 100).toFixed(2)}€`);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎰 Portes du Destin</h1>
        <p className="subtitle">MVP Web - Faux Argent</p>
      </header>

      <div className="tab-buttons">
        <button className={tab === 'game' ? 'active' : ''} onClick={() => setTab('game')}>Jeu</button>
        <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Historique</button>
      </div>

      {tab === 'game' && (
        <div className="tab-content">
          <section className="player-section">
            {!player ? (
              <button className="btn btn-primary" onClick={signup}>Créer un joueur</button>
            ) : (
              <div className="player-card">
                <div>Joueur : <strong>{player.name}</strong></div>
                <div>Crédits : <strong>{(player.credits_cents / 100).toFixed(2)}€</strong></div>
                <button className="btn btn-secondary" onClick={() => { localStorage.removeItem('pdt_playerId'); setPlayerId(''); setPlayer(null); }}>Déconnexion</button>
              </div>
            )}
          </section>

          <section className="config-section">
            <h2>Configuration du Jeu</h2>
            <table className="config-table">
              <thead>
                <tr>
                  <th>Palier</th>
                  <th>Portes</th>
                  <th>Chance</th>
                  <th>Multi</th>
                </tr>
              </thead>
              <tbody>
                {gameConfig.map(c => (
                  <tr key={c.palier}>
                    <td>{c.palier}</td>
                    <td>{c.portes}</td>
                    <td>{c.chance_affiche}</td>
                    <td>{c.multi_affiche}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="play-section">
            <button className="btn btn-play" onClick={play} disabled={!player || !currentPfId}>
              🎲 Jouer (10 paliers)
            </button>
            {currentPfId && <p className="info">Session PF : {currentPfId.slice(0, 12)}...</p>}
          </section>
        </div>
      )}

      {tab === 'admin' && (
        <div className="tab-content">
          <section className="admin-section">
            <h2>Admin Panel</h2>
            <div className="admin-form">
              <input
                type="password"
                placeholder="Clé admin"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                className="input"
              />
              <button className="btn btn-secondary" onClick={createPf}>Créer Session PF</button>
              <button className="btn btn-secondary" onClick={revealPf}>Révéler Server Seed</button>
            </div>
            {Object.keys(pfSessions).length > 0 && (
              <div className="pf-list">
                <h3>Sessions PF Existantes</h3>
                {Object.values(pfSessions).map(session => (
                  <div key={session.id} className="pf-item" onClick={() => setCurrentPfId(session.id)}>
                    <div className="pf-id">{session.id.slice(0, 20)}...</div>
                    <div className="pf-hash">Hash : {session.server_seed_hash.slice(0, 16)}...</div>
                    <div className={`pf-status ${session.revealed ? 'revealed' : 'hidden'}`}>
                      {session.revealed ? '✓ Révélée' : '🔒 Cachée'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'history' && (
        <div className="tab-content">
          <section className="history-section">
            <h2>Historique des Plays</h2>
            {plays.length === 0 ? (
              <p className="info">Aucun play pour le moment.</p>
            ) : (
              <div className="plays-list">
                {plays.slice().reverse().map(play => (
                  <div key={play.id} className="play-item">
                    <div className="play-header">
                      <span className="play-time">{new Date(play.created_at).toLocaleString()}</span>
                      <span className="play-payout">+{play.total_payout_cents} cents</span>
                    </div>
                    <div className="play-details">
                      <small>Joueur : {play.player_id.slice(0, 12)}...</small>
                      <small>Client Seed : {play.client_seed.slice(0, 20)}...</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <footer className="app-footer">
        <h3>Journal</h3>
        <div className="log-box">
          {log.map((entry, i) => (
            <div key={i} className="log-entry">{entry}</div>
          ))}
        </div>
      </footer>
    </div>
  );
}
