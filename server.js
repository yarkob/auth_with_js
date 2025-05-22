const http = require('http');
const https = require('https');
const bcrypt = require('bcrypt');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const SECRET = 'superSecretKey';

const refreshTokens = new Set();
const accessRevokedTokens = new Set();

const privateKey = fs.readFileSync('./private.key', 'utf8');
const publicKey = fs.readFileSync('./public.key', 'utf8');

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
    const url = new URL(req.url, `http://${req.headers.host}`);
    req.query = Object.fromEntries(url.searchParams.entries());
    const method = req.method.toLowerCase();
    const path = url.pathname;
    const handlers = this.routes[method][path];

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

// router.get('/private', authorizationHandler, (req, res) => {
//   res.end('Private content - get');
// })
//
// router.post('/private', authorizationHandler,(req, res) => {
//   res.end('Private content - post');
// })

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

// const sessionTimeout = 1 * 60 * 1000;
//
// setInterval(() => {
//   const now = Date.now();
//   for (const sessionId in sessions) {
//     console.log("🔹 Check Session's expire time:", sessionId, now - sessions[sessionId], sessionTimeout);
//     if (now - sessions[sessionId].createdAt > sessionTimeout) {
//       delete sessions[sessionId];
//     }
//   }
// }, 10 * 1000)

const sessions = {};

router.get('/create-session', (req, res) => {
  const name = req.query?.name || 'Anonymous';
  const email = req.query?.email || 'Anonymous';
  const password = req.query?.password || 'Anonymous';
  // const sessionId = Math.random().toString(36).substring(2);
  const cookies = req.headers.cookie || '';
  console.log('🔹 Received Cookies:', cookies);
  const oldCookies = cookies.split('; ').find(cookie => cookie.startsWith('sessionId='))?.split('=')[1];
  const sessionId = oldCookies ?? Math.random().toString(36).substring(2);
  sessions[sessionId] = oldCookies ? { ...sessions[sessionId], createdAt: new Date() } : { theme: 'light', username: name, createdAt: new Date(), email, password };

  console.log('🔹 New session created:', sessions);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Set-Cookie', `sessionId=${sessionId}; HttpOnly; Secure; SameSite=Strict`);
  res.end(`✅ Session created! ID: ${sessionId}`);
});

router.get('/destroy-session', (req, res) => {
  const cookies = req.headers.cookie || '';
  const sessionId = cookies.split('; ').find(cookie => cookie.startsWith('sessionId='))?.split('=')[1];

  console.log('🔹 Received sessionId:', sessionId);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!sessionId || !sessions[sessionId]) {
    return res.end('⚠️ No session found!')
  }

  if (sessionId) {
    delete sessions[sessionId];
  }

  console.log('🔹 All sessions:', sessions);

  res.setHeader('Set-Cookie', `sessionId=; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  res.end(`✅ Session destroyed! ID: ${sessionId}`);
});

router.get('/set-theme', (req, res) => {
  const cookies = req.headers.cookie || '';
  const sessionId = cookies.split('; ').find(cookie => cookie.startsWith('sessionId='))?.split('=')[1];

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!sessionId || !sessions[sessionId]) {
    return '⚠️ No session found!';
  }

  sessions[sessionId].theme = sessions[sessionId].theme === 'light' ? 'dark' : 'light';
  const session = sessionId && sessions[sessionId];
  res.end(`
    <html>
      <head>
        <title>Session</title>  
        <style>
          body {
            background-color: ${session?.theme === 'dark' ? '#333' : '#ccc'};
            color: ${session?.theme === 'dark' ? '#ccc' : '#333'};
          }
        </style>
      </head>
      <body>
        <p>🎨 Theme was changed to ${sessions[sessionId].theme}</p>
      </body>
    </html>
  `);
});

const regenerateSession = (oldSessionId) => {
  const newSessionId = Math.random().toString(36).substring(2);
  sessions[newSessionId] = { ...sessions[oldSessionId] };
  delete sessions[oldSessionId];
  return newSessionId;
};

const users = {};

function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });

    req.on('error', reject);
  });
}

router.post('/signup', async (req, res) => {
  const body = await parseJSON(req);
  const { email, password } = body;

  if (users[email]) {
    res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
    return res.end('This user is already registered');
  }

  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);

  users[email] = { hash, salt };
  console.log('🔹 New user registered:', users[email]);
  console.log('🔹 All users:', users);

  const accessToken = jwt.sign({ email }, privateKey, { algorithm: 'RS256', expiresIn: '15m' });
  const refreshToken = jwt.sign({ email }, privateKey, { algorithm: 'RS256', expiresIn: '7d' });

  refreshTokens.add(refreshToken);

  res.setHeader('Set-Cookie', [
    `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/refresh`,
    `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/logout`
  ]);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ accessToken }));
});

router.post('/signin', async (req, res) => {
  const body = await parseJSON(req);
  const { email, password } = body;

  if (!users[email]) {
    res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
    return res.end('Current user is not registered');
  }

  const isValid = await bcrypt.compare(password, users[email].hash);
  if (!isValid) {
    console.log('🔹 Wrong password or email');
    res.writeHead(401, {'Content-Type': 'text/html; charset=utf-8'});
    return res.end('Wrong password or email');
  }

  const accessToken = jwt.sign({ email }, privateKey, { algorithm: 'RS256', expiresIn: '15m' });
  const refreshToken = jwt.sign({ email }, privateKey, { algorithm: 'RS256', expiresIn: '7d' });

  refreshTokens.add(refreshToken);

  res.setHeader('Set-Cookie', [
    `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/refresh`,
    `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/logout`
  ]);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ accessToken }));
});

const authenticateToken = async (req, res, next) => {
  const body = await parseJSON(req);
  const accessToken = body.accessToken;

  if (!accessToken) {
    res.writeHead(401, {'Content-Type': 'text/plain'});
    return res.end('Access denied');
  }

  if (accessRevokedTokens.has(accessToken)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Token revoked');
  }

  jwt.verify(accessToken, publicKey, { algorithms: ['RS256'] }, (err, user) => {
    if (err) {
      res.writeHead(403, {'Content-Type': 'text/plain'});
      return res.end('Invalid token');
    }
    req.user = user;
    next();
  });
}

router.get('/profile', authenticateToken, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Protected route', user: req.user }));
});

router.post('/refresh', async (req, res) => {
  const body = await parseJSON(req);
  const { email } = body;

  const cookies = req.headers.cookie || '';
  const oldToken = cookies.split('; ').find(cookie => cookie.startsWith('refreshToken='))?.split('=')[1];
  console.log('🔹 Received refreshToken:', oldToken, cookies);

  if (!oldToken) {
    res.writeHead(401, {'Content-Type': 'text/plain'});
    return res.end('Access denied');
  }

  if (!refreshTokens.has(oldToken)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Token revoked');
  }

  refreshTokens.delete(oldToken);
  const accessToken = jwt.sign({ email }, privateKey, { algorithm: 'RS256', expiresIn: '15m' });
  const newToken = jwt.sign({ email }, privateKey, { algorithm: 'RS256', expiresIn: '7d' });

  refreshTokens.add(newToken);

  res.setHeader('Set-Cookie', [
    `refreshToken=${newToken}; HttpOnly; Secure; SameSite=Strict; Path=/refresh`,
    `refreshToken=${newToken}; HttpOnly; Secure; SameSite=Strict; Path=/logout`
  ]);
  res.writeHead(200, { 'Content-Type': 'application/json' });

  res.end(JSON.stringify({ accessToken }));
});

router.post('/logout', async (req, res) => {
  const body = await parseJSON(req);
  const accessToken = body.accessToken;

  const cookies = req.headers.cookie || '';
  const oldRefreshToken = cookies.split('; ').find(cookie => cookie.startsWith('refreshToken='))?.split('=')[1];

  accessRevokedTokens.add(accessToken);
  refreshTokens.delete(oldRefreshToken);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('Logout!');
})

router.get('/read-session', (req, res) => {
  const cookies = req.headers.cookie || '';
  const sessionId = cookies.split('; ').find(cookie => cookie.startsWith('sessionId='))?.split('=')[1];

  console.log('🔹 Received sessionId:', sessionId);
  console.log('🔹 All sessions:', sessions);

  const session = sessionId && sessions[sessionId];

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  res.end(`
    <html>
      <head>
        <title>Session</title>  
        <style>
          body {
            background-color: ${session?.theme === 'dark' ? '#333' : '#ccc'};
            color: ${session?.theme === 'dark' ? '#ccc' : '#333'};
          }
        </style>
      </head>
      <body>
        <h1>Session from Client</h1>
        ${session ? `
          <p>🎨 Theme: ${session.theme}</p>
          <p><a href="/set-theme">🔄 Change theme</a></p>
        ` : `<p>⚠️ No session found</p>`}
      </body>
    </html>
  `)
});

http.createServer((req, res) => {
  router.handle(req, res);
}).listen(port, host, () => {
  console.log(`Server running http://${host}:${port}`);
})
