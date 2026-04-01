const express = require('express');
const Measurement = require('../../models/Measurement');
const measurementService = require('../../services/measurementService');
const { authenticate } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * GET /api/measurements
 * Récupérer les mesures avec filtres
 */
router.get('/', async (req, res) => {
  try {
      const { deviceId, limit, startDate, endDate, anomalyOnly } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId requis' });
    }

    const measurements = await measurementService.getByDevice(deviceId, {
      limit: parseInt(limit),
      startDate,
      endDate,
      anomalyOnly: anomalyOnly === 'true',
    });

    res.json(measurements);
  } catch (error) {
    logger.error('Erreur lors de la récupération des mesures:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/measurements/statistics
 * Récupérer les statistiques des mesures
 */
router.get('/statistics', async (req, res) => {
  try {
    const { deviceId, startDate, endDate } = req.query;

    if (!deviceId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'deviceId, startDate et endDate sont requis',
      });
    }

    const statistics = await measurementService.getStatistics(
      deviceId,
      startDate,
      endDate
    );

    res.json(statistics);
  } catch (error) {
    logger.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

