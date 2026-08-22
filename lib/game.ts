export type Participant = { username: string; baseScore: number; totalScore: number; rank: number };
export type Match = Participant & { vouchValue: number; deficit: number; matchScore: number; mutual: boolean };
export const VOUCH_RATE = 0.35;
export const ACTIONS_PER_USER = 7;
export const MATCH_WEIGHTS = { qualification: .35, reciprocity: .30, fairness: .20, efficiency: .15 } as const;
export const cutoff = 467700;
export const participants: Participant[] = [
 {username:'Cyphrgm',baseScore:193400,totalScore:406500,rank:1284},
 {username:'sophia_fields',baseScore:201400,totalScore:413800,rank:1183},
 {username:'latenthero',baseScore:184200,totalScore:426100,rank:1092},
 {username:'commonsjane',baseScore:224800,totalScore:401200,rank:1327},
 {username:'northstar',baseScore:171500,totalScore:438900,rank:1047},
 {username:'goodkarmahq',baseScore:152900,totalScore:417400,rank:1151},
 {username:'atlasweb3',baseScore:246200,totalScore:478600,rank:921},
 {username:'openminded',baseScore:198100,totalScore:449900,rank:1018},
];
export function analyse(user: Participant) {
 const needed=Math.max(0,cutoff-user.totalScore), own=user.baseScore*VOUCH_RATE;
 const matches: Match[]=participants.filter(p=>p.username!==user.username).map(p=>{
  const value=p.baseScore*VOUCH_RATE, deficit=Math.max(0,cutoff-p.totalScore);
  const q=needed===0?1:Math.min(1,value/needed), r=deficit===0?0:Math.min(1,own/deficit);
  const fairness=Math.min(own,value)/Math.max(own,value);
  const efficiency=needed===0?1:(value<needed?value/needed:needed/value);
  return {...p,vouchValue:value,deficit,mutual:value>=needed&&own>=deficit,matchScore:Math.round(100*(MATCH_WEIGHTS.qualification*q+MATCH_WEIGHTS.reciprocity*r+MATCH_WEIGHTS.fairness*fairness+MATCH_WEIGHTS.efficiency*efficiency))};
 }).sort((a,b)=>b.matchScore-a.matchScore);
 return {needed,own,minBase:needed/VOUCH_RATE,margin:Math.max(0,user.totalScore-cutoff),matches,whoNeeds:matches.filter(m=>m.deficit>0&&m.deficit<=own)};
}
export function findUser(username:string){return participants.find(p=>p.username.toLowerCase()===username.toLowerCase()) ?? {...participants[0],username};}
