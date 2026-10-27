"use client"

import { useState, type ReactNode } from "react"
import { AlertTriangle, Copy, Loader2, MapPin, Route as RouteIcon, Timer, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ResponseView } from "./playground-response-view"

/**
 * Mapbox-specific response display for the playground.
 *
 * The generic viewer shows structure; maps responses need meaning: a place is
 * a place, a route has a distance and a duration, a contour is reachable area.
 * This view reads the normalized `results` contract and the provider `payload`
 * diagnostics and renders one section per maps operation — with a map panel
 * that loads real Mapbox static images THROUGH the runtime (`maps/staticImage`
 * with a `marker` or `path` overlay). The platform access token never reaches
 * the browser: the panel can only ask the runtime for a render, exactly like
 * any other playground call, and is billed the same way.
 *
 * Mapbox draws exactly one overlay per static image, so a panel is either a
 * pinned location or a polyline — never both.
 */

type Rec = Record<string, unknown>

export interface MapsCallOutcome {
  ok: boolean
  data?: unknown
  error?: { code?: string; message?: string }
}

export type MapsRunner = (operation: string, input: Rec) => Promise<MapsCallOutcome>

export interface MapsResultViewProps {
  /** Normalized response body, as captured in the session log. */
  json: string
  operation: string
  /** The request that produced it — used to seed previews (style, centre). */
  requestJson: string
  runMaps: MapsRunner
  /** Loads a follow-up request into the composer. */
  useInRequest: (operation: string, input: Rec) => void
  onCopy: (text: string) => void
}

/** Same centre the catalog samples use, so previews land somewhere sensible. */
const PREVIEW_CENTER = { longitude: 32.5828, latitude: 0.3136 }

const SIZES = [
  { label: "600×400", width: 600, height: 400 },
  { label: "800×500", width: 800, height: 500 },
  { label: "1000×640", width: 1000, height: 640 },
] as const

function parseObject(json: string): Rec | null {
  try {
    const value = JSON.parse(json) as unknown
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : null
  } catch {
    return null
  }
}

function asRecords(value: unknown): Rec[] {
  return Array.isArray(value) ? value.filter((v): v is Rec => v !== null && typeof v === "object") : []
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** [longitude, latitude] pairs from a GeoJSON coordinate array. */
function asLine(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return []
  const out: [number, number][] = []
  for (const point of value) {
    if (
      Array.isArray(point) &&
      typeof point[0] === "number" &&
      typeof point[1] === "number" &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      point[0] >= -180 &&
      point[0] <= 180 &&
      point[1] >= -90 &&
      point[1] <= 90
    ) {
      out.push([point[0], point[1]])
    }
  }
  return out
}

export function formatMeters(meters: number | null): string {
  if (meters === null) return "—"
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}

export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—"
  if (seconds < 60) return `${Math.round(seconds)} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—"
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(bytes < 1024 * 1024 ? 0 : 1)} KB`
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{label}</h3>
      {children}
    </section>
  )
}

function StatRow({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <dl className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-5">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-w-0 items-baseline gap-1.5">
          <dt className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{label}</dt>
          <dd className="truncate font-mono text-[12px] tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn("rounded-lg border border-border bg-muted/20 px-3 py-2.5", className)}>{children}</li>
}

/**
 * Loads one `maps/staticImage` render on demand. Every control (zoom, size,
 * retina) re-asks the runtime rather than touching Mapbox directly.
 */
function MapPanel({ seed, title, runMaps }: { seed: Rec; title: string; runMaps: MapsRunner }) {
  const [input, setInput] = useState<Rec>(seed)
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [url, setUrl] = useState<string | null>(null)
  const [meta, setMeta] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ code?: string; message?: string } | null>(null)

  async function load(next: Rec) {
    setPhase("loading")
    setFailure(null)
    setInput(next)
    const outcome = await runMaps("staticImage", next)
    const payload = (outcome.data as Rec | undefined)?.payload as Rec | undefined
    if (outcome.ok && typeof payload?.dataUrl === "string") {
      setUrl(payload.dataUrl)
      setMeta(
        `${formatBytes(asNumber(payload.byteLength ?? null))} · ${String(payload.contentType ?? "image")} · ${
          payload.reachable ? "reachable" : "unreachable"
        }`,
      )
      setPhase("ready")
      return
    }
    setPhase("error")
    setFailure(
      outcome.ok
        ? { message: "The runtime returned no image payload for this render." }
        : (outcome.error ?? { message: "The map render failed." }),
    )
  }

  const zoom = asNumber(input.zoom) ?? 12
  const fitted = input.fit === true
  const sized = SIZES.find((s) => s.width === input.width && s.height === input.height) ?? SIZES[1]

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">{title}</p>
        <div className="flex flex-wrap items-center gap-1">
          {!fitted ? (
            <div className="flex items-center gap-1 rounded-lg border border-border px-1">
              <button
                type="button"
                aria-label="Zoom out"
                disabled={zoom <= 0}
                onClick={() => void load({ ...input, zoom: Math.max(0, zoom - 1) })}
                className="p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <ZoomOut className="size-3.5" aria-hidden />
              </button>
              <span className="font-mono text-[11px] tabular-nums">z{zoom}</span>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={zoom >= 22}
                onClick={() => void load({ ...input, zoom: Math.min(22, zoom + 1) })}
                className="p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <ZoomIn className="size-3.5" aria-hidden />
              </button>
            </div>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              auto-frame
            </span>
          )}
          {SIZES.map((size) => (
            <button
              key={size.label}
              type="button"
              onClick={() => void load({ ...input, width: size.width, height: size.height })}
              aria-pressed={sized.label === size.label}
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors",
                sized.label === size.label
                  ? "border-transparent bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {size.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load({ ...input, retina: input.retina !== true })}
            aria-pressed={input.retina === true}
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors",
              input.retina === true
                ? "border-transparent bg-muted text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            2x
          </button>
        </div>
      </div>

      {phase === "ready" && url ? (
        <div className="flex flex-col gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={title}
            className="max-h-[min(70vh,560px)] w-full rounded-lg border border-border object-contain"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] text-muted-foreground">{meta}</p>
            <Button type="button" variant="ghost" size="xs" onClick={() => void load(input)}>
              Re-render
            </Button>
          </div>
        </div>
      ) : phase === "loading" ? (
        <div className="flex h-40 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-[12px] text-muted-foreground sm:h-56">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Rendering through the runtime…
        </div>
      ) : phase === "error" ? (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5">
          <p className="flex items-start gap-1.5 text-[12px] text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{failure?.message ?? "The map render failed."}</span>
          </p>
          {failure?.code === "runtime_pricing_unconfigured" ? (
            <p className="text-[11px] text-muted-foreground">
              <code className="font-mono">maps/staticImage</code> has no pricing rule yet — an admin must add one
              under Runtime → Pricing before maps can render.
            </p>
          ) : failure?.code === "runtime_capability_unavailable" ? (
            <p className="text-[11px] text-muted-foreground">
              No Mapbox provider on this deployment — check <code className="font-mono">MAPBOX_ACCESS_TOKEN</code>.
            </p>
          ) : null}
          <Button type="button" size="xs" variant="outline" onClick={() => void load(input)}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
          <p className="text-[12px] text-muted-foreground">
            {seed.path
              ? "Loads this polyline as a rendered Mapbox static image."
              : "Loads this location as a rendered Mapbox static image."}
          </p>
          <Button type="button" size="xs" onClick={() => void load(seed)}>
            Load map
          </Button>
          <p className="text-[10px] text-muted-foreground">
            One overlay per image (Mapbox limit). Rendered server-side — billed like any other runtime call.
          </p>
        </div>
      )}
    </div>
  )
}

function PlacesBlock({
  places,
  operation,
  runMaps,
  useInRequest,
  onCopy,
}: {
  places: Rec[]
  operation: string
  runMaps: MapsRunner
  useInRequest: (operation: string, input: Rec) => void
  onCopy: (text: string) => void
}) {
  const [selected, setSelected] = useState(0)
  const place = places[Math.min(selected, places.length - 1)]
  const lng = asNumber(place.longitude) ?? PREVIEW_CENTER.longitude
  const lat = asNumber(place.latitude) ?? PREVIEW_CENTER.latitude
  const name = typeof place.name === "string" ? place.name : `Result ${selected + 1}`

  return (
    <div className="flex flex-col gap-3">
      <Section label={`${places.length} place${places.length === 1 ? "" : "s"}`}>
        <ol className="flex flex-col gap-2">
          {places.map((each, index) => {
            const id = typeof each.id === "string" ? each.id : null
            const eLng = asNumber(each.longitude)
            const eLat = asNumber(each.latitude)
            return (
              <Card key={`${id ?? "place"}-${index}`} className={index === selected ? "ring-1 ring-primary/40" : undefined}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {typeof each.name === "string" ? each.name : `Result ${index + 1}`}
                      </p>
                      <p className="break-words text-[12px] leading-5 text-muted-foreground">
                        {typeof each.formattedAddress === "string"
                          ? each.formattedAddress
                          : "no address returned"}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {eLng !== null && eLat !== null ? `${eLng.toFixed(4)}, ${eLat.toFixed(4)}` : "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="xs"
                      variant={index === selected ? "secondary" : "outline"}
                      onClick={() => setSelected(index)}
                    >
                      Show on map
                    </Button>
                    {id ? (
                      <>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => useInRequest("placeDetails", { poiId: id })}
                        >
                          Look up details
                        </Button>
                        <Button type="button" size="xs" variant="ghost" onClick={() => onCopy(id)}>
                          <Copy aria-hidden />
                          {id.length > 22 ? `${id.slice(0, 12)}…${id.slice(-6)}` : id}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </ol>
      </Section>
      <MapPanel
        key={`${operation}-place-${lng}-${lat}`}
        title={`${name} · ${lng.toFixed(4)}, ${lat.toFixed(4)}`}
        seed={{ longitude: lng, latitude: lat, zoom: 13, width: 800, height: 500, marker: true }}
        runMaps={runMaps}
      />
    </div>
  )
}

function DirectionsBlock({
  routes,
  runMaps,
  useInRequest,
}: {
  routes: Rec[]
  runMaps: MapsRunner
  useInRequest: (operation: string, input: Rec) => void
}) {
  const [picked, setPicked] = useState(0)
  const route = routes[Math.min(picked, routes.length - 1)]
  const line = asLine((route.geometry as Rec | undefined)?.coordinates)

  return (
    <div className="flex flex-col gap-3">
      <Section label={`${routes.length} route${routes.length === 1 ? "" : "s"}`}>
        <ol className="flex flex-col gap-2">
          {routes.map((each, index) => {
            const legs = asRecords(each.legs)
            return (
              <Card key={index} className={index === picked ? "ring-1 ring-primary/40" : undefined}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <RouteIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground">
                        {index === 0 ? "Primary route" : `Alternative ${index}`}
                      </p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {legs.length > 0
                          ? `${legs.length} leg${legs.length === 1 ? "" : "s"}`
                          : "no legs returned"}
                      </p>
                    </div>
                  </div>
                  <StatRow
                    items={[
                      ["distance", formatMeters(asNumber(each.distance))],
                      ["duration", formatSeconds(asNumber(each.duration))],
                      ...legs
                        .slice(0, 3)
                        .map(
                          (leg, li) =>
                            [
                              `leg ${li + 1}`,
                              `${formatMeters(asNumber(leg.distance))} · ${formatSeconds(asNumber(leg.duration))}`,
                            ] as [string, string],
                        ),
                    ]}
                  />
                  <Button
                    type="button"
                    size="xs"
                    variant={index === picked ? "secondary" : "outline"}
                    onClick={() => setPicked(index)}
                  >
                    Draw on map
                  </Button>
                </div>
              </Card>
            )
          })}
        </ol>
      </Section>
      {line.length >= 2 ? (
        <MapPanel
          key={`directions-${picked}`}
          title={`Route ${picked + 1} · ${formatMeters(asNumber(route.distance))} · ${formatSeconds(asNumber(route.duration))}`}
          seed={{ path: line, fit: true, width: 800, height: 500, retina: true }}
          runMaps={runMaps}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-2.5 text-[11px] text-muted-foreground">
          This route carries no GeoJSON geometry, so it cannot be drawn. The runtime asks Mapbox for{" "}
          <code className="font-mono">geometries=geojson</code> — re-run the call if this body predates that.
        </p>
      )}
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="self-start"
        disabled={line.length < 2}
        onClick={() => useInRequest("directions", { coordinates: [line[0], line[line.length - 1]] })}
      >
        Re-send these endpoints
      </Button>
    </div>
  )
}

function IsochroneBlock({ features, runMaps }: { features: Rec[]; runMaps: MapsRunner }) {
  const [picked, setPicked] = useState(0)
  const rings = features.map((feature) => {
    const coordinates = (feature.geometry as Rec | undefined)?.coordinates
    return asLine(Array.isArray(coordinates) ? coordinates[0] : undefined)
  })
  const ring = rings[Math.min(picked, rings.length - 1)]
  const pickedProps = (features[Math.min(picked, features.length - 1)].properties as Rec | undefined) ?? {}

  return (
    <div className="flex flex-col gap-3">
      <Section label={`${features.length} reachable zone${features.length === 1 ? "" : "s"}`}>
        <ol className="flex flex-col gap-2">
          {features.map((feature, index) => {
            const props = (feature.properties as Rec | undefined) ?? {}
            const minutes = asNumber(props.contour_minutes)
            return (
              <Card key={index} className={index === picked ? "ring-1 ring-primary/40" : undefined}>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                      <Timer className="size-3.5 text-primary" aria-hidden />
                      {minutes !== null ? `${minutes} min reach` : String(props.contour ?? `zone ${index + 1}`)}
                    </p>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {rings[index].length} ring points
                      {typeof props.color === "string" ? ` · ${props.color}` : ""}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant={index === picked ? "secondary" : "outline"}
                    onClick={() => setPicked(index)}
                  >
                    Outline on map
                  </Button>
                </div>
              </Card>
            )
          })}
        </ol>
      </Section>
      {ring.length >= 3 ? (
        <MapPanel
          key={`isochrone-${picked}`}
          title={`Reachable area · ${String(pickedProps.contour_minutes ?? picked + 1)} min`}
          seed={{ path: ring, fit: true, width: 800, height: 500, pathWidth: 4 }}
          runMaps={runMaps}
        />
      ) : null}
    </div>
  )
}

function MatrixBlock({ payload }: { payload: Rec }) {
  const durations = Array.isArray(payload.durations) ? (payload.durations as unknown[]) : []
  const distances = Array.isArray(payload.distances) ? (payload.distances as unknown[]) : []
  const rows = durations.map((row) => (Array.isArray(row) ? row : []))
  const distanceRows = distances.map((row) => (Array.isArray(row) ? row : []))

  return (
    <Section label={`travel matrix · ${rows.length} origins`}>
      <ol className="flex flex-col gap-2">
        {rows.map((row, origin) => (
          <Card key={origin}>
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] font-medium text-foreground">From point {origin + 1}</p>
              <ul className="flex flex-col gap-1">
                {row.map((cell, dest) => {
                  const seconds = asNumber(cell)
                  const metres = asNumber(distanceRows[origin]?.[dest])
                  return (
                    <li key={dest} className="flex items-baseline justify-between gap-3 text-[12px]">
                      <span className="text-muted-foreground">to point {dest + 1}</span>
                      <span className="font-mono tabular-nums">
                        {seconds === null ? "no route" : `${formatSeconds(seconds)} · ${formatMeters(metres)}`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </Card>
        ))}
      </ol>
    </Section>
  )
}

function StyleBlock({
  payload,
  requested,
  runMaps,
}: {
  payload: Rec
  requested?: Rec
  runMaps: MapsRunner
}) {
  const layers = asRecords(payload.layers)
  const byType = new Map<string, number>()
  for (const layer of layers) {
    const type = typeof layer.type === "string" ? layer.type : "unknown"
    byType.set(type, (byType.get(type) ?? 0) + 1)
  }
  const styleId = typeof requested?.styleId === "string" ? requested.styleId : "streets-v12"
  const username = typeof requested?.username === "string" ? requested.username : "mapbox"
  const seed = {
    styleId: `${username}/${styleId}`,
    ...PREVIEW_CENTER,
    zoom: 12,
    width: 800,
    height: 500,
    marker: true,
  }

  return (
    <div className="flex flex-col gap-3">
      <Section label={`style · ${layers.length} layers`}>
        <Card className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-foreground">
            {typeof payload.name === "string" ? payload.name : `${username}/${styleId}`}
          </p>
          <StatRow
            items={[
              ["spec", `v${String(payload.version ?? "—")}`],
              ["layers", String(layers.length)],
              ["sources", String(Object.keys((payload.sources as Rec | undefined) ?? {}).length)],
              ["glyphs", payload.glyphs ? "yes" : "no"],
              ["sprite", payload.sprite ? "yes" : "no"],
            ]}
          />
          <div className="flex flex-wrap gap-1">
            {[...byType.entries()].map(([type, count]) => (
              <span
                key={type}
                className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {type} ×{count}
              </span>
            ))}
          </div>
        </Card>
      </Section>
      <MapPanel key={`style-${username}-${styleId}`} title={`${username}/${styleId} as rendered`} seed={seed} runMaps={runMaps} />
    </div>
  )
}

function StaticImageBlock({
  payload,
  requested,
  runMaps,
}: {
  payload?: Rec
  requested?: Rec
  runMaps: MapsRunner
}) {
  const dataUrl = typeof payload?.dataUrl === "string" ? payload.dataUrl : null
  const path = asLine(requested?.path)
  const seed: Rec = {
    longitude: asNumber(requested?.longitude) ?? PREVIEW_CENTER.longitude,
    latitude: asNumber(requested?.latitude) ?? PREVIEW_CENTER.latitude,
    zoom: asNumber(requested?.zoom) ?? 12,
    width: asNumber(requested?.width) ?? 800,
    height: asNumber(requested?.height) ?? 500,
    ...(typeof requested?.styleId === "string" ? { styleId: requested.styleId } : {}),
    ...(path.length >= 2 ? { path, fit: true } : { marker: requested?.marker !== false }),
    ...(typeof requested?.retina === "boolean" ? { retina: requested.retina } : {}),
  }

  return (
    <div className="flex flex-col gap-3">
      <Section label="rendered image">
        {dataUrl ? (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt="maps/staticImage result"
              className="max-h-[min(70vh,560px)] w-full rounded-lg border border-border object-contain"
            />
            <StatRow
              items={[
                ["size", formatBytes(asNumber(payload?.byteLength ?? null))],
                ["type", String(payload?.contentType ?? "image/png")],
                ["reachable", payload?.reachable === true ? "yes" : "no"],
              ]}
            />
            {typeof payload?.note === "string" ? (
              <p className="text-[11px] text-muted-foreground">{payload.note}</p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-2.5 text-[11px] text-muted-foreground">
            This response carried no inline image — load a fresh render below.
          </p>
        )}
      </Section>
      <MapPanel key="staticImage-adjust" title="Adjust and re-render" seed={seed} runMaps={runMaps} />
    </div>
  )
}

function TilesBlock({ payload, requested }: { payload: Rec; requested?: Rec }) {
  return (
    <Section label="tile fetch">
      <Card className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-foreground">
          {payload.reachable === true ? "Tile endpoint reachable" : "Tile not returned"}
        </p>
        <StatRow
          items={[
            ["tileset", String(requested?.tilesetId ?? "—")],
            [
              "z/x/y",
              `${String(requested?.z ?? "—")}/${String(requested?.x ?? "—")}/${String(requested?.y ?? "—")}`,
            ],
            ["bytes", formatBytes(asNumber(payload.byteLength ?? null))],
            ["type", String(payload.contentType ?? "—")],
          ]}
        />
        <p className="text-[11px] text-muted-foreground">
          Vector tiles are binary, so the runtime reports what came back instead of parsing it — this proves the key
          reaches <code className="font-mono">/v4/…</code> for that tileset.
        </p>
      </Card>
    </Section>
  )
}

export function MapsResultView({
  json,
  operation,
  requestJson,
  runMaps,
  useInRequest,
  onCopy,
}: MapsResultViewProps) {
  const body = parseObject(json)
  if (!body) return <ResponseView json={json} />

  const places = asRecords(body.results)
  const payload = (body.payload as Rec | undefined) ?? null
  const requested = parseObject(requestJson)?.input as Rec | undefined

  if (places.length > 0) {
    return (
      <PlacesBlock
        places={places}
        operation={operation}
        runMaps={runMaps}
        useInRequest={useInRequest}
        onCopy={onCopy}
      />
    )
  }

  if (operation === "directions" && payload) {
    const routes = asRecords(payload.routes)
    if (routes.length > 0) return <DirectionsBlock routes={routes} runMaps={runMaps} useInRequest={useInRequest} />
  }

  if (operation === "isochrone" && payload) {
    const features = asRecords(payload.features)
    if (features.length > 0) return <IsochroneBlock features={features} runMaps={runMaps} />
  }

  if (operation === "matrix" && payload && Array.isArray(payload.durations)) {
    return <MatrixBlock payload={payload} />
  }

  if (operation === "staticImage") return <StaticImageBlock payload={payload ?? undefined} requested={requested} runMaps={runMaps} />
  if (operation === "tilesMetadata" && payload) return <TilesBlock payload={payload} requested={requested} />
  if (operation === "styleSchema" && payload)
    return <StyleBlock payload={payload} requested={requested} runMaps={runMaps} />

  return <ResponseView json={json} />
}
