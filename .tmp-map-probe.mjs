// Transient probe (deleted after use): verifies Mapbox static-image overlay
// syntax and directions geojson geometry against the live API. Prints status,
// content-type, byte length and sanitized errors only — never the token.
import { readFileSync } from "node:fs"

const env = readFileSync(".env.local", "utf8")
const token = env.match(/^MAPBOX_ACCESS_TOKEN="?([^"\n]+)"?/m)?.[1]
if (!token) {
  console.log("NO TOKEN")
  process.exit(1)
}

const clean = (s) => String(s).replaceAll(token, "<token>").slice(0, 220)
const enc = (pts) => pts.map(([lng, lat]) => `${lng},${lat}`).join(",")

async function probe(label, path, params = {}) {
  const url = new URL(`https://api.mapbox.com${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  url.searchParams.set("access_token", token)
  let out = `${label}: `
  try {
    const res = await fetch(url, { redirect: "error" })
    const ct = res.headers.get("content-type") ?? "?"
    if (ct.startsWith("image/")) {
      const buf = await res.arrayBuffer()
      out += `${res.status} ${ct} ${buf.byteLength}B`
    } else {
      const text = await res.text()
      out += `${res.status} ${ct} ${clean(text)}`
    }
  } catch (e) {
    out += `ERR ${clean(e instanceof Error ? e.message : e)}`
  }
  console.log(out)
}

const kampala = [32.5825, 0.3175]
const entebee = [32.4615, 0.0532]
const mid = [(kampala[0] + entebee[0]) / 2, (kampala[1] + entebee[1]) / 2]
const line = [kampala, [32.52, 0.2], entebee]

// 1. plain
await probe("plain", `/styles/v1/mapbox/streets-v12/static/${mid[0]},${mid[1]},10/600x400`)

// 2. path overlay, canonical form path-{width}+{fill}-{stroke}+{strokeWidth}(coords)
await probe(
  "path-1",
  `/styles/v1/mapbox/streets-v12/static/path-12+00b0ff-ffffff+4(${enc(line)})/${mid[0]},${mid[1]},10/600x400`,
)

// 3. path without stroke part
await probe("path-nostroke", `/styles/v1/mapbox/streets-v12/static/path-6+00b0ff(${enc(line)})/${mid[0]},${mid[1]},10/600x400`)

// 4. two pins then path
await probe(
  "pins+path",
  `/styles/v1/mapbox/streets-v12/static/pin-s-l+0f6bd3(${kampala})/pin-s-l+e31a1c(${entebee})/path-12+00b0ff-ffffff+4(${enc(line)})/${mid[0]},${mid[1]},10/600x400`,
)

// 5. path then pins (ordering check)
await probe(
  "path+pins",
  `/styles/v1/mapbox/streets-v12/static/path-12+00b0ff-ffffff+4(${enc(line)})/pin-s-l+0f6bd3(${kampala})/${mid[0]},${mid[1]},10/600x400`,
)

// 6. auto bbox form: coordinates/zoom replaced by the overlay extent
await probe(
  "auto-bbox",
  `/styles/v1/mapbox/streets-v12/static/pin-s-l+0f6bd3(${kampala})/pin-s-l+e31a1c(${entebee})/auto/600x400`,
)

// 7. labelled marker
await probe("labelled", `/styles/v1/mapbox/streets-v12/static/marker-label-A+0f6bd3(${kampala})/${kampala[0]},${kampala[1]},12/600x400`)
await probe("pin-labelled", `/styles/v1/mapbox/streets-v12/static/pin-l-label-A+0f6bd3(${kampala})/${kampala[0]},${kampala[1]},12/600x400`)

// 8. dense path (many points) — find the coordinate-count limit
for (const n of [50, 200, 400, 800]) {
  const pts = Array.from({ length: n }, (_, i) => [32.46 + (i / n) * 0.12, 0.05 + (i / n) * 0.27])
  await probe(`path-${n}pts`, `/styles/v1/mapbox/streets-v12/static/path-8+00b0ff(${enc(pts)})/auto/600x400`)
}

// 9. multiple path overlays
await probe(
  "two-paths",
  `/styles/v1/mapbox/streets-v12/static/path-8+00b0ff-ffffff+2(${enc(line)})/path-8+ff7f00-ffffff+2(${enc([kampala, [32.6, 0.35], mid])})/auto/600x400`,
)

// 10. @2x retina
await probe("retina", `/styles/v1/mapbox/streets-v12/static/${kampala[0]},${kampala[1]},12/600x400@2x`)

// 11. directions with geojson geometries
const dir = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${kampala.join(",")};${entebee.join(",")}`)
dir.searchParams.set("geometries", "geojson")
dir.searchParams.set("access_token", token)
const dres = await fetch(dir, { redirect: "error" })
const djson = await dres.json().catch(() => null)
const r0 = djson?.routes?.[0]
console.log(
  `directions geojson: ${dres.status} keys=${Object.keys(r0 ?? {}).join(",")} coordType=${Array.isArray(r0?.geometry?.coordinates) ? r0.geometry.coordinates.length : typeof r0?.geometry}`,
)
