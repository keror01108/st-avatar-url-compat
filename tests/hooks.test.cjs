'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {install}=require('../index.js');
const {environment}=require('./mock-dom.cjs');
const normal='/thumbnail?type=avatar&file=bot.png';
const high='/characters/bot.png?tm_avatar_hd=2';
const broken='/thumbnail?type=avatar&file=bot.png%3Ftm_avatar_hd%3D2';

test('src and setAttribute are intercepted before native writes; repeated HD requests do not mutate DOM',()=>{
    const e=environment();const img=e.avatar();img.src=normal;const api=install(e.win);e.writes.length=0;
    img.src=high;img.setAttribute('src',high);img.setAttribute('SRC',high);
    assert.equal(img.getAttribute('src'),normal);assert.equal(e.writes.length,0);assert.equal(api.status().suppressedWrites,3);
    img.src='/characters/new.png?tm_avatar_hd=3';
    assert.equal(img.getAttribute('src'),'/thumbnail?type=avatar&file=new.png');assert.equal(e.writes.length,1);
    api.stop();
});

test('malformed thumbnail is repaired even on detached images',()=>{
    const e=environment();const api=install(e.win);const img=new e.Image();img.src=broken;
    assert.equal(img.getAttribute('src'),normal);api.stop();
});

test('offscreen preloads, ordinary images, and edited data sources are untouched',()=>{
    const e=environment();const api=install(e.win);const preload=new e.Image();preload.src=high;
    assert.equal(preload.getAttribute('src'),high);
    const img=e.avatar();img.src='data:image/svg+xml,example';assert.equal(img.getAttribute('src'),'data:image/svg+xml,example');
    img.setAttribute('alt','label');assert.equal(img.getAttribute('alt'),'label');api.stop();
});

test('observer catches parser-like writes; observing the repair does not repeat it',()=>{
    const e=environment();const api=install(e.win);const img=e.avatar();img._native('src',broken);
    const observer=e.observers.find(o=>o.connected);observer.emit([{type:'attributes',target:img}]);
    assert.equal(img.getAttribute('src'),normal);const count=e.writes.length;
    observer.emit([{type:'attributes',target:img}]);assert.equal(e.writes.length,count);api.stop();
});

test('error fallback only retries recognizable malformed URLs once',()=>{
    const e=environment();const api=install(e.win);const img=e.avatar();img._native('src',broken);
    const handler=[...e.handlers.get('error')][0];let stopped=0;
    const event={target:img,stopImmediatePropagation(){stopped++;}};
    handler(event);assert.equal(stopped,1);assert.equal(img.getAttribute('src'),normal);
    handler(event);assert.equal(stopped,1,'normal retry failure is not suppressed');
    const other=e.avatar();other._native('src','/thumbnail?type=avatar&file=missing.png');
    handler({target:other,stopImmediatePropagation(){stopped++;}});assert.equal(stopped,1);api.stop();
});

test('install is idempotent; stopping preserves another extension hook and disables ours inside it',()=>{
    const e=environment();const original=Object.getOwnPropertyDescriptor(e.Image.prototype,'src');
    const api=install(e.win);assert.equal(install(e.win),api);
    const before=e.Element.prototype.setAttribute;
    const later=function(){return before.apply(this,arguments);};e.Element.prototype.setAttribute=later;
    api.stop();assert.equal(e.Element.prototype.setAttribute,later);
    assert.equal(Object.getOwnPropertyDescriptor(e.Image.prototype,'src').set,original.set);
    const img=e.avatar();img.setAttribute('src',broken);assert.equal(img.getAttribute('src'),broken);
    assert.equal(api.active,false);
});
