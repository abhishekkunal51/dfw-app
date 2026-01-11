# Distributed Firewall Request Portal

A web application for submitting and managing distributed firewall rule requests with VMware NSX-T integration.

## Features

- **Rule Request Form** - Submit firewall rules with extended fields (source/destination IP, port, protocol, direction, action, service, priority)
- **Approval Workflow** - Admin can approve or reject pending requests
- **NSX-T Integration** - Batch push approved rules to NSX-T Manager's Distributed Firewall
- **Real-time Status** - Connection indicator and push status tracking
- **Search & Filter** - Find rules by name, IP, or status

## Screenshots

### Rule Submission Form
Submit new firewall rule requests with validation.

### Rules Table
View all rules with status badges (Pending/Approved/Rejected) and NSX-T push status.

### NSX-T Integration Panel
Test connection and batch push approved rules to NSX-T Manager.

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: SQLite
- **Integration**: VMware NSX-T Manager API

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/abhishekkunal51/dfw-app.git
   cd dfw-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure NSX-T Manager** (see Configuration section)

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## Configuration

### NSX-T Manager Connection

Edit `config/nsx-config.js` with your NSX-T Manager details:

```javascript
module.exports = {
    nsxManager: {
        host: '192.168.1.100',     // NSX-T Manager IP/hostname
        port: 443,
        username: 'admin',
        password: 'your-password'
    },
    ssl: {
        rejectUnauthorized: false  // Set to true in production with valid certs
    },
    firewall: {
        sectionId: '',             // Leave empty to auto-create section
        sectionName: 'DFW-Portal-Rules'
    }
};
```

Or use environment variables:

```bash
# Windows
set NSX_MANAGER_HOST=192.168.1.100
set NSX_MANAGER_USERNAME=admin
set NSX_MANAGER_PASSWORD=your-password

# Linux/Mac
export NSX_MANAGER_HOST=192.168.1.100
export NSX_MANAGER_USERNAME=admin
export NSX_MANAGER_PASSWORD=your-password
```

## API Endpoints

### Firewall Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rules` | Get all rules (supports `?status=` and `?search=` filters) |
| GET | `/api/rules/:id` | Get a specific rule |
| POST | `/api/rules` | Create a new rule request |
| PUT | `/api/rules/:id` | Update a rule |
| PATCH | `/api/rules/:id/status` | Approve or reject a rule |
| DELETE | `/api/rules/:id` | Delete a rule |

### NSX-T Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nsx/test-connection` | Test NSX-T Manager connectivity |
| GET | `/api/nsx/pending-push` | Get approved rules awaiting push |
| POST | `/api/nsx/push-rules` | Push all approved rules to NSX-T |
| GET | `/api/nsx/sections` | List NSX-T firewall sections |

## Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User Submits   │────▶│  Admin Reviews  │────▶│  Admin Pushes   │────▶│  Rule Created   │
│  Rule Request   │     │  & Approves     │     │  to NSX-T       │     │  in NSX-T DFW   │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
      Status:                Status:                 Status:                 Status:
     PENDING                APPROVED              APPROVED +              APPROVED +
                                                 PENDING PUSH               PUSHED
```

## Project Structure

```
dfw-app/
├── config/
│   └── nsx-config.js      # NSX-T Manager configuration
├── database/
│   └── db.js              # SQLite database setup
├── public/
│   ├── index.html         # Main application page
│   ├── css/
│   │   └── styles.css     # Application styles
│   └── js/
│       └── app.js         # Frontend JavaScript
├── routes/
│   ├── firewall.js        # Firewall rules API routes
│   └── nsx.js             # NSX-T integration routes
├── services/
│   └── nsx-client.js      # NSX-T Manager API client
├── server.js              # Express server entry point
├── package.json
└── README.md
```

## Rule Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Rule Name | text | Yes | Unique identifier for the rule |
| Description | text | No | Purpose of the rule |
| Source IP | text | Yes | Source IP address or CIDR (e.g., 192.168.1.0/24) |
| Destination IP | text | Yes | Destination IP address or CIDR |
| Port | text | Yes | Port number or range (e.g., 80, 443, 8000-8080) |
| Protocol | select | Yes | TCP, UDP, ICMP, or Any |
| Direction | select | Yes | Inbound or Outbound |
| Action | select | Yes | Allow or Deny |
| Service | text | No | Service name (e.g., HTTP, SSH, MySQL) |
| Priority | number | No | Rule priority 1-1000 (default: 100) |

## NSX-T Requirements

- NSX-T Manager 2.4 or later
- User account with Security Admin privileges
- Network connectivity from the app server to NSX-T Manager (port 443)

## Security Considerations

- Store NSX-T credentials in environment variables, not in code
- Use HTTPS in production
- Enable SSL certificate verification in production
- Implement authentication for the web portal (not included by default)

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request
