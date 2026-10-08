from flask import Blueprint, request, jsonify

from services.ai_service import recommend_route

ai_bp = Blueprint("ai", __name__)


@ai_bp.post("/recommend")
def recommend():
    data = request.get_json(silent=True) or {}
    routes = data.get("routes", [])

    if not routes:
        return jsonify({"error": "Routes are required"}), 400

    try:
        return jsonify(recommend_route(routes)), 200
    except ValueError as e:          # bad input -> client error
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "Could not generate a recommendation"}), 500
