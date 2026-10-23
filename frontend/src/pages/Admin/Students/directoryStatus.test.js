import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('directory status offers Active and Archived with Active as the unfiltered default', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

  try {
    const { directoryStatusOptions, directoryDefaultFilters, appliedDirectoryFilters, emptyFilters } = await server.ssrLoadModule('/src/pages/Admin/Students/directoryOptions.js');
    const { StudentFilters } = await server.ssrLoadModule('/src/pages/Admin/Students/StudentDirectory.jsx');
    assert.deepEqual(directoryStatusOptions, [['active', 'Active'], ['archived', 'Archived']]);
    assert.equal(emptyFilters.status, '');
    assert.equal(directoryDefaultFilters.status, 'active');
    assert.deepEqual(appliedDirectoryFilters(directoryDefaultFilters), []);
    assert.deepEqual(appliedDirectoryFilters({ ...directoryDefaultFilters, status: 'archived' }), [['status', 'archived']]);

    const html = renderToStaticMarkup(React.createElement(StudentFilters, { filters: directoryDefaultFilters, onChange: () => {}, onClear: () => {} }));
    const status = html.match(/<select aria-label="Status"[^>]*>(.*?)<\/select>/s)?.[1];
    assert.deepEqual([...status.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(([, value, label]) => [value, label]), directoryStatusOptions);
    assert.match(status, /<option value="active"[^>]*selected[^>]*>Active<\/option>/);
    assert.doesNotMatch(status, /All Status|Inactive|value=""/);
    assert.doesNotMatch(html, /Clear filters|Remove status filter/);

    const clinic = renderToStaticMarkup(React.createElement(StudentFilters, {
      filters: { search: '', type: '' }, onChange: () => {}, onClear: () => {},
      filterDefinitions: [['type', 'Record type', 'All record types', [['consultation', 'Consultations']]]],
    }));
    assert.match(clinic, /<option value=""[^>]*>All record types<\/option>/);
  } finally {
    await server.close();
  }
});
