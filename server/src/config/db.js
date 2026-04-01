const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../data/maintenance.db');

let db = null;

function connectDb() {
    if (db) {
        return db;
    }

    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Error connecting to SQLite database:', err.message);
            // Exit process if cannot connect to DB, as it's a critical dependency
            process.exit(1);
        } else {
            console.log('Connected to the SQLite database.');
            // Enable foreign keys by default
            db.run("PRAGMA foreign_keys = ON;");
            // ✅ PERFORMANCE: Enable WAL mode for better concurrency
            db.run("PRAGMA journal_mode = WAL;", (err) => {
                if (err) console.error('Failed to enable WAL mode:', err);
                else console.log('SQLite WAL mode enabled');
            });
            // ✅ PERFORMANCE: Increase cache size
            db.run("PRAGMA cache_size = -2000;"); // ~2MB cache
            db.run("PRAGMA synchronous = NORMAL;"); // Faster writes with good safety
        }
    });
    return db;
}

module.exports = connectDb;
