import type { CellSpec, Opening } from "@/lib/okno/types";
import { OPENING_LABEL } from "@/lib/okno/domain";

export function Schematic({
  cells,
  widthMm,
  heightMm,
}: {
  cells: CellSpec[];
  widthMm: number;
  heightMm: number;
}) {
  if (!cells.length || !(widthMm > 0) || !(heightMm > 0)) {
    return <p className="text-sm text-muted">Укажите размеры больше нуля, чтобы увидеть схему.</p>;
  }
  const maxW = 280;
  const maxH = 320;
  const scale = Math.min(maxW / widthMm, maxH / heightMm);
  const width = widthMm * scale;
  const height = heightMm * scale;
  const padL = 8;
  const padT = 28;
  const padR = 36;
  const padB = 8;
  let cursor = 0;

  return (
    <figure className="grid gap-2">
      <svg
        viewBox={`0 0 ${width + padL + padR} ${height + padT + padB}`}
        className="h-auto w-full text-navy"
        role="img"
        aria-label="Схема конструкции"
      >
        <text x={padL + width / 2} y="16" textAnchor="middle" fontSize="12" fill="currentColor">
          {Math.round(widthMm)} мм
        </text>
        <text
          x={padL + width + 22}
          y={padT + height / 2}
          textAnchor="middle"
          fontSize="12"
          fill="currentColor"
          transform={`rotate(90 ${padL + width + 22} ${padT + height / 2})`}
        >
          {Math.round(heightMm)} мм
        </text>
        {cells.map((cell, index) => {
          const cellW = cell.widthMm * scale;
          const cellH = cell.heightMm * scale;
          const x = padL + cursor;
          cursor += cellW;
          return (
            <g key={`${cell.opening}-${index}`} transform={`translate(${x} ${padT})`}>
              <rect width={cellW} height={cellH} fill="var(--color-bg)" stroke="currentColor" strokeWidth="3" />
              <OpeningMark opening={cell.opening} w={cellW} h={cellH} />
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs leading-5 text-muted">
        {cells.map((cell, index) => `${index + 1}. ${OPENING_LABEL[cell.opening]} ${Math.round(cell.widthMm)} мм`).join(" · ")}
        . Схема условная: толщина профиля на чертеже не вычитается из цены.
      </figcaption>
    </figure>
  );
}

function OpeningMark({ opening, w, h }: { opening: Opening; w: number; h: number }) {
  const inset = Math.min(10, w * 0.12, h * 0.12);
  const props = { stroke: "currentColor", strokeWidth: 1.25, fill: "none" };
  if (opening === "fixed") {
    return (
      <g>
        <line x1={inset} y1={inset} x2={w - inset} y2={h - inset} {...props} />
        <line x1={w - inset} y1={inset} x2={inset} y2={h - inset} {...props} />
      </g>
    );
  }
  if (opening === "sliding") {
    const y = h / 2;
    return (
      <g {...props}>
        <line x1={inset} y1={y} x2={w - inset} y2={y} />
        <polyline points={`${w - inset - 8},${y - 5} ${w - inset},${y} ${w - inset - 8},${y + 5}`} />
        <polyline points={`${inset + 8},${y - 5} ${inset},${y} ${inset + 8},${y + 5}`} />
      </g>
    );
  }
  const turn = opening === "turn" || opening === "tiltTurn";
  const tilt = opening === "tilt" || opening === "tiltTurn";
  return (
    <g {...props}>
      {turn ? (
        <>
          <line x1={inset} y1={inset} x2={w - inset} y2={h / 2} />
          <line x1={inset} y1={h - inset} x2={w - inset} y2={h / 2} />
        </>
      ) : null}
      {tilt ? (
        <>
          <line x1={inset} y1={h - inset} x2={w / 2} y2={inset} />
          <line x1={w - inset} y1={h - inset} x2={w / 2} y2={inset} />
        </>
      ) : null}
    </g>
  );
}
