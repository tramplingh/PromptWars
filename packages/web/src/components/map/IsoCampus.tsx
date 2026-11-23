import { memo } from 'react';
import {
  AVENUE_CENTRE,
  BUILDINGS_BY_DEPTH,
  GROUND,
  ROADS,
  TONE_ACCENT,
  TREES,
  VIEWBOX,
  buildingFaces,
  project,
  roofStripes,
  toPoints,
  windows,
  type Building,
  type Point,
} from '../../lib/campusLayout';

export interface PinStem {
  id: string;
  base: Point;
  head: Point;
}

interface Props {
  selectedDepartmentId: string | null;
  homeDepartmentId: string | null;
  route: Point[];
  stems: PinStem[];
  onSelectBuilding: (departmentId: string) => void;
}

const FACE = { top: '#ffffff', left: '#e8edf5', right: '#d3dbe8', edge: '#c3cdda' };

/**
 * Decorative isometric campus scene (pure SVG, no libraries). It is hidden from
 * assistive technology: the building labels, pins and list rendered by the map
 * page provide the accessible equivalents.
 */
export const IsoCampus = memo(function IsoCampus({
  selectedDepartmentId,
  homeDepartmentId,
  route,
  stems,
  onSelectBuilding,
}: Props) {
  return (
    <svg
      viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e9eef5" />
        </linearGradient>
      </defs>

      <polygon points={GROUND} fill="url(#ground)" stroke="#dbe2ec" />
      {ROADS.map((points) => (
        <polygon key={points} points={points} fill="#ffffff" stroke="#e2e8f0" />
      ))}
      <line
        x1={AVENUE_CENTRE[0].x}
        y1={AVENUE_CENTRE[0].y}
        x2={AVENUE_CENTRE[1].x}
        y2={AVENUE_CENTRE[1].y}
        stroke="#cbd5e1"
        strokeDasharray="10 10"
      />

      {TREES.map(([x, y]) => (
        <Tree key={`${x}-${y}`} x={x} y={y} />
      ))}

      {BUILDINGS_BY_DEPTH.map((b) => (
        <BuildingShape
          key={b.departmentId}
          building={b}
          selected={b.departmentId === selectedDepartmentId}
          home={b.departmentId === homeDepartmentId}
          onSelect={onSelectBuilding}
        />
      ))}

      {route.length > 1 && (
        <g>
          <polyline
            points={toPoints(route)}
            fill="none"
            stroke="#ffffff"
            strokeWidth="9"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={toPoints(route)}
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="12 12"
            className="motion-safe:animate-dash"
          />
          <circle
            cx={route[0]!.x}
            cy={route[0]!.y}
            r="7"
            fill="#1d4ed8"
            stroke="#ffffff"
            strokeWidth="3"
          />
          <circle
            cx={route[route.length - 1]!.x}
            cy={route[route.length - 1]!.y}
            r="7"
            fill="#ffffff"
            stroke="#1d4ed8"
            strokeWidth="3"
          />
        </g>
      )}

      {stems.map((s) => (
        <line
          key={s.id}
          x1={s.base.x}
          y1={s.base.y}
          x2={s.head.x}
          y2={s.head.y}
          stroke="#64748b"
          strokeWidth="1.5"
          strokeDasharray="2 3"
        />
      ))}
    </svg>
  );
});

function BuildingShape({
  building,
  selected,
  home,
  onSelect,
}: {
  building: Building;
  selected: boolean;
  home: boolean;
  onSelect: (departmentId: string) => void;
}) {
  const faces = buildingFaces(building);
  const accent = TONE_ACCENT[building.tone];
  const { x, y, w, d, h } = building;
  // Coloured trim band along the top of the south-west façade identifies the department.
  const trim = toPoints([
    project(x, y + d, h),
    project(x + w, y + d, h),
    project(x + w, y + d, h - 0.9),
    project(x, y + d, h - 0.9),
  ]);

  return (
    // Mouse convenience only: the same action is available via the labelled building button overlay.
    <g className="cursor-pointer" onClick={() => onSelect(building.departmentId)}>
      <polygon points={faces.shadow} fill="#0f172a" opacity="0.06" />
      <polygon points={faces.right} fill={FACE.right} stroke={FACE.edge} />
      <polygon points={faces.left} fill={FACE.left} stroke={FACE.edge} />
      {windows(building).map((pts) => (
        <polygon key={pts} points={pts} fill={accent} opacity="0.55" />
      ))}
      <polygon points={trim} fill={accent} opacity="0.9" />
      <polygon
        points={faces.top}
        fill={FACE.top}
        stroke={selected ? accent : FACE.edge}
        strokeWidth={selected ? 3 : 1}
      />
      {roofStripes(building).map(([a, b]) => (
        <line
          key={`${a.x}-${a.y}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#e2e8f0"
          strokeWidth="1.5"
        />
      ))}
      {home && <polygon points={faces.top} fill={accent} opacity="0.07" />}
    </g>
  );
}

function Tree({ x, y }: { x: number; y: number }) {
  const base = project(x, y, 0);
  const crown = project(x, y, 3.2);
  return (
    <g>
      <ellipse cx={base.x} cy={base.y} rx="9" ry="4.5" fill="#0f172a" opacity="0.06" />
      <line x1={base.x} y1={base.y} x2={crown.x} y2={crown.y} stroke="#a8a29e" strokeWidth="2.5" />
      <circle cx={crown.x} cy={crown.y} r="10" fill="#bbf7d0" stroke="#86efac" />
    </g>
  );
}
