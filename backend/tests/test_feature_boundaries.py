from __future__ import annotations

import ast
from pathlib import Path


FEATURES_DIR = Path(__file__).resolve().parents[1] / "app" / "features"
DISALLOWED_CROSS_FEATURE_MODULES = {"repository", "service", "domain", "repository_queries"}


def test_cross_feature_imports_use_feature_api() -> None:
    violations: list[str] = []

    for path in FEATURES_DIR.rglob("*.py"):
        current_feature = _current_feature_name(path)
        module = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))

        for node in ast.walk(module):
            if not isinstance(node, ast.ImportFrom) or node.module is None:
                continue

            parts = node.module.split(".")
            if parts[:2] != ["app", "features"] or len(parts) < 4:
                continue

            target_feature = parts[2]
            target_module = parts[3]
            if target_feature == current_feature:
                continue
            if target_module not in DISALLOWED_CROSS_FEATURE_MODULES:
                continue

            violations.append(
                f"{path.relative_to(FEATURES_DIR.parent)}:{node.lineno} imports "
                f"`{node.module}`; prefer `app.features.{target_feature}.api`"
            )

    assert not violations, "Cross-feature imports must use feature APIs:\n" + "\n".join(sorted(violations))


def _current_feature_name(path: Path) -> str:
    relative_parts = path.relative_to(FEATURES_DIR).parts
    return relative_parts[0]
