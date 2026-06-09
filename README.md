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
git clone --recurse-submodules <your-repo-url>
cd blogs

# If you already cloned without submodules:
git submodule update --init --recursive

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

- **Published URL:** [https://mausam-giri.github.io/aws-blogs/](https://mausam-giri.github.io/aws-blogs/) (GitHub Pages project site)
- **Local dev:** `hugo server` serves at `http://localhost:1313/` — `baseURL` in `hugo.toml` is for production links only.
- **CI:** the workflow passes `--baseURL` from `actions/configure-pages` (same `github.io` URL when no custom domain is set).

### Do not use a custom domain on this repo

If your apex domain (`mausamgiri-dev.me`) already hosts a **Next.js** app, leave GitHub Pages on the default **`github.io`** URL only.

**If `https://mausam-giri.github.io/aws-blogs/` redirects to `mausamgiri-dev.me`**, a custom domain is still enabled on this repo. Fix it in GitHub (not in Hugo):

1. **github.com/mausam-giri/aws-blogs** → **Settings** → **Pages**
2. Under **Custom domain**, click **Remove** (or clear the field and save)
3. Wait a few minutes, then open `https://mausam-giri.github.io/aws-blogs/` again — it should load without redirecting

The CI workflow pins `HUGO_BASEURL` to `github.io` so builds stay correct even if Pages settings were wrong before.

## Deploy to GitHub Pages

Based on the [official Hugo + GitHub Pages guide](https://gohugo.io/hosting-and-deployment/hosting-on-github/).

### One-time setup

1. Push this repository to GitHub on the **`main`** branch.
2. In the repo: **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**.
3. **Custom domain:** leave empty (use `https://mausam-giri.github.io/aws-blogs/`).
4. Ensure the workflow file exists: `.github/workflows/hugo.yaml`.
5. Link from your Next.js site if you want, e.g. `href="https://mausam-giri.github.io/aws-blogs/"` — do not try to mount this Hugo site at `/aws-blogs/` on the same domain as Next.js without a reverse proxy.

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
