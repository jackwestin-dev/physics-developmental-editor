#!/usr/bin/env python3
"""
Physics textbook developmental editor agent.

Reads input resource(s) and pedagogy.md, then uses Claude to generate
a textbook excerpt that matches the tone and narration style defined
in the pedagogy guide.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Optional

try:
    import anthropic
except ImportError:
    anthropic = None


def load_file(path: Path) -> str:
    """Load text from a file."""
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def load_pedagogy(base_dir: Path) -> str:
    """Load pedagogy.md from project directory."""
    path = base_dir / "pedagogy.md"
    if not path.exists():
        raise FileNotFoundError(f"Pedagogy file not found: {path}")
    return load_file(path)


def load_style_samples(base_dir: Path) -> str:
    """Load all jw_*.md files as style reference excerpts."""
    parts = []
    for p in sorted(base_dir.glob("jw_*.md")):
        parts.append(f"--- {p.name} ---\n{load_file(p)}")
    if not parts:
        return ""
    return "\n\n".join(parts)


def build_messages(
    pedagogy: str,
    input_text: str,
    style_samples: str,
    topic_hint: Optional[str],
) -> tuple[str, str]:
    """Build system and user messages for the LLM."""
    system = f"""You are a physics textbook developmental editor. Your job is to rewrite raw or reference-style physics content into a textbook excerpt that matches a specific pedagogy and narration style.

## Pedagogy and style guide (follow this strictly)

{pedagogy}
"""

    if style_samples:
        system += f"""

## Reference excerpts (match this tone and structure)

Use these as concrete examples of the target style. Match second-person "you," concrete opening scenarios, misconception handling, and section structure.

{style_samples}
"""

    user_parts = [
        "## Input content to transform\n\nRewrite the following content into a single textbook excerpt that follows the pedagogy guide and matches the reference style.",
        "---\n",
        input_text,
    ]
    if topic_hint:
        user_parts.insert(1, f"\nTopic/section focus: {topic_hint}\n")
    user = "\n".join(user_parts)

    return system, user


def run_claude(system: str, user: str, api_key: str) -> str:
    """Call Claude API and return the generated text."""
    if not anthropic:
        raise RuntimeError(
            "anthropic package not installed. Run: pip install anthropic"
        )
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    block = response.content[0]
    if block.type != "text":
        raise ValueError(f"Unexpected response block type: {block.type}")
    return block.text


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a physics textbook excerpt from input using pedagogy and style samples."
    )
    parser.add_argument(
        "input",
        nargs="+",
        type=Path,
        help="Input file(s) to transform (content will be concatenated)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output file (default: excerpt_output.md)",
    )
    parser.add_argument(
        "--topic",
        type=str,
        default=None,
        help="Optional topic or section focus (e.g. 'Newton third law')",
    )
    parser.add_argument(
        "--no-style-samples",
        action="store_true",
        help="Do not load jw_*.md style samples",
    )
    parser.add_argument(
        "--dir",
        type=Path,
        default=Path.cwd(),
        help="Project directory (default: current directory)",
    )
    args = parser.parse_args()

    base_dir = args.dir.resolve()
    pedagogy = load_pedagogy(base_dir)

    input_parts = []
    for p in args.input:
        path = p if p.is_absolute() else base_dir / p
        if not path.exists():
            raise FileNotFoundError(f"Input file not found: {path}")
        input_parts.append(load_file(path))
    input_text = "\n\n---\n\n".join(input_parts)

    style_samples = "" if args.no_style_samples else load_style_samples(base_dir)

    system, user = build_messages(
        pedagogy, input_text, style_samples, args.topic
    )

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Warning: ANTHROPIC_API_KEY not set. Set it to use the Claude API.")
        print("\n--- System message (first 1500 chars) ---\n")
        print(system[:1500])
        print("\n--- User message (first 1500 chars) ---\n")
        print(user[:1500])
        print("\n--- End preview ---")
        return

    excerpt = run_claude(system, user, api_key)

    out_path = args.output
    if out_path is None:
        out_path = base_dir / "excerpt_output.md"
    elif not out_path.is_absolute():
        out_path = base_dir / out_path

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(excerpt)

    print(f"Wrote excerpt to {out_path}")


if __name__ == "__main__":
    main()
