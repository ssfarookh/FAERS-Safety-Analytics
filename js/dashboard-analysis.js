// Dashboard Analysis Module
class DashboardAnalyzer {
    constructor() {
        this.currentResults = null;
        this.chartInstances = {};
    }

    async runAnalysis(drugName, adverseEvents, dateFrom, dateTo, onProgress) {
        try {
            this.showLoading(true, 'Fetching case reports from openFDA...');
            
            // Parse adverse events
            const events = adverseEvents
                ? adverseEvents.split(',').map(e => e.trim()).filter(e => e)
                : [];

            // Fetch main case data
            const caseData = await faersAPI.searchByDrugAndEvents(
                drugName, events, dateFrom, dateTo, 1000
            );

            // Fetch demographics
            const demographics = await faersAPI.getDemographics(
                drugName, events, dateFrom, dateTo
            );

            // Fetch time series
            const timeSeries = await faersAPI.getTimeSeries(
                drugName, events, dateFrom, dateTo
            );

            // Fetch top drug associations
            const drugAssociations = await faersAPI.getDrugAssociations(drugName, 10);

            // Fetch top event associations
            const eventAssociations = await faersAPI.getEventAssociations(drugName, 10);

            this.showLoading(false);

            // Process and display results
            this.processResults({
                caseData,
                demographics,
                timeSeries,
                drugAssociations,
                eventAssociations,
                drugName,
                events,
                dateFrom,
                dateTo
            });

            // Save to history
            this.saveToHistory('Dashboard', drugName, caseData.meta?.results?.total || 0);

        } catch (error) {
            this.showLoading(false);
            alert(`Error: ${error.message}`);
            console.error(error);
        }
    }

    processResults(data) {
        this.currentResults = data;

        // Update header
        document.getElementById('resultDrugName').textContent = data.drugName;
        document.getElementById('dashboardResults').style.display = 'block';

        // Calculate statistical metrics
        const totalCases = data.caseData.meta?.results?.total || 0;
        const stats = this.calculateDisproportionality(data);

        document.getElementById('totalCases').textContent = totalCases.toLocaleString();
        document.getElementById('prrValue').textContent = stats.prr?.toFixed(2) || '-';
        document.getElementById('prrCI').textContent = stats.prrCI 
            ? `95% CI: ${stats.prrCI[0].toFixed(2)} - ${stats.prrCI[1].toFixed(2)}` 
            : '95% CI: -';
        document.getElementById('rorValue').textContent = stats.ror?.toFixed(2) || '-';
        document.getElementById('rorCI').textContent = stats.rorCI 
            ? `95% CI: ${stats.rorCI[0].toFixed(2)} - ${stats.rorCI[1].toFixed(2)}` 
            : '95% CI: -';
        document.getElementById('significantSignals').textContent = stats.significantCount;

        // Render charts
        this.renderCharts(data);

        // Render tables
        this.renderTopDrugsTable(data.drugAssociations);
        this.renderTopEventsTable(data.eventAssociations);
        this.renderLineListing(data.caseData.results || []);
    }

    calculateDisproportionality(data) {
        // Simplified calculation - in production, use full 2x2 contingency table
        const totalCases = data.caseData.meta?.results?.total || 0;
        
        // Get total FAERS database size (approximate)
        const databaseTotal = 12000000; // ~12M total reports in FAERS
        
        const a = totalCases; // Drug + Event
        const b = 50000; // Drug without event (estimated)
        const c = 100000; // Event without drug (estimated)
        const d = databaseTotal - a - b - c; // Neither

        // PRR = (a/(a+b)) / (c/(c+d))
        const prr = ((a / (a + b)) / (c / (c + d))) || 0;
        
        // ROR = (a*d) / (b*c)
        const ror = ((a * d) / (b * c)) || 0;

        // Confidence intervals (simplified)
        const se = Math.sqrt((1/a) + (1/b) + (1/c) + (1/d)) || 0;
        const prrCI = prr > 0 ? [
            prr * Math.exp(-1.96 * se),
            prr * Math.exp(1.96 * se)
        ] : null;
        
        const rorCI = ror > 0 ? [
            ror * Math.exp(-1.96 * se),
            ror * Math.exp(1.96 * se)
        ] : null;

        const significantCount = (rorCI && rorCI[0] > 1) ? 1 : 0;

        return { prr, prrCI, ror, rorCI, significantCount };
    }

    renderCharts(data) {
        // Destroy existing charts
        Object.values(this.chartInstances).forEach(chart => chart.destroy());

        // Sex distribution
        const sexData = this.mapDemographicData(data.demographics.sex, {
            '1': 'Male',
            '2': 'Female',
            '0': 'Unknown'
        });
        this.chartInstances.sex = createPieChart('sexChart', sexData.labels, sexData.values);

        // Age distribution
        const ageData = this.mapDemographicData(data.demographics.age, {
            '1': 'Neonate',
            '2': 'Infant',
            '3': 'Child',
            '4': 'Adolescent',
            '5': 'Adult',
            '6': 'Elderly'
        });
        this.chartInstances.age = createPieChart('ageChart', ageData.labels, ageData.values);

        // Reporter qualification
        const reporterData = this.mapDemographicData(data.demographics.reporter, {
            '1': 'Physician',
            '2': 'Pharmacist',
            '3': 'Other health professional',
            '4': 'Consumer',
            '5': 'Lawyer',
            '6': 'Other'
        });
        this.chartInstances.reporter = createPieChart('reporterChart', reporterData.labels, reporterData.values);

        // Time trend
        const trendData = this.processTimeSeries(data.timeSeries);
        this.chartInstances.trend = createLineChart('trendChart', trendData.labels, trendData.values, 'Reports Over Time');
    }

    mapDemographicData(apiData, labelMap) {
        const labels = [];
        const values = [];

        (apiData || []).forEach(item => {
            const label = labelMap[item.term] || item.term || 'Unknown';
            labels.push(label);
            values.push(item.count);
        });

        return { labels, values };
    }

    processTimeSeries(timeSeriesData) {
        const sorted = (timeSeriesData || []).sort((a, b) => 
            a.term.localeCompare(b.term)
        );

        return {
            labels: sorted.map(item => item.term),
            values: sorted.map(item => item.count)
        };
    }

    renderTopDrugsTable(associations) {
        const tbody = document.querySelector('#topDrugsTable tbody');
        tbody.innerHTML = '';

        (associations.results || []).forEach((item, index) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.term}</td>
                <td>${item.count.toLocaleString()}</td>
                <td>-</td>
                <td>-</td>
            `;
        });
    }

    renderTopEventsTable(associations) {
        const tbody = document.querySelector('#topEventsTable tbody');
        tbody.innerHTML = '';

        (associations.results || []).forEach((item, index) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.term}</td>
                <td>${item.count.toLocaleString()}</td>
                <td>-</td>
                <td>-</td>
            `;
        });
    }

    renderLineListing(cases) {
        const tbody = document.querySelector('#lineListingTable tbody');
        tbody.innerHTML = '';

        cases.slice(0, 100).forEach(case_ => {
            const row = tbody.insertRow();
            const patient = case_.patient || {};
            const outcomes = (patient.patientoutcome || []).map(o => o.reactionoutcome).join(', ');
            
            row.innerHTML = `
                <td>${case_.safetyreportid || 'N/A'}</td>
                <td>${case_.receivedate || 'N/A'}</td>
                <td>${this.getSexLabel(patient.patientsex)}</td>
                <td>${patient.patientonsetage || 'N/A'} ${patient.patientonsetageunit || ''}</td>
                <td>${this.getReporterLabel(case_.primarysource?.qualification)}</td>
                <td>${outcomes || 'N/A'}</td>
            `;
        });
    }

    getSexLabel(code) {
        const map = { '1': 'Male', '2': 'Female', '0': 'Unknown' };
        return map[code] || 'Unknown';
    }

    getReporterLabel(code) {
        const map = {
            '1': 'Physician',
            '2': 'Pharmacist',
            '3': 'Other health-professional',
            '4': 'Consumer',
            '5': 'Lawyer',
            '6': 'Other'
        };
        return map[code] || 'Unknown';
    }

    saveToHistory(type, query, results) {
        const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        history.unshift({
            timestamp: new Date().toISOString(),
            type,
            query,
            results
        });
        localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 50)));
    }

    showLoading(show, text = '') {
        const modal = document.getElementById('loadingModal');
        document.getElementById('loadingText').textContent = text;
        modal.style.display = show ? 'flex' : 'none';
    }

    exportToCSV() {
        if (!this.currentResults) return;

        const cases = this.currentResults.caseData.results || [];
        const csv = [
            ['Case ID', 'Received Date', 'Sex', 'Age', 'Reporter', 'Outcomes'].join(','),
            ...cases.map(c => [
                c.safetyreportid || '',
                c.receivedate || '',
                this.getSexLabel(c.patient?.patientsex),
                c.patient?.patientonsetage || '',
                this.getReporterLabel(c.primarysource?.qualification),
                (c.patient.patientoutcome || []).map(o => o.reactionoutcome).join('; ')
            ].map(v => `"${v}"`).join(','))
        ].join('\n');

        this.downloadFile(csv, 'dashboard_results.csv', 'text/csv');
    }

    exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text(`FAERS Safety Analytics Report - ${this.currentResults.drugName}`, 10, 20);
        
        doc.setFontSize(12);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 10, 35);
        doc.text(`Total Cases: ${this.currentResults.caseData.meta?.results?.total || 0}`, 10, 50);

        doc.save('dashboard_report.pdf');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

const dashboardAnalyzer = new DashboardAnalyzer();