import re
import traceback
from decimal import Decimal, InvalidOperation

import mysql.connector
from flask import Blueprint, request, jsonify
from web3.exceptions import TransactionNotFound

from database.db import get_connection
from services.blockchain_service import get_transaction

transactions_bp = Blueprint("transactions", __name__)

HASH = re.compile(r"^0x[0-9a-fA-F]{64}$")
ADDR = re.compile(r"^0x[0-9a-fA-F]{40}$")


@transactions_bp.post("/save")
def save_transaction():
    d = request.get_json(silent=True) or {}
    tx_hash = str(d.get("tx_hash") or "").strip().lower()
    from_addr = str(d.get("from_address") or "").strip()
    to_addr = str(d.get("to_address") or "").strip()

    if not HASH.match(tx_hash):
        return jsonify({"error": "Invalid transaction hash"}), 400
    if not ADDR.match(from_addr) or not ADDR.match(to_addr):
        return jsonify({"error": "Invalid wallet address"}), 400
    try:
        user_id = int(d.get("user_id"))
        amount = Decimal(str(d.get("amount_eth")))
    except (TypeError, ValueError, InvalidOperation):
        return jsonify({"error": "user_id and amount_eth are required"}), 400
    if not amount.is_finite() or amount <= 0:
        return jsonify({"error": "Amount must be greater than 0"}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO transactions
            (user_id, tx_hash, from_address, to_address, amount_eth, status)
            VALUES (%s, %s, %s, %s, %s, 'PENDING')
            ON DUPLICATE KEY UPDATE tx_hash = tx_hash
            """,
            (user_id, tx_hash, from_addr, to_addr, amount),
        )
        conn.commit()
        return jsonify({"message": "Transaction saved", "tx_hash": tx_hash}), 201
    except mysql.connector.errors.IntegrityError:
        conn.rollback()
        return jsonify({"error": "Unknown user_id (no matching row in users)"}), 400
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not save transaction: " + str(e)}), 500
    finally:
        cur.close()
        conn.close()


@transactions_bp.post("/sync/<tx_hash>")
def sync_transaction(tx_hash):
    tx_hash = tx_hash.strip().lower()
    if not HASH.match(tx_hash):
        return jsonify({"error": "Invalid transaction hash"}), 400

    try:
        info = get_transaction(tx_hash)
    except TransactionNotFound:
        return jsonify({"status": "PENDING"}), 202
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not reach the blockchain node"}), 502

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE transactions SET status = %s, block_number = %s WHERE tx_hash = %s",
            (info["status"], info["block_number"], tx_hash),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()
    return jsonify(info), 200


@transactions_bp.get("/user/<int:user_id>")
def list_transactions(user_id):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """
            SELECT tx_hash, from_address, to_address, amount_eth,
                   status, block_number, created_at
            FROM transactions WHERE user_id = %s
            ORDER BY id DESC LIMIT 50
            """,
            (user_id,),
        )
        rows = [{k: (v if v is None or isinstance(v, (int, str)) else str(v))
                 for k, v in r.items()} for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()
    return jsonify({"transactions": rows}), 200
