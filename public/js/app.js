const API_URL = '/api';

// DOM Elements
const firewallForm = document.getElementById('firewallForm');
const rulesTableBody = document.getElementById('rulesTableBody');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const noRulesMessage = document.getElementById('noRulesMessage');
const ruleModal = document.getElementById('ruleModal');
const ruleDetails = document.getElementById('ruleDetails');
const modalActions = document.getElementById('modalActions');
const toast = document.getElementById('toast');

// NSX-T Elements
const nsxIndicator = document.getElementById('nsxIndicator');
const nsxStatusText = document.getElementById('nsxStatusText');
const pendingPushCount = document.getElementById('pendingPushCount');
const pushRulesBtn = document.getElementById('pushRulesBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadRules();
    setupEventListeners();
    testNSXConnection();
    loadPendingPushCount();
});

// Setup Event Listeners
function setupEventListeners() {
    firewallForm.addEventListener('submit', handleFormSubmit);
    searchInput.addEventListener('input', debounce(loadRules, 300));
    statusFilter.addEventListener('change', loadRules);

    // Close modal when clicking outside
    ruleModal.addEventListener('click', (e) => {
        if (e.target === ruleModal) {
            closeModal();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

// Load Rules
async function loadRules() {
    try {
        const status = statusFilter.value;
        const search = searchInput.value;

        let url = `${API_URL}/rules?`;
        if (status !== 'all') url += `status=${status}&`;
        if (search) url += `search=${encodeURIComponent(search)}`;

        const response = await fetch(url);
        const rules = await response.json();

        renderRules(rules);
        loadPendingPushCount();
    } catch (error) {
        showToast('Failed to load rules', 'error');
        console.error('Error loading rules:', error);
    }
}

// Render Rules Table
function renderRules(rules) {
    if (rules.length === 0) {
        rulesTableBody.innerHTML = '';
        noRulesMessage.style.display = 'block';
        document.querySelector('.table-container').style.display = 'none';
        return;
    }

    noRulesMessage.style.display = 'none';
    document.querySelector('.table-container').style.display = 'block';

    rulesTableBody.innerHTML = rules.map(rule => `
        <tr>
            <td><strong>${escapeHtml(rule.rule_name)}</strong></td>
            <td>${escapeHtml(rule.source_ip)}</td>
            <td>${escapeHtml(rule.destination_ip)}</td>
            <td>${escapeHtml(rule.port)}</td>
            <td>${escapeHtml(rule.protocol)}</td>
            <td>${escapeHtml(rule.direction)}</td>
            <td><span class="action-badge action-${rule.action.toLowerCase()}">${escapeHtml(rule.action)}</span></td>
            <td>${rule.priority}</td>
            <td><span class="status-badge status-${rule.status}">${rule.status}</span></td>
            <td>${renderNSXStatus(rule)}</td>
            <td class="table-actions">
                <button class="btn btn-secondary btn-sm" onclick="viewRule(${rule.id})">View</button>
                ${rule.status === 'pending' ? `
                    <button class="btn btn-success btn-sm" onclick="updateStatus(${rule.id}, 'approved')">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="updateStatus(${rule.id}, 'rejected')">Reject</button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// Render NSX-T Status for a rule
function renderNSXStatus(rule) {
    if (rule.pushed_to_nsx) {
        return `<span class="nsx-badge nsx-pushed" title="NSX Rule ID: ${rule.nsx_rule_id || 'N/A'}">Pushed</span>`;
    } else if (rule.status === 'approved') {
        return `<span class="nsx-badge nsx-pending">Pending Push</span>`;
    } else {
        return `<span class="nsx-badge nsx-pending">-</span>`;
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(firewallForm);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(`${API_URL}/rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create rule');
        }

        showToast('Firewall rule request submitted successfully!', 'success');
        firewallForm.reset();
        loadRules();
    } catch (error) {
        showToast(error.message, 'error');
        console.error('Error creating rule:', error);
    }
}

// View Rule Details
async function viewRule(id) {
    try {
        const response = await fetch(`${API_URL}/rules/${id}`);
        const rule = await response.json();

        ruleDetails.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Rule Name:</span>
                <span class="detail-value">${escapeHtml(rule.rule_name)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${escapeHtml(rule.description) || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Source IP:</span>
                <span class="detail-value">${escapeHtml(rule.source_ip)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Destination IP:</span>
                <span class="detail-value">${escapeHtml(rule.destination_ip)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Port:</span>
                <span class="detail-value">${escapeHtml(rule.port)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Protocol:</span>
                <span class="detail-value">${escapeHtml(rule.protocol)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Direction:</span>
                <span class="detail-value">${escapeHtml(rule.direction)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Action:</span>
                <span class="detail-value"><span class="action-badge action-${rule.action.toLowerCase()}">${escapeHtml(rule.action)}</span></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Service:</span>
                <span class="detail-value">${escapeHtml(rule.service) || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Priority:</span>
                <span class="detail-value">${rule.priority}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value"><span class="status-badge status-${rule.status}">${rule.status}</span></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">NSX-T Status:</span>
                <span class="detail-value">${rule.pushed_to_nsx ? `Pushed (ID: ${rule.nsx_rule_id})` : 'Not pushed'}</span>
            </div>
            ${rule.pushed_at ? `
            <div class="detail-row">
                <span class="detail-label">Pushed At:</span>
                <span class="detail-value">${formatDate(rule.pushed_at)}</span>
            </div>
            ` : ''}
            <div class="detail-row">
                <span class="detail-label">Created:</span>
                <span class="detail-value">${formatDate(rule.created_at)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Updated:</span>
                <span class="detail-value">${formatDate(rule.updated_at)}</span>
            </div>
        `;

        modalActions.innerHTML = `
            ${rule.status === 'pending' ? `
                <button class="btn btn-success" onclick="updateStatus(${rule.id}, 'approved'); closeModal();">Approve</button>
                <button class="btn btn-danger" onclick="updateStatus(${rule.id}, 'rejected'); closeModal();">Reject</button>
            ` : ''}
            <button class="btn btn-danger" onclick="deleteRule(${rule.id}); closeModal();">Delete</button>
        `;

        ruleModal.classList.add('active');
    } catch (error) {
        showToast('Failed to load rule details', 'error');
        console.error('Error loading rule:', error);
    }
}

// Update Rule Status
async function updateStatus(id, status) {
    try {
        const response = await fetch(`${API_URL}/rules/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            throw new Error('Failed to update status');
        }

        showToast(`Rule ${status} successfully!`, 'success');
        loadRules();
    } catch (error) {
        showToast(error.message, 'error');
        console.error('Error updating status:', error);
    }
}

// Delete Rule
async function deleteRule(id) {
    if (!confirm('Are you sure you want to delete this rule?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/rules/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete rule');
        }

        showToast('Rule deleted successfully!', 'success');
        loadRules();
    } catch (error) {
        showToast(error.message, 'error');
        console.error('Error deleting rule:', error);
    }
}

// Close Modal
function closeModal() {
    ruleModal.classList.remove('active');
}

// ==================== NSX-T Functions ====================

// Test NSX-T Connection
async function testNSXConnection() {
    nsxIndicator.className = 'status-indicator checking';
    nsxStatusText.textContent = 'Checking connection...';

    try {
        const response = await fetch(`${API_URL}/nsx/test-connection`);
        const result = await response.json();

        if (result.success) {
            nsxIndicator.className = 'status-indicator connected';
            nsxStatusText.textContent = 'Connected to NSX-T Manager';
            showToast('NSX-T connection successful', 'success');
        } else {
            nsxIndicator.className = 'status-indicator disconnected';
            nsxStatusText.textContent = result.message || 'Connection failed';
            showToast('NSX-T connection failed', 'error');
        }
    } catch (error) {
        nsxIndicator.className = 'status-indicator disconnected';
        nsxStatusText.textContent = 'Connection error';
        console.error('NSX-T connection error:', error);
    }
}

// Load pending push count
async function loadPendingPushCount() {
    try {
        const response = await fetch(`${API_URL}/nsx/pending-push`);
        const rules = await response.json();
        const count = rules.length;

        pendingPushCount.textContent = `${count} rule${count !== 1 ? 's' : ''} pending push`;
        pendingPushCount.className = count > 0 ? 'badge has-pending' : 'badge';
        pushRulesBtn.disabled = count === 0;
    } catch (error) {
        console.error('Error loading pending push count:', error);
    }
}

// Push approved rules to NSX-T
async function pushApprovedRules() {
    if (!confirm('Push all approved rules to NSX-T? This action will create firewall rules in NSX-T Manager.')) {
        return;
    }

    pushRulesBtn.disabled = true;
    pushRulesBtn.textContent = 'Pushing...';

    try {
        const response = await fetch(`${API_URL}/nsx/push-rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok) {
            if (result.totalPushed > 0) {
                showToast(`Successfully pushed ${result.totalPushed} rule(s) to NSX-T`, 'success');
            } else {
                showToast(result.message || 'No rules to push', 'info');
            }

            if (result.totalFailed > 0) {
                showToast(`${result.totalFailed} rule(s) failed to push`, 'error');
                console.error('Failed rules:', result.failed);
            }

            loadRules();
        } else {
            throw new Error(result.error || 'Push failed');
        }
    } catch (error) {
        showToast(`Push failed: ${error.message}`, 'error');
        console.error('Error pushing rules:', error);
    } finally {
        pushRulesBtn.disabled = false;
        pushRulesBtn.textContent = 'Push Approved Rules to NSX-T';
        loadPendingPushCount();
    }
}

// ==================== Utility Functions ====================

// Show Toast Notification
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
