import pytest
from services.ai_service import recommend_route

ROUTES = [
    {"id": "direct", "name": "Direct", "fee": 1.0, "exchange_rate": 83.0, "estimated_minutes": 2},
    {"id": "swap", "name": "Swap", "fee": 1.5, "exchange_rate": 83.4, "estimated_minutes": 5},
    {"id": "pool", "name": "Pool", "fee": 0.6, "exchange_rate": 82.9, "estimated_minutes": 3},
]


def test_picks_best_route():
    assert recommend_route(ROUTES)["recommended_route_id"] == "pool"


def test_single_route():
    assert recommend_route(ROUTES[:1])["recommended_route_id"] == "direct"


def test_zero_fee_and_time_do_not_crash():
    r = [{"id": "a", "name": "A", "fee": 0, "exchange_rate": 1, "estimated_minutes": 0}]
    assert recommend_route(r)["score"] == 1.0


def test_identical_routes_pick_first():
    twin = dict(ROUTES[0], id="twin")
    assert recommend_route([ROUTES[0], twin])["recommended_route_id"] == "direct"


@pytest.mark.parametrize("bad", [[], [{"id": "x", "name": "X"}]])
def test_invalid_input_raises(bad):
    with pytest.raises(ValueError):
        recommend_route(bad)
