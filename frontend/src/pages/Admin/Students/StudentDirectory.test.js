import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('Pagination hides the count only when requested and keeps page controls', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { Pagination } = await server.ssrLoadModule('/src/pages/Admin/Students/StudentDirectory.jsx');
    const props = { meta: { from: 1, to: 4, total: 4, last_page: 1 }, page: 1, onPage: () => {}, loading: false };
    const render = options => renderToStaticMarkup(React.createElement(Pagination, { ...props, ...options }));

    assert.match(render({}), /Showing 1.+4 of 4/);
    const hidden = render({ hideShowingText: true });
    assert.doesNotMatch(hidden, /Showing/);
    assert.match(hidden, /aria-label="Previous page"/);
    assert.match(hidden, /aria-label="Next page"/);
  } finally {
    await server.close();
  }
});
