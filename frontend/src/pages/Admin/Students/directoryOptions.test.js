import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('student directory options follow the registration catalog without changing legacy exports', async () => {
  const catalog = JSON.parse(readFileSync(new URL('../../../data/registration-academics.json', import.meta.url), 'utf8'));
  const expectedCourses = catalog.map(({ code, name }) => [code, name]);
  const expectedSections = [...new Set(catalog.flatMap(({ sections }) => sections))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

  try {
    const { directoryCourses, directorySections, courses, sections, emptyFilters } = await server.ssrLoadModule('/src/pages/Admin/Students/directoryOptions.js');
    const { StudentFilters } = await server.ssrLoadModule('/src/pages/Admin/Students/StudentDirectory.jsx');
    assert.deepEqual(directoryCourses, expectedCourses);
    assert.deepEqual(directorySections, expectedSections);
    assert.equal(courses.find(([code]) => code === 'BSCS')?.[1], 'Computer Science');
    assert.ok(sections.includes('1-5'));

    const html = renderToStaticMarkup(React.createElement(StudentFilters, { filters: emptyFilters, onChange: () => {}, onClear: () => {} }));
    const values = label => [...html.match(new RegExp(`<select aria-label="${label}"[^>]*>(.*?)</select>`, 's'))[1].matchAll(/<option value="([^"]*)"/g)].map(match => match[1]).filter(Boolean);
    // The Course filter lists codes A–Z (Course Management entries merged with this catalog).
    assert.deepEqual(values('Course'), catalog.map(({ code }) => code).sort((a, b) => a.localeCompare(b)));
    assert.deepEqual(values('Section'), expectedSections);
  } finally {
    await server.close();
  }
});
