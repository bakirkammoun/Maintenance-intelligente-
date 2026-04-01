const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Charger les variables d'environnement
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDb = require('./config/db');
const mqttService = require('./mqtt/mqttService');
const monitoringService = require('./services/monitoringService');
const apiRoutes = require('./api/routes');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// WebSocket Server (même serveur HTTP)
const wss = new WebSocket.Server({ server, path: '/ws' });
global.wss = wss; // Pour accès depuis autres modules

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes API
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const DB_PATH = path.resolve(__dirname, '../data/maintenance.db');

async function initializeDatabase() {
  const db = connectDb();
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create users table
      db.run(`
          CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              email TEXT NOT NULL UNIQUE,
              password TEXT NOT NULL,
              role TEXT DEFAULT 'user',
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );
      `, (err) => {
        if (err) {
          logger.error('Error creating users table:', err.message);
          return reject(err);
        }
        logger.info('Users table ready');
      });

      // Create sessions table
      db.run(`
          CREATE TABLE IF NOT EXISTS sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              userId INTEGER NOT NULL,
              token TEXT NOT NULL UNIQUE,
              expiresAt DATETIME NOT NULL,
              ipAddress TEXT,
              userAgent TEXT,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
          );
      `, (err) => {
        if (err) {
          logger.error('Error creating sessions table:', err.message);
          return reject(err);
        }
        logger.info('Sessions table ready');
      });

      // Create devices table
      db.run(`
          CREATE TABLE IF NOT EXISTS devices (
              deviceId TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              location TEXT NOT NULL,
              type TEXT NOT NULL,
              status TEXT DEFAULT 'active',
              vibration_enabled BOOLEAN,
              vibration_threshold REAL,
              temperature_enabled BOOLEAN,
              temperature_threshold REAL,
              current_enabled BOOLEAN,
              current_threshold REAL,
              sound_enabled BOOLEAN,
              sound_threshold REAL,
              samplingRate INTEGER DEFAULT 1000,
              bufferSize INTEGER DEFAULT 100,
              lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );
      `, (err) => {
        if (err) {
          logger.error('Error creating devices table:', err.message);
          return reject(err);
        }
        logger.info('Devices table ready');
      });

      // Create measurements table
      db.run(`
          CREATE TABLE IF NOT EXISTS measurements (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              deviceId TEXT NOT NULL,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              vibration_x REAL,
              vibration_y REAL,
              vibration_z REAL,
              vibration_magnitude REAL,
              temperature REAL,
              current REAL,
              sound REAL,
              isAnomaly BOOLEAN DEFAULT FALSE,
              anomalyReason TEXT,
              processed BOOLEAN DEFAULT FALSE,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (deviceId) REFERENCES devices (deviceId)
          );
      `, (err) => {
        if (err) {
          logger.error('Error creating measurements table:', err.message);
          return reject(err);
        }
        logger.info('Measurements table ready');
      });

      // Create alerts table
      db.run(`
          CREATE TABLE IF NOT EXISTS alerts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              deviceId TEXT NOT NULL,
              severity TEXT NOT NULL,
              type TEXT NOT NULL,
              message TEXT NOT NULL,
              value REAL,
              threshold REAL,
              status TEXT DEFAULT 'open',
              acknowledgedBy TEXT,
              acknowledgedAt DATETIME,
              resolvedAt DATETIME,
              notifications_email_sent BOOLEAN,
              notifications_email_sentAt DATETIME,
              notifications_webhook_sent BOOLEAN,
              notifications_webhook_sentAt DATETIME,
              notifications_push_sent BOOLEAN,
              notifications_push_sentAt DATETIME,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (deviceId) REFERENCES devices (deviceId)
          );
      `, async (err) => {
        if (err) {
          logger.error('Error creating alerts table:', err.message);
          return reject(err);
        }
        logger.info('Alerts table ready');

        // Insert default admin user if not exists
        db.get("SELECT COUNT(*) as count FROM users WHERE username = ?", ['admin'], async (err, row) => {
          if (err) {
            logger.error('Error checking for admin user:', err.message);
            return reject(err);
          }
          if (row.count === 0) {
            const hashedPassword = await bcrypt.hash('adminpassword', 10);
            db.run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
              ['admin', 'admin@example.com', hashedPassword, 'admin'],
              function (err) {
                if (err) {
                  logger.error('Error creating default admin user:', err.message);
                  return reject(err);
                }
                logger.info('Default admin user created: admin/adminpassword');
                resolve();
              }
            );
          } else {
            logger.info('Admin user already exists.');
            resolve();
          }
        });
      });
    });
  });
}

async function startServer() {
  try {
    // Ensure the data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    await initializeDatabase();
    logger.info('SQLite database initialized successfully.');

    // Démarrer le service MQTT
    mqttService.connect();

    // Démarrer la surveillance périodique
    monitoringService.start();

    // Démarrer le serveur
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Serveur démarré sur le port ${PORT}`);
      console.log(`Serveur démarré sur le port ${PORT}`);
      wss.on('listening', () => {
        logger.info('WebSocket Server démarré');
        console.log('WebSocket Server démarré');
      });
    });
  } catch (error) {
    logger.error('Erreur lors du démarrage du serveur:', error);
    console.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

startServer();

// Gestion WebSocket
wss.on('connection', (ws) => {
  logger.info('Nouvelle connexion WebSocket');

  ws.on('close', () => {
    logger.info('Connexion WebSocket fermée');
  });

  ws.on('error', (error) => {
    logger.error('Erreur WebSocket:', error);
  });
});

// Broadcast aux clients WebSocket
global.broadcastToClients = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// Gestion des erreurs
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
  console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;

