import type { Server as SocketIOServer } from "socket.io";

export type TerritoryEvent =
  | "landPurchased"
  | "landClaimed"
  | "landLost"
  | "landCaptured"
  | "bidPlaced";

export interface PlotPatch {
  plotId: number;
  isLegendary: boolean;
  legendaryTokenId: number | null;
  name: string;
  ownerWallet: string | null;
  landlordHandle: string | null;
  status: string;
  lastClaimAt: string | null;
  abandonedAt: string | null;
  renters: unknown[];
}

let io: SocketIOServer | null = null;

export function initTerritorySocket(server: SocketIOServer): void {
  io = server;

  io.on("connection", (socket) => {
    socket.join("territory");
    socket.on("disconnect", () => {
      /* noop */
    });
  });
}

export function emitTerritoryEvent(event: TerritoryEvent, payload: Record<string, unknown>): void {
  if (!io) return;
  io.to("territory").emit(event, payload);
}

export function emitPlotPatch(patch: PlotPatch): void {
  if (!io) return;
  io.to("territory").emit("plots:patch", patch);
}

export function toPlotPatch(plot: {
  plotId: number;
  type: string;
  legendaryTokenId: number | null;
  name: string;
  ownerWallet: string | null;
  landlordHandle: string | null;
  status: string;
  lastClaimAt: Date | null;
  abandonedAt?: Date | null;
  renters: unknown[];
}): PlotPatch {
  return {
    plotId: plot.plotId,
    isLegendary: plot.type === "legendary",
    legendaryTokenId: plot.legendaryTokenId,
    name: plot.name,
    ownerWallet: plot.ownerWallet,
    landlordHandle: plot.landlordHandle,
    status: plot.status,
    lastClaimAt: plot.lastClaimAt ? plot.lastClaimAt.toISOString() : null,
    abandonedAt: plot.abandonedAt ? plot.abandonedAt.toISOString() : null,
    renters: plot.renters,
  };
}
