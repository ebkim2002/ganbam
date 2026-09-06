const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
// Reads the checked-out baseline, never writes the Git index or repository history.
test('settlement calculation, round inputs and result/export functions match upstream baseline',()=>{
  const root=path.resolve(__dirname,'..');
  const before=cp.execFileSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),'show','7bcdcd251a4fd11d11f6a7b32f1f7278ce03955a:index.html'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
  const after=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n');
  const spans=[['function compute(', '/* ═══════════════════════════════════════\n   FIREBASE AUTH'],['function renderRound(', '/* ═══════════════════════════════════════\n   ARCHIVE'],['function renderResultPage(', 'function bindResultPage('],['async function saveScreenshot(', '/* ═══════════════════════════════════════\n   BIND']];
  for(const [a,b] of spans){const take=s=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j)};assert.equal(take(after),take(before),a+' unexpectedly changed')}
});
