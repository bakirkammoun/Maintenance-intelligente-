const mqtt = require('mqtt');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data/maintenance.db');
const db = new sqlite3.Database(DB_PATH);

function getRandomValue(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(3));
}

async function simulateMeasurements() {
  console.log(`🚀 Simulation lancée sur: ${BROKER_URL}`);
  const client = mqtt.connect(BROKER_URL);

  client.on('connect', () => {
    console.log('✅ Connecté au broker MQTT. Envoi de données si actif...');

    setInterval(() => {
      // Récupérer les devices actifs depuis la DB
      db.all("SELECT deviceId FROM devices WHERE status = 'active'", [], (err, rows) => {
        if (err) {
          console.error('Erreur DB simulation:', err.message);
          return;
        }

        const activeDevices = rows.map(r => r.deviceId);

        activeDevices.forEach((deviceId) => {
          const topic = `devices/${deviceId}/measurements`;

          // Structure alignée sur le Backend
          const message = {
            temperature: getRandomValue(70, 80),
            vibration: {
              x: getRandomValue(0.05, 0.15),
              y: getRandomValue(0.05, 0.15),
              z: 9.81 + getRandomValue(-0.2, 0.2)
            },
            current: getRandomValue(0.18, 0.25),
            sound: getRandomValue(40, 60),
            timestamp: new Date().toISOString()
          };

          client.publish(topic, JSON.stringify(message));
        });
      });
    }, 2000);
  });

  client.on('error', (err) => {
    console.error('Erreur MQTT:', err);
  });

  client.on('close', () => {
    console.log('Déconnecté du broker MQTT.');
  });
}

simulateMeasurements();

