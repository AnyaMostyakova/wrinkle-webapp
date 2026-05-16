// history.js - скрипт для страницы истории
let chart = null;
let allScans = [];
let currentAnalysis = null;
let currentFilter = 'all';

const urlParams = new URLSearchParams(window.location.search);
const scanFolder = urlParams.get('scan');

document.addEventListener('DOMContentLoaded', async () => {
    if (scanFolder) {
        await loadScanDetail(scanFolder);
    } else {
        await loadAllHistory();
    }
});

async function loadScanDetail(folder) {
    console.log('Loading scan detail for folder:', folder);

    try {
        const response = await fetch('/api/scan_detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: folder })
        });

        const data = await response.json();
        console.log('Response:', data);

        if (data.success) {
            document.getElementById('scanDetail').style.display = 'block';
            document.getElementById('allHistory').style.display = 'none';

            document.getElementById('scanDate').textContent = data.scan_date;
            document.getElementById('detailOriginal').src = data.original_url;
            document.getElementById('detailResult').src = data.result_url;
            document.getElementById('detailPercent').textContent = data.wrinkle_percent;
            document.getElementById('detailCount').textContent = data.wrinkle_count;
            document.getElementById('detailLighting').textContent = data.lighting_score;

            if (data.detailed_analysis && data.detailed_analysis.wrinkles && data.detailed_analysis.wrinkles.length > 0) {
                currentAnalysis = data.detailed_analysis;
                displayWrinklesAnalysis(currentAnalysis);
                document.getElementById('wrinklesDetailContainer').style.display = 'block';
            } else {
                document.getElementById('wrinklesDetailContainer').style.display = 'none';
                console.log('No detailed analysis available');
            }
        } else {
            showError('Скан не найден: ' + (data.error || 'unknown'));
        }
    } catch (err) {
        showError('Ошибка загрузки: ' + err.message);
        console.error(err);
    }
}
function displayWrinklesAnalysis(analysis) {
    if (!analysis) return;

    // Обновляем счетчики выраженности
    document.getElementById('minorCount').textContent = analysis.severity_summary?.minor || 0;
    document.getElementById('moderateCount').textContent = analysis.severity_summary?.moderate || 0;
    document.getElementById('severeCount').textContent = analysis.severity_summary?.severe || 0;

    // Отображаем статистику по зонам
    const zoneStatsDiv = document.getElementById('zoneStats');
    if (analysis.zones) {
        let zoneHtml = '';
        for (const [zoneName, zoneData] of Object.entries(analysis.zones)) {
            if (zoneData.count > 0) {
                zoneHtml += `
                    <div class="zone-stat-card">
                        <h4>${zoneData.name}</h4>
                        <div class="count">${zoneData.count} морщин</div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.6);">длина: ${Math.round(zoneData.total_length)}px</div>
                    </div>
                `;
            }
        }
        zoneStatsDiv.innerHTML = zoneHtml || '<div style="text-align: center; color: rgba(255,255,255,0.5);">Нет данных по зонам</div>';
    }

    // Отображаем список морщин
    renderWrinklesList(analysis.wrinkles, currentFilter);
}

function renderWrinklesList(wrinkles, filter) {
    let filteredWrinkles = wrinkles;
    if (filter !== 'all') {
        filteredWrinkles = wrinkles.filter(w => w.severity === filter);
    }

    const container = document.getElementById('wrinklesList');

    if (filteredWrinkles.length === 0) {
        container.innerHTML = '<div class="empty-scans">Морщины не найдены</div>';
        return;
    }

    let html = '';
    filteredWrinkles.forEach(w => {
        const severityClass = w.severity === 'severe' ? 'severity-severe' : (w.severity === 'moderate' ? 'severity-moderate' : 'severity-minor');

        html += `
            <div class="wrinkle-card ${w.severity}" onclick="scrollToWrinkleOnImage(${w.id})">
                <div class="wrinkle-info">
                    <div class="wrinkle-id severity-${w.severity}">#${w.id}</div>
                    <div class="wrinkle-zone">📍 ${w.zone_name}</div>
                    <div class="wrinkle-stats">
                        <span>📏 ${w.length_mm} мм</span>
                        <span>📐 ${w.width_mm} мм</span>
                        <span>🔄 ${w.angle_deg}°</span>
                        <span class="${severityClass}">⭐ ${w.severity_score}%</span>
                    </div>
                </div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 8px;">
                    📍 центр: (${w.center_x}, ${w.center_y}) | 📦 область: ${w.area_px} px²
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function filterWrinkles(filter) {
    currentFilter = filter;

    // Обновляем активные кнопки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    if (currentAnalysis && currentAnalysis.wrinkles) {
        renderWrinklesList(currentAnalysis.wrinkles, filter);
    }
}

function scrollToWrinkleOnImage(wrinkleId) {
    const resultImg = document.getElementById('detailResult');
    if (resultImg && resultImg.complete) {
        resultImg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        resultImg.style.boxShadow = '0 0 0 3px #10b981';
        setTimeout(() => {
            resultImg.style.boxShadow = '';
        }, 2000);
    }
}

function openImage(src) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.style.display = 'block';
    modalImg.src = src;
}

function closeModal() {
    document.getElementById('imageModal').style.display = 'none';
}

async function loadAllHistory() {
    try {
        const response = await fetch('/api/history');
        const data = await response.json();

        if (data.success && data.scans && data.scans.length > 0) {
            allScans = data.scans;
            createChart(allScans);
            renderTimeline(allScans);
        } else {
            showNoDataMessage();
        }
    } catch (err) {
        console.error('Ошибка загрузки истории:', err);
        showError('Ошибка загрузки данных');
    }
}

function createChart(scans) {
    const ctx = document.getElementById('wrinkleChart').getContext('2d');

    const labels = scans.map(s => s.scan_date.split(' ')[0]);
    const values = scans.map(s => s.wrinkle_percent);

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Процент морщин',
                data: values,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: 'white', font: { size: 14 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Морщины: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: { color: 'white', callback: value => value + '%' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Процент морщин', color: 'white' }
                },
                x: {
                    ticks: { color: 'white', rotate: 45, maxRotation: 45, minRotation: 45 },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Дата анализа', color: 'white' }
                }
            }
        }
    });
}

function renderTimeline(scans) {
    const timeline = document.getElementById('timeline');

    if (scans.length === 0) {
        timeline.innerHTML = '<div class="empty-scans">Нет анализов. Сделайте первый снимок!</div>';
        return;
    }

    timeline.innerHTML = scans.map((scan, index) => `
        <div class="timeline-item">
            <div class="timeline-date" onclick="toggleTimeline(${index})">
                <span>📅 ${scan.scan_date}</span>
                <span>Морщины: ${scan.wrinkle_percent}%</span>
                <span>🔬 ${scan.wrinkle_count} морщин</span>
                <span>${index < scans.length - 1 ? '📊' : '📌'}</span>
            </div>
            <div class="timeline-content" id="timeline-content-${index}">
                <div class="comparison-images">
                    <div class="comparison-img">
                        <p>Оригинал</p>
                        <img src="${scan.original_url}" alt="Original" onclick="openImage('${scan.original_url}')">
                    </div>
                    <div class="comparison-img">
                        <p>Результат анализа</p>
                        <img src="${scan.result_url}" alt="Result" onclick="openImage('${scan.result_url}')">
                    </div>
                </div>
                <div style="margin-top: 15px; text-align: center;">
                    <button class="tab-btn" onclick="viewScanDetail('${scan.folder}')">🔍 Детальный анализ</button>
                </div>
            </div>
        </div>
    `).join('');
}

function viewScanDetail(folder) {
    if (!folder) {
        console.error('No folder provided');
        return;
    }
    window.location.href = `/history?scan=${folder}`;
}

function toggleTimeline(index) {
    const content = document.getElementById(`timeline-content-${index}`);
    const allContents = document.querySelectorAll('.timeline-content');

    allContents.forEach(c => {
        if (c.id !== `timeline-content-${index}`) {
            c.classList.remove('active');
        }
    });

    content.classList.toggle('active');
}

function showAllHistory() {
    document.getElementById('scanDetail').style.display = 'none';
    document.getElementById('allHistory').style.display = 'block';
    loadAllHistory();
}

function showNoDataMessage() {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '<div class="empty-scans">Нет анализов. Сделайте первый снимок!</div>';
}

function showError(message) {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = `<div class="empty-scans" style="color: #f87171;">❌ ${message}</div>`;
}