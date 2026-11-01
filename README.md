# Wize Solutions website

Static site (single `index.html`). Deployed on Render as a static site, publish path `./`.

## NBN address check
The address checker runs in **preview mode** (results labelled SAMPLE) until a live
service-qualification endpoint is configured. To switch it on, add before the main script:

```html
<script>window.WIZE_NBN_API = "https://your-api.example.com/nbn-check";</script>
```

The endpoint receives `?address=...` and must return JSON:

```json
{ "technology": "FTTP", "maxSpeed": "Up to 1000 Mbps", "businessFibreZone": true,
  "eeBuild": "$0 build", "fiveG": "Strong", "starlink": "Available",
  "rec": "Business fibre primary + 5G failover" }
```

Back it with your NBN wholesale / aggregator service-qualification (SQ) API, called
server-side so API keys never reach the browser.
