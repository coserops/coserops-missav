const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const script = readFileSync(require('node:path').join(__dirname, '../missav-enhancer.user.js'), 'utf8');
const master = 'https://media.example/video/playlist.m3u8?token=a%2Bb&expires=123';
const uuid = '01234567-89ab-cdef-0123-456789abcdef';
const flush = () => new Promise(resolve => setImmediate(resolve));

function element(tag) {
    return {
        tag, children: [], events: {}, attributes: {}, style: {}, textContent: '', isConnected: false, open: false,
        append(...children) { this.children.push(...children); for (const child of children) child.isConnected = true; },
        insertBefore(child, reference) {
            const previousIndex = this.children.indexOf(child);
            if (previousIndex !== -1) this.children.splice(previousIndex, 1);
            const nextIndex = reference === null ? this.children.length : this.children.indexOf(reference);
            assert.ok(nextIndex >= 0, 'reference must be a child');
            this.children.splice(nextIndex, 0, child);
        },
        replaceChildren(...children) { this.children = children; },
        setAttribute(key, value) { this.attributes[key] = value; },
        addEventListener(name, fn) { this.events[name] = fn; },
        set innerHTML(value) {
            this.markup = value;
            this.parts = Object.fromEntries(['refresh', 'status', 'list', 'close'].map(name => [`[data-download-${name}]`, element('div')]));
        },
        querySelector(selector) { return this.parts?.[selector] || null; },
        contains(node) { return node === this || this.children.some(child => child.contains?.(node)); },
        remove() { this.isConnected = false; },
        focus() { this.focused = true; },
        select() { this.selected = true; },
        showModal() { this.open = true; },
        close() { this.open = false; this.events.close?.(); },
    };
}

function harness({ globals = {}, scripts = [], src = 'blob:https://missav.ws/test', sources = [], present = true, videos = [], links = [], resources = [] } = {}) {
    const timers = new Map();
    const calls = [];
    const copied = [];
    const head = element('head');
    const media = {
        currentSrc: src, src,
        querySelectorAll: () => sources.map(src => ({ src })),
        closest: () => null,
        after(node) { node.isConnected = true; },
    };
    const context = {
        URL, AbortController, DOMException, Blob, console: { warn() {} }, unsafeWindow: globals,
        location: { href: 'https://missav.ws/cn/example' },
        navigator: { clipboard: { writeText: async value => copied.push(value) } },
        window: { performance: { getEntriesByType: () => resources.map(name => ({ name })) } },
        document: {
            head, body: element('body'), createElement: element,
            getElementById: id => head.children.find(node => node.id === id),
            querySelectorAll: selector => {
                if (selector === 'video') return videos;
                if (selector.startsWith('a[href]')) return links.map(attributes => ({ getAttribute: key => attributes[key] || null }));
                return scripts.map(textContent => ({ textContent }));
            },
        },
        setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; },
        clearTimeout(id) { timers.delete(id); },
        fetch(url, options) {
            return new Promise((resolve, reject) => calls.push({ url, options, resolve, reject }));
        },
    };
    runInNewContext(script.replace("    start().catch(error => console.error(PREFIX, '初始化失败', error));", `
        globalThis.api = {
            collectDownloadLinks, parseDownloadPlaylist, parseDownloadManifest, updateDownloadLinks, resetDownloadLinks, rememberDownloadResource, state: featureStatus,
            ensureDownloadButton, openDownloadPanel, downloadDetails, formatVideoSize, videoDownloadCommand, saveVideo, browserDownloadReason,
            attach(value) { video = value; },
            get panel() { return downloadPanel; },
            get button() { return downloadButton; }
        };
    `), context);
    context.api.attach(present ? media : null);
    return {
        ...context, api: context.api, calls, copied, media, timers,
        rows() { return context.api.panel?.querySelector('[data-download-list]').children || []; },
        reply(index, text, url = calls[index].url) { calls[index].resolve({ ok: true, url, headers: new Headers(), text: async () => text }); },
    };
}

test('no player does not scan unrelated page sources or create a download panel', () => {
    const h = harness({ present: false, globals: { source: master } });
    assert.equal(h.api.collectDownloadLinks().length, 0);
    h.api.updateDownloadLinks();
    assert.equal(h.api.panel, null);
    assert.equal(h.calls.length, 0);
});

test('blob playback uses original HLS sources, preserves signatures and deduplicates URLs', () => {
    const h = harness({ globals: { source: master, hls: { url: master } }, sources: ['/media/movie.mp4?token=1'] });
    const urls = Array.from(h.api.collectDownloadLinks(), entry => entry.url);
    assert.deepEqual(urls, [master, 'https://missav.ws/media/movie.mp4?token=1']);
});

test('direct MP4 playback exposes a link without fetching the video', () => {
    const h = harness({ src: 'https://media.example/movie.mp4?token=one' });
    h.api.updateDownloadLinks();
    assert.equal(h.rows()[0].children[1].value, h.media.src);
    assert.match(h.rows()[0].children[0].textContent, /MP4/);
    assert.equal(h.calls.length, 0);
});

test('inline escaped source URLs are decoded without executing script text', () => {
    const h = harness({ scripts: [String.raw`throw new Error('must not execute'); source="https:\/\/media.example\/movie.m3u8?x=1\u0026y=2";`] });
    assert.equal(h.api.collectDownloadLinks()[0].url, 'https://media.example/movie.m3u8?x=1&y=2');
});

test('UUID candidates and literal previews are both retained at any script index', () => {
    const h = harness({ scripts: ['const preview="https://media.example/preview.mp4";', `'words|${uuid}||seek|player'`] });
    const entries = h.api.collectDownloadLinks();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].url, 'https://media.example/preview.mp4');
    assert.equal(entries[1].url, `https://surrit.com/${uuid}/playlist.m3u8`);
    assert.equal(entries[1].inferred, true);
});

test('unrelated UUIDs, malformed IDs and non-HTTP sources are not offered as links', () => {
    const h = harness({ globals: { source: 'javascript:alert(1)', source720: 'data:video/mp4;base64,AAAA' }, scripts: [`'${uuid}|other|seek'`, "'not-a-uuid||seek'"] });
    assert.equal(h.api.collectDownloadLinks().length, 0);
});

test('master playlist resolves relative, absolute and extensionless variants against final URL', () => {
    const h = harness();
    const entries = h.api.parseDownloadPlaylist(`\uFEFF#EXTM3U\r
#EXT-X-MEDIA:TYPE=AUDIO,URI="audio/index.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
# comment
../360/index.m3u8?token=x%2By&expires=2
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720
https://other.example/720.m3u8?token=z
#EXT-X-STREAM-INF:BANDWIDTH=3000000,NAME="High"
//other.example/stream?id=1080
`, 'https://redirect.example/id/hls/master.m3u8?token=old');
    assert.deepEqual(Array.from(entries, entry => [entry.label, entry.url]), [
        ['360P', 'https://redirect.example/id/360/index.m3u8?token=x%2By&expires=2'],
        ['720P', 'https://other.example/720.m3u8?token=z'],
        ['High', 'https://other.example/stream?id=1080'],
    ]);
});

test('media playlist segments are not exposed as complete video downloads', () => {
    const h = harness();
    assert.equal(h.api.parseDownloadPlaylist('#EXTM3U\n#EXTINF:6,\nsegment1.ts\n#EXTINF:6,\nsegment2.ts', master).length, 0);
    assert.throws(() => h.api.parseDownloadPlaylist('<html>Access denied</html>', master), /M3U8/);
});

test('playlist filters executable URLs and deduplicates variants', () => {
    const h = harness();
    const entries = h.api.parseDownloadPlaylist('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=500000\njavascript:alert(1)\n#EXT-X-STREAM-INF:BANDWIDTH=500000\n360.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=500000\n360.m3u8', master);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].label, '500 kbps');
});

test('panel retains source, adds variants using redirect base, and copies exact URL', async () => {
    const h = harness({ globals: { source: master } });
    h.api.updateDownloadLinks();
    h.api.updateDownloadLinks();
    assert.equal(h.calls.length, 1);
    assert.equal(h.rows()[0].children[1].value, master);
    h.reply(0, '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n360/index.m3u8?token=a%2Bb', 'https://redirect.example/id/master.m3u8');
    await flush();
    assert.equal(h.rows().length, 2);
    const [, input, copy] = h.rows()[1].children;
    assert.equal(input.value, 'https://redirect.example/id/360/index.m3u8?token=a%2Bb');
    await copy.events.click();
    assert.deepEqual(h.copied, [input.value]);
    assert.equal(copy.textContent, '已复制');
    assert.equal(h.timers.size, 0);
    assert.match(h.api.state.download, /已展示 2 条视频链接/);
});

test('clipboard failure leaves a focused, selected URL for manual copying', async () => {
    const h = harness({ src: 'https://media.example/movie.mp4' });
    h.navigator.clipboard = undefined;
    h.api.updateDownloadLinks();
    const [, input, copy] = h.rows()[0].children;
    await copy.events.click();
    assert.equal(input.focused, true);
    assert.equal(input.selected, true);
    assert.equal(copy.disabled, false);
    assert.equal(copy.textContent, '请手动复制');
});

test('HTTP failure preserves the source and refresh permits a successful retry', async () => {
    const h = harness({ globals: { source: master } });
    h.api.updateDownloadLinks();
    h.calls[0].resolve({ ok: false, status: 403 });
    await flush();
    assert.equal(h.rows()[0].children[1].value, master);
    assert.match(h.api.state.download, /解析失败/);
    h.api.panel.querySelector('[data-download-refresh]').events.click();
    h.reply(1, '#EXTM3U\n#EXTINF:6,\nsegment.ts');
    await flush();
    assert.match(h.api.state.download, /已展示 1 条视频链接/);
});

test('inferred source stays marked unverified on CORS failure', async () => {
    const h = harness({ scripts: [`'${uuid}||seek'`] });
    h.api.updateDownloadLinks();
    h.calls[0].reject(new TypeError('Failed to fetch'));
    await flush();
    assert.match(h.rows()[0].children[0].textContent, /待验证/);
    assert.match(h.api.state.download, /待验证/);
});

test('successful fallback verification removes the candidate label', async () => {
    const h = harness({ scripts: [`'${uuid}||seek'`] });
    h.api.updateDownloadLinks();
    h.reply(0, '#EXTM3U\n#EXTINF:6,\nsegment.ts');
    await flush();
    assert.equal(h.rows()[0].children[0].textContent, '1. HLS 播放列表');
});

test('timeout aborts the fetch and leaves source available for copying', async () => {
    const h = harness({ globals: { source: master } });
    h.api.updateDownloadLinks();
    const request = h.calls[0];
    request.options.signal.addEventListener('abort', () => request.reject(new Error('Aborted')));
    for (const fn of h.timers.values()) fn();
    await flush();
    assert.equal(request.options.signal.aborted, true);
    assert.equal(h.rows().length, 1);
    assert.match(h.api.state.download, /超时/);
    assert.equal(h.timers.size, 0);
});

test('a late old playlist cannot overwrite a new video source', async () => {
    const h = harness({ globals: { source: master } });
    h.api.updateDownloadLinks();
    h.unsafeWindow.source = 'https://media.example/new/playlist.m3u8';
    h.api.updateDownloadLinks();
    assert.equal(h.calls[0].options.signal.aborted, true);
    h.reply(1, '#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=1280x720\n720/index.m3u8');
    await flush();
    h.reply(0, '#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=640x360\nold.m3u8');
    await flush();
    assert.deepEqual(h.rows().map(row => row.children[1].value), ['https://media.example/new/playlist.m3u8', 'https://media.example/new/720/index.m3u8']);
});

test('removing the video cancels its download request and removes its panel', async () => {
    const h = harness({ globals: { source: master } });
    h.api.updateDownloadLinks();
    const panel = h.api.panel;
    h.api.resetDownloadLinks();
    h.api.attach(null);
    h.reply(0, '#EXTM3U');
    await flush();
    assert.equal(h.calls[0].options.signal.aborted, true);
    assert.equal(panel.isConnected, false);
    assert.equal(h.api.panel, null);
    assert.equal(h.timers.size, 0);
});

test('all source categories are collected together without suppressing previews or candidates', () => {
    const secondId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const h = harness({
        globals: { source: master, source2160: 'https://media.example/2160.m3u8' },
        src: 'https://media.example/current.mp4',
        sources: ['/media/alternate.webm'],
        videos: [{ src: 'https://media.example/other.mp4', querySelectorAll: () => [] }],
        links: [{ href: '/media/linked.mp4' }, { 'data-src': '/media/data.m3u8' }],
        resources: ['https://media.example/request.m3u8', 'https://media.example/segment.ts'],
        scripts: [
            `const a='https://media.example/script.m3u8'; const b='https://media.example/preview.mp4'; const c='../media/relative.mp4'; '${uuid}||seek|${secondId}||seek'`,
            `const d='https://media.example/second.m3u8'; '${secondId}||seek'`,
        ],
    });
    const entries = h.api.collectDownloadLinks();
    assert.deepEqual(new Set(Array.from(entries, entry => entry.url)), new Set([
        master, 'https://media.example/2160.m3u8', 'https://media.example/current.mp4',
        'https://missav.ws/media/alternate.webm', 'https://media.example/other.mp4',
        'https://missav.ws/media/linked.mp4', 'https://missav.ws/media/data.m3u8',
        'https://media.example/request.m3u8', 'https://media.example/script.m3u8',
        'https://media.example/preview.mp4', 'https://missav.ws/media/relative.mp4',
        `https://surrit.com/${uuid}/playlist.m3u8`, `https://surrit.com/${secondId}/playlist.m3u8`,
        'https://media.example/second.m3u8',
    ]));
    assert.equal(entries.filter(entry => entry.inferred).length, 2);
    assert.equal(entries.find(entry => entry.url.includes(secondId)).origins.length, 2);
});

test('deduplication merges origins while retaining different signed URLs', () => {
    const explicit = `https://surrit.com/${uuid}/playlist.m3u8`;
    const h = harness({ globals: { source: explicit }, src: explicit, resources: [explicit], scripts: [`'${uuid}||seek'`, `const x='${explicit}?token=other';`] });
    const entries = h.api.collectDownloadLinks();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].origins.length, 4);
    assert.equal(entries[0].inferred, false);
    assert.equal(entries[1].url, `${explicit}?token=other`);
});

test('every playlist contributes variants even if the first fails or responses arrive out of order', async () => {
    const h = harness({ globals: { source: master, source720: 'https://media.example/b/master.m3u8', source1080: 'https://media.example/c/master.m3u8' }, scripts: ["const preview='https://media.example/preview.mp4';"] });
    h.api.updateDownloadLinks();
    assert.equal(h.calls.length, 3);
    assert.equal(h.rows().length, 4);
    h.reply(2, '#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=640x360\n360.m3u8');
    await flush();
    h.reply(1, '#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=1280x720\n720.m3u8');
    h.calls[0].reject(new Error('First source unavailable'));
    await flush();
    const urls = new Set(h.rows().map(row => row.children[1].value));
    for (const call of h.calls) assert.ok(urls.has(call.url));
    assert.ok(urls.has('https://media.example/preview.mp4'));
    assert.ok(urls.has('https://media.example/b/360.m3u8'));
    assert.ok(urls.has('https://media.example/c/720.m3u8'));
    assert.match(h.api.state.download, /已展示 6 条视频链接/);
    assert.match(h.api.state.download, /1 个播放列表解析失败/);
    for (const row of h.rows()) assert.match(row.children[3].textContent, /^来源：.+/);
    assert.equal(h.timers.size, 0);
});

test('all playlists are queued with bounded concurrency and queued work is cancelled on reset', async () => {
    const h = harness({ globals: { hls: { levels: [1, 2, 3, 4, 5].map(n => ({ url: [`https://media.example/${n}.m3u8`] })) } } });
    h.api.updateDownloadLinks();
    assert.equal(h.rows().length, 5);
    assert.equal(h.calls.length, 3);
    h.reply(0, '#EXTM3U');
    await flush();
    assert.equal(h.calls.length, 4);
    h.api.resetDownloadLinks();
    for (let i = 1; i < 4; i++) {
        assert.equal(h.calls[i].options.signal.aborted, true);
        h.reply(i, '#EXTM3U');
    }
    await flush();
    assert.equal(h.calls.length, 4);
    assert.equal(h.timers.size, 0);
});

test('a fifth playlist is eventually parsed after earlier sources finish', async () => {
    const h = harness({ globals: { source: [1, 2, 3, 4, 5].map(n => ({ src: `https://media.example/${n}/master.m3u8` })) } });
    h.api.updateDownloadLinks();
    for (let i = 0; i < 5; i++) {
        h.reply(i, '#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=640x360\n360.m3u8');
        await flush();
    }
    assert.equal(h.calls.length, 5);
    assert.equal(h.rows().length, 10);
    assert.match(h.api.state.download, /已展示 10 条视频链接/);
    assert.doesNotMatch(h.api.state.download, /正在解析/);
});

test('late resource discoveries are retained and existing playlists are not repeatedly fetched', async () => {
    const h = harness({ globals: { source: master } });
    h.api.updateDownloadLinks();
    h.reply(0, '#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=640x360\n360.m3u8');
    await flush();
    assert.equal(h.api.rememberDownloadResource('https://media.example/late/master.m3u8'), true);
    assert.equal(h.api.rememberDownloadResource('https://media.example/late/master.m3u8'), false);
    assert.equal(h.api.rememberDownloadResource('https://media.example/late/segment.ts'), false);
    h.api.updateDownloadLinks();
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[1].url, 'https://media.example/late/master.m3u8');
    h.reply(1, '#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=1280x720\n720.m3u8');
    await flush();
    assert.equal(h.rows().length, 4);
    h.api.updateDownloadLinks();
    assert.equal(h.calls.length, 2);
});

test('new download button opens a separate dialog and only then requests file metadata', async () => {
    const h = harness({ src: 'https://media.example/movie.mp4' });
    h.api.ensureDownloadButton();
    assert.equal(h.api.button.textContent, 'CoserOps MissAV\n视频下载');
    assert.equal(h.api.panel, null);
    assert.equal(h.calls.length, 0);
    h.api.button.events.click();
    assert.equal(h.api.panel.tag, 'dialog');
    assert.equal(h.api.panel.open, true);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].options.method, 'HEAD');
    h.calls[0].resolve({ ok: true, headers: new Headers({ 'content-type': 'video/mp4', 'content-length': String(64 * 1024 ** 2) }) });
    await flush();
    const info = h.api.downloadDetails({ url: h.media.src });
    assert.equal(info.size, 64 * 1024 ** 2);
    assert.equal(info.estimated, false);
    assert.equal(h.rows()[0].children[4].children[3].children[1].textContent, '64.00 MiB');
    h.api.panel.querySelector('[data-download-close]').events.click();
    assert.equal(h.api.panel.open, false);
    h.api.button.events.click();
    assert.equal(h.api.panel.open, true);
    assert.equal(h.calls.length, 1);
});

test('HLS size comes from bitrate and media duration, never manifest content-length', async () => {
    const h = harness({ globals: { source: master } });
    h.api.openDownloadPanel();
    h.reply(0, '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,AVERAGE-BANDWIDTH=800000,RESOLUTION=1280x720\n720.m3u8');
    await flush();
    assert.equal(h.calls[1].url, 'https://media.example/video/720.m3u8');
    assert.equal(h.calls[1].options.method, 'GET');
    h.calls[1].resolve({ ok: true, url: h.calls[1].url, headers: new Headers({ 'content-length': '132' }), text: async () => '#EXTM3U\n#EXTINF:5,\n1.ts\n#EXTINF:7.5,\n2.ts\n#EXT-X-ENDLIST' });
    await flush();
    const variant = h.api.parseDownloadPlaylist('#EXTM3U\n#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=800000,RESOLUTION=1280x720\n720.m3u8', master)[0];
    const info = h.api.downloadDetails(variant);
    assert.equal(info.duration, 12.5);
    assert.equal(info.size, 1250000);
    assert.equal(info.estimated, true);
    assert.equal(h.api.downloadDetails({ url: master }).size, undefined);
    assert.equal(h.calls.length, 2, 'listing must not download any media segments');
    const variantRow = h.rows().find(row => row.children[1].value === variant.url);
    assert.match(variantRow.children[4].children[3].children[1].textContent, /估算/);
    assert.equal(variantRow.children[5].children[0].disabled, false);
});

test('missing or rejected file length stays unknown while direct download remains available', async () => {
    const h = harness({ src: 'https://media.example/file.mp4' });
    h.api.openDownloadPanel();
    h.calls[0].reject(new TypeError('CORS denied'));
    await flush();
    assert.equal(h.api.downloadDetails({ url: h.media.src }).size, undefined);
    assert.equal(h.rows()[0].children[4].children[3].children[1].textContent, '未知');
    assert.equal(h.rows()[0].children[5].children[0].disabled, false);
    assert.match(h.rows()[0].children[6].textContent, /获取失败/);
    assert.equal(h.api.formatVideoSize(-1), '未知');
    assert.equal(h.api.formatVideoSize(NaN), '未知');
});

for (const status of [405, 501, 200]) {
    test(`file size probe falls back from HEAD ${status} without length to a one-byte GET`, async () => {
        const h = harness({ src: 'https://media.example/file.mp4?signature=keep%2Bme' });
        h.api.openDownloadPanel();
        h.calls[0].resolve({ ok: status === 200, status, headers: new Headers() });
        await flush();
        assert.equal(h.calls.length, 2);
        assert.equal(h.calls[1].url, h.media.src);
        assert.equal(h.calls[1].options.method, 'GET');
        assert.equal(h.calls[1].options.headers.Range, 'bytes=0-0');
        let cancelled = 0;
        h.calls[1].resolve({
            ok: true, status: 206,
            headers: new Headers({ 'content-type': 'video/mp4', 'content-length': '1', 'content-range': 'bytes 0-0/67108864' }),
            body: { async cancel() { cancelled++; } },
            text() { throw new Error('Must not consume video body'); },
            arrayBuffer() { throw new Error('Must not consume video body'); },
        });
        await flush();
        assert.equal(h.api.downloadDetails({ url: h.media.src }).size, 67108864);
        assert.equal(h.rows()[0].children[4].children[3].children[1].textContent, '64.00 MiB');
        assert.equal(h.rows()[0].children[5].children[0].disabled, false);
        assert.equal(h.calls[1].options.signal.aborted, true);
        assert.equal(cancelled, 1);
        assert.equal(h.timers.size, 0);
    });
}

test('server ignoring Range is stopped after headers without reading a full video', async () => {
    const h = harness({ src: 'https://media.example/file.mp4' });
    h.api.openDownloadPanel();
    h.calls[0].resolve({ ok: false, status: 405 });
    await flush();
    let cancelled = false;
    h.calls[1].resolve({
        ok: true, status: 200, headers: new Headers({ 'content-length': '2147483648', 'content-type': 'video/mp4' }),
        body: { async cancel() { cancelled = true; }, getReader() { throw new Error('Must not read'); } },
    });
    await flush();
    assert.equal(h.api.downloadDetails({ url: h.media.src }).size, 2147483648);
    assert.equal(h.calls[1].options.signal.aborted, true);
    assert.equal(cancelled, true);
});

for (const contentRange of [undefined, 'bytes 0-0/*', 'bytes 10-10/12345', 'bytes 0-0/9007199254740993']) {
    test(`partial response without a valid total stays unknown: ${contentRange}`, async () => {
        const h = harness({ src: 'https://media.example/file.mp4' });
        h.api.openDownloadPanel();
        h.calls[0].resolve({ ok: false, status: 405 });
        await flush();
        const headers = new Headers({ 'content-length': '1' });
        if (contentRange) headers.set('content-range', contentRange);
        h.calls[1].resolve({ ok: true, status: 206, headers });
        await flush();
        assert.equal(h.api.downloadDetails({ url: h.media.src }).size, undefined);
        assert.equal(h.rows()[0].children[4].children[3].children[1].textContent, '未知');
        assert.equal(h.calls.length, 2);
    });
}

test('a rejected range probe preserves the list and shows the actual HTTP error without looping', async () => {
    const h = harness({ src: 'https://media.example/file.mp4' });
    h.api.openDownloadPanel();
    h.calls[0].resolve({ ok: false, status: 405 });
    await flush();
    h.calls[1].resolve({ ok: false, status: 405 });
    await flush();
    assert.equal(h.rows().length, 1);
    assert.equal(h.rows()[0].children[1].value, h.media.src);
    assert.match(h.rows()[0].children[6].textContent, /HTTP 405/);
    assert.equal(h.rows()[0].children[5].children[0].disabled, false);
    h.api.openDownloadPanel();
    await flush();
    assert.equal(h.calls.length, 2);
});

test('HTML returned by the range probe is not mistaken for video size', async () => {
    const h = harness({ src: 'https://media.example/file.mp4' });
    h.api.openDownloadPanel();
    h.calls[0].resolve({ ok: false, status: 405 });
    await flush();
    let cancelled = false;
    h.calls[1].resolve({ ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html', 'content-length': '12345' }), body: { async cancel() { cancelled = true; } } });
    await flush();
    assert.equal(h.api.downloadDetails({ url: h.media.src }).size, undefined);
    assert.match(h.rows()[0].children[6].textContent, /源地址返回了网页/);
    assert.equal(cancelled, true);
});

test('closing during HEAD prevents the fallback GET', async () => {
    const h = harness({ src: 'https://media.example/file.mp4' });
    h.api.openDownloadPanel();
    h.api.panel.close();
    h.calls[0].resolve({ ok: false, status: 405 });
    await flush();
    assert.equal(h.calls.length, 1);
    assert.equal(h.timers.size, 0);
});

test('closing during fallback cancels it and late metadata is discarded', async () => {
    const h = harness({ src: 'https://media.example/file.mp4' });
    h.api.openDownloadPanel();
    h.calls[0].resolve({ ok: false, status: 405 });
    await flush();
    h.api.panel.close();
    assert.equal(h.calls[1].options.signal.aborted, true);
    h.calls[1].resolve({ ok: true, status: 206, headers: new Headers({ 'content-range': 'bytes 0-0/12345' }) });
    await flush();
    assert.equal(h.api.downloadDetails({ url: h.media.src }).size, undefined);
    assert.equal(h.timers.size, 0);
});

test('closing the dialog cancels metadata probes and late responses cannot update the cache', async () => {
    const h = harness({ src: 'https://media.example/file.mp4' });
    h.api.openDownloadPanel();
    h.api.panel.close();
    assert.equal(h.calls[0].options.signal.aborted, true);
    h.calls[0].resolve({ ok: true, headers: new Headers({ 'content-length': '123456' }) });
    await flush();
    assert.equal(h.api.downloadDetails({ url: h.media.src }).size, undefined);
    h.api.openDownloadPanel();
    assert.equal(h.calls.length, 2);
    h.calls[1].resolve({ ok: true, headers: new Headers({ 'content-length': '42' }) });
    await flush();
    assert.equal(h.api.downloadDetails({ url: h.media.src }).size, 42);
});

test('metadata probes follow nested variant manifests and avoid cycles', async () => {
    const h = harness({ globals: { source: master } });
    h.api.openDownloadPanel();
    h.reply(0, '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nchild.m3u8');
    await flush();
    h.reply(1, '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nfinal.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nchild.m3u8');
    await flush();
    h.reply(2, '#EXTM3U\n#EXTINF:10,\nsegment.ts\n#EXT-X-ENDLIST');
    await flush();
    assert.equal(h.calls.length, 3);
    assert.equal(h.rows().length, 3);
    assert.equal(h.timers.size, 0);
    h.api.rememberDownloadResource(master);
    h.api.updateDownloadLinks();
    await flush();
    assert.equal(h.rows().length, 3, 'cached nested variants survive subsequent source discoveries');
    assert.equal(h.calls.length, 3);
});

test('unsupported HLS features use FFmpeg instead of silently saving corrupt or incomplete video', () => {
    const h = harness();
    for (const extra of ['#EXT-X-KEY:METHOD=AES-128,URI="key"', '#EXT-X-BYTERANGE:10@0', '#EXT-X-DISCONTINUITY', '#EXT-X-MAP:URI="one.mp4"\n#EXT-X-MAP:URI="two.mp4"']) {
        const manifest = h.api.parseDownloadManifest(`#EXTM3U\n${extra}\n#EXTINF:5,\n1.ts\n#EXT-X-ENDLIST`, master);
        assert.match(h.api.browserDownloadReason({ url: master }, { kind: 'hls-media', manifest }), /FFmpeg/);
    }
    const live = h.api.parseDownloadManifest('#EXTM3U\n#EXTINF:5,\n1.ts', master);
    assert.match(h.api.browserDownloadReason({ url: master }, { kind: 'hls-media', manifest: live }), /直播/);
});

test('FFmpeg command includes separate audio and safely quotes shell-sensitive filenames and URLs', () => {
    const h = harness();
    h.document.title = "video 'quote' $(echo unsafe)";
    const variants = h.api.parseDownloadPlaylist('#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=800000,AUDIO="audio"\nvideo.m3u8', master);
    assert.equal(variants[0].audioUrl, 'https://media.example/video/audio.m3u8');
    const command = h.api.videoDownloadCommand(variants[0]);
    assert.match(command, /ffmpeg -n /);
    assert.match(command, /-map 0:v:0 -map 1:a:0/);
    assert.ok(command.includes("'\\''quote'\\''"));
    assert.ok(command.includes('$(echo unsafe)'));
    assert.ok(command.includes("-referer 'https://missav.ws/cn/example'"));
    assert.equal(command.match(/-allowed_segment_extensions ALL/g).length, 2, 'both HLS inputs require their own options');
    assert.equal(command.match(/-extension_picky 0/g).length, 2);
});

test('FFmpeg 8 command allows disguised HLS segments before the input, including extensionless variants', () => {
    const h = harness();
    for (const entry of [{ url: master, label: '720P' }, { url: 'https://media.example/stream?token=1', label: '720P', kind: 'hls' }]) {
        const command = h.api.videoDownloadCommand(entry);
        assert.match(command, /^ffmpeg -n -f hls -allowed_extensions ALL -allowed_segment_extensions ALL -extension_picky 0 -referer /);
        assert.ok(command.indexOf('-allowed_segment_extensions') < command.indexOf(' -i '));
        assert.ok(command.includes(entry.url));
    }
});

test('direct MP4 and DASH commands do not force the HLS demuxer or its options', () => {
    const h = harness();
    for (const extension of ['mp4', 'mpd']) {
        const command = h.api.videoDownloadCommand({ url: `https://media.example/video.${extension}`, label: '视频' });
        assert.doesNotMatch(command, /-f hls|allowed_extensions|allowed_segment_extensions|extension_picky/);
        assert.match(command, /-c copy/);
    }
});

function fileWriterHarness(h) {
    const writes = [];
    let closed = false;
    let aborted = false;
    const names = [];
    h.window.showSaveFilePicker = async options => {
        names.push(options.suggestedName);
        return { createWritable: async () => ({
            write: async value => writes.push(...value),
            close: async () => { closed = true; },
            abort: async () => { aborted = true; },
        }) };
    };
    return { writes, names, get closed() { return closed; }, get aborted() { return aborted; } };
}

function videoResponse(bytes) {
    return { ok: true, headers: new Headers({ 'content-type': 'video/mp2t' }), body: new ReadableStream({ start(controller) { controller.enqueue(Uint8Array.from(bytes)); controller.close(); } }) };
}

test('chosen HLS video saves segments in order to a TS file only after clicking download', async () => {
    const h = harness({ globals: { source: master } });
    h.api.updateDownloadLinks();
    h.reply(0, '#EXTM3U\n#EXTINF:5,\n1.ts\n#EXTINF:5,\n2.ts\n#EXT-X-ENDLIST');
    await flush();
    const writer = fileWriterHarness(h);
    assert.equal(h.calls.length, 1);
    const pending = h.api.saveVideo({ url: master, label: '360P' });
    assert.equal(writer.names.length, 1, 'save picker must open in the click before network awaits');
    await flush();
    assert.equal(h.calls[1].url, 'https://media.example/video/1.ts');
    h.calls[1].resolve(videoResponse([0x47, 1, 2]));
    await flush();
    assert.equal(h.calls[2].url, 'https://media.example/video/2.ts');
    h.calls[2].resolve(videoResponse([0x47, 3, 4]));
    await pending;
    assert.deepEqual(writer.writes, [0x47, 1, 2, 0x47, 3, 4]);
    assert.equal(writer.closed, true);
    assert.equal(writer.aborted, false);
    assert.match(writer.names[0], /\.ts$/);
    assert.match(h.rows()[0].children[6].textContent, /已保存/);
    assert.equal(h.timers.size, 0);
});

test('browser download preserves playlist order for .jpeg and .jpg video segments', async () => {
    const h = harness({ globals: { source: master } });
    h.api.updateDownloadLinks();
    h.reply(0, '#EXTM3U\n#EXTINF:5,\nvideo10.jpeg?token=keep%2Bme\n#EXTINF:5,\nvideo2.jpg\n#EXT-X-ENDLIST');
    await flush();
    const writer = fileWriterHarness(h);
    const pending = h.api.saveVideo({ url: master, label: '720P' });
    await flush();
    assert.equal(h.calls[1].url, 'https://media.example/video/video10.jpeg?token=keep%2Bme');
    const first = videoResponse([0x47, 1, 2]);
    first.headers.set('content-type', 'image/jpeg');
    h.calls[1].resolve(first);
    await flush();
    assert.equal(h.calls[2].url, 'https://media.example/video/video2.jpg');
    h.calls[2].resolve(videoResponse([0x47, 3, 4]));
    await pending;
    assert.deepEqual(writer.writes, [0x47, 1, 2, 0x47, 3, 4]);
    assert.equal(writer.closed, true);
    assert.match(writer.names[0], /\.ts$/);
    assert.equal(h.api.rememberDownloadResource(h.calls[1].url), false);
});

test('fragmented MP4 saves initialization before media and does not list fetched fragments as videos', async () => {
    const h = harness({ globals: { source: master } });
    h.api.updateDownloadLinks();
    h.reply(0, '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:5,\npart.mp4\n#EXT-X-ENDLIST');
    await flush();
    const writer = fileWriterHarness(h);
    const pending = h.api.saveVideo({ url: master, label: '720P' });
    await flush();
    assert.match(h.calls[1].url, /init\.mp4$/);
    h.calls[1].resolve(videoResponse([1, 2]));
    await flush();
    assert.match(h.calls[2].url, /part\.mp4$/);
    h.calls[2].resolve(videoResponse([3, 4]));
    await pending;
    assert.deepEqual(writer.writes, [1, 2, 3, 4]);
    assert.match(writer.names[0], /\.mp4$/);
    assert.equal(h.api.rememberDownloadResource(h.calls[2].url), false);
});

test('a failed segment aborts the output file and never reports a successful download', async () => {
    const h = harness({ globals: { source: master } });
    h.api.updateDownloadLinks();
    h.reply(0, '#EXTM3U\n#EXTINF:5,\n1.ts\n#EXTINF:5,\n2.ts\n#EXT-X-ENDLIST');
    await flush();
    const writer = fileWriterHarness(h);
    const pending = h.api.saveVideo({ url: master, label: '360P' });
    await flush();
    h.calls[1].resolve(videoResponse([1, 2]));
    await flush();
    h.calls[2].resolve({ ok: false, status: 403 });
    await pending;
    assert.equal(writer.closed, false);
    assert.equal(writer.aborted, true);
    assert.match(h.rows()[0].children[6].textContent, /下载失败.*403/);
});

test('cancel download aborts the active fetch and discards the partial output', async () => {
    const h = harness({ src: 'https://media.example/movie.mp4' });
    h.api.updateDownloadLinks();
    const writer = fileWriterHarness(h);
    const pending = h.api.saveVideo({ url: h.media.src, label: 'MP4 视频' });
    await flush();
    h.calls[0].options.signal.addEventListener('abort', () => h.calls[0].reject(new DOMException('Aborted', 'AbortError')));
    h.rows()[0].children[5].children[2].events.click();
    await pending;
    assert.equal(writer.aborted, true);
    assert.equal(writer.closed, false);
    assert.match(h.rows()[0].children[6].textContent, /下载已取消/);
});


test('async sizes reorder existing rows descending with stable ties and unknown last', async () => {
    const urls = ['first', 'second', 'third', 'unknown'].map(name => `https://media.example/${name}.mp4`);
    const h = harness({ src: urls[0], sources: urls.slice(1) });
    h.api.openDownloadPanel();
    const originalRows = new Map(h.rows().map(row => [row.children[1].value, row]));
    const respond = (url, size) => h.calls.find(call => call.url === url).resolve({
        ok: true, status: 200, headers: new Headers({ 'content-length': String(size) }),
    });
    respond(urls[2], 900);
    await flush();
    assert.equal(h.rows()[0], originalRows.get(urls[2]));
    respond(urls[1], 900);
    respond(urls[0], 100);
    h.calls.find(call => call.url === urls[3]).reject(new Error('metadata unavailable'));
    await flush();
    assert.deepEqual(h.rows().map(row => row.children[1].value), [urls[1], urls[2], urls[0], urls[3]]);
    for (const [index, row] of h.rows().entries()) {
        assert.equal(row, originalRows.get(row.children[1].value));
        assert.ok(row.children[0].textContent.startsWith(`${index + 1}. `));
        assert.ok(row.children[1].attributes['aria-label'].startsWith(`${index + 1}. `));
    }
});

test('playlist boundary rejects non-text responses and invalid resolution bases explicitly', () => {
    const h = harness();
    assert.throws(() => h.api.parseDownloadPlaylist(null, master), /播放列表文本或基础地址无效/);
    assert.throws(() => h.api.parseDownloadManifest('#EXTM3U', 'javascript:alert(1)'), /播放列表文本或基础地址无效/);
});

test('a throwing page source getter is reported and does not hide remaining sources', () => {
    const globals = { source720: 'https://media.example/good.mp4' };
    Object.defineProperty(globals, 'source', { get() { throw new Error('getter failure'); } });
    const h = harness({ globals });
    const warnings = [];
    h.console.warn = (...args) => warnings.push(args);
    assert.equal(h.api.collectDownloadLinks()[0].url, globals.source720);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0][1], /source/);
});
