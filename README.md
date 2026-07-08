# Portes du Destin - MVP Web (Frontend Only)

Version web simplifiée : frontend React seul, localStorage, provably-fair.
Accessible depuis n'importe quel navigateur (desktop, mobile, iPhone).

## Démarrage rapide

### Localement (avec Node.js) :
```bash
npm install
npm run dev
```
Ouvert : http://localhost:5173 (Vite)

### Via Gitpod (gratuit, pas besoin d'installer) :
Clique sur le lien ci-dessous :
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/boshmanboss-star/CTTL)

### Via Netlify (déploiement auto) :
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/boshmanboss-star/CTTL)

## Fonctionnalités

- **Signup/Login** : crée un joueur, sauvegardé en localStorage.
- **Configuration du jeu** : affiche les 10 paliers (portes, chances affichées, multis).
- **Provably Fair** :
  - Admin crée une session : le serveur_seed est hashé, le hash est affiché au joueur.
  - Joueur joue : résultat déterministe basé sur HMAC(server_seed, client_seed, palier).
  - Admin révèle : affiche le server_seed, le joueur peut vérifier le hash.
- **Wallet faux argent** : crédits stockés en localStorage (100€ initial par joueur).
- **Journal des plays** : historique des tours joués.

## Architecture

- **Frontend** : React 18 + Vite
- **Storage** : localStorage (players, pf_sessions, plays)
- **Provably Fair** : crypto (sha256, hmac) côté client/admin (simulation serveur)

## Clés de développement

- Admin key (pour créer/révéler sessions PF) : `admin_demo_key` (configurable dans App.jsx)
- Salt (pour hashing server_seed) : `demo_salt_pf` (configurable dans utils.js)

## Notes

- Toutes les données sont en localStorage — elles persistent tant que le cache n'est pas vidé.
- Pour production : remplacer par un vrai backend (Express, DB, etc.).
- Provably fair : simulation complète côté client pour démo. En production, le server_seed doit rester secret sur un vrai serveur.
