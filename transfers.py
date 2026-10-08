import re
import traceback
from decimal import Decimal, InvalidOperation

import mysql.connector
from flask import Blueprint, g, jsonify, request
from mysql.connector import errorcode
from web3.exceptions import TransactionNotFound

from auth_utils import require_auth
from database.db import get_connection
from services.ai_service import recommend_route
from services.blockchain_service import get_transaction
from services.route_service import calculate_routes

transfers_bp = Blueprint("transfers", __name__)

HASH = re.compile(r"^0x[0-9a-fA-F]{64}$")
ADDR = re.compile(r"^0x[0-9a-fA-F]{40}$")


def _positive_decimal(value, max_places):
    """Parse a finite Decimal > 0 with at most max_places decimals, else None."""
    try:
        d = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None
    if not d.is_finite() or d <= 0:
        return None
    if d.as_tuple().exponent < -max_places:
        return None
    return d


def _money(value):
    return Decimal(str(value))



@transfers_bp.post("/create")
@require_auth
def create_transfer():
    d = request.get_json(silent=True) or {}

    tx_hash = str(d.get("transaction_hash") or "").strip().lower()
    sender = str(d.get("sender_wallet") or "").strip()
    recipient = str(d.get("recipient_wallet") or "").strip()
    destination = str(d.get("destination") or "").strip()
    route_id = str(d.get("route_id") or "").strip()

    if not HASH.match(tx_hash):
        return jsonify({"error": "Invalid transaction hash"}), 400
    if not ADDR.match(sender) or not ADDR.match(recipient):
        return jsonify({"error": "Invalid wallet address"}), 400
    if not destination:
        return jsonify({"error": "Destination is required"}), 400
    if not route_id:
        return jsonify({"error": "route_id is required"}), 400

    amount = _positive_decimal(d.get("amount"), 6)
    if amount is None:
        return jsonify({"error": "Amount must be a positive number"}), 400

    amount_eth = _positive_decimal(d.get("amount_eth"), 18)
    if amount_eth is None:
        return jsonify({"error": "amount_eth must be a positive number"}), 400

    routes = calculate_routes(float(amount), destination)
    chosen = next((r for r in routes if r["id"] == route_id), None)
    if chosen is None:
        return jsonify({"error": "Unknown route"}), 400

    recommendation = recommend_route(routes)
    ai_reason = (
        recommendation["reason"]
        if recommendation["recommended_route_id"] == chosen["id"]
        else ""
    )

    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO transfers
            (user_id, sender_wallet, recipient_wallet, amount, amount_eth,
             destination, selected_route, fee, exchange_rate,
             estimated_minutes, amount_received, ai_reason,
             transaction_hash, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDING')
            """,
            (
                g.user_id,
                sender,
                recipient,
                amount,
                amount_eth,
                destination,
                chosen["name"],
                _money(chosen["fee"]),
                _money(chosen["exchange_rate"]),
                chosen["estimated_minutes"],
                _money(chosen["receive_amount"]),
                ai_reason,
                tx_hash,
            ),
        )
        conn.commit()
        return jsonify({
            "success": True,
            "transfer_id": cur.lastrowid,
            "transaction_hash": tx_hash,
            "status": "PENDING",
        }), 201

    except mysql.connector.errors.IntegrityError as e:
        conn.rollback()
        if e.errno == errorcode.ER_DUP_ENTRY:
            return jsonify({"error": "This transaction is already recorded"}), 409
        return jsonify({"error": "Could not save transfer"}), 400

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not save transfer"}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# ------------------------------------------------------------------
# SYNC  -  copy the on-chain result into the transfers row
# ------------------------------------------------------------------
@transfers_bp.post("/<tx_hash>/sync")
@require_auth
def sync_transfer(tx_hash):
    tx_hash = tx_hash.strip().lower()
    if not HASH.match(tx_hash):
        return jsonify({"error": "Invalid transaction hash"}), 400

    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)

        # only the owner may sync their own transfer
        cur.execute(
            "SELECT id, sender_wallet FROM transfers "
            "WHERE transaction_hash = %s AND user_id = %s",
            (tx_hash, g.user_id),
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Transfer not found"}), 404

        try:
            info = get_transaction(tx_hash)
        except TransactionNotFound:
            return jsonify({"status": "PENDING"}), 202
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "Could not reach the blockchain node"}), 502

        if info["from"].lower() != row["sender_wallet"].lower():
            return jsonify({"error": "Sender does not match the on-chain transaction"}), 409

        cur.execute(
            "UPDATE transfers SET status = %s, block_number = %s WHERE id = %s",
            (info["status"], info["block_number"], row["id"]),
        )
        conn.commit()
        return jsonify(info), 200

    except Exception:
        if conn:
            conn.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not sync transfer"}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# ------------------------------------------------------------------
# LIST  -  the caller's own history (id comes from the token)
# ------------------------------------------------------------------
@transfers_bp.get("/mine")
@require_auth
def my_transfers():
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            SELECT transaction_hash, sender_wallet, recipient_wallet,
                   amount, amount_eth, destination, selected_route,
                   fee, amount_received, status, block_number
            FROM transfers WHERE user_id = %s
            ORDER BY id DESC LIMIT 50
            """,
            (g.user_id,),
        )
        rows = [
            {k: (v if v is None or isinstance(v, (int, str)) else str(v))
             for k, v in r.items()}
            for r in cur.fetchall()
        ]
        return jsonify({"transfers": rows}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not load transfers"}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()
