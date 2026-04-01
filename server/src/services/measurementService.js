const Measurement = require('../models/Measurement');

class MeasurementService {
  /**
   * Normalise les données brutes reçues des capteurs
   */
  normalize(rawData, deviceId) {
    const normalized = {
      deviceId,
      timestamp: rawData.timestamp ? new Date(rawData.timestamp) : new Date(),
    };

    // Normalisation vibration (MPU6050)
    if (rawData.vibration) {
      const vib = rawData.vibration;
      normalized.vibration = {
        x: this.validateNumber(vib.x, -32768, 32767),
        y: this.validateNumber(vib.y, -32768, 32767),
        z: this.validateNumber(vib.z, -32768, 32767),
      };
      // Calcul de la magnitude
      normalized.vibration.magnitude = Math.sqrt(
        Math.pow(normalized.vibration.x, 2) +
        Math.pow(normalized.vibration.y, 2) +
        Math.pow(normalized.vibration.z, 2)
      );
    }

    // Normalisation température (DS18B20) - en Celsius
    if (rawData.temperature !== undefined) {
      normalized.temperature = this.validateNumber(
        rawData.temperature,
        -50,
        150
      );
    }

    // Normalisation courant (ACS712) - en Ampères
    if (rawData.current !== undefined) {
      normalized.current = this.validateNumber(rawData.current, 0, 100);
    }

    // Normalisation son (microphone) - en dB
    if (rawData.sound !== undefined) {
      normalized.sound = this.validateNumber(rawData.sound, 0, 120);
    }

    return normalized;
  }

  /**
   * Valide et normalise un nombre dans une plage donnée
   */
  validateNumber(value, min, max) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return null;
    }
    return Math.max(min, Math.min(max, num));
  }

  /**
   * Sauvegarde une mesure dans la base de données
   */
  async save(normalizedData) {
    const savedMeasurement = await Measurement.create(normalizedData);

    // Mettre à jour lastSeen pour le device
    const Device = require('../models/Device'); // Importation locale pour éviter les dépendances circulaires
    await Device.findByIdAndUpdate(
      normalizedData.deviceId,
      { lastSeen: normalizedData.timestamp, status: 'active' }
    );

    return savedMeasurement;
  }

  /**
   * Récupère les mesures d'un device
   */
  async getByDevice(deviceId, options = {}) {
    const {
      limit = 100,
      startDate,
      endDate,
      anomalyOnly = false,
    } = options;

    const query = { deviceId, limit };

    if (startDate) {
      query.startDate = startDate;
    }
    if (endDate) {
      query.endDate = endDate;
    }

    if (anomalyOnly) {
      query.isAnomaly = true;
    }

    return await Measurement.find(query);
  }

  /**
   * Récupère les statistiques d'un device
   */
  async getStatistics(deviceId, startDate, endDate) {
    const query = {
      deviceId,
      startDate,
      endDate
    };

    const measurements = await Measurement.find(query);

    const stats = {
      count: measurements.length,
      vibration: this.calculateStats(measurements, 'vibration.magnitude'),
      temperature: this.calculateStats(measurements, 'temperature'),
      current: this.calculateStats(measurements, 'current'),
      sound: this.calculateStats(measurements, 'sound'),
      anomalies: measurements.filter((m) => m.isAnomaly).length,
    };

    return stats;
  }

  /**
   * Calcule les statistiques (min, max, avg) pour un champ
   */
  calculateStats(measurements, field) {
    const values = measurements
      .map((m) => {
        const keys = field.split('.');
        let value = m;
        for (const key of keys) {
          value = value?.[key];
        }
        return value;
      })
      .filter((v) => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) {
      return { min: null, max: null, avg: null, count: 0 };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length,
    };
  }

  /**
   * Supprime les anciennes mesures (nettoyage)
   */
  async deleteOld(olderThanDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const deletedCount = await Measurement.deleteOld(cutoffDate);

    return deletedCount;
  }
}

module.exports = new MeasurementService();

