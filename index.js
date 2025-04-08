const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const superagent = require('superagent');

// Налаштування параметрів командного рядка
program
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <cacheDir>', 'шлях до кешу');

program.parse(process.argv);
const { host, port, cache: cacheDir } = program.opts();

// Функція для обробки запитів
const server = http.createServer(async (req, res) => {
  const method = req.method;
  const code = req.url.slice(1);
  const filePath = path.join(cacheDir, `${code}.jpg`);

  if (!/^\d+$/.test(code)) {
    res.writeHead(400);
    return res.end('Invalid status code');
  }

  try {
    if (method === 'GET') {
      // Перевіряємо кеш
      try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        return res.end(data);
      } catch {
        // Якщо нема — тягнемо з http.cat
        try {
          const response = await superagent.get(`https://http.cat/${code}`);
          await fs.writeFile(filePath, response.body);
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          return res.end(response.body);
        } catch {
          res.writeHead(404);
          return res.end('Not Found');
        }
      }
    }

    if (method === 'PUT') {
      let chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        await fs.writeFile(filePath, buffer);
        res.writeHead(201);
        res.end('Created');
      });
      return;
    }

    if (method === 'DELETE') {
      try {
        await fs.unlink(filePath);
        res.writeHead(200);
        return res.end('Deleted');
      } catch {
        res.writeHead(404);
        return res.end('Not Found');
      }
    }

    // Якщо метод не підтримується
    res.writeHead(405);
    return res.end('Method Not Allowed');

  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

// Старт сервера
server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
