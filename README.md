# Darrell Wolfe Website

This repository is the source for [Darrell Wolfe, Storyteller](https://darrellwolfe.github.io/darrellwolfe/), a static Quarto website that brings together Darrell's author platform, biblical studies, personal essays, creative writing, data storytelling, professional portfolio, and browser-based demonstrations.

The site is published through GitHub Pages from the generated `docs/` directory.

## Start Here

1. Read this `README.md` before changing the site.
2. Read `_CurrentTask1.txt` when it exists; it contains the focused request for the current work session.
3. Check `git status` and preserve unrelated or pre-existing work.
4. Review the relevant source pages and nearby examples before creating or editing content.
5. Make changes only in this repository unless the task explicitly authorizes changes elsewhere.
6. Render or run the most relevant check before considering the work complete.

## Site Areas

- Home and overall navigation: `index.qmd` and `_quarto.yml`
- Author biography: `author/index.qmd`
- NYPB: `nypb/index.qmd`
- Data Nerd landing page: `data-nerd/index.qmd`
- Writing hub and tags: `posts/index.qmd` and `posts/tags/index.qmd`
- Personal essays: `posts/personal/`
- Biblical studies: `posts/biblical/`
- Creative writing: `posts/writing/`
- Data Nerd posts: `posts/data-nerd/`
- Portfolio: `portfolio/`
- Standalone browser demonstrations: `demos/`
- Unpublished imported and working material: `drafts/`

Section index pages use Quarto listings to discover dated `.qmd` files. Published posts should therefore use a filename beginning with an ISO date, such as `2026-07-29-example-title.qmd`, and valid YAML front matter containing at least `title`, `date`, `draft`, and appropriate `categories`.

## Technology and Repository Layout

```text
_quarto.yml        Quarto project, navigation, rendering, and site metadata
assets/            Shared CSS, includes, and static data
images/            Site-wide image assets
posts/             Published writing and section listing pages
portfolio/         Professional and author portfolio pages
demos/             Standalone HTML/CSS/JavaScript demonstrations
drafts/            Excluded from normal site renders
scripts/           Build, cleanup, import, tag, and asset-sync helpers
docs/              Generated GitHub Pages output
```

The source of truth is the Quarto source and supporting assets outside `docs/`. Do not hand-edit generated files in `docs/`; regenerate them from source.

The project uses:

- Quarto for site generation
- Markdown/Quarto (`.qmd`) for pages and posts
- HTML, CSS, and JavaScript for standalone demonstrations and site enhancements
- PowerShell for the local build and content-maintenance workflow
- R only where a page or future data project specifically requires it

## Local Development

Prerequisites:

- Git
- Quarto
- PowerShell
- Optional R installation for content that executes R code

Preview with live reload:

```powershell
quarto preview
```

Build the full static site:

```powershell
quarto render
```

The repository helper provides the normal workflows:

```powershell
./scripts/site.ps1 -Action build
./scripts/site.ps1 -Action quick
./scripts/site.ps1 -Action preview
./scripts/site.ps1 -Action check
```

In VS Code, `Ctrl+Shift+B` runs the full **Build All** task. Use **Terminal > Run Build Task... > Build Quick (Changed Content)** for a faster incremental render while drafting.

Build commands also synchronize shared CSS and standalone demo assets into `docs/`, preserving the prebuilt assessor demo bundle when the repository is moved to a new location.

## Content Guidelines

- Preserve Darrell's first-person voice and intended argument when copyediting.
- Correct spelling, grammar, broken character encoding, malformed links, and formatting unless the task requests a verbatim transcription.
- Do not silently invent citations, dates, quotations, or factual claims.
- Preserve academic citations and bibliographies when converting papers to posts.
- Use Markdown rather than pasted Blogger HTML for new content.
- Keep images local when practical and use web-compatible formats such as PNG, JPG, WebP, or SVG.
- Review existing posts in the target section for front-matter and formatting conventions.
- Keep unfinished content in `drafts/` or mark it `draft: true`; published section posts normally use `draft: false`.

Imported Blogger content may contain escaped Markdown, mojibake, or latent HTML. The scripts in `scripts/` support import and cleanup work, but broad mechanical cleanup should be reviewed carefully and kept separate from unrelated content changes.

## Data and Demo Assets

- Keep files specific to a demo inside that demo folder, for example `demos/parcel-map/data/`.
- Keep genuinely shared static datasets under `assets/data/`.
- Keep all components of a shapefile together and convert geometry to GeoJSON or another browser-friendly format when practical.
- Use fenced code blocks for code shown in articles, and link to repository files when readers should be able to download or inspect a complete example.
- Do not commit secrets, live credentials, private work data, or restricted county data. Use synthetic or public data for portfolio examples when the live system is unavailable.

## Publishing

The configured output directory is `docs/`.

1. Render and verify the site.
2. Push the intended source and generated output to `main`.
3. GitHub Pages should be configured for **Deploy from a branch**, using `main` and `/docs`.

Do not publish, commit, or push unless the current task asks for it.

## AI Working Instructions

For each work session, read the project background first and then focus on `_CurrentTask1.txt` or the user's current request. Complete the requested work, verify it in proportion to its risk, summarize the result, and state any limitations.

When working in this repository:

- Search existing content and scripts before creating a duplicate solution.
- Read a referenced source file fully before adapting it.
- Treat other repositories under `Z:\_CodeRepos` as read-only context unless explicitly instructed otherwise.
- Keep changes scoped to this website and preserve unrelated user edits.
- Prefer the established Quarto and PowerShell workflows.
- If a normal project dependency is missing, install it through the repository's established workflow when safe and record any lasting prerequisite or setup change here.
- Do not replace working behavior with placeholders.
- Do not modify generated `docs/` pages directly.
- Validate new posts by rendering them, and run a full render when shared configuration, navigation, CSS, templates, or scripts change.
- Report warnings that remain after validation, distinguishing pre-existing site-wide warnings from problems introduced by the current change.

## Current Maintenance Notes

Potential future work already identified:

- Decide how to present data projects whose live systems are unavailable, using screenshots, synthetic CSV data, or both.
- Convert remaining desired drafts and their images to web-compatible formats, then remove drafts that will not be retained.
- Continue replacing malformed imported HTML with clean `.qmd` Markdown and resolve Quarto warnings such as implicitly closed `Div` blocks.
