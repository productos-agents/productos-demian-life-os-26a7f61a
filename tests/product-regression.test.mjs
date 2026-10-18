import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareTasks } from '../lib/task-planning.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const task = (id, dueDate, category = 'Normal', createdAt = '2026-10-01T10:00:00Z') => ({ id, dueDate, category, createdAt });

test('task planning puts due dates first, then high priority, then undated tasks', () => {
  const tasks = [
    task('undated', '', 'Alta'),
    task('normal-today', '2026-10-19', 'Normal'),
    task('high-today', '2026-10-19', 'Alta'),
    task('earlier', '2026-10-18', 'Baja')
  ].sort(compareTasks);
  assert.deepEqual(tasks.map(t => t.id), ['earlier', 'high-today', 'normal-today', 'undated']);
});

test('reminders must honor the user opt-in preference', async () => {
  const page = await read('../app/page.tsx');
  assert.match(page, /if\(!reminders\|\|connection!=="connected"/);
});

test('task edits are scoped to the authenticated owner in SQL', async () => {
  const route = await read('../app/api/data/route.ts');
  assert.match(route, /WHERE id=\$5 AND user_id=\$6 AND kind='task'/);
  assert.match(route, /typeof b\.title === "string"/);
});

test('global search queries full personal and FLUX history server-side with owner filters', async () => {
  const page = await read('../app/page.tsx');
  const route = await read('../app/api/search/route.ts');
  assert.match(page, /fetch\("\/api\/search\?q="\+encodeURIComponent\(term\)/);
  assert.match(page, /openGlobalSearchResult/);
  assert.match(route, /FROM public\.demian_items/);
  assert.match(route, /WHERE user_id=\$1 AND \(title ILIKE/);
  assert.match(route, /FROM public\.flux_transactions t/);
  assert.match(route, /WHERE t\.user_id=\$1 AND \(t\.description ILIKE/);
  assert.match(route, /LIMIT 8/);
});

test('both official in-app signatures use the shared dynamic version', async () => {
  const home = await read('../app/page.tsx');
  const login = await read('../app/login/page.tsx');
  const version = await read('../lib/app-version.ts');
  assert.match(home, /DEMIAN CORE \{APP_VERSION\} · DESARROLLADO POR J D O SERVICES/);
  assert.match(login, /DEMIAN CORE \{APP_VERSION\} · DESARROLLADO POR J D O SERVICES/);
  assert.match(version, /packageMetadata\.version/);
  assert.doesNotMatch(home, /V0\.1/);
});

test('the app layout does not load the ProductOS badge script', async () => {
  const layout = await read('../app/layout.tsx');
  assert.doesNotMatch(layout, /productos-badge\.js/);
});

test('finance history is paginated and ownership-scoped', async () => {
  const route = await read('../app/api/finance/route.ts');
  assert.match(route, /LIMIT \$2 OFFSET \$3/);
  assert.match(route, /transactionsHasMore: offset \+ transactions\.rows\.length < total/);
  assert.match(route, /transactionMonth = params\.get\("transactionMonth"\)/);
  assert.match(route, /WHERE user_id=\$1 AND \(\$2::text IS NULL/);
});

test('finance dashboard totals, six-month trend and budgets aggregate on the server', async () => {
  const route = await read('../app/api/finance/route.ts');
  assert.match(route, /SUM\(amount\) FILTER \(WHERE type='income' AND transfer_group IS NULL\)/);
  assert.match(route, /SUM\(amount\) FILTER \(WHERE type='expense' AND transfer_group IS NULL\)/);
  assert.match(route, /monthlySeries/);
  assert.match(route, /reportExpenseByCategory/);
  assert.match(route, /const budgetUsage = Object\.fromEntries\(budgetUsageEntries\)/);
});

test('financial monthly reports fetch rows for the selected month rather than only current-page rows', async () => {
  const module = await read('../app/components/FinanceModule.tsx');
  assert.match(module, /transactionMonth=/);
  assert.match(module, /reportTransactions/);
  assert.match(module, /Cargar más del periodo/);
  assert.match(module, /data\.summary\.reportIncome/);
});
