// index.d.ts (na raiz do projeto)

import { EventEmitter } from "events";

export interface InspectorBlockData {
  function: string;
  usedHeap: number;
  totalHeap: number;
  activeRequests: number;
  microtasksCount?: number;
  memoryUsage: string; // Ex: "80.50%"
  timestamp?: string; // ISO string
  blockDuration?: number; // ms
}

export interface InspectorOptions {
  block?: number; // Limite de duração do bloco em ms
  heap?: number; // Limite de uso de heap em %
  io?: number; // Limite de requisições I/O ativas
  microtasks?: number; // Limite de microtasks pendentes
  criticalFunctions?: string[]; // Nomes de funções a monitorar especificamente
}

export interface DecisionResponse {
  action: "CLEAN_CACHE" | "SCALE_WORKERS" | "REJECT_TRAFFIC" | "NONE";
  reason: string;
  intensity?: number; // 1-10
}

export declare class CoreInspector extends EventEmitter {
  start(options?: InspectorOptions): void;
  setThresholds(newThresholds: InspectorOptions): void;

  // Eventos de telemetria
  on(event: "block", listener: (data: InspectorBlockData) => void): this;
  on(event: "heapHigh", listener: (data: InspectorBlockData) => void): this;
  on(event: "ioStall", listener: (data: InspectorBlockData) => void): this;
  on(event: "raceSuspect", listener: (data: InspectorBlockData) => void): this;
  on(
    event: "blockCritical",
    listener: (data: InspectorBlockData) => void,
  ): this;
}

export const inspector: CoreInspector;
