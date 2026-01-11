const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'firewall.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS firewall_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_name TEXT NOT NULL,
            description TEXT,
            source_ip TEXT NOT NULL,
            destination_ip TEXT NOT NULL,
            port TEXT NOT NULL,
            protocol TEXT NOT NULL,
            direction TEXT NOT NULL,
            action TEXT NOT NULL,
            service TEXT,
            priority INTEGER DEFAULT 100,
            status TEXT DEFAULT 'pending',
            pushed_to_nsx INTEGER DEFAULT 0,
            nsx_rule_id TEXT,
            pushed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Add columns if they don't exist (for existing databases)
    db.run(`ALTER TABLE firewall_rules ADD COLUMN pushed_to_nsx INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE firewall_rules ADD COLUMN nsx_rule_id TEXT`, () => {});
    db.run(`ALTER TABLE firewall_rules ADD COLUMN pushed_at DATETIME`, () => {});
});

module.exports = db;
