import { EventEmitter } from "events";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { InspectorBlockData, InspectorOptions } from "./index.d.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const addon = require(
  path.resolve(__dirname, "build/Release/eventloop-inspector.node"),
);

export class CoreInspector extends EventEmitter {
  private thresholds: InspectorOptions = { block: 10000, heap: 80, io: 50 };
  private lastBlockTime: number | null = null;

  /**
   * Retorna os thresholds configurados atualmente.
   */
  getThresholds(): InspectorOptions {
    return { ...this.thresholds };
  }

  /**
   * Atualiza os thresholds em runtime.
   */
  setThresholds(options: Partial<InspectorOptions>): void {
    Object.assign(this.thresholds, options);
  }

  start(options: InspectorOptions = {}) {
    Object.assign(this.thresholds, options);

    addon.start((data: any) => {
      const now = Date.now();
      const memoryUsagePct = (data.usedHeap / data.totalHeap) * 100;
      const blockDuration = this.lastBlockTime ? now - this.lastBlockTime : 0;
      this.lastBlockTime = now;

      const eventData: InspectorBlockData = {
        ...data,
        memoryUsage: memoryUsagePct.toFixed(2) + "%",
        timestamp: new Date(now).toISOString(),
        blockDuration,
      };

      this.emit("block", eventData);

      if (memoryUsagePct > (this.thresholds.heap || 80)) {
        this.emit("heapHigh", eventData);
      }
    });
  }
}

export const inspector = new CoreInspector();
