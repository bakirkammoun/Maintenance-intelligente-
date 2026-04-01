const Device = require('../models/Device');
const Measurement = require('../models/Measurement');
const anomalyService = require('./anomalyService');
const alertService = require('./alertService');
const logger = require('../utils/logger');

class MonitoringService {
    constructor() {
        this.interval = null;
        this.checkIntervalMs = 5000; // 5 seconds
    }

    /**
     * Démarrer la surveillance périodique
     */
    start() {
        if (this.interval) {
            clearInterval(this.interval);
        }

        logger.info(`Démarrage du service de surveillance (intervalle: ${this.checkIntervalMs}ms)`);

        this.interval = setInterval(async () => {
            try {
                await this.checkAllDevices();
            } catch (error) {
                logger.error('Erreur lors de la surveillance périodique:', error);
            }
        }, this.checkIntervalMs);
    }

    /**
     * Arrêter la surveillance
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            logger.info('Service de surveillance arrêté');
        }
    }

    /**
     * Vérifie tous les devices actifs
     */
    async checkAllDevices() {
        try {
            const devices = await Device.find({ status: 'active' });

            for (const device of devices) {
                // Récupérer la mesure la plus récente
                const recentMeasurements = await Measurement.getRecentMeasurements(device.deviceId, 1);

                if (recentMeasurements && recentMeasurements.length > 0) {
                    const latestMeasurement = recentMeasurements[0];

                    // Vérifier les anomalies basées sur les seuils
                    const anomaly = await anomalyService.detect(latestMeasurement, device);

                    if (anomaly) {
                        // Créer ou mettre à jour l'alerte
                        // alertService.create gère déjà le broadcast WebSocket
                        await alertService.create(device.deviceId, anomaly);
                        logger.debug(`Surveillance: Alerte détectée pour ${device.deviceId}: ${anomaly.message}`);
                    }
                }
            }
        } catch (error) {
            logger.error('Erreur dans checkAllDevices:', error);
        }
    }
}

module.exports = new MonitoringService();
