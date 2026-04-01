const Alert = require('../models/Alert');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

class AlertService {
  /**
   * Crée une nouvelle alerte
   */
  async create(deviceId, anomaly) {
    // Vérifier si une alerte similaire existe déjà (non résolue)
    const existingAlerts = await Alert.find({
      deviceId,
      type: anomaly.type,
      status: ['open', 'acknowledged'],
    });
    const existingAlert = existingAlerts[0];

    if (existingAlert) {
      // Mettre à jour l'alerte existante si la sévérité est plus élevée
      if (this.isMoreSevere(anomaly.severity, existingAlert.severity)) {
        const updatedAlert = await Alert.findByIdAndUpdate(existingAlert._id, {
          severity: anomaly.severity,
          message: anomaly.message,
          value: anomaly.value,
          threshold: anomaly.threshold,
        });

        // Broadcast WebSocket
        if (global.broadcastToClients) {
          logger.info(`Broadcasting ESCALATED alert (isNew: true): ${existingAlert._id}`);
          global.broadcastToClients({
            type: 'alert',
            data: updatedAlert,
            isNew: true // Escalation IS a new event worth triggering the badge
          });
        }
        return updatedAlert;
      }

      // Même si pas plus sévère, on met à jour updatedAt pour le remonter dans la liste des récents
      const updatedExisting = await Alert.findByIdAndUpdate(existingAlert._id, {
        value: anomaly.value // Update with latest value
      });

      // Broadcast WebSocket pour informer le client que l'alerte persiste
      if (global.broadcastToClients) {
        logger.info(`Broadcasting persists alert (isNew: false): ${existingAlert._id}`);
        global.broadcastToClients({
          type: 'alert',
          data: updatedExisting,
          isNew: false
        });
      }
      return updatedExisting;
    }

    // Créer une nouvelle alerte
    const alert = await Alert.create({
      deviceId,
      severity: anomaly.severity,
      type: anomaly.type,
      message: anomaly.message,
      value: anomaly.value,
      threshold: anomaly.threshold,
      status: 'open',
    });

    // Envoyer les notifications
    // await notificationService.sendAlertNotifications(alert);

    logger.info(`Alerte créée: ${alert._id} pour device ${deviceId}`);

    // Broadcast WebSocket
    if (global.broadcastToClients) {
      logger.info(`Broadcasting NEW alert (isNew: true): ${alert._id}`);
      global.broadcastToClients({
        type: 'alert',
        data: alert,
        isNew: true
      });
    }

    return alert;
  }

  /**
   * Vérifie si une sévérité est plus élevée qu'une autre
   */
  isMoreSevere(severity1, severity2) {
    const order = { low: 1, medium: 2, high: 3, critical: 4 };
    return order[severity1] > order[severity2];
  }

  /**
   * Récupère les alertes
   */
  async getAlerts(options = {}) {
    const {
      deviceId,
      status,
      severity,
      type,
      limit = 100,
    } = options;

    const query = {};
    if (deviceId) query.deviceId = deviceId;
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (type) query.type = type;

    return await Alert.find({ ...query, limit });
  }

  /**
   * Met à jour le statut d'une alerte
   */
  async updateStatus(alertId, status, userId = null) {
    const updateData = { status };
    if (status === 'acknowledged' && userId) {
      updateData.acknowledgedBy = userId;
      updateData.acknowledgedAt = new Date().toISOString();
    }
    if (status === 'resolved') {
      updateData.resolvedAt = new Date().toISOString();
    }

    const alert = await Alert.findByIdAndUpdate(alertId, updateData);
    if (!alert) {
      throw new Error('Alerte non trouvée');
    }
    return alert;
  }

  /**
   * Récupère les statistiques des alertes
   */
  async getStatistics(deviceId = null) {
    try {
      const total = await Alert.getTotalCount();
      const byStatus = await Alert.getCountsByStatus();
      const bySeverity = await Alert.getCountsBySeverity();
      const byType = await Alert.getCountsByType();

      return {
        total: total || 0,
        byStatus: byStatus || {},
        bySeverity: bySeverity || {},
        byType: byType || {},
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des statistiques:', error);
      // Retourner des valeurs par défaut en cas d'erreur
      return {
        total: 0,
        byStatus: {},
        bySeverity: {},
        byType: {},
      };
    }
  }

  /**
   * Récupère les alertes récentes
   */
  async getRecentAlerts(limit = 5) {
    return await Alert.getRecentAlerts(limit);
  }
}

module.exports = new AlertService();

