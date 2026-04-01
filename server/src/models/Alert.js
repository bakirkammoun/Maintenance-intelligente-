const connectDb = require('../config/db');

class Alert {
    static async create(alertData) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            const { deviceId, severity, type, message, value, threshold, status } = alertData;
            const stmt = db.prepare("INSERT INTO alerts (deviceId, severity, type, message, value, threshold, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
            stmt.run(deviceId, severity, type, message, value, threshold, status || 'open', function (err) {
                if (err) {
                    console.error('Error creating alert:', err.message);
                    reject(err);
                } else {
                    resolve({ _id: this.lastID, ...alertData });
                }
            });
        });
    }

    static async find(query = {}) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            let sql = "SELECT * FROM alerts";
            const params = [];
            const conditions = [];

            if (query.deviceId) {
                conditions.push("deviceId = ?");
                params.push(query.deviceId);
            }
            if (query.status) {
                if (Array.isArray(query.status)) {
                    // Utiliser IN pour les tableaux
                    const placeholders = query.status.map(() => '?').join(',');
                    conditions.push(`status IN (${placeholders})`);
                    params.push(...query.status);
                } else {
                    conditions.push("status = ?");
                    params.push(query.status);
                }
            }
            if (query.severity) {
                conditions.push("severity = ?");
                params.push(query.severity);
            }
            if (query.type) {
                conditions.push("type = ?");
                params.push(query.type);
            }

            if (conditions.length > 0) {
                sql += " WHERE " + conditions.join(" AND ");
            }
            sql += " ORDER BY createdAt DESC";

            // Ajouter la limite si spécifiée
            if (query.limit) {
                sql += " LIMIT ?";
                params.push(query.limit);
            }

            db.all(sql, params, (err, rows) => {
                if (err) {
                    // Si la table n'existe pas, retourner un tableau vide au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table alerts does not exist yet, returning empty array.');
                        return resolve([]);
                    }
                    console.error('Error finding alerts:', err.message);
                    console.error('SQL:', sql);
                    console.error('Params:', params);
                    reject(err);
                } else {
                    if (!rows || rows.length === 0) {
                        return resolve([]);
                    }
                    resolve(rows.map(row => ({
                        _id: row.id,
                        deviceId: row.deviceId,
                        severity: row.severity,
                        type: row.type,
                        message: row.message,
                        value: row.value,
                        threshold: row.threshold,
                        status: row.status,
                        acknowledgedBy: row.acknowledgedBy,
                        acknowledgedAt: row.acknowledgedAt,
                        resolvedAt: row.resolvedAt,
                        notifications: {
                            email: { sent: row.notifications_email_sent === 1, sentAt: row.notifications_email_sentAt },
                            webhook: { sent: row.notifications_webhook_sent === 1, sentAt: row.notifications_webhook_sentAt },
                            push: { sent: row.notifications_push_sent === 1, sentAt: row.notifications_push_sentAt }
                        },
                        createdAt: row.createdAt,
                        updatedAt: row.updatedAt
                    })));
                }
            });
        });
    }

    static async findById(id) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM alerts WHERE id = ?", [id], (err, row) => {
                if (err) {
                    console.error('Error finding alert by ID:', err.message);
                    reject(err);
                } else {
                    if (row) {
                        resolve({
                            _id: row.id,
                            deviceId: row.deviceId,
                            severity: row.severity,
                            type: row.type,
                            message: row.message,
                            value: row.value,
                            threshold: row.threshold,
                            status: row.status,
                            acknowledgedBy: row.acknowledgedBy,
                            acknowledgedAt: row.acknowledgedAt,
                            resolvedAt: row.resolvedAt,
                            notifications: {
                                email: { sent: row.notifications_email_sent, sentAt: row.notifications_email_sentAt },
                                webhook: { sent: row.notifications_webhook_sent, sentAt: row.notifications_webhook_sentAt },
                                push: { sent: row.notifications_push_sent, sentAt: row.notifications_push_sentAt }
                            },
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        });
                    } else {
                        resolve(null);
                    }
                }
            });
        });
    }

    static async updateById(id, updateData) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            let sets = [];
            let params = [];

            for (const key in updateData) {
                if (key === 'notifications') {
                    for (const notificationType in updateData.notifications) {
                        for (const prop in updateData.notifications[notificationType]) {
                            sets.push(`notifications_${notificationType}_${prop} = ?`);
                            params.push(updateData.notifications[notificationType][prop]);
                        }
                    }
                } else if (key !== 'id' && key !== '_id') {
                    sets.push(`${key} = ?`);
                    params.push(updateData[key]);
                }
            }
            sets.push("updatedAt = CURRENT_TIMESTAMP");

            if (sets.length === 0) {
                return resolve(null); // Nothing to update
            }

            params.push(id);

            const sql = `UPDATE alerts SET ${sets.join(', ')} WHERE id = ?`;

            db.run(sql, params, function (err) {
                if (err) {
                    console.error('Error updating alert:', err.message);
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        resolve({ _id: id, ...updateData });
                    } else {
                        resolve(null); // Alert not found or no changes
                    }
                }
            });
        });
    }

    static async getAlertCounts() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open, SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical FROM alerts", [], (err, row) => {
                if (err) {
                    console.error('Error getting alert counts:', err.message);
                    reject(err);
                } else {
                    resolve({
                        total: row.total || 0,
                        open: row.open || 0,
                        critical: row.critical || 0,
                    });
                }
            });
        });
    }

    static async getRecentAlerts(limit = 5) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM alerts ORDER BY updatedAt DESC, createdAt DESC LIMIT ?", [limit], (err, rows) => {
                if (err) {
                    // Si la table n'existe pas, retourner un tableau vide au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table alerts does not exist yet');
                        return resolve([]);
                    }
                    console.error('Error getting recent alerts:', err.message);
                    reject(err);
                } else {
                    if (!rows || rows.length === 0) {
                        return resolve([]);
                    }
                    resolve(rows.map(row => ({
                        _id: row.id,
                        deviceId: row.deviceId,
                        severity: row.severity,
                        type: row.type,
                        message: row.message,
                        value: row.value,
                        threshold: row.threshold,
                        status: row.status,
                        createdAt: row.createdAt
                    })));
                }
            });
        });
    }

    static async getAlertSeverities() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.all("SELECT DISTINCT severity FROM alerts", [], (err, rows) => {
                if (err) {
                    console.error('Error getting alert severities:', err.message);
                    reject(err);
                } else {
                    resolve(rows.map(row => row.severity));
                }
            });
        });
    }

    static async getAlertTypes() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.all("SELECT DISTINCT type FROM alerts", [], (err, rows) => {
                if (err) {
                    console.error('Error getting alert types:', err.message);
                    reject(err);
                } else {
                    resolve(rows.map(row => row.type));
                }
            });
        });
    }

    static async getAlertStatuses() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.all("SELECT DISTINCT status FROM alerts", [], (err, rows) => {
                if (err) {
                    console.error('Error getting alert statuses:', err.message);
                    reject(err);
                } else {
                    resolve(rows.map(row => row.status));
                }
            });
        });
    }

    static async findByIdAndUpdate(id, updateData) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            let sets = [];
            let params = [];

            for (const key in updateData) {
                if (key === 'notifications') {
                    for (const notificationType in updateData.notifications) {
                        for (const prop in updateData.notifications[notificationType]) {
                            sets.push(`notifications_${notificationType}_${prop} = ?`);
                            params.push(updateData.notifications[notificationType][prop]);
                        }
                    }
                } else if (key !== 'id' && key !== '_id') {
                    sets.push(`${key} = ?`);
                    params.push(updateData[key]);
                }
            }
            sets.push("updatedAt = CURRENT_TIMESTAMP");

            if (sets.length === 0) {
                return resolve(null); // Nothing to update
            }

            params.push(id);

            const sql = `UPDATE alerts SET ${sets.join(', ')} WHERE id = ?`;

            db.run(sql, params, function (err) {
                if (err) {
                    console.error('Error updating alert:', err.message);
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        db.get("SELECT * FROM alerts WHERE id = ?", [id], (err, row) => {
                            if (err) {
                                reject(err);
                            } else if (row) {
                                resolve({
                                    _id: row.id,
                                    deviceId: row.deviceId,
                                    severity: row.severity,
                                    type: row.type,
                                    message: row.message,
                                    value: row.value,
                                    threshold: row.threshold,
                                    status: row.status,
                                    acknowledgedBy: row.acknowledgedBy,
                                    acknowledgedAt: row.acknowledgedAt,
                                    resolvedAt: row.resolvedAt,
                                    notifications: {
                                        email: { sent: row.notifications_email_sent, sentAt: row.notifications_email_sentAt },
                                        webhook: { sent: row.notifications_webhook_sent, sentAt: row.notifications_webhook_sentAt },
                                        push: { sent: row.notifications_push_sent, sentAt: row.notifications_push_sentAt }
                                    },
                                    createdAt: row.createdAt,
                                    updatedAt: row.updatedAt
                                });
                            } else {
                                resolve(null);
                            }
                        });
                    } else {
                        resolve(null);
                    }
                }
            });
        });
    }

    static async countByStatus(status) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM alerts WHERE status = ?", [status], (err, row) => {
                if (err) {
                    console.error('Error counting alerts by status:', err.message);
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    static async countBySeverity(severity) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM alerts WHERE severity = ?", [severity], (err, row) => {
                if (err) {
                    console.error('Error counting alerts by severity:', err.message);
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    static async countByType(type) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM alerts WHERE type = ?", [type], (err, row) => {
                if (err) {
                    console.error('Error counting alerts by type:', err.message);
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    static async getTotalCount() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM alerts", [], (err, row) => {
                if (err) {
                    // Si la table n'existe pas, retourner 0 au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table alerts does not exist yet');
                        return resolve(0);
                    }
                    console.error('Error getting total alerts count:', err.message);
                    reject(err);
                } else {
                    resolve(row ? row.count : 0);
                }
            });
        });
    }

    static async getCountsByStatus() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.all("SELECT status, COUNT(*) as count FROM alerts GROUP BY status", [], (err, rows) => {
                if (err) {
                    // Si la table n'existe pas, retourner un objet vide au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table alerts does not exist yet');
                        return resolve({});
                    }
                    console.error('Error getting counts by status:', err.message);
                    reject(err);
                } else {
                    const result = {};
                    if (rows && rows.length > 0) {
                        rows.forEach(row => {
                            result[row.status] = row.count;
                        });
                    }
                    resolve(result);
                }
            });
        });
    }

    static async getCountsBySeverity() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.all("SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity", [], (err, rows) => {
                if (err) {
                    // Si la table n'existe pas, retourner un objet vide au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table alerts does not exist yet');
                        return resolve({});
                    }
                    console.error('Error getting counts by severity:', err.message);
                    reject(err);
                } else {
                    const result = {};
                    if (rows && rows.length > 0) {
                        rows.forEach(row => {
                            result[row.severity] = row.count;
                        });
                    }
                    resolve(result);
                }
            });
        });
    }

    static async getCountsByType() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.all("SELECT type, COUNT(*) as count FROM alerts GROUP BY type", [], (err, rows) => {
                if (err) {
                    // Si la table n'existe pas, retourner un objet vide au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table alerts does not exist yet');
                        return resolve({});
                    }
                    console.error('Error getting counts by type:', err.message);
                    reject(err);
                } else {
                    const result = {};
                    if (rows && rows.length > 0) {
                        rows.forEach(row => {
                            result[row.type] = row.count;
                        });
                    }
                    resolve(result);
                }
            });
        });
    }
}

module.exports = Alert;
