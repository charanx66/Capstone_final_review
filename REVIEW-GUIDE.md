# Optimizer Lab: learn the project and present it

## Start here

Read sections 1–5 aloud, then open the app and follow section 10. Allow about seven minutes for the slides and two minutes for the demonstration. Use the speaker notes as prompts and practise explaining the chart in your own words.

[Open the presentation and speaker notes](https://chatgpt.com/space/page_c28ed61dbbc481918bb6c663c1e86ab9)

## 1. Optimizer Lab

Good morning. Imagine a printer with many settings. Printing a sample takes ink, cloth and time. If we can afford only 40 trials, how should we choose the next setting? Our capstone studies that question with repeatable mathematical tasks. The printing story is an analogy. Our application compares optimizers on simulated functions.

## 2. One trial means one measurement

Think of a colour-matching task. Suppose the measured colour error is 8 on the first trial and 5 on the second. The second setting is better because the error is smaller. Optimization means choosing settings to reduce that number. A dimension is one adjustable setting. Twenty dimensions give us twenty choices to make together.

## 3. What the optimizer gets to see

The simulator knows how to calculate the answer. The search method only gets the value at each point it tries. In the default sparse task, fifteen inputs do not affect the answer. The optimizer is never told which five matter. Noise adds random measurement error. An optional constraint only allows settings whose average is at most 0.5. The seed lets us repeat a task.

## 4. How Bayesian optimization chooses a trial

If a tested setting worked well, we might test a nearby one. That is exploitation. We might also test an uncertain region because it could contain something better. That is exploration. The decision rule is called the acquisition function. Scoring a candidate with the model is computational work. Only querying the objective spends an evaluation from the budget.

## 5. Six ways to choose the next point

There are three GP variants plus three comparisons. Sobol follows a low-discrepancy sequence. The global GP uses a lower confidence bound. The local GP changes its search radius after successes or misses. Expected improvement asks how much a candidate could beat the best observation, accounting for uncertainty. Differential evolution starts with six population members, makes a proposal using differences between members and compares it with its target. Random and Sobol help establish how much a more complex method buys us.

## 6. From sign-in to a saved experiment

Sign in, choose the objective and enter the difficulty settings. The browser worker handles the calculations so the interface stays responsive. The server checks the session before saving or reopening an experiment. SQLite is used locally and D1 in the hosted version. JSON export includes settings and traces. The Python version is an earlier four-method reference; the live six-method experiment uses JavaScript.

## 7. How the ranking is calculated

Both synthetic objectives have a known minimum of zero, so the gap measures how far above that minimum the best sampled value is. On the chart a flat section means that no new best value was found. The app rescales each of the three metrics within the current comparison before weighting them. A target missed within 40 trials counts as 41. Runtime is displayed separately. The weights are design choices and changing them can change the winner.

## 8. A fast start changed the ranking

These are measured results for Sphere, 20 dimensions, five active settings, 40 calls and seed 7, with zero noise and the constraint off. Trust-region GP finished closer to zero. Expected improvement reached the target four trials earlier and won on the weighted score. Six methods times forty trials gives 240 evaluations counted across methods. Point to those two curves in the app.

## 9. Does the same method always win?

Only the objective and seed varied in this sweep. On Sphere, the other winners were global GP three times, expected improvement twice and random once. On Rastrigin, trust-region GP won four times, random twice, and each remaining method once. This small experiment supports reporting conditions and repeating seeds. It does not establish superiority on industrial problems.

## 10. Live demonstration

Start by saying: I will give every method the same number of trials. Click Run benchmark and wait for the saved confirmation. Read the best method, the smallest final gap, and the 240 total evaluations. Explain why the first two metrics can belong to different methods. If the network is unavailable, use the reference results slide or run npm start on the prepared local computer.

## 11. What the prototype establishes

The strongest result is that we can show the trade-off between reaching a useful answer quickly and finding the smallest final error. The current program uses synthetic functions and an explicit weighted score. The local GP is simplified. We have not implemented a learned selector for unseen tasks or a SHAP/LIME package integration. Thank you. I am happy to demonstrate a different seed or explain how any method chooses its next point.

## A score you can calculate by hand

Suppose one method earns 80 out of 100 on final gap, 60 on average gap, and 100 on speed to target, after rescaling. Its overall score is 0.50 × 80 + 0.30 × 60 + 0.20 × 100 = **78 out of 100**. A score of 78 is a ranking measure within this group. It is not a percentage accuracy. When a seventh method is added, scaled scores can change even when the original traces stay identical.

## Words the panel may use

| Word | Meaning in this project |
|---|---|
| Objective | The quantity being minimized. |
| Evaluation budget | How many times each method may ask the objective for a value. |
| High dimensional | One candidate contains many input values. |
| Sparsity | Only some of those values influence the answer. |
| Surrogate | A model that cheaply estimates the expensive objective. |
| Incumbent | The best candidate observed so far. |
| Acquisition function | The rule used to decide where the GP should look next. |
| Convergence | How the best result changes as more trials are used. |
| Seed | The number that controls the reproducible pseudo-random choices. |
| Constraint | A rule that excludes some candidate settings. |

## Questions to rehearse

**Where did the training data come from?** The simulator generates observations during each experiment. The GP learns from the trials already available in that run. No external training dataset is needed.

**How is it fair?** Each method gets the same objective, six initial points, measurement noise sequence and evaluation budget. Processing time can differ, so the dashboard reports it separately.

**Why include Random and Sobol?** They are simple baselines. If they perform similarly, the added cost of fitting a model may not be worthwhile for that task.

**How does the simulator know the gap?** It knows the hidden function and its true minimum. The evaluator records the best true value sampled. Each search method only receives its measured value, which may include noise.

**Why can Sobol have a score of zero?** The score is scaled against this group on this run. Zero can mean last on all three metrics even if the method improved on its first trial.

**What happens if everyone ties?** Each receives equal credit (half the metric's weight) for a metric with no spread.

**Is this ready to choose a production optimizer?** It is a teaching and benchmarking prototype. A production study would need representative real tasks, repeated trials, and validation of the scoring priorities.

**What should I demonstrate if time is short?** Run seed 7 on Sphere. Point to trial 11 versus trial 15, then show that the second method nevertheless achieved the smaller final error. That single comparison illustrates the whole project.

## Where to find the implementation

Start with `index.html` and `web/ui.js` for the interface, `web/compute.js` for the worker, `web/engine.js` for all six optimizers and scoring, `server/api.js` for authentication and run storage, and `tests/notebook.test.js` for regression checks. Published figures can be reproduced with `node scripts/review-sweep.mjs`.
