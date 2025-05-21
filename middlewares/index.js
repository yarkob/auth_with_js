const requestLoggerHandler = (req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`Request ${req.method} ${req.url} completed in ${duration}ms`);
  });
  next();
};

const rateLimits = {};
const rateLimitHandler = (req, res, next) => {
  const ip = req.socket.remoteAddress;
  if (!rateLimits[ip]) {
    rateLimits[ip] = 1;
  } else {
    rateLimits[ip]++;
  }

  console.log('rateLimits[ip]', rateLimits[ip]);

  if (rateLimits[ip] > 10) {
    res.statusCode = 429;
    res.end('Too Many Requests');
    return;
  }
  next();
};

const authorizationHandler = (req, res, next) => {
  if (!req.headers.authorization) {
    res.statusCode = 401;
    res.end('Unauthorized');
    return;
  }
  next();
}

const asyncMiddleware = (req, res, next) => {
  setTimeout(() => {
    console.log('Async middleware executed');
    next();
  }, 1000);
}

module.exports = {
  requestLoggerHandler,
  rateLimitHandler,
  authorizationHandler,
  asyncMiddleware,
}
