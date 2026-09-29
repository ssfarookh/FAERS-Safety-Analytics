class FAERSAPIClient {
    constructor() {
        this.baseURL = "https://api.fda.gov/drug/event.json";
        this.apiKey = localStorage.getItem("openFDA_apiKey") || "";
    }

    setApiKey(key) {
        this.apiKey = String(key || "").trim();

        if (this.apiKey) {
            localStorage.setItem("openFDA_apiKey", this.apiKey);
        } else {
            localStorage.removeItem("openFDA_apiKey");
        }
    }

    cleanText(value) {
        return String(value || "")
            .trim()
            .replace(/"/g, "")
            .replace(/[+]/g, " ");
    }

    convertDate(value) {
        return value ? value.replaceAll("-", "") : "";
    }

    buildSearch(drugName, events = [], dateFrom = "", dateTo = "") {
        const drug = this.cleanText(drugName);

        if (!drug) {
            throw new Error("A drug name is required.");
        }

        let query = `patient.drug.medicinalproduct:"${drug}"`;

        const cleanEvents = events
            .map(event => this.cleanText(event))
            .filter(Boolean)
            .slice(0, 5);

        if (cleanEvents.length > 0) {
            const eventQuery = cleanEvents
                .map(event => {
                    return `patient.reaction.reactionmeddrapt:"${event}"`;
                })
                .join(" AND ");

            query += ` AND (${eventQuery})`;
        }

        const from = this.convertDate(dateFrom);
        const to = this.convertDate(dateTo);

        if (from && to) {
            query += ` AND receivedate:[${from} TO ${to}]`;
        } else if (from) {
            query += ` AND receivedate:[${from} TO 99991231]`;
        } else if (to) {
            query += ` AND receivedate:[19000101 TO ${to}]`;
        }

        return query;
    }

    async makeRequest(parameters = {}) {
        const url = new URL(this.baseURL);

        Object.entries(parameters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, value);
            }
        });

        if (this.apiKey) {
            url.searchParams.set("api_key", this.apiKey);
        }

        console.log(
            "openFDA request:",
            url.toString().replace(this.apiKey, "[HIDDEN]")
        );

        const response = await fetch(url.toString());

        let body = null;

        try {
            body = await response.json();
        } catch (error) {
            body = null;
        }

        if (!response.ok) {
            const message =
                body?.error?.message ||
                body?.message ||
                "Check your request and try again";

            const details = body?.error?.details
                ? ` Details: ${JSON.stringify(body.error.details)}`
                : "";

            throw new Error(
                `openFDA request failed (${response.status}): ${message}${details}`
            );
        }

        return body;
    }

    async searchByDrugAndEvents(
        drugName,
        adverseEvents = [],
        dateFrom = "",
        dateTo = "",
        limit = 100
    ) {
        const search = this.buildSearch(
            drugName,
            adverseEvents,
            dateFrom,
            dateTo
        );

        return this.makeRequest({
            search,
            limit: Math.min(Math.max(Number(limit) || 100, 1), 1000)
        });
    }

    async getDrugAssociations(drugName, limit = 10) {
        const drug = this.cleanText(drugName);

        return this.makeRequest({
            search: `patient.drug.medicinalproduct:"${drug}"`,
            count: "patient.reaction.reactionmeddrapt.exact",
            limit: Math.min(Math.max(Number(limit) || 10, 1), 1000)
        });
    }

    async getEventAssociations(eventTerm, limit = 100) {
        const event = this.cleanText(eventTerm);

        return this.makeRequest({
            search: `patient.reaction.reactionmeddrapt:"${event}"`,
            count: "patient.drug.medicinalproduct.exact",
            limit: Math.min(Math.max(Number(limit) || 100, 1), 1000)
        });
    }

    async getDemographics(
        drugName,
        adverseEvents = [],
        dateFrom = "",
        dateTo = ""
    ) {
        const search = this.buildSearch(
            drugName,
            adverseEvents,
            dateFrom,
            dateTo
        );

        const getCount = async field => {
            try {
                const result = await this.makeRequest({
                    search,
                    count: field,
                    limit: 100
                });

                return result.results || [];
            } catch (error) {
                console.warn(`Could not load ${field}:`, error);
                return [];
            }
        };

        const [sex, age, reporter] = await Promise.all([
            getCount("patient.patientsex"),
            getCount("patient.patientonsetagegroup"),
            getCount("primarysource.qualification")
        ]);

        return {
            sex,
            age,
            reporter
        };
    }

    async getTimeSeries(
        drugName,
        adverseEvents = [],
        dateFrom = "",
        dateTo = ""
    ) {
        try {
            const search = this.buildSearch(
                drugName,
                adverseEvents,
                dateFrom,
                dateTo
            );

            const result = await this.makeRequest({
                search,
                count: "receivedate",
                limit: 1000
            });

            return result.results || [];
        } catch (error) {
            console.warn("Could not load time series:", error);
            return [];
        }
    }
}

const faersAPI = new FAERSAPIClient();