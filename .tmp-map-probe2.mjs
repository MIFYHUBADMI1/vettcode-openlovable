// Transient probe round 2 (deleted after use): isolate overlay combination
// rules, marker label syntax, point/URL caps. No token in output.
import { readFileSync } from "node:fs"

const env = readFileSync(".env.local", "utf8")
const token = env.match(/^MAPBOX_ACCESS_TOKEN="?([^"\n]+)"?/m)?.[1]
const clean = (s) => String(s).replaceAll(token, "<token>").slice(0, 200)
const enc = (pts) => pts.map(([lng, lat]) => `${lng},${lat}`).join(",")

const A = [32.5825, 0.3175]
const B = [32.4615, 0.0532]
const MID = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]
const LINE = [A, [32.52, 0.2], B]
const POS = `${MID[0]},${MID[1]},10/600x400`

async function probe(label, overlays, position = POS) {
  const path = `/styles/v1/mapbox/streets-v12/static/${overlays.join("/")}/${position}`
  const url = new URL(`https://api.mapbox.com${path}`)
  url.searchParams.set("access_token", token)
  let out = `${label}: ${path.length}chars -> `
  try {
    const res = await fetch(url, { redirect: "error" })
    const ct = res.headers.get("content-type") ?? "?"
    if (ct.startsWith("image/")) {
      out += `${res.status} image ${(await res.arrayBuffer()).byteLength}B`
    } else out += `${res.status} ${clean(await res.text())}`
  } catch (e) {
    out += `ERR ${clean(e instanceof Error ? e.message : e)}`
  }
  console.log(out)
}

const pin = (c, color = "0f6bd3") => `pin-s+${color}(${c})`
const pinL = (c, color = "0f6bd3") => `pin-l+${color}(${c})`
const pathOv = (pts, width = 6, color = "00b0ff") => `path-${width}+${color}(${enc(pts)})`

// single overlays (controls)
await probe("1pin", [pin(A)])
await probe("1pinL", [pinL(A)])
await probe("1path", [pathOv(LINE)])

// labelled markers
await probe("pin-l-label", [`pin-l-A+0f6bd3(${A})`])
await probe("pin-s-label", [`pin-s-B+e31a1c(${A})`])
await probe("marker-simple", [`marker(${A[0]},${A[1]})`])

// two overlays
await probe("2pins", [pin(A), pin(B, "e31a1c")])
await probe("pin+path", [pin(A), pathOv(LINE)])
await probe("path+pin", [pathOv(LINE), pin(A)])
await probe("2paths", [pathOv(LINE), pathOv([A, MID, [32.6, 0.35]], 4, "ff7f00")])

// three overlays
await probe("2pins+path", [pin(A), pin(B, "e31a1c"), pathOv(LINE)])

// auto extent forms
await probe("auto-2pins", [pin(A), pin(B, "e31a1c")], "auto/600x400")
await probe("auto-1pin", [pin(A)], "auto/600x400")
await probe("auto-path", [pathOv(LINE)], "auto/600x400")

// point caps
for (const n of [150, 250, 300, 350]) {
  const pts = Array.from({ length: n }, (_, i) => [32.46 + (i / n) * 0.12, 0.05 + (i / n) * 0.27])
  await probe(`path-${n}`, [pathOv(pts)])
}

// retina with overlays
await probe("retina-pin", [pin(A)], `${MID[0]},${MID[1]},10/600x400@2x`)
