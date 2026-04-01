# Projet de Maintenance Prédictive Intelligente

## Résumé du projet

Ce projet implémente un système complet de maintenance prédictive basé sur l'IoT pour surveiller en continu l'état des équipements industriels et anticiper les pannes avant qu'elles ne surviennent.

## Fonctionnalités principales

### ✅ Acquisition des données
- Collecte en temps réel via ESP32
- 4 types de capteurs : vibration, température, courant, son
- Fréquence d'échantillonnage configurable
- Bufferisation et renvoi automatique en cas de perte réseau

### ✅ Communication
- Protocole MQTT avec authentification
- Format JSON structuré pour les payloads
- WebSocket pour les mises à jour temps réel

### ✅ Backend
- API REST complète (Node.js/Express)
- Service MQTT pour l'ingestion des données
- Normalisation et validation des données
- Détection d'anomalies basée sur des règles
- Gestion des alertes et notifications

### ✅ Stockage
- MongoDB avec collections optimisées
- Collections : measurements, devices, alerts, users, sessions
- Index pour performances optimales

### ✅ Frontend
- Dashboard temps réel avec graphiques
- Authentification sécurisée
- Pages : machines, détails machine, alertes, configuration, logs
- Interface moderne et responsive

### ✅ Notifications
- Email (SMTP)
- Webhook
- Push (structure prête)

### ✅ Sécurité
- Authentification JWT
- TLS pour MQTT (configurable)
- Validation des données
- Gestion des sessions

### ✅ Tests
- Tests unitaires (Jest)
- Tests d'intégration
- Structure pour tests de charge

## Architecture technique

### Stack technologique

**Backend:**
- Node.js 18+
- Express.js
- MongoDB avec Mongoose
- MQTT (mosquitto)
- WebSocket (ws)
- JWT pour l'authentification

**Frontend:**
- React 18
- React Router
- Recharts pour les graphiques
- WebSocket pour temps réel
- Axios pour les API

**IoT:**
- ESP32
- Capteurs : MPU6050, DS18B20, ACS712, MAX9814

**Infrastructure:**
- Docker Compose
- MongoDB
- Mosquitto MQTT Broker

## Structure du projet

```
projet-de-maintenance/
├── backend/                 # Serveur Node.js
│   ├── src/
│   │   ├── api/           # Routes API REST
│   │   ├── mqtt/          # Service MQTT
│   │   ├── services/      # Services métier
│   │   ├── models/        # Modèles MongoDB
│   │   ├── middleware/    # Middleware
│   │   └── utils/         # Utilitaires
│   └── tests/             # Tests
├── frontend/              # Application React
│   ├── src/
│   │   ├── components/    # Composants React
│   │   ├── pages/         # Pages
│   │   ├── services/      # Services API
│   │   └── contexts/      # Contextes React
├── esp32/                 # Code Arduino
│   └── sensors/           # Code des capteurs
├── mqtt/                  # Configuration MQTT
├── docker-compose.yml     # Configuration Docker
└── README.md              # Documentation principale
```

## Capteurs implémentés

1. **MPU6050 (Vibration)**
   - Mesure accélération 3 axes
   - Calcul de magnitude
   - Détection d'anomalies mécaniques

2. **DS18B20 (Température)**
   - Mesure -50°C à 150°C
   - Détection de surchauffe

3. **ACS712 (Courant)**
   - Mesure 0-30A
   - Surveillance consommation électrique

4. **MAX9814 (Son)**
   - Mesure niveau sonore
   - Détection bruits anormaux

## Détection d'anomalies

Le système détecte les anomalies en comparant les valeurs mesurées avec des seuils configurables :

- **Vibration** : Seuil de magnitude configurable
- **Température** : Seuil de température maximale
- **Courant** : Détection de variations anormales (>20%)
- **Son** : Seuil de niveau sonore

Sévérité des alertes :
- **Low** : 1.0x - 1.2x du seuil
- **Medium** : 1.2x - 1.5x du seuil
- **High** : 1.5x - 2.0x du seuil
- **Critical** : >2.0x du seuil

## Utilisation

### Démarrage rapide

1. **Démarrer l'infrastructure** :
   ```bash
   docker-compose up -d
   ```

2. **Configurer le backend** :
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Éditer .env
   node src/scripts/createAdmin.js
   npm start
   ```

3. **Configurer le frontend** :
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Éditer .env
   npm run dev
   ```

4. **Uploader le code ESP32** :
   - Ouvrir `esp32/sensors/main.ino` dans Arduino IDE
   - Configurer WiFi et MQTT
   - Uploader sur l'ESP32

### Accès

- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:3000/api
- **Health Check** : http://localhost:3000/health
- **MongoDB** : mongodb://localhost:27017
- **MQTT** : mqtt://localhost:1883

## API Principale

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `GET /api/auth/me` - Utilisateur actuel

### Devices
- `GET /api/devices` - Liste des devices
- `GET /api/devices/:deviceId` - Détails d'un device
- `POST /api/devices` - Créer un device
- `PUT /api/devices/:deviceId` - Mettre à jour

### Mesures
- `GET /api/measurements` - Récupérer les mesures
- `GET /api/measurements/statistics` - Statistiques

### Alertes
- `GET /api/alerts` - Liste des alertes
- `GET /api/alerts/statistics` - Statistiques
- `PUT /api/alerts/:alertId/status` - Mettre à jour le statut

### Dashboard
- `GET /api/dashboard/overview` - Vue d'ensemble
- `GET /api/dashboard/device/:deviceId` - Détails device

## Sécurité

- ✅ Authentification JWT
- ✅ Hash des mots de passe (bcrypt)
- ✅ Validation des données
- ✅ Gestion des sessions
- ✅ CORS configuré
- ⚠️ TLS pour MQTT (à configurer en production)
- ⚠️ Rate limiting (à implémenter)

## Tests

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## Améliorations futures

1. **Machine Learning** : Détection d'anomalies avancée
2. **Prédiction** : Modèles prédictifs de panne
3. **Mobile** : Application mobile
4. **Edge Computing** : Traitement sur ESP32
5. **Multi-tenant** : Support multi-organisations
6. **Analytics** : Tableaux de bord avancés
7. **Rapports** : Génération de rapports PDF

## Contribution

Pour contribuer au projet :
1. Fork le repository
2. Créer une branche feature
3. Faire les modifications
4. Créer une pull request

## Licence

MIT License

## Support

Pour toute question ou problème :
- Créer une issue sur GitHub
- Consulter la documentation dans `/docs`
- Vérifier les logs dans `backend/logs/`

