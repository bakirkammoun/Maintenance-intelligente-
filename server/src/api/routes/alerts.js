const express = require('express');
const alertService = require('../../services/alertService');
const { authenticate, requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * GET /api/alerts
 * Récupérer les alertes avec filtres
 */
router.get('/', async (req, res) => {
  try {
    const {
      deviceId,
      status,
      severity,
      type,
      limit = 100,
      skip = 0,
    } = req.query;

    const alerts = await alertService.getAlerts({
      deviceId,
      status,
      severity,
      type,
      limit: parseInt(limit),
    });

    res.json(alerts);
  } catch (error) {
    logger.error('Erreur lors de la récupération des alertes:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Erreur serveur', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/alerts/statistics
 * Récupérer les statistiques des alertes
 */
router.get('/statistics', async (req, res) => {
  try {
    const { deviceId } = req.query;
    const statistics = await alertService.getStatistics(deviceId);
    res.json(statistics);
  } catch (error) {
    logger.error('Erreur lors de la récupération des statistiques:', error);
    console.error('Stack trace:', error.stack);
    // Retourner des valeurs par défaut au lieu d'une erreur 500
    res.json({
      total: 0,
      byStatus: {},
      bySeverity: {},
      byType: {},
    });
  }
});

/**
 * PUT /api/alerts/:alertId/status
 * Mettre à jour le statut d'une alerte (operator/admin uniquement)
 */
router.put(
  '/:alertId/status',
  requireRole('admin', 'operator'),
  async (req, res) => {
    try {
      const { status } = req.body;
      const { alertId } = req.params;

      if (!['open', 'acknowledged', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
      }

      const alert = await alertService.updateStatus(
        alertId,
        status,
        req.user._id
      );

      res.json(alert);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de l\'alerte:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

module.exports = router;

