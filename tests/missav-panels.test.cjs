const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { join } = require('node:path');

const script = readFileSync(join(__dirname, '../missav-enhancer.user.js'), 'utf8');
const start = script.indexOf('    const PANEL_STYLES');
const end = script.indexOf('    /**', script.indexOf('    const DOWNLOAD_MARKUP'));
const panels = runInNewContext(`${script.slice(start, end)}; ({ PANEL_STYLES, SETTINGS_MARKUP, DOWNLOAD_MARKUP, SETTINGS_STYLES, DOWNLOAD_STYLES })`);

test('settings redesign preserves labelled fields, status regions and save/reset hooks', () => {
    const markup = panels.SETTINGS_MARKUP;
    for (const id of ['quality', 'language']) {
        assert.match(markup, new RegExp(`label for="coserops-${id}"`));
        assert.match(markup, new RegExp(`select id="coserops-${id}"`));
    }
    for (const hook of ['data-reset', 'data-save', 'data-quality-hint', 'role="status"', 'aria-live="polite"', 'aria-label="关闭设置"']) {
        assert.ok(markup.includes(hook), hook);
    }
    assert.equal((markup.match(/class="co-field-index" aria-hidden="true"/g) || []).length, 2);
});

test('download redesign retains controls, live status and sorting explanation', () => {
    for (const hook of ['data-download-refresh', 'data-download-close', 'data-download-status', 'data-download-list', 'role="status"', 'aria-label="关闭视频下载弹窗"']) {
        assert.ok(panels.DOWNLOAD_MARKUP.includes(hook), hook);
    }
    assert.match(panels.DOWNLOAD_MARKUP, /从大到小排列，大小未知的排在最后/);
});

test('shared panel stylesheet includes motion, contrast and short-screen safeguards', () => {
    for (const styles of [panels.PANEL_STYLES]) {
        for (const rule of ['prefers-reduced-motion: reduce', 'forced-colors: active', ':focus-visible', 'max-height: 500px', '100dvh', 'overscroll-behavior: contain']) {
            assert.ok(styles.includes(rule), rule);
        }
        assert.doesNotMatch(styles, /https?:\/\//);
    }
});


test('all surfaces use the original embedded logo and shared brand tokens without external requests', () => {
    const logo = readFileSync(join(__dirname, '../logo.png')).toString('base64');
    for (const styles of [panels.PANEL_STYLES]) {
        assert.ok(styles.includes(`data:image/png;base64,${logo}`));
        for (const token of ['--co-accent: #c7e76b', '--co-brand-blue: #0c3345', '--co-muted: #a9bec5']) {
            assert.ok(styles.includes(token), token);
        }
        for (const id of ['settings-button', 'download-button', 'update-notice']) {
            assert.ok(styles.includes(`#coserops-${id}`), id);
        }
        assert.ok(styles.includes('env(safe-area-inset-right)'));
        assert.doesNotMatch(styles, /#c5e8c9|#141c18|#18241d/);
    }
});

test('brand text, muted text and primary actions meet WCAG AA normal-text contrast', () => {
    function luminance(hex) {
        const rgb = hex.match(/\w\w/g).map(value => parseInt(value, 16) / 255)
            .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    }
    const colors = Object.fromEntries([...panels.PANEL_STYLES.matchAll(/--co-([a-z-]+): #([0-9a-f]{6})/g)].map(([, name, hex]) => [name, hex]));
    for (const [foreground, background] of [['accent', 'brand-blue'], ['accent', 'surface'], ['muted', 'surface'], ['muted', 'bg'], ['text', 'bg'], ['text', 'surface'], ['brand-blue', 'accent']]) {
        assert.ok(colors[foreground] && colors[background], 'brand tokens must exist');
        const values = [luminance(colors[foreground]), luminance(colors[background])].sort((a, b) => b - a);
        assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${foreground} on ${background}`);
    }
});


test('panel-specific styles do not duplicate the shared theme or reset another panel width', () => {
    for (const styles of [panels.SETTINGS_STYLES, panels.DOWNLOAD_STYLES]) {
        assert.doesNotMatch(styles, /data:image|--co-accent:|:is\(#coserops-settings, #coserops-downloads\)/);
    }
});


test('both panels expose a labelled author contact without replacing existing controls', () => {
    for (const markup of [panels.SETTINGS_MARKUP, panels.DOWNLOAD_MARKUP]) {
        const links = markup.match(/<a class="co-contact"[^>]*>[\s\S]*?<\/a>/g) || [];
        assert.equal(links.length, 1);
        assert.match(links[0], /href="https:\/\/x\.com\/coserops"/);
        assert.match(links[0], /target="_blank"/);
        assert.match(links[0], /rel="noopener noreferrer"/);
        assert.match(links[0], /aria-label="联系作者：X @coserops（在新标签页打开）"/);
        assert.match(links[0], /联系作者 · X @coserops/);
    }
});


test('panel hierarchy keeps contact in footers and refresh beside the download status', () => {
    for (const markup of [panels.SETTINGS_MARKUP, panels.DOWNLOAD_MARKUP]) {
        const header = markup.match(/<header[^>]*>([\s\S]*?)<\/header>/)[1];
        const footer = markup.match(/<footer[^>]*>([\s\S]*?)<\/footer>/)[1];
        assert.doesNotMatch(header, /co-contact|data-download-refresh/);
        assert.match(header, /class="co-close"/);
        assert.match(footer, /co-contact/);
        assert.equal((markup.match(/<h2 /g) || []).length, 1);
    }
    assert.match(panels.DOWNLOAD_MARKUP, /class="co-download-toolbar"[\s\S]*data-download-status[\s\S]*data-download-refresh/);
    assert.match(panels.DOWNLOAD_MARKUP, /关闭面板不会中断已开始的下载/);
    assert.match(panels.SETTINGS_MARKUP, /class="co-footer-actions"[\s\S]*data-reset[\s\S]*data-save/);
});

test('responsive styling protects safe areas, scrollable content and reduced-motion feedback', () => {
    for (const edge of ['top', 'right', 'bottom', 'left']) {
        assert.ok(panels.PANEL_STYLES.includes(`env(safe-area-inset-${edge})`));
    }
    assert.match(panels.PANEL_STYLES, /#coserops-update-notice \{ animation: none; \}/);
    assert.match(panels.PANEL_STYLES, /button:active:not\(:disabled\) \{ transform: none; \}/);
    assert.match(panels.SETTINGS_STYLES, /select:disabled/);
    assert.match(panels.SETTINGS_STYLES, /co-footer-actions \{ grid-column: 1; grid-row: 2;/);
    assert.match(panels.DOWNLOAD_STYLES, /co-download-row:focus-within/);
    assert.doesNotMatch(panels.DOWNLOAD_STYLES, /#coserops-downloads a \{/);
});
