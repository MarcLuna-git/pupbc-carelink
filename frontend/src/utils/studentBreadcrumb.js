import { useEffect, useSyncExternalStore } from 'react';

/*
 * The third breadcrumb level ("Dashboard / Records / Medical Certificates").
 * A page calls useStudentBreadcrumbTab(label) with its open inner tab; the
 * header reads it with useStudentBreadcrumbTabLabel(). It clears itself when
 * the page unmounts, so another page never shows a stale tab.
 */
let currentLabel = '';
const listeners = new Set();

const setLabel = (label) => {
  if (label === currentLabel) return;
  currentLabel = label;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useStudentBreadcrumbTab = (label) => {
  useEffect(() => {
    setLabel(label || '');
    return () => setLabel('');
  }, [label]);
};

export const useStudentBreadcrumbTabLabel = () => useSyncExternalStore(subscribe, () => currentLabel);
