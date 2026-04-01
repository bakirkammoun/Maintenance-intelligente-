const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('../utils/logger');
const Alert = require('../models/Alert');

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.initEmailTransporter();
  }

  initEmailTransporter() {
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    ) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  /**
   * Envoie les notifications pour une alerte
   */
  async sendAlertNotifications(alert) {
    const promises = [];

    // Email
    if (this.emailTransporter) {
      promises.push(this.sendEmail(alert));
    }

    // Webhook
    if (process.env.WEBHOOK_URL) {
      promises.push(this.sendWebhook(alert));
    }

    // Push (à implémenter selon votre système)
    // promises.push(this.sendPush(alert));

    await Promise.allSettled(promises);
  }

  /**
   * Envoie un email
   */
  async sendEmail(alert) {
    if (!this.emailTransporter) {
      return;
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: process.env.ALERT_EMAIL || process.env.SMTP_USER,
        subject: `[${alert.severity.toUpperCase()}] Alerte: ${alert.type} - Device ${alert.deviceId}`,
        html: `
          <h2>Alerte de Maintenance Prédictive</h2>
          <p><strong>Device:</strong> ${alert.deviceId}</p>
          <p><strong>Type:</strong> ${alert.type}</p>
          <p><strong>Sévérité:</strong> ${alert.severity}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Valeur:</strong> ${alert.value}</p>
          <p><strong>Seuil:</strong> ${alert.threshold}</p>
          <p><strong>Date:</strong> ${alert.createdAt}</p>
        `,
      };

      await this.emailTransporter.sendMail(mailOptions);

      await Alert.findByIdAndUpdate(alert._id, {
        'notifications.email.sent': true,
        'notifications.email.sentAt': new Date(),
      });

      logger.info(`Email envoyé pour l'alerte ${alert._id}`);
    } catch (error) {
      logger.error(`Erreur lors de l'envoi de l'email:`, error);
    }
  }

  /**
   * Envoie un webhook
   */
  async sendWebhook(alert) {
    if (!process.env.WEBHOOK_URL) {
      return;
    }

    try {
      await axios.post(process.env.WEBHOOK_URL, {
        type: 'alert',
        alert: {
          id: alert._id,
          deviceId: alert.deviceId,
          severity: alert.severity,
          type: alert.type,
          message: alert.message,
          value: alert.value,
          threshold: alert.threshold,
          timestamp: alert.createdAt,
        },
      });

      await Alert.findByIdAndUpdate(alert._id, {
        'notifications.webhook.sent': true,
        'notifications.webhook.sentAt': new Date(),
      });

      logger.info(`Webhook envoyé pour l'alerte ${alert._id}`);
    } catch (error) {
      logger.error(`Erreur lors de l'envoi du webhook:`, error);
    }
  }

  /**
   * Envoie une notification push (à implémenter)
   */
  async sendPush(alert) {
    // TODO: Implémenter selon votre système de push
    logger.info(`Push notification pour l'alerte ${alert._id}`);
  }
}

module.exports = new NotificationService();

