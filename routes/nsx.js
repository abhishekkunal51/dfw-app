const express = require('express');
const router = express.Router();
const nsxClient = require('../services/nsx-client');
const db = require('../database/db');

// Test NSX-T Manager connection
router.get('/test-connection', async (req, res) => {
    try {
        const result = await nsxClient.testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get NSX-T firewall sections
router.get('/sections', async (req, res) => {
    try {
        const sections = await nsxClient.getFirewallSections();
        res.json(sections);
    } catch (error) {
        res.status(500).json({
            error: `Failed to get sections: ${error.message}`
        });
    }
});

// Get approved rules that haven't been pushed yet
router.get('/pending-push', (req, res) => {
    const sql = `
        SELECT * FROM firewall_rules
        WHERE status = 'approved' AND (pushed_to_nsx IS NULL OR pushed_to_nsx = 0)
        ORDER BY priority ASC, created_at ASC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Push approved rules to NSX-T
router.post('/push-rules', async (req, res) => {
    try {
        // Get all approved rules that haven't been pushed
        const rules = await new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM firewall_rules
                WHERE status = 'approved' AND (pushed_to_nsx IS NULL OR pushed_to_nsx = 0)
                ORDER BY priority ASC, created_at ASC
            `;
            db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (rules.length === 0) {
            return res.json({
                message: 'No approved rules to push',
                pushed: 0
            });
        }

        // Push rules to NSX-T
        const result = await nsxClient.pushRules(rules);

        // Update database for successfully pushed rules
        for (const success of result.success) {
            await new Promise((resolve, reject) => {
                const sql = `
                    UPDATE firewall_rules
                    SET pushed_to_nsx = 1,
                        nsx_rule_id = ?,
                        pushed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;
                db.run(sql, [success.nsxRuleId, success.ruleId], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        res.json({
            message: `Pushed ${result.success.length} rules to NSX-T`,
            sectionId: result.sectionId,
            success: result.success,
            failed: result.failed,
            totalPushed: result.success.length,
            totalFailed: result.failed.length
        });

    } catch (error) {
        res.status(500).json({
            error: `Failed to push rules: ${error.message}`
        });
    }
});

// Push specific rules by IDs
router.post('/push-selected', async (req, res) => {
    const { ruleIds } = req.body;

    if (!ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0) {
        return res.status(400).json({ error: 'No rule IDs provided' });
    }

    try {
        // Get selected rules
        const placeholders = ruleIds.map(() => '?').join(',');
        const rules = await new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM firewall_rules
                WHERE id IN (${placeholders})
                AND status = 'approved'
                AND (pushed_to_nsx IS NULL OR pushed_to_nsx = 0)
            `;
            db.all(sql, ruleIds, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (rules.length === 0) {
            return res.json({
                message: 'No eligible rules to push',
                pushed: 0
            });
        }

        // Push rules to NSX-T
        const result = await nsxClient.pushRules(rules);

        // Update database for successfully pushed rules
        for (const success of result.success) {
            await new Promise((resolve, reject) => {
                const sql = `
                    UPDATE firewall_rules
                    SET pushed_to_nsx = 1,
                        nsx_rule_id = ?,
                        pushed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;
                db.run(sql, [success.nsxRuleId, success.ruleId], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        res.json({
            message: `Pushed ${result.success.length} rules to NSX-T`,
            sectionId: result.sectionId,
            success: result.success,
            failed: result.failed
        });

    } catch (error) {
        res.status(500).json({
            error: `Failed to push rules: ${error.message}`
        });
    }
});

// Get push history/status
router.get('/push-history', (req, res) => {
    const sql = `
        SELECT id, rule_name, nsx_rule_id, pushed_at, status
        FROM firewall_rules
        WHERE pushed_to_nsx = 1
        ORDER BY pushed_at DESC
        LIMIT 50
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

module.exports = router;
