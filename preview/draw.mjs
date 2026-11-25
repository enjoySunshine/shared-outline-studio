import fs from 'node:fs';
import { openSync } from 'fontkit';

// Two copies of the same face, opened together: the one that keeps its
// outline points as true-type data, and the one whose boxes are measured
// from the quadratic curves. The reference A, and a cubic copy, are here
// too, so the coordinate system and the outlines can be compared.
const reference = openSync(
  new URL('../test/data/OpenSans/OpenSans-Regular.ttf', import.meta.url),
);
const trueType = openSync(
  new URL(
    '../test/data/SourceSansPro/SourceSansPro-Regular.ttf.woff',
    import.meta.url,
  ),
);
const quadratic = openSync(
  new URL(
    '../test/data/SourceSansPro/SourceSansPro-Regular.ttf.woff2',
    import.meta.url,
  ),
);
const cubic = openSync(
  new URL(
    '../test/data/SourceSansPro/SourceSansPro-Regular.otf',
    import.meta.url,
  ),
);

const INK = '#f4f1ea';
const CONTROL = '#5fc9e8';
const TIGHT = '#f0a35e';
const REFERENCE = '#8fd694';
const MUTED = '#98a0a8';
const PANEL = '#171717';
const EDGE = '#2c2c2c';

const LIRA = 0x20ba;
const D = 0x44;
const I = 0x69;
const J = 0x6a;
const A = 0x41;

const glyphOf = (font, codePoint) => font.glyphForCodePoint(codePoint);
const corners = (box) => `${box.minX},${box.minY},${box.maxX},${box.maxY}`;

const panels = [];
const WIDTH = 1640;
const HEIGHT = 1432;
const PANEL_WIDTH = 524;
const PANEL_HEIGHT = 560;
const COLUMNS = [18, 558, 1098];
const ROWS = [18, 594];
const STRIP = { x: 18, y: 1168, width: WIDTH - 36, height: 224 };

function frame(x, y, title, subtitle, attributes = '') {
  return `<g ${attributes}>
  <rect x="${x}" y="${y}" width="${PANEL_WIDTH}" height="${PANEL_HEIGHT}" rx="10" fill="${PANEL}" stroke="${EDGE}"/>
  <text x="${x + 18}" y="${y + 30}" fill="#e9e5db" font-family="ui-monospace, Menlo, monospace" font-size="16" font-weight="bold">${title}</text>
  <text x="${x + 18}" y="${y + 50}" fill="${MUTED}" font-family="ui-monospace, Menlo, monospace" font-size="12">${subtitle}</text>
</g>`;
}

function labels(x, y, lines) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x + 18}" y="${y + index * 20}" fill="${line.color || MUTED}" font-family="ui-monospace, Menlo, monospace" font-size="12">${line.text}</text>`,
    )
    .join('');
}

// Maps font units, whose y axis points up, onto the screen, whose y axis
// points down: the outline is drawn as is, not mirrored. The map is a single
// matrix, rather than a chain of transforms, so every viewer renders it.
function transform(px, py, scale, minX, maxY) {
  return `matrix(${scale} 0 0 ${-scale} ${px - scale * minX} ${py + scale * maxY})`;
}

function rect(box, color, strokeWidth, dash = null) {
  let dashAttribute = dash ? ` stroke-dasharray="${dash[0]} ${dash[1]}"` : '';
  return `<rect x="${box.minX}" y="${box.minY}" width="${box.maxX - box.minX}" height="${box.maxY - box.minY}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"${dashAttribute}/>`;
}

function union(...boxes) {
  return {
    minX: Math.min(...boxes.map((box) => box.minX)),
    minY: Math.min(...boxes.map((box) => box.minY)),
    maxX: Math.max(...boxes.map((box) => box.maxX)),
    maxY: Math.max(...boxes.map((box) => box.maxY)),
  };
}

function glyphPanel({
  x,
  y,
  title,
  subtitle,
  glyph,
  attributes,
  drawHeight,
  footer,
  inset = false,
  referenceBox = false,
}) {
  const cbox = glyph.cbox;
  const bbox = glyph.bbox;
  const extent = union(cbox, bbox);
  const drawX = x + 18;
  const drawY = y + 64;
  const drawWidth = PANEL_WIDTH - 36;
  const scale = Math.min(
    drawWidth / (extent.maxX - extent.minX || 1),
    drawHeight / (extent.maxY - extent.minY || 1),
  );
  const map = transform(
    drawX + (drawWidth - (extent.maxX - extent.minX) * scale) / 2,
    drawY + (drawHeight - (extent.maxY - extent.minY) * scale) / 2,
    scale,
    extent.minX,
    extent.maxY,
  );

  const stroke = 1.6 / scale;
  let body = `<g transform="${map}">
  <path d="${glyph.path.toSVG()}" fill="${INK}" fill-opacity="0.9"/>
  ${referenceBox ? rect(bbox, REFERENCE, stroke) : rect(cbox, CONTROL, stroke)}
  ${referenceBox ? '' : rect(bbox, TIGHT, stroke * 1.4, [6 / scale, 4 / scale])}
</g>`;

  if (inset) {
    body += bottomInset(
      x + 18,
      y + 64 + drawHeight + 14,
      drawWidth,
      120,
      glyph,
      `zoom-${attributes.match(/data-panel="([^"]+)"/)[1]}`,
    );
  }

  return `${frame(x, y, title, subtitle, attributes)}
${body}
${labels(x, y + (inset ? 64 + drawHeight + 142 : 64 + drawHeight + 40), footer)}`;
}

// A close-up of the bottom edge: the control box ends at the control point
// (y = -14), while the drawn quadratic dips to its own low point
// (y = -12.0546875). Both are kept, side by side.
function bottomInset(x, y, width, height, glyph, clipId) {
  const region = { minX: 150, minY: -20, maxX: 235, maxY: 2 };
  const labelHeight = 34;
  const drawWidth = width - 20;
  const drawHeight = height - labelHeight - 14;
  const scale = Math.min(
    drawWidth / (region.maxX - region.minX),
    drawHeight / (region.maxY - region.minY),
  );
  const map = transform(
    x + 10 + (drawWidth - (region.maxX - region.minX) * scale) / 2,
    y + 10 + (drawHeight - (region.maxY - region.minY) * scale) / 2,
    scale,
    region.minX,
    region.maxY,
  );
  const stroke = 1.4 / scale;

  return `<g>
  <clipPath id="${clipId}"><rect x="${x + 10}" y="${y + 10}" width="${drawWidth}" height="${drawHeight}"/></clipPath>
  <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#111" stroke="${EDGE}"/>
  <g clip-path="url(#${clipId})">
    <g transform="${map}">
      <path d="${glyph.path.toSVG()}" fill="${INK}" fill-opacity="0.55"/>
      <line x1="${region.minX}" y1="-14" x2="${region.maxX}" y2="-14" stroke="${CONTROL}" stroke-width="${stroke * 1.4}"/>
      <line x1="${region.minX}" y1="-12.0546875" x2="${region.maxX}" y2="-12.0546875" stroke="${TIGHT}" stroke-width="${stroke * 1.4}" stroke-dasharray="${5 / scale} ${4 / scale}"/>
      <circle cx="215" cy="-14" r="${4 / scale}" fill="${CONTROL}"/>
    </g>
  </g>
  <text x="${x + 10}" y="${y + height - 10}" fill="${MUTED}" font-family="ui-monospace, Menlo, monospace" font-size="11">control point y=-14 (cyan) · curve y=-12.0546875 (amber)</text>
</g>`;
}

// A line of text: its box is read from the same glyph outlines as the
// panels above, and its advance is the distance the pen travels.
function linePanel({ x, y, font, text, attributes }) {
  const run = font.layout(text);
  const bbox = run.bbox;
  const drawX = x + 18;
  const drawY = y + 64;
  const drawWidth = PANEL_WIDTH - 36;
  const drawHeight = 350;
  const extent = bbox;
  const scale = Math.min(
    drawWidth / (extent.maxX - extent.minX || 1),
    drawHeight / (extent.maxY - extent.minY || 1),
  );
  const map = transform(
    drawX + (drawWidth - (extent.maxX - extent.minX) * scale) / 2,
    drawY + (drawHeight - (extent.maxY - extent.minY) * scale) / 2,
    scale,
    extent.minX,
    extent.maxY,
  );
  const stroke = 1.6 / scale;

  let body = `<g transform="${map}">`;
  let pen = 0;
  for (let index = 0; index < run.glyphs.length; index++) {
    const glyph = run.glyphs[index];
    const position = run.positions[index];
    body += `<g transform="translate(${pen + position.xOffset} ${position.yOffset})">
      <path d="${glyph.path.toSVG()}" fill="${INK}" fill-opacity="0.9"/>
      ${index === 1 ? rect(glyph.bbox, TIGHT, stroke * 1.4, [6 / scale, 4 / scale]) : ''}
    </g>`;
    pen += position.xAdvance;
  }
  body += rect(bbox, REFERENCE, stroke);
  body += `</g>`;

  return `${frame(x, y, 'Do line · true-type copy', 'D and o laid out in one run', attributes)}
${body}
${labels(x, y + 64 + drawHeight + 40, [
  { text: `run bbox  ${corners(bbox)}` },
  {
    text: `line width (advance) ${run.advanceWidth} · bbox width ${bbox.width}`,
  },
  { text: "o's own box is dashed: bottom -12" },
])}`;
}

// Reference A, the outline the preview has always drawn: kept as is, to
// check that the y axis is not upside down.
{
  const glyph = glyphOf(reference, A);
  panels.push(
    glyphPanel({
      x: COLUMNS[0],
      y: ROWS[0],
      title: 'A · reference outline',
      subtitle: 'OpenSans-Regular.ttf · kept for orientation',
      glyph,
      attributes: `data-panel="reference-A" data-bbox="${corners(glyph.bbox)}"`,
      drawHeight: 350,
      referenceBox: true,
      footer: [
        { text: `bbox  ${corners(glyph.bbox)}` },
        {
          text: `drawn width ${glyph.bbox.width} · height ${glyph.bbox.height}`,
        },
        { text: 'upem 2048 · font units, y up' },
      ],
    }),
  );
}

// D from each copy: the boxes are the same in both, as the outline is.
for (const [index, { font, title, subtitle, attribute }] of [
  {
    font: trueType,
    title: 'D · true-type copy',
    subtitle: 'ttf.woff · quadratic points, midpoints on halves',
    attribute: 'true-type-woff',
  },
  {
    font: cubic,
    title: 'D · cubic copy',
    subtitle: 'otf · cubic curves (258 0 → 564 331)',
    attribute: 'cubic-otf',
  },
].entries()) {
  const glyph = glyphOf(font, D);
  panels.push(
    glyphPanel({
      x: COLUMNS[index + 1],
      y: ROWS[0],
      title,
      subtitle,
      glyph,
      attributes: `data-panel="D-${attribute}" data-cbox="${corners(glyph.cbox)}" data-bbox="${corners(glyph.bbox)}"`,
      drawHeight: 350,
      footer: [
        { text: `control box  ${corners(glyph.cbox)}`, color: CONTROL },
        { text: `tight box    ${corners(glyph.bbox)}`, color: TIGHT },
        { text: `advance ${glyph.advanceWidth} · upem 1000` },
      ],
    }),
  );
}

// The lira from both copies, opened together. Each panel keeps the control
// box and the tight box apart; the zoom makes the 1.9453125 unit difference
// at the bottom visible.
for (const { font, title, subtitle, attribute } of [
  {
    font: trueType,
    title: 'lira U+20BA · true-type copy',
    subtitle: 'ttf.woff · outline points as true-type data',
    attribute: 'true-type-woff',
  },
  {
    font: quadratic,
    title: 'lira U+20BA · quadratic copy',
    subtitle: 'ttf.woff2 · boxes measured from the curves',
    attribute: 'quadratic-woff2',
  },
]) {
  const glyph = glyphOf(font, LIRA);
  panels.push(
    glyphPanel({
      x: COLUMNS[attribute === 'true-type-woff' ? 0 : 1],
      y: ROWS[1],
      title,
      subtitle,
      glyph,
      attributes: `data-panel="lira-${attribute}" data-cbox="${corners(glyph.cbox)}" data-bbox="${corners(glyph.bbox)}"`,
      drawHeight: 250,
      inset: true,
      footer: [
        { text: `control box  ${corners(glyph.cbox)}`, color: CONTROL },
        { text: `tight box    ${corners(glyph.bbox)}`, color: TIGHT },
        { text: `advance ${glyph.advanceWidth} · both boxes, not merged` },
      ],
    }),
  );
}

panels.push(
  linePanel({
    x: COLUMNS[2],
    y: ROWS[1],
    font: trueType,
    text: 'Do',
    attributes: `data-panel="Do-line" data-bbox="${corners(trueType.layout('Do').bbox)}"`,
  }),
);

// The lowercase i and j: the true-type and quadratic copies share an
// outline (69,0,179,694 and -40,-217,178,694), while the cubic copy really
// differs (67,0,181,692 and -40,-217,181,692). The boxes follow the outline,
// rather than being forced to agree.
function smallLetterStrip({ x, y, width, height }) {
  const cells = [];
  const letters = [
    ['i', I],
    ['j', J],
  ];
  const copies = [
    ['true-type (ttf.woff)', trueType],
    ['quadratic (ttf.woff2)', quadratic],
    ['cubic (otf)', cubic],
  ];
  const cellWidth = width / copies.length;
  const stroke = 1.6;
  const rowHeight = 78;

  copies.forEach(([label, font], column) => {
    const left = x + column * cellWidth;
    cells.push(
      `<text x="${left + 14}" y="${y + 42}" fill="${MUTED}" font-family="ui-monospace, Menlo, monospace" font-size="12">${label}</text>`,
    );
    letters.forEach(([letter, codePoint], row) => {
      const glyph = glyphOf(font, codePoint);
      const extent = union(glyph.cbox, glyph.bbox);
      const area = {
        x: left + 20,
        y: y + 52 + row * rowHeight,
        width: 58,
        height: rowHeight - 4,
      };
      const scale = Math.min(
        area.width / (extent.maxX - extent.minX || 1),
        area.height / (extent.maxY - extent.minY || 1),
      );
      const map = transform(
        area.x + (area.width - (extent.maxX - extent.minX) * scale) / 2,
        area.y + (area.height - (extent.maxY - extent.minY) * scale) / 2,
        scale,
        extent.minX,
        extent.maxY,
      );
      cells.push(`<g transform="${map}">
        <path d="${glyph.path.toSVG()}" fill="${INK}" fill-opacity="0.85"/>
        ${rect(glyph.cbox, CONTROL, stroke / scale)}
        ${rect(glyph.bbox, TIGHT, (stroke * 1.4) / scale, [6 / scale, 4 / scale])}
      </g>`);
      cells.push(
        `<text x="${left + 94}" y="${area.y + 22}" fill="#e9e5db" font-family="ui-monospace, Menlo, monospace" font-size="12">${letter}</text>`,
        `<text x="${left + 114}" y="${area.y + 22}" fill="${CONTROL}" font-family="ui-monospace, Menlo, monospace" font-size="11">${corners(glyph.cbox)}</text>`,
        `<text x="${left + 114}" y="${area.y + 40}" fill="${TIGHT}" font-family="ui-monospace, Menlo, monospace" font-size="11">${corners(glyph.bbox)}</text>`,
        `<text x="${left + 114}" y="${area.y + 58}" fill="${MUTED}" font-family="ui-monospace, Menlo, monospace" font-size="11">advance ${glyph.advanceWidth}</text>`,
      );
    });
  });

  return `<g>
  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${PANEL}" stroke="${EDGE}"/>
  <text x="${x + 14}" y="${y + 22}" fill="#e9e5db" font-family="ui-monospace, Menlo, monospace" font-size="14" font-weight="bold">i / j · outlines differ between copies, and the boxes follow them</text>
  ${cells.join('\n')}
</g>`;
}

panels.push(smallLetterStrip(STRIP));

const legend = `<g font-family="ui-monospace, Menlo, monospace" font-size="12">
  <text x="18" y="1420" fill="${MUTED}">cyan: control box (all outline points, control points included)</text>
  <text x="620" y="1420" fill="${MUTED}">amber dashed: tight box (hugs the drawn curves)</text>
  <text x="1150" y="1420" fill="${MUTED}">green: reference / run box</text>
</g>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#111"/>
${panels.join('\n')}
${legend}
</svg>
`;

fs.writeFileSync(new URL('./out.svg', import.meta.url), svg);

// The numbers behind the picture, so each box can be checked on its own.
function describe(name, font, codePoints) {
  const lines = [`${name} (${font.type}, upem ${font.unitsPerEm})`];
  for (const [label, codePoint] of codePoints) {
    const glyph = glyphOf(font, codePoint);
    lines.push(
      `  ${label.padEnd(5)} control ${corners(glyph.cbox).padEnd(26)} tight ${corners(glyph.bbox).padEnd(26)} advance ${glyph.advanceWidth}`,
    );
  }
  return lines.join('\n');
}

const line = trueType.layout('Do');
console.log(
  [
    describe('true-type copy', trueType, [
      ['D', D],
      ['lira', LIRA],
      ['i', I],
      ['j', J],
    ]),
    describe('quadratic copy', quadratic, [
      ['D', D],
      ['lira', LIRA],
      ['i', I],
      ['j', J],
    ]),
    describe('cubic copy', cubic, [
      ['D', D],
      ['lira', LIRA],
      ['i', I],
      ['j', J],
    ]),
    `Do line: run bbox ${corners(line.bbox)} · advance ${line.advanceWidth} · o bottom ${line.glyphs[1].bbox.minY}`,
    `A reference: bbox ${corners(glyphOf(reference, A).bbox)}`,
    `wrote preview/out.svg (${WIDTH}×${HEIGHT})`,
  ].join('\n'),
);
