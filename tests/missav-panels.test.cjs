const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { join } = require('node:path');

const script = readFileSync(join(__dirname, '../missav-enhancer.user.js'), 'utf8');
const start = script.indexOf('    const PANEL_STYLES');
const end = script.indexOf('    /**', script.indexOf('    const DOWNLOAD_MARKUP'));
const panels = runInNewContext(`${script.slice(start, end)}; ({ SETTINGS_MARKUP, DOWNLOAD_MARKUP, SETTINGS_STYLES, DOWNLOAD_STYLES })`);

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

test('each independently injected stylesheet includes motion, contrast and short-screen safeguards', () => {
    for (const styles of [panels.SETTINGS_STYLES, panels.DOWNLOAD_STYLES]) {
        for (const rule of ['prefers-reduced-motion: reduce', 'forced-colors: active', ':focus-visible', 'max-height: 500px', '100dvh', 'overscroll-behavior: contain']) {
            assert.ok(styles.includes(rule), rule);
        }
        assert.doesNotMatch(styles, /https?:\/\//);
    }
});
