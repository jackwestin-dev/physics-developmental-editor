# Physics Textbook Developmental Editor

Transform raw or reference-style physics content into textbook excerpts that match a consistent tone and narration style.

## Contents

- **pedagogy.md** — Style guide and pedagogy rules (voice, structure, don’ts). Derived from the `jw_*.md` sample excerpts.
- **agent.py** — CLI agent that reads input + pedagogy (and optional style samples), calls Claude, and writes an excerpt.
- **Next.js app (Vercel)** — Web UI: two source boxes (text and/or screenshot each), optional topic, generate excerpt. Runs without an API key (you'll be prompted to add one when you hit Generate).

## Setup

```bash
pip install -r requirements.txt
```

Set your API key:

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

## Usage

Generate an excerpt from one or more input files:

```bash
# Single input (output goes to excerpt_output.md by default)
python3 agent.py third_law_sample1.md

# Single input with topic hint and custom output path
python3 agent.py third_law_sample1.md --topic "Newton's third law" -o my_excerpt.md

# Two sources (synthesis into one excerpt)
python3 agent.py source1.md source2.md -o excerpt_output.md

# Three or more inputs concatenated as Source 1
python3 agent.py sample1.md sample2.md sample3.md -o combined_excerpt.md

# Without using jw_*.md style samples (pedagogy only)
python3 agent.py third_law_sample1.md --no-style-samples
```

By default the agent:

1. Loads **pedagogy.md** from the current directory (or `--dir`).
2. Loads all **jw_*.md** files in that directory as style reference excerpts.
3. Sends input + pedagogy + style samples to Claude and writes the result to **excerpt_output.md** (or `-o` path).

## Input vs output

- **Input**: One or two sources—text and/or screenshots. In the app, Source 1 and Source 2 can each have pasted text and/or an uploaded image. With two sources, the agent synthesizes both into one excerpt in your voice.
- **Output**: Narrative excerpt in the style of the `jw_*` samples (concrete scenarios, second-person “you,” misconception handling, clear conclusions).

## Pedagogy file

Edit **pedagogy.md** to refine tone, section structure, and rules. The agent uses it as the main instruction set; `jw_*.md` files are optional style examples.

---

## Vercel app (web UI)

The app runs **without an API key**: you can open it and use the form; when you click "Generate excerpt," you'll get a clear message to add `ANTHROPIC_API_KEY` if it isn't set.

### Local dev

```bash
npm install
cp .env.local.example .env.local   # optional: add ANTHROPIC_API_KEY for generation
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Add one or two sources (paste text and/or upload a screenshot in Source 1 and optionally Source 2), optionally set a topic and "Use style samples," then click **Generate excerpt**. With two sources, the editor synthesizes both into one excerpt in your pedagogy and voice.

### Deploy to Vercel

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
2. (Optional) In Project → Settings → Environment Variables, add `ANTHROPIC_API_KEY` so generation works in production.
3. Deploy. The app will build with `next build` and serve the same UI; generation works only if the env var is set.
