# Eventloop Sentry 🚀

**Eventloop Sentry** é um "Sentry" de baixo nível para aplicações Node.js. Ele utiliza um Addon nativo escrito em C++ para monitorar o **Event Loop**, a **Microtask Queue (V8)** e o **Heap Memory** sem o overhead de ferramentas puramente escritas em JavaScript.

Ideal para detectar **Race Conditions**, **Memory Leaks** e **Funções Bloqueantes** em tempo real.

## 🏗️ Como funciona

Diferente de profilers comuns, esta lib cria uma thread separada no nível do sistema operacional (C++). Essa thread observa o "batimento cardíaco" do Node.js e só acorda o seu código JavaScript quando um bloqueio real é detectado, garantindo **performance máxima** em produção.

## 📦 Instalação

```bash
npm install eventloop-sentry
```

_Nota: Requer ferramentas de compilação (Python/C++) instaladas para o `node-gyp`._

## 🚀 Uso Rápido

### Monitoramento Básico

```javascript
import { inspector } from "eventloop-sentry";

// Inicia o monitoramento com configurações padrão
inspector.start({
  block: 50, // ms para considerar bloqueio
  heap: 85, // % para alerta de heap alto
  io: 100, // requisições pendentes para alerta de I/O
  microtasks: 2000, // microtasks para suspeita de race condition
  criticalFunctions: ["processTicksAndRejections", "heavyFunction"],
});

// Escuta eventos de bloqueio
inspector.on("block", (data) => {
  console.warn(`[PERF] Bloqueio detectado em: ${data.function}`);
  console.log(`[MEM] Uso de Heap: ${data.memoryUsage}`);
  console.log(`[TEMPO] Duração: ${data.blockDuration}ms`);
});
```

### Em TypeScript

A lib já inclui definições de tipos nativas.

```typescript
import { inspector, InspectorBlockData } from "eventloop-sentry";

inspector.on("block", (data: InspectorBlockData) => {
  console.log(data);
});
```

---

## 🤖 Agente de Diagnóstico com IA (Ollama)

A biblioteca inclui um **Agente de Diagnóstico Autônomo** que utiliza IA local (Ollama) para tomar decisões em tempo real sobre o que fazer quando problemas são detectados.

### Configuração do Ollama

```javascript
import { setOllamaEndpoint, setOllamaModel } from "eventloop-sentry";

// Configurar endpoint (padrão: http://localhost:11434/api/generate)
setOllamaEndpoint("http://localhost:11434/api/generate");

// Configurar modelo (padrão: llama3)
setOllamaModel("llama3");
```

### Usando o Agente de Diagnóstico

```javascript
import {
  inspector,
  askOllamaDecision,
  executeAction,
  setAction,
} from "eventloop-sentry";

// Escuta eventos e consulta a IA para decisões
inspector.on("block", async (data) => {
  const decision = await askOllamaDecision(data);
  if (decision) {
    await executeAction(decision);
  }
});
```

---

## 🎯 Registrando Ações Customizadas

O grande diferencial da lib é permitir que você **injete seus próprios callbacks** para cada tipo de ação que a IA pode decidir. Isso torna a biblioteca totalmente adaptável ao seu ambiente.

### API de Ações

```javascript
import {
  setAction,
  removeAction,
  getRegisteredActions,
} from "eventloop-sentry";
```

### Tipos de Ações Disponíveis

| Ação                 | Descrição                  |
| -------------------- | -------------------------- |
| `SCALE_WORKERS`      | Escalar workers (genérico) |
| `SCALE_UP_WORKERS`   | Aumentar número de workers |
| `SCALE_DOWN_WORKERS` | Reduzir workers ociosos    |
| `CLEAN_CACHE`        | Limpar cache/forçar GC     |
| `REJECT_TRAFFIC`     | Ativar circuit breaker     |
| `NONE`               | Nenhuma ação necessária    |

### Exemplo Completo

```javascript
import {
  setAction,
  inspector,
  askOllamaDecision,
  executeAction,
} from "eventloop-sentry";

// 1. Registrar callbacks para cada ação
setAction("SCALE_UP_WORKERS", async (decision) => {
  console.log(`🚀 Escalando ${decision.intensity} workers...`);
  await workerPool.addWorkers(decision.intensity);
});

setAction("SCALE_DOWN_WORKERS", (decision) => {
  console.log(`📉 Reduzindo workers para economizar recursos...`);
  workerPool.removeIdleWorkers(decision.intensity);
});

setAction("CLEAN_CACHE", (decision) => {
  console.log(`🧹 Limpando cache...`);
  cache.flush();
  if (global.gc) global.gc(); // Requer --expose-gc
});

setAction("REJECT_TRAFFIC", (decision) => {
  console.log(`🚫 Ativando circuit breaker por ${decision.intensity * 10}s`);
  circuitBreaker.open();
  setTimeout(() => circuitBreaker.close(), decision.intensity * 10000);
});

// 2. Conectar ao inspetor
inspector.start({ block: 50, heap: 85 });

inspector.on("block", async (data) => {
  const decision = await askOllamaDecision(data);
  if (decision) {
    await executeAction(decision); // Executa seu callback registrado!
  }
});
```

### Gerenciando Ações

```javascript
import {
  setAction,
  removeAction,
  getRegisteredActions,
} from "eventloop-sentry";

// Registrar
setAction("SCALE_WORKERS", myCallback);

// Ver ações registradas
console.log(getRegisteredActions());
// ["SCALE_WORKERS"]

// Remover
removeAction("SCALE_WORKERS");
```

---

## 📡 Eventos do Inspetor

| Evento          | Descrição                             |
| --------------- | ------------------------------------- |
| `block`         | Bloqueio do Event Loop detectado      |
| `heapHigh`      | Heap acima do limite configurado      |
| `ioStall`       | Muitas requisições pendentes na libuv |
| `raceSuspect`   | Suspeita de race condition            |
| `blockCritical` | Função bloqueante crítica detectada   |

### Dados enviados em cada evento

```typescript
interface InspectorBlockData {
  function: string; // Nome da função no topo da stack
  usedHeap: number; // Bytes usados na heap
  totalHeap: number; // Limite total da heap
  memoryUsage: string; // Porcentagem de uso (ex: "75.50%")
  activeRequests: number; // Requisições pendentes na libuv
  microtasksCount?: number; // Contagem de microtasks
  timestamp?: string; // Data/hora ISO do evento
  blockDuration?: number; // Duração do bloqueio (ms)
}
```

### Exemplo de Todos os Eventos

```javascript
inspector.on("block", (data) => {
  console.warn(`[PERF] Bloqueio: ${data.function} - ${data.blockDuration}ms`);
});

inspector.on("heapHigh", (data) => {
  console.error(`[MEM] Heap crítica: ${data.memoryUsage}`);
});

inspector.on("ioStall", (data) => {
  console.error(`[I/O] Requisições pendentes: ${data.activeRequests}`);
});

inspector.on("raceSuspect", (data) => {
  console.warn(`[RACE] Microtasks suspeitas: ${data.microtasksCount}`);
});

inspector.on("blockCritical", (data) => {
  console.error(`[CRÍTICO] Função bloqueante: ${data.function}`);
});
```

---

## ⚙️ Configuração em Runtime

```javascript
// Alterar thresholds em runtime
inspector.setThresholds({ heap: 90, block: 60 });

// Definir funções críticas em runtime
inspector.setCriticalFunctions(["heavyFunction", "dangerZone"]);
```

---

## 📊 Dashboard Visual

Para rodar o dashboard visual de telemetria incluído no repositório:

```bash
git clone https://github.com/seu-usuario/eventloop-sentry.git
cd eventloop-sentry
npm install
npm run dev
```

Abra `http://localhost:3000` para visualizar métricas em tempo real.

---

## 🔧 Requisitos

- Node.js 18+ (recomendado 20+)
- Python 3.x (para node-gyp)
- Compilador C++ (Xcode no macOS, build-essential no Linux, Visual Studio no Windows)
- Ollama rodando localmente (opcional, para o agente de IA)

---

## 📜 Licença

MIT
