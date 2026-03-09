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
    source1_text: str,
    source2_text: Optional[str],
    style_samples: str,
    topic_hint: Optional[str],
) -> tuple[str, str]:
    """Build system and user messages for the LLM. source2_text is optional (two-source synthesis)."""
    has_two = bool(source2_text and source2_text.strip())
    two_guidance = (
        "\n\n## Two-source synthesis\n\nYou are receiving **two** source inputs. "
        "Synthesize them into a single, coherent excerpt in our voice. Use both sources to inform coverage and depth; express everything in your own words. "
        "When both sources cover a formula or definition that applies in multiple situations (e.g. work W = Fd cos θ), prefer one extended scenario explored across those situations: introduce the formula, then walk through each case (e.g. same direction, at an angle, opposite, perpendicular) with a **Conclusion:** per case, and end with a **Conclusions:** bullet list. When both sources cover a definition-and-law topic (e.g. reflection, law of reflection), prefer one concrete scenario, then define each term in order, then state the law, then one short consequence or special case; reference figures and use full-sentence captions. It is okay to focus on one clear thread rather than packing every subtopic from both inputs."
        if has_two
        else ""
    )
    system = f"""You are a physics textbook developmental editor. Your job is to transform raw or reference-style physics content into a fully original textbook excerpt that follows a specific pedagogy and narration style.
{two_guidance}

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

    if has_two:
        instruction = "Synthesize the following **two sources** into one textbook excerpt in our voice. Use both sources to inform your coverage; then write a fully **original** excerpt. Keep the **tone and approach**; use **original examples, analogies, and framing**—real-world but not copied from either source (different objects, numbers, and formula lead-ins). Do not reuse either source's examples (e.g. no body fat/bone, atmosphere/ocean, or relative-density style critiques from the input). Write as if you are a different author teaching the same topic."
    else:
        instruction = "Transform the following physics content into a fully **original** textbook excerpt. Keep the **tone and approach**; use **original examples, analogies, and framing**—real-world but not from the input (different objects, numbers, and how you introduce formulas). Do not reuse the input's examples or near-verbatim phrasing. Write as if you are a different author covering the same physics topic."

    user_parts = ["## Content to transform\n\n" + instruction, "---\n"]
    if topic_hint:
        user_parts.append(f"\nTopic/section focus: {topic_hint}\n")
    user_parts.extend(["### Source 1\n\n", source1_text.strip() or "(No text provided.)"])
    if has_two:
        user_parts.extend(["\n\n### Source 2\n\n", source2_text.strip()])
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
        help="Input file(s). If exactly two files: treated as Source 1 and Source 2 (synthesis). Otherwise: concatenated as Source 1.",
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

    if len(input_parts) == 2:
        source1_text, source2_text = input_parts[0], input_parts[1]
    else:
        source1_text = "\n\n---\n\n".join(input_parts)
        source2_text = None

    style_samples = "" if args.no_style_samples else load_style_samples(base_dir)

    system, user = build_messages(
        pedagogy, source1_text, source2_text, style_samples, args.topic
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
