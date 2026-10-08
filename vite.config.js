import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

dotenv.config();

// Vite plugin to run Netlify functions locally during `npm run dev`
function netlifyFunctionsLocalDevPlugin() {
  return {
    name: 'netlify-functions-local-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/.netlify/functions/') && !req.url?.startsWith('/api/')) {
          return next();
        }

        const fnName = req.url
          .replace('/.netlify/functions/', '')
          .replace('/api/', '')
          .split('?')[0];

        try {
          let handler;
          if (fnName === 'get-vapid-key') {
            handler = (await import('./netlify/functions/get-vapid-key.js')).default;
          } else if (fnName === 'get-schedule') {
            handler = (await import('./netlify/functions/get-schedule.js')).default;
          } else if (fnName === 'save-schedule') {
            handler = (await import('./netlify/functions/save-schedule.js')).default;
          } else if (fnName === 'send-test') {
            handler = (await import('./netlify/functions/send-test.js')).default;
          } else if (fnName === 'cron-scheduler') {
            handler = (await import('./netlify/functions/cron-scheduler.js')).default;
          } else {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'Function not found' }));
          }

          // Read body if POST/PUT
          let body = null;
          if (req.method === 'POST' || req.method === 'PUT') {
            const chunks = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            body = Buffer.concat(chunks).toString();
          }

          const fullUrl = `http://${req.headers.host}${req.url}`;
          const webReq = new Request(fullUrl, {
            method: req.method,
            headers: req.headers,
            body: body ? body : undefined
          });

          const webRes = await handler(webReq, {});

          res.statusCode = webRes.status;
          webRes.headers.forEach((val, key) => {
            res.setHeader(key, val);
          });

          const resBody = await webRes.text();
          res.end(resBody);
        } catch (err) {
          console.error(`Local function error for ${fnName}:`, err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), netlifyFunctionsLocalDevPlugin()],
  server: {
    port: 5173,
    host: true
  }
});
