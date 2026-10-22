const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const script = readFileSync(require('node:path').join(__dirname, '../missav-enhancer.user.js'), 'utf8');

function setup({ quality = 720, height = 0, selected = null, htmlLanguage = 'en', path = '/dm265/en', links = [] } = {}) {
    let now = 0;
    let sequence = 0;
    const timers = new Map();
    const storage = new Map();
    const redirects = [];
    const media = {
        readyState: 2,
        videoHeight: height,
        closest: () => ({ querySelector: () => selected === null ? null : { getAttribute: () => String(selected) } }),
    };
    const context = {
        URL, Date: { now: () => now }, console: { warn() {} },
        setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, at: now + delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        document: { documentElement: { lang: htmlLanguage }, querySelectorAll: () => links, hasFocus: () => true },
        location: { href: `https://missav.ws${path}`, replace: url => redirects.push(url) },
        sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    };
    const instrumented = script.replace("    start().catch(error => console.error(PREFIX, '初始化失败', error));", `
        globalThis.api = {
            state, applyQuality, applyLanguage, resetSource, cancelQualityRequest,
            attach(p, v) { player = p; video = v; },
            setPreferred(value) { preferred = value; },
            setLanguage(value) { preferredLanguage = value; },
            markApplied(value) { qualityApplied = value; }
        };
    `);
    runInNewContext(instrumented, context);
    const player = { quality, options: { quality: [360, 720] } };
    context.api.attach(player, media);
    return {
        api: context.api, player, media, redirects,
        advance(ms) {
            const until = now + ms;
            while (true) {
                const entry = [...timers.entries()].filter(([, task]) => task.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
                if (!entry) break;
                now = entry[1].at;
                timers.delete(entry[0]);
                entry[1].fn();
            }
            now = until;
        },
    };
}

function link(href, text = '', language = '') {
    return { textContent: text, getAttribute: key => ({ href, hreflang: language })[key] || null };
}

test('already playing 360P is not reported as failure when quality getter is unavailable', () => {
    const h = setup({ quality: undefined, height: 360 });
    Object.defineProperty(h.player, 'quality', { get: () => undefined, set() { throw new Error('Must not set'); } });
    h.api.applyQuality();
    assert.equal(h.api.state.quality, '当前播放 360P');
});

test('checked quality menu confirms 360P independently of getter', () => {
    const h = setup({ quality: undefined, selected: 360 });
    h.api.applyQuality();
    assert.equal(h.api.state.quality, '已选择 360P');
});

test('asynchronous quality switch waits and writes once', () => {
    const h = setup();
    let writes = 0;
    let actual = 720;
    Object.defineProperty(h.player, 'quality', { get: () => actual, set() { writes++; } });
    h.api.applyQuality();
    h.api.applyQuality();
    assert.match(h.api.state.quality, /等待播放器确认/);
    h.advance(500);
    actual = 360;
    h.advance(250);
    assert.equal(h.api.state.quality, '已选择 360P');
    assert.equal(writes, 1);
});

test('unconfirmed change times out without asserting failure or success', () => {
    const h = setup();
    Object.defineProperty(h.player, 'quality', { get: () => undefined, set() {} });
    h.api.applyQuality();
    h.advance(10000);
    assert.match(h.api.state.quality, /结果未确认/);
});

test('setter errors remain explicit failures', () => {
    const h = setup();
    Object.defineProperty(h.player, 'quality', { get: () => 720, set() { throw new Error('Broken setter'); } });
    h.api.applyQuality();
    assert.match(h.api.state.quality, /设置失败/);
});

test('cancelled request cannot overwrite new status', () => {
    const h = setup();
    Object.defineProperty(h.player, 'quality', { get: () => 720, set() {} });
    h.api.applyQuality();
    h.api.cancelQualityRequest();
    h.api.state.quality = 'new video';
    h.advance(11000);
    assert.equal(h.api.state.quality, 'new video');
});

test('missing target falls back without changing preference', () => {
    const h = setup();
    h.player.options.quality = ['480', '720'];
    h.api.applyQuality();
    assert.equal(h.api.state.quality, '目标 360P 不可用，已选择 480P');
});

for (const language of ['en', 'ja', 'zh-Hant']) {
    test(`${language} switches to Simplified Chinese preserving content`, () => {
        const h = setup({ htmlLanguage: language, path: '/dm265/en/example?q=1#player', links: [link('/dm247/cn/example?localized=1', '简体中文')] });
        h.api.applyLanguage();
        assert.equal(h.redirects[0], 'https://missav.ws/dm247/cn/example?localized=1&q=1#player');
        h.api.applyLanguage();
        assert.equal(h.redirects.length, 1);
    });
}

test('already Simplified Chinese requires no language links', () => {
    const h = setup({ htmlLanguage: 'zh-CN', path: '/dm247/cn' });
    h.api.applyLanguage();
    assert.equal(h.api.state.language, '已是简体中文');
    assert.equal(h.redirects.length, 0);
});

test('recognizes an unlabelled cn link on the same content', () => {
    const h = setup({ links: [link('/dm247/cn')] });
    h.api.applyLanguage();
    assert.equal(h.redirects[0], 'https://missav.ws/dm247/cn');
});

test('does not redirect to another origin or lose detail page', () => {
    const h = setup({ path: '/dm265/en/example', links: [link('https://example.com/cn/example', '简体中文'), link('/dm247/cn', '简体中文')] });
    h.api.applyLanguage();
    assert.equal(h.redirects.length, 0);
    assert.match(h.api.state.language, /未找到/);
});

test('generic zh alternate with cn path identifies Simplified Chinese', () => {
    const h = setup({ links: [link('/dm247/cn', '', 'zh')] });
    h.api.applyLanguage();
    assert.equal(h.redirects[0], 'https://missav.ws/dm247/cn');
});

for (const [language, route] of [['en', 'en'], ['ja', 'ja'], ['zh-Hant', 'tw']]) {
    test(`user can select ${language} instead of Simplified Chinese`, () => {
        const h = setup({ htmlLanguage: 'zh-CN', path: '/dm247/cn', links: [link(`/dm265/${route}`)] });
        h.api.setLanguage(language);
        h.api.applyLanguage();
        assert.equal(h.redirects[0], `https://missav.ws/dm265/${route}`);
    });
}

test('user-selected current language does not redirect', () => {
    const h = setup();
    h.api.setLanguage('en');
    h.api.applyLanguage();
    assert.equal(h.redirects.length, 0);
    assert.equal(h.api.state.language, '已是English');
});

test('unavailable user language does not fall back to Chinese', () => {
    const h = setup({ links: [link('/dm247/cn')] });
    h.api.setLanguage('ja');
    h.api.applyLanguage();
    assert.equal(h.redirects.length, 0);
    assert.match(h.api.state.language, /日本語/);
});

for (const language of ['ko', 'ms', 'th', 'de', 'fr', 'vi', 'id', 'fil', 'pt']) {
    test(`verified ${language} route preserves the detail path`, () => {
        const h = setup({ path: '/dm265/en/example', links: [link(`/${language}/example`)] });
        h.api.setLanguage(language);
        h.api.applyLanguage();
        assert.equal(h.redirects[0], `https://missav.ws/${language}/example`);
    });
}

test('Traditional Chinese invokes site handler instead of navigating to placeholder root', () => {
    let clicks = 0;
    const entry = link('/', '繁體中文');
    const attribute = entry.getAttribute;
    entry.getAttribute = key => key === '@click.prevent' ? 'redirectToBaseLocalizedUrl' : attribute(key);
    entry.click = () => clicks++;
    const h = setup({ path: '/cn/example', htmlLanguage: 'zh-CN', links: [entry] });
    h.api.setLanguage('zh-Hant');
    h.api.applyLanguage();
    assert.equal(clicks, 1);
    assert.equal(h.redirects.length, 0);
});


test('manual language apply follows target link even when listing page lang is stale', () => {
    const h = setup({ htmlLanguage: 'zh-CN', path: '/dm265/en', links: [link('/dm247/cn', '简体中文')] });
    h.api.applyLanguage(true);
    assert.equal(h.redirects[0], 'https://missav.ws/dm247/cn');
});

function notificationHarness(seen = '', failSave = false) {
    const storage = new Map([['lastAcknowledgedVersion', seen]]);
    const notices = [];
    const warnings = [];
    const context = {
        GM_info: { script: { version: '2026.10.22.1' } },
        GM_getValue: async (key, fallback) => storage.get(key) ?? fallback,
        GM_setValue: async (key, value) => {
            if (failSave) throw new Error('Storage unavailable');
            storage.set(key, value);
        },
        console: { warn: (...args) => warnings.push(args) },
        document: {
            body: { append: element => notices.push(element) },
            createElement: () => ({
                style: {}, events: {}, children: [],
                setAttribute() {},
                append(...children) { this.children.push(...children); },
                addEventListener(event, fn) { this.events[event] = fn; },
                remove() { notices.splice(notices.indexOf(this), 1); },
            }),
        },
    };
    runInNewContext(script.replace("    start().catch(error => console.error(PREFIX, '初始化失败', error));", 'globalThis.show = showUpdateNotice;'), context);
    return { show: context.show, notices, storage, warnings };
}

test('first installation shows current version and acknowledgment persists', async () => {
    const h = notificationHarness();
    await h.show();
    assert.match(h.notices[0].children[0].textContent, /当前版本/);
    await h.notices[0].children[3].events.click();
    assert.equal(h.storage.get('lastAcknowledgedVersion'), '2026.10.22.1');
    await h.show();
    assert.equal(h.notices.length, 0);
    await h.show(true);
    assert.equal(h.notices.length, 1);
});

test('changed version shows update notice, concurrent calls do not duplicate it', async () => {
    const h = notificationHarness('v20261022');
    await Promise.all([h.show(), h.show()]);
    assert.equal(h.notices.length, 1);
    assert.match(h.notices[0].children[0].textContent, /已更新到 2026\.10\.22\.1/);
});

test('failed acknowledgment stays visible and permits retry', async () => {
    const h = notificationHarness('', true);
    await h.show();
    await h.notices[0].children[3].events.click();
    assert.equal(h.notices.length, 1);
    assert.match(h.notices[0].children[1].textContent, /无法保存/);
    assert.equal(h.notices[0].children[3].disabled, false);
    assert.equal(h.storage.get('lastAcknowledgedVersion'), '');
    assert.equal(h.warnings.length, 1);
});
