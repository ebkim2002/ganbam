import {compute,MEMBERSHIP_FEE} from './original-compute.mjs';
export {compute,MEMBERSHIP_FEE};
export const money=v=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(v)+'원';
export function emptyRound(index=0){return {id:crypto.randomUUID(),label:`${index+1}차`,venue:'',food:'',drink:'',members:[],pendingNames:''};}
export function emptyDraft(){return {version:1,title:'',host:'',hostBank:'',hostAccount:'',hostAccountName:'',includeMembership:false,rounds:[emptyRound()]};}
export function amount(v){const text=String(v??'').replaceAll(',','').trim();if(text==='')return 0;if(!/^\d+(\.\d+)?$/.test(text)||!Number.isFinite(Number(text)))throw Error('금액은 0 이상의 숫자로 입력해주세요.');return Number(text);}
export function normalized(draft){return {...structuredClone(draft),rounds:draft.rounds.map((r,i)=>({...r,label:`${i+1}차`,food:amount(r.food),drink:amount(r.drink)}))};}
export function settle(draft){
 const data=normalized(draft),result=compute(data.rounds,data.includeMembership);
 const expenseTotal=data.rounds.reduce((sum,r)=>sum+r.food+r.drink,0),membershipTotal=data.includeMembership?result.allParticipants.length*MEMBERSHIP_FEE:0;
 const total=expenseTotal+membershipTotal,allocatedTotal=Object.values(result.totals).reduce((a,b)=>a+b,0),warnings=[];
 for(const r of data.rounds){if((r.food+r.drink)>0&&!r.members.some(m=>m.type))warnings.push(`${r.label}: 비용이 있지만 참석자가 없습니다.`);if(r.drink>0&&!r.members.some(m=>m.type==='sul'))warnings.push(`${r.label}: 술값이 있지만 음주자가 없습니다.`);}
 if(Math.abs(allocatedTotal-total)>0.000001)warnings.push(`개인별 분담 합계 ${money(allocatedTotal)}와 전체 금액 ${money(total)}가 다릅니다. 원본 계산의 반올림·음주 인원 설정을 확인해주세요.`);
 return {...data,...result,expenseTotal,membershipTotal,total,allocatedTotal,warnings};
}
export function noticeLines(d){
 const lines=[`[${d.title||'간밤 모임'} 정산 안내]`,...(d.host?[`벙주: ${d.host}`]:[]),'','■ 차수별 지출'];
 for(const r of d.rounds)lines.push(`${r.label}${r.venue?' · '+r.venue:''}: ${money(r.food+r.drink)} (음식 ${money(r.food)} / 술 ${money(r.drink)})`);
 lines.push(`지출 합계: ${money(d.expenseTotal)}`);if(d.includeMembership)lines.push(`회비: ${d.allParticipants.length}명 × ${money(MEMBERSHIP_FEE)} = ${money(d.membershipTotal)}`);lines.push(`총 정산 금액: ${money(d.total)}`,'','■ 개인별 입금액');
 for(const name of [...d.allParticipants].sort((a,b)=>d.totals[b]-d.totals[a])){
  const details=d.breakdown[name].map(r=>`${r.label} ${money(r.total)}`).join(' / ');lines.push(`${name}: ${money(d.totals[name])}`,`  ${details}${d.includeMembership?' / 회비 '+money(MEMBERSHIP_FEE):''}`);
 }
 lines.push(`개인별 분담 합계: ${money(d.allocatedTotal)}`,'','■ 입금계좌',d.hostBank||d.hostAccount?`${d.hostBank} ${d.hostAccount}`.trim():'미입력',`예금주: ${d.hostAccountName||'미입력'}`);
 if(d.warnings.length)lines.push('','※ 확인사항',...d.warnings);return lines;
}
export const noticeText=d=>noticeLines(d).join('\n');
export function validateDraft(d){
 if(!d||d.version!==1||!Array.isArray(d.rounds)||!d.rounds.length||d.rounds.length>100)throw Error('지원하지 않는 초안입니다.');
 for(const k of ['title','host','hostBank','hostAccount','hostAccountName'])if(typeof d[k]!=='string')throw Error('초안 항목을 확인해주세요.');if(typeof d.includeMembership!=='boolean')throw Error('회비 항목을 확인해주세요.');
 for(const r of d.rounds){if(typeof r.id!=='string'||typeof r.venue!=='string'||(r.pendingNames!==undefined&&typeof r.pendingNames!=='string')||!Array.isArray(r.members)||r.members.some(m=>typeof m.name!=='string'||!m.name.trim()||!['nosul','sul',null].includes(m.type))||new Set(r.members.map(m=>m.name)).size!==r.members.length)throw Error('초안 참석자를 확인해주세요.');amount(r.food);amount(r.drink);}return d;
}
