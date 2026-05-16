// index.js - скрипт для страницы загрузки фото
let currentImageFile = null;

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        currentImageFile = file;
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('previewImage').src = event.target.result;
            document.getElementById('previewBox').classList.remove('hidden');
            document.getElementById('analyzeBtn').disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('analyzeBtn').addEventListener('click', async function() {
    if (!currentImageFile) return;

    const formData = new FormData();
    formData.append('file', currentImageFile);

    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('analyzeBtn').disabled = true;

    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('result').classList.remove('hidden');

        document.getElementById('originalImage').src = data.original;
        document.getElementById('resultImage').src = data.result;
        document.getElementById('wrinklePercent').innerHTML =
            `📊 Уровень морщин: <strong style="color: #10b981; font-size: 1.5rem;">${data.wrinkle_percent.toFixed(2)}%</strong>`;
        document.getElementById('wrinkleBar').style.width = data.wrinkle_percent + '%';
    } catch (err) {
        alert('Ошибка при анализе');
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('analyzeBtn').disabled = false;
    }
});

function resetAnalysis() {
    document.getElementById('result').classList.add('hidden');
    document.getElementById('previewBox').classList.add('hidden');
    document.getElementById('fileInput').value = '';
    currentImageFile = null;
    document.getElementById('analyzeBtn').disabled = true;
    document.getElementById('wrinkleBar').style.width = '0%';
}

function downloadResult() {
    const link = document.createElement('a');
    link.download = 'skin_analysis_result.png';
    link.href = document.getElementById('resultImage').src;
    link.click();
}