import type { DesignBrief } from "./rules";
import type { Requirements } from "./requirements";

/**
 * DWG export — architecture stub.
 *
 * Status: NOT IMPLEMENTED. This module defines the contract so that when DWG
 * support becomes business-critical, we can plug in an encoder (LibreDWG-WASM,
 * an ODA Teigha integration, or a shell-out to `oda_file_converter`) without
 * changing the API route or UI.
 *
 * Why not implemented today (see also README → Architecture decisions):
 *  1. No npm package writes DWG — only the GPL-3.0 LibreDWG can, and only via
 *     a custom Emscripten build. Linking GPL code into our MIT codebase carries
 *     unresolved IP risk.
 *  2. `oda_file_converter` (free ODA tool) works perfectly but needs a binary
 *     on the deploy host — breaks our Vercel serverless deploy story.
 *  3. ODA Teigha SDK ($2-5K/year) is the canonical solution and remains the
 *     correct path once we have ≥5 paying customers requiring DWG.
 *
 * For now: every existing DXF consumer (AutoCAD, LibreCAD, QCAD, DraftSight,
 * FreeCAD, BricsCAD) accepts the DXF we already emit. No client is blocked.
 *
 * To wire in a real encoder later, implement `buildDwg()` and remove the
 * `notImplemented` guard. The HTTP route and UI button will automatically
 * pick it up — no other changes needed.
 */

export type DwgEncoder = (req: Requirements, brief: DesignBrief) => Promise<Uint8Array>;

export const DWG_NOT_IMPLEMENTED = "dwg_not_implemented" as const;

export type DwgBuildResult =
  | { ok: true; bytes: Uint8Array; version: string }
  | { ok: false; reason: typeof DWG_NOT_IMPLEMENTED; suggestedExport: "dxf"; suggestedHref: (designId: string) => string };

/**
 * Returns a stub result by default. Swap the body of this function (or pass
 * a real encoder to `setDwgEncoder`) when an encoder lands.
 */
let activeEncoder: DwgEncoder | null = null;

export function setDwgEncoder(enc: DwgEncoder | null) {
  activeEncoder = enc;
}

export async function buildDwg(
  req: Requirements,
  brief: DesignBrief
): Promise<DwgBuildResult> {
  if (!activeEncoder) {
    return {
      ok: false,
      reason: DWG_NOT_IMPLEMENTED,
      suggestedExport: "dxf",
      suggestedHref: (designId) => `/api/architect/export/${designId}/dxf`,
    };
  }
  const bytes = await activeEncoder(req, brief);
  return { ok: true, bytes, version: "R12" };
}

export function isDwgEnabled(): boolean {
  return activeEncoder !== null;
}
