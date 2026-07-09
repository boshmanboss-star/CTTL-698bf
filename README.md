# Chat Vocal Simple (WebRTC + Signalisation)

Application vocale simple :
- Connexion par pseudo
- Grand bouton rond pour lancer le vocal
- Choix de 14 régions ou **France entière**
- Matching en temps réel par région via Socket.IO
- Appel WebRTC audio avec 3 boutons :
  - **Zapper** (personne suivante)
  - **Couper/activer micro**
  - **Couper/activer haut-parleur**

## Démarrage local

1) Installer les dépendances :
```bash
npm install
```

2) Lancer le serveur de signalisation :
```bash
npm run server
```
(Par défaut sur `http://localhost:3001`)

3) Dans un autre terminal, lancer le frontend :
```bash
npm run dev
```
(Par défaut sur `http://localhost:5173`)

Le frontend utilise automatiquement `http://localhost:3001` comme signalisation.

## Variables d'environnement frontend

Pour pointer vers un autre serveur de signalisation :

```bash
VITE_SIGNALING_URL=https://ton-service.onrender.com
```

## Build production

```bash
npm run build
```

## Déploiement Render (recommandé)

Créer **2 services** :

1) **Web Service** (signalisation)
- Build Command: `npm install`
- Start Command: `npm run server`
- Environment: optionnel `CORS_ORIGIN=https://ton-frontend.onrender.com`

2) **Static Site** (frontend)
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment variable: `VITE_SIGNALING_URL=https://url-du-service-signalisation.onrender.com`
