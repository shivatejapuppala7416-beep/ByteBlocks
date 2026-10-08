import re
import traceback

from flask import Blueprint, jsonify
from web3.exceptions import TransactionNotFound

from services.blockchain_service import get_transaction

blockchain_bp = Blueprint("blockchain", __name__)

TX_HASH = re.compile(r"^0x[0-9a-fA-F]{64}$")


@blockchain_bp.get("/transaction/<tx_hash>")
def transaction(tx_hash):
    if not TX_HASH.match(tx_hash):
        return jsonify({"error": "Invalid transaction hash"}), 400

    try:
        return jsonify(get_transaction(tx_hash)), 200
    except TransactionNotFound:
        return jsonify({"error": "Transaction not found or still pending"}), 404
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Blockchain lookup failed: " + type(e).__name__}), 502
