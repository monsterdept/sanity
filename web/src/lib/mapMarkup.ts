/**
 * The map as a string of SVG, with no window.
 *
 * A report is moving to a renderer that draws the map's picture without staging it on screen:
 * the pane was re-rooted and redrawn for every figure and copied off the live element, which
 * is why a report covered the window while it ran. This is the other way in — the same element
 * `Sunburst` draws, rendered by `react-dom/server` from explicit props. It runs in Node and it
 * runs inside the webview beside the live map, and nothing it does touches the page, so the
 * two can happen at once.
 *
 * **Its own module because of what it imports.** `react-dom/server` is a renderer the window
 * never needs, and the window's own map imports the tooltip. Kept
 * apart, this file reaches neither: the picture is `MapArt`, and `MapArt` reaches only layout,
 * colour and label code.
 */
import { createElement } from 'react'
// **The browser build, named, in Node too.** `react-dom/server` resolves to the Node build under
// Node, and that one reaches for `util` at load — which a bundled ES module cannot `require`.
// The browser build needs nothing past `react` and `react-dom`, and it is what the webview gets.
import { renderToStaticMarkup } from 'react-dom/server.browser'
import { MapSvg, mapScene, spotsOf, type MapArtProps, type Spot } from '../components/MapArt'

export interface MapMarkup {
  /** One `<svg data-sunburst>` element. Colours are `var(--token)` as the window writes them;
   *  resolving them is the translator's business. */
  markup: string
  /** The same numbers as the markup's `viewBox`, as numbers: x, y, width, height. */
  viewBox: [number, number, number, number]
  /**
   * Every wedge a tagged render marks with `data-node`, by the same id, with the path drawn for
   * it and its arc in radians and user units.
   *
   * **Worked out from the layout, not parsed back out of the markup** — by `spotsOf`, which
   * walks what `MapSvg` walks. Computed whether or not `tagNodes` is set; with it set, these are
   * exactly the ids in the markup, which `just map-check` pins.
   */
  spots: Map<string, Spot>
}

/** Lay the map out once and draw it at rest. */
export function mapMarkup(props: MapArtProps): MapMarkup {
  const { m, view, svg } = mapScene(props)
  return {
    markup: renderToStaticMarkup(createElement(MapSvg, svg)),
    viewBox: [view.cx - view.side / 2, view.cy - view.side / 2, view.side, view.side],
    spots: spotsOf(m, props.fileFrom ?? null, props.aspect ?? 1),
  }
}
