const express = require('express');
const { body, validationResult } = require('express-validator');
const Device = require('../../models/Device');
const { authenticate, requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * GET /api/devices
 * Récupérer la liste des devices avec leurs dernières mesures
 */
router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;

    // Récupérer les devices (retourne toujours un tableau, même en cas d'erreur)
    const devices = await Device.find(query);

    if (!Array.isArray(devices) || devices.length === 0) {
      return res.json([]);
    }

    // Récupérer la dernière mesure pour chaque device (optionnel, ne bloque pas si ça échoue)
    try {
      const Measurement = require('../../models/Measurement');

      const devicesWithMeasurements = await Promise.all(
        devices.map(async (device) => {
          if (!device || !device.deviceId) {
            return { ...device, latestMeasurement: null };
          }

          try {
            const latestMeasurements = await Measurement.getRecentMeasurements(device.deviceId, 1);
            const latestMeasurement = latestMeasurements && latestMeasurements.length > 0
              ? latestMeasurements[0]
              : null;

            return {
              ...device,
              latestMeasurement: latestMeasurement ? {
                vibration: Number(latestMeasurement.vibration?.magnitude) || 0,
                temperature: Number(latestMeasurement.temperature) || 0,
                current: Number(latestMeasurement.current) || 0,
                sound: Number(latestMeasurement.sound) || 0,
                timestamp: latestMeasurement.timestamp || new Date().toISOString()
              } : null
            };
          } catch (error) {
            // En cas d'erreur, retourner le device sans mesure
            return {
              ...device,
              latestMeasurement: null
            };
          }
        })
      );

      return res.json(devicesWithMeasurements);
    } catch (measurementError) {
      // Si la récupération des mesures échoue complètement, retourner les devices sans mesures
      console.warn('Erreur lors de la récupération des mesures, retour des devices sans mesures:', measurementError.message);
      return res.json(devices.map(device => ({
        ...device,
        latestMeasurement: null
      })));
    }
  } catch (error) {
    logger.error('Erreur critique lors de la récupération des devices:', error);
    console.error('Stack trace:', error.stack);
    // En cas d'erreur critique, retourner un tableau vide plutôt qu'une erreur 500
    return res.json([]);
  }
});

/**
 * GET /api/devices/:deviceId
 * Récupérer un device spécifique
 */
router.get('/:deviceId', async (req, res) => {
  try {
    const device = await Device.findById(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device non trouvé' });
    }
    res.json(device);
  } catch (error) {
    logger.error('Erreur lors de la récupération du device:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/devices
 * Créer un nouveau device (admin/operator uniquement)
 */
router.post(
  '/',
  requireRole('admin', 'operator'),
  [
    body('deviceId').notEmpty(),
    body('name').notEmpty(),
    body('location').notEmpty(),
    body('type').isIn(['motor', 'pump', 'compressor', 'fan', 'other']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existingDevice = await Device.findById(req.body.deviceId);

      if (existingDevice) {
        return res.status(400).json({ error: 'Device déjà existant' });
      }

      const device = await Device.create(req.body);

      res.status(201).json(device);
    } catch (error) {
      logger.error('Erreur lors de la création du device:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

/**
 * PUT /api/devices/:deviceId
 * Mettre à jour un device (admin/operator uniquement)
 */
router.put(
  '/:deviceId',
  requireRole('admin', 'operator'),
  async (req, res) => {
    try {
      const device = await Device.updateById(
        req.params.deviceId,
        req.body
      );

      if (!device) {
        return res.status(404).json({ error: 'Device non trouvé' });
      }

      res.json(device);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du device:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

/**
 * DELETE /api/devices/:deviceId
 * Supprimer un device (admin uniquement)
 */
router.delete('/:deviceId', requireRole('admin'), async (req, res) => {
  try {
    const deleted = await Device.deleteById(req.params.deviceId);

    if (!deleted) {
      return res.status(404).json({ error: 'Device non trouvé' });
    }

    res.json({ message: 'Device supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur lors de la suppression du device:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

