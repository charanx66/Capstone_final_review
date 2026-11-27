# Optimizer Lab

An experiment notebook for the **High-Dimensional Bayesian Optimization Benchmark & Algorithm-Selection Platform** capstone. Create an account, configure a problem, and compare four optimizers under one evaluation budget. Each completed run is saved to that account and can be reopened or exported as JSON.

## Run locally

Install Node.js 22.13 or newer. From the project folder:

```sh
npm start
```

Open http://127.0.0.1:8000. Select **Create account** the first time. The app has no npm dependencies. SQLite stores accounts, sessions and runs in `notebook.sqlite`. Keeping that file preserves the notebook between launches. You can also start the same server with `python app.py` if Node is installed.

## A two-minute review

1. Sign in. The chart initially shows the labelled reference run. The reference does not count as a saved experiment.
2. Keep Sphere, 20 dimensions, five active coordinates, seed 7 and 40 evaluations. Click **Run benchmark**. Each optimizer starts with the same six samples and has 34 further evaluations.
3. Inspect the ranking. In the included browser reference the trust-region GP has the highest composite score. The global GP reaches the target on call 14, one evaluation earlier. Open the scoring explanation to see why final accuracy and the full trajectory change the ranking.
4. Switch to **Saved experiments**, reopen the run and export its JSON. Change just the seed or objective and repeat. This is a task-specific comparison; general conclusions require repeated trials.

## How a run works

- **Interface** (`index.html`, `web/ui.js`, `web/style.css`). The sign-in page and workbench share a chart drawn from measured results. A separate browser worker keeps the form responsive during computation.
- **Experiment** (`web/engine.js`). Generate a shifted Sphere or Rastrigin function in 2–100 dimensions. Only the selected hidden coordinates affect the true objective. All algorithms receive the same warm start and additive noise sequence. The optional constraint restricts the mean input to at most 0.5.
- **Portfolio**. Random sampling, digitally shifted Sobol, global RBF Gaussian process and adaptive trust-region GP. Both GPs evaluate a lower confidence bound over sampled candidates. The trust region expands after three improvements and contracts after four misses. The Sobol direction numbers are extracted from SciPy's Joe–Kuo table.
- **Score**. Min–max scale each metric within the run. Final gap carries 50%, mean best-so-far gap 30%, and calls to halve the best warm-start gap 20%. An unreached target counts as budget + 1. The additive contributions show the points above or below the average method for each metric. Runtime is recorded separately. The evaluator uses the known latent objective; the search sees noisy observations.
- **Persistence** (`server/api.js`). Salted password digests and expiring, revocable cookie sessions. Every experiment lookup includes the current account ID. Browser-computed measurements are stored as submitted, so this is a personal notebook rather than a verified multi-user leaderboard. Local storage uses SQLite; the deployed Worker uses D1 with the same SQL schema. Local and hosted accounts are separate.
- **Python reference** (`benchmark.py`). The earlier NumPy/SciPy implementation and its sample output remain in the repository. The interactive engine has a different seeded random generator and candidate-pool size. Compare results within the same engine. Browser and Python reference outputs have distinct filenames under `results/`.

## Checks

```sh
npm test
```

The tests exercise the default task and a noisy constrained 100-D task, shared starts, convergence and ranking. The notebook test covers registration, sign-in, duplicate names, wrong passwords, persistence after restart, user isolation and sign-out. For the separate Python reference, install `requirements.txt` with Python 3.12 and run `python verify.py`.

## Boundaries of the prototype

The shortlist ranks completed benchmarks. Full TuRBO, SAASBO, a learned selector for unseen tasks and SHAP/LIME integrations are extensions from the original project proposal. The local method is a simplified trust-region GP. Experiments use synthetic objectives with a known minimum.
