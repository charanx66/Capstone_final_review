"""Quick regression checks. Run with python verify.py."""
from math import isclose
from benchmark import run

for options in ({}, dict(d=100,active=3,budget=18,objective="Rastrigin",noise=.1,constrained=True)):
    a,b = run(**options),run(**options)
    assert len(a["rows"]) == 4
    for r,s in zip(a["rows"],b["rows"]):
        assert r["trace"] == s["trace"]
        assert len(r["trace"]) == a["config"]["budget"]
        assert r["trace"][:6] == a["rows"][0]["trace"][:6]
        assert all(i >= j >= 0 for i,j in zip(r["trace"],r["trace"][1:]))
        assert isclose(r["score"], a["baseline"] + sum(r["contributions"].values()), abs_tol=1e-9)
print("Checks passed for default and constrained noisy 100-D runs.")
