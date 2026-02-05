import { inspector } from "./core-inspector.js";
import { InspectorBlockData } from "./index.d.js";

/**
 * Interface para a resposta estruturada da IA.
 */
export interface DecisionResponse {
  action: ActionType;
  reason: string;
  intensity?: number; // 1-10, para ações mais graduais
}

/**
 * Tipos de ações disponíveis
 */
export type ActionType =
  | "CLEAN_CACHE"
  | "SCALE_WORKERS"
  | "REJECT_TRAFFIC"
  | "NONE"
  | "SCALE_DOWN_WORKERS"
  | "SCALE_UP_WORKERS";

/**
 * Callback para ações customizadas
 */
export type ActionCallback = (
  decision: DecisionResponse,
) => void | Promise<void>;

/**
 * Registro de callbacks personalizados para cada ação
 */
const actionHandlers: Map<ActionType, ActionCallback> = new Map();

export class IaWrapper {
  private url: string = "http://localhost:11434/api/generate";
  private model: string = "llama3";
  constructor(url?: string, model?: string) {
    if (url) {
      this.url = url;
    }
    if (model) {
      this.model = model;
    }
  }
  getEndpoint() {
    return this.url;
  }
  setEndpoint(url: string) {
    this.url = url;
  }
  getModel() {
    return this.model;
  }
  setModel(model: string) {
    this.model = model;
  }
}

const iaInstance = new IaWrapper();

export function getOllamaEndpoint(): string {
  return iaInstance.getEndpoint();
}

export function setOllamaEndpoint(url: string): void {
  iaInstance.setEndpoint(url);
}

export function getOllamaModel(): string {
  return iaInstance.getModel();
}

export function setOllamaModel(model: string): void {
  iaInstance.setModel(model);
}
/**
 * Registra um callback personalizado para uma ação específica.
 * @param action - O tipo de ação para registrar
 * @param callback - A função a ser executada quando a ação for acionada
 * @example
 * setAction("SCALE_WORKERS", (decision) => {
 *   console.log(`Escalando workers com intensidade ${decision.intensity}`);
 *   workerPool.scale(decision.intensity);
 * });
 */
export function setAction(action: ActionType, callback: ActionCallback): void {
  actionHandlers.set(action, callback);
}

/**
 * Remove um callback registrado para uma ação.
 * @param action - O tipo de ação para remover o callback
 */
export function removeAction(action: ActionType): void {
  actionHandlers.delete(action);
}

/**
 * Retorna todos os handlers registrados (útil para debug)
 */
export function getRegisteredActions(): ActionType[] {
  return Array.from(actionHandlers.keys());
}

/**
 * Consulta o Ollama local com um prompt de SRE.
 */
let isAnalyzing = false;
let lastDecisionTime = 0;
const COOLDOWN_MS = 10000; // 10 segundos de espera entre decisões da IA

export async function askOllamaDecision(
  data: InspectorBlockData,
): Promise<DecisionResponse | null> {
  const now = Date.now();

  if (isAnalyzing || now - lastDecisionTime < COOLDOWN_MS) {
    //evita sobrecarga no modelo
    return null;
  }

  isAnalyzing = true;

  const prompt = `
    Você é um Orquestrador de Recursos Autônomo.
    ESTADO ATUAL:
    - Função: ${data.function}
    - Lag: ${data.blockDuration}ms
    - Memória: ${data.memoryUsage}
    - I/O Ativo: ${data.activeRequests}

    OBJETIVO: Encontrar o equilíbrio entre performance e custo.
    REGRAS:
    - Se Lag > 50ms constante: 'SCALE_UP_WORKERS'
    - Se Lag < 15ms por muito tempo e Memória estável: 'SCALE_DOWN_WORKERS' (Economia)
    - Se Memória > 85%: 'CLEAN_CACHE'
    - Se tudo está normal: 'NONE'

    Responda apenas JSON: {"action": "string", "reason": "string", "intensity": number}
  `;

  try {
    const res = await fetch(getOllamaEndpoint(), {
      method: "POST",
      body: JSON.stringify({
        model: getOllamaModel(),
        prompt: prompt,
        format: "json",
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const result = await res.json();
    lastDecisionTime = Date.now();
    return JSON.parse(result.response);
  } catch (e) {
    console.error("Ollama indisponível ou Timeout");
    return null;
  } finally {
    isAnalyzing = false;
  }
}

/**
 * Executa a ação sugerida pela IA no ambiente Node.js.
 * Se houver um callback registrado via setAction(), ele será executado.
 * Caso contrário, executa a ação padrão.
 */
export async function executeAction(decision: DecisionResponse): Promise<void> {
  console.log(
    `[Agente] IA Decidiu: ${decision.action} (Intensidade: ${decision.intensity}) - ${decision.reason}`,
  );

  // Verifica se há um handler customizado registrado
  const customHandler = actionHandlers.get(decision.action);
  if (customHandler) {
    try {
      await customHandler(decision);
      return;
    } catch (error) {
      console.error(
        `[Agente] Erro ao executar handler customizado para ${decision.action}:`,
        error,
      );
      return;
    }
  }

  // Comportamento padrão (fallback) se nenhum handler foi registrado
  switch (decision.action) {
    case "SCALE_WORKERS":
    case "SCALE_UP_WORKERS":
      console.log(
        "[AÇÃO] Nenhum handler registrado para SCALE_WORKERS. Use setAction() para configurar.",
      );
      break;

    case "SCALE_DOWN_WORKERS":
      console.log(
        "[AÇÃO] Nenhum handler registrado para SCALE_DOWN_WORKERS. Use setAction() para configurar.",
      );
      break;

    case "CLEAN_CACHE":
      if (global.gc) {
        console.log("[AÇÃO] Forçando GC para liberar memória...");
        global.gc();
      } else {
        console.warn("[AÇÃO] GC não disponível. Rode Node com --expose-gc.");
      }
      break;

    case "REJECT_TRAFFIC":
      console.log(
        "[AÇÃO] Nenhum handler registrado para REJECT_TRAFFIC. Use setAction() para configurar.",
      );
      break;

    case "NONE":
    default:
      // Nenhuma ação necessária
      break;
  }
}

// Inicia o Inspetor quando este módulo é carregado
inspector.start({
  block: 5000, // Tempo de bloqueio em ms para considerar alerta
  heap: 85, // Porcentagem de uso de heap para alerta
  io: 50, // Número de requisições de I/O ativas para alerta
  criticalFunctions: ["expensiveCalculation"], // Nomes de funções a monitorar especificamente
});
console.log("🚀 Agente de Diagnóstico e Orquestração AI Ativo.");
