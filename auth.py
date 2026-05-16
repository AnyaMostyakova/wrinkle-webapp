import os
import json
import hashlib
from datetime import datetime

USERS_PATH = "storage/users"

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def register_user(login, password):
    user_path = os.path.join(USERS_PATH, login)

    if os.path.exists(user_path):
        return False, "Пользователь уже существует"

    if len(password) < 4:
        return False, "Пароль слишком короткий (минимум 4 символа)"

    os.makedirs(user_path)
    os.makedirs(os.path.join(user_path, "scans"))

    profile = {
        "login": login,
        "password_hash": hash_password(password),
        "created_at": datetime.now().isoformat(),
        "total_scans": 0,
        "last_scan": None
    }

    with open(os.path.join(user_path, "profile.json"), "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)

    return True, "Регистрация успешна"

def login_user(login, password):
    user_path = os.path.join(USERS_PATH, login)
    profile_path = os.path.join(user_path, "profile.json")

    if not os.path.exists(profile_path):
        return False, "Пользователь не найден"

    with open(profile_path, "r", encoding="utf-8") as f:
        profile = json.load(f)

    if profile["password_hash"] == hash_password(password):
        return True, "Вход выполнен"
    else:
        return False, "Неверный пароль"

def get_user_profile(login):
    profile_path = os.path.join(USERS_PATH, login, "profile.json")
    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def update_user_profile(login, **kwargs):
    profile_path = os.path.join(USERS_PATH, login, "profile.json")
    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            profile = json.load(f)

        profile.update(kwargs)

        with open(profile_path, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2, ensure_ascii=False)
        return True
    return False

def get_user_scans(login):
    scans_path = os.path.join(USERS_PATH, login, "scans")
    if not os.path.exists(scans_path):
        return []

    scans = []
    for scan_folder in sorted(os.listdir(scans_path), reverse=True):
        scan_info_path = os.path.join(scans_path, scan_folder, "info.json")
        if os.path.exists(scan_info_path):
            with open(scan_info_path, "r", encoding="utf-8") as f:
                info = json.load(f)
                info["folder"] = scan_folder
                scans.append(info)

    return scans