# Share images

Upload-ready images for the places that take a picture by hand.

| File                        | Size       | Use                                                                           |
| --------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `github-social-preview.png` | 1280 x 640 | The repository's social preview (Settings, Social preview).                   |
| `og-default-1200x630.png`   | 1200 x 630 | The site card: the same image as `/og/site.png`. For profiles and listings.   |
| `earth-1200x630.png`        | 1200 x 630 | The artwork alone, with no text: sky, Earth and the cyan edge.                |

The Earth is centred on the midpoint of Helsinki and Isafjordur, and painted in the site's colours.

Regenerate all three, with the same bytes each time:

```sh
pnpm --filter dox run social-preview
```

This folder is outside `src/` and `public/`, so the site build does not publish it.

Imagery: NASA Earth Observatory, Blue Marble Next Generation (public domain).
