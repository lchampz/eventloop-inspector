import { EventEmitter } from 'events';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const addon = require(path.resolve(__dirname, 'build/Release/event_loop_inspector.node'));

class CoreInspector extends EventEmitter {
    start() {
        addon.start((data) => {
            const memoryUsagePct = ((Number(data.usedHeap) / Number(data.totalHeap)) * 100).toFixed(2);
            this.emit('block', {
                ...data,
                memoryUsage: memoryUsagePct + '%'
            });
        });
    }
}

export const inspector = new CoreInspector();
