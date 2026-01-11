// NSX-T Manager Configuration
// Update these values with your NSX-T Manager details

module.exports = {
    // NSX-T Manager connection
    nsxManager: {
        host: process.env.NSX_MANAGER_HOST || '192.168.1.100',
        port: process.env.NSX_MANAGER_PORT || 443,
        username: process.env.NSX_MANAGER_USERNAME || 'admin',
        password: process.env.NSX_MANAGER_PASSWORD || 'VMware1!VMware1!'
    },

    // SSL/TLS settings
    ssl: {
        // Set to false to skip certificate verification (not recommended for production)
        rejectUnauthorized: process.env.NSX_VERIFY_SSL === 'true' || false
    },

    // DFW Section settings
    firewall: {
        // The section ID where rules will be created
        // You can find this via: GET /api/v1/firewall/sections
        // Leave empty to create a new section
        sectionId: process.env.NSX_SECTION_ID || '',

        // Section name (used when creating new section)
        sectionName: process.env.NSX_SECTION_NAME || 'DFW-Portal-Rules',

        // Section category: LAYER3 (L3 rules) or LAYER2 (L2 rules)
        sectionCategory: 'LAYER3'
    },

    // API settings
    api: {
        timeout: 30000, // Request timeout in ms
        retries: 3      // Number of retries on failure
    }
};
