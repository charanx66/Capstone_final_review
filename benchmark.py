"""Seeded black-box benchmarks. All algorithms see only noisy observations."""
from time import perf_counter
import numpy as np
from scipy.linalg import cho_factor, cho_solve, solve_triangular
from scipy.spatial.distance import cdist
from scipy.stats import qmc
from threadpoolctl import threadpool_limits

METHODS = ["Random", "Sobol", "Gaussian process", "Trust-region GP"]
WEIGHTS = {"final_gap": .50, "mean_gap": .30, "target_calls": .20}


def candidates(points, constrained):
    if constrained:
        return points[points.mean(axis=1) <= .50]
    return points


def gp_choice(x, y, pool, active_scale):
    # Fixed RBF kernel, empirical signal scale, and lower confidence bound.
    length = .28 * np.sqrt(active_scale)
    def kernel(a, b):
        return np.exp(-cdist(a, b, "sqeuclidean") / (2 * length**2))
    standardized = (y - np.mean(y)) / max(np.std(y), 1e-8)
    covariance = kernel(x, x)
    covariance.flat[::len(x)+1] += .01
    factor = cho_factor(covariance, lower=True)
    cross = kernel(x, pool)
    mean = cross.T @ cho_solve(factor, standardized)
    v = solve_triangular(factor[0], cross, lower=True)
    std = np.sqrt(np.maximum(1 - np.sum(v*v, axis=0), 0))
    return pool[np.argmin(mean - 1.6 * std)]


def rank(rows):
    # Interventional Shapley values of an additive score, relative to cohort mean.
    baseline = 0.
    for metric, weight in WEIGHTS.items():
        costs = np.array([r[metric] for r in rows])
        utility = (costs.max()-costs)/np.ptp(costs) if np.ptp(costs) else np.full(len(rows), .5)
        points = 100 * weight * utility
        baseline += points.mean()
        for row, value in zip(rows, points):
            row.setdefault("score", 0.)
            row["score"] += float(value)
            row.setdefault("contributions", {})[metric] = float(value-points.mean())
    return float(baseline), sorted(rows, key=lambda r: -r["score"])


@threadpool_limits.wrap(limits=1, user_api="blas")
def run(d=20, active=5, budget=40, seed=7, noise=0., constrained=False, objective="Sphere"):
    if not (2 <= d <= 100 and 1 <= active <= d and 12 <= budget <= 120
            and 0 <= seed <= 999999 and 0 <= noise <= 1 and objective in ("Sphere", "Rastrigin")):
        raise ValueError("Check dimensions, active coordinates, budget, seed and noise.")
    task = np.random.default_rng(seed)
    axes = task.choice(d, active, replace=False)
    center = task.uniform(.15, .45, active)
    def loss(point):
        z = point[axes] - center
        if objective == "Rastrigin":
            z = 5.12*z
            return float(np.mean(z*z + 10*(1-np.cos(2*np.pi*z))))
        return float(np.mean(z*z))

    warm = candidates(task.random((256,d)), constrained)[:6]
    noise_draws = task.normal(0, noise, budget)
    target = min(map(loss, warm)) * .5
    rows = []
    for index, method in enumerate(METHODS):
        start = perf_counter()
        rng = np.random.default_rng(np.random.SeedSequence([seed, index, 35]))
        sobol = iter(candidates(qmc.Sobol(d, scramble=True, seed=seed+19).random_base2(10), constrained))
        x, y, trace = [], [], []
        radius = .5
        wins = misses = 0
        for i in range(budget):
            if i < len(warm):
                point = warm[i]
            elif method == "Sobol":
                point = next(sobol)
            elif method == "Random":
                while True:
                    point = rng.random(d)
                    if not constrained or point.mean() <= .5:
                        break
            else:
                low, high = 0., 1.
                if method == "Trust-region GP":
                    best = x[int(np.argmin(y))]
                    low, high = np.maximum(0, best-radius), np.minimum(1, best+radius)
                pool = candidates(rng.uniform(low, high, (512,d)), constrained)
                if not len(pool):
                    pool = candidates(rng.random((1024,d)), constrained)
                point = gp_choice(np.array(x), np.array(y), pool, d)
            value = loss(point)
            observed = value + noise_draws[i]
            if i >= len(warm) and method == "Trust-region GP":
                if observed < min(y):
                    wins, misses = wins+1, 0
                else:
                    wins, misses = 0, misses+1
                if wins == 3:
                    radius, wins = min(.8, 2*radius), 0
                if misses == 4:
                    radius, misses = max(.035, radius/2), 0
            x.append(point)
            y.append(observed)
            trace.append(min(value, trace[-1]) if trace else value)
        rows.append(dict(method=method, trace=trace, final_gap=trace[-1], mean_gap=float(np.mean(trace)),
                         target_calls=next((i+1 for i,v in enumerate(trace) if v <= target), budget+1),
                         seconds=perf_counter()-start))
    baseline, rows = rank(rows)
    return dict(config=dict(d=d,active=active,budget=budget,seed=seed,noise=noise,
                            constrained=constrained,objective=objective),target=target,
                baseline=baseline,rows=rows)
