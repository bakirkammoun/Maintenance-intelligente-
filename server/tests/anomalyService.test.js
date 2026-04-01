const anomalyService = require('../src/services/anomalyService');
const Measurement = require('../src/models/Measurement');

describe('AnomalyService', () => {
  describe('detect', () => {
    it('devrait détecter une vibration élevée', async () => {
      const measurement = new Measurement({
        deviceId: 'ESP32-001',
        vibration: { magnitude: 1500 },
      });

      const device = {
        sensors: {
          vibration: { enabled: true, threshold: 1000 },
        },
      };

      const anomaly = await anomalyService.detect(measurement, device);

      expect(anomaly).toBeDefined();
      expect(anomaly.type).toBe('vibration');
      expect(anomaly.severity).toBeDefined();
    });

    it('devrait détecter une température élevée', async () => {
      const measurement = new Measurement({
        deviceId: 'ESP32-001',
        temperature: 90,
      });

      const device = {
        sensors: {
          temperature: { enabled: true, threshold: 80 },
        },
      };

      const anomaly = await anomalyService.detect(measurement, device);

      expect(anomaly).toBeDefined();
      expect(anomaly.type).toBe('temperature');
    });

    it('ne devrait pas détecter d\'anomalie si les valeurs sont normales', async () => {
      const measurement = new Measurement({
        deviceId: 'ESP32-001',
        vibration: { magnitude: 500 },
        temperature: 25,
      });

      const device = {
        sensors: {
          vibration: { enabled: true, threshold: 1000 },
          temperature: { enabled: true, threshold: 80 },
        },
      };

      const anomaly = await anomalyService.detect(measurement, device);

      expect(anomaly).toBeNull();
    });
  });

  describe('calculateSeverity', () => {
    it('devrait calculer la sévérité correctement', () => {
      const severity1 = anomalyService.calculateSeverity(2000, 1000); // ratio 2.0
      expect(severity1).toBe('critical');

      const severity2 = anomalyService.calculateSeverity(1500, 1000); // ratio 1.5
      expect(severity2).toBe('high');

      const severity3 = anomalyService.calculateSeverity(1200, 1000); // ratio 1.2
      expect(severity3).toBe('medium');

      const severity4 = anomalyService.calculateSeverity(1100, 1000); // ratio 1.1
      expect(severity4).toBe('low');
    });
  });
});

