def _low_is_better(value, lo, hi):
    return 1.0 if hi == lo else (hi - value) / (hi - lo)


def _high_is_better(value, lo, hi):
    return 1.0 if hi == lo else (value - lo) / (hi - lo)


def recommend_route(routes):
    if not routes:
        raise ValueError("No routes provided")

    try:
        fees = [float(r["fee"]) for r in routes]
        rates = [float(r["exchange_rate"]) for r in routes]
        times = [float(r["estimated_minutes"]) for r in routes]
        for r in routes:
            r["id"], r["name"]
    except (KeyError, TypeError, ValueError):
        raise ValueError(
            "Each route needs id, name, fee, exchange_rate and estimated_minutes"
        )

    scored = []
    for route, fee, rate, mins in zip(routes, fees, rates, times):
        score = (
            _low_is_better(fee, min(fees), max(fees)) * 0.50
            + _high_is_better(rate, min(rates), max(rates)) * 0.30
            + _low_is_better(mins, min(times), max(times)) * 0.20
        )
        scored.append((score, route))

    best_score, best = max(scored, key=lambda s: s[0])

    reason = (
        f"{best['name']} is recommended because it offers the best balance of "
        f"transfer fee ({best['fee']}), exchange rate ({best['exchange_rate']}) "
        f"and processing time ({best['estimated_minutes']} minutes)."
    )

    return {
        "recommended_route_id": best["id"],
        "recommended_route": best["name"],
        "reason": reason,
        "score": round(best_score, 4),
    }
