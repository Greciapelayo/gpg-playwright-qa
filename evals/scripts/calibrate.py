"""Checks whether the LLM judge agrees with human labels before we trust it.

    npx promptfoo eval -c evals/calibration/promptfooconfig.yaml
    python evals/scripts/calibrate.py evals/calibration/samples.csv evals/results/calibration.json

Reports agreement, Cohen's kappa (agreement corrected for chance), the confusion matrix,
how many bad answers the judge catches, and every disagreement to review.
"""
from __future__ import annotations

import argparse
import csv
import sys

from promptfoo_results import load

LABELS = {"pass": True, "fail": False}


def cohen_kappa(pairs: list[tuple[bool, bool]]) -> float:
    n = len(pairs)
    observed = sum(h == j for h, j in pairs) / n
    p_human = sum(h for h, _ in pairs) / n
    p_judge = sum(j for _, j in pairs) / n
    expected = p_human * p_judge + (1 - p_human) * (1 - p_judge)
    return 1.0 if expected == 1 else (observed - expected) / (1 - expected)


def read_human_labels(path: str) -> dict[str, bool]:
    labels, missing = {}, []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            value = row["human_label"].strip().lower()
            if value not in LABELS:
                missing.append(row["id"])
            else:
                labels[row["id"]] = LABELS[value]
    if missing:
        sys.exit(f"Label every sample as 'pass' or 'fail' first. Missing: {', '.join(missing)}")
    return labels


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("samples", help="CSV with the human_label column filled in")
    parser.add_argument("results", help="promptfoo JSON output of the calibration run")
    parser.add_argument("--min-kappa", type=float, default=0.6)
    args = parser.parse_args(argv)

    human = read_human_labels(args.samples)
    judged = {r.vars["id"]: r for r in load(args.results) if "id" in r.vars}
    pairs, disagreements = [], []
    for sample_id, h in human.items():
        if sample_id not in judged:
            continue
        j = judged[sample_id].passed
        pairs.append((h, j))
        if h != j:
            disagreements.append((sample_id, h, j, judged[sample_id].reason))

    if not pairs:
        sys.exit("No judged samples match the CSV ids.")

    tp = sum(h and j for h, j in pairs)
    tn = sum(not h and not j for h, j in pairs)
    fp = sum(not h and j for h, j in pairs)   # judge passed an answer the human failed: the dangerous error
    fn = sum(h and not j for h, j in pairs)
    kappa = cohen_kappa(pairs)
    bad = tn + fp

    print(f"Samples: {len(pairs)}")
    print(f"Agreement: {(tp + tn) / len(pairs):.0%}")
    print(f"Cohen's kappa: {kappa:.2f}  (>= {args.min_kappa} to trust the judge)")
    print(f"Bad answers caught by the judge: {tn}/{bad}" if bad else "No failing samples labeled")
    print("\n                judge PASS  judge FAIL")
    print(f"human PASS      {tp:>10}  {fn:>10}")
    print(f"human FAIL      {fp:>10}  {tn:>10}")
    if disagreements:
        print("\nDisagreements to review (fix the rubric, or the label):")
        for sample_id, h, j, reason in disagreements:
            print(f"- {sample_id}: human {'pass' if h else 'fail'}, judge {'pass' if j else 'fail'} – {reason[:160]}")
    return 0 if kappa >= args.min_kappa else 1


if __name__ == "__main__":
    sys.exit(main())
