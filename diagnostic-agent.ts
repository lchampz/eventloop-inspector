import { inspector } from "./core-inspector.js";
import { InspectorBlockData } from "./index.d.js";

/**
 * Interface para a resposta estruturada da IA.
 */
export interface DecisionResponse {
  action: "CLEAN_CACHE" | "SCALE_WORKERS" | "REJECT_TRAFFIC" | "NONE";
  reason: string;
  intensity?: number; // 1-10, para ações mais graduais
}

/**
 * Consulta o Ollama local com um prompt de SRE.
 */
export async function askOllamaDecision(
  data: InspectorBlockData,
): Promise<DecisionResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout para a IA

  const prompt = `
    Você é um especialista em SRE para sistemas Node.js. Analise o seguinte evento de performance:
    - Função: ${data.function || "N/A"}
    - Duração do Bloqueio do Event Loop: ${data.blockDuration}ms (limite aceitável 40ms)
    - Uso de Memória Heap: ${data.memoryUsage} (limite aceitável 85%)
    - Requisições I/O Ativas: ${data.activeRequests} (limite aceitável 60)

    **Diagnóstico Rápido:** Identifique o tipo de gargalo (CPU-Bound, Memory-Bound, I/O-Bound).
    **Ação Recomendada (APENAS UMA):**
    - 'SCALE_WORKERS': Se for CPU-Bound.
    - 'CLEAN_CACHE': Se for Memory-Bound e houver cache.
    - 'REJECT_TRAFFIC': Se o servidor estiver sobrecarregado (I/O ou CPU) e perto da falha.
    - 'NONE': Se o problema for leve ou sem ação clara.

    Retorne APENAS um objeto JSON no formato: {"action": "string", "reason": "string", "intensity": number}
    A razão deve ser concisa e a intensidade de 1 a 10 (1 para leve, 10 para crítico).
  `;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "llama3", // Ou 'mistral', 'phi3'
        prompt: prompt,
        format: "json",
        stream: false,
      }),
    });

    const result = await response.json();
    clearTimeout(timeoutId);
    // Tenta parsear o JSON mesmo se vier com algum lixo antes/depois
    const jsonString = result.response.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonString);
  } catch (err) {
    console.error(`[Ollama Error] Falha na consulta: ${err}`);
    return null;
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
