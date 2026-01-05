# MedFlow - Ophthalmology Practice Management System

**Version**: 2.0.0
**Dernière mise à jour**: Janvier 2026

---

## Aperçu

MedFlow est un système complet de gestion de cabinet d'ophtalmologie conçu pour les pratiques multi-sites au Congo (RDC). Il couvre l'ensemble du parcours patient, de l'enregistrement à la facturation.

### Fonctionnalités Principales

| Module | Description |
|--------|-------------|
| **Patients** | Enregistrement, dossier médical, reconnaissance faciale |
| **StudioVision** | Consultation ophtalmologique complète (acuité, réfraction, PIO, examen) |
| **Orthoptie** | Examens orthoptiques, tests pédiatriques |
| **IVT** | Injections intravitréennes, protocoles, suivi |
| **Chirurgie** | Programmation bloc, templates, suivi post-op |
| **Pharmacie** | Stock, dispensation, interactions médicamenteuses |
| **Laboratoire** | Commandes, résultats, intégration LIS |
| **Boutique Optique** | Montures, verres, lentilles, commandes |
| **Facturation** | Factures, conventions, paiements multiples |
| **Rendez-vous** | Agenda, file d'attente, rappels |
| **Multi-Cliniques** | Gestion centralisée, transferts stock |

---

## Stack Technique

```
Frontend:  React 19 + Vite + Tailwind CSS + Redux Toolkit
Backend:   Node.js 18+ + Express + MongoDB + Redis
Services:  Python (FastAPI) - Reconnaissance faciale, OCR
```

---

## Installation Rapide

### Prérequis

- Node.js 18+
- MongoDB (local ou Atlas)
- Redis
- Python 3.9+ (pour services AI)

### 1. Cloner et installer

```bash
git clone <repository-url>
cd magloire

# Backend
cd backend
npm install
cp .env.example .env   # Configurer les variables

# Frontend
cd ../frontend
npm install
```

### 2. Configurer l'environnement

Créer `backend/.env` avec:

```env
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://localhost:27017/medflow
REDIS_URL=redis://localhost:6379
JWT_SECRET=votre-secret-jwt
JWT_REFRESH_SECRET=votre-secret-refresh
PHI_ENCRYPTION_KEY=votre-cle-chiffrement-32-caracteres
```

### 3. Initialiser la base de données

```bash
cd backend
npm run setup        # Installation de base
# ou
npm run setup:full   # Avec données de démonstration
```

### 4. Démarrer l'application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

L'application sera disponible sur:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5001

---

## Comptes par Défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@medflow.cd | Admin123!@# |

---

## Structure du Projet

```
magloire/
├── backend/           # API Node.js/Express
│   ├── controllers/   # Logique des routes
│   ├── models/        # Schémas Mongoose
│   ├── routes/        # Définition des routes
│   ├── services/      # Logique métier
│   ├── middleware/    # Auth, validation, erreurs
│   └── scripts/       # Seeds et migrations
├── frontend/          # Application React
│   ├── src/pages/     # Pages/routes
│   ├── src/components/# Composants réutilisables
│   ├── src/services/  # Appels API
│   └── src/store/     # État Redux
├── face-service/      # Microservice reconnaissance faciale
├── ocr-service/       # Microservice OCR
└── docs/              # Documentation technique
```

---

## Déploiement Production

Voir [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) pour les instructions complètes.

### Checklist Rapide

1. **Base de données**: MongoDB Atlas (replica set pour transactions)
2. **Cache**: Upstash Redis ou Redis Cloud
3. **Email**: Mailtrap (sandbox) ou service SMTP production
4. **SMS**: Twilio (optionnel)
5. **Hébergement**: VPS, Railway, Render, ou cloud provider

### Variables Production Requises

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
REDIS_URL=rediss://...
JWT_SECRET=<généré>
PHI_ENCRYPTION_KEY=<généré>
MAILTRAP_API_TOKEN=<votre-token>
```

---

## Sécurité

- **Authentification**: JWT avec refresh tokens
- **Chiffrement PHI**: Données patient chiffrées au repos
- **RBAC**: Contrôle d'accès par rôle (médecin, infirmier, etc.)
- **Audit**: Journalisation de tous les accès données sensibles
- **CSRF**: Protection contre les attaques cross-site

---

## Support

Pour toute question ou problème:
- Email: contact@magloire-ophtalmo.cd
- Documentation: `/docs/`

---

## Licence

Propriétaire - Centre Ophtalmologique Magloire
