const connectDb = require('../config/db');

class Device {
    static async create(deviceData) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            const { deviceId, name, location, type, status, sensors, samplingRate, bufferSize } = deviceData;
            const stmt = db.prepare("INSERT INTO devices (deviceId, name, location, type, status, vibration_enabled, vibration_threshold, temperature_enabled, temperature_threshold, current_enabled, current_threshold, sound_enabled, sound_threshold, samplingRate, bufferSize) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            stmt.run(deviceId, name, location, type, status,
                sensors.vibration.enabled, sensors.vibration.threshold,
                sensors.temperature.enabled, sensors.temperature.threshold,
                sensors.current.enabled, sensors.current.threshold,
                sensors.sound.enabled, sensors.sound.threshold,
                samplingRate, bufferSize,
                function (err) {
                    if (err) {
                        console.error('Error creating device:', err.message);
                        reject(err);
                    } else {
                        resolve({ _id: this.lastID, ...deviceData });
                    }
                });
        });
    }

    static async find(query = {}) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            let sql = "SELECT * FROM devices";
            const params = [];
            const conditions = [];

            if (query.deviceId) {
                conditions.push("deviceId = ?");
                params.push(query.deviceId);
            }
            if (query.status) {
                conditions.push("status = ?");
                params.push(query.status);
            }
            if (query.type) {
                conditions.push("type = ?");
                params.push(query.type);
            }

            if (conditions.length > 0) {
                sql += " WHERE " + conditions.join(" AND ");
            }
            sql += " ORDER BY createdAt DESC";

            db.all(sql, params, (err, rows) => {
                if (err) {
                    // Si la table n'existe pas ou autre erreur, retourner un tableau vide au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table devices does not exist yet, returning empty array.');
                        return resolve([]);
                    }
                    // Pour d'autres erreurs SQL, logger mais retourner un tableau vide pour éviter les 500
                    console.error('Error finding devices:', err.message);
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
                            _id: row.deviceId, // Using deviceId as _id for compatibility
                            deviceId: row.deviceId,
                            name: row.name,
                            location: row.location,
                            type: row.type,
                            status: row.status,
                            sensors: {
                                vibration: { enabled: row.vibration_enabled === 1, threshold: row.vibration_threshold || 0 },
                                temperature: { enabled: row.temperature_enabled === 1, threshold: row.temperature_threshold || 0 },
                                current: { enabled: row.current_enabled === 1, threshold: row.current_threshold || 0 },
                                sound: { enabled: row.sound_enabled === 1, threshold: row.sound_threshold || 0 }
                            },
                            samplingRate: row.samplingRate || 1000,
                            bufferSize: row.bufferSize || 100,
                            lastSeen: row.lastSeen,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        })));
                    } catch (mapError) {
                        console.error('Error mapping device rows:', mapError);
                        return resolve([]);
                    }
                }
            });
        });
    }

    static async findById(id) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM devices WHERE deviceId = ?", [id], (err, row) => {
                if (err) {
                    console.error('Error finding device by ID:', err.message);
                    reject(err);
                } else {
                    if (row) {
                        resolve({
                            _id: row.deviceId, // Using deviceId as _id for compatibility
                            deviceId: row.deviceId,
                            name: row.name,
                            location: row.location,
                            type: row.type,
                            status: row.status,
                            sensors: {
                                vibration: { enabled: row.vibration_enabled, threshold: row.vibration_threshold },
                                temperature: { enabled: row.temperature_enabled, threshold: row.temperature_threshold },
                                current: { enabled: row.current_enabled, threshold: row.current_threshold },
                                sound: { enabled: row.sound_enabled, threshold: row.sound_threshold }
                            },
                            samplingRate: row.samplingRate,
                            bufferSize: row.bufferSize,
                            lastSeen: row.lastSeen,
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
                if (key === 'sensors') {
                    for (const sensorType in updateData.sensors) {
                        for (const prop in updateData.sensors[sensorType]) {
                            sets.push(`${sensorType}_${prop} = ?`);
                            params.push(updateData.sensors[sensorType][prop]);
                        }
                    }
                } else if (key !== 'deviceId' && key !== '_id') {
                    sets.push(`${key} = ?`);
                    params.push(updateData[key]);
                }
            }
            sets.push("updatedAt = CURRENT_TIMESTAMP");

            if (sets.length === 0) {
                return resolve(null); // Nothing to update
            }

            params.push(id);

            const sql = `UPDATE devices SET ${sets.join(', ')} WHERE deviceId = ?`;

            db.run(sql, params, function (err) {
                if (err) {
                    console.error('Error updating device:', err.message);
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        resolve({ _id: id, ...updateData });
                    } else {
                        resolve(null); // Device not found or no changes
                    }
                }
            });
        });
    }

    static async deleteById(id) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM devices WHERE deviceId = ?", [id], function (err) {
                if (err) {
                    console.error('Error deleting device:', err.message);
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    static async countActive() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM devices WHERE status = 'active'", [], (err, row) => {
                if (err) {
                    // Si la table n'existe pas, retourner 0 au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table devices does not exist yet');
                        return resolve(0);
                    }
                    console.error('Error counting active devices:', err.message);
                    reject(err);
                } else {
                    resolve(row ? row.count : 0);
                }
            });
        });
    }

    static async countTotal() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM devices", [], (err, row) => {
                if (err) {
                    // Si la table n'existe pas, retourner 0 au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table devices does not exist yet');
                        return resolve(0);
                    }
                    console.error('Error counting total devices:', err.message);
                    reject(err);
                } else {
                    resolve(row ? row.count : 0);
                }
            });
        });
    }

    static async countInactive() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM devices WHERE status = 'inactive'", [], (err, row) => {
                if (err) {
                    // Si la table n'existe pas, retourner 0 au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table devices does not exist yet');
                        return resolve(0);
                    }
                    console.error('Error counting inactive devices:', err.message);
                    reject(err);
                } else {
                    resolve(row ? row.count : 0);
                }
            });
        });
    }

    static async getDeviceTypes() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.all("SELECT DISTINCT type FROM devices", [], (err, rows) => {
                if (err) {
                    console.error('Error getting device types:', err.message);
                    reject(err);
                } else {
                    resolve(rows.map(row => row.type));
                }
            });
        });
    }

    static async getDeviceStatuses() {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.all("SELECT DISTINCT status FROM devices", [], (err, rows) => {
                if (err) {
                    console.error('Error getting device statuses:', err.message);
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
                if (key === 'sensors') {
                    for (const sensorType in updateData.sensors) {
                        for (const prop in updateData.sensors[sensorType]) {
                            sets.push(`${sensorType}_${prop} = ?`);
                            params.push(updateData.sensors[sensorType][prop]);
                        }
                    }
                } else if (key !== 'deviceId' && key !== '_id') {
                    sets.push(`${key} = ?`);
                    params.push(updateData[key]);
                }
            }
            sets.push("updatedAt = CURRENT_TIMESTAMP");

            if (sets.length === 0) {
                return resolve(null); // Nothing to update
            }

            params.push(id);

            const sql = `UPDATE devices SET ${sets.join(', ')} WHERE deviceId = ?`;

            db.run(sql, params, function (err) {
                if (err) {
                    console.error('Error updating device:', err.message);
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        // Fetch the updated device to return it
                        db.get("SELECT * FROM devices WHERE deviceId = ?", [id], (err, row) => {
                            if (err) {
                                reject(err);
                            } else if (row) {
                                resolve({
                                    _id: row.deviceId, // Using deviceId as _id for compatibility
                                    deviceId: row.deviceId,
                                    name: row.name,
                                    location: row.location,
                                    type: row.type,
                                    status: row.status,
                                    sensors: {
                                        vibration: { enabled: row.vibration_enabled, threshold: row.vibration_threshold },
                                        temperature: { enabled: row.temperature_enabled, threshold: row.temperature_threshold },
                                        current: { enabled: row.current_enabled, threshold: row.current_threshold },
                                        sound: { enabled: row.sound_enabled, threshold: row.sound_threshold }
                                    },
                                    samplingRate: row.samplingRate,
                                    bufferSize: row.bufferSize,
                                    lastSeen: row.lastSeen,
                                    createdAt: row.createdAt,
                                    updatedAt: row.updatedAt
                                });
                            } else {
                                resolve(null);
                            }
                        });
                    } else {
                        resolve(null); // Device not found or no changes
                    }
                }
            });
        });
    }
}

module.exports = Device;
