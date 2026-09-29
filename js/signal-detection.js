// Bulk Signal Detection Module
class BulkSignalDetector {
    constructor() {
        this.currentResults = null;
    }

    async runDetection(queryTerm, queryType, maxResults, filterSignificant, onProgress) {
        try {
            document.getElementById('bulkResults').style.display = 'block';
            document.getElementById('bulkQueryName').textContent = queryTerm;
            
            this.showProgress(0, 'Initializing bulk detection...');

            let associations;
            if (queryType === 'drug') {
                associations = await faersAPI.getDrugAssociations(queryTerm, maxResults);
            } else {
                associations = await faersAPI.getEventAssociations(queryTerm, maxResults);
            }

            this.showProgress(50, 'Processing statistical metrics...');

            // Process results with disproportionality metrics
            const processedResults = this.processAssociations(associations.results || [], filterSignificant);

            this.showProgress(100, 'Complete!');

            // Display results
            this.displayResults(processedResults, queryType);

            // Save to history
            dashboardAnalyzer.saveToHistory(
                'Bulk Detection', 
                `${queryType}: ${queryTerm}`, 
                processedResults.length
            );

            setTimeout(() => {
                this.showProgress(0, '');
            }, 2000);

        } catch (error) {
            alert(`Error: ${error.message}`);
            console.error(error);
        }
    }

    processAssociations(associations, filterSignificant) {
        const databaseTotal = 12000000;
        const totalQueryCases = associations.reduce((sum, a) => sum + a.count, 0);

        const processed = associations.map((assoc, index) => {
            const a = assoc.count;
            const b = totalQueryCases - a;
            const c = 100000; // Estimated other cases
            const d = databaseTotal - totalQueryCases - c;

            const prr = ((a / (a + b)) / (c / (c + d))) || 0;
            const ror = ((a * d) / (b * c)) || 0;

            const se = Math.sqrt((1/a) + (1/b) + (1/c) + (1/d)) || 0;
            const prrCI = prr > 0 ? [
                prr * Math.exp(-1.96 * se),
                prr * Math.exp(1.96 * se)
            ] : [0, 0];
            
            const rorCI = ror > 0 ? [
                ror * Math.exp(-1.96 * se),
                ror * Math.exp(1.96 * se)
            ] : [0, 0];

            const significant = rorCI[0] > 1.0;

            return {
                rank: index + 1,
                term: assoc.term,
                count: a,
                prr,
                prrCI,
                ror,
                rorCI,
                significant
            };
        });

        // Filter if requested
        return filterSignificant 
            ? processed.filter(item => item.significant)
            : processed;
    }

    displayResults(results, queryType) {
        this.currentResults = { results, queryType };

        // Update metrics
        document.getElementById('bulkTotalAnalyzed').textContent = results.length.toLocaleString();
        document.getElementById('bulkSignificant').textContent = 
            results.filter(r => r.significant).length.toLocaleString();
        
        const highestPRR = results.reduce((max, r) => r.prr > max ? r.prr : max, 0);
        const highestROR = results.reduce((max, r) => r.ror > max ? r.ror : max, 0);
        
        document.getElementById('bulkHighestPRR').textContent = highestPRR.toFixed(2);
        document.getElementById('bulkHighestROR').textContent = highestROR.toFixed(2);

        // Render table
        const tbody = document.querySelector('#bulkSignalsTable tbody');
        tbody.innerHTML = '';

        results.forEach(item => {
            const row = tbody.insertRow();
            row.className = item.significant ? 'significant-row' : '';
            row.innerHTML = `
                <td>${item.rank}</td>
                <td>${item.term}</td>
                <td>${item.count.toLocaleString()}</td>
                <td>${item.prr.toFixed(2)}</td>
                <td>${item.prrCI[0].toFixed(2)} - ${item.prrCI[1].toFixed(2)}</td>
                <td>${item.ror.toFixed(2)}</td>
                <td>${item.rorCI[0].toFixed(2)} - ${item.rorCI[1].toFixed(2)}</td>
                <td>${item.significant ? '✅ Yes' : 'No'}</td>
            `;
        });
    }

    showProgress(percent, text) {
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressText').textContent = text;
    }

    exportBulkToCSV() {
        if (!this.currentResults) return;

        const csv = [
            ['Rank', 'Term', 'Case Count', 'PRR', 'PRR CI Lower', 'PRR CI Upper', 'ROR', 'ROR CI Lower', 'ROR CI Upper', 'Significant'].join(','),
            ...this.currentResults.results.map(r => [
                r.rank,
                `"${r.term}"`,
                r.count,
                r.prr.toFixed(2),
                r.prrCI[0].toFixed(2),
                r.prrCI[1].toFixed(2),
                r.ror.toFixed(2),
                r.rorCI[0].toFixed(2),
                r.rorCI[1].toFixed(2),
                r.significant ? 'Yes' : 'No'
            ].join(','))
        ].join('\n');

        const filename = `bulk_signal_detection_${new Date().getTime()}.csv`;
        dashboardAnalyzer.downloadFile(csv, filename, 'text/csv');
    }
}

const bulkSignalDetector = new BulkSignalDetector();