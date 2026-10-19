import {noticeLines} from './model.mjs';
export async function copyNotice(text,{clipboard=globalThis.navigator?.clipboard,select=()=>{}}={}){try{if(!clipboard?.writeText)throw Error('Clipboard unavailable');await clipboard.writeText(text);return true;}catch{select(text);return false;}}
export function wrappedLines(context,lines,maxWidth){const result=[];for(const line of lines){let part='';for(const ch of line){if(part&&context.measureText(part+ch).width>maxWidth){result.push(part);part=ch;}else part+=ch;}result.push(part);}return result;}
export async function renderImages(result,{document=globalThis.document}={}){
 const measure=document.createElement('canvas').getContext('2d');measure.font='17px system-ui';const lines=wrappedLines(measure,noticeLines(result),544),pages=[];
 for(let offset=0;offset<lines.length;offset+=60){const part=lines.slice(offset,offset+60),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=(part.length*29+130)*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#fff';ctx.fillRect(0,0,600,canvas.height/2);ctx.fillStyle='#173b36';ctx.font='17px system-ui';part.forEach((line,i)=>ctx.fillText(line,28,48+i*29));ctx.fillStyle='#6b786b';ctx.font='12px system-ui';ctx.fillText(`간밤 벙주 정산 · ${Math.floor(offset/60)+1} / ${Math.ceil(lines.length/60)}`,28,canvas.height/2-24);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('이미지를 만들지 못했습니다.');pages.push(blob);}
 return pages;
}
