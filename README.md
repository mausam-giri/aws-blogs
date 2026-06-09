# AWS CloudOps Notes

Static documentation site built with [Hugo](https://gohugo.io/) and the [Hugo Book](https://github.com/alex-shpak/hugo-book) theme. Runbooks, walkthroughs, and copy-paste examples for AWS CloudOps and DevOps.

## Prerequisites

- [Hugo **extended**](https://gohugo.io/installation/) (this project uses SCSS; extended edition required)
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 18+ (optional locally — only needed to rebuild the highlight.js bundle)

Verify Hugo:

```bash
hugo version
# hugo v0.163.0+extended ...
```

## Quick start

```bash
git clone <your-repo-url>
cd blogs

# Optional: install JS deps and rebuild syntax-highlighter bundle
npm ci
npm run build:hljs

# Local preview
hugo server -D

# Production build
hugo --minify
```

Open `http://localhost:1313/`. The generated site is written to `public/` (do not commit that folder).

## Project structure

```text
.
├── archetypes/          # Templates for new content
├── assets/              # SCSS, JS (custom styles, highlight.js, mermaid)
├── content/             # Guides, posts, examples
├── layouts/             # Hugo layout overrides
├── themes/hugo-book/    # Book theme (vendored)
├── hugo.toml            # Site configuration
├── package.json         # highlight.js build script
└── public/              # Build output (gitignored)
```

## Configuration

- **Local dev:** `baseURL` in `hugo.toml` defaults to `https://example.org/`.
- **GitHub Pages:** the CI workflow passes `--baseURL` from `actions/configure-pages`, so you do not need to change `hugo.toml` per environment.

For a **project site** (`https://<user>.github.io/<repo>/`), enable Pages with the workflow below — Hugo receives the correct base URL automatically.

## Deploy to GitHub Pages

Based on the [official Hugo + GitHub Pages guide](https://gohugo.io/hosting-and-deployment/hosting-on-github/).

### One-time setup

1. Push this repository to GitHub on the **`main`** branch.
2. In the repo: **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**.
3. Ensure the workflow file exists: `.github/workflows/hugo.yaml`.

### How it works

On every push to `main` (or manual **Actions → Build and deploy → Run workflow**):

1. Installs Hugo extended, Dart Sass, and Node.js
2. Runs `npm run build:hljs` and `hugo build --minify`
3. Uploads `public/` to GitHub Pages
4. Deploys to your Pages URL (shown in the workflow run)

### Permissions

The workflow requires:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

No personal access token is needed when using the default `GITHUB_TOKEN`.

## Development notes

| Task | Command |
|------|---------|
| Rebuild highlight.js | `npm run build:hljs` |
| Clear generated cache | Remove `resources/_gen` and `public/` |
| Lint / validate | `hugo --minify` (should exit 0) |

## Resources

- [Hugo documentation](https://gohugo.io/documentation/)
- [Hugo Book theme](https://github.com/alex-shpak/hugo-book)
- [Host on GitHub Pages (Hugo)](https://gohugo.io/hosting-and-deployment/hosting-on-github/)

## License

Content and site customizations: see repository license (if added). Hugo Book theme: [MIT](https://github.com/alex-shpak/hugo-book/blob/master/LICENSE).
