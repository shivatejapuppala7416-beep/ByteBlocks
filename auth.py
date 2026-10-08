import bcrypt
import mysql.connector
from flask import Blueprint, request, jsonify

from database.db import get_connection

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    mobile = (data.get("mobile") or "").strip()
    password = data.get("password") or ""

    if not name or not mobile or not password:
        return jsonify({"error": "All fields are required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            "INSERT INTO users (name, mobile, password_hash) VALUES (%s, %s, %s)",
            (name, mobile, password_hash),
        )
        connection.commit()
        return jsonify({"message": "Registration successful"}), 201

    except mysql.connector.errors.IntegrityError:
        connection.rollback()
        return jsonify({"error": "Mobile number already registered"}), 409

    except Exception:
        connection.rollback()
        return jsonify({"error": "Registration failed"}), 500

    finally:
        cursor.close()
        connection.close()


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    mobile = (data.get("mobile") or "").strip()
    password = data.get("password") or ""

    if not mobile or not password:
        return jsonify({"error": "Mobile and password are required"}), 400

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("SELECT * FROM users WHERE mobile = %s", (mobile,))
        user = cursor.fetchone()
    finally:
        cursor.close()
        connection.close()

    if not user or not bcrypt.checkpw(
        password.encode("utf-8"), user["password_hash"].encode("utf-8")
    ):
        return jsonify({"error": "Invalid mobile or password"}), 401

    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "mobile": user["mobile"],
            "wallet_address": user["wallet_address"],
        },
    }), 200
