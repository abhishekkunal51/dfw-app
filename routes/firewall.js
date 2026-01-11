const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get all firewall rules
router.get('/rules', (req, res) => {
    const { status, search } = req.query;
    let sql = 'SELECT * FROM firewall_rules';
    const params = [];
    const conditions = [];

    if (status && status !== 'all') {
        conditions.push('status = ?');
        params.push(status);
    }

    if (search) {
        conditions.push('(rule_name LIKE ? OR description LIKE ? OR source_ip LIKE ? OR destination_ip LIKE ?)');
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get a specific rule
router.get('/rules/:id', (req, res) => {
    const sql = 'SELECT * FROM firewall_rules WHERE id = ?';
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        res.json(row);
    });
});

// Create a new firewall rule request
router.post('/rules', (req, res) => {
    const {
        rule_name,
        description,
        source_ip,
        destination_ip,
        port,
        protocol,
        direction,
        action,
        service,
        priority
    } = req.body;

    // Validation
    if (!rule_name || !source_ip || !destination_ip || !port || !protocol || !direction || !action) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `
        INSERT INTO firewall_rules
        (rule_name, description, source_ip, destination_ip, port, protocol, direction, action, service, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [
        rule_name,
        description || '',
        source_ip,
        destination_ip,
        port,
        protocol,
        direction,
        action,
        service || '',
        priority || 100
    ], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            id: this.lastID,
            message: 'Firewall rule request created successfully'
        });
    });
});

// Update a rule
router.put('/rules/:id', (req, res) => {
    const {
        rule_name,
        description,
        source_ip,
        destination_ip,
        port,
        protocol,
        direction,
        action,
        service,
        priority
    } = req.body;

    const sql = `
        UPDATE firewall_rules
        SET rule_name = ?, description = ?, source_ip = ?, destination_ip = ?,
            port = ?, protocol = ?, direction = ?, action = ?, service = ?,
            priority = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(sql, [
        rule_name,
        description,
        source_ip,
        destination_ip,
        port,
        protocol,
        direction,
        action,
        service,
        priority,
        req.params.id
    ], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        res.json({ message: 'Rule updated successfully' });
    });
});

// Update rule status (approve/reject)
router.patch('/rules/:id/status', (req, res) => {
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be pending, approved, or rejected' });
    }

    const sql = 'UPDATE firewall_rules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';

    db.run(sql, [status, req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        res.json({ message: `Rule ${status} successfully` });
    });
});

// Delete a rule
router.delete('/rules/:id', (req, res) => {
    const sql = 'DELETE FROM firewall_rules WHERE id = ?';

    db.run(sql, [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        res.json({ message: 'Rule deleted successfully' });
    });
});

module.exports = router;
