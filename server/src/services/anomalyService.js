const Measurement = require('../models/Measurement');
const logger = require('../utils/logger');

class AnomalyService {
  /**
   * Détecte les anomalies dans une mesure basée sur les seuils du device
   */
  async detect(measurement, device) {
    const anomalies = [];
    const sensors = device.sensors || {};

    // Détection vibration
    if (
      sensors.vibration?.enabled &&
      measurement.vibration?.magnitude !== undefined
    ) {
      const threshold = sensors.vibration.threshold || 1000;
      if (measurement.vibration.magnitude > threshold) {
        anomalies.push({
          type: 'vibration',
          severity: this.calculateSeverity(
            measurement.vibration.magnitude,
            threshold
          ),
          message: `Vibration élevée détectée: ${measurement.vibration.magnitude.toFixed(2)} (seuil: ${threshold})`,
          value: measurement.vibration.magnitude,
          threshold: threshold,
        });
      }
    }

    // Détection température
    if (
      sensors.temperature?.enabled &&
      measurement.temperature !== undefined
    ) {
      const threshold = sensors.temperature.threshold || 80;
      if (measurement.temperature > threshold) {
        anomalies.push({
          type: 'temperature',
          severity: this.calculateSeverity(measurement.temperature, threshold),
          message: `Température élevée détectée: ${measurement.temperature.toFixed(2)}°C (seuil: ${threshold}°C)`,
          value: measurement.temperature,
          threshold: threshold,
        });
      }
    }

    // Détection courant
    if (
      sensors.current?.enabled &&
      measurement.current !== undefined
    ) {
      const threshold = sensors.current.threshold || 10;
      // Alerte si le courant dépasse le seuil configuré
      if (measurement.current > threshold) {
        anomalies.push({
          type: 'current',
          severity: this.calculateSeverity(measurement.current, threshold),
          message: `Courant élevé détecté: ${measurement.current.toFixed(2)}A (seuil: ${threshold}A)`,
          value: measurement.current,
          threshold: threshold,
        });
      }
    }

    // Détection son
    if (sensors.sound?.enabled && measurement.sound !== undefined) {
      const threshold = sensors.sound.threshold || 70;
      if (measurement.sound > threshold) {
        anomalies.push({
          type: 'sound',
          severity: this.calculateSeverity(measurement.sound, threshold),
          message: `Bruit anormal détecté: ${measurement.sound.toFixed(2)}dB (seuil: ${threshold}dB)`,
          value: measurement.sound,
          threshold: threshold,
        });
      }
    }

    // Marquer la mesure comme anomalie si au moins une détectée
    if (anomalies.length > 0) {
      const highestSeverity = anomalies.reduce((max, a) => {
        const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
        return severityOrder[a.severity] > severityOrder[max.severity]
          ? a
          : max;
      }, anomalies[0]);

      measurement.isAnomaly = true;
      measurement.anomalyReason = highestSeverity.message;

      // Mettre à jour la mesure dans la base de données
      if (measurement._id) {
        await Measurement.updateById(measurement._id, {
          isAnomaly: true,
          anomalyReason: highestSeverity.message
        });
      }

      return highestSeverity;
    }

    return null;
  }

  /**
   * Calcule la sévérité basée sur l'écart par rapport au seuil
   */
  calculateSeverity(value, threshold) {
    const ratio = value / threshold;

    if (ratio >= 2.0) {
      return 'critical';
    } else if (ratio >= 1.5) {
      return 'high';
    } else if (ratio >= 1.2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Détection d'anomalies avancée basée sur des patterns
   */
  async detectPatternAnomalies(deviceId, recentMeasurements) {
    if (recentMeasurements.length < 10) {
      return null; // Pas assez de données
    }

    // Calcul de la moyenne mobile
    const windowSize = 5;
    const averages = [];
    for (let i = 0; i <= recentMeasurements.length - windowSize; i++) {
      const window = recentMeasurements.slice(i, i + windowSize);
      const avg =
        window.reduce((sum, m) => sum + (m.vibration?.magnitude || 0), 0) /
        windowSize;
      averages.push(avg);
    }

    // Détection de tendance croissante anormale
    if (averages.length >= 3) {
      const trend =
        (averages[averages.length - 1] - averages[0]) / averages.length;
      if (trend > averages[0] * 0.1) {
        // Augmentation de plus de 10%
        return {
          type: 'pattern',
          severity: 'medium',
          message: `Tendance croissante anormale détectée dans les vibrations`,
        };
      }
    }

    return null;
  }
}

module.exports = new AnomalyService();

