// helpers.js — 測試用的 mock fetch 工廠

export function mockFetch(status, body, { ok = status >= 200 && status < 300 } = {}) {
  return async () => ({
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

export const BASE_OPTS = {
  token: 'test-token',
  workspace: 'test-ws',
  repo: 'test-repo',
};
