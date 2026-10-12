import express, { type Request, type Response } from 'express';
import { runInvestigation } from './investigation.js';
import { getSeedLabels } from './sampleApp.js';

const app = express();
const DIAG_TOKEN = process.env.DIAG_TOKEN ?? 'demo-token';
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

function requireDiagToken(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization ?? '';
  if (authHeader !== `Bearer ${DIAG_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.get('/', (_req: Request, res: Response) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reporting Agent</title>
    <style>
      body { font: 16px/1.5 system-ui, sans-serif; margin: 3rem auto; max-width: 760px; padding: 0 1rem; color: #172033; }
      h1 { margin-bottom: .25rem; }
      p { color: #4b5563; }
      label { display: block; font-weight: 600; margin: 1.5rem 0 .5rem; }
      textarea { box-sizing: border-box; width: 100%; min-height: 9rem; padding: .75rem; font: inherit; }
      button { margin-top: .75rem; padding: .65rem 1rem; font: inherit; cursor: pointer; }
      pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f3f4f6; padding: 1rem; border-radius: .5rem; }
      .links { display: flex; gap: 1rem; }
    </style>
  </head>
  <body>
    <h1>Reporting Agent</h1>
    <p>Describe the problem you encountered to start an investigation.</p>
    <form id="report-form">
      <label for="report">Problem report</label>
      <textarea id="report" name="report" required placeholder="For example: Search returns duplicate items on page 2"></textarea>
      <button type="submit">Investigate report</button>
    </form>
    <pre id="result" aria-live="polite">Investigation results will appear here.</pre>
    <p class="links"><a href="/api/report">Report API</a><a href="/diag/health">Diagnostic health endpoint (token required)</a></p>
    <script>
      const form = document.querySelector('#report-form');
      const result = document.querySelector('#result');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        result.textContent = 'Investigating…';
        try {
          const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: form.elements.report.value })
          });
          const payload = await response.json();
          result.textContent = JSON.stringify(payload, null, 2);
        } catch (error) {
          result.textContent = 'The report could not be submitted. Check the server and try again.';
        }
      });
    </script>
  </body>
</html>`);
});

app.post('/api/report', async (req: Request, res: Response) => {
  const report = req.body ?? {};
  const result = await runInvestigation({
    text: report.text ?? '',
    currentPage: report.currentPage,
    actionAttempted: report.actionAttempted,
    timestamp: report.timestamp,
    userId: report.userId,
    context: report.context
  });
  res.json(result);
});

app.get('/diag/health', requireDiagToken, (_req: Request, res: Response) => {
  res.json({ ok: true, status: 'healthy' });
});

app.get('/diag/session', requireDiagToken, (_req: Request, res: Response) => {
  res.json({ sessionValid: false, reason: 'expired' });
});

app.get('/diag/config', requireDiagToken, (_req: Request, res: Response) => {
  res.json({ paymentEnabled: false, paymentKeyConfigured: false });
});

app.get('/diag/search', requireDiagToken, (_req: Request, res: Response) => {
  const items = ['A', 'B', 'C', 'D', 'E'];
  res.json({ items, page: 2, pageSize: 2, result: ['C', 'D'] });
});

app.get('/diag/labels', requireDiagToken, (_req: Request, res: Response) => {
  res.json(getSeedLabels());
});

app.listen(port, () => {
  console.log(`Report agent sample app listening on http://localhost:${port}`);
});
