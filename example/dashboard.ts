import express from "express";
import fs from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import { inspector } from "../core-inspector.js"; // Ajuste o path conforme sua estrutura
import { askOllamaDecision, executeAction } from "../diagnostic-agent.js"; // Importa a lógica da IA
import { InspectorBlockData } from "../index.js";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } }); // Permite CORS para facilitar o desenvolvimento

// Inicia o inspetor imediatamente
inspector.start({
  block: 50, // Threshold para o monitoramento
  heap: 85,
  io: 60,
  criticalFunctions: ["expensiveCalculation"], // Exemplo de função crítica
});

// Evento principal para enviar telemetria e acionar a IA
inspector.on("block", async (data: InspectorBlockData) => {
  io.emit("telemetry", data); // Envia todas as métricas para o dashboard

  // Se o block for significativo, consulta a IA
  if (
    data.blockDuration &&
    data.blockDuration > (inspector as any).thresholds.block
  ) {
    const decision = await askOllamaDecision(data); // Consulta a IA
    if (decision) {
      io.emit("ia_decision", {
        timestamp: new Date().toISOString(),
        ...decision,
      }); // Envia decisão para o dashboard
      executeAction(decision); // Executa a ação sugerida pela IA
    }
  }
});

app.get("/", (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Core Sentry AI Dashboard</title>
            <script src="/socket.io/socket.io.js"></script>
            <style>
                body { font-family: sans-serif; background: #1a1a2e; color: #e0e0e0; margin: 0; padding: 20px; }
                .container { max-width: 1200px; margin: 20px auto; background: #16213e; padding: 25px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                h1, h2 { color: #e94560; border-bottom: 2px solid #0f3460; padding-bottom: 10px; margin-bottom: 20px; }
                .controls button { background: #0f3460; color: #fff; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; transition: background 0.3s ease; margin-right: 10px; }
                .controls button:hover { background: #e94560; }
                .metrics, .ia-decisions, .logs { background: #0f3460; padding: 20px; border-radius: 8px; margin-top: 20px; box-shadow: inset 0 0 5px rgba(0,0,0,0.3); }
                .metric-item, .ia-item, .log-item { background: #1a1a2e; padding: 10px; margin-bottom: 8px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; }
                .metric-value { font-weight: bold; color: #00e676; }
                .ia-action { font-weight: bold; color: #00e676; }
                .ia-reason { font-style: italic; color: #e0e0e0; font-size: 0.9em; }
                .log-item.warn { background: #8a062f; }
                .log-item.info { background: #0f3460; }
                .chart-container { margin-top: 20px; background: #0f3460; padding: 15px; border-radius: 8px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Core Sentry AI Dashboard</h1>

                <div class="controls">
                    <button onclick="fetch('/simulate-lag')">Simular Lag (CPU)</button>
                    <button onclick="fetch('/simulate-heavy-io')">Simular I/O Pesada</button>
                    <button onclick="fetch('/simulate-critical-function')">Simular Função Crítica</button>
                </div>

                <div class="metrics">
                    <h2>Métricas em Tempo Real</h2>
                    <div class="metric-item">Função Ativa: <span id="currentFunction" class="metric-value">N/A</span></div>
                    <div class="metric-item">Duração do Bloco (ms): <span id="blockDuration" class="metric-value">0</span></div>
                    <div class="metric-item">Uso de Heap: <span id="heapUsage" class="metric-value">0%</span></div>
                    <div class="metric-item">Requisições I/O Ativas: <span id="activeRequests" class="metric-value">0</span></div>
                </div>

                <div class="ia-decisions">
                    <h2>Decisões da IA</h2>
                    <div id="iaDecisionLog">
                        <div class="ia-item"><span class="ia-action">Aguardando IA...</span></div>
                    </div>
                </div>

                <div class="logs">
                    <h2>Logs do Agente</h2>
                    <div id="agentLogs">
                        </div>
                </div>
            </div>

            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <script>
                const socket = io();

                const currentFunction = document.getElementById('currentFunction');
                const blockDuration = document.getElementById('blockDuration');
                const heapUsage = document.getElementById('heapUsage');
                const activeRequests = document.getElementById('activeRequests');
                const iaDecisionLog = document.getElementById('iaDecisionLog');
                const agentLogs = document.getElementById('agentLogs');

                function addLog(message, type) {
                    type = type || 'info';
                    var logItem = document.createElement('div');
                    logItem.className = 'log-item ' + type;
                    logItem.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
                    agentLogs.prepend(logItem);
                }

                socket.on('telemetry', (data) => {
                    currentFunction.textContent = data.function || 'Idle';
                    blockDuration.textContent = data.blockDuration || '0';
                    heapUsage.textContent = data.memoryUsage || '0%';
                    activeRequests.textContent = data.activeRequests || '0';
                    addLog('Métricas: Fn: ' + data.function + ', Lag: ' + data.blockDuration + 'ms, Heap: ' + data.memoryUsage, 'info');
                });

                socket.on('ia_decision', (decision) => {
                    const iaItem = document.createElement('div');
                    iaItem.className = 'ia-item warn';
                    iaItem.innerHTML = '<span><strong>' + decision.action + '</strong></span><span>' + decision.reason + '</span>';
                    iaDecisionLog.prepend(iaItem);
                    addLog('IA Decisão: ' + decision.action + ' - ' + decision.reason, 'warn');
                });

                // Para simular as funções críticas
                function expensiveCalculation() {
                    let sum = 0;
                    for(let i=0; i<50000000; i++) sum += i; // Carga de CPU
                    return sum;
                }
            </script>
        </body>
        </html>
    `);
});

// Endpoint para simular CPU-bound task
app.get("/simulate-lag", (req, res) => {
  console.log("Simulando Lag...");
  let sum = 0;
  for (let i = 0; i < 1000000000; i++) sum += i; // Bloqueio pesado
  res.send("Lag simulado!");
});

// Endpoint para simular I/O Pesada
app.get("/simulate-heavy-io", (req, res) => {
  console.log("Simulando I/O Pesada...");
  for (let i = 0; i < 200; i++) {
    fs.readFile("./example/dashboard.ts", () => {}); // Acesso a arquivo
  }
  res.send("I/O simulada!");
});

// Endpoint para simular Função Crítica (reconhecida pela IA)
app.get("/simulate-critical-function", (req, res) => {
  console.log("Simulando Função Crítica...");
  // A função crítica precisa ter o nome exato do criticalFunctions
  const criticalFunctionWrapper = () => {
    let sum = 0;
    for (let i = 0; i < 200000000; i++) sum += i; // Bloqueio
    return sum;
  };
  Object.defineProperty(criticalFunctionWrapper, "name", {
    value: "expensiveCalculation",
  });
  criticalFunctionWrapper();
  res.send("Função crítica simulada!");
});

server.listen(3000, () =>
  console.log("Dashboard acessível em http://localhost:3000"),
);
