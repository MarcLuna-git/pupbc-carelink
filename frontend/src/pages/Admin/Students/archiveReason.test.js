import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('blank archive reasons show one field error and valid reasons pass', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

  try {
    const { ArchiveStudentModal } = await server.ssrLoadModule('/src/pages/Admin/Students/StudentDetailsModal.jsx');
    assert.equal(typeof ArchiveStudentModal, 'function');
    const { archiveReasonError } = await server.ssrLoadModule('/src/pages/Admin/Students/archiveReason.js');
    assert.equal(archiveReasonError(''), 'Reason is required.');
    assert.equal(archiveReasonError('  \t  '), 'Reason is required.');
    assert.equal(archiveReasonError('  No longer enrolled  '), '');

    const html = renderToStaticMarkup(React.createElement(ArchiveStudentModal, {
      reason: '', reasonError: 'Reason is required.', onReasonChange: () => {},
      onSubmit: () => {}, onClose: () => {}, saving: false,
    }));
    assert.match(html, /<textarea[^>]*aria-invalid="true"/);
    assert.match(html, /<textarea[^>]*aria-describedby="archive-reason-error"/);
    assert.match(html, /<p id="archive-reason-error" role="alert"[^>]*>Reason is required\.<\/p>/);
    assert.equal(html.match(/Reason is required\./g)?.length, 1);
    assert.ok(html.indexOf('Reason is required.') > html.indexOf('</textarea>'));
  } finally {
    await server.close();
  }
});
