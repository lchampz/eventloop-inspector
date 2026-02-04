import { EventEmitter } from "events";

/**
 * Interface que representa os dados de um alerta de bloqueio
 */
export interface BlockEventData {
  /** Nome da função que estava no topo da stack no momento do bloqueio */
  function: string;
  /** Timestamp ISO do momento do alerta */
  timestamp: string;
  /** Porcentagem de uso da memória Heap do V8 (ex: "45.50%") */
  memoryUsage: string;
  /** Quantidade de bytes da Heap em uso */
  usedHeap: number;
  /** Limite total de memória Heap disponível para o processo */
  totalHeap: number;
  /** Número de requisições de I/O pendentes na libuv */
  activeRequests: number;
}

/**
 * Opções de inicialização do inspetor
 */
export interface InspectorOptions {
  /** Tempo em milissegundos para considerar um tick como 'bloqueado'. Padrão: 40 */
  threshold?: number;
}

declare class CoreInspector extends EventEmitter {
  /**
   * Inicia o monitoramento nativo do Event Loop e V8.
   * @param options Configurações opcionais de monitoramento.
   */
  start(options?: InspectorOptions): void;

  /**
   * Evento disparado quando um bloqueio de performance é detectado.
   */
  on(event: "block", listener: (data: BlockEventData) => void): this;
}

export const inspector: CoreInspector;
