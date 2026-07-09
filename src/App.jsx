import React, { useMemo, useState } from 'react';
import './App.css';

const REGIONS = [
  'Île-de-France',
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Grand Est',
  'Hauts-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Côte d'Azur",
  'Corse',
  'Outre-mer'
];
// Option affichée séparément pour la mettre en bouton principal pleine largeur.
const FRANCE_OPTION = 'France entière';

const MATCH_NAMES = [
  'Alex',
  'Sam',
  'Nina',
  'Léo',
  'Maya',
  'Noah',
  'Emma',
  'Yanis',
  'Sofia',
  'Lina'
];

const createMatchId = () => {
  if (globalThis.crypto?.randomUUID) {
    return `match_${globalThis.crypto.randomUUID()}`;
  }
  return `match_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
};

const makeMatch = (region) => ({
  id: createMatchId(),
  name: MATCH_NAMES[Math.floor(Math.random() * MATCH_NAMES.length)],
  region
});

export default function App() {
  const [username, setUsername] = useState(localStorage.getItem('cttl_voice_user') || '');
  const [step, setStep] = useState(username ? 'home' : 'login');
  const [selectedRegion, setSelectedRegion] = useState(FRANCE_OPTION);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const title = useMemo(() => {
    if (step === 'login') return 'Connexion';
    if (step === 'home') return 'Accueil vocal';
    if (step === 'regions') return 'Choisis ta région';
    return 'Appel vocal';
  }, [step]);

  const handleLogin = (event) => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    localStorage.setItem('cttl_voice_user', trimmed);
    setUsername(trimmed);
    setStep('home');
  };

  const startVoiceFlow = () => setStep('regions');

  const selectRegion = (region) => {
    setSelectedRegion(region);
    setCurrentMatch(makeMatch(region));
    setIsMicMuted(false);
    setIsSpeakerOn(true);
    setStep('call');
  };

  const zapToNext = () => {
    setCurrentMatch(makeMatch(selectedRegion));
  };

  const logout = () => {
    localStorage.removeItem('cttl_voice_user');
    setUsername('');
    setCurrentMatch(null);
    setStep('login');
  };

  return (
    <main className="app">
      <section className="card">
        <header className="header">
          <h1>Chat Vocal Simple</h1>
          <p>{title}</p>
        </header>

        {step === 'login' && (
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="username">Ton pseudo</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ex: Alex"
              required
            />
            <button type="submit" className="btn primary">Se connecter</button>
          </form>
        )}

        {step === 'home' && (
          <div className="panel center">
            <p className="welcome">Salut {username} 👋</p>
            <button className="voice-circle" onClick={startVoiceFlow}>
              Chatter en vocal
            </button>
            <button className="btn ghost" onClick={logout}>Se déconnecter</button>
          </div>
        )}

        {step === 'regions' && (
          <div className="panel">
            <p className="hint">Choisis une région ou la France entière.</p>
            <div className="regions-grid">
              {REGIONS.map((region) => (
                <button key={region} className="btn" onClick={() => selectRegion(region)}>
                  {region}
                </button>
              ))}
              <button className="btn primary france-btn" onClick={() => selectRegion(FRANCE_OPTION)}>
                {FRANCE_OPTION}
              </button>
            </div>
          </div>
        )}

        {step === 'call' && currentMatch && (
          <div className="panel call-panel">
            <p className="hint">Région: <strong>{selectedRegion}</strong></p>
            <div className="match-card">
              <span>Connecté avec</span>
              <strong>{currentMatch.name}</strong>
            </div>
            <div className="controls-grid">
              <button className="btn primary" onClick={zapToNext}>Zapper</button>
              <button className="btn" onClick={() => setIsMicMuted((value) => !value)}>
                {isMicMuted ? 'Activer micro' : 'Couper micro'}
              </button>
              <button className="btn" onClick={() => setIsSpeakerOn((value) => !value)}>
                {isSpeakerOn ? 'Couper haut-parleur' : 'Activer haut-parleur'}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
