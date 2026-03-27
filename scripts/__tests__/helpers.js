// helpers.js — 測試用的 mock fetch 工廠與共用常數

export function mockFetch(status, body, { ok = status >= 200 && status < 300 } = {}) {
  return async () => ({
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

export const BB_OPTS = {
  token: 'bb-test-token',
  owner: 'test-ws',
  repo: 'test-repo',
};

export const GH_OPTS = {
  token: 'gh-test-token',
  owner: 'test-org',
  repo: 'test-repo',
};
