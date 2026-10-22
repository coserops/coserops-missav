// ==UserScript==
// @name         CoserOps MissAV 播放器脚本
// @namespace    coserops/missav
// @version      v20261022
// @updateURL    https://raw.githubusercontent.com/coserops/coserops-missav/main/missav-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/coserops/coserops-missav/main/missav-enhancer.user.js
// @homepageURL  https://github.com/coserops/coserops-missav
// @description  防失焦暂停、自动宽屏、自选界面语言和画质偏好
// @match        https://missav.ws/*
// @match        https://missav01.com/*
// @match        https://missav.live/*
// @match        https://missav.ai/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// ==/UserScript==

(() => {
    'use strict';

    const PREFIX = '[MissAV]';
    const state = { pause: '等待播放器', wide: '等待布局', language: '等待语言入口', quality: '等待视频' };
    let preferred = 360;
    let preferredLanguage = 'zh-Hans';
    const languageNames = {
        'zh-Hant': '繁體中文', 'zh-Hans': '简体中文', en: 'English', ja: '日本語',
        ko: '한국의', ms: 'Melayu', th: 'ไทย', de: 'Deutsch', fr: 'Français',
        vi: 'Tiếng Việt', id: 'Bahasa Indonesia', fil: 'Filipino', pt: 'Português',
    };
    const languagePath = /^\/(?:dm\d+\/)?(cn|en|ja|ko|ms|th|de|fr|vi|id|fil|pt|tw|zh)(?=\/|$)/;

    let languageSelect = null;
    let available = [];
    let player = null;
    let video = null;
    let originalPause = null;
    let wrappedPause = null;
    let source = '';
    let qualityApplied = false;
    let qualityRequest = null;
    let deadline = Date.now() + 15000;
    let styles = [];
    let wideColumn = null;
    let panel = null;
    let statusElement = null;
    let select = null;
    let timer = null;
    let languageDone = false;
    let languageAttempts = 0;
    let updateNotice = null;

    async function showUpdateNotice(manual = false) {
        if (updateNotice) return;
        try {
            const version = GM_info.script.version;
            const seen = await GM_getValue('lastAcknowledgedVersion', '');
            if (!manual && seen === version) return;
            if (updateNotice) return;
            const notice = document.createElement('section');
            notice.setAttribute('role', 'status');
            notice.setAttribute('aria-label', '脚本版本通知');
            notice.style.cssText = 'position:fixed;right:12px;bottom:20px;z-index:2147483646;box-sizing:border-box;width:min(360px,calc(100vw - 24px));max-height:60vh;overflow:auto;padding:20px;background:#18241d;color:#d9efde;border:1px solid #5c7764;border-radius:12px;box-shadow:0 6px 24px #0004;font:14px/1.6 system-ui,sans-serif';
            const title = document.createElement('strong');
            title.textContent = manual || !seen ? `脚本当前版本：${version}` : `脚本已更新到 ${version}`;
            const details = document.createElement('p');
            details.textContent = '本版新增自动更新配置和版本通知。后续更新由篡改猴按设置检查，更新后请刷新页面。';
            const link = document.createElement('a');
            link.href = 'https://github.com/coserops/coserops-missav#更新与通知';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = '查看更新说明';
            link.style.cssText = 'color:#c5e8c9;text-decoration:underline';
            const dismiss = document.createElement('button');
            dismiss.type = 'button';
            dismiss.textContent = '知道了';
            dismiss.style.cssText = 'margin-left:16px;padding:8px 14px;background:#c5e8c9;color:#17251b;border:0;border-radius:8px;font:inherit;cursor:pointer';
            dismiss.addEventListener('click', async () => {
                dismiss.disabled = true;
                try {
                    await GM_setValue('lastAcknowledgedVersion', version);
                    notice.remove();
                    updateNotice = null;
                } catch (error) {
                    console.warn(PREFIX, '版本通知保存失败', error);
                    details.textContent = '无法保存已读状态，请重试；刷新页面后可能再次提示。';
                    dismiss.disabled = false;
                }
            });
            notice.append(title, details, link, dismiss);
            document.body.append(notice);
            updateNotice = notice;
        } catch (error) {
            console.warn(PREFIX, '版本通知读取失败，可通过项目主页查看更新说明', error);
        }
    }

    function report(key, text, error) {
        if (state[key] !== text) {
            state[key] = text;
            if (error) console.warn(PREFIX, key, text, error);
            renderStatus();
        }
    }

    function renderStatus() {
        if (!statusElement) return;
        for (const [key, text] of Object.entries(state)) {
            const row = statusElement.querySelector(`[data-status="${key}"]`);
            if (!row || row.textContent === text) continue;
            row.textContent = text;
        }
        const hint = panel.querySelector('[data-quality-hint]');
        hint.textContent = available.length ? `当前可选：${available.map(n => `${n}P`).join(' / ')}` : '视频加载后显示可用画质，默认 360P';
    }

    function updateOptions() {
        if (!select) return;
        const chosen = Number(select.value) || preferred;
        select.replaceChildren();
        for (const height of [...new Set([360, preferred, chosen, ...available])].sort((a, b) => a - b)) {
            const option = document.createElement('option');
            option.value = String(height);
            option.textContent = `${height}P${available.length && !available.includes(height) ? '（当前不可用）' : ''}`;
            select.append(option);
        }
        select.value = String(chosen);
    }

    function openSettings() {
        if (!panel) {
            const sheet = document.createElement('style');
            sheet.textContent = `
                #coserops-settings { color-scheme: dark; width: min(560px, calc(100vw - 32px)); max-width: none; max-height: calc(100dvh - 32px); margin: auto; padding: 0; border: 1px solid #394253; border-radius: 20px; background: #151a24; color: #f1f5f9; box-shadow: 0 24px 100px #0009; font: 14px/1.6 system-ui, sans-serif; overflow: auto; }
                #coserops-settings::backdrop { background: #080b13b8; backdrop-filter: blur(5px); }
                #coserops-settings * { box-sizing: border-box; }
                #coserops-settings h2, #coserops-settings p { margin: 0; }
                #coserops-settings .co-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 26px 28px 20px; border-bottom: 1px solid #303847; }
                #coserops-settings .co-brand { color: #a5b4fc; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
                #coserops-settings h2 { font-size: 23px; font-weight: 700; color: #f8fafc; margin: 4px 0; }
                #coserops-settings .co-muted { color: #a9b4c7; font-size: 12px; }
                #coserops-settings .co-body { padding: 24px 28px; }
                #coserops-settings .co-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
                #coserops-settings label { display: block; font-size: 13px; font-weight: 600; color: #e2e8f0; }
                #coserops-settings select { display: block; width: 100%; min-height: 46px; margin: 8px 0; padding: 10px 12px; border: 1px solid #465168; border-radius: 10px; background: #202838; color: #f8fafc; font: inherit; cursor: pointer; appearance: auto; }
                #coserops-settings .co-status { display: grid; gap: 14px; padding: 18px; margin-top: 24px; border: 1px solid #303b4e; border-radius: 12px; background: #101620; }
                #coserops-settings .co-status-row { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 12px; font-size: 12px; }
                #coserops-settings .co-status-row span:first-child { color: #a9b4c7; }
                #coserops-settings [data-status] { color: #d5ddec; overflow-wrap: anywhere; }
                #coserops-settings .co-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 28px; border-top: 1px solid #303847; background: #121721; }
                #coserops-settings button { border: 1px solid transparent; border-radius: 9px; padding: 10px 16px; background: transparent; color: #c4cede; font: inherit; font-weight: 600; cursor: pointer; transition: background .15s; }
                #coserops-settings button:hover { background: #2a3446; color: #fff; }
                #coserops-settings button.co-primary { background: #a5b4fc; color: #171b35; }
                #coserops-settings button.co-primary:hover { background: #c7d2fe; }
                #coserops-settings button.co-close { padding: 4px 10px; font-size: 24px; line-height: 1.3; }
                #coserops-settings button:disabled { opacity: .55; cursor: wait; }
                #coserops-settings :focus-visible { outline: 2px solid #c7d2fe; outline-offset: 3px; }
                @media (max-width: 480px) {
                    #coserops-settings .co-header, #coserops-settings .co-body { padding: 20px; }
                    #coserops-settings .co-fields { grid-template-columns: 1fr; gap: 16px; }
                    #coserops-settings .co-footer { padding: 16px 20px; }
                    #coserops-settings .co-status-row { grid-template-columns: 76px minmax(0, 1fr); gap: 8px; }
                }
                #coserops-settings { --co-accent: #c5e8c9; background: #141916; border-color: #39463c; border-radius: 24px; width: min(620px, calc(100vw - 32px)); }
                #coserops-settings[open] { animation: coserops-enter 220ms cubic-bezier(.2,.8,.2,1); }
                #coserops-settings::backdrop { background: #080e0bbb; backdrop-filter: blur(8px); }
                #coserops-settings .co-header { padding: 32px 32px 26px; border-color: #344038; background: radial-gradient(ellipse at top left, #283d2c88, transparent 75%); }
                #coserops-settings .co-brand { color: var(--co-accent); font-size: 10px; letter-spacing: 2.5px; }
                #coserops-settings h2 { font-size: clamp(26px, 5vw, 34px); line-height: 1.3; letter-spacing: -.8px; margin: 12px 0 10px; }
                #coserops-settings .co-muted { color: #aebbb1; line-height: 1.7; font-weight: 400; }
                #coserops-settings .co-body { padding: 28px 32px; }
                #coserops-settings .co-fields { gap: 16px; }
                #coserops-settings .co-fields > div { min-width: 0; padding: 18px; border: 1px solid #36433a; border-radius: 14px; background: #1b231e; transition: border-color 160ms; }
                #coserops-settings .co-fields > div:focus-within { border-color: #a2c3a8; }
                #coserops-settings label { color: #d8e4db; font-weight: 500; }
                #coserops-settings label::before { display: block; color: #a4b6a8; font: 10px/1.4 ui-monospace, monospace; letter-spacing: 1.5px; margin-bottom: 12px; }
                #coserops-settings label[for="coserops-quality"]::before { content: '01 / QUALITY'; }
                #coserops-settings label[for="coserops-language"]::before { content: '02 / LANGUAGE'; }
                #coserops-settings select { background: #121a15; border-color: #4a5a4e; color: #f1f6f2; margin: 12px 0; min-height: 48px; font-size: 15px; }
                #coserops-settings .co-status { background: transparent; border: 0; border-top: 1px solid #344038; border-radius: 0; margin-top: 28px; padding: 22px 0 0; gap: 16px; }
                #coserops-settings .co-status-title { font-size: 11px; letter-spacing: 1px; color: #b8c9bc; font-weight: 600; }
                #coserops-settings .co-status-row { grid-template-columns: 100px minmax(0,1fr); }
                #coserops-settings .co-status-row span:first-child { color: #aebbb1; }
                #coserops-settings [data-status] { color: #e0e9e2; }
                #coserops-settings .co-footer { flex-wrap: wrap; padding: 20px 32px; border-color: #344038; background: #101612; }
                #coserops-settings .co-feedback { flex: 1 0 100%; font-size: 12px; color: #b8c9bc; min-height: 20px; }
                #coserops-settings button { min-height: 44px; color: #cad8cd; transition: background 160ms, transform 160ms; }
                #coserops-settings button:hover { background: #2c3a30; }
                #coserops-settings button:active:not(:disabled) { transform: translateY(1px); }
                #coserops-settings button.co-primary { background: var(--co-accent); color: #17251b; padding-inline: 24px; }
                #coserops-settings button.co-primary:hover { background: #def4e1; }
                #coserops-settings button.co-close { width: 44px; flex-shrink: 0; border: 1px solid #415046; border-radius: 50%; }
                #coserops-settings :focus-visible { outline-color: var(--co-accent); }
                @keyframes coserops-enter { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
                @media (max-width: 480px) {
                    #coserops-settings { width: calc(100vw - 20px); max-height: calc(100dvh - 20px); border-radius: 18px; }
                    #coserops-settings .co-header, #coserops-settings .co-body { padding: 22px; }
                    #coserops-settings .co-fields > div { padding: 16px; }
                    #coserops-settings .co-footer { padding: 18px 22px; }
                }
                @media (prefers-reduced-motion: reduce) { #coserops-settings[open] { animation: none; } #coserops-settings button, #coserops-settings .co-fields > div { transition: none; } }
                @media (forced-colors: active) { #coserops-settings, #coserops-settings button, #coserops-settings select { border: 1px solid ButtonText; } }

            `;
            document.head.append(sheet);
            panel = document.createElement('dialog');
            panel.id = 'coserops-settings';
            panel.setAttribute('aria-labelledby', 'coserops-settings-title');
            panel.innerHTML = `
                <header class="co-header">
                    <div><p class="co-brand">COSEROPS / MISSAV</p><h2 id="coserops-settings-title">播放偏好</h2><p class="co-muted">按你的习惯播放，设置自动保留。</p></div>
                    <button class="co-close" type="button" aria-label="关闭设置">×</button>
                </header>
                <div class="co-body">
                    <div class="co-fields">
                        <div><label for="coserops-quality">优先画质</label><select id="coserops-quality" aria-describedby="coserops-quality-hint"></select><p class="co-muted" id="coserops-quality-hint" data-quality-hint></p></div>
                        <div><label for="coserops-language">界面语言</label><select id="coserops-language"></select><p class="co-muted">保存后切换，之后自动沿用（约耗时5秒）</p></div>
                    </div>
                    <section class="co-status" aria-label="运行状态" aria-live="polite">
                        <h3 class="co-status-title" style="margin:0">运行状态 / STATUS</h3>
                        <div class="co-status-row"><span>防失焦暂停</span><span data-status="pause"></span></div>
                        <div class="co-status-row"><span>自动宽屏</span><span data-status="wide"></span></div>
                        <div class="co-status-row"><span>语言状态</span><span data-status="language"></span></div>
                        <div class="co-status-row"><span>画质状态</span><span data-status="quality"></span></div>
                    </section>
                </div>
                <footer class="co-footer"><p class="co-feedback" role="status">偏好仅保存在当前浏览器</p><button type="button" data-reset>恢复默认</button><button type="button" class="co-primary" data-save>保存并应用</button></footer>`;
            select = panel.querySelector('#coserops-quality');
            languageSelect = panel.querySelector('#coserops-language');
            statusElement = panel.querySelector('.co-status');
            panel.querySelector('.co-close').addEventListener('click', () => panel.close());
            const saveButton = panel.querySelector('[data-save]');
            const resetButton = panel.querySelector('[data-reset]');
            const feedback = panel.querySelector('.co-feedback');
            for (const field of [select, languageSelect]) {
                field.addEventListener('change', () => {
                    feedback.textContent = Number(select.value) !== preferred || languageSelect.value !== preferredLanguage
                        ? '有未保存的更改' : '已与保存的偏好一致';
                });
            }
            async function submit(reset) {
                const quality = reset ? 360 : Number(select.value);
                const language = reset ? 'zh-Hans' : languageSelect.value;
                saveButton.disabled = resetButton.disabled = select.disabled = languageSelect.disabled = true;
                saveButton.textContent = '正在保存…';
                try {
                    feedback.textContent = '正在保存偏好…';
                    const saved = await saveSettings(quality, language);
                    feedback.textContent = saved ? '偏好已保存 · 应用结果见运行状态' : '未能完整保存，请查看运行状态';
                } finally {
                    saveButton.disabled = resetButton.disabled = select.disabled = languageSelect.disabled = false;
                    saveButton.textContent = '保存并应用';
                }
            }
            saveButton.addEventListener('click', () => submit(false));
            resetButton.addEventListener('click', () => submit(true));
            document.body.append(panel);
        }
        if (panel.open) return;
        updateOptions();
        languageSelect.replaceChildren();
        const languages = Object.keys(languageNames);
        for (const language of languages) {
            const option = document.createElement('option');
            option.value = language;
            option.textContent = languageNames[language] || language;
            languageSelect.append(option);
        }
        languageSelect.value = preferredLanguage;
        select.value = String(preferred);
        panel.querySelector('.co-feedback').textContent = '偏好仅保存在当前浏览器';
        renderStatus();
        if (!panel.open) panel.showModal();
    }

    async function saveSettings(quality, language) {
        if (!Number.isSafeInteger(quality) || quality <= 0 || !Object.hasOwn(languageNames, language)) {
            report('language', '保存失败：无效设置', new Error('Invalid settings'));
            return;
        }
        try {
            await GM_setValue('preferredLanguage', language);
            preferredLanguage = language;
            languageSelect.value = language;
            languageDone = false;
            languageAttempts = 0;
            // An explicit save permits another attempt; automatic redirects remain guarded.
            sessionStorage.removeItem(`missav-language:${location.pathname}:${language}`);
        } catch (error) {
            report('language', '语言保存或跳转状态更新失败，请检查控制台', error);
            return;
        }
        if (!(await savePreference(quality))) return false;
        // Reset after awaited writes so initialization cannot consume this manual request.
        languageDone = false;
        languageAttempts = 0;
        applyLanguage(true);
        return true;
    }

    async function savePreference(value) {
        if (!Number.isSafeInteger(value) || value <= 0) {
            report('quality', '保存失败：请选择有效画质', new Error('Invalid quality'));
            return;
        }
        try {
            await GM_setValue('preferredQuality', value);
            preferred = value;
            select.value = String(value);
            cancelQualityRequest();
            qualityApplied = false;
            deadline = Date.now() + 15000;
            report('quality', '已保存，等待应用');
            inspect();
            return true;
        } catch (error) {
            report('quality', '保存失败，请检查控制台', error);
            return false;
        }
    }

    function restoreWidth() {
        for (const { element, property, value, priority, applied } of styles) {
            if (element.style.getPropertyValue(property) !== applied || element.style.getPropertyPriority(property) !== 'important') continue;
            if (value) element.style.setProperty(property, value, priority);
            else element.style.removeProperty(property);
        }
        styles = [];
        wideColumn = null;
    }

    function setStyle(element, property, applied) {
        styles.push({ element, property, applied, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) });
        element.style.setProperty(property, applied, 'important');
    }

    function applyWidth() {
        const column = video?.closest('.plyr')?.closest('.flex-1.order-first');
        if (!column?.parentElement || column === wideColumn) return;
        restoreWidth();
        const rect = column.getBoundingClientRect();
        if (!rect.width) return;
        const siblings = [...column.parentElement.children].map(element => ({ element, rect: element.getBoundingClientRect() }));
        for (const sibling of siblings) {
            if (sibling.element !== column && sibling.rect.left >= rect.right - 10 && sibling.rect.width > 100) setStyle(sibling.element, 'display', 'none');
        }
        setStyle(column, 'flex', '1 1 100%');
        setStyle(column, 'width', '100%');
        setStyle(column, 'max-width', 'none');
        wideColumn = column;
        report('wide', '已应用，保留下方内容');
    }

    function unpatch() {
        if (player && wrappedPause && player.pause === wrappedPause) player.pause = originalPause;
        originalPause = null;
        wrappedPause = null;
    }

    function bindPlayer(next) {
        if (player === next) return;
        unpatch();
        cancelQualityRequest();
        player = next;
        qualityApplied = false;
        deadline = Date.now() + 15000;
        if (!player || typeof player.pause !== 'function') {
            report('pause', '未找到可适配的播放器');
            return;
        }
        originalPause = player.pause;
        const saved = originalPause;
        wrappedPause = function (...args) {
            if (!document.hasFocus()) return;
            return Reflect.apply(saved, this, args);
        };
        try {
            player.pause = wrappedPause;
            if (player.pause !== wrappedPause) throw new Error('Player pause method is not writable');
            report('pause', '已挂接；有焦点时允许手动暂停');
        } catch (error) {
            report('pause', '挂接失败，请检查控制台', error);
        }
    }

    function cancelQualityRequest() {
        if (qualityRequest) clearTimeout(qualityRequest.timer);
        qualityRequest = null;
    }

    function qualityEvidence(target) {
        if (Number(player.quality) === target) return '已选择';
        const selected = video.closest('.plyr')?.querySelector('[data-plyr="quality"][aria-checked="true"]');
        if (Number(selected?.getAttribute('value')) === target) return '已选择';
        if (video.readyState >= 2 && video.videoHeight === target) return '当前播放';
        return null;
    }

    function applyQuality() {
        if (!player || !video || qualityApplied || qualityRequest) return;
        const options = player.options?.quality;
        available = Array.isArray(options) ? [...new Set(options.map(Number).filter(n => Number.isSafeInteger(n) && n > 0))].sort((a, b) => a - b) : [];
        updateOptions();
        if (!available.length || !('quality' in player)) {
            if (Date.now() >= deadline) report('quality', '未识别可设置的画质接口；保留网站当前模式');
            return;
        }
        const lower = available.filter(n => n <= preferred);
        const target = lower.length ? lower[lower.length - 1] : available[0];
        const request = { player, video, target, expires: Date.now() + 10000, timer: null };
        qualityRequest = request;
        const confirm = () => {
            if (qualityRequest !== request || player !== request.player || video !== request.video) return;
            try {
                const evidence = qualityEvidence(target);
                if (evidence) {
                    cancelQualityRequest();
                    qualityApplied = true;
                    report('quality', `${target === preferred ? '' : `目标 ${preferred}P 不可用，`}${evidence} ${target}P`);
                    return;
                }
                if (Date.now() >= request.expires) {
                    cancelQualityRequest();
                    qualityApplied = true;
                    report('quality', `已请求 ${target}P，但结果未确认；可保存后重试`, new Error('Quality confirmation timed out'));
                    return;
                }
                request.timer = setTimeout(confirm, 250);
            } catch (error) {
                cancelQualityRequest();
                qualityApplied = true;
                report('quality', '无法读取画质状态；可保存后重试', error);
            }
        };
        try {
            if (!qualityEvidence(target)) {
                report('quality', `正在设置 ${target}P，等待播放器确认`);
                player.quality = target;
            }
            confirm();
        } catch (error) {
            cancelQualityRequest();
            qualityApplied = true;
            report('quality', '设置失败；已停止重试，可保存后重试', error);
        }
    }

    function normalizeLanguage(tag) {
        const value = String(tag || '').toLowerCase().replaceAll('_', '-');
        if (/^en(?:-|$)/.test(value)) return 'en';
        if (/^ja(?:-|$)/.test(value)) return 'ja';
        if (value === 'tw') return 'zh-Hant';
        if (value === 'cn') return 'zh-Hans';
        if (/^zh(?:-|$)/.test(value)) {
            if (value.includes('-hant')) return 'zh-Hant';
            if (value.includes('-hans')) return 'zh-Hans';
            if (/-(tw|hk|mo)(?:-|$)/.test(value)) return 'zh-Hant';
            return /-(cn|sg)(?:-|$)/.test(value) ? 'zh-Hans' : 'zh';
        }
        return value.split('-')[0];
    }

    function contentPath(url) {
        return url.pathname.replace(/^\/dm\d+(?=\/|$)/, '').replace(/^\/(cn|en|ja|ko|ms|th|de|fr|vi|id|fil|pt|tw|zh)(?=\/|$)/, '').replace(/\/$/, '');
    }

    function languageCandidates() {
        const current = new URL(location.href);
        const candidates = [];
        for (const link of document.querySelectorAll('a[hreflang], link[rel="alternate"][hreflang], a[href]')) {
            const href = link.getAttribute('href');
            if (!href) continue;
            let url;
            try { url = new URL(href, current); } catch { continue; }
            if (url.origin !== current.origin) continue;
            const text = link.textContent.trim();
            const namedLanguage = Object.keys(languageNames).find(language => languageNames[language] === text);
            // This menu entry delegates content-preserving navigation to the website.
            if (namedLanguage === 'zh-Hant' && link.getAttribute('@click.prevent') === 'redirectToBaseLocalizedUrl') {
                candidates.push({ url, language: 'zh-Hant', action: link });
                continue;
            }
            if (contentPath(url) !== contentPath(current)) continue;
            const explicit = link.getAttribute('hreflang');
            const tag = namedLanguage || explicit || (url.pathname.match(languagePath)?.[1] || '');
            if (tag) {
                let language = normalizeLanguage(tag);
                if (language === 'zh' && /^\/(?:dm\d+\/)?cn(?:\/|$)/.test(url.pathname)) language = 'zh-Hans';
                if (Object.hasOwn(languageNames, language)) candidates.push({ url, language });
            }
        }
        return candidates;
    }

    function applyLanguage(manual = false) {
        if (languageDone || languageAttempts >= 2) return;
        languageAttempts++;
        const current = new URL(location.href);
        const routeLanguage = current.pathname.match(languagePath)?.[1];
        const currentLanguage = normalizeLanguage(document.documentElement.lang);
        const resolvedLanguage = (!currentLanguage || currentLanguage === 'zh') ? normalizeLanguage(routeLanguage) : currentLanguage;
        const name = languageNames[preferredLanguage] || preferredLanguage;
        const candidates = languageCandidates();
        const target = candidates.find(c => c.language === preferredLanguage);
        const differentTarget = target && (target.action || target.url.href !== current.href);
        if (resolvedLanguage === preferredLanguage && !(manual && differentTarget)) {
            report('language', `已是${name}`);
            languageDone = true;
            return;
        }
        if (!target) {
            report('language', `未找到保持当前内容的${name}链接；已保存偏好，保留当前页面`);
            return;
        }
        if (!target.action && target.url.href === current.href) {
            report('language', `${name}入口指向当前页，但页面语言未确认`);
            languageDone = true;
            return;
        }
        const key = `missav-language:${current.pathname}:${target.language}`;
        try {
            if (sessionStorage.getItem(key)) {
                report('language', '已尝试切换，停止重复跳转');
                languageDone = true;
                return;
            }
            sessionStorage.setItem(key, '1');
        } catch (error) {
            report('language', '无法记录跳转状态，停止自动切换', error);
            languageDone = true;
            return;
        }
        for (const [key, value] of current.searchParams) {
            if (!target.url.searchParams.has(key) && key !== 'localized') target.url.searchParams.append(key, value);
        }
        if (!target.url.hash) target.url.hash = current.hash;
        languageDone = true;
        report('language', `正在切换至${name}`);
        if (target.action) {
            target.action.click();
            setTimeout(() => {
                report('language', '已调用网站语言切换；若页面未跳转，请使用网站菜单重试');
            }, 3000);
        } else {
            location.replace(target.url.href);
        }
    }

    function resetSource() {
        // Switching quality can reload the same video; keep its pending confirmation.
        if (qualityRequest?.video === video && qualityRequest?.player === player) {
            schedule();
            return;
        }
        qualityApplied = false;
        available = [];
        deadline = Date.now() + 15000;
        report('quality', '等待视频画质列表');
        schedule();
    }

    function inspect() {
        const nextVideo = document.querySelector('video.player') || document.querySelector('.plyr video');
        if (nextVideo !== video) {
            cancelQualityRequest();
            if (video) for (const event of ['loadstart', 'loadedmetadata']) video.removeEventListener(event, resetSource);
            restoreWidth();
            video = nextVideo;
            if (video) for (const event of ['loadstart', 'loadedmetadata']) video.addEventListener(event, resetSource);
            resetSource();
        }
        const candidate = unsafeWindow.player;
        bindPlayer(video && candidate && (!candidate.media || candidate.media === video) ? candidate : null);
        const nextSource = video?.currentSrc || video?.src || '';
        if (source !== nextSource) {
            source = nextSource;
            resetSource();
        }
        if (!video) {
            report('pause', '当前页面无播放器，无需处理');
            report('wide', '当前页面无播放器，无需处理');
            report('quality', '偏好已保存，将在视频加载后应用');
            return;
        }
        applyWidth();
        applyQuality();
        if (Date.now() >= deadline) {
            if (!video) report('quality', '未发现视频；偏好将在视频加载后应用');
            if (!wideColumn) report('wide', '未找到参考布局，未修改页面');
        }
    }

    function schedule() {
        if (timer !== null) return;
        timer = setTimeout(() => { timer = null; inspect(); }, 250);
    }

    async function start() {
        try {
            const saved = await GM_getValue('preferredQuality', 360);
            if (!Number.isSafeInteger(saved) || saved <= 0) throw new Error('Invalid stored quality');
            preferred = saved;
        } catch (error) {
            console.warn(PREFIX, '配置读取异常，使用 360P', error);
            report('quality', '配置读取异常，使用 360P；可在设置中重新保存');
        }
        try {
            const savedLanguage = await GM_getValue('preferredLanguage', 'zh-Hans');
            if (typeof savedLanguage !== 'string' || !Object.hasOwn(languageNames, savedLanguage)) throw new Error('Invalid stored language');
            preferredLanguage = savedLanguage;
        } catch (error) {
            report('language', '语言配置读取异常，使用简体中文', error);
        }
        GM_registerMenuCommand('设置', openSettings);
        GM_registerMenuCommand('当前版本 / 更新说明', () => showUpdateNotice(true));
        void showUpdateNotice();
        const button = document.createElement('button');
        button.textContent = 'CoserOps MissAV\n播放器脚本设置';
        button.style.cssText = 'position:fixed;right:12px;top:80px;z-index:2147483646;padding:8px;white-space:pre;text-align:center;line-height:1.5;background:#18241d;color:#d9efde;border:1px solid #5c7764;border-radius:12px;box-shadow:0 6px 24px #0004;font:500 12px/1.6 system-ui,sans-serif;cursor:pointer;min-height:48px';
        button.addEventListener('click', openSettings);
        document.body.append(button);
        applyLanguage();
        inspect();
        const observer = new MutationObserver(records => {
            if (records.some(record => !panel?.contains(record.target) && record.target !== button)) schedule();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => { restoreWidth(); schedule(); }, 200);
        });
        const poll = setInterval(() => {
            inspect();
            if (Date.now() >= deadline) clearInterval(poll);
        }, 1000);
        setTimeout(applyLanguage, 3000);
    }

    start().catch(error => console.error(PREFIX, '初始化失败', error));
})();
