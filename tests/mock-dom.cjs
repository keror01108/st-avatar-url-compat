// Minimal DOM doubles for unit tests. This is not a browser emulator.
'use strict';
function environment() {
    const writes = [];
    const observers = [];
    const handlers = new Map();
    class Element {
        constructor(tag = 'div', classes = []) {
            this.tagName = tag.toUpperCase(); this.attrs = new Map(); this.children = []; this.parentElement = null;
            const values = new Set(classes);
            this.classList = {contains: v=>values.has(v), add:v=>values.add(v), remove:v=>values.delete(v)};
            this.style = {setProperty() {}};
        }
        getAttribute(name) {return this.attrs.get(String(name).toLowerCase()) ?? null;}
        _native(name, value) {name=String(name).toLowerCase();this.attrs.set(name,String(value));writes.push({target:this,name,value:String(value)});}
        setAttribute(name, value) {this._native(name,value);}
        removeAttribute(name) {this.attrs.delete(name);}
        append(child) {this.children.push(child);child.parentElement=this;}
        closest(selector) {let node=this;while(node){if(selector.startsWith('.')&&node.classList.contains(selector.slice(1)))return node;node=node.parentElement;}return null;}
        querySelectorAll(selector) {
            const all=[];const visit=node=>{for(const child of node.children){all.push(child);visit(child);}};visit(this);
            if(selector==='.mes')return all.filter(n=>n.classList.contains('mes'));
            if(selector==='.avatar')return all.filter(n=>n.classList.contains('avatar'));
            if(selector===':scope > img')return this.children.filter(n=>n instanceof Image);
            return all.filter(n=>n instanceof Image && (selector==='img'||n.closest('.mesAvatarWrapper')));
        }
        querySelector(selector) {return this.querySelectorAll(selector)[0]||null;}
        getBoundingClientRect(){return {width:110,height:110,left:0,top:0,right:110,bottom:110};}
        addEventListener() {} removeEventListener() {}
    }
    class Image extends Element {
        constructor(){super('img');this.naturalWidth=110;this.naturalHeight=110;}
        get src(){return new URL(this.getAttribute('src')||'', 'https://tavern.example/').href;}
        set src(value){this._native('src',value);}
        get currentSrc(){return this.src;}
    }
    class MutationObserver {
        constructor(callback){this.callback=callback;this.connected=false;observers.push(this);}
        observe(){this.connected=true;} disconnect(){this.connected=false;}
        emit(records){if(this.connected)this.callback(records);}
    }
    const chat=new Element('div');
    const document={
        baseURI:'https://tavern.example/',documentElement:new Element('html'),
        getElementById:id=>id==='chat'?chat:null,
        querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},
    };
    const win={document,Element,HTMLImageElement:Image,Image,MutationObserver,URL,
        location:{href:'https://tavern.example/'},console:{info(){}},setTimeout,clearTimeout,
        addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,new Set());handlers.get(type).add(fn);},
        removeEventListener(type,fn){handlers.get(type)?.delete(fn);},
        getComputedStyle:()=>({content:'normal',objectFit:'cover'}),
    };
    function avatar(user=false){
        const mes=new Element('div',['mes']);mes.setAttribute('is_user',String(user));
        const wrapper=new Element('div',['mesAvatarWrapper']);const frame=new Element('div',['avatar']);const img=new Image();
        chat.append(mes);mes.append(wrapper);wrapper.append(frame);frame.append(img);return img;
    }
    return {win,writes,observers,handlers,avatar,Image,Element,chat};
}
module.exports={environment};
