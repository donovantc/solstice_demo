# The Solstice Paradox

An interactive, responsive explainer of why London's sunsets begin getting later before the shortest day in winter.

## Features
- Dependency-free, draggable 3D-looking globe with a stylized world-map texture and a day/night terminator
- London marker, rotate and scroll/pinch zoom, reset camera
- Time-of-day scrubber, animated day, sunrise / solar noon / sunset shortcuts
- Visual 24-hour timeline showing the current daylight window
- Date slider across winter 2026–2027, sunrise/sunset chart, quiz and native sharing
- Accessible status text and a simplified map fallback if the local texture cannot load

## Run locally

Use any static file server (no build or npm dependencies):

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to Vercel

Import this repository via **Vercel → Add New → Project → Import Git Repository**.
Leave the framework preset as **Other**, with no build command or output directory.
`index.html` is the entrypoint. Vercel's normal Git integration will redeploy on subsequent pushes.

## Files
- `index.html` – layout, chart, solar-time calculations and quiz
- `earth.js` – dependency-free canvas globe, controls and astronomical sunlight shading
- `earth-texture.svg` – bundled stylized SVG map that needs no external image hosting
- `vercel.json` – static-site configuration

## Astronomical notes

All results are **approximate** for central London (51.5074° N, 0.1278° W), in GMT, covering 11 November 2026 to 20 January 2027.
The chart uses an apparent-horizon convention of -0.833° to account approximately for refraction and the Sun's radius, with solar transit equations similar to those popularised by SunCalc.

The purple marker is fixed to the astronomical winter solstice day, **21 December 2026**, though the minimum of a model's civil-day daylight length may differ by a few seconds on adjacent dates.
The globe depicts Earth's surface under approximately parallel sunlight; it is not a scale-accurate Earth–Sun system.

The globe's map is illustrative rather than geographically precise.
Further reading on the equation of time: https://aa.usno.navy.mil/faq/eqtime