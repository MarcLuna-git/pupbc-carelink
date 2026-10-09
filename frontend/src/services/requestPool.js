const cancelled = () => Object.assign(new Error('Request cancelled'), { name: 'CanceledError', code: 'ERR_CANCELED', __CANCEL__: true });

// In-flight reads only: no settled clinical responses are cached or persisted.
// Each subscriber owns its cancellation; one unmount cannot cancel another consumer.
export function createRequestPool(transport, identity, keyFor) {
  const pending = new Map();
  return {
    invalidate() { pending.clear(); },
    get(url, config = {}) {
      if (config.signal?.aborted) return Promise.reject(cancelled());
      const account = identity();
      const key = JSON.stringify([account, keyFor(url, config)]);
      let entry = pending.get(key);
      if (!entry || entry.controller.signal.aborted) {
        const controller = new AbortController();
        entry = { controller, consumers: 0 };
        entry.promise = Promise.resolve().then(() => transport(url, { ...config, signal: controller.signal }))
          .then(response => {
            if (identity() !== account) throw cancelled();
            return response;
          });
        pending.set(key, entry);
        const clean = () => { if (pending.get(key) === entry) pending.delete(key); };
        entry.promise.then(clean, clean);
      }
      entry.consumers++;
      return new Promise((resolve, reject) => {
        let finished = false;
        const finish = (error, value) => {
          if (finished) return;
          finished = true;
          config.signal?.removeEventListener('abort', abort);
          if (--entry.consumers === 0) entry.controller.abort();
          if (error) reject(error); else resolve(value);
        };
        const abort = () => finish(cancelled());
        config.signal?.addEventListener('abort', abort, { once: true });
        entry.promise.then(value => finish(null, value), error => finish(error));
      });
    },
  };
}
