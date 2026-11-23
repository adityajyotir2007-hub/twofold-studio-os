export interface RealtimeBroadcastEvent {
  id: string;
  table: string;
  action: "INSERT" | "UPDATE" | "DELETE" | "TRANSACTION";
  recordId?: string;
  actorId?: string;
  timestamp: number;
}

type Listener = (event: RealtimeBroadcastEvent) => void;

class ServerRealtimeBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: Omit<RealtimeBroadcastEvent, "id" | "timestamp">) {
    const fullEvent: RealtimeBroadcastEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    for (const listener of this.listeners) {
      try {
        listener(fullEvent);
      } catch {
        // ignore listener failure
      }
    }
  }
}

const globalForRealtime = globalThis as unknown as {
  __twofoldRealtimeBus?: ServerRealtimeBus;
};

export const realtimeBus =
  globalForRealtime.__twofoldRealtimeBus ||
  (globalForRealtime.__twofoldRealtimeBus = new ServerRealtimeBus());
