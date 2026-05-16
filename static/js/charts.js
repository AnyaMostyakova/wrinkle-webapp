// charts.js - загрузка библиотеки Chart.js
const chartScript = document.createElement('script');
chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
chartScript.onload = () => {
    console.log('Chart.js загружен');
};
document.head.appendChild(chartScript);