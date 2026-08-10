#!/usr/bin/env python3
"""Build the regional locator map for the presentation site.

Renders an SVG from Natural Earth 1:10m lake polygons (public domain, no
attribution required — unlike a screenshot from a consumer maps app, which
cannot legally sit on a public page without one).

Land is the background; water is drawn over it. Lake Huron's polygon carries
its islands as interior rings, so Manitoulin falls out of the geometry rather
than being drawn by hand.

Usage:
    python3 scripts/build-locator-map.py path/to/ne_10m_lakes.geojson > map.svg

Source data:
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson
"""
import json, math, sys

# Frame: Manitoulin centred, Sudbury top-right, Tobermory bottom-right.
LON0, LON1 = -84.05, -80.15
SIZE = 1000                       # square viewBox
# Land is a warm near-white so the plate reads as a distinct object on both
# the cream and the white sections it sits in.
WATER, LAND, COAST = '#D3E0E5', '#FCFAF6', '#AFC4CB'
ACCENT, INK = '#D8232A', '#1C1C1C'

merc = lambda lat: math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))

# Latitude span is derived so the frame is square in Mercator units.
CLAT = 45.87
half = (LON1 - LON0) / 2
my0, my1 = merc(CLAT) - math.radians(half), merc(CLAT) + math.radians(half)


def project(lon, lat):
    x = (lon - LON0) / (LON1 - LON0) * SIZE
    y = (my1 - merc(lat)) / (my1 - my0) * SIZE
    return x, y


def clip(ring, edge, val, keep_greater):
    """Sutherland–Hodgman against one axis-aligned edge, in projected space."""
    if not ring:
        return ring
    inside = lambda p: (p[edge] >= val) if keep_greater else (p[edge] <= val)
    out, prev = [], ring[-1]
    for cur in ring:
        ci, pi = inside(cur), inside(prev)
        if ci != pi:
            t = (val - prev[edge]) / (cur[edge] - prev[edge])
            pt = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]
            out.append(pt)
        if ci:
            out.append(list(cur))
        prev = cur
    return out


def clip_box(ring, pad=14):
    for edge, val, gt in ((0, -pad, True), (0, SIZE + pad, False),
                          (1, -pad, True), (1, SIZE + pad, False)):
        ring = clip(ring, edge, val, gt)
        if not ring:
            return []
    return ring


def path_of(rings):
    d = []
    for r in rings:
        pts = clip_box([list(project(*c[:2])) for c in r])
        if len(pts) < 3:
            continue
        # 1dp is sub-pixel at any sane display size; drop the dead '.0'
        fmt = lambda v: f'{v:.1f}'.replace('.0', '')
        d.append('M' + 'L'.join(f'{fmt(x)},{fmt(y)}' for x, y in pts) + 'Z')
    return ''.join(d)


def main(src):
    data = json.load(open(src))
    paths = []
    for f in data['features']:
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for p in polys:
            d = path_of(p)
            if d:
                paths.append(d)

    places = [  # lon, lat, label, text-anchor, dx, dy
        (-80.9930, 46.4917, 'Sudbury',        'end',    -16,   9),
        (-81.6650, 45.2540, 'Tobermory',      'middle',   0,  30),
        (-81.9269, 45.9787, 'Little Current', 'start',   13,  26),
        (-82.4653, 45.9186, 'Gore Bay',       'end',    -12,  22),
        (-82.0128, 45.5544, 'South Baymouth', 'start',   13,  10),
    ]
    dots = ''.join(
        f'<circle cx="{project(lo,la)[0]:.1f}" cy="{project(lo,la)[1]:.1f}" r="4.5" '
        f'fill="{INK}" opacity=".72"/>' for lo, la, *_ in places)
    labels = ''.join(
        f'<text x="{project(lo,la)[0]+dx:.1f}" y="{project(lo,la)[1]+dy:.1f}" '
        f'text-anchor="{an}" class="pl">{t}</text>'
        for lo, la, t, an, dx, dy in places)

    # Chi-Cheemaun, South Baymouth to Tobermory
    fx0, fy0 = project(-82.0128, 45.5544)
    fx1, fy1 = project(-81.6650, 45.2540)
    ferry = (f'<path d="M{fx0:.1f},{fy0:.1f} Q{(fx0+fx1)/2-26:.1f},'
             f'{(fy0+fy1)/2:.1f} {fx1:.1f},{fy1:.1f}" fill="none" stroke="{INK}" '
             f'stroke-width="2.4" stroke-dasharray="7 8" opacity=".45"/>')

    ex, ey = project(-82.345, 45.885)
    star = ('M0,-26 L7.4,-8.5 L26,-8.5 L11,3.2 L16.7,21.5 L0,10.4 '
            'L-16.7,21.5 L-11,3.2 L-26,-8.5 L-7.4,-8.5 Z')

    isle = project(-82.05, 45.62)

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}"
  role="img" aria-label="Regional map: Evergreen Resort on Manitoulin Island, Ontario, with Sudbury to the north-east and Tobermory across the channel to the south-east.">
<style>
  .pl{{font-family:Inter,system-ui,sans-serif;font-size:26px;font-weight:500;fill:{INK};
      paint-order:stroke;stroke:{LAND};stroke-width:5px;stroke-linejoin:round}}
  .isle{{font-family:Inter,system-ui,sans-serif;font-size:25px;font-weight:500;
      fill:#5C7078;letter-spacing:.06em;paint-order:stroke;stroke:{LAND};stroke-width:5px}}
  .me{{font-family:Inter,system-ui,sans-serif;font-size:29px;font-weight:700;fill:{INK};
      letter-spacing:.05em;paint-order:stroke;stroke:#fff;stroke-width:6px;stroke-linejoin:round}}
</style>
<rect width="{SIZE}" height="{SIZE}" fill="{LAND}"/>
<g fill="{WATER}" stroke="{COAST}" stroke-width="1.6" fill-rule="evenodd">
{''.join(f'<path d="{d}"/>' for d in paths)}
</g>
{ferry}
{dots}
<text x="{isle[0]:.1f}" y="{isle[1]:.1f}" text-anchor="middle" class="isle">MANITOULIN ISLAND</text>
{labels}
<g transform="translate({ex:.1f},{ey:.1f})">
  <path d="{star}" fill="{ACCENT}" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>
</g>
<text x="{ex:.1f}" y="{ey-46:.1f}" text-anchor="middle" class="me">EVERGREEN RESORT</text>
</svg>'''


if __name__ == '__main__':
    sys.stdout.write(main(sys.argv[1]))
