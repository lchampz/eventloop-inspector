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

### Em JavaScript (ESM)

```javascript
import { inspector } from "eventloop-sentry";

// Configuração avançada de thresholds e funções críticas
inspector.start({
  block: 50, // ms para considerar bloqueio
  heap: 85, // % para alerta de heap alto
  io: 100, // requisições pendentes para alerta de I/O
  microtasks: 2000, // microtasks para suspeita de race condition
  criticalFunctions: ["processTicksAndRejections", "heavyFunction"], // funções bloqueantes
});

// Evento de bloqueio do Event Loop
inspector.on("block", (data) => {
  console.warn(`[PERF] Bloqueio detectado em: ${data.function}`);
  console.log(`[MEM] Uso de Heap: ${data.memoryUsage}`);
  console.log(`[I/O] Reqs pendentes: ${data.activeRequests}`);
  console.log(`[MICRO] Microtasks: ${data.microtasksCount}`);
  console.log(`[TEMPO] Duração do bloqueio: ${data.blockDuration}ms`);
});

// Evento de Heap alto
inspector.on("heapHigh", (data) => {
  console.error(`[ALERTA] Heap em nível crítico: ${data.memoryUsage}`);
  // Exemplo: escalar horizontalmente
  // triggerScaleUp();
});

// Evento de I/O pendente
inspector.on("ioStall", (data) => {
  console.error(
    `[ALERTA] Muitas requisições pendentes: ${data.activeRequests}`,
  );
  // Exemplo: redistribuir tarefas
  // redistributeTasks();
});

// Evento de suspeita de race condition
inspector.on("raceSuspect", (data) => {
  console.warn(
    `[RACE] Suspeita de race condition! Microtasks: ${data.microtasksCount}`,
  );
  // Exemplo: log detalhado ou ajuste de concorrência
});

// Evento de função bloqueante crítica
inspector.on("blockCritical", (data) => {
  console.error(`[CRÍTICO] Função bloqueante detectada: ${data.function}`);
  // Exemplo: reiniciar serviço ou migrar tarefa
  // restartService(data.function);
});

// Alterar thresholds em runtime
inspector.setThresholds({ heap: 90, block: 60 });

// Definir funções críticas em runtime
inspector.setCriticalFunctions(["heavyFunction", "dangerZone"]);
```

### Em TypeScript

A lib já inclui definições de tipos nativas.

```typescript
import { inspector, BlockEventData } from "eventloop-sentry";

inspector.on("block", (data: BlockEventData) => {
  console.log(data);
  //handle para eventos bloqueantes
});
```

## 📊 Gráficos e Diagnóstico

Para rodar o dashboard visual de telemetria incluído no repositório:

1. Clone o projeto.
2. Execute `npm install`.
3. Execute `node telemetry.js`.
4. Abra `http://localhost:3000`.

## 🛠️ Eventos e Atributos Monitorados

- **block:** Bloqueio do Event Loop detectado (com função, heap, I/O, microtasks, duração, timestamp)
- **heapHigh:** Heap acima do limite configurado
- **ioStall:** Muitas requisições pendentes na libuv
- **raceSuspect:** Suspeita de race condition por excesso de microtasks
- **blockCritical:** Função bloqueante crítica detectada

### Dados enviados em cada evento

- `function`: Nome da função no topo da stack
- `usedHeap`: Bytes usados na heap
- `totalHeap`: Limite total da heap
- `memoryUsage`: Porcentagem de uso da heap
- `activeRequests`: Requisições pendentes na libuv
- `microtasksCount`: Contagem de microtasks
- `timestamp`: Data/hora do evento
- `blockDuration`: Duração do bloqueio (ms)

## ⚡ Programação Reativa e Adaptativa

Você pode reagir a eventos e adaptar o comportamento da aplicação em tempo real:

- Escalar horizontalmente ao detectar heap alta
- Redistribuir tarefas em caso de I/O pendente
- Reiniciar serviços ou migrar tarefas para funções bloqueantes críticas
- Alterar thresholds e funções críticas em runtime

Exemplo:

```javascript
inspector.on("heapHigh", (data) => {
  if (parseFloat(data.memoryUsage) > 90) {
    triggerScaleUp();
  }
});

inspector.on("blockCritical", (data) => {
  restartService(data.function);
});
```

## 📜 Licença

MIT
