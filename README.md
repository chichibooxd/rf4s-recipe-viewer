# rf4s-recipe-viewer

Offline-capable recipe lookup for Rune Factory 4 Special: crafting, forging, chemistry, and
cooking recipes with an inheritance-aware loadout editor. Vanilla JS PWA — no frameworks.

- **Specifications:** [specs.md](specs.md)
- **Implementation details:** [implementation.md](implementation.md)
- **Changelog:** [changelogs.md](changelogs.md)

## Usage

Serve the directory over HTTP(S) (any static server, e.g. `python3 -m http.server`) and open
`index.html`. Service Worker and installability require HTTPS (or `localhost`).

## Tests

```sh
npm test   # or: node test_custom_item.js && node test_smoke.mjs
```

`test_custom_item.js` covers the CustomItem model; `test_smoke.mjs` runs a DOM-stub
end-to-end pass over routing, filtering, pick mode, the loadout, and stat totals.
