const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = 4174;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

http.createServer((request, response) => {
  const requestedPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
  const filePath = path.resolve(root, relativePath);

  if(filePath !== root && !filePath.startsWith(`${root}${path.sep}`)){
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if(statError || !stats.isFile()){
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    });
    fs.createReadStream(filePath).pipe(response);
  });
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Visual test server listening on http://127.0.0.1:${port}\n`);
});
