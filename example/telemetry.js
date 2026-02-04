import express from 'express';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { inspector } from '../core-inspector.js';

const app = express();
const server = createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Event Loop Sentry</title>
            <script src="/socket.io/socket.io.js"></script>
            <style>
                body { font-family: sans-serif; background: #121212; color: #fff; padding: 20px; }
                .controls { margin-bottom: 20px; padding: 15px; background: #222; border-radius: 8px; }
                button { padding: 10px; margin-right: 10px; cursor: pointer; border-radius: 4px; border: none; font-weight: bold; }
                .danger { background: #ff5252; color: #fff; }
                .warning { background: #ffd740; color: #000; }
                .log { background: #000; padding: 10px; border-left: 5px solid #ff5252; margin-top: 10px; font-family: monospace; }
            </style>
        </head>
        <body>
            <h1>Event Loop Sentry Debugger</h1>
            <div class="controls">
                <button class="danger" onclick="fetch('/crash/loop')">⚠️ Bloquear CPU (Sync)</button>
                <button class="warning" onclick="fetch('/crash/memory')">💧 Simular Leak (Heap)</button>
                <button class="warning" onclick="fetch('/crash/io')">🌊 Inundar I/O (Requests)</button>
            </div>
            <div id="logs"></div>
            <script>
                const socket = io();
                socket.on('core_alert', (data) => {
                    const div = document.createElement('div');
                    div.className = 'log';
                    div.innerHTML = \`[\${new Date().toLocaleTimeString()}] ALERTA: Loop bloqueado na função <b>\${data.function}</b>.
                                     Memória: \${data.memoryUsage} | Reqs Ativas: \${data.activeRequests}\`;
                    document.getElementById('logs').prepend(div);
                });
            </script>
        </body>
        </html>
    `);
});

app.get('/crash/loop', (req, res) => {
    const end = Date.now() + 200;
    while(Date.now() < end) {}
    res.send('Bloqueio executado');
});

const heapLeak = [];
app.get('/crash/memory', (req, res) => {
    for(let i=0; i<10000; i++) heapLeak.push(new Array(100).fill('leak'));
    res.send('Memória alocada');
});

app.get('/crash/io', (req, res) => {
    for(let i=0; i<300; i++) fs.readdir('.', () => {});
    res.send('300 requisições de I/O disparadas');
});

inspector.start();
inspector.on('block', (data) => {
    io.emit('core_alert', data);
});

server.listen(3000, () => console.log('Dashboard em http://localhost:3000'));
