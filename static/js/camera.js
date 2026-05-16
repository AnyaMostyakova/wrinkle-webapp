// camera.js - скрипт для страницы камеры
let video = null;
let canvas = null;
let ctx = null;
let faceMesh = null;
let stream = null;
let capturedImageBlob = null;
let animationId = null;
let isModelLoaded = false;

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

const TARGET_ELLIPSE = {
    centerX: VIDEO_WIDTH / 2,
    centerY: VIDEO_HEIGHT / 2,
    radiusX: 150,
    radiusY: 180
};

const FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

const LEFT_EYE_INDICES = [33, 133, 157, 158, 159, 160, 161, 173];
const RIGHT_EYE_INDICES = [362, 263, 387, 386, 385, 384, 398, 466];
const NOSE_TIP = [1, 2, 98, 327];
const LIPS_INDICES = [61, 291, 13, 14, 17, 18, 78, 308];

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await initCamera();
    initFaceMesh();
}

async function initCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: VIDEO_WIDTH },
                height: { ideal: VIDEO_HEIGHT },
                facingMode: 'user'
            }
        });

        video = document.getElementById('videoElement');
        canvas = document.getElementById('overlayCanvas');
        ctx = canvas.getContext('2d');

        video.srcObject = stream;

        video.onloadedmetadata = () => {
            video.play();

            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            } else {
                canvas.width = VIDEO_WIDTH;
                canvas.height = VIDEO_HEIGHT;
            }

            startDetectionLoop();
            updateStatus('ready', '✅ Камера готова', 'info');
        };
    } catch (err) {
        updateStatus('error', '❌ Нет доступа к камере', 'error');
    }
}

function initFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onResults);
    updateStatus('loading', '🔄 Загрузка нейросети...', 'info');
}

function startDetectionLoop() {
    async function detect() {
        if (video && video.readyState === video.HAVE_ENOUGH_DATA && faceMesh) {
            try {
                await faceMesh.send({ image: video });
            } catch (err) {}
        }
        animationId = requestAnimationFrame(detect);
    }
    detect();
}

function onResults(results) {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTargetEllipse();

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        drawFaceOval(landmarks);
        drawEyes(landmarks);
        drawNose(landmarks);
        drawLips(landmarks);

        const positionStatus = checkFacePosition(landmarks);
        const captureBtn = document.getElementById('captureBtn');

        if (positionStatus.isGood) {
            captureBtn.disabled = false;
            updateStatus('good', positionStatus.message, 'success');
        } else {
            captureBtn.disabled = true;
            updateStatus('warning', positionStatus.message, 'warning');
        }

        if (!isModelLoaded) {
            isModelLoaded = true;
            updateStatus('ready', '✅ Нейросеть готова!', 'success');
        }
    } else {
        document.getElementById('captureBtn').disabled = true;
        if (isModelLoaded) {
            updateStatus('warning', '⚠️ Лицо не обнаружено', 'warning');
        }
    }
}

function drawTargetEllipse() {
    const isMobile = window.innerWidth <= 768;

    const centerX = isMobile ? canvas.width / 2 : TARGET_ELLIPSE.centerX;
    const centerY = isMobile ? canvas.height / 2 : TARGET_ELLIPSE.centerY;

    let radiusX, radiusY;

    if (isMobile) {
        radiusX = canvas.width * 0.32;
        radiusY = canvas.height * 0.38;
    } else {
        radiusX = 150;
        radiusY = 180;
    }

    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);

    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

    ctx.stroke();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.fill();
    ctx.setLineDash([]);
}

function drawFaceOval(landmarks) {
    const isMobile = window.innerWidth <= 768;
    const width = isMobile ? canvas.width : VIDEO_WIDTH;
    const height = isMobile ? canvas.height : VIDEO_HEIGHT;

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;

    for (let i = 0; i < FACE_OVAL.length; i++) {
        const point = landmarks[FACE_OVAL[i]];
        if (point) {
            const x = point.x * width;
            const y = point.y * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
    ctx.stroke();
}

function drawEyes(landmarks) {
    const isMobile = window.innerWidth <= 768;
    const width = isMobile ? canvas.width : VIDEO_WIDTH;
    const height = isMobile ? canvas.height : VIDEO_HEIGHT;

    ctx.fillStyle = '#f59e0b';
    [...LEFT_EYE_INDICES, ...RIGHT_EYE_INDICES].forEach(idx => {
        const point = landmarks[idx];
        if (point) {
            const x = point.x * width;
            const y = point.y * height;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
    });
}

function drawNose(landmarks) {
    const isMobile = window.innerWidth <= 768;
    const width = isMobile ? canvas.width : VIDEO_WIDTH;
    const height = isMobile ? canvas.height : VIDEO_HEIGHT;

    ctx.fillStyle = '#ef4444';
    NOSE_TIP.forEach(idx => {
        const point = landmarks[idx];
        if (point) {
            const x = point.x * width;
            const y = point.y * height;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    });
}

function drawLips(landmarks) {
    const isMobile = window.innerWidth <= 768;
    const width = isMobile ? canvas.width : VIDEO_WIDTH;
    const height = isMobile ? canvas.height : VIDEO_HEIGHT;

    ctx.fillStyle = '#ec489a';
    LIPS_INDICES.forEach(idx => {
        const point = landmarks[idx];
        if (point) {
            const x = point.x * width;
            const y = point.y * height;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
    });
}

function checkFacePosition(landmarks) {
    const isMobile = window.innerWidth <= 768;
    const width = isMobile ? canvas.width : VIDEO_WIDTH;
    const height = isMobile ? canvas.height : VIDEO_HEIGHT;

    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const nose = landmarks[1];
    const chin = landmarks[152];

    if (!leftEye || !rightEye || !nose || !chin) {
        return { isGood: false, message: '⚠️ Не удалось определить положение' };
    }

    const eyeYDiff = Math.abs(leftEye.y - rightEye.y);
    if (eyeYDiff > 0.03) {
        return { isGood: false, message: '🔄 Поверните голову прямо' };
    }

    const faceHeight = Math.abs(chin.y - nose.y);
    if (faceHeight < 0.22) {
        return { isGood: false, message: '📱 Приблизьтесь к камере' };
    }
    if (faceHeight > 0.4) {
        return { isGood: false, message: '📱 Отодвиньтесь от камере' };
    }

    const faceCenterX = (leftEye.x + rightEye.x) / 2;
    if (Math.abs(faceCenterX - 0.5) > 0.1) {
        return { isGood: false, message: '⬅️ Расположите лицо по центру ➡️' };
    }

    const faceCenterY = nose.y;
    if (Math.abs(faceCenterY - 0.5) > 0.1) {
        return { isGood: false, message: '⬆️ Расположите лицо по центру ⬇️' };
    }

    return { isGood: true, message: '✅ Идеально! Можно делать снимок' };
}

function updateStatus(code, message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

async function capturePhoto() {
    if (!video || video.videoWidth === 0) {
        updateStatus('error', 'Камера не готова', 'error');
        return;
    }

    const isMobile = window.innerWidth <= 768;
    const captureWidth = isMobile ? canvas.width : VIDEO_WIDTH;
    const captureHeight = isMobile ? canvas.height : VIDEO_HEIGHT;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = captureWidth;
    tempCanvas.height = captureHeight;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.save();
    tempCtx.translate(captureWidth, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0, captureWidth, captureHeight);
    tempCtx.restore();

    capturedImageBlob = await new Promise(resolve => {
        tempCanvas.toBlob(resolve, 'image/jpeg', 0.95);
    });

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImage').src = e.target.result;
        document.getElementById('previewSection').classList.add('active');
        document.querySelector('.camera-card').style.display = 'none';
        updateStatus('captured', '📸 Снимок сохранен!', 'success');
    };
    reader.readAsDataURL(capturedImageBlob);
}

async function analyzePhoto() {
    if (!capturedImageBlob) {
        alert('Сначала сделайте снимок');
        return;
    }

    const formData = new FormData();
    formData.append('file', capturedImageBlob, 'photo.jpg');

    document.getElementById('loading').classList.remove('hidden');

    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('result').classList.add('active');

        document.getElementById('originalImage').src = data.original;
        document.getElementById('resultImage').src = data.result;
        document.getElementById('wrinklePercent').innerHTML =
            `📊 Уровень морщин: <strong style="color: #10b981; font-size: 1.5rem;">${data.wrinkle_percent.toFixed(2)}%</strong>`;
        document.getElementById('wrinkleBar').style.width = data.wrinkle_percent + '%';
    } catch (err) {
        alert('Ошибка при анализе');
        document.getElementById('loading').classList.add('hidden');
    }
}

function retakePhoto() {
    capturedImageBlob = null;
    document.getElementById('previewSection').classList.remove('active');
    document.querySelector('.camera-card').style.display = 'block';
    document.getElementById('result').classList.remove('active');
    updateStatus('ready', '📸 Расположите лицо в зеленом овале', 'info');
}

function downloadResult() {
    const link = document.createElement('a');
    link.download = 'skin_analysis_result.png';
    link.href = document.getElementById('resultImage').src;
    link.click();
}

document.getElementById('captureBtn').addEventListener('click', capturePhoto);
document.getElementById('analyzeBtn').addEventListener('click', analyzePhoto);
document.getElementById('retakeBtn').addEventListener('click', retakePhoto);
document.getElementById('saveBtn').addEventListener('click', downloadResult);

window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
});
