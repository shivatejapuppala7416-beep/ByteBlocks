import math

from flask import Blueprint, request, jsonify

from services.route_service import calculate_routes

remittance_bp = Blueprint("remittance", __name__)


@remittance_bp.post("/compare")
def compare_routes():
    data = request.get_json(silent=True) or {}

    try:
        amount = float(data.get("amount"))
    except (TypeError, ValueError):
        return jsonify({"error": "Amount must be a number"}), 400

    if not math.isfinite(amount) or amount <= 0:
        return jsonify({"error": "Amount must be greater than 0"}), 400

    destination = (data.get("destination") or "").strip()
    if not destination:
        return jsonify({"error": "Destination is required"}), 400

    return jsonify({
        "amount": amount,
        "destination": destination,
        "routes": calculate_routes(amount, destination),
    }), 200
