const MEMBERSHIP_FEE=1000;
function compute(rounds, includeMembership){
  const totals={}, breakdown={};
  // collect unique participants across all rounds
  const allParticipants = [...new Set(rounds.flatMap(r=>r.members.filter(m=>m.type).map(m=>m.name)))];

  for(const r of rounds){
    const food=parseFloat(r.food)||0, drink=parseFloat(r.drink)||0;
    const all=r.members.filter(m=>m.type==='nosul'||m.type==='sul');
    const sulM=r.members.filter(m=>m.type==='sul');
    if(!all.length)continue;
    const fSh=all.length>0&&food>0?Math.round(food/all.length):0;
    const dSh=sulM.length>0&&drink>0?Math.round(drink/sulM.length):0;
    for(const m of all){
      const isSul=m.type==='sul';
      const mine=fSh+(isSul?dSh:0);
      if(!totals[m.name]){totals[m.name]=0;breakdown[m.name]=[]}
      totals[m.name]+=mine;
      breakdown[m.name].push({label:r.label,venue:r.venue,food:fSh,drink:isSul?dSh:0,total:mine,isSul});
    }
  }
  // Add membership fee
  if(includeMembership){
    for(const name of allParticipants){
      if(!totals[name]){totals[name]=0;breakdown[name]=[]}
      totals[name]+=MEMBERSHIP_FEE;
    }
  }
  return{totals,breakdown,allParticipants};
}
export {compute,MEMBERSHIP_FEE};

