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
 * Interface para os dados de validação
 */
interface ValidationContext {
  lagValue: number;
  memoryValue: number;
  ioValue: number;
  blockThreshold: number;
  heapThreshold: number;
  ioThreshold: number;
  isLagHigh: boolean;
  isMemoryHigh: boolean;
  isIoHigh: boolean;
  isLagLow: boolean;
}

/**
 * Valida e corrige a decisão da IA com base nos dados reais.
 * Se a IA cometer um erro de comparação, corrige automaticamente.
 */
function validateAndCorrectDecision(
  decision: DecisionResponse,
  ctx: ValidationContext,
): DecisionResponse {
  const {
    lagValue,
    memoryValue,
    ioValue,
    blockThreshold,
    heapThreshold,
    ioThreshold,
  } = ctx;
  const { isLagHigh, isMemoryHigh, isIoHigh, isLagLow } = ctx;

  // Verifica se a IA tomou uma decisão inconsistente com os dados
  let correctedAction = decision.action;
  let correctedReason = decision.reason;
  let needsCorrection = false;

  // Prioridade 1: Memória alta
  if (isMemoryHigh && decision.action !== "CLEAN_CACHE") {
    correctedAction = "CLEAN_CACHE";
    correctedReason = `Memória ${memoryValue.toFixed(2)}% excede limite de ${heapThreshold}%`;
    needsCorrection = true;
  }
  // Prioridade 2: I/O alto
  else if (isIoHigh && decision.action !== "REJECT_TRAFFIC" && !isMemoryHigh) {
    correctedAction = "REJECT_TRAFFIC";
    correctedReason = `I/O ${ioValue} requisições excede limite de ${ioThreshold}`;
    needsCorrection = true;
  }
  // Prioridade 3: Lag alto
  else if (
    isLagHigh &&
    decision.action !== "SCALE_UP_WORKERS" &&
    !isMemoryHigh &&
    !isIoHigh
  ) {
    correctedAction = "SCALE_UP_WORKERS";
    correctedReason = `Lag ${lagValue}ms excede limite de ${blockThreshold}ms`;
    needsCorrection = true;
  }
  // Prioridade 4: Lag muito baixo (economia)
  else if (
    isLagLow &&
    memoryValue < 50 &&
    decision.action !== "SCALE_DOWN_WORKERS" &&
    !isMemoryHigh &&
    !isIoHigh &&
    !isLagHigh
  ) {
    correctedAction = "SCALE_DOWN_WORKERS";
    correctedReason = `Lag ${lagValue}ms muito baixo, oportunidade de economia`;
    needsCorrection = true;
  }
  // Correção: IA disse para escalar mas não há necessidade
  else if (
    (decision.action === "SCALE_UP_WORKERS" && !isLagHigh) ||
    (decision.action === "CLEAN_CACHE" && !isMemoryHigh) ||
    (decision.action === "REJECT_TRAFFIC" && !isIoHigh)
  ) {
    correctedAction = "NONE";
    correctedReason = `Métricas dentro dos limites (Lag: ${lagValue}ms, Mem: ${memoryValue.toFixed(2)}%, I/O: ${ioValue})`;
    needsCorrection = true;
  }

  if (needsCorrection) {
    console.log(
      `[Validação] Corrigindo decisão da IA: ${decision.action} → ${correctedAction}`,
    );
  }

  return {
    action: correctedAction,
    reason: correctedReason,
    intensity: calculateIntensity(ctx),
  };
}

/**
 * Calcula a intensidade com base na severidade dos valores
 */
function calculateIntensity(ctx: ValidationContext): number {
  const {
    lagValue,
    memoryValue,
    ioValue,
    blockThreshold,
    heapThreshold,
    ioThreshold,
  } = ctx;

  // Calcula o quanto cada métrica excede o limite (em %)
  const lagExcess = Math.max(0, (lagValue - blockThreshold) / blockThreshold);
  const memExcess = Math.max(0, (memoryValue - heapThreshold) / heapThreshold);
  const ioExcess = Math.max(0, (ioValue - ioThreshold) / ioThreshold);

  // Pega o maior excesso e converte para escala 1-10
  const maxExcess = Math.max(lagExcess, memExcess, ioExcess);
  const intensity = Math.min(10, Math.max(1, Math.round(1 + maxExcess * 9)));

  return intensity;
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

  // Obtém os thresholds configurados pelo user
  const thresholds = inspector.getThresholds();
  const blockThreshold = thresholds.block || 50;
  const heapThreshold = thresholds.heap || 85;
  const ioThreshold = thresholds.io || 100;

  // Extrai valor numérico da memória (remove o %)
  const memoryValue = parseFloat(data.memoryUsage?.replace("%", "") || "0");
  const lagValue = data.blockDuration || 0;
  const ioValue = data.activeRequests || 0;

  // Pré-calcula as condições para ajudar a IA
  const isLagHigh = lagValue > blockThreshold;
  const isLagLow = lagValue < Math.floor(blockThreshold * 0.3);
  const isMemoryHigh = memoryValue > heapThreshold;
  const isIoHigh = ioValue > ioThreshold;

  const prompt = `Você é um sistema de decisão para orquestração de recursos Node.js.

DADOS ATUAIS (valores numéricos exatos):
- Lag atual: ${lagValue}ms
- Memória atual: ${memoryValue.toFixed(2)}%
- I/O ativo: ${ioValue} requisições
- Função: ${data.function}

LIMITES CONFIGURADOS:
- Limite de Lag: ${blockThreshold}ms
- Limite de Memória: ${heapThreshold}%
- Limite de I/O: ${ioThreshold} requisições

ANÁLISE PRÉ-CALCULADA:
- Lag ${lagValue}ms ${isLagHigh ? ">" : "<="} ${blockThreshold}ms → Lag ${isLagHigh ? "ACIMA" : "DENTRO"} do limite
- Memória ${memoryValue.toFixed(2)}% ${isMemoryHigh ? ">" : "<="} ${heapThreshold}% → Memória ${isMemoryHigh ? "ACIMA" : "DENTRO"} do limite
- I/O ${ioValue} ${isIoHigh ? ">" : "<="} ${ioThreshold} → I/O ${isIoHigh ? "ACIMA" : "DENTRO"} do limite

REGRAS DE DECISÃO (em ordem de prioridade):
1. Se Memória ACIMA do limite → "CLEAN_CACHE"
2. Se I/O ACIMA do limite → "REJECT_TRAFFIC"
3. Se Lag ACIMA do limite → "SCALE_UP_WORKERS"
4. Se Lag muito baixo (< ${Math.floor(blockThreshold * 0.3)}ms) e Memória baixa → "SCALE_DOWN_WORKERS"
5. Se tudo dentro dos limites → "NONE"

EXEMPLOS:
- Lag=100ms, Limite=50ms → Lag ACIMA → {"action":"SCALE_UP_WORKERS","reason":"Lag 100ms excede limite de 50ms","intensity":7}
- Lag=30ms, Limite=50ms → Lag DENTRO → {"action":"NONE","reason":"Lag 30ms dentro do limite de 50ms","intensity":1}
- Memória=90%, Limite=85% → Memória ACIMA → {"action":"CLEAN_CACHE","reason":"Memória 90% excede limite de 85%","intensity":8}
- Memória=70%, Limite=85% → Memória DENTRO → considere outras métricas

IMPORTANTE: Use APENAS a análise pré-calculada acima. Não invente valores.

Responda APENAS com JSON válido:
{"action":"AÇÃO","reason":"explicação curta com valores reais","intensity":1-10}`;

  try {
    const res = await fetch(getOllamaEndpoint(), {
      method: "POST",
      body: JSON.stringify({
        model: getOllamaModel(),
        prompt: prompt,
        format: "json",
        stream: false,
        options: {
          temperature: 0.1, // Baixa temperatura para respostas mais determinísticas
          top_p: 0.9,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    const result = await res.json();
    lastDecisionTime = Date.now();

    const parsed = JSON.parse(result.response) as DecisionResponse;

    // Validação: se a IA errou na análise, corrige com base nos dados reais
    const correctedDecision = validateAndCorrectDecision(parsed, {
      lagValue,
      memoryValue,
      ioValue,
      blockThreshold,
      heapThreshold,
      ioThreshold,
      isLagHigh,
      isMemoryHigh,
      isIoHigh,
      isLagLow,
    });

    return correctedDecision;
  } catch (e) {
    console.error(
      "[Ollama Error] Falha na consulta:",
      e instanceof Error ? e.message : e,
    );
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
  block: 3000, // Tempo de bloqueio em ms para considerar alerta
  heap: 85, // Porcentagem de uso de heap para alerta
  io: 50, // Número de requisições de I/O ativas para alerta
  criticalFunctions: ["expensiveCalculation"], // Nomes de funções a monitorar especificamente
});
console.log("🚀 Agente de Diagnóstico e Orquestração AI Ativo.");
