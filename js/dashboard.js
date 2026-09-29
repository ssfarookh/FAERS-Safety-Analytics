class DashboardAnalyzer {
    constructor() {
        this.currentResults = null;
        this.charts = {};
    }

    async runAnalysis(
        drugName,
        adverseEvents = "",
        dateFrom = "",
        dateTo = ""
    ) {
        const events = adverseEvents
            .split(",")
            .map(event => event.trim())
            .filter(Boolean)
            .slice(0, 5);

        this.showLoading(true, "Fetching reports from openFDA...");

        try {
            const caseData = await faersAPI.searchByDrugAndEvents(
                drugName,
                events,
                dateFrom,
                dateTo,
                100
            );

            const demographics = await faersAPI.getDemographics(
                drugName,
                events,
                dateFrom,
                dateTo
            );

            const timeSeries = await faersAPI.getTimeSeries(
                drugName,
                events,
                dateFrom,
                dateTo
            );

            const reactionAssociations =
                await faersAPI.getDrugAssociations(drugName, 10);

            this.currentResults = {
                caseData,
                demographics,
                timeSeries,
                reactionAssociations,
                drugName,
                events,
                dateFrom,
                dateTo
            };

            this.processResults();

            this.saveToHistory(
                "Dashboard",
                drugName,
                caseData.meta?.results?.total || 0
            );
        } catch (error) {
            console.error("Dashboard error:", error);

            alert(
                `Could not complete the search.\n\n${error.message}\n\nTry searching only for a drug name, such as aspirin.`
            );
        } finally {
            this.showLoading(false);
        }
    }

    processResults() {
        const data = this.currentResults;
        const cases = data.caseData.results || [];
        const totalCases = data.caseData.meta?.results?.total || 0;

        document.getElementById("resultDrugName").textContent =
            data.drugName;

        document.getElementById("dashboardResults").style.display = "block";

        document.getElementById("totalCases").textContent =
            Number(totalCases).toLocaleString();

        /*
         * PRR and ROR are intentionally not estimated here.
         * They require a validated 2x2 contingency table.
         */
        document.getElementById("prrValue").textContent = "N/A";
        document.getElementById("prrCI").textContent =
            "Validated comparator data required";

        document.getElementById("rorValue").textContent = "N/A";
        document.getElementById("rorCI").textContent =
            "Validated comparator data required";

        document.getElementById("significantSignals").textContent = "N/A";

        this.renderCharts(data);
        this.renderTopEventsTable(
            data.reactionAssociations.results || []
        );
        this.renderLineListing(cases);
    }

    renderCharts(data) {
        this.destroyCharts();

        const sexData = this.mapData(
            data.demographics.sex,
            {
                "1": "Male",
                "2": "Female",
                "0": "Unknown"
            }
        );

        this.charts.sex = createPieChart(
            "sexChart",
            sexData.labels,
            sexData.values
        );

        const ageData = this.mapData(
            data.demographics.age,
            {
                "1": "Neonate",
                "2": "Infant",
                "3": "Child",
                "4": "Adolescent",
                "5": "Adult",
                "6": "Elderly"
            }
        );

        this.charts.age = createPieChart(
            "ageChart",
            ageData.labels,
            ageData.values
        );

        const reporterData = this.mapData(
            data.demographics.reporter,
            {
                "1": "Physician",
                "2": "Pharmacist",
                "3": "Other health professional",
                "4": "Consumer",
                "5": "Lawyer",
                "6": "Other"
            }
        );

        this.charts.reporter = createPieChart(
            "reporterChart",
            reporterData.labels,
            reporterData.values
        );

        const timeSeries = [...data.timeSeries].sort((a, b) =>
            String(a.term).localeCompare(String(b.term))
        );

        this.charts.trend = createLineChart(
            "trendChart",
            timeSeries.map(item => item.term),
            timeSeries.map(item => item.count),
            "Reports over time"
        );
    }

    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === "function") {
                chart.destroy();
            }
        });

        this.charts = {};
    }

    mapData(rows = [], labelMap = {}) {
        return {
            labels: rows.map(row => {
                return labelMap[row.term] || row.term || "Unknown";
            }),
            values: rows.map(row => Number(row.count) || 0)
        };
    }

    renderTopEventsTable(rows = []) {
        const body = document.querySelector(
            "#topEventsTable tbody"
        );

        if (!body) return;

        if (!rows.length) {
            body.innerHTML =
                '<tr><td colspan="5">No reaction data returned.</td></tr>';
            return;
        }

        body.innerHTML = rows
            .map((row, index) => {
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${this.escape(row.term)}</td>
                        <td>${Number(row.count).toLocaleString()}</td>
                        <td>N/A</td>
                        <td>N/A</td>
                    </tr>
                `;
            })
            .join("");
    }

    renderLineListing(cases = []) {
        const body = document.querySelector(
            "#lineListingTable tbody"
        );

        if (!body) return;

        if (!cases.length) {
            body.innerHTML =
                '<tr><td colspan="6">No matching reports found.</td></tr>';
            return;
        }

        body.innerHTML = cases
            .map(caseReport => {
                const patient = caseReport.patient || {};

                const outcomes = (patient.patientoutcome || [])
                    .map(item => item.reactionoutcome)
                    .join(", ");

                return `
                    <tr>
                        <td>${this.escape(
                            caseReport.safetyreportid || "N/A"
                        )}</td>
                        <td>${this.escape(
                            caseReport.receivedate || "N/A"
                        )}</td>
                        <td>${this.getSexLabel(
                            patient.patientsex
                        )}</td>
                        <td>${this.escape(
                            patient.patientonsetage || "N/A"
                        )}
                        ${this.escape(
                            patient.patientonsetageunit || ""
                        )}</td>
                        <td>${this.getReporterLabel(
                            caseReport.primarysource?.qualification
                        )}</td>
                        <td>${this.escape(outcomes || "N/A")}</td>
                    </tr>
                `;
            })
            .join("");
    }

    getSexLabel(code) {
        return (
            {
                "1": "Male",
                "2": "Female",
                "0": "Unknown"
            }[code] || "Unknown"
        );
    }

    getReporterLabel(code) {
        return (
            {
                "1": "Physician",
                "2": "Pharmacist",
                "3": "Other health professional",
                "4": "Consumer",
                "5": "Lawyer",
                "6": "Other"
            }[code] || "Unknown"
        );
    }

    escape(value) {
        const element = document.createElement("div");
        element.textContent = value ?? "";
        return element.innerHTML;
    }

    saveToHistory(type, query, results) {
        const history = JSON.parse(
            localStorage.getItem("searchHistory") || "[]"
        );

        history.unshift({
            timestamp: new Date().toISOString(),
            type,
            query,
            results
        });

        localStorage.setItem(
            "searchHistory",
            JSON.stringify(history.slice(0, 50))
        );

        if (typeof loadHistory === "function") {
            loadHistory();
        }
    }

    showLoading(show, message = "") {
        const modal = document.getElementById("loadingModal");

        if (!modal) return;

        document.getElementById("loadingText").textContent = message;
        modal.style.display = show ? "flex" : "none";
    }

    exportToCSV() {
        if (!this.currentResults) {
            alert("Run an analysis first.");
            return;
        }

        const rows = [
            [
                "Case ID",
                "Received Date",
                "Patient Sex",
                "Patient Age",
                "Reporter",
                "Outcomes"
            ]
        ];

        const cases = this.currentResults.caseData.results || [];

        cases.forEach(caseReport => {
            const patient = caseReport.patient || {};

            rows.push([
                caseReport.safetyreportid || "",
                caseReport.receivedate || "",
                this.getSexLabel(patient.patientsex),
                patient.patientonsetage || "",
                this.getReporterLabel(
                    caseReport.primarysource?.qualification
                ),
                (patient.patientoutcome || [])
                    .map(item => item.reactionoutcome)
                    .join("; ")
            ]);
        });

        this.downloadCSV(rows, "faers-dashboard-results.csv");
    }

    downloadCSV(rows, filename) {
        const csv = rows
            .map(row =>
                row
                    .map(value =>
                        `"${String(value).replaceAll('"', '""')}"`
                    )
                    .join(",")
            )
            .join("\n");

        const blob = new Blob([csv], {
            type: "text/csv;charset=utf-8"
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    }
}

const dashboardAnalyzer = new DashboardAnalyzer();