# (id, name, fee fraction, exchange rate, minutes)
ROUTES = [
    ("direct", "Direct Stablecoin", 0.010, 83.00, 2),
    ("swap_transfer", "Swap + Transfer", 0.015, 83.40, 5),
    ("liquidity_pool", "Liquidity Pool", 0.006, 82.90, 3),
]


def calculate_routes(amount, destination):
    routes = []
    for rid, name, pct, rate, minutes in ROUTES:
        fee = amount * pct
        routes.append({
            "id": rid,
            "name": name,
            "fee": round(fee, 4),
            "exchange_rate": rate,
            "estimated_minutes": minutes,
            "receive_amount": round((amount - fee) * rate, 2),
        })
    return routes
