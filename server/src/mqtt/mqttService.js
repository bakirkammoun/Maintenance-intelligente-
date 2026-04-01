const mqtt = require('mqtt');
const logger = require('../utils/logger');
const measurementService = require('../services/measurementService');
const anomalyService = require('../services/anomalyService');
const alertService = require('../services/alertService');
const Device = require('../models/Device');

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  connect() {
    const options = {
      clientId: process.env.MQTT_CLIENT_ID || 'maintenance-backend',
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      keepalive: 60
    };

    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

    logger.info(`Connexion au broker MQTT: ${brokerUrl}`);

    this.client = mqtt.connect(brokerUrl, options);

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Connecté au broker MQTT');

      // S'abonner aux topics des capteurs
      this.subscribe('devices/+/measurements');
      this.subscribe('devices/+/status');
    });

    this.client.on('message', async (topic, message) => {
      try {
        await this.handleMessage(topic, message);
      } catch (error) {
        logger.error('Erreur lors du traitement du message MQTT:', error);
      }
    });

    this.client.on('error', (error) => {
      logger.error('Erreur MQTT:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Connexion MQTT fermée');
      this.isConnected = false;
    });

    this.client.on('reconnect', () => {
      logger.info('Reconnexion au broker MQTT...');
    });

    this.client.on('offline', () => {
      logger.warn('Client MQTT hors ligne');
      this.isConnected = false;
    });
  }

  subscribe(topic) {
    if (this.client && this.isConnected) {
      this.client.subscribe(topic, (err) => {
        if (err) {
          logger.error(`Erreur lors de l'abonnement à ${topic}:`, err);
        } else {
          logger.info(`Abonné au topic: ${topic}`);
        }
      });
    }
  }

  async handleMessage(topic, message) {
    const topicParts = topic.split('/');
    const deviceId = topicParts[1];
    const messageType = topicParts[2];

    if (messageType === 'measurements') {
      await this.handleMeasurement(deviceId, message);
    } else if (messageType === 'status') {
      await this.handleStatus(deviceId, message);
    }
  }

  async handleMeasurement(deviceId, message) {
    try {
      const data = JSON.parse(message.toString());

      // Auto-enregistrer le device s'il n'existe pas encore
      let device = await Device.findById(deviceId);
      if (!device) {
        logger.info(`Device inconnu "${deviceId}" — création automatique...`);
        try {
          await Device.create({
            deviceId,
            name: `Device ${deviceId}`,
            location: 'Auto-enregistré (Wokwi)',
            type: 'other',
            status: 'active',
            sensors: {
              vibration: { enabled: true, threshold: 15 },
              temperature: { enabled: true, threshold: 80 },
              current: { enabled: true, threshold: 9 },
              sound: { enabled: true, threshold: 90 }
            },
            samplingRate: 1000,
            bufferSize: 100
          });
          device = await Device.findById(deviceId);
          logger.info(`Device "${deviceId}" créé automatiquement.`);
          // Notifier le frontend qu'un nouveau device est disponible
          if (global.broadcastToClients) {
            global.broadcastToClients({ type: 'device_registered', deviceId });
          }
        } catch (createErr) {
          logger.error(`Impossible de créer le device "${deviceId}":`, createErr);
        }
      }

      // Mettre à jour lastSeen du device
      await Device.findByIdAndUpdate(deviceId, { lastSeen: new Date() });

      // Normaliser les données
      const normalizedData = measurementService.normalize(data, deviceId);

      // Sauvegarder la mesure
      const measurement = await measurementService.save(normalizedData);

      // Détecter les anomalies
      if (device) {
        const anomaly = await anomalyService.detect(measurement, device);
        if (anomaly) {
          await alertService.create(deviceId, anomaly);
        }
      }

      // Broadcast aux clients WebSocket
      if (global.broadcastToClients) {
        global.broadcastToClients({
          type: 'measurement',
          deviceId,
          data: measurement
        });
      }

      logger.debug(`Mesure reçue de ${deviceId}:`, normalizedData);
    } catch (error) {
      logger.error(`Erreur lors du traitement de la mesure de ${deviceId}:`, error);
    }
  }

  async handleStatus(deviceId, message) {
    try {
      const status = JSON.parse(message.toString());

      await Device.findByIdAndUpdate(
        deviceId,
        {
          lastSeen: new Date(),
          status: status.status || 'active'
        }
      );

      logger.info(`Statut reçu de ${deviceId}:`, status);
    } catch (error) {
      logger.error(`Erreur lors du traitement du statut de ${deviceId}:`, error);
    }
  }

  publish(topic, message) {
    if (this.client && this.isConnected) {
      this.client.publish(topic, JSON.stringify(message), (err) => {
        if (err) {
          logger.error(`Erreur lors de la publication sur ${topic}:`, err);
        }
      });
    }
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
    }
  }
}

module.exports = new MQTTService();

