"""Reads a promptfoo JSON output file into simple rows, whatever the output version."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Row:
    test: str            # test description (stable across repeats)
    category: str
    provider: str
    passed: bool
    latency_ms: float | None = None
    cost: float | None = None
    output: str = ""
    reason: str = ""
    vars: dict = field(default_factory=dict)
    named_scores: dict = field(default_factory=dict)


def load(path: str | Path) -> list[Row]:
    data = json.loads(Path(path).read_text())
    results = data.get("results", data)
    if isinstance(results, dict):
        results = results.get("results", [])

    rows = []
    for r in results:
        test_case = r.get("testCase") or {}
        variables = r.get("vars") or test_case.get("vars") or {}
        provider = r.get("provider") or {}
        if isinstance(provider, str):
            provider = {"id": provider}
        response = r.get("response") or {}
        grading = r.get("gradingResult") or {}
        rows.append(Row(
            test=test_case.get("description") or variables.get("id") or variables.get("message", "?"),
            category=variables.get("category", "uncategorized"),
            provider=provider.get("label") or provider.get("id", "?"),
            passed=bool(r.get("success")),
            latency_ms=r.get("latencyMs"),
            cost=r.get("cost"),
            output=str(response.get("output", "")),
            reason=grading.get("reason", "") or str(r.get("error") or ""),
            vars=variables,
            named_scores=r.get("namedScores") or grading.get("namedScores") or {},
        ))
    return rows
