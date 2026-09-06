const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function page(fail=false){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://local-test.invalid/'}),w=dom.window,writes=[];
  const firestore=()=>({collection:()=>({add:async data=>{if(fail)throw{code:'permission-denied'};writes.push(data);return{id:'new'}} ,doc:()=>({delete:async()=>writes.push('deleted')})})});
  firestore.FieldValue={serverTimestamp:()=>({}),delete:()=>({})};
  w.firebase={initializeApp(){},auth:()=>({currentUser:{uid:'alice'},onAuthStateChanged(){}}),firestore};w.emailjs={init(){}};
  require('node:vm').runInContext(script,dom.getInternalVMContext());
  w.eval("S.user={uid:'alice'};S.profile={name:'Alice'};S.termsAgreed=true;S.title='DOM 정산';S.host='Alice';S.rounds=[{id:'r',label:'1차',venue:'식당',food:'120000',drink:'60000',members:[{id:'a',name:'A',type:'sul'},{id:'b',name:'B',type:'nosul'}]}];render();");
  return{dom,w,writes};
}
test('real DOM new settlement saves, shows result, returns to archive and deletes own item',async()=>{
  const {dom,w,writes}=page();try{
    assert.equal(w.document.querySelector('#inp-hostpw'),null);
    assert.ok(w.document.querySelector('#btn-save'));
    await w.document.querySelector('#btn-save').onclick();
    assert.equal(writes.length,1);assert.equal(writes[0].uid,'alice');assert.equal('hostPassword' in writes[0],false);
    assert.match(w.document.querySelector('#snap-target').textContent,/DOM 정산/);
    w.document.querySelector('#btn-back-result').click();
    const manage=w.document.querySelector('[data-arch-manage="new"]');assert.ok(manage);manage.click();
    assert.ok(w.document.querySelector('#modal-edit'));await w.document.querySelector('#modal-delete').onclick();
    assert.equal(writes[1],'deleted');assert.equal(w.document.querySelector('[data-arch-manage="new"]'),null);
  }finally{dom.window.close()}
});
test('real DOM permission error preserves form and explains failure',async()=>{
  const {dom,w}=page(true);try{
    const input=w.document.querySelector('#inp-title');await w.document.querySelector('#btn-save').onclick();
    assert.equal(w.document.querySelector('#inp-title'),input);assert.equal(input.value,'DOM 정산');
    assert.match(w.document.querySelector('#toast').textContent,/Firestore.*권한/);
    assert.equal(w.document.querySelector('#loading-overlay'),null);
  }finally{dom.window.close()}
});
test('real DOM archive non-owner reads details without management controls',()=>{
  const {dom,w}=page();try{
    w.eval("S.archives=[{id:'other',uid:'bob',title:'다른 정산',rounds:[],totals:{}}];S.tab='archive';render()");
    assert.equal(w.document.querySelector('[data-arch-manage]'),null);
    w.document.querySelector('[data-av="other"]').click();
    assert.match(w.document.querySelector('#app').textContent,/다른 정산/);
    assert.equal(w.document.querySelector('[data-arch-manage]'),null);
  }finally{dom.window.close()}
});
