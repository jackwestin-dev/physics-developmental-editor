#!/usr/bin/env python3
"""
Physics textbook developmental editor agent.

Reads input resource(s) and pedagogy.md, then uses Claude to generate
a textbook excerpt that matches the tone and narration style defined
in the pedagogy guide.

Output filter: The process can optionally pass the generated excerpt through
the pedagogy review agent (review_document_agent, using physics_pedagogy.md),
which rewrites it into a structured, student-friendly review document. Enable
with --filter-with-review (not used in production by default).
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import List, Optional

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
    source_texts: List[str],
    style_samples: str,
    topic_hint: Optional[str],
) -> tuple[str, str]:
    """Build system and user messages for the LLM. source_texts must have 1–5 items."""
    n = len(source_texts)
    has_multiple = n >= 2
    multi_guidance = ""
    if has_multiple:
        multi_guidance = (
            "\n\n## Multi-source synthesis\n\n"
            f"You are receiving **{n}** source inputs (Source 1 through Source {n}). "
            "Synthesize them into a single, coherent excerpt in our voice. Use all sources to inform coverage and depth; express everything in your own words. "
            "When multiple sources cover a formula or definition that applies in multiple situations (e.g. work W = Fd cos θ), prefer one extended scenario explored across those situations: introduce the formula, then walk through each case (e.g. same direction, at an angle, opposite, perpendicular) with a **Conclusion:** per case, and end with a **Conclusions:** bullet list. When sources cover a definition-and-law topic (e.g. reflection, law of reflection), prefer one concrete scenario, then define each term in order, then state the law, then one short consequence or special case; reference figures and use full-sentence captions. It is okay to focus on one clear thread rather than packing every subtopic from every input."
        )
    system = f"""You are a physics textbook developmental editor. Your job is to transform raw or reference-style physics content into a fully original textbook excerpt that follows a specific pedagogy and narration style.
{multi_guidance}

CRITICAL ORIGINALITY RULE: Keep the **tone and approach**; change the **examples, analogies, and framing**. Your output must be **completely original** in wording, examples, and how you introduce formulas. Do NOT copy or closely paraphrase sentences, examples, or analogies from the input or reference excerpts (e.g. do not reuse "relative density" critiques, body fat/bone or atmosphere/ocean comparisons, or the same formula sequence and lead-in as in the input). Use **real-world examples** that are your own—different objects, different numbers, different framing. If you catch yourself reusing an example or a turn of phrase from the input, replace it with an original, real-world alternative.

## Pedagogy and style guide (follow this strictly)

{pedagogy}
"""

    if style_samples:
        system += f"""

## Reference excerpts (for STRUCTURAL and TONAL reference only — DO NOT copy language)

Study these excerpts to understand the target structure, voice, and pedagogical flow. Match the second-person style, the hook-before-definition pattern, misconception handling, and section organization. However, do NOT reproduce any sentences, phrases, scenarios, or examples from these excerpts. Your output must use entirely different wording, different objects, different settings, and different numerical values.

{style_samples}
"""

    if has_multiple:
        instruction = (
            f"Synthesize the following **{n} sources** into one textbook excerpt in our voice. "
            "Use all sources to inform your coverage; then write a fully **original** excerpt. "
            "Keep the **tone and approach**; use **original examples, analogies, and framing**—real-world but not copied from any source (different objects, numbers, and formula lead-ins). "
            "Do not reuse any source's examples or near-verbatim phrasing. Write as if you are a different author teaching the same topic."
        )
    else:
        instruction = "Transform the following physics content into a fully **original** textbook excerpt. Keep the **tone and approach**; use **original examples, analogies, and framing**—real-world but not from the input (different objects, numbers, and how you introduce formulas). Do not reuse the input's examples or near-verbatim phrasing. Write as if you are a different author covering the same physics topic."

    user_parts = ["## Content to transform\n\n" + instruction, "\n---\n"]
    if topic_hint:
        user_parts.append(f"\nTopic/section focus: {topic_hint}\n")
    for i, text in enumerate(source_texts, start=1):
        user_parts.append(f"\n### Source {i}\n\n")
        user_parts.append((text or "(No text provided.)").strip())
    user = "".join(user_parts)

    return system, user


def run_claude(system: str, user: str, api_key: str) -> str:
    """Call Claude API and return the generated text."""
    if not anthropic:
        raise RuntimeError(
            "anthropic package not installed. Run: pip install anthropic"
        )
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
    parser = argparse.ArgumentParser(
        description="Generate a physics textbook excerpt from input using pedagogy and style samples."
    )
    parser.add_argument(
        "input",
        nargs="+",
        type=Path,
        help="Input file(s): 1 to 5 resources. Each file is Source 1, Source 2, …; multiple sources are synthesized into one excerpt.",
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
    parser.add_argument(
        "--filter-with-review",
        action="store_true",
        help="Pass generated excerpt through the pedagogy review agent before writing (output becomes structured review document). Not enabled in production.",
    )
    args = parser.parse_args()

    base_dir = args.dir.resolve()
    if load_dotenv is not None:
        load_dotenv(base_dir / ".env")
        load_dotenv(base_dir / ".env.local", override=True)
    pedagogy = load_pedagogy(base_dir)

    if len(args.input) > 5:
        parser.error("At most 5 input resources allowed (got %d)." % len(args.input))

    source_texts: List[str] = []
    for p in args.input:
        path = p if p.is_absolute() else base_dir / p
        if not path.exists():
            raise FileNotFoundError(f"Input file not found: {path}")
        source_texts.append(load_file(path))

    style_samples = "" if args.no_style_samples else load_style_samples(base_dir)

    system, user = build_messages(
        pedagogy, source_texts, style_samples, args.topic
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

    # Output filter: optionally pass excerpt through the pedagogy review agent
    # (structured, student-friendly review per physics_pedagogy.md). Off by default.
    if args.filter_with_review:
        from review_document_agent import run_review as run_pedagogy_review
        excerpt = run_pedagogy_review(
            excerpt,
            api_key=api_key,
            base_dir=base_dir,
        )

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
