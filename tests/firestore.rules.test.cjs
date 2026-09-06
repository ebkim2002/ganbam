const {test,before,after}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,deleteDoc,collection,getDocs,query,orderBy,serverTimestamp,deleteField}=require('firebase/firestore');
let env;
const user=(uid,claims={})=>env.authenticatedContext(uid,{email:uid+'@example.invalid',...claims}).firestore();
const archive=uid=>({uid,title:'synthetic',host:'test',hostBank:'',hostAccount:'',hostAccountName:'',savedAt:serverTimestamp(),rounds:[],totals:{},breakdown:{},gt:0,includeMembership:true});
before(async()=>{
  if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8087')throw Error('Run with the local demo emulator at 127.0.0.1:8087. Production fallback is forbidden.');
  env=await initializeTestEnvironment({projectId:'demo-ganbam-security',firestore:{host:'127.0.0.1',port:8087,rules:fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8')}});
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await setDoc(doc(db,'archives/existing'),archive('alice'));
    await setDoc(doc(db,'archives/legacy'),{...archive('alice'),hostPassword:'synthetic-only'});
    const missing=archive('alice');delete missing.uid;await setDoc(doc(db,'archives/missing'),missing);
    await setDoc(doc(db,'users/alice'),{name:'A',nick:'A',email:'alice@example.invalid',phone:'',isAdmin:false});
  });
});
after(async()=>{if(env)await env.cleanup()});
test('authenticated create succeeds and anonymous/forged-owner create fails',async()=>{
  await assertSucceeds(setDoc(doc(user('alice'),'archives/new'),archive('alice')));
  await assertFails(setDoc(doc(user('bob'),'archives/forged'),archive('alice')));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),'archives/anon'),archive('alice')));
});
test('archive fields reject password, unknown fields, invalid timestamp and malformed amounts',async()=>{
  for(const extra of [{hostPassword:'secret'},{hostPassword:null},{isAdmin:true},{gt:-1},{savedAt:new Date(0)},{rounds:'bad'}]){
    await assertFails(setDoc(doc(user('alice'),'archives/bad'),{...archive('alice'),...extra}));
  }
});
test('member full archive query works; anonymous reads fail',async()=>{
  await assertSucceeds(getDocs(query(collection(user('bob'),'archives'),orderBy('savedAt','desc'))));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'archives/existing')));
});
test('owner edit works; another owner and owner transfer fail',async()=>{
  await assertSucceeds(updateDoc(doc(user('alice'),'archives/existing'),{title:'changed',savedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(user('bob'),'archives/existing'),{title:'attack',savedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(user('alice'),'archives/existing'),{uid:'bob',savedAt:serverTimestamp()}));
});
test('legacy secret cleanup on explicit owner edit works; retaining secret fails',async()=>{
  await assertFails(updateDoc(doc(user('alice'),'archives/legacy'),{title:'bad',savedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(user('alice'),'archives/legacy'),{hostPassword:deleteField(),savedAt:serverTimestamp()}));
});
test('missing owner cannot be claimed, even by admin',async()=>{
  await assertFails(updateDoc(doc(user('alice'),'archives/missing'),{uid:'alice',savedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(user('ops',{admin:true}),'archives/missing'),{uid:'ops',savedAt:serverTimestamp()}));
});
test('trusted admin can manage but not transfer ownership',async()=>{
  await assertSucceeds(updateDoc(doc(user('ops',{admin:true}),'archives/existing'),{title:'reviewed',savedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(user('ops',{admin:true}),'archives/existing'),{uid:'ops',savedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(user('ops',{admin:'true'}),'archives/existing'),{title:'spoof',savedAt:serverTimestamp()}));
});
test('exposed shared admin email is denied even with admin claim',async()=>{
  const db=user('shared',{email:'admin@ganbam.com',admin:true});
  await assertFails(getDoc(doc(db,'archives/existing')));
  await assertFails(setDoc(doc(db,'archives/shared'),archive('shared')));
  await assertFails(getDoc(doc(db,'users/shared')));
  const renamed=user('JYyMzHWgilNmh2Of3HJrq7KWycV2',{email:'renamed@example.invalid',admin:true});
  await assertFails(getDoc(doc(renamed,'archives/new')));
});
test('users can create their profile, not grant privileges or impersonate another user',async()=>{
  const profile={name:'N',nick:'N',email:'newuser@example.invalid',phone:'',createdAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(user('newuser'),'users/newuser'),profile));
  await assertFails(setDoc(doc(user('bad'),'users/bad'),{...profile,email:'bad@example.invalid',isAdmin:true}));
  await assertFails(setDoc(doc(user('bob'),'users/victim'),profile));
  await assertSucceeds(updateDoc(doc(user('alice'),'users/alice'),{nick:'new'}));
  await assertFails(updateDoc(doc(user('alice'),'users/alice'),{isAdmin:true}));
  await assertFails(updateDoc(doc(user('alice'),'users/alice'),{email:'other@example.invalid'}));
  await assertFails(getDoc(doc(user('bob'),'users/alice')));
});
test('delete requires owner or trusted admin; unrecognized paths fail closed',async()=>{
  await assertFails(deleteDoc(doc(user('bob'),'archives/existing')));
  await assertSucceeds(deleteDoc(doc(user('alice'),'archives/existing')));
  await assertSucceeds(deleteDoc(doc(user('ops',{admin:true}),'archives/legacy')));
  await assertFails(setDoc(doc(user('alice'),'unrecognized/doc'),{x:1}));
  await assertFails(deleteDoc(doc(user('alice'),'users/alice')));
});
