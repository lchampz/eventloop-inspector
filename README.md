# Node Core Sentry 🚀

**Node Core Sentry** é um "Sentry" de baixo nível para aplicações Node.js. Ele utiliza um Addon nativo escrito em C++ para monitorar o **Event Loop**, a **Microtask Queue (V8)** e o **Heap Memory** sem o overhead de ferramentas puramente escritas em JavaScript.

Ideal para detectar **Race Conditions**, **Memory Leaks** e **Funções Bloqueantes** em tempo real.

## 🏗️ Como funciona

Diferente de profilers comuns, esta lib cria uma thread separada no nível do sistema operacional (C++). Essa thread observa o "batimento cardíaco" do Node.js e só acorda o seu código JavaScript quando um bloqueio real é detectado, garantindo **performance máxima** em produção.

## 📦 Instalação

```bash
npm install node-core-sentry

```

_Nota: Requer ferramentas de compilação (Python/C++) instaladas para o `node-gyp`._

## 🚀 Uso Rápido

### Em JavaScript (ESM)

```javascript
import { inspector } from "node-core-sentry";

inspector.start({ threshold: 50 }); // Alerta se o loop travar por > 50ms

inspector.on("block", (data) => {
  console.warn(`[PERF] Bloqueio detectado em: ${data.function}`);
  console.log(`[MEM] Uso de Heap: ${data.memoryUsage}`);
  console.log(`[I/O] Reqs pendentes: ${data.activeRequests}`);
});
```

### Em TypeScript

A lib já inclui definições de tipos nativas.

```typescript
import { inspector, BlockEventData } from "node-core-sentry";

inspector.on("block", (data: BlockEventData) => {
  // Autocomplete total aqui
});
```

## 📊 Gráficos e Diagnóstico

Para rodar o dashboard visual de telemetria incluído no repositório:

1. Clone o projeto.
2. Execute `npm install`.
3. Execute `node telemetry.js`.
4. Abra `http://localhost:3000`.

## 🛠️ Atributos Monitorados

- **Top Function:** Identifica qual função estava sendo executada no momento do lag.
- **Active Requests:** Monitora a fila de I/O da libuv (essencial para detectar gargalos de rede/disco).
- **Heap Pressure:** Porcentagem real de uso da memória antes de um possível `Out of Memory`.

## 📜 Licença

MIT
