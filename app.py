from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect
import os
import cv2
import numpy as np
from flask_cors import CORS
import uuid
import traceback
import time
import json
from datetime import datetime

from inference import WrinkleDetector
from auth import register_user, login_user, get_user_profile, update_user_profile, get_user_scans

app = Flask(__name__)
CORS(app)
app.secret_key = 'your-secret-key-here-change-in-production-2024'

UPLOAD_FOLDER = "uploads"
STORAGE_PATH = "storage"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(os.path.join(STORAGE_PATH, "users"), exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

MODEL_PATH = "model/wrinkle_model_best.pt"

print("="*60)
print("🚀 ЗАПУСК ПРИЛОЖЕНИЯ")
print("="*60)

# Загрузка детектора
try:
    detector = WrinkleDetector(MODEL_PATH)
    print("✅ Детектор успешно загружен")
except Exception as e:
    print(f"❌ Ошибка загрузки детектора: {e}")
    detector = None

print("="*60)

# ==================== СТРАНИЦЫ ====================

@app.route("/")
def index():
    if "user" not in session:
        return redirect("/login")
    return render_template("index.html")

@app.route("/camera")
def camera():
    if "user" not in session:
        return redirect("/login")
    return render_template("camera.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        data = request.get_json()
        login = data.get("login")
        password = data.get("password")

        success, message = login_user(login, password)
        if success:
            session["user"] = login
            return jsonify({"success": True, "message": message})
        else:
            return jsonify({"success": False, "message": message})

    if "user" in session:
        return redirect("/dashboard")
    return render_template("login.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        data = request.get_json()
        login = data.get("login")
        password = data.get("password")

        success, message = register_user(login, password)
        if success:
            session["user"] = login
            return jsonify({"success": True, "message": message})
        else:
            return jsonify({"success": False, "message": message})

    if "user" in session:
        return redirect("/dashboard")
    return render_template("register.html")

@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect("/login")
    return render_template("dashboard.html", user=session["user"])

@app.route("/history")
def history():
    if "user" not in session:
        return redirect("/login")
    return render_template("history.html")

@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect("/login")

# ==================== API ====================

@app.route("/api/dashboard")
def api_dashboard():
    if "user" not in session:
        return jsonify({"success": False, "error": "Not authorized"}), 401

    user = session["user"]
    scans = get_user_scans(user)

    total_scans = len(scans)
    avg_wrinkles = 0
    last_scan = None

    if scans:
        wrinkle_percents = [s.get("wrinkle_percent", 0) for s in scans]
        avg_wrinkles = sum(wrinkle_percents) / len(wrinkle_percents)
        last_scan = scans[0].get("scan_date", "").split("T")[0] if scans[0].get("scan_date") else "—"

    recent_scans = []
    for scan in scans[:5]:
        recent_scans.append({
            "folder": scan.get("folder", ""),
            "scan_date": scan.get("scan_date", "").split("T")[0],
            "wrinkle_percent": round(scan.get("wrinkle_percent", 0), 1),
            "wrinkle_count": scan.get("total_wrinkles", 0)
        })

    return jsonify({
        "success": True,
        "totalScans": total_scans,
        "avgWrinkles": round(avg_wrinkles, 1),
        "lastScanDate": last_scan,
        "recentScans": recent_scans
    })

@app.route("/api/history")
def api_history():
    if "user" not in session:
        return jsonify({"success": False, "error": "Not authorized"}), 401

    user = session["user"]
    scans = get_user_scans(user)

    scans_data = []
    for scan in scans:
        scans_data.append({
            "scan_date": scan.get("scan_date", "").replace("T", " "),
            "wrinkle_percent": round(scan.get("wrinkle_percent", 0), 1),
            "wrinkle_count": scan.get("total_wrinkles", 0),
            "lighting_score": scan.get("lighting_score", 0),
            "folder": scan.get("folder", ""),  # <-- ДОБАВЬТЕ ЭТУ СТРОКУ
            "original_url": f"/user_scan/{user}/{scan.get('folder', '')}/original.jpg",
            "result_url": f"/user_scan/{user}/{scan.get('folder', '')}/result.jpg"
        })

    return jsonify({
        "success": True,
        "scans": scans_data
    })

@app.route("/api/scan_detail", methods=["POST"])
def api_scan_detail():
    if "user" not in session:
        return jsonify({"success": False, "error": "Not authorized"}), 401

    data = request.get_json()
    folder = data.get("folder")
    user = session["user"]

    scan_path = os.path.join(STORAGE_PATH, "users", user, "scans", folder)
    info_path = os.path.join(scan_path, "info.json")

    if not os.path.exists(info_path):
        return jsonify({"success": False, "error": "Scan not found"}), 404

    with open(info_path, "r", encoding="utf-8") as f:
        info = json.load(f)

    return jsonify({
        "success": True,
        "scan_date": info.get("scan_date", "").replace("T", " "),
        "wrinkle_percent": round(info.get("wrinkle_percent", 0), 1),
        "wrinkle_count": info.get("total_wrinkles", 0),
        "lighting_score": info.get("lighting_score", 0),
        "original_url": f"/user_scan/{user}/{folder}/original.jpg",
        "result_url": f"/user_scan/{user}/{folder}/result.jpg",
        "detailed_analysis": info.get("detailed_analysis", {})
    })

@app.route("/user_scan/<user>/<folder>/<filename>")
def user_scan_file(user, folder, filename):
    if "user" not in session:
        return redirect("/login")

    if session["user"] != user:
        return "Access denied", 403

    file_path = os.path.join(STORAGE_PATH, "users", user, "scans", folder, filename)
    return send_from_directory(os.path.dirname(file_path), filename)

# ==================== АНАЛИЗ ====================

@app.route("/analyze", methods=["POST"])
def analyze():
    if "user" not in session:
        return jsonify({"error": "Не авторизован"}), 401

    start_time = time.time()
    user = session["user"]

    try:
        if detector is None:
            return jsonify({"error": "Детектор не загружен"}), 500

        if 'file' not in request.files:
            return jsonify({"error": "Файл не загружен"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "Файл не выбран"}), 400

        file_bytes = file.read()
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"error": "Не удалось прочитать изображение"}), 500

        h, w = img.shape[:2]
        max_width = 800
        if w > max_width:
            scale = max_width / w
            new_w = int(w * scale)
            new_h = int(h * scale)
            img = cv2.resize(img, (new_w, new_h))

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Проверка освещения
        is_lighting_good, lighting_score, lighting_message = detector.check_lighting_quality(img_rgb)
        if not is_lighting_good:
            img_rgb = detector.auto_adjust_lighting(img_rgb)

        # АНАЛИЗ МОРЩИН
        mask, binary, wrinkle_percent = detector.predict(img_rgb)

        # ДЕТАЛЬНЫЙ АНАЛИЗ МОРЩИН
        detailed_analysis = detector.analyze_wrinkles_detailed(binary, img.shape)

        print(f"\n📊 ДЕТАЛЬНЫЙ АНАЛИЗ:")
        print(f"   - Всего морщин: {detailed_analysis['total_count']}")
        print(f"   - Слабо выраженных: {detailed_analysis['severity_summary']['minor']}")
        print(f"   - Средне выраженных: {detailed_analysis['severity_summary']['moderate']}")
        print(f"   - Сильно выраженных: {detailed_analysis['severity_summary']['severe']}")

        # ВИЗУАЛИЗАЦИЯ
        result, skeleton = detector.create_training_like_visualization(img_rgb, mask, binary)

        # Добавляем ID морщин на результат
        for wrinkle in detailed_analysis["wrinkles"]:
            x1, y1, x2, y2 = wrinkle["bbox"]
            # Цвет в зависимости от выраженности
            if wrinkle["severity"] == "severe":
                color = (0, 0, 255)
            elif wrinkle["severity"] == "moderate":
                color = (0, 165, 255)
            else:
                color = (0, 255, 255)

            cv2.rectangle(result, (x1, y1), (x2, y2), color, 2)
            cv2.putText(result, f"#{wrinkle['id']}", (x1, y1 - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        h, w = result.shape[:2]
        cv2.putText(result, f"Lighting: {lighting_score}%", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(result, f"Wrinkles: {wrinkle_percent:.1f}%", (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # Сохранение в папку пользователя
        scan_folder = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        user_scan_path = os.path.join(STORAGE_PATH, "users", user, "scans", scan_folder)
        os.makedirs(user_scan_path, exist_ok=True)

        # Сохраняем изображения
        cv2.imwrite(os.path.join(user_scan_path, "original.jpg"), img)
        result_bgr = cv2.cvtColor(result, cv2.COLOR_RGB2BGR)
        cv2.imwrite(os.path.join(user_scan_path, "result.jpg"), result_bgr)

        # Сохраняем информацию с детальным анализом
        scan_info = {
            "scan_date": datetime.now().isoformat(),
            "total_wrinkles": detailed_analysis["total_count"],
            "wrinkle_percent": float(wrinkle_percent),
            "lighting_score": lighting_score,
            "detailed_analysis": {
                "total_count": detailed_analysis["total_count"],
                "total_length": detailed_analysis["total_length"],
                "severity_summary": detailed_analysis["severity_summary"],
                "wrinkles": detailed_analysis["wrinkles"],
                "zones": detailed_analysis["zones"]
            }
        }

        with open(os.path.join(user_scan_path, "info.json"), "w", encoding="utf-8") as f:
            json.dump(scan_info, f, indent=2, ensure_ascii=False)

        # Обновляем профиль
        scans = get_user_scans(user)
        update_user_profile(user, total_scans=len(scans), last_scan=datetime.now().isoformat())

        # Временные файлы для ответа
        unique_id = str(uuid.uuid4())[:8]
        original_filename = f"original_{unique_id}.jpg"
        result_filename = f"result_{unique_id}.jpg"

        original_path = os.path.join(app.config['UPLOAD_FOLDER'], original_filename)
        result_path = os.path.join(app.config['UPLOAD_FOLDER'], result_filename)

        cv2.imwrite(original_path, img)
        cv2.imwrite(result_path, result_bgr)

        response = {
            "original": f"/uploads/{original_filename}",
            "result": f"/uploads/{result_filename}",
            "wrinkle_percent": float(wrinkle_percent),
            "wrinkles_count": detailed_analysis["total_count"],
            "lighting_score": lighting_score,
            "lighting_message": lighting_message,
            "severity_summary": detailed_analysis["severity_summary"]
        }

        return jsonify(response)

    except Exception as e:
        print(f"Ошибка: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == "__main__":
    import socket

    port = 5000
    for p in range(5000, 5010):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('0.0.0.0', p))
                port = p
                break
            except OSError:
                continue

    print(f"\n🚀 Сервер запущен на http://127.0.0.1:{port}")
    print(f"📱 http://192.168.0.108:{port}")
    print("="*60)

    app.run(host='0.0.0.0', port=port, debug=True)