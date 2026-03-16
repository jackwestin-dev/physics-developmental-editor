#!/usr/bin/env python3
"""
Pedagogy review agent: filters physics content into a structured, student-friendly review.

This agent receives physics textbook content and rewrites/restructures it according to
the strict pedagogical framework in physics_pedagogy.md. It does not summarize or omit;
it transforms the material so it is accessible, engaging, and logically progressive
for high school or early university students.

Used as the output filter in the app pipeline (see agent.py --filter-with-review).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

try:
    import anthropic
except ImportError:
    anthropic = None

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]


def load_file(path: Path) -> str:
    """Load text from a file."""
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def load_physics_pedagogy(base_dir: Path) -> str:
    """Load physics_pedagogy.md from project directory."""
    path = base_dir / "physics_pedagogy.md"
    if not path.exists():
        raise FileNotFoundError(f"Physics pedagogy file not found: {path}")
    return load_file(path)


def build_review_messages(pedagogy: str, content: str) -> tuple[str, str]:
    """Build system and user messages for the review-document LLM call."""
    system = """You are an expert physics educator and science writer. Your sole task is to receive physics textbook content and transform it into a structured, student-friendly review document.

You do **not** summarize, condense, or omit content. You **rewrite and restructure** it according to a strict pedagogical framework described below, preserving all scientific accuracy while making the material accessible, engaging, and logically progressive for a high school or early university student.

## Pedagogical framework (follow strictly)

"""
    system += pedagogy

    user = """## Physics content to transform

Rewrite and restructure the following content into a structured review document. Apply the full six-step framework for every distinct concept or physical quantity. Preserve all scientific content; do not drop ideas or equations. Output the complete review document in markdown.

---
"""
    user += content

    return system, user


def run_review(
    content: str,
    api_key: Optional[str] = None,
    base_dir: Optional[Path] = None,
) -> str:
    """
    Run the pedagogy review agent on the given content.

    Returns the transformed, structured review document. Does not write to disk.
    """
    if not anthropic:
        raise RuntimeError(
            "anthropic package not installed. Run: pip install anthropic"
        )
    base_dir = base_dir or Path.cwd()
    if load_dotenv is not None:
        load_dotenv(base_dir / ".env")
        load_dotenv(base_dir / ".env.local", override=True)
    api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY must be set to run the review agent")

    pedagogy = load_physics_pedagogy(base_dir)
    system, user = build_review_messages(pedagogy, content)

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    block = response.content[0]
    if block.type != "text":
        raise ValueError(f"Unexpected response block type: {block.type}")
    return block.text


def main() -> None:
    """Standalone entrypoint: read content from stdin or a file, run review, write to file."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description="Transform physics content into a structured review document (pedagogy filter)."
    )
    parser.add_argument(
        "input",
        nargs="?",
        type=Path,
        default=None,
        help="Input file. If omitted, read from stdin.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output file (default: review_output.md)",
    )
    parser.add_argument(
        "--dir",
        type=Path,
        default=Path.cwd(),
        help="Project directory for physics_pedagogy.md (default: current directory)",
    )
    args = parser.parse_args()

    base_dir = args.dir.resolve()
    if args.input:
        content = load_file(args.input)
    else:
        content = sys.stdin.read()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY must be set.", file=sys.stderr)
        sys.exit(1)

    review_text = run_review(content, api_key=api_key, base_dir=base_dir)

    out_path = args.output
    if out_path is None:
        out_path = base_dir / "review_output.md"
    elif not out_path.is_absolute():
        out_path = base_dir / out_path

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(review_text)

    print(f"Wrote review document to {out_path}")


if __name__ == "__main__":
    main()
