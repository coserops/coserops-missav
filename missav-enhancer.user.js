// ==UserScript==
// @name         CoserOps MissAV 播放器脚本
// @name:zh-TW   CoserOps MissAV 播放器腳本
// @name:en      CoserOps MissAV Player Enhancer
// @name:ja       CoserOps MissAV プレイヤー拡張
// @name:ko       CoserOps MissAV 플레이어 확장
// @name:ms       CoserOps MissAV Penambah Baik Pemain Video
// @name:th       CoserOps MissAV ส่วนเสริมเครื่องเล่นวิดีโอ
// @name:de       CoserOps MissAV Player-Erweiterung
// @name:fr       CoserOps MissAV Amélioration du lecteur
// @name:vi       CoserOps MissAV Tiện ích nâng cao trình phát
// @name:id       CoserOps MissAV Peningkatan Pemutar Video
// @name:fil      CoserOps MissAV Dagdag na Tampok sa Player
// @name:pt       CoserOps MissAV Melhorias do reprodutor
// @name:ru       CoserOps MissAV Улучшение плеера
// @name:es       CoserOps MissAV Mejoras del reproductor
// @name:it       CoserOps MissAV Miglioramenti del lettore
// @namespace    coserops/missav
// @version      v20261023.2341
// @updateURL    https://raw.githubusercontent.com/coserops/coserops-missav/main/missav-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/coserops/coserops-missav/main/missav-enhancer.user.js
// @homepageURL  https://github.com/coserops/coserops-missav
// @description  防失焦暂停、自动宽屏、自选界面语言和画质偏好、提取视频下载链接
// @description:zh-TW 防止失去焦點時暫停、自動寬螢幕、自選介面語言與畫質偏好
// @description:en Prevent pausing when the page loses focus, automatically widen the player, and remember your preferred site language and video quality.
// @description:ja ページがフォーカスを失った際の一時停止を防止し、プレイヤーを自動でワイド表示。サイトの表示言語と画質の設定を保存します。
// @description:ko 페이지가 포커스를 잃을 때 일시 정지를 방지하고 플레이어를 자동으로 넓게 표시하며, 선호하는 사이트 언어와 화질을 저장합니다.
// @description:ms Menghalang video daripada dijeda apabila halaman kehilangan fokus, melebarkan pemain secara automatik dan menyimpan pilihan bahasa laman serta kualiti video.
// @description:th ป้องกันการหยุดชั่วคราวเมื่อหน้าเว็บเสียโฟกัส ขยายเครื่องเล่นให้กว้างโดยอัตโนมัติ และจดจำภาษาเว็บไซต์กับคุณภาพวิดีโอที่เลือก
// @description:de Verhindert Pausen bei Fokusverlust, verbreitert den Player automatisch und speichert die bevorzugte Website-Sprache und Videoqualität.
// @description:fr Empêche la mise en pause lorsque la page perd le focus, élargit automatiquement le lecteur et mémorise la langue du site et la qualité vidéo préférées.
// @description:vi Ngăn tạm dừng khi trang mất tiêu điểm, tự động mở rộng trình phát và ghi nhớ ngôn ngữ trang web cùng chất lượng video ưu tiên.
// @description:id Mencegah jeda saat halaman kehilangan fokus, memperlebar pemutar secara otomatis, serta menyimpan pilihan bahasa situs dan kualitas video.
// @description:fil Pinipigilan ang pag-pause kapag nawalan ng focus ang pahina, awtomatikong pinapalawak ang player, at tinatandaan ang gustong wika ng site at kalidad ng video.
// @description:pt Impede pausas quando a página perde o foco, amplia automaticamente o reprodutor e salva as preferências de idioma do site e qualidade de vídeo.
// @description:ru Предотвращает паузу при потере фокуса страницы, автоматически расширяет плеер и сохраняет предпочтительный язык сайта и качество видео.
// @description:es Evita las pausas cuando la página pierde el foco, amplía automáticamente el reproductor y guarda las preferencias de idioma del sitio y calidad de vídeo.
// @description:it Impedisce le pause quando la pagina perde il focus, amplia automaticamente il lettore e salva le preferenze per la lingua del sito e la qualità video.
// @match        https://missav.ws/*
// @match        https://missav01.com/*
// @match        https://missav123.com/*
// @match        https://missav.live/*
// @match        https://missav.ai/*
// @match        https://missav.fans/*
// @match        https://missav.media/*
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
    const DEFAULT_QUALITY = 360;
    const DEFAULT_LANGUAGE = 'zh-Hans';
    const PLAYER_WAIT_MS = 15000;
    const REQUEST_TIMEOUT_MS = 10000;
    const INSPECTION_DELAY_MS = 250;
    const LANGUAGE_RETRY_MS = 3000;
    const LANGUAGE_ATTEMPT_LIMIT = 2;
    const DOWNLOAD_WORKERS = 3;
    const DOWNLOAD_IDLE_TIMEOUT_MS = 30000;
    const BLOB_RELEASE_DELAY_MS = 60000;
    const MEMORY_DOWNLOAD_LIMIT = 512 * 1024 ** 2;
    const RESIZE_DELAY_MS = 200;
    const PLAYER_POLL_MS = 1000;
    const SIDEBAR_EDGE_TOLERANCE = 10;
    const SIDEBAR_MIN_WIDTH = 100;

    const PANEL_STYLES = `
                :is(#coserops-settings, #coserops-downloads, #coserops-settings-button, #coserops-download-button, #coserops-update-notice) {
                    --co-accent: #c7e76b; --co-brand-blue: #0c3345; --co-bg: #0a202a; --co-surface: #102e3a; --co-border: #2c4855; --co-text: #f1f6f7; --co-muted: #a9bec5;
                    --co-logo: url("data:image/png;base64,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");
                }
                :is(#coserops-settings, #coserops-downloads) .co-brand::before,
                :is(#coserops-settings-button, #coserops-download-button)::before,
                #coserops-update-notice > strong::before { content: ""; flex: none; display: block; width: 32px; height: 32px; border-radius: 10px; background: var(--co-brand-blue) var(--co-logo) center / contain no-repeat; }
                :is(#coserops-settings-button, #coserops-download-button) { position: fixed; right: max(16px, env(safe-area-inset-right)); z-index: 2147483646; display: flex; align-items: center; gap: 10px; box-sizing: border-box; width: 180px; min-height: 64px; padding: 10px 14px; border: 1px solid var(--co-border); border-radius: 14px; background: var(--co-surface); color: var(--co-text); box-shadow: 0 8px 28px #0004; font: 600 12px/1.65 system-ui, sans-serif; letter-spacing: .1px; text-align: left; white-space: pre-line; cursor: pointer; transition: background 160ms, border-color 160ms, transform 160ms, box-shadow 160ms; }
                #coserops-settings-button { top: max(80px, env(safe-area-inset-top)); }
                #coserops-download-button { top: max(154px, calc(env(safe-area-inset-top) + 74px)); background: var(--co-accent); border-color: var(--co-accent); color: var(--co-brand-blue); }
                #coserops-update-notice { position: fixed; right: max(16px, env(safe-area-inset-right)); bottom: max(20px, env(safe-area-inset-bottom)); z-index: 2147483646; box-sizing: border-box; width: min(400px, calc(100vw - 32px)); max-height: 60vh; max-height: 60dvh; overflow: auto; padding: 24px; border: 1px solid var(--co-border); border-top: 2px solid var(--co-accent); border-radius: 20px; background: linear-gradient(135deg, var(--co-brand-blue), var(--co-bg)); color: var(--co-text); box-shadow: 0 16px 48px #0005; font: 14px/1.75 system-ui, sans-serif; color-scheme: dark; overflow-wrap: anywhere; animation: coserops-enter 280ms cubic-bezier(.16, 1, .3, 1); }
                #coserops-update-notice > strong { display: flex; align-items: center; gap: 12px; font-size: 16px; line-height: 1.5; font-weight: 650; }
                #coserops-update-notice > p { margin: 16px 0 20px; color: var(--co-muted); font-size: 13px; }
                #coserops-update-notice > a { display: inline-flex; align-items: center; min-height: 44px; color: var(--co-accent); text-decoration: underline; text-underline-offset: 4px; }
                #coserops-update-notice > button { min-height: 44px; margin-left: 16px; padding: 10px 16px; border: 1px solid var(--co-accent); border-radius: 10px; background: var(--co-accent); color: var(--co-brand-blue); font: 600 13px/1.5 system-ui, sans-serif; cursor: pointer; transition: background 160ms, transform 160ms; }
                #coserops-update-notice > button:disabled { opacity: .65; cursor: wait; }
                :is(#coserops-settings-button, #coserops-download-button):focus-visible,
                #coserops-update-notice :focus-visible { outline: 2px solid var(--co-accent); outline-offset: 4px; box-shadow: 0 0 0 6px var(--co-brand-blue); }
                :is(#coserops-settings-button, #coserops-download-button):active,
                #coserops-update-notice > button:active:not(:disabled) { transform: translateY(1px); }
                @media (hover: hover) {
                    #coserops-settings-button:hover { background: #16475b; border-color: #8cb0bf; transform: translateY(-2px); box-shadow: 0 12px 32px #0005; }
                    #coserops-download-button:hover, #coserops-update-notice > button:hover:not(:disabled) { background: #daf394; border-color: #daf394; }
                    #coserops-update-notice > a:hover { color: #daf394; }
                }
                @media (max-width: 600px) {
                    :is(#coserops-settings-button, #coserops-download-button) { right: max(8px, env(safe-area-inset-right)); width: 152px; gap: 8px; padding: 8px 10px; min-height: 56px; font-size: 11px; border-radius: 12px; }
                    :is(#coserops-settings-button, #coserops-download-button)::before { width: 28px; height: 28px; border-radius: 8px; }
                    #coserops-download-button { top: max(144px, calc(env(safe-area-inset-top) + 64px)); }
                }
                @media (prefers-reduced-motion: reduce) {
                    :is(#coserops-settings-button, #coserops-download-button), #coserops-update-notice > button { transition: none; transform: none !important; }
                    #coserops-update-notice { animation: none; }
                }
                @media (forced-colors: active) {
                    :is(#coserops-settings-button, #coserops-download-button, #coserops-update-notice) { border-color: CanvasText; box-shadow: none; }
                    :is(#coserops-settings-button, #coserops-download-button):focus-visible, #coserops-update-notice :focus-visible { outline-color: Highlight; box-shadow: none; }
                    #coserops-update-notice > button { border-color: ButtonText; }
                }

                :is(#coserops-settings, #coserops-downloads) { color-scheme: dark; box-sizing: border-box; width: min(700px, calc(100vw - 48px)); max-width: none; max-height: calc(100vh - 32px); max-height: calc(100dvh - max(16px, env(safe-area-inset-top)) - max(16px, env(safe-area-inset-bottom))); margin: auto; padding: 0; overflow: hidden; border: 1px solid var(--co-border); border-radius: 24px; background: var(--co-bg); color: var(--co-text); box-shadow: 0 32px 100px #0008, 0 1px 0 #ffffff08 inset; font: 14px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; text-align: left; }
                :is(#coserops-settings, #coserops-downloads)[open] { display: flex; flex-direction: column; animation: coserops-enter 280ms cubic-bezier(.16, 1, .3, 1); }
                :is(#coserops-settings, #coserops-downloads)::backdrop { background: #020c14b8; backdrop-filter: blur(12px); }
                :is(#coserops-settings, #coserops-downloads) * { box-sizing: border-box; }
                :is(#coserops-settings, #coserops-downloads) :is(h2, h3, p, dl) { margin: 0; }
                :is(#coserops-settings, #coserops-downloads) .co-header { flex: none; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 32px 36px 28px; border-bottom: 1px solid var(--co-border); background: radial-gradient(ellipse at 100% 0, #c7e76b0c, transparent 60%), linear-gradient(125deg, var(--co-brand-blue), var(--co-bg)); }
                :is(#coserops-settings, #coserops-downloads) .co-header > div { min-width: 0; }
                :is(#coserops-settings, #coserops-downloads) a.co-contact { position: relative; display: inline-flex; align-items: center; justify-self: start; min-height: 44px; max-width: 100%; gap: 8px; padding: 8px 14px; border: 1px solid var(--co-border); border-radius: 12px; background: var(--co-surface); color: var(--co-muted); font: 500 12px/1.6 system-ui, sans-serif; letter-spacing: normal; text-decoration: none; overflow-wrap: anywhere; }
                :is(#coserops-settings, #coserops-downloads) a.co-contact:hover { color: var(--co-accent); }
                :is(#coserops-settings, #coserops-downloads) a.co-contact::after { content: ""; position: absolute; top: 0; right: 12px; width: 6px; height: 6px; border-radius: 50%; background: var(--co-accent); box-shadow: 0 0 0 1px var(--co-border), 0 0 8px var(--co-accent); pointer-events: none; }
                @supports (offset-path: inset(0 round 12px)) {
                    :is(#coserops-settings, #coserops-downloads) a.co-contact::after { left: 0; right: auto; offset-path: inset(0 round 12px); animation: coserops-contact-orbit 5s linear infinite; }
                }
                @keyframes coserops-contact-orbit { to { offset-distance: 100%; } }
                :is(#coserops-settings, #coserops-downloads) .co-brand { display: flex; align-items: center; gap: 12px; color: var(--co-accent); font: 600 11px/1.5 ui-monospace, monospace; letter-spacing: 2px; }
                :is(#coserops-settings, #coserops-downloads) h2 { margin: 24px 0 10px; color: var(--co-text); font-size: clamp(26px, 4vw, 36px); font-weight: 650; line-height: 1.25; letter-spacing: -1px; overflow-wrap: anywhere; text-wrap: balance; }
                :is(#coserops-settings, #coserops-downloads) .co-muted { color: var(--co-muted); font-size: 13px; line-height: 1.75; font-weight: 400; }
                :is(#coserops-settings, #coserops-downloads) :is(.co-body, .co-download-body) { min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; scrollbar-color: #537784 var(--co-bg); padding: 28px 36px; scroll-padding-block: 20px; }
                :is(#coserops-settings, #coserops-downloads) button { min-height: 44px; max-width: 100%; padding: 10px 16px; border: 1px solid #537784; border-radius: 12px; background: #153542; color: var(--co-text); font: 600 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; cursor: pointer; transition: background 150ms, border-color 150ms, transform 150ms; overflow-wrap: anywhere; }
                :is(#coserops-settings, #coserops-downloads) button:active:not(:disabled) { transform: translateY(1px); }
                :is(#coserops-settings, #coserops-downloads) button:disabled { color: #96acb5; background: #173744; border-color: #385663; cursor: default; }
                :is(#coserops-settings, #coserops-downloads) button:is(.co-primary, [data-video-save]):not(:disabled) { background: var(--co-accent); border-color: var(--co-accent); color: #0c3345; }
                :is(#coserops-settings, #coserops-downloads) button.co-close { flex: none; width: 44px; padding: 0; border-radius: 50%; border-color: var(--co-border); background: #ffffff04; font-size: 24px; font-weight: 400; }
                :is(#coserops-settings, #coserops-downloads) :focus-visible { outline: 2px solid var(--co-accent); outline-offset: 3px; }
                @media (hover: hover) {
                    :is(#coserops-settings, #coserops-downloads) button:hover:not(:disabled) { background: #205266; border-color: #8cb0bf; }
                    :is(#coserops-settings, #coserops-downloads) button:is(.co-primary, [data-video-save]):hover:not(:disabled) { background: #daf394; border-color: #daf394; }
                }
                @keyframes coserops-enter { from { opacity: 0; transform: translateY(12px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @media (max-width: 600px) {
                    :is(#coserops-settings, #coserops-downloads) { width: calc(100vw - 16px); max-height: calc(100vh - 16px); max-height: calc(100dvh - max(8px, env(safe-area-inset-top)) - max(8px, env(safe-area-inset-bottom))); width: calc(100vw - max(8px, env(safe-area-inset-left)) - max(8px, env(safe-area-inset-right))); border-radius: 18px; }
                    :is(#coserops-settings, #coserops-downloads) .co-header { padding: 20px; gap: 12px; }
                    :is(#coserops-settings, #coserops-downloads) .co-brand { font-size: 10px; letter-spacing: 1px; gap: 8px; }
                    :is(#coserops-settings, #coserops-downloads) h2 { margin-top: 16px; }
                    :is(#coserops-settings, #coserops-downloads) :is(.co-body, .co-download-body) { padding: 20px; }
                }
                @media (max-height: 500px) {
                    :is(#coserops-settings, #coserops-downloads)[open] { display: block; overflow-y: auto; }
                    :is(#coserops-settings, #coserops-downloads) :is(.co-body, .co-download-body) { overflow: visible; }
                }
                @media (prefers-reduced-motion: reduce) {
                    :is(#coserops-settings, #coserops-downloads)[open] { animation: none; }
                    :is(#coserops-settings, #coserops-downloads) a.co-contact::after { animation: none; }
                    :is(#coserops-settings, #coserops-downloads) * { transition: none !important; }
                    :is(#coserops-settings, #coserops-downloads) button:active:not(:disabled) { transform: none; }
                }
                @media (forced-colors: active) {
                    :is(#coserops-settings, #coserops-downloads) { border-color: CanvasText; box-shadow: none; }
                    :is(#coserops-settings, #coserops-downloads) :is(button, select, input) { border: 1px solid ButtonText; }
                    :is(#coserops-settings, #coserops-downloads) :focus-visible { outline-color: Highlight; }
                    :is(#coserops-settings, #coserops-downloads) a.co-contact { border-color: LinkText; }
                    :is(#coserops-settings, #coserops-downloads) a.co-contact::after { display: none; }
                }
            `;
    const SETTINGS_STYLES = `
                #coserops-settings .co-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
                #coserops-settings .co-fields > div { min-width: 0; padding: 22px; border: 1px solid var(--co-border); border-radius: 16px; background: var(--co-surface); transition: border-color 150ms, background 150ms; }
                #coserops-settings .co-fields > div:focus-within { border-color: var(--co-accent); background: #103748; }
                #coserops-settings label { display: block; font-size: 14px; font-weight: 600; }
                #coserops-settings .co-field-index { display: block; margin-bottom: 18px; color: var(--co-accent); font: 10px/1.5 ui-monospace, monospace; letter-spacing: 1.5px; }
                #coserops-settings select { display: block; width: 100%; min-width: 0; min-height: 48px; margin: 14px 0 12px; padding: 10px 12px; border: 1px solid #537784; border-radius: 10px; background: var(--co-bg); color: var(--co-text); font: inherit; cursor: pointer; }
                #coserops-settings select:disabled { opacity: .6; cursor: wait; }
                #coserops-settings .co-status { display: grid; gap: 0; margin-top: 28px; }
                #coserops-settings .co-status-title { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; color: var(--co-muted); font-size: 11px; font-weight: 500; letter-spacing: 1.5px; }
                #coserops-settings .co-status-title::after { content: ""; flex: 1; height: 1px; background: var(--co-border); }
                #coserops-settings .co-status-row { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 16px; padding: 8px 0; border-bottom: 1px solid #ffffff08; font-size: 13px; }
                #coserops-settings .co-status-row > span:first-child { color: var(--co-muted); }
                #coserops-settings [data-status] { overflow-wrap: anywhere; }
                #coserops-settings .co-footer { flex: none; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 20px; padding: 20px 36px; border-top: 1px solid var(--co-border); background: #081b24; }
                #coserops-settings .co-footer-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; grid-column: 2; grid-row: 1 / 3; }
                #coserops-settings .co-feedback { min-height: 20px; color: var(--co-muted); font-size: 12px; overflow-wrap: anywhere; }
                #coserops-settings [data-reset] { background: transparent; border-color: var(--co-border); color: var(--co-muted); }
                #coserops-settings .co-primary { padding-inline: 24px; }
                @media (max-width: 600px) {
                    #coserops-settings .co-fields { grid-template-columns: 1fr; }
                    #coserops-settings .co-footer { padding: 16px 20px; gap: 4px; grid-template-columns: minmax(0, 1fr); }
                    #coserops-settings .co-footer-actions { grid-column: 1; grid-row: 2; margin-block: 8px; }
                    #coserops-settings .co-footer-actions button { flex: 1; }
                    #coserops-settings .co-fields > div { padding: 18px; }
                    #coserops-settings .co-field-index { margin-bottom: 12px; }
                    #coserops-settings .co-status-row { grid-template-columns: 76px minmax(0, 1fr); gap: 12px; }
                }
            `;
    const CONTACT_MARKUP = '<a class="co-contact" href="https://x.com/coserops" target="_blank" rel="noopener noreferrer" aria-label="联系作者：X @coserops（在新标签页打开）">联系作者 · X @coserops <span aria-hidden="true">↗</span></a>';
    const SETTINGS_MARKUP = `
                <header class="co-header">
                    <div><p class="co-brand">COSEROPS / MISSAV</p><h2 id="coserops-settings-title">播放偏好</h2><p class="co-muted">让每次播放，都合你习惯。</p></div>
                    <button class="co-close" type="button" aria-label="关闭设置">×</button>
                </header>
                <div class="co-body">
                    <div class="co-fields">
                        <div><span class="co-field-index" aria-hidden="true">01 / QUALITY</span><label for="coserops-quality">优先画质</label><select id="coserops-quality" aria-describedby="coserops-quality-hint"></select><p class="co-muted" id="coserops-quality-hint" data-quality-hint></p></div>
                        <div><span class="co-field-index" aria-hidden="true">02 / LANGUAGE</span><label for="coserops-language">界面语言</label><select id="coserops-language"></select><p class="co-muted">保存后切换，之后自动沿用（约耗时5秒）</p></div>
                    </div>
                    <section class="co-status" aria-label="运行状态" aria-live="polite">
                        <h3 class="co-status-title">运行状态 / STATUS</h3>
                        <div class="co-status-row"><span>防失焦暂停</span><span data-status="pause"></span></div>
                        <div class="co-status-row"><span>自动宽屏</span><span data-status="wide"></span></div>
                        <div class="co-status-row"><span>语言状态</span><span data-status="language"></span></div>
                        <div class="co-status-row"><span>画质状态</span><span data-status="quality"></span></div>
                        <div class="co-status-row"><span>下载链接</span><span data-status="download"></span></div>
                    </section>
                </div>
                <footer class="co-footer"><p class="co-feedback" role="status">偏好仅保存在当前浏览器</p><div class="co-footer-actions"><button type="button" data-reset>恢复默认</button><button type="button" class="co-primary" data-save>保存并应用</button></div>${CONTACT_MARKUP}</footer>`;
    const DOWNLOAD_STYLES = `
                #coserops-downloads { width: min(920px, calc(100vw - 48px)); }
                #coserops-downloads .co-header { align-items: flex-start; }
                #coserops-downloads .co-download-body { padding-top: 22px; }
                #coserops-downloads .co-download-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
                #coserops-downloads [data-download-status] { color: var(--co-text); font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
                #coserops-downloads [data-download-refresh] { flex: none; background: transparent; }
                #coserops-downloads .co-download-note { margin-top: 12px; padding: 14px 16px; border-left: 2px solid var(--co-border); background: #ffffff03; font-size: 12px; }
                #coserops-downloads .co-download-footer { flex: none; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 4px 20px; padding: 12px 36px; border-top: 1px solid var(--co-border); background: #081b24; }
                #coserops-downloads .co-download-footer .co-muted { font-size: 12px; }
                #coserops-downloads .co-download-row { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 10px; margin-top: 20px; padding: 24px; border: 1px solid var(--co-border); border-radius: 16px; background: var(--co-surface); }
                #coserops-downloads .co-download-row:focus-within { border-color: #8cb0bf; }
                #coserops-downloads .co-download-row > * { min-width: 0; }
                #coserops-downloads .co-download-row > a { flex: 1 0 100%; color: var(--co-text); font-size: 18px; font-weight: 650; letter-spacing: -.2px; line-height: 1.5; text-decoration: underline; text-decoration-color: var(--co-border); text-underline-offset: 5px; overflow-wrap: anywhere; }
                #coserops-downloads .co-download-row > a:hover { color: var(--co-accent); text-decoration-color: currentColor; }
                #coserops-downloads input { flex: 1 1 180px; width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #537784; border-radius: 8px; background: var(--co-bg); color: #c3d4db; font: 12px/1.6 ui-monospace, monospace; }
                #coserops-downloads .co-download-origin { flex: 1 0 100%; color: var(--co-muted); font-size: 12px; overflow-wrap: anywhere; }
                #coserops-downloads .co-download-facts { flex: 1 0 100%; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; padding: 16px 0; border-block: 1px solid var(--co-border); }
                #coserops-downloads dt { color: var(--co-muted); font-size: 11px; }
                #coserops-downloads dd { margin: 5px 0 0; color: var(--co-text); font-size: 15px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
                #coserops-downloads .co-download-actions { display: flex; flex-wrap: wrap; gap: 8px; }
                #coserops-downloads .co-download-job { flex: 1 0 100%; padding: 12px 14px; border-left: 2px solid var(--co-accent); border-radius: 0 8px 8px 0; background: var(--co-bg); color: #c3d4db; font-size: 12px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
                #coserops-downloads .co-download-job:empty { display: none; }
                @media (max-width: 600px) {
                    #coserops-downloads { width: calc(100vw - max(8px, env(safe-area-inset-left)) - max(8px, env(safe-area-inset-right))); }
                    #coserops-downloads .co-download-toolbar { align-items: flex-start; }
                    #coserops-downloads .co-download-footer { padding: 10px 20px; }
                    #coserops-downloads .co-download-row { padding: 16px; gap: 12px 8px; }
                    #coserops-downloads .co-download-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    #coserops-downloads .co-download-row .co-download-actions { width: 100%; }
                    #coserops-downloads .co-download-row .co-download-actions button { flex: 1 1 auto; }
                }
            `;
    const DOWNLOAD_MARKUP = `
            <header class="co-header"><div><p class="co-brand">COSEROPS / DOWNLOADS</p><h2 id="coserops-download-title">视频下载</h2><p class="co-muted">选择画质，把想看的留在本地。</p></div><button type="button" class="co-close" data-download-close aria-label="关闭视频下载弹窗">×</button></header>
            <div class="co-download-body"><div class="co-download-toolbar"><p data-download-status role="status"></p><button type="button" data-download-refresh>重新获取</button></div>
            <p class="co-download-note co-muted">列表按文件大小从大到小排列，大小未知的排在最后。文件大小以服务器返回值为准；HLS 根据码率与时长估算，无法获取时显示“未知”。点击下载后才保存视频，列表可能包含预览或广告。</p>
            <div data-download-list></div></div><footer class="co-download-footer"><p class="co-muted">关闭面板不会中断已开始的下载</p>${CONTACT_MARKUP}</footer>`;

    /**
     * @typedef {object} DownloadEntry
     * @property {string} url Validated absolute HTTP(S) URL.
     * @property {string} label Human-readable format or quality.
     * @property {string[]} [origins] Discovery provenance.
     * @property {boolean} [inferred] Whether the URL still needs verification.
     * @property {string} [kind] Known stream type.
     * @property {number} [bandwidth] Average or declared bits per second.
     * @property {string} [resolution] Declared pixel dimensions.
     * @property {string} [audioUrl] Separate audio playlist URL.
     */
    const featureStatus = { pause: '等待播放器', wide: '等待布局', language: '等待语言入口', quality: '等待视频', download: '等待视频' };
    let preferredQuality = DEFAULT_QUALITY;
    let preferredLanguage = DEFAULT_LANGUAGE;
    const languageNames = {
        'zh-Hant': '繁體中文', 'zh-Hans': '简体中文', en: 'English', ja: '日本語',
        ko: '한국의', ms: 'Melayu', th: 'ไทย', de: 'Deutsch', fr: 'Français',
        vi: 'Tiếng Việt', id: 'Bahasa Indonesia', fil: 'Filipino', pt: 'Português',
    };
    const languagePath = /^\/(?:dm\d+\/)?(cn|en|ja|ko|ms|th|de|fr|vi|id|fil|pt|tw|zh)(?=\/|$)/;

    let languageSelect = null;
    let availableQualities = [];
    let player = null;
    let video = null;
    let originalPause = null;
    let wrappedPause = null;
    let currentVideoSource = '';
    let qualityApplied = false;
    let qualityRequest = null;
    let playerWaitDeadline = Date.now() + PLAYER_WAIT_MS;
    let originalWidthStyles = [];
    let wideColumn = null;
    let settingsPanel = null;
    let settingsStatus = null;
    let qualitySelect = null;
    let inspectionTimer = null;
    let languageDone = false;
    let languageAttempts = 0;
    let updateNotice = null;
    let downloadPanel = null;
    let downloadButton = null;
    let downloadMetadataRequest = null;
    let displayedDownloads = [];
    const downloadRows = new Map();
    const downloadJobs = new Map();
    let downloadKey = '';
    let downloadRequest = null;
    const downloadCache = new Map();
    const downloadResources = new Set();
    const downloadFragments = new Set();

    function ensureBrandStyles() {
        if (document.getElementById('coserops-brand-style')) return;
        const sheet = document.createElement('style');
        sheet.id = 'coserops-brand-style';
        sheet.textContent = PANEL_STYLES;
        document.head.append(sheet);
    }

    function createUpdateNotice(version, currentVersion) {
        ensureBrandStyles();
        const notice = document.createElement('section');
        notice.id = 'coserops-update-notice';
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-label', '脚本版本通知');
        const title = document.createElement('strong');
        title.textContent = currentVersion ? `脚本当前版本：${version}` : `脚本已更新到 ${version}`;
        const details = document.createElement('p');
        details.textContent = '本版修复 FFmpeg 8.x 下载命令：兼容使用 .jpeg 等后缀的视频分片；浏览器下载仍按播放列表顺序保存真实视频数据。';
        const link = document.createElement('a');
        link.href = 'https://github.com/coserops/coserops-missav#更新与通知';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '查看更新说明';
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.textContent = '知道了';
        notice.append(title, details, link, dismiss);
        return { notice, details, dismiss };
    }

    async function acknowledgeVersion(version, notice, details, dismiss) {
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
    }

    /**
     * Display one version notice after reading persisted acknowledgment.
     * @param {boolean} [manual=false] Whether to show an acknowledged version.
     * @returns {Promise<void>}
     */
    async function showUpdateNotice(manual = false) {
        if (updateNotice) return;
        try {
            const version = GM_info.script.version;
            const seen = await GM_getValue('lastAcknowledgedVersion', '');
            if (!manual && seen === version) return;
            if (updateNotice) return;
            const { notice, details, dismiss } = createUpdateNotice(version, manual || !seen);
            dismiss.addEventListener('click', () => acknowledgeVersion(version, notice, details, dismiss));
            document.body.append(notice);
            updateNotice = notice;
        } catch (error) {
            console.warn(PREFIX, '版本通知读取失败，可通过项目主页查看更新说明', error);
        }
    }

    function report(key, text, error) {
        if (featureStatus[key] !== text) {
            featureStatus[key] = text;
            if (error) console.warn(PREFIX, key, text, error);
            renderStatus();
        }
    }

    function renderStatus() {
        if (!settingsStatus) return;
        for (const [key, text] of Object.entries(featureStatus)) {
            const row = settingsStatus.querySelector(`[data-status="${key}"]`);
            if (!row || row.textContent === text) continue;
            row.textContent = text;
        }
        const hint = settingsPanel.querySelector('[data-quality-hint]');
        hint.textContent = availableQualities.length ? `当前可选：${availableQualities.map(height => `${height}P`).join(' / ')}` : '视频加载后显示可用画质，默认 360P';
    }

    function updateOptions() {
        if (!qualitySelect) return;
        const chosen = Number(qualitySelect.value) || preferredQuality;
        qualitySelect.replaceChildren();
        for (const height of [...new Set([DEFAULT_QUALITY, preferredQuality, chosen, ...availableQualities])].sort((leftHeight, rightHeight) => leftHeight - rightHeight)) {
            const option = document.createElement('option');
            option.value = String(height);
            option.textContent = `${height}P${availableQualities.length && !availableQualities.includes(height) ? '（当前不可用）' : ''}`;
            qualitySelect.append(option);
        }
        qualitySelect.value = String(chosen);
    }

    function createSettingsPanel() {
        ensureBrandStyles();
        const sheet = document.createElement('style');
        sheet.textContent = SETTINGS_STYLES;
        document.head.append(sheet);
        settingsPanel = document.createElement('dialog');
        settingsPanel.id = 'coserops-settings';
        settingsPanel.setAttribute('aria-labelledby', 'coserops-settings-title');
        settingsPanel.innerHTML = SETTINGS_MARKUP;
        qualitySelect = settingsPanel.querySelector('#coserops-quality');
        languageSelect = settingsPanel.querySelector('#coserops-language');
        settingsStatus = settingsPanel.querySelector('.co-status');
        settingsPanel.querySelector('.co-close').addEventListener('click', () => settingsPanel.close());
        bindSettingsActions();
        document.body.append(settingsPanel);
    }

    async function submitSettings(reset, saveButton, resetButton, feedback) {
        const quality = reset ? DEFAULT_QUALITY : Number(qualitySelect.value);
        const language = reset ? DEFAULT_LANGUAGE : languageSelect.value;
        saveButton.disabled = resetButton.disabled = qualitySelect.disabled = languageSelect.disabled = true;
        saveButton.textContent = '正在保存…';
        try {
            feedback.textContent = '正在保存偏好…';
            const saved = await saveSettings(quality, language);
            feedback.textContent = saved ? '偏好已保存 · 应用结果见运行状态' : '未能完整保存，请查看运行状态';
        } finally {
            saveButton.disabled = resetButton.disabled = qualitySelect.disabled = languageSelect.disabled = false;
            saveButton.textContent = '保存并应用';
        }
    }

    function bindSettingsActions() {
        const saveButton = settingsPanel.querySelector('[data-save]');
        const resetButton = settingsPanel.querySelector('[data-reset]');
        const feedback = settingsPanel.querySelector('.co-feedback');
        for (const field of [qualitySelect, languageSelect]) {
            field.addEventListener('change', () => {
                feedback.textContent = Number(qualitySelect.value) !== preferredQuality || languageSelect.value !== preferredLanguage
                    ? '有未保存的更改' : '已与保存的偏好一致';
            });
        }
        saveButton.addEventListener('click', () => submitSettings(false, saveButton, resetButton, feedback));
        resetButton.addEventListener('click', () => submitSettings(true, saveButton, resetButton, feedback));
    }

    /**
     * Lazily create the settings dialog and display current saved preferences.
     * @returns {void}
     */
    function openSettings() {
        if (!settingsPanel) createSettingsPanel();
        if (settingsPanel.open) return;
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
        qualitySelect.value = String(preferredQuality);
        settingsPanel.querySelector('.co-feedback').textContent = '偏好仅保存在当前浏览器';
        renderStatus();
        if (!settingsPanel.open) settingsPanel.showModal();
    }

    /**
     * Persist validated preferences and request player/language updates.
     * @param {number} quality Positive integer video height.
     * @param {string} language Supported language key.
     * @returns {Promise<boolean>}
     */
    async function saveSettings(quality, language) {
        if (!Number.isSafeInteger(quality) || quality <= 0 || !Object.hasOwn(languageNames, language)) {
            report('language', '保存失败：无效设置', new Error('Invalid settings'));
            return false;
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
            return false;
        }
        if (!(await savePreference(quality))) return false;
        // Reset after awaited writes so initialization cannot consume this manual request.
        languageDone = false;
        languageAttempts = 0;
        applyLanguage(true);
        return true;
    }

    /**
     * Persist a positive quality height, then restart quality confirmation.
     * @param {number} value Requested video height.
     * @returns {Promise<boolean>}
     */
    async function savePreference(value) {
        if (!Number.isSafeInteger(value) || value <= 0) {
            report('quality', '保存失败：请选择有效画质', new Error('Invalid quality'));
            return false;
        }
        try {
            await GM_setValue('preferredQuality', value);
            preferredQuality = value;
            qualitySelect.value = String(value);
            cancelQualityRequest();
            qualityApplied = false;
            playerWaitDeadline = Date.now() + PLAYER_WAIT_MS;
            report('quality', '已保存，等待应用');
            inspect();
            return true;
        } catch (error) {
            report('quality', '保存失败，请检查控制台', error);
            return false;
        }
    }

    function restoreWidth() {
        for (const { element, property, value, priority, applied } of originalWidthStyles) {
            if (element.style.getPropertyValue(property) !== applied || element.style.getPropertyPriority(property) !== 'important') continue;
            if (value) element.style.setProperty(property, value, priority);
            else element.style.removeProperty(property);
        }
        originalWidthStyles = [];
        wideColumn = null;
    }

    function setStyle(element, property, applied) {
        originalWidthStyles.push({ element, property, applied, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) });
        element.style.setProperty(property, applied, 'important');
    }

    /**
     * Expand the video column while recording reversible style changes.
     * @returns {void}
     */
    function applyWidth() {
        const column = video?.closest('.plyr')?.closest('.flex-1.order-first');
        if (!column?.parentElement || column === wideColumn) return;
        restoreWidth();
        const rect = column.getBoundingClientRect();
        if (!rect.width) return;
        const siblings = [...column.parentElement.children].map(element => ({ element, rect: element.getBoundingClientRect() }));
        for (const sibling of siblings) {
            if (sibling.element !== column && sibling.rect.left >= rect.right - SIDEBAR_EDGE_TOLERANCE && sibling.rect.width > SIDEBAR_MIN_WIDTH) setStyle(sibling.element, 'display', 'none');
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

    /**
     * Restore the previous pause method before wrapping the current player.
     * @param {object|null} next Website player instance.
     * @returns {void}
     */
    function bindPlayer(next) {
        if (player === next) return;
        unpatch();
        cancelQualityRequest();
        player = next;
        qualityApplied = false;
        playerWaitDeadline = Date.now() + PLAYER_WAIT_MS;
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

    /**
     * Confirm only the active request; ignore stale player/video responses.
     * @param {object} request Player, video, target, expiry and timer ownership.
     * @returns {void}
     */
    function confirmQualityRequest(request) {
        if (qualityRequest !== request || player !== request.player || video !== request.video) return;
        try {
            const evidence = qualityEvidence(request.target);
            if (evidence) {
                cancelQualityRequest();
                qualityApplied = true;
                report('quality', `${request.target === preferredQuality ? '' : `目标 ${preferredQuality}P 不可用，`}${evidence} ${request.target}P`);
                return;
            }
            if (Date.now() >= request.expires) {
                cancelQualityRequest();
                qualityApplied = true;
                report('quality', `已请求 ${request.target}P，但结果未确认；可保存后重试`, new Error('Quality confirmation timed out'));
                return;
            }
            request.timer = setTimeout(() => confirmQualityRequest(request), INSPECTION_DELAY_MS);
        } catch (error) {
            cancelQualityRequest();
            qualityApplied = true;
            report('quality', '无法读取画质状态；可保存后重试', error);
        }
    }

    /**
     * Request the nearest supported quality and confirm asynchronously.
     * @returns {void}
     */
    function applyQuality() {
        if (!player || !video || qualityApplied || qualityRequest) return;
        const options = player.options?.quality;
        availableQualities = Array.isArray(options) ? [...new Set(options.map(Number).filter(height => Number.isSafeInteger(height) && height > 0))].sort((leftHeight, rightHeight) => leftHeight - rightHeight) : [];
        updateOptions();
        if (!availableQualities.length || !('quality' in player)) {
            if (Date.now() >= playerWaitDeadline) report('quality', '未识别可设置的画质接口；保留网站当前模式');
            return;
        }
        const lower = availableQualities.filter(height => height <= preferredQuality);
        const target = lower.length ? lower[lower.length - 1] : availableQualities[0];
        const request = { player, video, target, expires: Date.now() + REQUEST_TIMEOUT_MS, timer: null };
        qualityRequest = request;
        try {
            if (!qualityEvidence(target)) {
                report('quality', `正在设置 ${target}P，等待播放器确认`);
                player.quality = target;
            }
            confirmQualityRequest(request);
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
            url = httpUrl(href, current);
            if (!url) continue;
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

    function recordLanguageRedirect(current, target) {
        const key = `missav-language:${current.pathname}:${target.language}`;
        try {
            if (sessionStorage.getItem(key)) {
                report('language', '已尝试切换，停止重复跳转');
                languageDone = true;
                return false;
            }
            sessionStorage.setItem(key, '1');
        } catch (error) {
            report('language', '无法记录跳转状态，停止自动切换', error);
            languageDone = true;
            return false;
        }
        return true;
    }

    /**
     * Follow a content-preserving language entry with a session redirect guard.
     * @param {boolean} [manual=false] Allow explicit navigation despite stale page language.
     * @returns {void}
     */
    function applyLanguage(manual = false) {
        if (languageDone || languageAttempts >= LANGUAGE_ATTEMPT_LIMIT) return;
        languageAttempts++;
        const current = new URL(location.href);
        const routeLanguage = current.pathname.match(languagePath)?.[1];
        const currentLanguage = normalizeLanguage(document.documentElement.lang);
        const resolvedLanguage = (!currentLanguage || currentLanguage === 'zh') ? normalizeLanguage(routeLanguage) : currentLanguage;
        const name = languageNames[preferredLanguage] || preferredLanguage;
        const candidates = languageCandidates();
        const target = candidates.find(candidate => candidate.language === preferredLanguage);
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
        if (!recordLanguageRedirect(current, target)) return;
        navigateToLanguage(current, target, name);
    }

    function navigateToLanguage(current, target, name) {
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
            }, LANGUAGE_RETRY_MS);
        } else {
            location.replace(target.url.href);
        }
    }

    /**
     * Validate page-provided URLs; malformed or non-HTTP values are rejected.
     * @param {unknown} value Candidate URL.
     * @param {string|URL} [base] Resolution base.
     * @returns {URL|null}
     */
    function httpUrl(value, base = document.baseURI || location.href) {
        if (typeof value !== 'string' || !value.trim()) return null;
        try {
            const url = new URL(value.trim(), base);
            return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url : null;
        } catch (error) {
            // Malformed page URLs are expected input, not operational failures.
            if (error.name === 'TypeError') return null;
            throw error;
        }
    }

    function mergeDownloadEntry(entries, entry) {
        const previous = entries.get(entry.url);
        entries.set(entry.url, {
            ...previous, ...entry,
            // A URL also found directly on the page is no longer only an inferred candidate.
            inferred: previous ? !!previous.inferred && !!entry.inferred : !!entry.inferred,
            origins: [...new Set([...(previous?.origins || []), ...(entry.origins || [])])],
        });
    }

    function rememberDownloadResource(value) {
        const url = httpUrl(value);
        if (!url || downloadFragments.has(url.href) || !/\.(?:m3u8|mp4|webm|m4v|mov|mpd)$/i.test(url.pathname) || downloadResources.has(url.href)) return false;
        downloadResources.add(url.href);
        return true;
    }

    function addDownloadSource(entries, value, origin, inferred = false) {
        const url = httpUrl(value);
        if (!url || !/\.(?:m3u8|mp4|webm|m4v|mov|mpd)$/i.test(url.pathname)) return;
        const extension = url.pathname.match(/\.([^.]+)$/)[1].toUpperCase();
        mergeDownloadEntry(entries, { url: url.href, label: extension === 'M3U8' ? 'HLS 播放列表' : `${extension} 视频`, origins: [origin], inferred });
    }

    function addDownloadSources(entries, sourceValue, origin) {
        if (Array.isArray(sourceValue)) {
            for (const sourceItem of sourceValue) addDownloadSources(entries, sourceItem, origin);
            return;
        }
        if (sourceValue && typeof sourceValue === 'object') {
            addDownloadSource(entries, sourceValue.src || sourceValue.url, origin);
            if (Array.isArray(sourceValue.sources)) addDownloadSources(entries, sourceValue.sources, origin);
            return;
        }
        addDownloadSource(entries, sourceValue, origin);
    }

    function collectScriptSources(add) {
        const scripts = [...document.querySelectorAll('script:not([src])')].map(node => node.textContent);
        scripts.forEach((script, index) => {
            const origin = `内联脚本 ${index + 1}`;
            const text = script.replace(/\\\//g, '/').replace(/\\(?:u002f|x2f)/gi, '/').replace(/\\(?:u0026|x26)/gi, '&').replace(/&amp;/g, '&');
            for (const match of text.matchAll(/https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4|webm|m4v|mov|mpd)(?:\?[^\s"'<>\\]*)?/gi)) add(match[0], origin);
            for (const match of text.matchAll(/["']((?:\/|\.\.?\/)[^\s"'<>\\]+?\.(?:m3u8|mp4|webm|m4v|mov|mpd)(?:\?[^\s"'<>\\]*)?)["']/gi)) add(match[1], origin);

            // Reference: https://sleazyfork.org/zh-CN/scripts/528160-missav-video-download-tool/code
            // Keep all valid UUID candidates alongside literal sources, without executing scripts.
            for (const match of script.matchAll(/\b([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})[^a-z0-9]{1,2}seek\b/gi)) {
                add(`https://surrit.com/${match[1]}/playlist.m3u8`, `${origin}（UUID 推测）`, true);
            }
        });
    }

    /**
     * Collect supported sources with provenance, without fetching video bytes.
     * @returns {Array<DownloadEntry>}
     */
    function collectDownloadLinks() {
        if (!video) return [];
        const entries = new Map();
        const add = (value, origin, inferred = false) => addDownloadSource(entries, value, origin, inferred);
        const addSources = (value, origin) => addDownloadSources(entries, value, origin);
        // Collect every supported source, including previews; never choose a winner for the user.
        const sourceKeys = new Set(['source', 'source1080', 'source720', 'source480', 'source360', 'source1280', 'source842', ...Object.getOwnPropertyNames(unsafeWindow).filter(key => /^source\d*$/.test(key))]);
        for (const key of sourceKeys) {
            try { addSources(unsafeWindow[key], `页面变量 ${key}`); } catch (error) { console.warn(PREFIX, `无法读取视频源 ${key}`, error); }
        }
        for (const instance of [unsafeWindow.hls, player?.hls]) {
            add(instance?.url, 'HLS 播放器');
            for (const level of instance?.levels || []) addSources(level.url, 'HLS 播放器画质');
        }
        addSources(player?.source, '播放器 source');
        const videos = [...new Set([video, ...document.querySelectorAll('video')])];
        videos.forEach((media, index) => {
            const origin = `视频元素 ${index + 1}`;
            add(media.currentSrc, origin);
            add(media.src, origin);
            for (const node of media.querySelectorAll('source[src]')) add(node.src, origin);
        });
        for (const node of document.querySelectorAll('a[href], [data-src], [data-source], [data-video]')) {
            if (downloadPanel?.contains(node)) continue;
            for (const attribute of ['href', 'data-src', 'data-source', 'data-video']) add(node.getAttribute(attribute), '页面链接 / 属性');
        }
        for (const resource of window.performance?.getEntriesByType('resource') || []) rememberDownloadResource(resource.name);
        for (const url of downloadResources) add(url, '资源请求');

        collectScriptSources(add);
        return [...entries.values()];
    }

    function parseDownloadVariant(stream, line, lines, base) {
        const url = httpUrl(line, base);
        const height = stream.match(/(?:[:,])RESOLUTION=\d+x(\d+)/i)?.[1];
        const name = stream.match(/(?:[:,])NAME="([^"]+)"/i)?.[1];
        const bandwidth = stream.match(/(?:[:,])AVERAGE-BANDWIDTH=(\d+)/i)?.[1] || stream.match(/(?:[:,])BANDWIDTH=(\d+)/i)?.[1];
        const label = height ? `${height}P` : name || (bandwidth ? `${Math.round(Number(bandwidth) / 1000)} kbps` : 'HLS 分画质');
        const audioGroup = stream.match(/(?:[:,])AUDIO="([^"]+)"/i)?.[1];
        const audio = audioGroup && lines.find(item => item.startsWith('#EXT-X-MEDIA:') && item.includes('TYPE=AUDIO') && item.includes(`GROUP-ID="${audioGroup}"`) && /URI="/.test(item));
        const audioUrl = audio ? httpUrl(audio.match(/URI="([^"]+)"/)?.[1], base)?.href : undefined;
        if (!url) return null;
        return {
            url: url.href, label, kind: 'hls', bandwidth: Number(bandwidth) || undefined,
            resolution: stream.match(/(?:[:,])RESOLUTION=(\d+x\d+)/i)?.[1], audioUrl,
        };
    }

    /**
     * Parse video variants, preserving signed URLs and separate audio tracks.
     * @param {string} text Playlist response body.
     * @param {string} base Final response URL used to resolve relative references.
     * @returns {Array<DownloadEntry>}
     * @throws {Error} If the input or M3U8 header is invalid.
     */
    function parseDownloadPlaylist(text, base) {
        if (typeof text !== 'string' || !httpUrl(base)) throw new TypeError('播放列表文本或基础地址无效');
        const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(line => line.trim());
        if (lines[0] !== '#EXTM3U') throw new Error('响应不是有效的 M3U8 播放列表');
        const entries = new Map();
        let stream = null;
        for (const line of lines.slice(1)) {
            if (line.startsWith('#EXT-X-STREAM-INF:')) {
                stream = line;
                continue;
            }
            if (!line || line.startsWith('#')) continue;
            // Media segments and separate audio/subtitle playlists are not video variants.
            const variant = stream === null ? null : parseDownloadVariant(stream, line, lines, base);
            if (variant && !entries.has(variant.url)) entries.set(variant.url, variant);
            stream = null;
        }
        return [...entries.values()];
    }

    /**
     * Parse media segments in playback order and classify download restrictions.
     * @param {string} text Playlist response body.
     * @param {string} base Final response URL.
     * @returns {object}
     * @throws {Error} If playlist validation fails.
     */
    function parseDownloadManifest(text, base) {
        const variants = parseDownloadPlaylist(text, base);
        const lines = text.trim().split(/\r?\n/).map(line => line.trim());
        const segments = [];
        let duration = 0;
        let segmentDuration = null;
        for (const line of lines) {
            if (line.startsWith('#EXTINF:')) segmentDuration = Number(line.slice(8).split(',')[0]);
            else if (line && !line.startsWith('#') && segmentDuration !== null) {
                const url = httpUrl(line, base);
                if (url && Number.isFinite(segmentDuration) && segmentDuration >= 0) {
                    segments.push({ url: url.href, duration: segmentDuration });
                    duration += segmentDuration;
                }
                segmentDuration = null;
            }
        }
        const map = lines.find(line => line.startsWith('#EXT-X-MAP:'));
        const initUrl = map ? httpUrl(map.match(/URI="([^"]+)"/)?.[1], base)?.href : undefined;
        const encrypted = lines.some(line => line.startsWith('#EXT-X-KEY:') && !/(?:[:,])METHOD=NONE(?:,|$)/.test(line));
        const byteRanges = lines.some(line => line.startsWith('#EXT-X-BYTERANGE:')) || !!map?.includes('BYTERANGE=');
        const discontinuity = lines.includes('#EXT-X-DISCONTINUITY') || new Set(lines.filter(line => line.startsWith('#EXT-X-MAP:'))).size > 1;
        const live = !variants.length && !lines.includes('#EXT-X-ENDLIST');
        return { variants, segments, initUrl, duration: duration || undefined, encrypted, byteRanges, discontinuity, live, kind: variants.length ? 'hls-master' : 'hls-media' };
    }

    function formatVideoSize(bytes, estimated = false) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '未知';
        const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
        const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${estimated ? '约 ' : ''}${(bytes / 1024 ** index).toFixed(index ? 2 : 0)} ${units[index]}${estimated ? '（估算）' : ''}`;
    }

    function formatVideoDuration(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) return '未知';
        const total = Math.round(seconds);
        return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(part => String(part).padStart(2, '0')).join(':');
    }

    /**
     * Combine cached metadata and bitrate estimates without guessing unknown sizes.
     * @param {DownloadEntry} entry Discovered file or playlist.
     * @returns {object}
     */
    function downloadDetails(entry) {
        const result = downloadCache.get(entry.url);
        const manifest = result?.manifest;
        const isHls = entry.kind === 'hls' || /\.m3u8$/i.test(new URL(entry.url).pathname);
        const duration = manifest?.duration || result?.details?.duration;
        const estimatedBytes = !manifest?.live && duration && entry.bandwidth ? duration * entry.bandwidth / 8 : undefined;
        return {
            kind: manifest?.kind || (isHls ? 'hls' : /\.mpd$/i.test(new URL(entry.url).pathname) ? 'dash' : 'file'),
            duration, manifest, error: result?.error,
            size: result?.details?.size || estimatedBytes,
            estimated: !result?.details?.size && !!estimatedBytes,
            resolution: entry.resolution || result?.details?.resolution,
        };
    }

    function reportDownload(text) {
        report('download', text);
        const status = downloadPanel?.querySelector('[data-download-status]');
        if (status && status.textContent !== text) status.textContent = text;
    }

    function ensureDownloadButton() {
        if (downloadButton?.isConnected) return;
        ensureBrandStyles();
        downloadButton = document.createElement('button');
        downloadButton.id = 'coserops-download-button';
        downloadButton.type = 'button';
        downloadButton.textContent = 'CoserOps MissAV\n视频下载';
        downloadButton.setAttribute('aria-haspopup', 'dialog');
        downloadButton.addEventListener('click', openDownloadPanel);
        document.body.append(downloadButton);
    }

    function openDownloadPanel() {
        if (!video) return;
        ensureDownloadPanel();
        if (!downloadPanel.open) downloadPanel.showModal();
        updateDownloadLinks();
        startDownloadDetails();
    }

    function ensureDownloadPanel() {
        if (downloadPanel?.isConnected) return;
        ensureBrandStyles();
        if (!document.getElementById('coserops-download-style')) {
            const sheet = document.createElement('style');
            sheet.id = 'coserops-download-style';
            sheet.textContent = DOWNLOAD_STYLES;
            document.head.append(sheet);
        }
        downloadPanel = document.createElement('dialog');
        downloadPanel.id = 'coserops-downloads';
        downloadPanel.setAttribute('aria-labelledby', 'coserops-download-title');
        downloadPanel.innerHTML = DOWNLOAD_MARKUP;
        downloadPanel.querySelector('[data-download-refresh]').addEventListener('click', () => updateDownloadLinks(true));
        downloadPanel.querySelector('[data-download-close]').addEventListener('click', () => downloadPanel.close());
        downloadPanel.addEventListener('close', cancelDownloadMetadata);
        document.body.append(downloadPanel);
        downloadKey = '';
    }

    /**
     * Build rows for the current discovery result and apply cached metadata.
     * @param {Array<DownloadEntry>} entries Discovered downloads.
     * @returns {void}
     */
    function renderDownloadLinks(entries) {
        displayedDownloads = entries;
        downloadRows.clear();
        const rowsContainer = downloadPanel.querySelector('[data-download-list]');
        rowsContainer.replaceChildren();
        for (const [index, entry] of entries.entries()) {
            rowsContainer.append(createDownloadRow(entry, index));
            renderDownloadDetails(entry);
        }
    }

    async function copyDownloadLink(entry, input, copy) {
        copy.disabled = true;
        try {
            await navigator.clipboard.writeText(entry.url);
            copy.textContent = '已复制';
        } catch (error) {
            console.warn(PREFIX, '剪贴板不可用，请手动复制', error);
            input.focus();
            input.select();
            copy.textContent = '请手动复制';
        } finally { copy.disabled = false; }
    }

    async function copyDownloadCommand(entry, input, command) {
        const text = videoDownloadCommand(entry);
        try {
            await navigator.clipboard.writeText(text);
            command.textContent = '命令已复制';
        } catch (error) {
            console.warn(PREFIX, '剪贴板不可用，请手动复制命令', error);
            input.value = text;
            input.focus();
            input.select();
            command.textContent = '请手动复制命令';
        }
    }

    function createDownloadActions(entry, input) {
        const actions = document.createElement('div');
        actions.className = 'co-download-actions';
        const save = document.createElement('button');
        save.type = 'button';
        save.setAttribute('data-video-save', '');
        save.addEventListener('click', () => saveVideo(entry));
        const command = document.createElement('button');
        command.type = 'button';
        command.textContent = '复制下载命令';
        command.addEventListener('click', () => copyDownloadCommand(entry, input, command));
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = '取消下载';
        cancel.addEventListener('click', () => downloadJobs.get(entry.url)?.controller.abort());
        const job = document.createElement('p');
        job.className = 'co-download-job';
        job.setAttribute('role', 'status');
        actions.append(save, command, cancel);
        return { actions, save, cancel, job };
    }

    function createDownloadRow(entry, index) {
        const row = document.createElement('div');
        row.className = 'co-download-row';
        const link = document.createElement('a');
        link.href = entry.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `${index + 1}. ${entry.label}${entry.inferred ? '（待验证）' : ''}`;
        const input = document.createElement('input');
        input.type = 'text';
        input.readOnly = true;
        input.value = entry.url;
        input.setAttribute('aria-label', `${index + 1}. ${entry.label} 下载链接`);
        input.addEventListener('click', () => input.select());
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.textContent = '复制链接';
        copy.addEventListener('click', () => copyDownloadLink(entry, input, copy));
        const origin = document.createElement('p');
        origin.className = 'co-download-origin';
        origin.textContent = `来源：${(entry.origins || []).join('；')}`;
        const facts = document.createElement('dl');
        facts.className = 'co-download-facts';
        const { actions, save, cancel, job } = createDownloadActions(entry, input);
        row.append(link, input, copy, origin, facts, actions, job);
        downloadRows.set(entry.url, { element: row, link, input, facts, save, cancel, job });
        return row;
    }

    /**
     * Stably order existing rows by descending known size; unknown sizes remain last.
     * @returns {void}
     */
    function sortDownloadRows() {
        const rowsContainer = downloadPanel.querySelector('[data-download-list]');
        const entries = displayedDownloads.map(entry => {
            const info = downloadDetails(entry);
            const size = info.kind !== 'hls-master' && Number.isFinite(info.size) && info.size > 0 ? info.size : 0;
            return { entry, size };
        }).sort((leftEntry, rightEntry) => rightEntry.size - leftEntry.size);
        let index = 0;
        for (const { entry } of entries) {
            const row = downloadRows.get(entry.url);
            if (!row) continue;
            row.link.textContent = `${index + 1}. ${entry.label}${entry.inferred ? '（待验证）' : ''}`;
            row.input.setAttribute('aria-label', `${index + 1}. ${entry.label} 下载链接`);
            if (rowsContainer.children[index] !== row.element) rowsContainer.insertBefore(row.element, rowsContainer.children[index] || null);
            index++;
        }
    }

    function renderDownloadDetails(entry) {
        const row = downloadRows.get(entry.url);
        if (!row) return;
        const info = downloadDetails(entry);
        const format = info.kind.startsWith('hls') ? 'HLS / M3U8' : info.kind === 'dash' ? 'DASH / MPD' : new URL(entry.url).pathname.split('.').pop().toUpperCase();
        const size = info.kind === 'hls-master' ? '按所选画质计算' : formatVideoSize(info.size, info.estimated);
        const facts = [['格式', format], ['画质', info.resolution || (entry.label.match(/\d+P/)?.[0] || '未知')], ['时长', info.manifest?.live ? '直播 / 未结束' : formatVideoDuration(info.duration)], ['视频大小', size]];
        row.facts.replaceChildren();
        for (const [name, value] of facts) {
            const field = document.createElement('div');
            const term = document.createElement('dt');
            const description = document.createElement('dd');
            term.textContent = name;
            description.textContent = value;
            field.append(term, description);
            row.facts.append(field);
        }
        const job = downloadJobs.get(entry.url);
        const reason = browserDownloadReason(entry, info);
        row.save.textContent = job?.running ? '下载中…' : info.kind === 'hls-master' ? '请选择下方画质' : '下载视频';
        row.save.disabled = !!job?.running || !!reason;
        row.cancel.hidden = !job?.running;
        sortDownloadRows();
        row.job.textContent = job?.message || (reason ? `${reason}。可复制下载命令，在安装 FFmpeg 的终端运行。` : `${info.error ? `文件信息获取失败（${info.error.message}），大小未知。` : ''}点击“下载视频”后选择保存位置；也可复制链接或下载命令。`);
    }

    function cancelDownloadRequest() {
        if (!downloadRequest) return;
        for (const task of downloadRequest.tasks) {
            clearTimeout(task.timer);
            task.controller.abort();
        }
        downloadRequest = null;
    }

    function cancelDownloadMetadata() {
        if (!downloadMetadataRequest) return;
        for (const task of downloadMetadataRequest.tasks) {
            clearTimeout(task.timer);
            task.controller.abort();
        }
        downloadMetadataRequest = null;
    }

    function positiveContentLength(value) {
        if (!/^\d+$/.test(value || '')) return undefined;
        const size = Number(value);
        return Number.isSafeInteger(size) && size > 0 ? size : undefined;
    }
    function validateMetadataResponse(response) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('源地址返回了网页');
    }

    /**
     * Probe HEAD, then one byte if necessary; never consume a full video body.
     * @param {string} url Validated media URL.
     * @param {AbortController} controller Owns timeout and cancellation.
     * @returns {Promise<number|undefined>}
     * @throws {Error} On network, HTTP, HTML-response or cancellation failures.
     */
    async function readVideoFileSize(url, controller) {
        const head = await fetch(url, { method: 'HEAD', signal: controller.signal });
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (![405, 501].includes(head.status)) {
            validateMetadataResponse(head);
            const size = positiveContentLength(head.headers.get('content-length'));
            if (size !== undefined) return size;
        }

        // Some CDNs reject HEAD. Request only one byte and read the whole-file length
        // from Content-Range, never the one-byte response's Content-Length.
        let response;
        try {
            response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: controller.signal });
            if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            validateMetadataResponse(response);
            if (response.status === 206) {
                const range = response.headers.get('content-range')?.match(/^bytes\s+0-0\/(\d+)$/i);
                return range ? positiveContentLength(range[1]) : undefined;
            }
            return response.status === 200 ? positiveContentLength(response.headers.get('content-length')) : undefined;
        } finally {
            // A server may ignore Range and send the full video. Stop at the headers;
            // metadata lookup must not consume its body or become a video download.
            controller.abort();
            if (response?.body) await response.body.cancel().catch(error => console.warn(PREFIX, '下载资源清理失败', error));
        }
    }

    async function fetchDownloadDetails(entry, info, controller) {
        const isHls = info.kind === 'hls';
        if (isHls) {
            const response = await fetch(entry.url, { method: 'GET', signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const manifest = parseDownloadManifest(await response.text(), response.url || entry.url);
            return { variants: manifest.variants, manifest };
        } else {
            const size = await readVideoFileSize(entry.url, controller);
            const media = [...document.querySelectorAll('video')].find(item => item.currentSrc === entry.url || item.src === entry.url);
            return { details: {
                size,
                duration: Number.isFinite(media?.duration) ? media.duration : undefined,
                resolution: media?.videoWidth && media?.videoHeight ? `${media.videoWidth}x${media.videoHeight}` : undefined,
            } };
        }
    }

    function mergeMetadataVariants(entry, result, request) {
        if (!result.variants?.length) return;
        const merged = new Map(displayedDownloads.map(item => [item.url, item]));
        for (const variant of result.variants) {
            const item = { ...variant, origins: [`画质列表 ${entry.url}`] };
            mergeDownloadEntry(merged, item);
            if (!request.seen.has(item.url)) {
                request.seen.add(item.url);
                request.queue.push(item);
            }
        }
        renderDownloadLinks([...merged.values()]);
    }

    async function runDownloadMetadataWorker(request) {
        while (downloadMetadataRequest === request && request.queue.length) {
            const entry = request.queue.shift();
            const info = downloadDetails(entry);
            if (info.kind === 'dash') continue;
            let result = downloadCache.get(entry.url);
            if (result?.error) continue;
            const task = { controller: new AbortController(), timer: null };
            request.tasks.add(task);
            try {
                if (!result) {
                    task.timer = setTimeout(() => task.controller.abort(), REQUEST_TIMEOUT_MS);
                    result = await fetchDownloadDetails(entry, info, task.controller);
                }
                if (downloadMetadataRequest !== request) return;
                downloadCache.set(entry.url, result);
                mergeMetadataVariants(entry, result, request);
            } catch (error) {
                if (downloadMetadataRequest !== request) return;
                downloadCache.set(entry.url, { error });
            } finally {
                clearTimeout(task.timer);
                request.tasks.delete(task);
                if (downloadMetadataRequest === request) renderDownloadDetails(entry);
            }
        }
    }

    /**
     * Read metadata with bounded workers and suppress stale request results.
     * @returns {Promise<void>}
     */
    async function startDownloadDetails() {
        if (!downloadPanel?.open || downloadRequest || downloadMetadataRequest) return;
        const request = { tasks: new Set(), queue: [...displayedDownloads], seen: new Set(displayedDownloads.map(entry => entry.url)) };
        downloadMetadataRequest = request;
        const worker = () => runDownloadMetadataWorker(request);
        await Promise.all(Array.from({ length: Math.min(DOWNLOAD_WORKERS, request.queue.length) }, worker));
        if (downloadMetadataRequest === request) {
            downloadMetadataRequest = null;
            reportDownload(`共 ${displayedDownloads.length} 条视频链接；信息已读取，无法获取的大小显示“未知”，请选择要下载的视频`);
        }
    }

    function browserDownloadReason(entry, info = downloadDetails(entry)) {
        if (info.kind === 'hls-master') return '这是多画质播放列表，请选择对应的分画质条目';
        if (info.kind === 'dash') return '此格式请使用 FFmpeg 下载';
        if (info.kind === 'hls') return info.error ? '播放列表读取失败，请重新获取或使用下载命令' : '正在读取播放列表信息';
        const manifest = info.manifest;
        if (manifest) {
            if (manifest.live) return '直播或尚未结束的播放列表请使用 FFmpeg 下载';
            if (manifest.encrypted || manifest.byteRanges || manifest.discontinuity || entry.audioUrl) return '此播放列表含加密、独立音轨或特殊分段，请使用 FFmpeg 下载';
            if (!manifest.segments.length) return '播放列表中没有可下载的视频片段';
        }
        if (typeof window.showSaveFilePicker !== 'function' && info.size > MEMORY_DOWNLOAD_LIMIT) return '此浏览器无法直接写入大文件，请使用 FFmpeg 下载';
        return '';
    }

    function videoFileName(entry, extension = 'mp4') {
        const title = (document.title || 'video').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 100).trim() || 'video';
        const label = entry.label.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 40);
        return `${title} - ${label}.${extension}`;
    }

    /**
     * Build a shell-quoted FFmpeg command with HLS-compatible extension options.
     * @param {DownloadEntry} entry Selected source, optionally with separate audio.
     * @returns {string}
     */
    function videoDownloadCommand(entry) {
        const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
        // FFmpeg 8 checks both segment allowlists and the extension against the detected
        // media format. MissAV can serve MPEG-TS as video0.jpeg; scope these options to HLS.
        const input = (url, hls) => `${hls ? '-f hls -allowed_extensions ALL -allowed_segment_extensions ALL -extension_picky 0 ' : ''}-referer ${quote(location.href)} -i ${quote(url)}`;
        const hls = downloadDetails(entry).kind.startsWith('hls');
        return `ffmpeg -n ${input(entry.url, hls)}${entry.audioUrl ? ` ${input(entry.audioUrl, true)} -map 0:v:0 -map 1:a:0` : ''} -c copy ${quote(videoFileName(entry))}`;
    }

    /**
     * Write sequential chunks with backpressure or enforce the memory fallback limit.
     * @param {ReadableStream<Uint8Array>} stream Response body.
     * @param {DownloadEntry} entry Source used to update its row.
     * @param {object} job Cancellation and progress state.
     * @param {FileSystemWritableFileStream|null} writer Output stream, if supported.
     * @param {Array<Uint8Array>} chunks Memory fallback buffers.
     * @param {Function} refreshTimeout Reset the inactivity deadline.
     * @param {string} progressPrefix Optional segment progress.
     * @returns {Promise<void>}
     * @throws {Error} On stream/write failure, cancellation or memory limit.
     */
    async function consumeVideoStream(stream, entry, job, writer, chunks, refreshTimeout, progressPrefix) {
        const reader = stream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (job.controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                if (done) break;
                refreshTimeout();
                job.bytes += value.byteLength;
                if (writer) await writer.write(value);
                else {
                    if (job.bytes > MEMORY_DOWNLOAD_LIMIT) throw new Error('文件超过浏览器内存下载上限 512 MiB，请复制下载命令使用 FFmpeg');
                    chunks.push(value);
                }
                job.message = `${progressPrefix}已下载 ${formatVideoSize(job.bytes)}`;
                const row = downloadRows.get(entry.url);
                if (row) row.job.textContent = job.message;
            }
        } finally {
            await reader.cancel().catch(error => console.warn(PREFIX, '下载资源清理失败', error));
            reader.releaseLock();
        }
    }

    async function transferVideoSources(entry, job, sources, manifest, writer, chunks, refreshTimeout) {
        for (const [index, url] of sources.entries()) {
            if (job.controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            if (manifest) {
                downloadFragments.add(url);
                downloadResources.delete(url);
            }
            refreshTimeout();
            const response = await fetch(url, { signal: job.controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('下载源返回了网页');
            if (!response.body) throw new Error('浏览器未提供下载数据流');
            await consumeVideoStream(response.body, entry, job, writer, chunks, refreshTimeout, manifest ? `片段 ${index + 1} / ${sources.length} · ` : '');
        }
    }

    function saveVideoBlob(chunks, extension, filename) {
        const blobUrl = URL.createObjectURL(new Blob(chunks, { type: extension === 'ts' ? 'video/mp2t' : 'application/octet-stream' }));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), BLOB_RELEASE_DELAY_MS);
    }

    function videoSavePlan(entry, manifest) {
        const extension = manifest ? (manifest.initUrl ? 'mp4' : 'ts') : new URL(entry.url).pathname.split('.').pop().toLowerCase();
        const filename = videoFileName(entry, extension);
        const sources = manifest ? [...(manifest.initUrl ? [manifest.initUrl] : []), ...manifest.segments.map(item => item.url)] : [entry.url];
        return { manifest, extension, filename, sources };
    }

    function refreshDownloadTimeout(job) {
        clearTimeout(job.timer);
        job.timer = setTimeout(() => { job.timedOut = true; job.controller.abort(); }, DOWNLOAD_IDLE_TIMEOUT_MS);
    }

    /**
     * Open the picker in the click gesture, then stream ordered bytes and report failures.
     * @param {DownloadEntry} entry Validated source selected by the user.
     * @returns {Promise<void>}
     */
    async function saveVideo(entry) {
        const info = downloadDetails(entry);
        if (browserDownloadReason(entry, info) || downloadJobs.get(entry.url)?.running) return;
        const job = { controller: new AbortController(), running: true, message: '请选择保存位置…', bytes: 0, timer: null };
        downloadJobs.set(entry.url, job);
        renderDownloadDetails(entry);
        let writer = null;
        const chunks = [];
        const { manifest, extension, filename, sources } = videoSavePlan(entry, info.manifest);
        const refreshTimeout = () => refreshDownloadTimeout(job);
        try {
            // Call the picker before awaiting network work so the click remains a user gesture.
            if (typeof window.showSaveFilePicker === 'function') {
                const handle = await window.showSaveFilePicker({ suggestedName: filename });
                if (job.controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                writer = await handle.createWritable();
            }
            await transferVideoSources(entry, job, sources, manifest, writer, chunks, refreshTimeout);
            if (job.controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            if (writer) {
                await writer.close();
                writer = null;
                job.message = `已保存 ${filename} · ${formatVideoSize(job.bytes)}`;
            } else {
                saveVideoBlob(chunks, extension, filename);
                job.message = `已交给浏览器保存 ${filename} · ${formatVideoSize(job.bytes)}`;
            }
        } catch (error) {
            job.controller.abort();
            if (writer) await writer.abort().catch(error => console.warn(PREFIX, '下载资源清理失败', error));
            job.message = job.timedOut ? '下载超时，可重试或使用 FFmpeg 下载命令' : error.name === 'AbortError' ? '下载已取消' : `下载失败：${error.message}；可复制下载命令重试`;
        } finally {
            clearTimeout(job.timer);
            job.running = false;
            chunks.length = 0;
            renderDownloadDetails(entry);
        }
    }

    /**
     * Cancel requests and jobs before removing the previous video download UI.
     * @returns {void}
     */
    function resetDownloadLinks() {
        cancelDownloadRequest();
        cancelDownloadMetadata();
        for (const job of downloadJobs.values()) if (job.running) job.controller.abort();
        downloadJobs.clear();
        downloadRows.clear();
        displayedDownloads = [];
        downloadPanel?.remove();
        downloadPanel = null;
        downloadButton?.remove();
        downloadButton = null;
        downloadKey = '';
        downloadCache.clear();
    }

    function renderDownloadProgress(request) {
        renderDownloadLinks([...request.entries.values()]);
        let status = `已展示 ${request.entries.size} 条视频链接，请自行选择`;
        if (request.completed < request.total) status += `；正在解析播放列表 ${request.completed} / ${request.total}`;
        if (request.failed) status += `；${request.failed} 个播放列表解析失败或超时，原链接已保留（推测链接仍待验证）`;
        reportDownload(status);
    }

    async function loadDownloadPlaylist(entry, request) {
        const task = { controller: new AbortController(), timer: null };
        request.tasks.add(task);
        try {
            let result = downloadCache.get(entry.url);
            if (!result) {
                task.timer = setTimeout(() => task.controller.abort(), REQUEST_TIMEOUT_MS);
                const response = await fetch(entry.url, { signal: task.controller.signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const manifest = parseDownloadManifest(await response.text(), response.url || entry.url);
                result = { variants: manifest.variants, manifest };
            }
            if (downloadRequest !== request) return;
            if (result.error) throw result.error;
            downloadCache.set(entry.url, result);
            if (entry.inferred) request.entries.set(entry.url, { ...request.entries.get(entry.url), inferred: false });
            for (const variant of result.variants) mergeDownloadEntry(request.entries, { ...variant, origins: [`画质列表 ${entry.url}`] });
        } catch (error) {
            if (downloadRequest !== request) return;
            downloadCache.set(entry.url, { error });
            request.failed++;
            console.warn(PREFIX, '下载画质解析失败', error);
        } finally {
            clearTimeout(task.timer);
            request.tasks.delete(task);
            if (downloadRequest === request) {
                request.completed++;
                renderDownloadProgress(request);
            }
        }
    }

    async function loadDownloadPlaylists(playlists, request) {
        const queue = [...playlists];
        const worker = async () => {
            while (downloadRequest === request && queue.length) await loadDownloadPlaylist(queue.shift(), request);
        };
        // Parse every discovered playlist, with at most three concurrent requests.
        await Promise.all(Array.from({ length: Math.min(DOWNLOAD_WORKERS, queue.length) }, worker));
        if (downloadRequest === request) {
            downloadRequest = null;
            void startDownloadDetails();
        }
    }

    /**
     * Refresh discovery and cancel obsolete metadata work before resolving variants.
     * @param {boolean} [force=false] Clear cached metadata and retry failures.
     * @returns {void}
     */
    function updateDownloadLinks(force = false) {
        if (!video) return;
        ensureDownloadPanel();
        const entries = collectDownloadLinks();
        const key = JSON.stringify(entries);
        if (!force && key === downloadKey) {
            if (!entries.length && Date.now() >= playerWaitDeadline) reportDownload('未找到下载链接，请播放视频后点击重新获取');
            return;
        }
        downloadKey = key;
        cancelDownloadRequest();
        cancelDownloadMetadata();
        if (force) downloadCache.clear();
        renderDownloadLinks(entries);
        if (!entries.length) {
            reportDownload('等待视频源，请播放视频后点击重新获取');
            return;
        }
        const playlists = entries.filter(entry => /\.m3u8$/i.test(new URL(entry.url).pathname));
        if (!playlists.length) {
            reportDownload(`已展示 ${entries.length} 条视频链接，请自行选择`);
            void startDownloadDetails();
            return;
        }
        const request = { tasks: new Set(), entries: new Map(entries.map(entry => [entry.url, entry])), completed: 0, failed: 0, total: playlists.length };
        downloadRequest = request;
        renderDownloadProgress(request);
        void loadDownloadPlaylists(playlists, request);
    }

    function resetSource() {
        // Switching quality can reload the same video; keep its pending confirmation.
        if (qualityRequest?.video === video && qualityRequest?.player === player) {
            schedule();
            return;
        }
        qualityApplied = false;
        availableQualities = [];
        playerWaitDeadline = Date.now() + PLAYER_WAIT_MS;
        report('quality', '等待视频画质列表');
        schedule();
    }

    function bindVideo(nextVideo) {
        if (nextVideo === video) return;
        cancelQualityRequest();
        resetDownloadLinks();
        if (video) for (const event of ['loadstart', 'loadedmetadata']) video.removeEventListener(event, resetSource);
        restoreWidth();
        video = nextVideo;
        if (video) for (const event of ['loadstart', 'loadedmetadata']) video.addEventListener(event, resetSource);
        resetSource();
    }

    /**
     * Reconcile the current player/video and apply independent enhancements.
     * @returns {void}
     */
    function inspect() {
        bindVideo(document.querySelector('video.player') || document.querySelector('.plyr video'));
        const candidate = unsafeWindow.player;
        bindPlayer(video && candidate && (!candidate.media || candidate.media === video) ? candidate : null);
        const nextSource = video?.currentSrc || video?.src || '';
        if (currentVideoSource !== nextSource) {
            currentVideoSource = nextSource;
            resetSource();
        }
        if (!video) {
            report('pause', '当前页面无播放器，无需处理');
            report('wide', '当前页面无播放器，无需处理');
            report('quality', '偏好已保存，将在视频加载后应用');
            report('download', '当前页面无播放器，无需处理');
            return;
        }
        try {
            ensureDownloadButton();
            if (downloadPanel?.open) updateDownloadLinks();
        } catch (error) { report('download', '下载链接读取失败，可点击重新获取', error); }
        applyWidth();
        applyQuality();
        if (Date.now() >= playerWaitDeadline) {
            if (!wideColumn) report('wide', '未找到参考布局，未修改页面');
        }
    }

    function schedule() {
        if (inspectionTimer !== null) return;
        inspectionTimer = setTimeout(() => { inspectionTimer = null; inspect(); }, INSPECTION_DELAY_MS);
    }

    async function loadPreferences() {
        try {
            const saved = await GM_getValue('preferredQuality', DEFAULT_QUALITY);
            if (!Number.isSafeInteger(saved) || saved <= 0) throw new Error('Invalid stored quality');
            preferredQuality = saved;
        } catch (error) {
            console.warn(PREFIX, '配置读取异常，使用 360P', error);
            report('quality', '配置读取异常，使用 360P；可在设置中重新保存');
        }
        try {
            const savedLanguage = await GM_getValue('preferredLanguage', DEFAULT_LANGUAGE);
            if (typeof savedLanguage !== 'string' || !Object.hasOwn(languageNames, savedLanguage)) throw new Error('Invalid stored language');
            preferredLanguage = savedLanguage;
        } catch (error) {
            report('language', '语言配置读取异常，使用简体中文', error);
        }
    }

    function observeDownloadResources() {
        if (typeof PerformanceObserver !== 'function') return;
        try {
            const resources = new PerformanceObserver(resourceEntries => {
                let changed = false;
                for (const entry of resourceEntries.getEntries()) if (rememberDownloadResource(entry.name)) changed = true;
                if (changed) schedule();
            });
            resources.observe({ type: 'resource', buffered: true });
        } catch (error) { console.warn(PREFIX, '资源监听不可用，可手动重新获取视频链接', error); }
    }

    function observePage(button) {
        const observer = new MutationObserver(records => {
            if (records.some(record => !settingsPanel?.contains(record.target) && !downloadPanel?.contains(record.target) && record.target !== button && record.target !== downloadButton)) schedule();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        observeDownloadResources();
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => { restoreWidth(); schedule(); }, RESIZE_DELAY_MS);
        });
        const poll = setInterval(() => {
            inspect();
            if (Date.now() >= playerWaitDeadline) clearInterval(poll);
        }, PLAYER_POLL_MS);
        setTimeout(applyLanguage, LANGUAGE_RETRY_MS);
    }

    /**
     * Load preferences, register UI and start page observers.
     * @returns {Promise<void>}
     * @throws {Error} If initialization fails; the entry point logs the failure.
     */
    async function start() {
        await loadPreferences();
        ensureBrandStyles();
        GM_registerMenuCommand('设置', openSettings);
        GM_registerMenuCommand('当前版本 / 更新说明', () => showUpdateNotice(true));
        void showUpdateNotice();
        const button = document.createElement('button');
        button.id = 'coserops-settings-button';
        button.type = 'button';
        button.setAttribute('aria-haspopup', 'dialog');
        button.textContent = 'CoserOps MissAV\n播放器脚本设置';
        button.addEventListener('click', openSettings);
        document.body.append(button);
        applyLanguage();
        inspect();
        observePage(button);
    }

    start().catch(error => console.error(PREFIX, '初始化失败', error));
})();
