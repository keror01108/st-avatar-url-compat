/* Avatar URL Compatibility 1.0.0 — MIT license. No external dependencies. */
(function (root, factory) {
    'use strict';
    const exports = factory();
    if (typeof module === 'object' && module.exports) module.exports = exports;
    else exports.install(root);
})(globalThis, function () {
    'use strict';

    const VERSION = '1.0.0';
    const GLOBAL_KEY = 'STAvatarURLCompat';
    const TYPES = new Set(['avatar', 'persona']);
    const NESTED_TOKEN = /\?tm_avatar_hd=\d+(?:&tm_avatar_hd=\d+)*$/;

    function thumbnail(raw, base) {
        try {
            const u = new URL(raw, base);
            if (u.origin !== new URL(base).origin || u.pathname !== '/thumbnail') return null;
            if (!TYPES.has(u.searchParams.get('type'))) return null;
            if (u.searchParams.getAll('file').length !== 1) return null;
            return u;
        } catch { return null; }
    }

    // A current, valid thumbnail may carry a Persona cache token. Keep it verbatim.
    function preserveCurrent(candidate, currentSrc, base) {
        if (typeof currentSrc !== 'string' || !currentSrc) return null;
        const current = thumbnail(currentSrc, base);
        if (!current || NESTED_TOKEN.test(current.searchParams.get('file') || '')) return null;
        if (current.searchParams.get('type') !== candidate.searchParams.get('type')) return null;
        if (current.searchParams.get('file') !== candidate.searchParams.get('file')) return null;
        return currentSrc;
    }

    function normalizeSource(raw, base, chatAvatar = false, currentSrc = '') {
        if (typeof raw !== 'string' || !raw) return null;
        let parsed;
        try { parsed = new URL(raw, base); } catch { return null; }
        if (parsed.origin !== new URL(base).origin) return null;

        let candidate;
        let reason;
        const thumb = thumbnail(raw, base);
        const nestedFile = thumb && thumb.searchParams.get('file');
        if (thumb && NESTED_TOKEN.test(nestedFile || '')) {
            // Known failure: a percent-encoded original-image basename, including
            // its cache query, was encoded a second time as the thumbnail file.
            let file;
            try { file = decodeURIComponent(nestedFile.replace(NESTED_TOKEN, '')); }
            catch { return null; }
            if (!file || /[/\\\u0000]/.test(file)) return null;
            thumb.searchParams.set('file', file);
            candidate = thumb;
            reason = 'nested-hd-query';
        } else if (chatAvatar && /^\d+$/.test(parsed.searchParams.get('tm_avatar_hd') || '')) {
            // Prevent the problematic transition BEFORE a renderer reads img.src.
            // Offscreen Image() preloads and non-chat avatars are left alone.
            const match = parsed.pathname.match(/^\/(characters|User%20Avatars)\/([^/]+)$/i);
            if (!match) return null;
            let file;
            try { file = decodeURIComponent(match[2]); } catch { return null; }
            if (!file || /[/\\\u0000]/.test(file)) return null;
            candidate = new URL('/thumbnail', base);
            candidate.searchParams.set('type', match[1].toLowerCase() === 'characters' ? 'avatar' : 'persona');
            candidate.searchParams.set('file', file);
            reason = 'keep-native-thumbnail';
        } else return null;

        const value = preserveCurrent(candidate, currentSrc, base)
            || candidate.pathname + candidate.search;
        return { value, reason };
    }

    function install(win) {
        if (!win.document || !win.HTMLImageElement || !win.Element) return null;
        if (win[GLOBAL_KEY] && win[GLOBAL_KEY].active) return win[GLOBAL_KEY];

        const imageProto = win.HTMLImageElement.prototype;
        const elementProto = win.Element.prototype;
        const originalSrc = Object.getOwnPropertyDescriptor(imageProto, 'src');
        const originalSetAttribute = elementProto.setAttribute;
        const originalGetAttribute = elementProto.getAttribute;
        let active = true;
        let observer = null;
        let discoveryObserver = null;
        let observedChat = null;
        let corrections = 0;
        let suppressedWrites = 0;
        let recoveredErrors = 0;
        let lastReason = '';
        const retried = new WeakSet();

        function getSrc(img) { return originalGetAttribute.call(img, 'src') || ''; }
        function isAvatar(img) { return Boolean(img.closest('.mesAvatarWrapper')); }
        function fix(img, value) {
            if (!active || !(img instanceof win.HTMLImageElement)) return null;
            return normalizeSource(value, win.location.href, isAvatar(img), getSrc(img));
        }
        function record(result) { corrections += 1; lastReason = result.reason; }

        function patchedSetAttribute(name, value) {
            const result = typeof name === 'string' && name.toLowerCase() === 'src' ? fix(this, value) : null;
            if (result) {
                record(result);
                // A same-value native write still fires MutationObserver. Suppress
                // it so Theme Manager cannot enter a src/reconcile feedback loop.
                if (getSrc(this) === result.value) { suppressedWrites += 1; return; }
                return originalSetAttribute.call(this, name, result.value);
            }
            return originalSetAttribute.apply(this, arguments);
        }

        function patchedSrcSetter(value) {
            const result = fix(this, value);
            if (result) {
                record(result);
                if (getSrc(this) === result.value) { suppressedWrites += 1; return; }
                return originalSrc.set.call(this, result.value);
            }
            return originalSrc.set.call(this, value);
        }

        elementProto.setAttribute = patchedSetAttribute;
        let srcPatched = false;
        if (originalSrc && originalSrc.configurable && originalSrc.set) {
            Object.defineProperty(imageProto, 'src', { ...originalSrc, set: patchedSrcSetter });
            srcPatched = true;
        }

        function repairImage(img) {
            if (!(img instanceof win.HTMLImageElement) || !isAvatar(img)) return;
            const result = fix(img, getSrc(img));
            if (!result || result.value === getSrc(img)) return;
            record(result);
            originalSetAttribute.call(img, 'src', result.value);
        }

        function scan(node) {
            if (!(node instanceof win.Element)) return;
            if (node instanceof win.HTMLImageElement) repairImage(node);
            node.querySelectorAll('.mesAvatarWrapper img, .avatar img').forEach(repairImage);
        }

        function observeChat() {
            if (!active) return;
            const chat = win.document.getElementById('chat');
            if (!chat || chat === observedChat) return;
            observedChat = chat;
            observer?.disconnect();
            observer = new win.MutationObserver(records => {
                for (const record of records) {
                    if (record.type === 'attributes') repairImage(record.target);
                    else record.addedNodes.forEach(scan);
                }
            });
            observer.observe(chat, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
            scan(chat);
            discoveryObserver?.disconnect();
            discoveryObserver = null;
        }

        function onImageError(event) {
            const img = event.target;
            if (!(img instanceof win.HTMLImageElement) || !isAvatar(img) || retried.has(img)) return;
            const result = fix(img, getSrc(img));
            if (!result || result.value === getSrc(img)) return;
            // Fallback for HTML parser/other code that bypasses the JS setters.
            // Genuine failures at an already-correct URL keep ST's normal fallback.
            retried.add(img);
            recoveredErrors += 1;
            record(result);
            event.stopImmediatePropagation();
            originalSetAttribute.call(img, 'src', result.value);
        }

        // Retire only the temporary diagnostics/patch previously supplied for this issue.
        for (const key of ['__stAvatarErrorTraceStop', '__stAvatarURLPatchStop']) {
            if (typeof win[key] === 'function') {
                try { win[key](); } catch { /* Optional previous console helper. */ }
            }
        }
        win.addEventListener('error', onImageError, true);
        observeChat();
        if (!observedChat && win.document.documentElement) {
            discoveryObserver = new win.MutationObserver(observeChat);
            discoveryObserver.observe(win.document.documentElement, { childList: true, subtree: true });
        }

        const api = {
            version: VERSION,
            get active() { return active; },
            status() {
                return {
                    version: VERSION, active, corrections, suppressedWrites, recoveredErrors, lastReason,
                    directSrcHook: Object.getOwnPropertyDescriptor(imageProto, 'src')?.set === patchedSrcSetter,
                    attributeHook: elementProto.setAttribute === patchedSetAttribute,
                    missingAvatars: win.document.querySelectorAll('#chat .mesAvatarWrapper .missing-avatar').length,
                };
            },
            stop() {
                active = false;
                observer?.disconnect();
                discoveryObserver?.disconnect();
                win.removeEventListener('error', onImageError, true);
                // Do not overwrite hooks another extension installed afterwards.
                if (elementProto.setAttribute === patchedSetAttribute) elementProto.setAttribute = originalSetAttribute;
                if (srcPatched && Object.getOwnPropertyDescriptor(imageProto, 'src')?.set === patchedSrcSetter) {
                    Object.defineProperty(imageProto, 'src', originalSrc);
                }
            },
        };
        win[GLOBAL_KEY] = api;
        win.console.info('[Avatar URL Compatibility] ' + VERSION + ' active');
        return api;
    }

    return { VERSION, normalizeSource, install };
});
