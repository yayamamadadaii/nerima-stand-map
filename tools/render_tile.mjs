// tools/render_base.html を開いて画面を撮る（AI に渡す元の地図画像）。四隅の位置（ページのタイトル）を表示する
// usage: node render_tile.mjs <url> <out.png> 768 1024   （Chrome が要る。読み込み待ちは WAIT ミリ秒、既定7000）
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [url, out, w, h] = process.argv.slice(2); const port = 9400 + Math.floor(Math.random() * 90);
const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/claude-501/rnd-' + port, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let t;
for (let i = 0; i < 50; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const p = new Map(); ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && p.has(d.id)) { p.get(d.id)(d); p.delete(d.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1.5, mobile: false });
await send('Page.navigate', { url }); await sleep(+(process.env.WAIT||7000));
const title = (await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true })).result.result.value;
console.log(title);
const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(out, Buffer.from(s.result.data, 'base64')); ch.kill(); process.exit(0);
