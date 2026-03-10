# Darrell Wolfe Website (Quarto + GitHub Pages)

URL: https://darrellwolfe.github.io/darrellwolfe/


Tasks:

Figure out how to do data projects when several are on systems I cannot access here, either screenshots, or maybe better test-data in csv for localized examples, or both. 

Update all draft posts to PNG/JPG issues, or, move the remaining posts you want move and run that on those, then delete what you're not going to use. 

When rendering, I'm seeing lots of things like this: "[WARNING] Div at line 654 column 5 unclosed at line 706 column 1, closing implicitly. " let's fix those in all the posts. Or should we complete convert all the posts to .qmd markdown and get rid of any latent HTML from the original blogger import? 

This repository is a static Quarto website for:

- Professional/author homepage
- Writing sections (Personal, Biblical Studies, Creative Writing)
- Portfolio project writeups
- Standalone demo pages (maps/charts)

## Prerequisites

1. Install Quarto: https://quarto.org/docs/get-started/
2. (Optional) Install Git for publishing workflow.

## Local Development

Preview with live reload:

```bash
quarto preview
```

Build the static site to `docs/`:

```bash
quarto render
```

Run the helper script directly (PowerShell):

```powershell
./scripts/site.ps1 -Action build
./scripts/site.ps1 -Action quick
./scripts/site.ps1 -Action preview
./scripts/site.ps1 -Action check
```

The helper build commands also sync shared CSS and standalone demo assets into `docs/` so the published site includes the dashboard pages and their supporting files. They also refresh the assessor dashboard's derived `demo-data.json` bundle when the source assessor CSV exports change.

In VS Code:

- Use `Ctrl+Shift+B` to run **Build All** (full clean render).
- Use `Terminal > Run Build Task...` and choose **Build Quick (Changed Content)** for faster incremental renders while drafting.

## GitHub Pages Setup

This project is configured to render into `/docs`.

1. Push to `main`.
2. In GitHub repo settings, open **Pages**.
3. Set source to **Deploy from a branch**.
4. Select branch `main` and folder `/docs`.

## Content Locations

- Homepage: `index.qmd`
- Writing hub: `posts/index.qmd`
- Personal posts: `posts/personal/`
- Biblical studies posts: `posts/biblical/`
- Creative writing posts: `posts/writing/`
- Portfolio landing page: `portfolio/index.qmd`
- Portfolio project pages: `portfolio/projects/`
- Demo landing page: `demos/index.qmd`
- Standalone demos: `demos/<demo-name>/`
- Shared site CSS: `assets/css/site.css`
- Shared static data: `assets/data/`

## Notes for Data + Code Assets

- Parcel and map files for a specific demo should live in that demo folder, for example: `demos/parcel-map/data/`.
- Keep larger shared datasets in `assets/data/`.
- For shapefiles (`.shp`, `.dbf`, `.shx`, etc.), keep the full set together and convert to GeoJSON for browser maps when possible.
- You can show code in posts/project pages as fenced code blocks, and you can also link to standalone files in the repo for downloadable/viewable examples.
