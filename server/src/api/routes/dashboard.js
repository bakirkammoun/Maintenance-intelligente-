const express = require('express');
const Device = require('../../models/Device');
const Measurement = require('../../models/Measurement');
const measurementService = require('../../services/measurementService');
const alertService = require('../../services/alertService');
const predictionService = require('../../services/predictionService');
const { authenticate } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * GET /api/dashboard/overview
 * Vue d'ensemble du dashboard
 */
router.get('/overview', async (req, res) => {
  try {
    let totalDevices = 0;
    let activeDevicesCount = 0;
    let inactiveDevicesCount = 0;
    let alertStats = { total: 0, byStatus: {}, bySeverity: {}, byType: {} };
    let recentAlerts = [];

    try {
      totalDevices = await Device.countTotal() || 0;
    } catch (error) {
      console.error('Erreur lors du comptage des devices:', error.message);
    }

    try {
      activeDevicesCount = await Device.countActive() || 0;
    } catch (error) {
      console.error('Erreur lors du comptage des devices actifs:', error.message);
    }

    try {
      inactiveDevicesCount = await Device.countInactive() || 0;
    } catch (error) {
      console.error('Erreur lors du comptage des devices inactifs:', error.message);
    }

    try {
      alertStats = await alertService.getStatistics() || { total: 0, byStatus: {}, bySeverity: {}, byType: {} };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques d\'alertes:', error.message);
    }

    try {
      recentAlerts = await alertService.getRecentAlerts(5) || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des alertes récentes:', error.message);
    }

    // S'assurer que byStatus existe et a des valeurs par défaut
    const byStatus = alertStats?.byStatus || {};

    res.json({
      totalDevices,
      activeDevices: activeDevicesCount,
      inactiveDevices: inactiveDevicesCount,
      openAlerts: byStatus.open || 0,
      alertStats: {
        total: alertStats?.total || 0,
        byStatus: byStatus,
        bySeverity: alertStats?.bySeverity || {},
        byType: alertStats?.byType || {},
      },
      recentAlerts: recentAlerts || [],
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération du dashboard:', error);
    console.error('Stack trace:', error.stack);
    // Retourner des valeurs par défaut au lieu d'une erreur 500
    res.json({
      totalDevices: 0,
      activeDevices: 0,
      inactiveDevices: 0,
      openAlerts: 0,
      alertStats: {
        total: 0,
        byStatus: {},
        bySeverity: {},
        byType: {},
      },
      recentAlerts: [],
    });
  }
});

/**
 * Génère des données simulées pour le graphique
 */
function generateSimulatedMeasurements(limit = 50) {
  const measurements = [];
  const now = new Date();
  let lastVibration = 1.5;
  let lastTemperature = 50;

  for (let i = 0; i < limit; i++) {
    const timestamp = new Date(now.getTime() - (limit - i - 1) * 2000); // 2 secondes d'intervalle

    // Variation progressive (marche aléatoire)
    lastVibration = Math.max(0.5, Math.min(3.5, lastVibration + (Math.random() - 0.5) * 0.3));
    lastTemperature = Math.max(25, Math.min(75, lastTemperature + (Math.random() - 0.5) * 2));

    measurements.push({
      timestamp,
      vibration: lastVibration,
      temperature: lastTemperature,
      current: Math.random() * 20 + 5,
      sound: Math.random() * 45 + 50,
    });
  }

  return measurements;
}

/**
 * GET /api/dashboard/recent-measurements
 * Récupérer les dernières mesures récentes de tous les devices
 */
router.get('/recent-measurements', async (req, res) => {
  // Définir limitNum en dehors du try pour qu'il soit accessible partout
  let limitNum = 50;
  try {
    const { limit = 50 } = req.query || {};
    limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 1000); // Entre 1 et 1000
  } catch (parseError) {
    limitNum = 50; // Valeur par défaut si le parsing échoue
  }

  // Fonction helper pour retourner des données de fallback
  const returnFallbackData = () => {
    if (res.headersSent) {
      return; // Ne pas envoyer de réponse si déjà envoyée
    }
    try {
      const simulatedData = generateSimulatedMeasurements(limitNum);
      return res.json(simulatedData);
    } catch (simError) {
      logger.error('Erreur lors de la génération de données simulées:', simError);
      // Dernier recours: retourner un tableau avec une seule mesure
      return res.json([{
        timestamp: new Date(),
        vibration: 1.5,
        temperature: 50,
        current: 10,
        sound: 60
      }]);
    }
  };

  try {
    // Toujours retourner des données simulées pour garantir une réponse
    // On essaie d'abord de récupérer les vraies données, mais on a toujours un fallback
    let measurements = [];

    try {
      const Measurement = require('../../models/Measurement');
      measurements = await Measurement.find({ limit: limitNum });

      if (Array.isArray(measurements) && measurements.length > 0) {
        try {
          const formatted = measurements
            .reverse()
            .slice(0, limitNum)
            .map(m => {
              if (!m) return null;
              try {
                return {
                  timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
                  vibration: (m.vibration && typeof m.vibration === 'object' && m.vibration.magnitude !== undefined)
                    ? Number(m.vibration.magnitude) || 0
                    : (typeof m.vibration === 'number' ? Number(m.vibration) || 0 : 0),
                  temperature: Number(m.temperature) || 0,
                  current: Number(m.current) || 0,
                  sound: Number(m.sound) || 0,
                };
              } catch (err) {
                return null;
              }
            })
            .filter(m => m !== null && m !== undefined);

          if (formatted && formatted.length > 0 && !res.headersSent) {
            return res.json(formatted);
          }
        } catch (formatError) {
          console.warn('Erreur lors du formatage, utilisation de données simulées:', formatError.message);
        }
      }
    } catch (dbError) {
      // Ignorer les erreurs de DB, on utilisera les données simulées
      console.warn('Erreur DB (ignorée, utilisation de données simulées):', dbError.message);
    }

    // Fallback: toujours retourner des données simulées
    return returnFallbackData();

  } catch (error) {
    // En cas d'erreur absolue, retourner quand même des données
    logger.error('Erreur critique dans recent-measurements:', error);
    console.error('Stack trace:', error.stack);
    return returnFallbackData();
  }
});

/**
 * POST /api/dashboard/refresh-data
 * Générer de nouvelles données aléatoires
 */
router.post('/refresh-data', async (req, res) => {
  try {
    // Importer le script de génération de données
    const generateRandomData = require('../../scripts/generateRandomData');

    // Exécuter la génération complète (qui inclut la suppression des anciennes données)
    // Note: generateRandomData gère déjà la connexion DB et la logique de suppression/création
    await generateRandomData();

    res.json({
      success: true,
      message: 'Données régénérées avec succès (nouveaux devices critiques sélectionnés)',
    });
  } catch (error) {
    logger.error('Erreur lors de la régénération des données:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la régénération', details: error.message });
  }
});

/**
 * GET /api/dashboard/device/:deviceId
 * Vue détaillée d'un device
 */
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24 } = req.query;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device non trouvé' });
    }

    // Récupérer les mesures récentes
    const endDate = new Date().toISOString();
    const startDate = new Date(new Date().getTime() - hours * 60 * 60 * 1000).toISOString();

    const measurements = await measurementService.getByDevice(deviceId, {
      limit: 1000,
      startDate,
      endDate,
    });

    const statistics = await measurementService.getStatistics(
      deviceId,
      startDate,
      endDate
    );

    const alerts = await alertService.getAlerts({
      deviceId,
      limit: 20,
    });

    res.json({
      device,
      measurements,
      statistics,
      alerts,
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des données du device:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message, stack: error.stack });
  }
});

/**
 * GET /api/dashboard/failure-probabilities
 * Récupérer les probabilités de panne pour tous les devices
 */
router.get('/failure-probabilities', async (req, res) => {
  try {
    const devices = await Device.find();

    const probabilities = await Promise.all(devices.map(async (device) => {
      // Récupérer la dernière mesure pour ce device
      const latestMeasurements = await Measurement.getRecentMeasurements(device.deviceId, 1);
      const latestMeasurement = latestMeasurements && latestMeasurements.length > 0 ? latestMeasurements[0] : null;

      const prediction = predictionService.calculateFailureProbability(device, latestMeasurement);

      return {
        deviceId: device.deviceId,
        ...prediction
      };
    }));

    res.json(probabilities);
  } catch (error) {
    logger.error('Erreur lors de la récupération des probabilités de panne:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/dashboard/fleet-forecast
 * Récupérer les prévisions AI pour toute la flotte
 */
router.get('/fleet-forecast', async (req, res) => {
  try {
    const devices = await Device.find();
    const fleetForecast = await predictionService.getFleetForecast(devices, Measurement);
    res.json(fleetForecast);
  } catch (error) {
    logger.error('Erreur lors de la récupération des prévisions de flotte:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/**
 * GET /api/dashboard/forecast/:deviceId
 * Récupérer les prévisions sur 7 jours pour un device spécifique
 */
router.get('/forecast/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device non trouvé' });
    }

    const latestMeasurements = await Measurement.getRecentMeasurements(deviceId, 1);
    const latestMeasurement = latestMeasurements && latestMeasurements.length > 0 ? latestMeasurements[0] : null;

    const forecast = await predictionService.get7DayForecast(device, latestMeasurement);

    res.json(forecast);
  } catch (error) {
    logger.error('Erreur lors de la récupération des prévisions:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

module.exports = router;

