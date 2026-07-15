export type PlayerRole = "A" | "B";

export type LobbyStatus = "setup" | "waiting" | "playing" | "revealed";

export type SplitPreset = "vertical" | "horizontal" | "diagonal";

export type SplitType = SplitPreset | "custom";

/**
 * All coordinates in split data are normalized to the [0,1] range relative to
 * the image's intrinsic width/height, so masks can be derived at any raster
 * resolution.
 */
export interface Point {
  x: number;
  y: number;
}

export interface SplitData {
  /**
   * The dividing polyline, from one edge of the image to another, in normalized
   * coordinates. For presets this is generated; for custom it is the freehand
   * path drawn by the creator.
   */
  path: Point[];
  /**
   * A seed point (normalized) that lies inside region A. Region B is everything
   * on the other side of the dividing path.
   */
  seedA: Point;
  /** A seed point (normalized) that lies inside region B. */
  seedB: Point;
}

export interface Lobby {
  id: string;
  code: string;
  page_image: string;
  split_type: SplitType | null;
  split_data: SplitData | null;
  status: LobbyStatus;
  created_at: string;
}

export interface Player {
  id: string;
  lobby_id: string;
  role: PlayerRole;
  client_id: string;
  ready: boolean;
  done: boolean;
  created_at: string;
}

export interface ColoringPage {
  id: string;
  title: string;
  /** Path relative to the site root, e.g. /coloring-pages/house.png */
  src: string;
  width: number;
  height: number;
}

export interface ColoringPageManifest {
  pages: ColoringPage[];
}
