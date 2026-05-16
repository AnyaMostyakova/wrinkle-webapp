import cv2
import numpy as np
from skimage.measure import regionprops

class WrinkleAnalyzer:
    """Класс для детального анализа морщин"""

    # Определение зон лица (относительные координаты)
    FACE_ZONES = {
        "forehead": {
            "name": "Лоб",
            "y_range": (0.0, 0.35),  # верхняя часть лица
            "weight": 1.0
        },
        "glabella": {
            "name": "Межбровье",
            "y_range": (0.35, 0.45),
            "x_range": (0.4, 0.6),
            "weight": 1.5
        },
        "left_eye": {
            "name": "Левый глаз (гусиные лапки)",
            "y_range": (0.4, 0.55),
            "x_range": (0.0, 0.3),
            "weight": 1.3
        },
        "right_eye": {
            "name": "Правый глаз (гусиные лапки)",
            "y_range": (0.4, 0.55),
            "x_range": (0.7, 1.0),
            "weight": 1.3
        },
        "nasolabial_left": {
            "name": "Носогубная складка (левая)",
            "y_range": (0.55, 0.75),
            "x_range": (0.3, 0.45),
            "weight": 1.2
        },
        "nasolabial_right": {
            "name": "Носогубная складка (правая)",
            "y_range": (0.55, 0.75),
            "x_range": (0.55, 0.7),
            "weight": 1.2
        },
        "left_cheek": {
            "name": "Левая щека",
            "y_range": (0.5, 0.75),
            "x_range": (0.15, 0.35),
            "weight": 0.8
        },
        "right_cheek": {
            "name": "Правая щека",
            "y_range": (0.5, 0.75),
            "x_range": (0.65, 0.85),
            "weight": 0.8
        },
        "chin": {
            "name": "Подбородок",
            "y_range": (0.75, 1.0),
            "weight": 0.9
        }
    }

    @staticmethod
    def analyze_wrinkles(binary_mask, original_shape):
        """
        Анализ всех морщин на изображении

        Args:
            binary_mask: бинарная маска морщин
            original_shape: размер исходного изображения (h, w)

        Returns:
            dict: детальная информация о морщинах
        """
        if binary_mask is None or binary_mask.sum() == 0:
            return {
                "total_count": 0,
                "total_length": 0,
                "total_area": 0,
                "wrinkles": [],
                "zones": {}
            }

        # Убеждаемся, что маска бинарная
        if binary_mask.dtype != np.uint8:
            binary_mask = (binary_mask > 0).astype(np.uint8) * 255

        # Находим connected components
        num_labels, labels = cv2.connectedComponents(binary_mask)

        h, w = original_shape[:2]
        wrinkles = []

        # Анализ каждой морщины
        for label_id in range(1, num_labels):
            # Создаем маску текущей морщины
            wrinkle_mask = (labels == label_id).astype(np.uint8) * 255

            # Пропускаем слишком маленькие (шум)
            if wrinkle_mask.sum() < 50:
                continue

            # Получаем свойства региона
            props = regionprops(wrinkle_mask)
            if not props:
                continue

            prop = props[0]

            # Вычисляем параметры морщины
            length = WrinkleAnalyzer._calculate_wrinkle_length(wrinkle_mask)
            width = WrinkleAnalyzer._calculate_wrinkle_width(wrinkle_mask)
            angle = WrinkleAnalyzer._calculate_wrinkle_angle(wrinkle_mask)
            zone = WrinkleAnalyzer._determine_zone(prop.centroid, h, w)

            # Оценка выраженности
            severity_score = WrinkleAnalyzer._calculate_severity(length, width, wrinkle_mask.sum())

            wrinkle_info = {
                "id": label_id,
                "zone": zone,
                "zone_name": WrinkleAnalyzer.FACE_ZONES.get(zone, {}).get("name", zone),
                "length_px": round(length, 1),
                "length_mm": round(length * 0.264, 1),  # примерное преобразование в мм
                "width_px": round(width, 2),
                "width_mm": round(width * 0.264, 2),
                "angle_deg": round(angle, 1),
                "area_px": int(wrinkle_mask.sum()),
                "center_x": int(prop.centroid[1]),
                "center_y": int(prop.centroid[0]),
                "severity": severity_score["level"],
                "severity_score": severity_score["score"],
                "bbox": [int(prop.bbox[1]), int(prop.bbox[0]),
                        int(prop.bbox[3]), int(prop.bbox[2])]
            }

            wrinkles.append(wrinkle_info)

        # Сортируем по выраженности
        wrinkles.sort(key=lambda x: x["severity_score"], reverse=True)

        # Агрегируем по зонам
        zones_stats = WrinkleAnalyzer._aggregate_by_zones(wrinkles)

        return {
            "total_count": len(wrinkles),
            "total_length": sum(w["length_px"] for w in wrinkles),
            "total_area": sum(w["area_px"] for w in wrinkles),
            "wrinkles": wrinkles,
            "zones": zones_stats,
            "severity_summary": WrinkleAnalyzer._get_severity_summary(wrinkles)
        }

    @staticmethod
    def _calculate_wrinkle_length(mask):
        """Вычисление длины морщины через скелет"""
        from skimage.morphology import skeletonize

        skeleton = skeletonize(mask > 0).astype(np.uint8)
        length = np.sum(skeleton)
        return float(length)

    @staticmethod
    def _calculate_wrinkle_width(mask):
        """Вычисление средней ширины морщины"""
        area = np.sum(mask > 0)
        from skimage.morphology import skeletonize
        skeleton = skeletonize(mask > 0).astype(np.uint8)
        length = np.sum(skeleton)

        if length > 0:
            width = area / length
        else:
            width = 0

        return float(width)

    @staticmethod
    def _calculate_wrinkle_angle(mask):
        """Вычисление угла наклона морщины"""
        points = np.column_stack(np.where(mask > 0))

        if len(points) < 10:
            return 0

        # PCA для определения главной оси
        mean = np.mean(points, axis=0)
        centered = points - mean
        cov = np.cov(centered.T)

        try:
            eigenvalues, eigenvectors = np.linalg.eig(cov)
            main_axis = eigenvectors[:, np.argmax(eigenvalues)]
            angle = np.arctan2(main_axis[1], main_axis[0]) * 180 / np.pi
            return angle
        except:
            return 0

    @staticmethod
    def _determine_zone(centroid, h, w):
        """Определение зоны лица по координатам"""
        y_norm = centroid[0] / h
        x_norm = centroid[1] / w

        for zone_name, zone_info in WrinkleAnalyzer.FACE_ZONES.items():
            if "y_range" in zone_info:
                if not (zone_info["y_range"][0] <= y_norm <= zone_info["y_range"][1]):
                    continue

            if "x_range" in zone_info:
                if not (zone_info["x_range"][0] <= x_norm <= zone_info["x_range"][1]):
                    continue

            return zone_name

        return "other"

    @staticmethod
    def _calculate_severity(length, width, area):
        """Расчет оценки выраженности морщины"""
        # Комбинированная оценка на основе длины, ширины и площади
        length_score = min(100, length / 5)  # длина до 500px = 100 баллов
        width_score = min(100, width * 20)    # ширина до 5px = 100 баллов
        area_score = min(100, area / 50)      # площадь до 5000px = 100 баллов

        total_score = (length_score * 0.4 + width_score * 0.4 + area_score * 0.2)

        if total_score < 30:
            level = "minor"  # слабо выражена
        elif total_score < 60:
            level = "moderate"  # средне выражена
        else:
            level = "severe"  # сильно выражена

        return {
            "score": round(total_score, 1),
            "level": level
        }

    @staticmethod
    def _aggregate_by_zones(wrinkles):
        """Агрегация морщин по зонам"""
        zones_stats = {}

        for zone_name, zone_info in WrinkleAnalyzer.FACE_ZONES.items():
            zone_wrinkles = [w for w in wrinkles if w["zone"] == zone_name]

            if zone_wrinkles:
                zones_stats[zone_name] = {
                    "name": zone_info["name"],
                    "count": len(zone_wrinkles),
                    "total_length": sum(w["length_px"] for w in zone_wrinkles),
                    "avg_severity": sum(w["severity_score"] for w in zone_wrinkles) / len(zone_wrinkles),
                    "wrinkles": zone_wrinkles
                }
            else:
                zones_stats[zone_name] = {
                    "name": zone_info["name"],
                    "count": 0,
                    "total_length": 0,
                    "avg_severity": 0,
                    "wrinkles": []
                }

        return zones_stats

    @staticmethod
    def _get_severity_summary(wrinkles):
        """Сводка по выраженности морщин"""
        summary = {
            "minor": 0,
            "moderate": 0,
            "severe": 0
        }

        for w in wrinkles:
            summary[w["severity"]] += 1

        return summary

    @staticmethod
    def visualize_wrinkles(image, analysis, show_ids=True):
        """
        Визуализация морщин с ID и зонами
        """
        result = image.copy()
        h, w = result.shape[:2]

        for wrinkle in analysis["wrinkles"]:
            # Цвет в зависимости от выраженности
            if wrinkle["severity"] == "severe":
                color = (0, 0, 255)  # красный
            elif wrinkle["severity"] == "moderate":
                color = (0, 165, 255)  # оранжевый
            else:
                color = (0, 255, 255)  # желтый

            # Рисуем bounding box
            x1, y1, x2, y2 = wrinkle["bbox"]
            cv2.rectangle(result, (x1, y1), (x2, y2), color, 2)

            # Рисуем ID
            if show_ids:
                cv2.putText(result, f"#{wrinkle['id']}", (x1, y1 - 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            # Рисуем центр
            cv2.circle(result, (wrinkle["center_x"], wrinkle["center_y"]), 3, color, -1)

        return result