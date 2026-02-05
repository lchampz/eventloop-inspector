import { inspector } from "./core-inspector.js";
import { InspectorBlockData } from "./index.d.js";

/**
 * Interface para a resposta estruturada da IA.
 */
export interface DecisionResponse {
  action:
    | "CLEAN_CACHE"
    | "SCALE_WORKERS"
    | "REJECT_TRAFFIC"
    | "NONE"
    | "SCALE_DOWN_WORKERS"
    | "SCALE_UP_WORKERS";
  reason: string;
  intensity?: number; // 1-10, para ações mais graduais
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
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      body: JSON.stringify({
        model: "llama3",
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
 */
export function executeAction(decision: DecisionResponse) {
  console.log(
    `[Agente] IA Decidiu: ${decision.action} (Intensidade: ${decision.intensity}) - ${decision.reason}`,
  );

  switch (decision.action) {
    case "SCALE_WORKERS":
      console.log("[AÇÃO] Escalando Workers (Implementação pendente)...");
      break;
    case "SCALE_UP_WORKERS":
      console.log("🚀 Aumentando threads para processamento paralelo");
      // Sua lógica de pool.addWorker()
      break;

    case "SCALE_DOWN_WORKERS":
      console.log("📉 Reduzindo threads ociosas para economizar recursos");
      // Sua lógica de pool.removeWorker() ou pool.terminate()
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
      console.log("[AÇÃO] Ativando Circuit Breaker para rejeitar tráfego...");
      break;
    case "NONE":
    default:
      console.log("[AÇÃO] Nenhuma ação necessária no momento.");
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
