import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { randomBytes, randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 3001);
const FRANCE_OPTION = 'France entière';

const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    methods: ['GET', 'POST']
  }
});

const waitingQueue = [];
const profiles = new Map();
const activeMatches = new Map();

const isCompatible = (a, b) => a === b || a === FRANCE_OPTION || b === FRANCE_OPTION;

const createRoomId = () => {
  if (typeof randomUUID === 'function') return `room_${randomUUID()}`;
  return `room_${randomBytes(16).toString('hex')}`;
};

const removeFromQueue = (socketId) => {
  const index = waitingQueue.findIndex((item) => item.socketId === socketId);
  if (index !== -1) waitingQueue.splice(index, 1);
};

const clearMatch = (socketId) => {
  const match = activeMatches.get(socketId);
  if (!match) return null;

  const partnerId = match.partnerId;
  activeMatches.delete(socketId);
  activeMatches.delete(partnerId);

  const socket = io.sockets.sockets.get(socketId);
  const partnerSocket = io.sockets.sockets.get(partnerId);

  if (socket) socket.leave(match.roomId);
  if (partnerSocket) partnerSocket.leave(match.roomId);

  return { ...match, partnerId };
};

const queueOrMatch = (socket) => {
  const profile = profiles.get(socket.id);
  if (!profile || !profile.region || !profile.username) {
    socket.emit('error-message', 'Profil incomplet.');
    return;
  }

  removeFromQueue(socket.id);

  const partnerIndex = waitingQueue.findIndex((candidate) => {
    if (candidate.socketId === socket.id) return false;
    return isCompatible(candidate.region, profile.region);
  });

  if (partnerIndex === -1) {
    waitingQueue.push({ socketId: socket.id, region: profile.region });
    socket.emit('waiting', { region: profile.region });
    return;
  }

  const partnerEntry = waitingQueue.splice(partnerIndex, 1)[0];
  const partnerSocket = io.sockets.sockets.get(partnerEntry.socketId);

  if (!partnerSocket) {
    queueOrMatch(socket);
    return;
  }

  const partnerProfile = profiles.get(partnerSocket.id);
  if (!partnerProfile) {
    queueOrMatch(socket);
    return;
  }

  const roomId = createRoomId();
  socket.join(roomId);
  partnerSocket.join(roomId);

  activeMatches.set(socket.id, { partnerId: partnerSocket.id, roomId });
  activeMatches.set(partnerSocket.id, { partnerId: socket.id, roomId });

  socket.emit('matched', {
    roomId,
    partnerName: partnerProfile.username,
    region: profile.region,
    initiator: true
  });

  partnerSocket.emit('matched', {
    roomId,
    partnerName: profile.username,
    region: partnerProfile.region,
    initiator: false
  });
};

io.on('connection', (socket) => {
  socket.on('join-queue', (payload = {}) => {
    const username = String(payload.username || '').trim().slice(0, 32);
    const region = String(payload.region || '').trim().slice(0, 64);
    const safeUsernamePattern = /^[\p{L}\p{N} _.'-]+$/u;
    const safeRegionPattern = /^[\p{L}\p{N} _'-]+$/u;

    if (!username || !region) {
      socket.emit('error-message', 'Pseudo et région requis.');
      return;
    }

    if (!safeUsernamePattern.test(username) || !safeRegionPattern.test(region)) {
      socket.emit('error-message', 'Pseudo ou région invalide.');
      return;
    }

    profiles.set(socket.id, { username, region });
    clearMatch(socket.id);
    queueOrMatch(socket);
  });

  socket.on('signal', (payload = {}) => {
    const match = activeMatches.get(socket.id);
    if (!match) return;
    const data = payload.data;
    if (!data) return;
    socket.to(match.roomId).emit('signal', { from: socket.id, data });
  });

  socket.on('zap', () => {
    const previousMatch = clearMatch(socket.id);
    if (previousMatch) {
      const partnerSocket = io.sockets.sockets.get(previousMatch.partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner-left');
        queueOrMatch(partnerSocket);
      }
    }
    queueOrMatch(socket);
  });

  socket.on('leave', () => {
    removeFromQueue(socket.id);
    const previousMatch = clearMatch(socket.id);
    if (previousMatch) {
      const partnerSocket = io.sockets.sockets.get(previousMatch.partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner-left');
        queueOrMatch(partnerSocket);
      }
    }
  });

  socket.on('disconnect', () => {
    removeFromQueue(socket.id);
    profiles.delete(socket.id);

    const previousMatch = clearMatch(socket.id);
    if (previousMatch) {
      const partnerSocket = io.sockets.sockets.get(previousMatch.partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner-left');
        queueOrMatch(partnerSocket);
      }
    }
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Signaling server listening on port ${PORT}`);
});
