// Transient probe round 3 (deleted after use): stroke variants, auto-without-
// overlay, and the path point cap around 300. No token in output.
import { readFileSync } from "node:fs"

const env = readFileSync(".env.local", "utf8")
const token = env.match(/^MAPBOX_ACCESS_TOKEN="?([^"\n]+)"?/m)?.[1]
const clean = (s) => String(s).replaceAll(token, "<token>").slice(0, 180)
const enc = (pts) => pts.map(([lng, lat]) => `${lng},${lat}`).join(",")
const A = [32.5825, 0.3175]
const B = [32.4615, 0.0532]
const LINE = [A, [32.52, 0.2], B]

async function probe(label, seg) {
  const url = new URL(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${seg}`)
  url.searchParams.set("access_token", token)
  let out = `${label}: `
  try {
    const res = await fetch(url, { redirect: "error" })
    const ct = res.headers.get("content-type") ?? "?"
    out += ct.startsWith("image/")
      ? `${res.status} image ${(await res.arrayBuffer()).byteLength}B`
      : `${res.status} ${clean(await res.text())}`
  } catch (e) {
    out += `ERR ${clean(e instanceof Error ? e.message : e)}`
  }
  console.log(out)
}

// stroke variants
await probe("stroke-full", `path-10+000000-ffffff+4(${enc(LINE)})/auto/600x400`)
await probe("stroke-noplus", `path-10+000000-ffffff(${enc(LINE)})/auto/600x400`)
await probe("stroke-only", `path+000000(${enc(LINE)})/auto/600x400`)
await probe("width1", `path-1+ff0000(${enc(LINE)})/auto/600x400`)
await probe("width20", `path-20+ff0000(${enc(LINE)})/auto/600x400`)
await probe("width21", `path-21+ff0000(${enc(LINE)})/auto/600x400`)

// auto without overlay
await probe("auto-nolayover", `auto/600x400`)
await probe("plain-center", `${A[0]},${A[1]},12/600x400`)

// name variants of markers
await probe("default-marker", `marker-s-l+000000(${A[0]},${A[1]})/auto/600x400`)
await probe("pin-s", `pin-s+000000(${A[0]},${A[1]})/auto/600x400`)
await probe("pin-m-A", `pin-m-A+000000(${A[0]},${A[1]})/auto/600x400`)
await probe("pin-s-AB", `pin-s-AB+000000(${A[0]},${A[1]})/auto/600x400`)

// padding + auto
await probe("pad", `path-6+00b0ff(${enc(LINE)})/auto/600x400?padding=40`.replace("?padding=40", ""))

// point cap near 300
for (const n of [310, 320]) {
  const pts = Array.from({ length: n }, (_, i) => [32.46 + (i / n) * 0.12, 0.05 + (i / n) * 0.27])
  await probe(`path-${n}`, `path-6+00b0ff(${enc(pts)})/auto/600x400`)
}

// decimal precision: 4 vs 6 dp
await probe("dp6", `path-6+00b0ff(${enc([[32.4615001, 0.0532001], [32.5, 0.2], [32.5825, 0.3175]])})/auto/600x400`)
