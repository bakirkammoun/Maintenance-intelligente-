const measurementService = require('../src/services/measurementService');

describe('MeasurementService', () => {
  describe('normalize', () => {
    it('devrait normaliser les données de vibration', () => {
      const rawData = {
        vibration: { x: 100, y: -50, z: 980 },
        timestamp: new Date().toISOString(),
      };

      const normalized = measurementService.normalize(rawData, 'ESP32-001');

      expect(normalized.vibration).toBeDefined();
      expect(normalized.vibration.x).toBe(100);
      expect(normalized.vibration.y).toBe(-50);
      expect(normalized.vibration.z).toBe(980);
      expect(normalized.vibration.magnitude).toBeCloseTo(
        Math.sqrt(100 * 100 + 50 * 50 + 980 * 980)
      );
    });

    it('devrait normaliser les données de température', () => {
      const rawData = {
        temperature: 25.5,
        deviceId: 'ESP32-001',
      };

      const normalized = measurementService.normalize(rawData, 'ESP32-001');

      expect(normalized.temperature).toBe(25.5);
    });

    it('devrait valider les valeurs dans les plages autorisées', () => {
      const rawData = {
        temperature: 200, // Au-delà de la limite (150)
        current: -5, // En dessous de la limite (0)
      };

      const normalized = measurementService.normalize(rawData, 'ESP32-001');

      expect(normalized.temperature).toBe(150);
      expect(normalized.current).toBe(0);
    });
  });

  describe('validateNumber', () => {
    it('devrait retourner null pour des valeurs invalides', () => {
      const result = measurementService.validateNumber('invalid', 0, 100);
      expect(result).toBeNull();
    });

    it('devrait limiter les valeurs aux bornes', () => {
      const result1 = measurementService.validateNumber(150, 0, 100);
      expect(result1).toBe(100);

      const result2 = measurementService.validateNumber(-10, 0, 100);
      expect(result2).toBe(0);
    });
  });
});

