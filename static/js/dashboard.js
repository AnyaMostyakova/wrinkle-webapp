// dashboard.js - скрипт для главной страницы
document.addEventListener('DOMContentLoaded', async () => {
    await loadDashboardData();
});

async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();

        if (data.success) {
            document.getElementById('totalScans').textContent = data.totalScans;
            document.getElementById('avgWrinkles').textContent = data.avgWrinkles + '%';
            document.getElementById('lastScanDate').textContent = data.lastScanDate || 'Нет сканов';
            document.getElementById('improvement').textContent = data.improvement || '0%';

            if (data.improvement && parseFloat(data.improvement) < 0) {
                document.getElementById('improvement').style.color = '#10b981';
            } else if (data.improvement && parseFloat(data.improvement) > 0) {
                document.getElementById('improvement').style.color = '#ef4444';
            }

            const scansList = document.getElementById('scansList');
            if (data.recentScans && data.recentScans.length > 0) {
                scansList.innerHTML = data.recentScans.map(scan => `
                    <div class="scan-item" onclick="viewScan('${scan.folder}')">
                        <span class="scan-date">📅 ${scan.scan_date}</span>
                        <span class="scan-percent">Морщины: ${scan.wrinkle_percent}%</span>
                        <span class="scan-badge">${scan.wrinkle_count} морщин</span>
                    </div>
                `).join('');
            } else {
                scansList.innerHTML = '<div class="empty-scans">Пока нет анализов. Сделайте первый снимок!</div>';
            }
        }
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
    }
}

function viewScan(folder) {
    window.location.href = `/history?scan=${folder}`;
}

function startNewAnalysis() {
    window.location.href = '/camera';
}

function viewHistory() {
    window.location.href = '/history';
}