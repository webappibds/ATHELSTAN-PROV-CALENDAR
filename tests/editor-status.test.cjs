const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CourtCalendars = require('../calendar-subscriptions.js');
const html = fs.readFileSync(__dirname + '/../editor.html', 'utf8');
const code = html.match(/function createPublisher[\s\S]*?(?=\nconst list = )/)[0];
const programme = JSON.parse(fs.readFileSync(__dirname + '/../calendar-data.js', 'utf8').replace(/^window.PROVINCE_SCHEDULE\s*=\s*/, '').replace(/;\s*$/, ''));
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(options = {}) {
  const values = new Map(Object.entries(options.session || {}));
  const sessionStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const ui = Object.fromEntries(['publish','signin','repository','deployment','check','resultLink','repositoryLink','signout','connection','tokenInput','connect','form','cancel'].map(key => [key, { dataset: {}, textContent: '', value: '', disabled: false, hidden: true, focus() {} }]));
  let dateNow = Date.parse('2026-09-13T16:00:00Z'), timerId = 0;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [dateNow])); } static now() { return dateNow; } }
  const timers = new Map(), requests = [], drafts = [], navigations = [], uploaded = [];
  const repositoryFeeds = new Map(Object.entries(options.repositoryFeeds || {}));
  let liveFeedsReady = options.liveFeedsReady !== false;
  let liveProgramme = options.live || [['January 2020','Old Court','Old City','2020-01-01','Meeting']];
  const location = { hash: options.hash || '', pathname: '/ATHELSTAN-PROV-CALENDAR/editor.html', search: '', assign: url => navigations.push(url) };
  const json = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value, text: async () => JSON.stringify(value) });
  const fetch = async (url, settings) => {
    requests.push({ url, method: settings.method || 'GET', body: settings.body, authenticated: !!settings.headers?.Authorization });
    if (url === 'https://api.github.com/user') {
      if (options.authOffline) throw new TypeError('Offline');
      return json({ login: 'test-editor' }, options.authStatus || 200);
    }
    if (url.startsWith('https://api.github.com/repos/webappibds/ATHELSTAN-PROV-CALENDAR/contents/calendar-data.js')) {
      if (settings.method !== 'PUT') return json({ sha: 'current-file-sha', encoding: 'base64', content: Buffer.from('window.PROVINCE_SCHEDULE=' + JSON.stringify(options.previous || programme) + ';').toString('base64') }, options.readStatus || 200);
      if (options.publishDeferred) return options.publishDeferred;
      if (options.publishOffline) throw new TypeError('Offline');
      return json(options.ok === false ? {} : { commit: { sha: 'new-commit-sha' } }, options.publishStatus || 200);
    }
    if (url.startsWith('https://api.github.com/repos/webappibds/ATHELSTAN-PROV-CALENDAR/contents/assets/uploads/')) {
      const path = new URL(url).pathname.split('/contents/')[1];
      if (settings.method !== 'PUT') return repositoryFeeds.has(path) ? json({ sha: 'image-sha' }) : json({}, 404);
      repositoryFeeds.set(path, JSON.parse(settings.body).content);
      return json({ commit: { sha: 'image-commit-sha' } });
    }
    if (url.startsWith('https://webappibds.github.io/ATHELSTAN-PROV-CALENDAR/assets/uploads/')) {
      const path = new URL(url).pathname.replace('/ATHELSTAN-PROV-CALENDAR/', '');
      return { ok: liveFeedsReady && repositoryFeeds.has(path), status: liveFeedsReady && repositoryFeeds.has(path) ? 200 : 404, text: async () => '' };
    }
    if (url.startsWith('https://api.github.com/repos/webappibds/ATHELSTAN-PROV-CALENDAR/contents/calendar-content.js')) {
      if (settings.method !== 'PUT') return repositoryFeeds.has('calendar-content.js') ? json({ sha: 'content-sha', encoding: 'base64', content: Buffer.from(repositoryFeeds.get('calendar-content.js')).toString('base64') }) : json({}, 404);
      repositoryFeeds.set('calendar-content.js', Buffer.from(JSON.parse(settings.body).content, 'base64').toString('utf8'));
      return json({ commit: { sha: 'content-commit-sha' } });
    }
    if (url.startsWith('https://webappibds.github.io/ATHELSTAN-PROV-CALENDAR/calendar-content.js')) {
      return { ok: true, status: 200, text: async () => liveFeedsReady ? repositoryFeeds.get('calendar-content.js') || '' : 'old content' };
    }
    if (url.startsWith('https://api.github.com/repos/webappibds/ATHELSTAN-PROV-CALENDAR/contents/calendars/')) {
      const path = new URL(url).pathname.split('/contents/')[1];
      if (settings.method !== 'PUT') {
        return repositoryFeeds.has(path) ? json({ sha: 'existing-feed-sha', encoding: 'base64', content: Buffer.from(repositoryFeeds.get(path)).toString('base64') }) : json({}, 404);
      }
      if (options.feedPublishStatus) return json({}, options.feedPublishStatus);
      repositoryFeeds.set(path, Buffer.from(JSON.parse(settings.body).content, 'base64').toString('utf8'));
      return json({ commit: { sha: 'feed-commit-sha' } });
    }
    if (url.startsWith('https://webappibds.github.io/ATHELSTAN-PROV-CALENDAR/calendars/')) {
      assert.equal(!!settings.headers?.Authorization, false);
      const path = new URL(url).pathname.replace('/ATHELSTAN-PROV-CALENDAR/', '');
      return { ok: true, status: 200, text: async () => liveFeedsReady ? repositoryFeeds.get(path) || '' : 'old subscription' };
    }
    assert.ok(url.startsWith('https://webappibds.github.io/ATHELSTAN-PROV-CALENDAR/calendar-data.js?'), 'all requests must go directly to GitHub');
    assert.equal(!!settings.headers?.Authorization, false, 'never send the token with public-page checks');
    if (options.liveOffline) throw new TypeError('Offline');
    return { ok: true, status: 200, text: async () => 'window.PROVINCE_SCHEDULE=' + JSON.stringify(liveProgramme) + ';' };
  };
  const sandbox = vm.createContext({ fetch, AbortController, sessionStorage, URL, URLSearchParams, TextEncoder, TextDecoder, btoa, atob, Uint8Array, CourtCalendars, Date: Clock, location,
    history: { replaceState: (_a, _b, url) => { location.hash = ''; navigations.push(url); } },
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id) });
  vm.runInContext(code, sandbox);
  const controller = sandbox.createPublisher({ ui, getSchedule: () => JSON.parse(JSON.stringify(options.draft || programme)), getContent: options.content && (() => options.content), getUploads: options.uploads && (() => options.uploads), onUploaded: list => uploaded.push(...list), saveDraft: data => { drafts.push(data); return options.storageOK !== false; } });
  return { controller, ui, values, requests, drafts, navigations, location, timers, uploaded,
    connect: async value => { ui.tokenInput.value = value; await ui.form.onsubmit({ preventDefault() {} }); },
    setLive: value => { liveProgramme = value; },
    setLiveFeedsReady: value => { liveFeedsReady = value; }, repositoryFeeds,
    tick: async (elapsed = 10000) => { dateNow += elapsed; const entry = [...timers].find(([, timer]) => timer.delay === 10000); if (entry) { timers.delete(entry[0]); await entry[1].fn(); } await flush(); } };
}
test('Connect GitHub opens the connection panel without an external sign-in redirect', async () => {
  const s = setup(); await s.controller.init(); await s.ui.publish.onclick();
  assert.equal(s.ui.connection.hidden, false);
  assert.equal(s.navigations.length, 0);
  assert.equal(s.requests.length, 0);
  assert.equal(s.ui.publish.textContent, 'Connect GitHub');
});
test('token connection verifies identity, clears the field, and can be disconnected', async () => {
  const s = setup(); await s.controller.init(); await s.connect('test-only-token');
  assert.equal(s.ui.signin.dataset.state, 'success');
  assert.match(s.ui.signin.textContent, /GitHub connected — test-editor/);
  assert.equal(s.ui.tokenInput.value, '');
  assert.equal(s.values.get('provinceGithubToken'), 'test-only-token');
  assert.equal(s.ui.connection.hidden, true);
  assert.equal(s.ui.publish.textContent, 'Publish changes to GitHub');
  assert.equal(s.requests.filter(r => r.method === 'PUT' && r.url.endsWith('/calendar-data.js')).length, 0);
  s.ui.signout.onclick();
  assert.equal(s.values.has('provinceGithubToken'), false);
  assert.equal(s.ui.publish.textContent, 'Connect GitHub');
});
test('invalid or unverified tokens are not retained in session storage', async () => {
  for (const mode of [{ authStatus: 401 }, { authOffline: true }]) {
    const s = setup(mode); await s.controller.init(); await s.connect('test-only-token');
    assert.equal(s.ui.signin.dataset.state, 'error');
    assert.equal(s.values.has('provinceGithubToken'), false);
    assert.equal(s.ui.publish.disabled, false);
  }
});
test('legacy OAuth callbacks are cleared and existing valid sessions still work', async () => {
  const s = setup({ hash: '#github_token=unit-test-token' });
  await s.controller.init();
  assert.equal(s.location.hash, '');
  assert.equal(s.ui.signin.dataset.state, 'success');
  assert.equal(s.ui.publish.textContent, 'Publish changes to GitHub');
});
test('direct save uses the current file SHA and waits for matching live data', async () => {
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' } });
  await s.controller.init(); await s.ui.publish.onclick(); await flush();
  assert.equal(s.ui.repository.dataset.state, 'success');
  assert.equal(s.ui.deployment.dataset.state, 'busy');
  const payload = JSON.parse(s.requests.find(r => r.method === 'PUT' && r.url.endsWith('/calendar-data.js')).body);
  assert.equal(payload.sha, 'current-file-sha');
  assert.equal(payload.branch, 'main');
  assert.equal(Buffer.from(payload.content, 'base64').toString('utf8'), 'window.PROVINCE_SCHEDULE=' + JSON.stringify(programme) + ';');
  assert.deepEqual(s.drafts[0], programme);
  assert.equal(s.navigations.length, 0);
  s.setLive(programme); await s.tick();
  assert.equal(s.ui.deployment.dataset.state, 'success');
  assert.match(s.ui.resultLink.href, /index.html\?published=/);
  assert.equal(s.ui.check.hidden, true);
});
test('Greek text survives direct publishing unchanged', async () => {
  const draft = [['January 2027','Sophia No. 193','Πειραιάς','2027-01-07','Installation']];
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, draft });
  await s.controller.init(); await s.ui.publish.onclick(); await flush();
  const payload = JSON.parse(s.requests.find(r => r.method === 'PUT' && r.url.endsWith('/calendar-data.js')).body);
  assert.equal(Buffer.from(payload.content, 'base64').toString('utf8'), 'window.PROVINCE_SCHEDULE=' + JSON.stringify(draft) + ';');
});
test('permission errors, conflicts, and offline saves never show deployment success', async () => {
  for (const outcome of [{ publishStatus: 403 }, { publishStatus: 409 }, { publishOffline: true }, { ok: false }]) {
    const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, ...outcome });
    await s.controller.init(); await s.ui.publish.onclick(); await flush();
    assert.equal(s.ui.repository.dataset.state, 'error');
    assert.equal(s.ui.deployment.dataset.state, 'idle');
    assert.equal(s.ui.publish.disabled, false);
    assert.equal(s.values.has('provinceLastPublication'), false);
  }
});
test('read failures do not attempt a write', async () => {
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, readStatus: 403 });
  await s.controller.init(); await s.ui.publish.onclick();
  assert.equal(s.requests.filter(r => r.method === 'PUT' && r.url.endsWith('/calendar-data.js')).length, 0);
  assert.match(s.ui.repository.textContent, /Contents: Read and write/);
});
test('repeated clicks do not send duplicate saves', async () => {
  let resolve; const response = new Promise(r => { resolve = r; });
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, publishDeferred: response });
  await s.controller.init(); const first = s.ui.publish.onclick(); await flush();
  assert.equal(s.ui.publish.disabled, true);
  await s.ui.publish.onclick();
  assert.equal(s.requests.filter(r => r.method === 'PUT' && r.url.endsWith('/calendar-data.js')).length, 1);
  resolve({ ok: true, json: async () => ({ commit: { sha: 'new-commit-sha' } }) }); await first; await flush();
});
test('slow deployment stays pending and can be checked again without another write', async () => {
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' } });
  await s.controller.init(); await s.ui.publish.onclick(); await flush(); await s.tick(601000);
  assert.equal(s.ui.deployment.dataset.state, 'pending');
  assert.equal(s.ui.check.hidden, false);
  s.setLive(programme); await s.ui.check.onclick(); await flush();
  assert.equal(s.ui.deployment.dataset.state, 'success');
  assert.equal(s.requests.filter(r => r.method === 'PUT' && r.url.endsWith('/calendar-data.js')).length, 1);
});
test('refresh resumes the published snapshot independently of a newer draft', async () => {
  const previous = { schedule: programme, savedAt: '2026-09-13T15:58:00Z', liveVerifiedAt: null };
  const s = setup({ session: { provinceLastPublication: JSON.stringify(previous) }, live: programme, draft: [] });
  await s.controller.init(); await flush();
  assert.equal(s.ui.repository.dataset.state, 'success');
  assert.equal(s.ui.deployment.dataset.state, 'success');
  assert.equal(s.requests.filter(r => r.method === 'PUT' && r.url.endsWith('/calendar-data.js')).length, 0);
});
test('a failed public fetch does not undo the confirmed repository save', async () => {
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, liveOffline: true });
  await s.controller.init(); await s.ui.publish.onclick(); await flush();
  assert.equal(s.ui.repository.dataset.state, 'success');
  assert.equal(s.ui.deployment.dataset.state, 'busy');
});
test('the previous failed sign-in offers direct connection and clears an old session', async () => {
  const s = setup({ hash: '#github_error=github_unavailable', session: { provinceGithubToken: 'old-test-token' } });
  await s.controller.init();
  assert.equal(s.ui.signin.dataset.state, 'error');
  assert.match(s.ui.signin.textContent, /Connect GitHub below/);
  assert.equal(s.values.has('provinceGithubToken'), false);
  assert.equal(s.location.hash, '');
  assert.equal(s.requests.length, 0);
  assert.equal(s.ui.connection.hidden, false);
});
test('the editor has no dependency on the failing relay', () => {
  assert.doesNotMatch(html, /province-greece-calendar\.dskiad\.chatgpt\.site|\/api\/publish/);
  assert.match(html, /id="githubToken" type="password"/);
});
test('publishing saves the subscription files before the programme and checks their deployment', async () => {
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, live: programme, liveFeedsReady: false });
  await s.controller.init(); await s.ui.publish.onclick(); await flush();
  const writes = s.requests.filter(request => request.method === 'PUT');
  assert.equal(writes.length, 8);
  assert.ok(writes.at(-1).url.endsWith('/calendar-data.js'));
  assert.equal(s.ui.repository.dataset.state, 'success');
  assert.equal(s.ui.deployment.dataset.state, 'busy');
  s.setLiveFeedsReady(true); await s.tick();
  assert.equal(s.ui.deployment.dataset.state, 'success');
  assert.match(s.ui.deployment.textContent, /subscription files are also live/);
});
test('unchanged Court feeds retain their timestamp and do not create extra commits', async () => {
  const old = CourtCalendars.buildFeeds(programme, '2026-09-01T00:00:00Z');
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, live: programme, repositoryFeeds: Object.fromEntries(old.map(feed => [feed.path, feed.content])) });
  await s.controller.init(); await s.ui.publish.onclick(); await flush();
  assert.equal(s.requests.filter(request => request.method === 'PUT').length, 1);
  assert.equal(s.ui.deployment.dataset.state, 'success');
});
test('subscription failures prevent a programme success message and preserve the draft', async () => {
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, feedPublishStatus: 403 });
  await s.controller.init(); await s.ui.publish.onclick();
  assert.equal(s.requests.filter(request => request.method === 'PUT' && request.url.endsWith('/calendar-data.js')).length, 0);
  assert.equal(s.ui.repository.dataset.state, 'error');
  assert.equal(s.drafts.length, 1);
  assert.equal(s.values.has('provinceLastPublication'), false);
});
test('a programme conflict reports any subscription files already saved', async () => {
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, publishStatus: 409 });
  await s.controller.init(); await s.ui.publish.onclick();
  assert.equal(s.ui.repository.dataset.state, 'error');
  assert.match(s.ui.repository.textContent, /Some subscription files were saved/);
  assert.equal(s.ui.deployment.dataset.state, 'idle');
});
test('edited Courts and page texts are published and confirmed on the live page', async () => {
  const content = CourtCalendars.normaliseContent({ texts: { title: 'ΕΠΑΡΧΙΑ' }, courts: CourtCalendars.defaultContent().courts, types: ['Meeting', 'Installation'] });
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, content });
  await s.controller.init(); await s.ui.publish.onclick(); await flush();
  assert.equal(s.ui.repository.dataset.state, 'success');
  assert.match(s.ui.repository.textContent, /Courts and page texts/);
  assert.deepEqual(CourtCalendars.parseContent(s.repositoryFeeds.get('calendar-content.js')), content);
  s.setLive(programme); s.setLiveFeedsReady(false); await s.tick();
  assert.equal(s.ui.deployment.dataset.state, 'busy');
  s.setLiveFeedsReady(true); await s.tick();
  assert.equal(s.ui.deployment.dataset.state, 'success');
});
test('uploaded images are saved before the programme and confirmed on the live page', async () => {
  const path = 'assets/uploads/emblem-20261116120000.png';
  const content = CourtCalendars.normaliseContent({ ...CourtCalendars.defaultContent(), images: { emblem: path, portrait: 'assets/provincial-grand-master.jpg' } });
  const uploads = [{ name: 'emblem', path, base64: 'iVBORw0KGgo=' }];
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, content, uploads });
  await s.controller.init(); await s.ui.publish.onclick(); await flush();
  assert.equal(s.ui.repository.dataset.state, 'success');
  assert.match(s.ui.repository.textContent, /1 image/);
  const puts = s.requests.filter(r => r.method === 'PUT').map(r => new URL(r.url).pathname.split('/contents/')[1]);
  assert.equal(puts[0], path);
  assert.equal(puts.at(-1), 'calendar-data.js');
  assert.equal(s.repositoryFeeds.get(path), 'iVBORw0KGgo=');
  assert.equal(CourtCalendars.parseContent(s.repositoryFeeds.get('calendar-content.js')).images.emblem, path);
  assert.deepEqual(s.uploaded.map(u => u.path), [path]);
  s.setLive(programme); s.setLiveFeedsReady(false); await s.tick();
  assert.equal(s.ui.deployment.dataset.state, 'busy');
  s.setLiveFeedsReady(true); await s.tick();
  assert.equal(s.ui.deployment.dataset.state, 'success');
});
test('image paths outside the assets folder are rejected', () => {
  for (const bad of ['../x.png', 'https://evil.example/x.png', "assets/x.png') ;", 'assets/x.svg', 'assets/../x.png']) {
    assert.equal(CourtCalendars.isImagePath(bad), false);
  }
  const content = CourtCalendars.normaliseContent({ ...CourtCalendars.defaultContent(), images: { emblem: "assets/a.png'),url(x" } });
  assert.equal(content.images.emblem, 'assets/province-emblem.jpeg');
});
test('a missing uploaded image keeps the published image instead of breaking the page', async () => {
  const live = 'assets/uploads/emblem-live.webp';
  const content = CourtCalendars.normaliseContent({ ...CourtCalendars.defaultContent(), images: { emblem: 'assets/uploads/emblem-deleted.png', portrait: 'assets/provincial-grand-master.jpg' } });
  const published = CourtCalendars.serializeContent(CourtCalendars.normaliseContent({ ...CourtCalendars.defaultContent(), images: { emblem: live, portrait: 'assets/provincial-grand-master.jpg' } }));
  const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, content, repositoryFeeds: { 'calendar-content.js': published, [live]: 'x' } });
  await s.controller.init(); await s.ui.publish.onclick(); await flush();
  assert.equal(s.ui.repository.dataset.state, 'success');
  assert.equal(CourtCalendars.parseContent(s.repositoryFeeds.get('calendar-content.js')).images.emblem, live);
});
test('refusals explain which token setting is missing and quote GitHub', async () => {
  const cases = [
    [{ readStatus: 404 }, /cannot see the ATHELSTAN-PROV-CALENDAR repository/],
    [{ publishStatus: 403 }, /not allowed to save it[\s\S]*Contents: Read and write[\s\S]*GitHub 403 while saving calendar-data\.js/],
  ];
  for (const [options, expected] of cases) {
    const s = setup({ session: { provinceGithubToken: 'unit-test-token' }, ...options });
    await s.controller.init(); await s.ui.publish.onclick(); await flush();
    assert.equal(s.ui.repository.dataset.state, 'error');
    assert.match(s.ui.repository.textContent, expected);
  }
});
