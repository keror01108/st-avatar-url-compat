'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSource } = require('../index.js');
const base = 'https://tavern.example/chat';

function thumb(type, file, extra = '') {
    return '/thumbnail?' + new URLSearchParams({ type, file }).toString() + extra;
}

for (const [directory, type] of [['characters', 'avatar'], ['User%20Avatars', 'persona']]) {
    for (const file of ['봇&유저.png', 'A & B #1.png', 'literal%20name.png', '名前?.webp']) {
        test(`${type}: original HD URL keeps the exact filename (${file})`, () => {
            const hd = '/' + directory + '/' + encodeURIComponent(file) + '?tm_avatar_hd=2';
            const result = normalizeSource(hd, base, true);
            assert.equal(new URL(result.value, base).searchParams.get('file'), file);
            assert.equal(new URL(result.value, base).searchParams.get('type'), type);
            assert.equal(normalizeSource(result.value, base, true), null);
            assert.equal(normalizeSource(hd, base, false), null, 'preloads remain high resolution');
        });
        test(`${type}: nested HD query is removed with exactly one decoding pass (${file})`, () => {
            const bad = thumb(type, encodeURIComponent(file) + '?tm_avatar_hd=2');
            const result = normalizeSource(bad, base, false);
            assert.equal(new URL(result.value, base).searchParams.get('file'), file);
            assert.equal(new URL(result.value, base).searchParams.getAll('file').length, 1);
        });
    }
}

test('preserves current Persona cache tokens and exact attribute spelling', () => {
    const current = thumb('persona', 'user.png', '&t=12345');
    assert.equal(normalizeSource('/User%20Avatars/user.png?tm_avatar_hd=2', base, true, current).value, current);
});

test('does not retain the previous character avatar when a different file is requested', () => {
    const result = normalizeSource('/characters/new.png?tm_avatar_hd=2', base, true, thumb('avatar', 'old.png'));
    assert.equal(new URL(result.value, base).searchParams.get('file'), 'new.png');
});

test('leaves ordinary, external, custom, and ambiguous sources unchanged', () => {
    const values = [
        thumb('avatar', 'normal.png'), '/characters/normal.png',
        '/characters/normal.png?tm_avatar_hd=not-a-revision',
        '/backgrounds/image.png?tm_avatar_hd=2',
        'https://other.example/characters/a.png?tm_avatar_hd=2',
        'data:image/png;base64,AA==', 'blob:https://tavern.example/abc',
        '/thumbnail?type=bg&file=bad.png%3Ftm_avatar_hd%3D2',
        '/thumbnail?type=avatar&file=a&file=b%3Ftm_avatar_hd%3D2',
        thumb('avatar', '%ZZ.png?tm_avatar_hd=2'),
        '/characters/dir%2Ffile.png?tm_avatar_hd=2', null,
    ];
    for (const value of values) assert.equal(normalizeSource(value, base, true), null, String(value));
});
