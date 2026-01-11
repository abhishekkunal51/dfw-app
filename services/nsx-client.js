const https = require('https');
const config = require('../config/nsx-config');

class NSXClient {
    constructor() {
        this.baseUrl = `https://${config.nsxManager.host}:${config.nsxManager.port}`;
        this.auth = Buffer.from(
            `${config.nsxManager.username}:${config.nsxManager.password}`
        ).toString('base64');
    }

    // Make HTTP request to NSX-T Manager
    async request(method, path, body = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);

            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: method,
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                rejectUnauthorized: config.ssl.rejectUnauthorized,
                timeout: config.api.timeout
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const jsonData = data ? JSON.parse(data) : {};
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({ status: res.statusCode, data: jsonData });
                        } else {
                            reject({
                                status: res.statusCode,
                                message: jsonData.error_message || jsonData.message || 'Request failed',
                                details: jsonData
                            });
                        }
                    } catch (e) {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({ status: res.statusCode, data: data });
                        } else {
                            reject({ status: res.statusCode, message: data });
                        }
                    }
                });
            });

            req.on('error', (error) => {
                reject({ status: 0, message: error.message });
            });

            req.on('timeout', () => {
                req.destroy();
                reject({ status: 0, message: 'Request timeout' });
            });

            if (body) {
                req.write(JSON.stringify(body));
            }

            req.end();
        });
    }

    // Test connection to NSX-T Manager
    async testConnection() {
        try {
            const result = await this.request('GET', '/api/v1/cluster/status');
            return {
                success: true,
                message: 'Connected to NSX-T Manager',
                version: result.data.mgmt_cluster_status?.cluster_node_configs?.[0]?.appliance_mgmt_listen_addr || 'Unknown'
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
                error: error
            };
        }
    }

    // Get all firewall sections
    async getFirewallSections() {
        const result = await this.request('GET', '/api/v1/firewall/sections');
        return result.data.results || [];
    }

    // Get or create the DFW section for our rules
    async getOrCreateSection() {
        // If section ID is configured, use it
        if (config.firewall.sectionId) {
            try {
                const result = await this.request(
                    'GET',
                    `/api/v1/firewall/sections/${config.firewall.sectionId}`
                );
                return result.data;
            } catch (error) {
                console.log('Configured section not found, creating new one...');
            }
        }

        // Check if section already exists by name
        const sections = await this.getFirewallSections();
        const existingSection = sections.find(
            s => s.display_name === config.firewall.sectionName
        );

        if (existingSection) {
            return existingSection;
        }

        // Create new section
        const sectionPayload = {
            display_name: config.firewall.sectionName,
            description: 'Rules created via DFW Request Portal',
            section_type: config.firewall.sectionCategory,
            stateful: true
        };

        const result = await this.request('POST', '/api/v1/firewall/sections', sectionPayload);
        return result.data;
    }

    // Convert our rule format to NSX-T Manager API format
    convertToNSXRule(rule) {
        // Build the NSX-T rule object
        const nsxRule = {
            display_name: rule.rule_name,
            description: rule.description || '',
            action: rule.action.toUpperCase(), // ALLOW or DROP (NSX uses DROP instead of DENY)
            direction: rule.direction.toUpperCase(), // IN, OUT, or IN_OUT
            ip_protocol: 'IPV4_IPV6',
            logged: false,
            disabled: false,
            sources_excluded: false,
            destinations_excluded: false
        };

        // Map action: NSX-T uses DROP instead of DENY
        if (nsxRule.action === 'DENY') {
            nsxRule.action = 'DROP';
        }

        // Map direction
        if (nsxRule.direction === 'INBOUND') {
            nsxRule.direction = 'IN';
        } else if (nsxRule.direction === 'OUTBOUND') {
            nsxRule.direction = 'OUT';
        }

        // Handle source IP
        if (rule.source_ip && rule.source_ip.toLowerCase() !== 'any') {
            nsxRule.sources = [{
                target_type: 'IPv4Address',
                target_id: rule.source_ip
            }];
        }

        // Handle destination IP
        if (rule.destination_ip && rule.destination_ip.toLowerCase() !== 'any') {
            nsxRule.destinations = [{
                target_type: 'IPv4Address',
                target_id: rule.destination_ip
            }];
        }

        // Handle services (port/protocol)
        if (rule.port && rule.protocol && rule.protocol.toLowerCase() !== 'any') {
            const ports = rule.port.split(',').map(p => p.trim());
            nsxRule.services = [{
                service: {
                    resource_type: 'L4PortSetNSService',
                    destination_ports: ports,
                    l4_protocol: rule.protocol.toUpperCase()
                }
            }];
        }

        return nsxRule;
    }

    // Create a firewall rule in NSX-T
    async createFirewallRule(sectionId, rule) {
        const nsxRule = this.convertToNSXRule(rule);

        const result = await this.request(
            'POST',
            `/api/v1/firewall/sections/${sectionId}/rules`,
            nsxRule
        );

        return result.data;
    }

    // Push multiple rules to NSX-T
    async pushRules(rules) {
        const results = {
            success: [],
            failed: [],
            sectionId: null
        };

        try {
            // Get or create the section
            const section = await this.getOrCreateSection();
            results.sectionId = section.id;

            // Push each rule
            for (const rule of rules) {
                try {
                    const nsxRule = await this.createFirewallRule(section.id, rule);
                    results.success.push({
                        ruleId: rule.id,
                        ruleName: rule.rule_name,
                        nsxRuleId: nsxRule.id
                    });
                } catch (error) {
                    results.failed.push({
                        ruleId: rule.id,
                        ruleName: rule.rule_name,
                        error: error.message || 'Unknown error'
                    });
                }
            }
        } catch (error) {
            throw new Error(`Failed to initialize NSX-T section: ${error.message}`);
        }

        return results;
    }

    // Get existing rules from NSX-T section
    async getSectionRules(sectionId) {
        const result = await this.request(
            'GET',
            `/api/v1/firewall/sections/${sectionId}/rules`
        );
        return result.data.results || [];
    }

    // Delete a rule from NSX-T
    async deleteFirewallRule(sectionId, ruleId) {
        await this.request(
            'DELETE',
            `/api/v1/firewall/sections/${sectionId}/rules/${ruleId}`
        );
    }
}

module.exports = new NSXClient();
