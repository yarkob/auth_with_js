const http = require('http');
const https = require('https');

const port = 3000;
const host = '127.0.0.1';

class Router {
  routes = {
    'get': {},
    'post': {},
  }

  middlewares = [];

  use(middleware) {
    this.middlewares.push(middleware);
  }

  get(path, ...callbacks) {
    this.routes.get[path] = callbacks;
  }

  post(path, ...callbacks) {
    this.routes.post[path] = callbacks;
  }

  notFound(callback) {
    this.notFoundHandler = callback;
  }

  handle(req, res) {
    const url = req.url;
    const method = req.method.toLowerCase();
    const handlers = this.routes[method][url];

    const allHandlers = [...this.middlewares, ...(handlers || [])];

    if (handlers && handlers.length > 0) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      this.runHandlers(allHandlers, req, res);
    } else if (this.notFoundHandler) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      this.notFoundHandler(req, res);
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end("Path isn't found");
    }
  }

  async runHandlers(allHandlers, req, res) {
    let i = 0;
    let doNext;

    do {
      doNext = false;
      const handler = allHandlers[i];
      if (typeof handler !== 'function') return;
      await new Promise(resolve => {
        handler(req, res, () => {
          doNext = true;
          resolve();
        });
      });
      i++;
    } while(doNext)
  }
}

const router = new Router();

router.get('/', (req, res) => {
  res.end('Public content');
})

router.get('/private', authorizationHandler, (req, res) => {
  res.end('Private content - get');
})

router.post('/private', authorizationHandler,(req, res) => {
  res.end('Private content - post');
})

router.notFound((req, res) => {
  res.end("Pass isn't found - custom");
})

router.get('/set-cookie', (req, res) => {
  res.setHeader('Set-Cookie', [
    'sessionId=secure123; Secure'
  ]);
  res.end('Cookie set!');
});

router.get('/read-cookie', (req, res) => {
  const cookies = req.headers.cookie || 'No cookies';
  console.log('cookie', cookies);

  res.setHeader('Content-Type', 'text/html');

  const html = `
    <html>
      <head>
        <title>Cookies</title>
      </head>
      <body>
        <h1>Cookies from Client</h1>
          ${
            cookies.split(';').map(cookie => {
              const [name, value] = cookie.split('=');
              return `<p>${name.trim()}: ${value}</p>`;
            }).join('')
          }
      </body>
    </html>
  `;

  res.end(html)
});

http.createServer((req, res) => {
  router.handle(req, res);
}).listen(port, host, () => {
  console.log(`Server running http://${host}:${port}`);
})
