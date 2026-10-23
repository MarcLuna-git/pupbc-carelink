import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('directory sections follow Year and changing Year clears Section', async () => {
  const catalog = JSON.parse(readFileSync(new URL('../../../data/registration-academics.json', import.meta.url), 'utf8'));
  const all = [...new Set(catalog.flatMap(course => course.sections))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const secondYear = all.filter(section => section.startsWith('2-'));
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

  try {
    const { emptyFilters, directorySectionsForYear, nextDirectoryFilters } = await server.ssrLoadModule('/src/pages/Admin/Students/directoryOptions.js');
    const { StudentFilters } = await server.ssrLoadModule('/src/pages/Admin/Students/StudentDirectory.jsx');
    assert.deepEqual(directorySectionsForYear(''), all);
    assert.deepEqual(directorySectionsForYear('2nd Year'), secondYear);

    const sectionValues = filters => {
      const html = renderToStaticMarkup(React.createElement(StudentFilters, { filters, onChange: () => {}, onClear: () => {} }));
      const options = html.match(/<select aria-label="Section"[^>]*>(.*?)<\/select>/s)?.[1];
      return [...options.matchAll(/<option value="([^"]*)"/g)].map(match => match[1]).filter(Boolean);
    };
    assert.deepEqual(sectionValues(emptyFilters), all);
    assert.deepEqual(sectionValues({ ...emptyFilters, year: '2nd Year' }), secondYear);

    const selected = { ...emptyFilters, year: '1st Year', section: '1-2' };
    assert.deepEqual(nextDirectoryFilters(selected, 'year', '2nd Year'), { ...selected, year: '2nd Year', section: '' });
    assert.equal(nextDirectoryFilters(selected, 'course', 'BSIT').section, '1-2');
  } finally {
    await server.close();
  }
});
