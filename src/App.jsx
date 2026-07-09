import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
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
const FRANCE_OPTION = 'France entière';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';
const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function App() {
  const [username, setUsername] = useState(localStorage.getItem('cttl_voice_user') || '');
  const [step, setStep] = useState(username ? 'home' : 'login');
  const [selectedRegion, setSelectedRegion] = useState(FRANCE_OPTION);
  const [currentMatchName, setCurrentMatchName] = useState('');
  const [statusText, setStatusText] = useState('Prêt');
  const [errorText, setErrorText] = useState('');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const roomIdRef = useRef('');
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const title = useMemo(() => {
    if (step === 'login') return 'Connexion';
    if (step === 'home') return 'Accueil vocal';
    if (step === 'regions') return 'Choisis ta région';
    return 'Appel vocal';
  }, [step]);

  const cleanupPeer = () => {
    pendingCandidatesRef.current = [];
    roomIdRef.current = '';

    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const ensureLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    return stream;
  };

  const sendSignal = (data) => {
    const socket = socketRef.current;
    if (!socket || !roomIdRef.current) return;
    socket.emit('signal', { roomId: roomIdRef.current, data });
  };

  const createPeer = async () => {
    if (peerRef.current) return peerRef.current;

    const stream = await ensureLocalStream();
    const peer = new RTCPeerConnection(RTC_CONFIG);

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.onicecandidate = (event) => {
      if (event.candidate) sendSignal({ type: 'candidate', candidate: event.candidate });
    };

    peer.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
      setStatusText('Connecté');
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        setStatusText('Connexion interrompue');
      }
    };

    peerRef.current = peer;
    return peer;
  };

  const flushPendingCandidates = async (peer) => {
    if (!pendingCandidatesRef.current.length) return;
    for (const candidate of pendingCandidatesRef.current) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidatesRef.current = [];
  };

  const handleSignal = async (payload = {}) => {
    const data = payload.data || {};
    if (!data.type) return;

    const peer = await createPeer();

    if (data.type === 'offer') {
      await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushPendingCandidates(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSignal({ type: 'answer', answer });
      return;
    }

    if (data.type === 'answer') {
      await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
      await flushPendingCandidates(peer);
      return;
    }

    if (data.type === 'candidate' && data.candidate) {
      if (peer.remoteDescription) {
        await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        pendingCandidatesRef.current.push(data.candidate);
      }
    }
  };

  const startAsInitiator = async () => {
    const peer = await createPeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sendSignal({ type: 'offer', offer });
  };

  const ensureSocket = () => {
    if (socketRef.current) return socketRef.current;

    const socket = io(SIGNALING_URL, { transports: ['websocket'] });

    socket.on('connect', () => {
      setErrorText('');
      setStatusText('Connecté au serveur');
    });

    socket.on('waiting', () => {
      cleanupPeer();
      setCurrentMatchName('');
      setStatusText("Recherche d'une personne...");
    });

    socket.on('matched', async (payload = {}) => {
      setErrorText('');
      setCurrentMatchName(payload.partnerName || 'Inconnu');
      roomIdRef.current = payload.roomId || '';
      setStatusText('Personne trouvée, connexion...');
      if (payload.initiator) {
        await startAsInitiator();
      } else {
        await createPeer();
      }
    });

    socket.on('signal', async (payload) => {
      try {
        await handleSignal(payload);
      } catch {
        setStatusText('Erreur de connexion WebRTC');
      }
    });

    socket.on('partner-left', () => {
      cleanupPeer();
      setCurrentMatchName('');
      setStatusText('La personne est partie, nouvelle recherche...');
    });

    socket.on('error-message', (message) => {
      setErrorText(String(message || 'Erreur serveur'));
    });

    socket.on('disconnect', () => {
      cleanupPeer();
      setCurrentMatchName('');
      setStatusText('Serveur déconnecté');
    });

    socketRef.current = socket;
    return socket;
  };

  const handleLogin = (event) => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    localStorage.setItem('cttl_voice_user', trimmed);
    setUsername(trimmed);
    setStep('home');
  };

  const startVoiceFlow = () => setStep('regions');

  const joinQueue = async (region) => {
    setErrorText('');
    setStatusText('Activation du micro...');

    try {
      await ensureLocalStream();
    } catch {
      setErrorText("Impossible d'accéder au micro. Vérifie les permissions.");
      setStatusText('Micro indisponible');
      return;
    }

    cleanupPeer();
    setCurrentMatchName('');
    setSelectedRegion(region);
    setStep('call');
    setIsMicMuted(false);
    setIsSpeakerOn(true);

    const socket = ensureSocket();
    socket.emit('join-queue', { username, region });
    setStatusText("Recherche d'une personne...");
  };

  const zapToNext = () => {
    const socket = socketRef.current;
    if (!socket) return;
    cleanupPeer();
    setCurrentMatchName('');
    setStatusText("Recherche d'une personne...");
    socket.emit('zap');
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextValue = !isMicMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextValue;
    });
    setIsMicMuted(nextValue);
  };

  const toggleSpeaker = () => {
    const nextValue = !isSpeakerOn;
    setIsSpeakerOn(nextValue);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !nextValue;
    }
  };

  const logout = () => {
    const socket = socketRef.current;
    if (socket) socket.emit('leave');
    cleanupPeer();
    localStorage.removeItem('cttl_voice_user');
    setUsername('');
    setStep('login');
    setCurrentMatchName('');
    setErrorText('');
    setStatusText('Prêt');
  };

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerOn;
    }
  }, [isSpeakerOn]);

  useEffect(() => {
    return () => {
      const socket = socketRef.current;
      if (socket) {
        socket.emit('leave');
        socket.disconnect();
      }
      cleanupPeer();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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
                <button key={region} className="btn" onClick={() => joinQueue(region)}>
                  {region}
                </button>
              ))}
              <button className="btn primary france-btn" onClick={() => joinQueue(FRANCE_OPTION)}>
                {FRANCE_OPTION}
              </button>
            </div>
          </div>
        )}

        {step === 'call' && (
          <div className="panel call-panel">
            <p className="hint">Région: <strong>{selectedRegion}</strong></p>
            <div className="match-card">
              <span>Connecté avec</span>
              <strong>{currentMatchName || 'En attente...'}</strong>
              <small className="status-text">{statusText}</small>
            </div>
            {errorText && <p className="error-text">{errorText}</p>}
            <div className="controls-grid">
              <button className="btn primary" onClick={zapToNext}>Zapper</button>
              <button className="btn" onClick={toggleMic}>
                {isMicMuted ? 'Activer micro' : 'Couper micro'}
              </button>
              <button className="btn" onClick={toggleSpeaker}>
                {isSpeakerOn ? 'Couper haut-parleur' : 'Activer haut-parleur'}
              </button>
            </div>
            <button className="btn ghost back-btn" onClick={() => setStep('regions')}>Changer de région</button>
          </div>
        )}

        <audio ref={remoteAudioRef} autoPlay playsInline />
      </section>
    </main>
  );
}
