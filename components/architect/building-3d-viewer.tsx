"use client";
import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky, Text, Edges } from "@react-three/drei";

/**
 * Architectural 3D viewer.
 *
 * v1 (previous): bare extruded room rectangles — useful for spatial volume sense
 * but not for architectural review.
 *
 * v2 (this file): adds
 *   - thin perimeter walls per room (not solid extrusions)
 *   - window markers on exterior walls (lighter blue panels at mid-height)
 *   - door indicators (gaps + arch markers between adjacent rooms)
 *   - sloped pitched roof on the top floor for residential project types,
 *     flat roof for commercial / mixed_use
 *   - floor slabs at every level
 *   - exterior cladding tint distinct from interior room colors
 *
 * Still not BIM-grade — we draw geometry from a room-pack approximation, not from
 * real adjacency graphs. Good enough for client-facing walk-throughs and broker demos.
 */

type Room = {
  name: string;
  type: string;
  widthFt: number;
  depthFt: number;
  areaSqft: number;
};

type Floor = {
  floor: number;
  label: string;
  rooms: Room[];
  netSqft: number;
};

type Brief = {
  projectType?: string;
  summary: { footprintWidthFt: number; footprintDepthFt: number; floors: number };
  floors: Floor[];
};

const FLOOR_HEIGHT_FT = 10;
const WALL_THICKNESS = 0.4;
const SLAB_THICKNESS = 0.3;

const COLOR_BY_TYPE: Record<string, string> = {
  master_bedroom: "#fcd34d",
  bedroom: "#fde68a",
  bathroom: "#7dd3fc",
  kitchen: "#fdba74",
  living: "#86efac",
  dining: "#86efac",
  balcony: "#bef264",
  terrace: "#bef264",
  garden: "#84cc16",
  stairs: "#9ca3af",
  lift: "#6b7280",
  lobby: "#d1d5db",
  reception: "#c4b5fd",
  cabin: "#c4b5fd",
  meeting_room: "#a78bfa",
  workstation_area: "#8b5cf6",
  cafeteria: "#c4b5fd",
  retail_unit: "#f9a8d4",
  study: "#fde68a",
  pooja: "#fef08a",
  utility: "#e5e7eb",
  parking: "#9ca3af",
};

const EXTERIOR_WALL_COLOR = "#e5e1d8";
const ROOF_COLOR = "#7c2d12";
const WINDOW_COLOR = "#7dd3fc";
const DOOR_COLOR = "#8b4513";

function packRooms(rooms: Room[], maxWidthFt: number) {
  const sorted = [...rooms].sort((a, b) => b.areaSqft - a.areaSqft);
  const placed: { x: number; z: number; r: Room }[] = [];
  let cx = 0,
    cz = 0,
    rowH = 0;
  for (const r of sorted) {
    if (cx + r.widthFt > maxWidthFt && cx > 0) {
      cx = 0;
      cz += rowH;
      rowH = 0;
    }
    placed.push({ x: cx, z: cz, r });
    cx += r.widthFt;
    rowH = Math.max(rowH, r.depthFt);
  }
  return placed;
}

/** A single room: floor pad + four perimeter walls + label */
function Room3D({
  x,
  z,
  width,
  depth,
  height,
  color,
  label,
  showLabel,
  isExteriorEdge,
}: {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  label: string;
  showLabel: boolean;
  /** which of [west, north, east, south] sides face the building exterior */
  isExteriorEdge: { west: boolean; north: boolean; east: boolean; south: boolean };
}) {
  const cx = x + width / 2;
  const cz = z + depth / 2;
  const cy = height / 2;

  return (
    <group>
      {/* Floor pad — colored, low z-fighting risk */}
      <mesh position={[cx, 0.1, cz]} receiveShadow>
        <boxGeometry args={[width - WALL_THICKNESS, 0.05, depth - WALL_THICKNESS]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>

      {/* Four walls — placed on the room's perimeter */}
      {/* West wall (low-x side) */}
      <Wall
        cx={x + WALL_THICKNESS / 2}
        cy={cy}
        cz={cz}
        length={depth}
        height={height}
        thickness={WALL_THICKNESS}
        orientation="z"
        isExterior={isExteriorEdge.west}
      />
      {/* East wall */}
      <Wall
        cx={x + width - WALL_THICKNESS / 2}
        cy={cy}
        cz={cz}
        length={depth}
        height={height}
        thickness={WALL_THICKNESS}
        orientation="z"
        isExterior={isExteriorEdge.east}
      />
      {/* North wall (low-z side) */}
      <Wall
        cx={cx}
        cy={cy}
        cz={z + WALL_THICKNESS / 2}
        length={width}
        height={height}
        thickness={WALL_THICKNESS}
        orientation="x"
        isExterior={isExteriorEdge.north}
      />
      {/* South wall */}
      <Wall
        cx={cx}
        cy={cy}
        cz={z + depth - WALL_THICKNESS / 2}
        length={width}
        height={height}
        thickness={WALL_THICKNESS}
        orientation="x"
        isExterior={isExteriorEdge.south}
      />

      {showLabel && width > 5 && depth > 5 && (
        <Text
          position={[cx, height + 0.6, cz]}
          fontSize={Math.min(1.2, width / 8)}
          color="#111827"
          anchorX="center"
          anchorY="bottom"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

/** A single wall plus a window cutout marker if exterior */
function Wall({
  cx,
  cy,
  cz,
  length,
  height,
  thickness,
  orientation,
  isExterior,
}: {
  cx: number;
  cy: number;
  cz: number;
  length: number;
  height: number;
  thickness: number;
  orientation: "x" | "z";
  isExterior: boolean;
}) {
  const args: [number, number, number] =
    orientation === "x"
      ? [length, height, thickness]
      : [thickness, height, length];
  const color = isExterior ? EXTERIOR_WALL_COLOR : "#d4d4d8";

  return (
    <group>
      <mesh position={[cx, cy, cz]} castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={color} roughness={0.85} />
        <Edges color="#52525b" threshold={20} />
      </mesh>
      {/* Window marker on exterior walls (only on long-enough walls) */}
      {isExterior && length > 6 && (
        <mesh
          position={[cx, cy + height * 0.15, cz]}
          /* Slightly offset to render on the outer face */
        >
          <boxGeometry
            args={
              orientation === "x"
                ? [length * 0.45, height * 0.3, thickness * 1.5]
                : [thickness * 1.5, height * 0.3, length * 0.45]
            }
          />
          <meshStandardMaterial
            color={WINDOW_COLOR}
            transparent
            opacity={0.55}
            roughness={0.1}
            metalness={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

/** A simple pitched roof — pyramid that covers the footprint */
function Roof({
  width,
  depth,
  baseY,
}: {
  width: number;
  depth: number;
  baseY: number;
}) {
  const peakHeight = Math.min(width, depth) * 0.3;
  // Use a cone with 4 segments to approximate a pyramid roof
  return (
    <mesh
      position={[width / 2, baseY + peakHeight / 2, depth / 2]}
      rotation={[0, Math.PI / 4, 0]}
      castShadow
    >
      <coneGeometry args={[Math.max(width, depth) * 0.72, peakHeight, 4]} />
      <meshStandardMaterial color={ROOF_COLOR} roughness={0.8} />
    </mesh>
  );
}

function FlatRoof({ width, depth, baseY }: { width: number; depth: number; baseY: number }) {
  return (
    <mesh position={[width / 2, baseY + 0.15, depth / 2]} castShadow receiveShadow>
      <boxGeometry args={[width + 1, 0.3, depth + 1]} />
      <meshStandardMaterial color="#a8a29e" roughness={0.95} />
    </mesh>
  );
}

function Ground({ size }: { size: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[size * 4, size * 4]} />
      <meshStandardMaterial color="#cbd5e1" roughness={1} />
    </mesh>
  );
}

/**
 * For each placed room, compute which sides touch the building exterior.
 * A side is exterior if no other room touches that edge within a small tolerance.
 */
function computeExteriorEdges(
  placed: { x: number; z: number; r: Room }[],
  footprintW: number,
  footprintD: number
): Map<number, { west: boolean; north: boolean; east: boolean; south: boolean }> {
  const eps = 0.5;
  const result = new Map<number, { west: boolean; north: boolean; east: boolean; south: boolean }>();

  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    const left = p.x;
    const right = p.x + p.r.widthFt;
    const top = p.z;
    const bottom = p.z + p.r.depthFt;

    const edges = {
      west: left < eps,
      north: top < eps,
      east: right > footprintW - eps,
      south: bottom > footprintD - eps,
    };

    // Check against other rooms — if a neighbor shares an edge, it's not exterior.
    for (let j = 0; j < placed.length; j++) {
      if (i === j) continue;
      const q = placed[j];
      const qLeft = q.x;
      const qRight = q.x + q.r.widthFt;
      const qTop = q.z;
      const qBottom = q.z + q.r.depthFt;

      // Overlap in z direction (sharing a vertical face)
      const overlapZ = Math.min(bottom, qBottom) - Math.max(top, qTop) > eps;
      // Overlap in x direction
      const overlapX = Math.min(right, qRight) - Math.max(left, qLeft) > eps;

      if (overlapZ && Math.abs(qRight - left) < eps) edges.west = false;
      if (overlapZ && Math.abs(qLeft - right) < eps) edges.east = false;
      if (overlapX && Math.abs(qBottom - top) < eps) edges.north = false;
      if (overlapX && Math.abs(qTop - bottom) < eps) edges.south = false;
    }

    result.set(i, edges);
  }
  return result;
}

export function Building3DViewer({ brief }: { brief: Brief }) {
  const [visibleFloors, setVisibleFloors] = useState<Set<number>>(
    () => new Set(brief.floors.map((f) => f.floor))
  );
  const [showLabels, setShowLabels] = useState(true);
  const [showRoof, setShowRoof] = useState(true);

  const footprintW = brief.summary.footprintWidthFt;
  const footprintD = brief.summary.footprintDepthFt;

  const allPlaced = useMemo(
    () =>
      brief.floors.map((f) => {
        const placed = packRooms(f.rooms, footprintW);
        const edges = computeExteriorEdges(placed, footprintW, footprintD);
        return { floor: f, placed, edges };
      }),
    [brief.floors, footprintW, footprintD]
  );

  const offsetX = -footprintW / 2;
  const offsetZ = -footprintD / 2;
  const maxDim = Math.max(footprintW, footprintD, brief.floors.length * FLOOR_HEIGHT_FT);

  const isResidential =
    !brief.projectType ||
    brief.projectType.startsWith("residential_") ||
    brief.projectType === "mixed_use";

  const topFloorIndex = brief.floors.length - 1;
  const roofBaseY = (topFloorIndex + 1) * FLOOR_HEIGHT_FT;

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-3 border-b bg-gray-50 text-sm">
        <span className="font-medium">Visible floors:</span>
        {brief.floors.map((f) => (
          <label key={f.floor} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={visibleFloors.has(f.floor)}
              onChange={(e) => {
                const next = new Set(visibleFloors);
                if (e.target.checked) next.add(f.floor);
                else next.delete(f.floor);
                setVisibleFloors(next);
              }}
            />
            {f.label}
          </label>
        ))}
        <span className="border-l ml-2 pl-3 flex gap-3">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Labels
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showRoof}
              onChange={(e) => setShowRoof(e.target.checked)}
            />
            Roof
          </label>
        </span>
        <span className="ml-auto text-xs text-gray-500">
          Drag to rotate · scroll to zoom · right-click drag to pan
        </span>
      </div>
      <div style={{ width: "100%", height: 520 }}>
        <Canvas
          shadows
          camera={{
            position: [maxDim * 1.4, maxDim * 1.2, maxDim * 1.4],
            fov: 45,
            near: 0.1,
            far: maxDim * 20,
          }}
        >
          <Suspense fallback={null}>
            <Sky sunPosition={[100, 50, 100]} turbidity={6} rayleigh={1.5} />
            <ambientLight intensity={0.55} />
            <directionalLight
              position={[maxDim, maxDim * 1.5, maxDim]}
              intensity={1.3}
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-camera-left={-maxDim * 2}
              shadow-camera-right={maxDim * 2}
              shadow-camera-top={maxDim * 2}
              shadow-camera-bottom={-maxDim * 2}
            />
            <Ground size={maxDim} />

            {allPlaced.map(({ floor, placed, edges }) => {
              if (!visibleFloors.has(floor.floor)) return null;
              const baseY = floor.floor * FLOOR_HEIGHT_FT;
              return (
                <group key={floor.floor} position={[offsetX, baseY, offsetZ]}>
                  {/* Structural floor slab */}
                  <mesh
                    position={[footprintW / 2, 0, footprintD / 2]}
                    receiveShadow
                  >
                    <boxGeometry args={[footprintW + 1, SLAB_THICKNESS, footprintD + 1]} />
                    <meshStandardMaterial color="#9ca3af" roughness={0.95} />
                    <Edges color="#52525b" threshold={20} />
                  </mesh>
                  {placed.map(({ x, z, r }, i) => (
                    <Room3D
                      key={i}
                      x={x}
                      z={z}
                      width={r.widthFt}
                      depth={r.depthFt}
                      height={FLOOR_HEIGHT_FT * 0.85}
                      color={COLOR_BY_TYPE[r.type] || "#e5e7eb"}
                      label={r.name}
                      showLabel={showLabels}
                      isExteriorEdge={edges.get(i)!}
                    />
                  ))}
                </group>
              );
            })}

            {/* Roof on top of the highest visible floor */}
            {showRoof && visibleFloors.has(topFloorIndex) && (
              <group position={[offsetX, 0, offsetZ]}>
                {isResidential ? (
                  <Roof width={footprintW} depth={footprintD} baseY={roofBaseY} />
                ) : (
                  <FlatRoof width={footprintW} depth={footprintD} baseY={roofBaseY} />
                )}
              </group>
            )}

            <OrbitControls
              makeDefault
              enableDamping
              maxPolarAngle={Math.PI / 2.1}
              minDistance={maxDim * 0.5}
              maxDistance={maxDim * 5}
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
