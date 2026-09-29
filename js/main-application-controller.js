// Main Application Controller
document.addEventListener('DOMContentLoaded', function() {
    // Initialize
    initTabs();
    loadApiKey();
    loadHistory();

    // Set default date range (last 5 years)
    const today = new Date();
    const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
    document.getElementById('dateFrom').value = fiveYearsAgo.toISOString().split('T')[0];
    document.getElementById('dateTo').value = today.toISOString().split('T')[0];
});

// Tab Navigation
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active to selected
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// API Key Management
function saveApiKey() {
    const key = document.getElementById('apiKey').value.trim();
    if (key) {
        faersAPI.setApiKey(key);
        alert('API key saved successfully!');
    }
}

function loadApiKey() {
    const savedKey = localStorage.getItem('openFDA_apiKey');
    if (savedKey) {
        document.getElementById('apiKey').value = savedKey;
        faersAPI.setApiKey(savedKey);
    }
}

// Dashboard Analysis
function runDashboardAnalysis() {
    const drugName = document.getElementById('drugName').value.trim();
    const adverseEvents = document.getElementById('adverseEvents').value.trim();
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    if (!drugName) {
        alert('Please enter a suspect drug name');
        return;
    }

    dashboardAnalyzer.runAnalysis(drugName, adverseEvents, dateFrom, dateTo);
}

// Bulk Signal Detection
function runBulkSignalDetection() {
    const queryTerm = document.getElementById('bulkQuery').value.trim();
    const queryType = document.getElementById('queryType').value;
    const maxResults = parseInt(document.getElementById('maxResults').value) || 100;
    const filterSignificant = document.getElementById('filterSignificant').checked;

    if (!queryTerm) {
        alert('Please enter a drug name or adverse event term');
        return;
    }

    bulkSignalDetector.runDetection(queryTerm, queryType, maxResults, filterSignificant);
}

// History Management
function loadHistory() {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const tbody = document.querySelector('#historyTable tbody');
    tbody.innerHTML = '';

    history.forEach((item, index) => {
        const row = tbody.insertRow();
        const date = new Date(item.timestamp).toLocaleString();
        row.innerHTML = `
            <td>${date}</td>
            <td>${item.type}</td>
            <td>${item.query}</td>
            <td>${item.results.toLocaleString()}</td>
            <td><button class="btn-secondary" onclick="deleteHistoryItem(${index})">🗑️</button></td>
        `;
    });
}

function deleteHistoryItem(index) {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    history.splice(index, 1);
    localStorage.setItem('searchHistory', JSON.stringify(history));
    loadHistory();
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all search history?')) {
        localStorage.removeItem('searchHistory');
        loadHistory();
    }
}

// Export functions (exposed to global scope)
function exportToCSV() {
    dashboardAnalyzer.exportToCSV();
}

function exportToPDF() {
    dashboardAnalyzer.exportToPDF();
}

function exportBulkToCSV() {
    bulkSignalDetector.exportBulkToCSV();
}