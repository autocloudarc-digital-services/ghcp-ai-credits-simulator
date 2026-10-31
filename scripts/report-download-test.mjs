import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../client/src/components/report/ReportDownloadButton.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const reportId = '12345678-1234-4234-8234-123456789abc';
const report = { id: reportId, filename: '<img src=x onerror=alert(1)>.pdf', created_at: '2026-01-01T00:00:00Z' };

function harness(history = [report]) {
  const states = [];
  const encodedIds = [];
  let cursor = 0;
  let effect;
  const exports = {};
  runInNewContext(compiled, {
    exports,
    encodeURIComponent(id) {
      encodedIds.push(id);
      return encodeURIComponent(id);
    },
    require(name) {
      if (name === 'react') return {
        useState(initial) {
          const index = cursor++;
          if (!(index in states)) states[index] = initial;
          return [states[index], value => { states[index] = value; }];
        },
        useEffect(callback) { effect = callback; },
      };
      if (name === 'axios') return { default: { get: async () => ({ data: history }) } };
      if (name === '../../store/appStore') return { useAppStore: () => ({ isConnected: true }) };
      if (name === 'lucide-react') return { Download: () => null, Loader2: () => null };
      return require(name);
    },
  });
  const render = () => {
    cursor = 0;
    return exports.default({ simulatorConfig: {}, assessmentResult: null, recommendations: [] });
  };
  const find = (element, type) => {
    if (!element || typeof element !== 'object') return undefined;
    if (element.type === type) return element;
    return [element.props?.children].flat(Infinity).map(child => find(child, type)).find(Boolean);
  };
  return {
    async load() {
      render();
      effect();
      await new Promise(resolve => setImmediate(resolve));
    },
    select(id) { find(render(), 'select').props.onChange({ target: { value: id } }); },
    selected() { return find(render(), 'select').props.value; },
    link() { return find(render(), 'a'); },
    encodedIds,
    markup() { return renderToStaticMarkup(render()); },
    replaceHistory(value) { states[2] = value; },
  };
}

test('loaded UUIDs remain selectable and use an encoded single-segment download URL', async () => {
  for (const id of [reportId, reportId.toUpperCase()]) {
    const component = harness([{ ...report, id }]);
    await component.load();
    assert.equal(component.link(), undefined);
    component.select(id);
    assert.equal(component.selected(), id);
    assert.equal(component.link().props.href, `/api/report/download/${encodeURIComponent(id)}`);
    assert.ok(component.encodedIds.length > 0);
    assert.ok(component.encodedIds.every(value => value === id));
    assert.doesNotMatch(component.markup(), /Invalid saved report selection/);
    component.select('');
    assert.equal(component.selected(), '');
    assert.equal(component.link(), undefined);
    assert.doesNotMatch(component.markup(), /Invalid saved report selection/);
  }
});

test('malformed and unexpected selections clear an existing selection and show an error', async () => {
  for (const id of [
    '87654321-1234-4234-8234-123456789abc',
    'javascript:alert(1)', '../report', `${reportId}/extra`, `${reportId}?download=1`,
    `${reportId}#fragment`, `${reportId}\n`, ` ${reportId}`, 'not-a-uuid', '<script>alert(1)</script>',
  ]) {
    const component = harness([report, { ...report, id }]);
    await component.load();
    component.select(reportId);
    // A well-formed but unlisted UUID must also be rejected.
    if (id === '87654321-1234-4234-8234-123456789abc') component.replaceHistory([report]);
    component.select(id);
    component.encodedIds.length = 0;
    assert.equal(component.selected(), '');
    assert.equal(component.link(), undefined);
    assert.deepEqual(component.encodedIds, []);
    assert.match(component.markup(), /Invalid saved report selection/);
    component.select('');
    assert.doesNotMatch(component.markup(), /Invalid saved report selection/);
    component.select(reportId);
    assert.ok(component.link());
  }
});

test('removed reports cannot retain a download link and HTML-like filenames remain text', async () => {
  const component = harness();
  await component.load();
  component.select(reportId);
  assert.match(component.markup(), /&lt;img src=x onerror=alert\(1\)&gt;\.pdf/);
  assert.doesNotMatch(component.markup(), /<img|<script/);
  component.replaceHistory([{ ...report, id: '87654321-1234-4234-8234-123456789abc' }]);
  assert.equal(component.selected(), '');
  assert.equal(component.link(), undefined);
});
