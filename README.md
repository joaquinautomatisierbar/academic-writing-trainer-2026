# Academic Writing Trainer

Mobile PWA for Joaquin's 124 Academic Writing practice questions.

## Public URL

<https://joaquinautomatisierbar.github.io/academic-writing-trainer-2026/>

The client expires at `2026-09-25T18:00:00Z` (20:00 Europe/Zurich). The public `gh-pages` branch is automatically replaced by `deploy/expired.html` through `deploy/expire.yml` at the same scheduled time. The control branch contains only the expiry workflow and expired page, not the question bank.

## Local verification

```sh
npm test
npm run validate:data
npm run check:static
python3 -m http.server 4173
```

After one online visit, stop the local server and reload the same URL to verify the service-worker fallback.

## Content provenance

The prompts and choices come from 124 screenshots captured from Brian on 24 September 2026. Brian went offline before its answer key could be fully checked. The answers use an explicit `academic-review-after-brian-expiry` basis and the app discloses this in its settings.

## Manual expiry or rollback

Run the “Expire question bank” workflow manually in GitHub Actions. It force-replaces `gh-pages` with the expired page. To republish before the deadline, force-push the verified static app back to `gh-pages`.
