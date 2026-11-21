# Adds the classic-car icon (an early horseless carriage, drawn here) to assets/vehicles.ttf.
# Run: python3 scripts/make-classic-car-icon.py assets/vehicles.ttf assets/vehicles.ttf
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import RecordingPen, DecomposingRecordingPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.svgLib.path import parse_path

K = 0.5523
def circle(cx, cy, r, cw=True):
    # four cubic quarter arcs; cw=True clockwise in SVG (y down) coordinates
    k = K * r
    if cw:
        return (f"M{cx},{cy-r} C{cx+k},{cy-r} {cx+r},{cy-k} {cx+r},{cy} C{cx+r},{cy+k} {cx+k},{cy+r} {cx},{cy+r} "
                f"C{cx-k},{cy+r} {cx-r},{cy+k} {cx-r},{cy} C{cx-r},{cy-k} {cx-k},{cy-r} {cx},{cy-r} Z ")
    return (f"M{cx},{cy-r} C{cx-k},{cy-r} {cx-r},{cy-k} {cx-r},{cy} C{cx-r},{cy+k} {cx-k},{cy+r} {cx},{cy+r} "
            f"C{cx+k},{cy+r} {cx+r},{cy+k} {cx+r},{cy} C{cx+r},{cy-k} {cx+k},{cy-r} {cx},{cy-r} Z ")
def rect(x1, y1, x2, y2):  # clockwise in SVG coords
    return f"M{x1},{y1} L{x2},{y1} L{x2},{y2} L{x1},{y2} Z "
def poly(*pts):
    return "M" + " L".join(f"{x},{y}" for x, y in pts) + " Z "
def spokes(cx, cy, r_in, r_out, n, w):
    import math
    out = ""
    for i in range(n):
        a = math.pi * i / n
        dx, dy = math.cos(a), math.sin(a)
        px, py = -dy * w / 2, dx * w / 2
        # full diameter bar through the hub
        x1, y1 = cx - dx * r_out, cy - dy * r_out
        x2, y2 = cx + dx * r_out, cy + dy * r_out
        out += poly((x1 + px, y1 + py), (x2 + px, y2 + py), (x2 - px, y2 - py), (x1 - px, y1 - py))
    return out

# An early "horseless carriage": big spoked wheels, high carriage body, upright bench, buggy roof on posts, tiller steering.
d = ""
# wheels: outer ring = outer circle cw + inner circle ccw (hole), spokes inside the hole, hub
for cx, cy, ro, ri, hub in [(6.2, 17.2, 4.6, 3.5, 0.9), (18.6, 18.4, 3.4, 2.4, 0.75)]:
    d += circle(cx, cy, ro, True) + circle(cx, cy, ri, False)
    d += spokes(cx, cy, hub, ri + 0.2, 4, 0.55)
    d += circle(cx, cy, hub, True)
# carriage body (above the wheel holes), curved front dash
d += poly((2.6, 10.6), (15.4, 10.6), (17.6, 9.4), (18.2, 10.2), (16.4, 12.6), (2.6, 12.6))
# upright seat back
d += rect(2.6, 6.2, 4.6, 10.8)
# roof canopy and its posts
d += poly((1.6, 4.4), (12.8, 4.4), (12.2, 3.2), (2.2, 3.2))
d += rect(2.8, 4.2, 3.6, 6.4)
d += rect(11.4, 4.2, 12.2, 10.8)
# tiller steering column and handle
d += poly((14.2, 10.8), (15.2, 6.2), (16.0, 6.2), (15.0, 10.8))
d += rect(14.0, 5.6, 17.2, 6.4)
# carriage lamp
d += circle(19.4, 8.6, 0.85, True)
d += poly((17.8, 9.5), (18.8, 8.6), (19.2, 9.0), (18.3, 9.9))

S = 512 / 24
src = TTFont(sys.argv[1])
rec = RecordingPen()
tp = TransformPen(rec, (S, 0, 0, -S, 0, 448 + 0.8 * S))
parse_path(d, tp)
glyph_pen = TTGlyphPen(None)
# y is flipped, so SVG-clockwise contours become counter-clockwise; TrueType wants outer contours clockwise.
rec.replay(ReverseContourPen(Cu2QuPen(glyph_pen, max_err=1.0, reverse_direction=False)))
glyph = glyph_pen.glyph()
name = 'uF1500A'
code = 0xF1500A if False else 0xF0F00  # private-use code point not used by the other icons
name = 'uF0F00'
order = src.getGlyphOrder()
if name not in order:
    src.setGlyphOrder(order + [name])
src['glyf'][name] = glyph
src['hmtx'][name] = (512, 0)
for table in src['cmap'].tables:
    if table.isUnicode():
        table.cmap[code] = name
src['maxp'].numGlyphs = len(src.getGlyphOrder())
glyph.recalcBounds(src['glyf'])
src.save(sys.argv[2])
print(code, glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax)
