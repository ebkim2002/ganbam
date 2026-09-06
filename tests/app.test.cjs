const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(process.env.APP_HTML||path.join(__dirname,'../index.html'),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');

function app({error=null,currentUid='alice',writeGate=null,profileGet=null,archiveGet=null}={}){
  const elements=new Map();
  const el=id=>{
    if(!elements.has(id))elements.set(id,{value:'',checked:false,textContent:'',classList:{add(){},remove(){}},remove(){},addEventListener(){}});
    return elements.get(id);
  };
  const writes=[];
  let listener;
  const auth={currentUser:currentUid?{uid:currentUid}:null,onAuthStateChanged(fn){listener=fn}};
  const write=async(kind,id,data)=>{writes.push({kind,id,data});if(writeGate)await writeGate;if(error)throw error;return{id:'new-id'};};
  const db={collection(name){if(name==='users')return{doc:id=>({get:()=>profileGet?profileGet(id):Promise.resolve({exists:false})})};assert.equal(name,'archives');return{orderBy:()=>({get:()=>archiveGet?archiveGet():Promise.resolve({docs:[]})}),add:data=>write('add',null,data),doc:id=>({update:data=>write('update',id,data),delete:()=>write('delete',id)})};}};
  const firestore=()=>db;
  firestore.FieldValue={serverTimestamp:()=>({sentinel:'serverTimestamp'})};
  firestore.FieldValue.delete=()=>({sentinel:'delete'});
  const context=vm.createContext({firebase:{initializeApp(){},auth:()=>auth,firestore},emailjs:{init(){}},document:{getElementById:el,querySelectorAll:()=>[],body:{insertAdjacentHTML(){}}},window:{addEventListener(){}},setTimeout(){},console});
  vm.runInContext(script,context);
  const run=code=>vm.runInContext(code,context);
  run("S.user={uid:'alice',email:'test@example.invalid'}; S.host='벙주'; S.title='회귀 테스트'; S.rounds=[{id:'r1',label:'1차',venue:'식당',food:'120000',drink:'60000',members:[{name:'A',type:'sul'},{name:'B',type:'sul'},{name:'C',type:'sul'},{name:'D',type:'sul'},{name:'E',type:'nosul'},{name:'F',type:'nosul'}]}]; S.includeMembership=true; globalThis.renders=0; render=()=>{renders++; document.getElementById('inp-hostpw').value='';}; showLoading=()=>{S.loading=true}; hideLoading=()=>{S.loading=false}; toast=msg=>{globalThis.lastToast=msg}; bindNew();");
  el('inp-hostpw').value='local-fixture-only';
  return{run,el,writes,save:()=>el('btn-save').onclick(),plain:code=>JSON.parse(JSON.stringify(run(code))),changeUser:user=>{auth.currentUser=user;return listener(user)}};
}

test('inline JavaScript compiles',()=>{new vm.Script(script)});
test('food/alcohol split and optional membership remain unchanged',()=>{
  const a=app();
  assert.deepEqual(a.plain('compute(S.rounds,false).totals'),{A:35000,B:35000,C:35000,D:35000,E:20000,F:20000});
  assert.deepEqual(a.plain('compute(S.rounds,true).totals'),{A:36000,B:36000,C:36000,D:36000,E:21000,F:21000});
});
test('membership is charged once across rounds; absent people excluded',()=>{
  const a=app();
  a.run("S.rounds.push({id:'r2',label:'2차',venue:'',food:'10000',drink:'0',members:[{name:'A',type:'nosul'},{name:'G',type:null}]})");
  assert.equal(a.run('compute(S.rounds,true).totals.A'),46000);
  assert.equal(a.run('membershipTotal(S.rounds)'),6000);
  assert.equal(a.run("compute(S.rounds,true).allParticipants.includes('G')"),false);
});
test('legacy rounding and no-drinker behavior are preserved',()=>{
  const a=app();
  a.run("S.rounds=[{label:'1차',food:'100',drink:'20',members:[{name:'A',type:'nosul'},{name:'B',type:'nosul'},{name:'C',type:'nosul'}]}]");
  assert.deepEqual(a.plain('compute(S.rounds,false).totals'),{A:33,B:33,C:33});
  assert.equal(a.run('grandTotal(S.rounds)'),120);
});
test('create saves the existing payload and shows results',async()=>{
  const a=app();await a.save();
  assert.equal(a.writes.length,1);assert.equal(a.writes[0].kind,'add');
  assert.equal(a.writes[0].data.uid,'alice');assert.equal(a.writes[0].data.gt,186000);
  assert.equal(Object.hasOwn(a.writes[0].data,'hostPassword'),false);
  assert.equal(a.run('S.resultData.allParticipants.length'),6);
  assert.equal(a.run('S.editingId'),null);assert.equal(a.run('S.loading'),false);
});
test('owner edit retains document id and removes legacy password without overwriting uid',async()=>{
  const a=app();a.run("S.editingId='archive-1';S.archives=[{id:'archive-1',uid:'alice'}];");await a.save();
  assert.equal(a.writes[0].kind,'update');assert.equal(a.writes[0].id,'archive-1');
  assert.equal(a.writes[0].data.hostPassword.sentinel,'delete');assert.equal(Object.hasOwn(a.writes[0].data,'uid'),false);
});
test('permission-denied is explained and preserves all unsaved input',async()=>{
  const a=app({error:{code:'permission-denied',message:'Missing or insufficient permissions.'}});
  const before=a.plain('S.rounds');await a.save();
  assert.match(a.run('lastToast'),/Firestore.*권한/);
  assert.deepEqual(a.plain('S.rounds'),before);assert.equal(a.run('S.resultData'),null);
  assert.equal(a.el('inp-hostpw').value,'local-fixture-only');assert.equal(a.run('S.loading'),false);
});
test('generic network failure keeps error detail and password input',async()=>{
  const a=app({error:{code:'unavailable',message:'network unavailable'}});await a.save();
  assert.match(a.run('lastToast'),/network unavailable/);
  assert.equal(a.el('inp-hostpw').value,'local-fixture-only');
});
test('expired session fails before any database write',async()=>{
  const a=app({currentUid:null});await a.save();
  assert.equal(a.writes.length,0);assert.match(a.run('lastToast'),/다시 로그인/);
});
test('changed account fails before writing a stale owner uid',async()=>{
  const a=app({currentUid:'bob'});await a.save();
  assert.equal(a.writes.length,0);assert.match(a.run('lastToast'),/다시 로그인/);
});
test('cross-owner edit fails before database write',async()=>{
  const a=app();a.run("S.editingId='bobs-archive';S.editingHostPw='legacy-fixture';S.archives=[{id:'bobs-archive',uid:'bob'}]");await a.save();
  assert.equal(a.writes.length,0);
});
test('missing legacy owner fails closed',async()=>{
  const a=app();a.run("S.editingId='legacy';S.archives=[{id:'legacy'}]");await a.save();assert.equal(a.writes.length,0);
});
test('trusted admin edits another owner without changing uid',async()=>{
  const a=app();a.run("S.isAdmin=true;S.editingId='other';S.archives=[{id:'other',uid:'bob'}]");await a.save();
  assert.equal(a.writes.length,1);assert.equal(Object.hasOwn(a.writes[0].data,'uid'),false);
  assert.equal(a.run('S.archives[0].uid'),'bob');
});
test('public administrator credentials and password UI are removed',()=>{
  assert.equal(/ADMIN_PW|ADMIN_EMAIL|btn-admin-login|inp-hostpw|modal-pw|editingHostPw/.test(html),false);
});
test('owner-only management UI and stale-account delete guard',async()=>{
  const a=app();a.run("S.archives=[{id:'own',uid:'alice',title:'mine'},{id:'other',uid:'bob',title:'other'}]");
  assert.match(a.run('renderArchTab()'),/data-arch-manage="own"/);
  assert.doesNotMatch(a.run('renderArchTab()'),/data-arch-manage="other"/);
  a.run("S.modal={type:'action',archId:'own'};renderModal();S.user={uid:'bob'};");
  await a.el('modal-delete').onclick();assert.equal(a.writes.length,0);
});
test('late save response cannot expose previous user data after account switch',async()=>{
  let release;const gate=new Promise(r=>release=r);const a=app({writeGate:gate});
  const pending=a.save();await a.changeUser({uid:'bob',getIdTokenResult:async()=>({claims:{}})});
  release();await pending;assert.equal(a.run('S.resultData'),null);assert.equal(a.run('S.archives.length'),0);
});
test('logout clears private state and trusted admin claim',async()=>{
  const a=app();a.run("S.isAdmin=true;S.archives=[{id:'private'}];S.resultData={title:'private'};S.editingId='private';");
  await a.changeUser(null);assert.equal(a.run('S.isAdmin'),false);assert.equal(a.run('S.archives.length'),0);assert.equal(a.run('S.editingId'),null);assert.equal(a.run('S.rounds[0].members.length'),0);
});
test('delayed old profile cannot overwrite next account; profile flag cannot grant admin',async()=>{
  let release,started;const ready=new Promise(r=>started=r);
  const a=app({profileGet:id=>id==='alice'?new Promise(r=>{release=r;started()}):Promise.resolve({exists:true,data:()=>({name:'Bob',isAdmin:true})})});
  const pending=a.changeUser({uid:'alice',getIdTokenResult:async()=>({claims:{}})});await ready;
  await a.changeUser({uid:'bob',getIdTokenResult:async()=>({claims:{}})});
  release({exists:true,data:()=>({name:'Alice'})});await pending;
  assert.equal(a.run('S.profile.name'),'Bob');assert.equal(a.run('S.isAdmin'),false);
});
test('archive read failure is visible rather than pretending the archive is empty',async()=>{
  const a=app({archiveGet:async()=>{throw Error('permission-denied')}});await a.changeUser({uid:'alice',getIdTokenResult:async()=>({claims:{admin:true}})});
  assert.match(a.run('renderArchTab()'),/불러오지 못/);assert.equal(a.run('S.loading'),false);assert.equal(a.run('S.isAdmin'),true);
});
