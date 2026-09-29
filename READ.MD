# FAERS Safety Analytics (AEMS) - Web Application

A comprehensive pharmacovigilance analytics dashboard similar to the Chrome extension "FAERS Safety Analytics (Now AEMS)".

## Features

### Dashboard Analysis
- Query suspect drugs with up to 5 adverse events
- Calculate PRR (Proportional Reporting Ratio) and ROR (Reporting Odds Ratio)
- Demographic breakdowns (sex, age, reporter type)
- Time trend analysis
- Top 10 drug and event associations
- Individual case line listing
- CSV and PDF export

### Bulk Signal Detection
- Query single drug or adverse event
- Analyze up to 500 associations
- Statistical disproportionality metrics
- Filter significant signals (ROR lower 95% CI > 1.0)
- CSV export

### Additional Features
- Search history tracking
- openFDA API key support
- Rate limiting and retry logic
- Responsive design

## Setup

1. Clone or download all files maintaining the directory structure
2. Open `index.html` in a modern web browser
3. (Optional) Get an openFDA API key from https://open.fda.gov/api/authentication/
4. Enter API key to avoid rate limits

## Data Source

- FDA Adverse Event Monitoring System (AEMS) via openFDA API
- API endpoint: https://api.fda.gov/drug/event.json

## Important Disclaimers

⚠️ **Data Limitations:**
- Reports do not establish causation
- Data may contain duplicates and incomplete information
- Cannot estimate incidence rates
- For pharmacovigilance professionals only

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Technologies Used

- HTML5, CSS3, JavaScript (ES6+)
- Chart.js for visualizations
- jsPDF for PDF generation
- openFDA REST API

## License

MIT License - Free for educational and research use