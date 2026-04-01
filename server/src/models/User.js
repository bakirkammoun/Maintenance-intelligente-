const connectDb = require('../config/db');
const bcrypt = require('bcryptjs');

class User {
    static async create(userData) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            const { username, email, password, role } = userData;
            bcrypt.hash(password, 10, (err, hashedPassword) => {
                if (err) return reject(err);
                const stmt = db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)");
                stmt.run(username, email, hashedPassword, role || 'user', function (err) {
                    if (err) {
                        console.error('Error creating user:', err.message);
                        reject(err);
                    } else {
                        resolve({ _id: this.lastID, username, email, role: role || 'user' });
                    }
                });
            });
        });
    }

    static async findByEmail(email) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
                if (err) {
                    // Si la table n'existe pas, retourner null au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table users does not exist yet, returning null.');
                        return resolve(null);
                    }
                    console.error('Error finding user by email:', err.message);
                    reject(err);
                } else {
                    if (row) {
                        resolve({
                            _id: row.id,
                            username: row.username,
                            email: row.email,
                            password: row.password, // Hashed password
                            role: row.role,
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

    static async findByUsername(username) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
                if (err) {
                    // Si la table n'existe pas, retourner null au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table users does not exist yet, returning null.');
                        return resolve(null);
                    }
                    console.error('Error finding user by username:', err.message);
                    reject(err);
                } else {
                    if (row) {
                        resolve({
                            _id: row.id,
                            username: row.username,
                            email: row.email,
                            password: row.password, // Hashed password
                            role: row.role,
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

    static async findById(id) {
        const db = connectDb();
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
                if (err) {
                    // Si la table n'existe pas, retourner null au lieu de rejeter
                    const errorMsg = err.message ? err.message.toLowerCase() : '';
                    if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
                        console.warn('Table users does not exist yet, returning null.');
                        return resolve(null);
                    }
                    console.error('Error finding user by ID:', err.message);
                    reject(err);
                } else {
                    if (row) {
                        resolve({
                            _id: row.id,
                            username: row.username,
                            email: row.email,
                            role: row.role,
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

    static async comparePassword(candidatePassword, hashedPassword) {
        // Ensure candidatePassword is a string before comparison
        return bcrypt.compare(String(candidatePassword), hashedPassword);
    }
}

module.exports = User;
