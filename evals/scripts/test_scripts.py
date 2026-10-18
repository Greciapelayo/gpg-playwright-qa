"""Unit tests for the eval report and the judge calibration (no API key needed).

    python -m pytest evals/scripts
"""
import csv
import json

import pytest

import calibrate
import report


def make_results(tmp_path, rows):
    """Writes a minimal promptfoo-style output file. rows: (test, category, provider, passed, latency, cost, vars)."""
    results = [{
        "testCase": {"description": test},
        "vars": {"category": cat, **extra},
        "provider": {"id": f"anthropic:{provider}", "label": provider},
        "response": {"output": "..."},
        "success": passed,
        "latencyMs": latency,
        "cost": cost,
        "gradingResult": {"reason": "judge reason"},
    } for test, cat, provider, passed, latency, cost, extra in rows]
    path = tmp_path / "results.json"
    path.write_text(json.dumps({"evalId": "x", "results": {"version": 3, "results": results}}))
    return path


def test_wilson_interval_is_narrower_with_more_samples():
    lo_small, hi_small = report.wilson_interval(9, 10)
    lo_big, hi_big = report.wilson_interval(90, 100)
    assert hi_small - lo_small > hi_big - lo_big
    assert lo_big < 0.9 < hi_big


def test_wilson_interval_handles_extremes():
    assert report.wilson_interval(0, 0) == (0.0, 0.0)
    lo, hi = report.wilson_interval(10, 10)
    assert hi == pytest.approx(1.0) and lo < 1.0


def test_summary_rates_flaky_and_latency(tmp_path):
    path = make_results(tmp_path, [
        ("price", "grounding", "haiku", True, 1000, 0.001, {}),
        ("price", "grounding", "haiku", False, 3000, 0.001, {}),   # same test, different outcome -> flaky
        ("injection", "adversarial", "haiku", True, 2000, 0.002, {}),
        ("injection", "adversarial", "haiku", True, 2000, 0.002, {}),
    ])
    s = report.summarize(report.load(path))["haiku"]
    assert s["rate"] == 0.75
    assert s["categories"]["grounding"]["rate"] == 0.5
    assert s["flaky"] == ["price"]
    assert s["always_failing"] == []
    assert s["latency_p50"] == 2000
    assert s["cost_total"] == pytest.approx(0.006)


def test_gate_blocks_on_any_critical_failure_even_with_high_pass_rate(tmp_path):
    rows = [(f"t{i}", "grounding", "sonnet", True, 1, 0, {}) for i in range(19)]
    rows.append(("leak", "privacy", "sonnet", False, 1, 0, {}))
    summary = report.summarize(report.load(make_results(tmp_path, rows)))
    reasons = report.gate(summary, min_rate=0.9)
    assert summary["sonnet"]["rate"] == 0.95
    assert reasons == ["sonnet: 1 failure(s) in critical category 'privacy'"]


def test_gate_green_light(tmp_path):
    rows = [(f"t{i}", "safety", "sonnet", True, 1, 0, {}) for i in range(5)]
    summary = report.summarize(report.load(make_results(tmp_path, rows)))
    assert report.gate(summary, min_rate=0.9) == []
    assert "Green light" in report.to_markdown(summary, [])


def test_cohen_kappa():
    assert calibrate.cohen_kappa([(True, True), (False, False)] * 5) == 1.0
    # Judge always says pass: agreement looks fine on a pass-heavy set, kappa shows it is useless.
    pairs = [(True, True)] * 8 + [(False, True)] * 2
    assert calibrate.cohen_kappa(pairs) == pytest.approx(0.0)


def test_calibration_requires_every_label(tmp_path):
    samples = tmp_path / "samples.csv"
    with open(samples, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "human_label"])
        w.writerows([["c01", "pass"], ["c02", ""]])
    with pytest.raises(SystemExit, match="c02"):
        calibrate.read_human_labels(str(samples))


def test_calibration_end_to_end(tmp_path, capsys):
    samples = tmp_path / "samples.csv"
    with open(samples, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "human_label"])
        w.writerows([["c01", "pass"], ["c02", "fail"], ["c03", "fail"], ["c04", "pass"]])
    results = make_results(tmp_path, [
        ("c01", "grounding", "fixed-samples", True, 1, 0, {"id": "c01"}),
        ("c02", "grounding", "fixed-samples", False, 1, 0, {"id": "c02"}),
        ("c03", "grounding", "fixed-samples", True, 1, 0, {"id": "c03"}),   # judge missed a bad answer
        ("c04", "grounding", "fixed-samples", True, 1, 0, {"id": "c04"}),
    ])
    exit_code = calibrate.main([str(samples), str(results), "--min-kappa", "0.6"])
    out = capsys.readouterr().out
    assert "Agreement: 75%" in out
    assert "Bad answers caught by the judge: 1/2" in out
    assert "c03: human fail, judge pass" in out
    assert exit_code == 1   # kappa 0.5 < 0.6: don't trust this judge yet
