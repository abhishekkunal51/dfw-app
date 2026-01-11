const express = require('express');
const cors = require('cors');
const path = require('path');
const firewallRoutes = require('./routes/firewall');
const nsxRoutes = require('./routes/nsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', firewallRoutes);
app.use('/api/nsx', nsxRoutes);

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
