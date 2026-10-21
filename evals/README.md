# Évals – Équipe GPG AI assistant

Eval harness for **Équipe GPG**, the multilingual (FR/EN/ES) assistant that answers clients of my facial studio on Instagram and collects booking requests. Built with **promptfoo** for the model runs and **Python** for the statistics, judge calibration and release gate.

## What "good" means here

Most questions have many acceptable answers, so each test combines:
- **Deterministic checks** where there is a single truth: the right price, `911` in an emergency, no street address, the right action tag (tool call), no markdown, latency.
- **LLM-as-judge rubrics** (`llm-rubric`) for what can't be string-matched: didn't invent a promotion, asked for clarification instead of guessing, kind tone, right language, no medical verdict.

The agent emulates its tools with action tags (`[ACTION: pasar_a_grecia | reason]`, `[ACTION: solicitar_cita]`) so **tool calls are asserted deterministically**: a missed escalation is a hard failure.

| Category | Tests | Examples |
|---|---|---|
| grounding | 7 | prices, launch price ends at 10 clients, deposit, hours |
| hallucination | 6 | fake Black Friday deal, services not offered, gift cards, ambiguous and nonsense messages, promises of results |
| booking | 3 | never confirms (even when pushed), complete request → `solicitar_cita`, LED safety questions |
| safety ⚠️ | 7 | pregnancy + LED, Accutane, skin reaction, emergency (911), medical question, complaint, child booking alone |
| privacy ⚠️ | 3 | exact address, credit card number, another client's appointment |
| adversarial ⚠️ | 6 | prompt injection, impersonating the owner, system-prompt extraction, role-play diagnosis, off-topic, injection hidden in a booking |
| language | 3 | Quebec French with *vous*, Spanish, honest about being a bot |

⚠️ = critical category: **one failure blocks the release**, whatever the overall pass rate.

## How a release is decided

```bash
npx promptfoo@0.124.1 eval -c evals/promptfooconfig.yaml --repeat 3 -o evals/results/latest.json
python evals/scripts/report.py evals/results/latest.json --gate
```

- Two agent models run side by side (Haiku 4.5 and Sonnet 5.5): the same suite is the **regression check when the model version, the prompt or a rule changes**.
- `--repeat 3`: LLM answers vary between runs, so each test runs several times.
- `report.py` gives the pass rate per model and category with a **95% Wilson confidence interval**, the **flaky tests** (mixed results across repeats), latency p50/p95 and cost, then applies the **gate**: pass rate ≥ 90% and zero critical failures.
- In CI (`.github/workflows/evals.yml`) this runs on every change under `evals/`, and the report appears in the GitHub job summary.

**Latest results:** see [RESULTS.md](RESULTS.md) – judge kappa 0.67 vs. human labels, Sonnet 91% with all critical categories at 100%, Haiku blocked by the gate, and how each failure was triaged.

## Run it locally on a Claude subscription (no API credits)

`promptfooconfig.local.yaml` runs the same tests, checks and rubrics through the Claude Code CLI (`providers/claude_code.js`) instead of the API. Tools, MCP servers, settings and session history are disabled so the model only sees what each test sends. Requires Node.js ≥ 22 and a logged-in `claude`.

```bash
npx promptfoo@0.124.1 eval -c evals/calibration/promptfooconfig.local.yaml -o evals/results/calibration.json
npx promptfoo@0.124.1 eval -c evals/promptfooconfig.local.yaml -j 2 -o evals/results/latest.json
python evals/scripts/report.py evals/results/latest.json --gate
```

## Calibrating the judge against human labels

An LLM judge is only useful if it agrees with people. `calibration/samples.csv` has 24 fixed responses (good, bad and borderline) labeled `pass`/`fail` by a human.

```bash
npx promptfoo@0.124.1 eval -c evals/calibration/promptfooconfig.yaml
python evals/scripts/calibrate.py evals/calibration/samples.csv evals/results/calibration.json
```

The `echo` provider returns each sample as-is, so only the judge is tested. `calibrate.py` reports agreement, **Cohen's kappa** (agreement corrected for chance), the confusion matrix and **how many bad answers the judge catches**, and lists every disagreement. Below a kappa of 0.6, the rubric (or the label) gets fixed before the judge is trusted.

## Run it

Requires an Anthropic API key in `ANTHROPIC_API_KEY` (a repository secret in CI).

```bash
python -m pytest evals/scripts      # unit tests for the statistics (no API key needed)
```

## Files

```
evals/
├── agent/system_prompt.md       # the assistant under test (public-safe version)
├── prompts/agent.js             # builds the chat: system prompt + client message
├── promptfooconfig.yaml         # models, judge, default checks, test files
├── tests/*.yaml                 # 35 cases in 7 categories
├── calibration/                 # human-labeled samples + judge-only config
└── scripts/                     # report + gate, calibration, unit tests (Python)
```
