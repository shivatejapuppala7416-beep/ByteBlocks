import os

from flask import Flask
from flask_cors import CORS

from auth import auth_bp
from remittance import remittance_bp
from ai import ai_bp
from blockchain import blockchain_bp
from transfers import transfers_bp

from services.blockchain_service import is_connected


app = Flask(__name__)

CORS(app)


# ==============================
# API ROUTES
# ==============================

app.register_blueprint(
    auth_bp,
    url_prefix="/api/auth"
)

app.register_blueprint(
    remittance_bp,
    url_prefix="/api/remittance"
)

app.register_blueprint(
    ai_bp,
    url_prefix="/api/ai"
)

app.register_blueprint(
    blockchain_bp,
    url_prefix="/api/blockchain"
)

# ðŸ”¥ THIS WAS MISSING
app.register_blueprint(
    transfers_bp,
    url_prefix="/api/transfers"
)


# ==============================
# HOME
# ==============================

@app.get("/")
def home():
    return {
        "message": "RemitAI backend is running"
    }


# ==============================
# HEALTH
# ==============================

@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "RemitAI Backend",
        "blockchain_connected": is_connected()
    }


# ==============================
# START SERVER
# ==============================

from transactions import transactions_bp
app.register_blueprint(transactions_bp, url_prefix="/api/transactions")
if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
