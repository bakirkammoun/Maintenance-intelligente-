const connectDb = require('../config/db');

class Measurement {
    static async create(measurementData) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            const { deviceId, timestamp, vibration, temperature, current, sound, isAnomaly, anomalyReason, processed } = measurementData;
            const stmt = db.prepare("INSERT INTO measurements (deviceId, timestamp, vibration_x, vibration_y, vibration_z, vibration_magnitude, temperature, current, sound, isAnomaly, anomalyReason, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            stmt.run(deviceId, timestamp,
                vibration ? vibration.x : null,
                vibration ? vibration.y : null,
                vibration ? vibration.z : null,
                vibration ? vibration.magnitude : null,
                temperature, current, sound, isAnomaly, anomalyReason, processed,
                function (err) {
                    if (err) {
                        console.error('Error creating measurement:', err.message);
                        reject(err);
                    } else {
                        resolve({ _id: this.lastID, ...measurementData });
                    }
                });
        });
    }

    static async find(query = {}) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            let sql = "SELECT * FROM measurements";
            const params = [];
            const conditions = [];

            if (query.deviceId) {
                conditions.push("deviceId = ?");
                params.push(query.deviceId);
            }
            if (query.isAnomaly !== undefined) {
                conditions.push("isAnomaly = ?");
                params.push(query.isAnomaly ? 1 : 0);
            }

            if (conditions.length > 0) {
                sql += " WHERE " + conditions.join(" AND ");
            }
            sql += " ORDER BY timestamp DESC";
            if (query.limit) {
                sql += " LIMIT ?";
                params.push(query.limit);
            }

            db.all(sql, params, (err, rows) => {
                if (err) {
                    // Si la table n'existe pas ou autre erreur, retourner un tableau vide au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table measurements does not exist yet, returning empty array.');
                        return resolve([]);
                    }
                    // Pour d'autres erreurs SQL, logger mais retourner un tableau vide pour éviter les 500
                    console.error('Error finding measurements:', err.message);
                    console.error('SQL:', sql);
                    console.error('Params:', params);
                    console.warn('Returning empty array instead of rejecting to prevent 500 error.');
                    return resolve([]);
                } else {
                    if (!rows || rows.length === 0) {
                        return resolve([]);
                    }
                    try {
                        resolve(rows.map(row => ({
                            _id: row.id,
                            deviceId: row.deviceId,
                            timestamp: row.timestamp,
                            vibration: {
                                x: row.vibration_x,
                                y: row.vibration_y,
                                z: row.vibration_z,
                                magnitude: row.vibration_magnitude
                            },
                            temperature: row.temperature,
                            current: row.current,
                            sound: row.sound,
                            isAnomaly: row.isAnomaly === 1,
                            anomalyReason: row.anomalyReason,
                            processed: row.processed === 1,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        })));
                    } catch (mapError) {
                        console.error('Error mapping measurement rows:', mapError);
                        return resolve([]);
                    }
                }
            });
        });
    }

    static async findById(id) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM measurements WHERE id = ?", [id], (err, row) => {
                if (err) {
                    console.error('Error finding measurement by ID:', err.message);
                    reject(err);
                } else {
                    if (row) {
                        resolve({
                            _id: row.id,
                            deviceId: row.deviceId,
                            timestamp: row.timestamp,
                            vibration: { x: row.vibration_x, y: row.vibration_y, z: row.vibration_z, magnitude: row.vibration_magnitude },
                            temperature: row.temperature,
                            current: row.current,
                            sound: row.sound,
                            isAnomaly: row.isAnomaly === 1,
                            anomalyReason: row.anomalyReason,
                            processed: row.processed === 1,
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

    static async getRecentMeasurements(deviceId, limit = 10) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            if (!deviceId) {
                return resolve([]);
            }

            db.all("SELECT * FROM measurements WHERE deviceId = ? ORDER BY timestamp DESC LIMIT ?", [deviceId, limit], (err, rows) => {
                if (err) {
                    // Si la table n'existe pas ou autre erreur, retourner un tableau vide au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table measurements does not exist yet, returning empty array.');
                        return resolve([]);
                    }
                    // Pour d'autres erreurs SQL, logger mais retourner un tableau vide pour éviter les 500
                    console.error('Error getting recent measurements:', err.message);
                    console.warn('Returning empty array instead of rejecting to prevent 500 error.');
                    return resolve([]);
                } else {
                    if (!rows || rows.length === 0) {
                        return resolve([]);
                    }
                    try {
                        resolve(rows.map(row => ({
                            _id: row.id,
                            deviceId: row.deviceId,
                            timestamp: row.timestamp,
                            vibration: {
                                x: row.vibration_x || 0,
                                y: row.vibration_y || 0,
                                z: row.vibration_z || 0,
                                magnitude: row.vibration_magnitude || 0
                            },
                            temperature: row.temperature || 0,
                            current: row.current || 0,
                            sound: row.sound || 0,
                            isAnomaly: row.isAnomaly === 1,
                            anomalyReason: row.anomalyReason,
                            processed: row.processed === 1,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        })));
                    } catch (mapError) {
                        console.error('Error mapping measurement rows:', mapError);
                        return resolve([]);
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
                if (key !== 'id' && key !== '_id') {
                    sets.push(`${key} = ?`);
                    params.push(updateData[key]);
                }
            }
            sets.push("updatedAt = CURRENT_TIMESTAMP");

            if (sets.length === 0) {
                return resolve(null);
            }

            params.push(id);

            const sql = `UPDATE measurements SET ${sets.join(', ')} WHERE id = ?`;

            db.run(sql, params, function (err) {
                if (err) {
                    console.error('Error updating measurement:', err.message);
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }
}


module.exports = Measurement;
