import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const port = Number(process.env.PORT || 5173);
const host = '127.0.0.1';
const hosting = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8')).hosting;
const sharedHeaders = Object.fromEntries(hosting.headers.find((rule) => rule.source === '**').headers.map(({ key, value }) => [key, value]));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (request, response) => {
  for (const [key, value] of Object.entries(sharedHeaders)) response.setHeader(key, value);
  response.setHeader('Cache-Control', 'no-cache');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
    const filePath = resolve(publicRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filePath.startsWith(`${resolve(publicRoot)}${sep}`) || pathname.split('/').some((part) => part.startsWith('.'))) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    if (!(await stat(filePath)).isFile()) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
    const content = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      'Content-Length': content.length,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    const statusCode = error instanceof URIError ? 400 : error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500;
    response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(statusCode === 404 ? 'Страница не найдена' : 'Не удалось обработать запрос');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Порт ${port} занят. Запустите с другим PORT, например: PORT=5174 npm start` : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`Форма обратной связи: http://${host}:${port}`));
