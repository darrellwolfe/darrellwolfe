# Darrell Wolfe Website (Quarto + GitHub Pages)

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
