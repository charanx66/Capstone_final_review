# High-Dimensional Bayesian Optimization Benchmark & Algorithm-Selection Platform

A local interactive capstone prototype. Give four search methods the same synthetic problem and evaluation budget, inspect their convergence, and explain their ranking.

## Run on Windows (Python 3.12)
Open a terminal in this folder. First-time setup needs internet for packages.
```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python app.py
```
Open http://127.0.0.1:8000 and click **Run benchmark**. Later runs only need the last command. Ctrl+C stops the server. On macOS/Linux use python3.12 to create the environment and .venv/bin/python for the remaining commands.

## Two-minute review demo
1. Start with the default Sphere task, 20 dimensions, five active, 40 evaluations and seed 7. Explain that only five hidden coordinates affect this objective. The optimizers never receive their identities.
2. Click **Run benchmark**. The six shared starting points count toward each method's budget. Following them, each optimizer chooses its own evaluations.
3. Show how the global GP wins the composite score even though the local trust-region GP finds the lowest final gap. Inspect the mean gap and calls to target to explain the trade-off.
4. Open the score contributions. Change only the seed and rerun to show whether the shortlist changes. Export the JSON for each run. Use results/default-run.json as the offline record of the verified example.

## What is implemented
- Shifted Sphere and Rastrigin objectives in 2–100 dimensions, configurable active coordinates, additive Gaussian noise, optional feasible-region restriction (mean input at most 0.5). Both synthetic objectives have a feasible minimum of zero. Inputs are in the unit cube.
- Random and scrambled Sobol baselines, global Gaussian-process search, and adaptive trust-region Gaussian-process search. The GP uses an RBF covariance, fixed regularization and lower-confidence-bound acquisition over sampled feasible candidates. The local variant expands after three successes and shrinks after four misses. This is a simplified local method.
- Every method shares the problem, initial design and per-evaluation noise sequence. Optimizers see noisy values. The evaluator reports the best latent value sampled, possible because the benchmark objective is known. Reported times depend on the computer.
- The score combines within-run min–max utilities for final gap (50%), mean best-so-far gap (30%), and first call to halve the best warm-start gap (20%). Unreached targets receive budget + 1. Tied metric ranges give equal credit. Score ties preserve portfolio order.
- The explanation is exact for this additive ranking rule. Each metric's Shapley contribution is its weighted utility minus the portfolio-average weighted utility. The three contributions plus average score recover the displayed score. This explains the ranking rule, not causal effects of input dimensions.
- The ranking is retrospective on the specified task. The prototype does not predict the best algorithm for unseen tasks. Full TuRBO, SAASBO, BoTorch, a learned selector, and SHAP/LIME library integrations from the proposed architecture remain extensions. One seeded run illustrates behavior; cross-seed, cross-dimension comparisons are needed for general performance claims.

## Verify
Run `python verify.py` with the environment's Python. It checks shared starts, budgets, reproducibility, monotone convergence and additive explanations on the default and noisy constrained 100-D settings.

## GitHub upload
Target: https://github.com/charanx66/Capstone_final_review . To preserve existing work, clone the target, copy the extracted project files into that checkout, then commit and push from it. Use a new branch if the default branch is protected. Leave .venv out of Git.
