// Audit logic tests. Run: node tests/audit_test.js   (reads ../homebudget.html CORE block)
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const core=html.split('// ==CORE START==')[1].split('// ==CORE END==')[0];
const api=new Function(core+';return {auditCore,stmtSyncPairs,dayNum};')();
const {auditCore,stmtSyncPairs,dayNum}=api;
let pass=0,fail=0;const T=(name,cond,info)=>{if(cond)pass++;else{fail++;console.log('FAIL',name,info!==undefined?'\n   '+(typeof info==='string'?info:JSON.stringify(info)):'');}};
const TODAY='2026-11-06';
let _id=0;const nid=()=>'x'+(++_id);
const acct=(id,name,type,extra)=>Object.assign({id,name:name||id,type:type||'checking'},extra||{});
const tx=(o)=>Object.assign({id:nid(),acct:'A',date:'2026-10-10',desc:'STORE',amount:-10,cat:'Shopping',key:undefined,src:'f1'},o);
const file=(o)=>Object.assign({id:nid(),acct:'A',kind:'pdf',name:'s.pdf',start:'2026-10-01',end:'2026-10-31',beginBal:100,endBal:100,reconcile:{ok:true,expected:0,got:0}},o);
const mk=(o)=>Object.assign({accounts:[acct('A','Checking','checking')],txns:[],files:[]},o);
const run=S=>auditCore(S,TODAY);
const find=(F,re,lvl)=>F.filter(f=>re.test(f.title)&&(!lvl||f.lvl===lvl));
const has=(F,re,lvl)=>find(F,re,lvl).length>0;
const lv=(F,l)=>F.filter(f=>f.lvl===l);
const itemsOf=(F,re)=>{const f=find(F,re)[0];return f?f.items.join('\n'):''};

// ---------- empty / shape ----------
{const F=run({accounts:[],txns:[],files:[]});T('empty state no throw',Array.isArray(F));T('empty: only the no-files info',F.length===1&&F[0].lvl==='info');}
{const F=run({accounts:[],txns:[]});T('files undefined tolerated',Array.isArray(F));}
{const S=mk({txns:[tx()]});const before=JSON.stringify(S);run(S);T('does not mutate state',JSON.stringify(S)===before);}
{const F=run(mk({txns:[tx()]}));T('every finding has lvl/title/items',F.every(f=>['bad','warn','info','ok'].includes(f.lvl)&&typeof f.title==='string'&&Array.isArray(f.items)));}

// ---------- 1. statement totals ----------
{const S=mk({files:[file({reconcile:{ok:true}}),file({start:'2026-11-01',end:'2026-11-30',reconcile:{ok:true}})],txns:[]});const F=run(S);T('1a all files match -> ok 2 of 2',has(F,/^2 of 2 saved files match/,'ok'),F);T('1a no bad',!lv(F,'bad').length);}
{const S=mk({files:[file({reconcile:{ok:false,expected:50,got:49.5}}),file({start:'2026-11-01',end:'2026-11-30',reconcile:{ok:true}})],txns:[tx()]});const F=run(S);T('1b one mismatch -> bad',has(F,/^1 statement doesn't match/,'bad'),F);T('1b items show expected and read',/statement says \$50\.00, read \$49\.50/.test(itemsOf(F,/doesn't match/)),itemsOf(F,/doesn't match/));T('1b the other file counts as ok',has(F,/^1 of 2 saved files match/,'ok'),F);}
{const S=mk({files:[file({reconcile:{ok:false,expected:-5,got:-6}}),file({start:'2026-11-01',end:'2026-11-30',reconcile:{ok:false,expected:1,got:2}})],txns:[tx()]});const F=run(S);T('1c plural wording',has(F,/^2 statements don't match the totals printed on them/,'bad'),F);T('1c negative money formatting',/-\$5\.00/.test(itemsOf(F,/match the totals/)));T('1c no ok line when none match',!has(F,/saved files match/));}
{const S=mk({files:[file({reconcile:undefined,kind:'csv',name:'a.csv',start:undefined,end:undefined})],txns:[tx()]});const F=run(S);T('1d csv has no totals -> info with name',has(F,/^1 file has no printed totals/,'info')&&/a\.csv/.test(itemsOf(F,/no printed totals/)),F);}
{const S=mk({files:[file({reconcile:undefined,kind:'csv',start:undefined,end:undefined}),file({reconcile:undefined,kind:'ofx',start:undefined,end:undefined})],txns:[tx()]});T('1e plural info wording',has(run(S),/^2 files have no printed totals/));}
{const S=mk({files:[],txns:[tx()]});T('1f no files -> info',has(run(S),/^No original files saved yet/,'info'));T('1f no src check when no files',!has(run(S),/saved original/));}

// ---------- 2. continuity between statements ----------
const ST=(s,e,b,en,o)=>file(Object.assign({start:s,end:e,beginBal:b,endBal:en},o||{}));
const withFiles=(files,txns)=>mk({files,txns:txns||[tx({date:'2026-10-10'})]});
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,150),ST('2026-11-01','2026-11-30',150,200)]));T('2a contiguous + matching -> ok hand-off',has(F,/^1 statement-to-statement balance hand-offs line up/,'ok'),F);T('2a no gap warning',!has(F,/gap/));}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,150),ST('2026-11-02','2026-11-30',150,200)]));T('2b one missing day -> gap warn',has(F,/^1 gap between statements/,'warn'),F);T('2b gap text',/nothing between 2026-10-31 and 2026-11-02/.test(itemsOf(F,/gap/)));T('2b no handoff check across a gap',!has(F,/hand-off/)&&!has(F,/carry over/));}
{const F=run(withFiles([ST('2026-12-01','2026-12-31',100,150),ST('2027-01-01','2027-01-31',150,200)]));T('2c year boundary is contiguous',!has(F,/gap/)&&has(F,/hand-offs line up/),F);}
{const F=run(withFiles([ST('2027-02-01','2027-02-28',100,150),ST('2027-03-01','2027-03-31',150,200)]));T('2d february contiguous',!has(F,/gap/),F);}
{const F=run(withFiles([ST('2028-02-01','2028-02-29',100,150),ST('2028-03-01','2028-03-31',150,200)]));T('2e leap february contiguous',!has(F,/gap/),F);}
{const F=run(withFiles([ST('2028-02-01','2028-02-28',100,150),ST('2028-03-01','2028-03-31',150,200)]));T('2f leap year: missing Feb 29 is a gap',has(F,/gap/,'warn'),F);}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,150),ST('2026-11-01','2026-11-30',151,200)]));T('2g balance jump -> bad',has(F,/carry over/,'bad')&&/ends at \$150\.00 but 2026-11-01 starts at \$151\.00/.test(itemsOf(F,/carry over/)),F);}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,150),ST('2026-11-01','2026-11-30',150.02,200)]));T('2h 2 cent difference tolerated',!has(F,/carry over/),F);}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,150),ST('2026-11-01','2026-11-30',150.03,200)]));T('2i 3 cent difference flagged',has(F,/carry over/,'bad'),F);}
{const F=run(withFiles([ST('2026-11-01','2026-11-30',150,200),ST('2026-10-01','2026-10-31',100,150)]));T('2j input order does not matter',has(F,/hand-offs line up/)&&!has(F,/gap/),F);}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,150),ST('2026-10-01','2026-10-31',100,150)]));T('2k same statement twice -> info "more than once"',has(F,/^1 overlapping\/repeated/,'info')&&/saved more than once/.test(itemsOf(F,/overlapping/)),F);T('2k duplicate is not a gap or jump',!has(F,/gap|carry over/));}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,150),ST('2026-10-15','2026-11-15',120,200)]));T('2l partial overlap -> info',has(F,/overlapping/,'info')&&/overlaps/.test(itemsOf(F,/overlapping/)),F);}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,150,{acct:'A'}),ST('2026-11-01','2026-11-30',150,200,{acct:'B'})],[tx(),tx({acct:'B'})]));F; }
{const S=mk({accounts:[acct('A','Chk'),acct('B','Sav','savings')],files:[ST('2026-10-01','2026-10-31',100,150,{acct:'A'}),ST('2026-12-01','2026-12-31',150,200,{acct:'B'})],txns:[tx()]});const F=run(S);T('2m different accounts never compared',!has(F,/gap|carry over|hand-off/),F);}
{const S=mk({accounts:[acct('A','Chk'),acct('B','Sav','savings')],files:[ST('2026-10-01','2026-10-31',100,150,{acct:'A'}),ST('2026-12-01','2026-12-31',150,200,{acct:'A'}),ST('2026-10-01','2026-10-31',5,6,{acct:'B'}),ST('2026-11-01','2026-11-30',6,7,{acct:'B'})],txns:[tx()]});const F=run(S);T('2n per-account: A gap, B fine',/Chk: nothing between/.test(itemsOf(F,/gap/))&&!/Sav/.test(itemsOf(F,/gap/)),F);}
{const S=mk({accounts:[acct('A','Brok','brokerage')],files:[ST('2026-10-01','2026-10-31',100,150),ST('2026-11-01','2026-11-30',999,200)],txns:[tx()]});const F=run(S);T('2o brokerage skips balance hand-off',!has(F,/carry over/),F);}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',null,null),ST('2026-11-01','2026-11-30',null,null)]));T('2p missing balances: no hand-off claim either way',!has(F,/hand-off|carry over/),F);}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,null),ST('2026-11-01','2026-11-30',150,200)]));T('2q one side missing balance',!has(F,/hand-off|carry over/),F);}
{const F=run(withFiles([file({kind:'csv',start:'2026-10-01',end:'2026-10-31'}),file({kind:'csv',start:'2026-12-01',end:'2026-12-31'})]));T('2r only PDFs count as statements (csv ignored for gaps)',!has(F,/gap/),F);}
{const F=run(withFiles([file({start:undefined,end:undefined}),ST('2026-10-01','2026-10-31',100,100)]));T('2s pdf without period ignored',!has(F,/gap|overlap/),F);}
// nested statement must not create a fake gap
{const F=run(withFiles([ST('2026-01-01','2026-01-31',100,150),ST('2026-01-10','2026-01-20',120,130),ST('2026-02-01','2026-02-28',150,200)]));T('2t nested statement does not create a false gap',!has(F,/gap/),F);T('2t nested statement is reported as overlap',has(F,/overlapping/),F);}
{const F=run(withFiles([ST('2026-01-01','2026-01-31',100,150),ST('2026-01-05','2026-03-05',140,300),ST('2026-02-01','2026-02-28',150,200)]));T('2u contained statement overlapped by a long one: no false gap',!has(F,/gap/),F);}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,150),ST('2026-10-31','2026-11-30',150,200)]));T('2v shared boundary day with matching balances -> ok',!has(F,/carry over/)&&has(F,/hand-offs line up/),F);}
{const F=run(withFiles([ST('2026-10-01','2026-10-31',100,150),ST('2026-10-31','2026-11-30',160,200)]));T('2w shared boundary day with a jump -> bad',has(F,/carry over/,'bad'),F);}
{const F=run(withFiles([ST('2026-01-01','2026-01-31',1,2),ST('2026-02-01','2026-02-28',2,3),ST('2026-03-01','2026-03-31',3,4),ST('2026-04-01','2026-04-30',4,5)]));T('2x four months -> 3 hand-offs',has(F,/^3 statement-to-statement/),F);}
{const F=run(withFiles([ST('2026-01-01','2026-01-31',1,2),ST('2026-03-01','2026-03-31',2,3),ST('2026-05-01','2026-05-31',3,4)]));T('2y two gaps -> plural',has(F,/^2 gaps between statements/),F);}
{const F=run(withFiles([ST('2026-02-01','2026-02-10',1,2),ST('2026-02-12','2026-02-20',2,3)]));T('2z gap of exactly one missing day',has(F,/gap/),F);}

// ---------- 3. ledger vs statement ----------
const L3=(txns,f)=>run(mk({files:[file(Object.assign({start:'2026-10-01',end:'2026-10-31',beginBal:100,endBal:150},f||{}))],txns}));
{const F=L3([tx({date:'2026-10-05',amount:80}),tx({date:'2026-10-20',amount:-30})]);T('3a ledger net == statement net -> ok',has(F,/^Ledger adds up to the balances printed on all 1 statements/,'ok'),F);}
{const F=L3([tx({date:'2026-10-05',amount:80}),tx({date:'2026-10-20',amount:-29.5})]);T('3b ledger off by 0.50 -> bad',has(F,/^Ledger no longer adds up to 1 statement/,'bad'),F);T('3b item shows both numbers',/statement net \$50\.00, your ledger \$50\.50/.test(itemsOf(F,/Ledger no longer/)),itemsOf(F,/Ledger no longer/));}
{const F=L3([tx({date:'2026-10-05',amount:50.02})]);T('3c 2 cents off tolerated',!has(F,/Ledger no longer/),F);}
{const F=L3([tx({date:'2026-10-05',amount:50.03})]);T('3d 3 cents off flagged',has(F,/Ledger no longer/,'bad'),F);}
{const F=L3([tx({date:'2026-10-01',amount:20}),tx({date:'2026-10-31',amount:30})]);T('3e rows on the first and last day count',has(F,/Ledger adds up/,'ok'),F);}
{const F=L3([tx({date:'2026-09-30',amount:20}),tx({date:'2026-10-05',amount:50})]);T('3f row the day before the period is excluded',has(F,/Ledger adds up/,'ok'),F);}
{const F=L3([tx({date:'2026-11-01',amount:20}),tx({date:'2026-10-05',amount:50})]);T('3g row the day after the period is excluded',has(F,/Ledger adds up/,'ok'),F);}
{const S=mk({accounts:[acct('A'),acct('B','Other')],files:[file({beginBal:100,endBal:150})],txns:[tx({date:'2026-10-05',amount:50}),tx({acct:'B',date:'2026-10-06',amount:999})]});T('3h other accounts excluded',has(run(S),/Ledger adds up/,'ok'),run(S));}
{const F=L3([tx({date:'2026-10-05',amount:50})],{noLedger:true,beginBal:0,endBal:5});T('3i noLedger statements skipped',!has(F,/Ledger/),F);}
{const F=L3([tx({date:'2026-10-05',amount:50})],{beginBal:null});T('3j missing opening balance skipped',!has(F,/Ledger/),F);}
{const F=L3([tx({date:'2026-10-05',amount:50})],{endBal:undefined});T('3k missing closing balance skipped',!has(F,/Ledger/),F);}
{const F=L3([],{beginBal:100,endBal:100});T('3l empty ledger, flat balances -> ok',has(F,/Ledger adds up/,'ok'),F);}
{const F=L3([],{beginBal:100,endBal:150});T('3m empty ledger but balance moved -> bad',has(F,/Ledger no longer/,'bad'),F);}
{const t=[];for(let i=0;i<1000;i++)t.push(tx({date:'2026-10-'+String(1+i%28).padStart(2,'0'),amount:0.1}));const F=L3(t,{beginBal:0,endBal:100});T('3n float drift over 1000 rows tolerated',has(F,/Ledger adds up/,'ok'),F);}
{const F=L3([tx({date:'2026-10-05',amount:0.1}),tx({date:'2026-10-06',amount:0.2})],{beginBal:0,endBal:0.3});T('3o 0.1+0.2',has(F,/Ledger adds up/,'ok'),F);}
{const S=mk({files:[file({beginBal:100,endBal:150,start:'2026-10-01',end:'2026-10-31'}),file({beginBal:150,endBal:300,start:'2026-11-01',end:'2026-11-30'})],txns:[tx({date:'2026-10-05',amount:50}),tx({date:'2026-11-05',amount:150})]});T('3p two statements each checked, plural ok line',has(run(S),/^Ledger adds up to the balances printed on all 2 statements/),run(S));}
{const S=mk({files:[file({beginBal:100,endBal:150}),file({beginBal:150,endBal:300,start:'2026-11-01',end:'2026-11-30'})],txns:[tx({date:'2026-10-05',amount:50}),tx({date:'2026-11-05',amount:10})]});const F=run(S);T('3q only the broken statement is listed',has(F,/^Ledger no longer adds up to 1 statement/)&&/2026-11-01/.test(itemsOf(F,/Ledger no longer/))&&!/2026-10-01 → 2026-10-31/.test(itemsOf(F,/Ledger no longer/)),F);}
{const S=mk({files:[file({beginBal:100,endBal:150}),file({beginBal:100,endBal:150})],txns:[tx({date:'2026-10-05',amount:50})]});T('3r same statement saved twice is not double-counted against the ledger',has(run(S),/Ledger adds up/,'ok'),run(S));}
{const S=mk({accounts:[acct('A','Card','credit')],files:[file({beginBal:-200,endBal:-260})],txns:[tx({date:'2026-10-05',amount:-60})]});T('3s credit card with signed balances',has(run(S),/Ledger adds up/,'ok'),run(S));}
{const S=mk({accounts:[],files:[file({acct:'GONE',beginBal:100,endBal:150})],txns:[]});const F=run(S);T('3t statement of a deleted account: does not crash',Array.isArray(F));}

// ---------- 4. rows with no original ----------
{const S=mk({files:[file()],txns:[tx({src:'f1'}),tx({src:undefined,date:'2026-10-12'})]});const F=run(S);T('4a manual row inside a statement period without src -> warn',has(F,/^1 of 2 transactions have no saved original/,'warn'),F);}
{const S=mk({files:[file()],txns:[tx({src:'f1'}),tx({src:'f1'})]});T('4b all linked -> ok',has(run(S),/^All 2 transactions link to a saved original/,'ok'),run(S));}
{const S=mk({files:[file()],txns:[tx({src:'f1'}),tx({src:undefined,sf:true,date:'2026-11-03'})]});const F=run(S);T('4c bank-synced row outside any statement is not a problem',!has(F,/no saved original/,'warn'),F);T('4c ...and the check still passes',has(F,/link to a saved original|transactions link/),F);}
{const S=mk({files:[file()],txns:[tx({src:undefined,sf:true,date:'2026-10-12'})]});T('4d synced row INSIDE a statement period without a link is flagged',has(run(S),/no saved original/,'warn'),run(S));}
{const S=mk({files:[file()],txns:[tx({src:undefined,sf:true,date:'2026-10-12',acct:'B'})],accounts:[acct('A'),acct('B','Other')]});T('4e statement period of another account does not count',!has(run(S),/no saved original/,'warn'),run(S));}
{const S=mk({files:[file({kind:'csv',start:'2026-10-01',end:'2026-10-31'})],txns:[tx({src:undefined,date:'2026-10-12'})]});T('4f manual row without src still flagged when files exist',has(run(S),/no saved original/,'warn'),run(S));}

// ---------- 5. transfers ----------
const TR=(o)=>tx(Object.assign({cat:'Transfer',desc:'Transfer'},o));
const S5=(txns,accts)=>mk({accounts:accts||[acct('A','Checking'),acct('B','Savings','savings')],txns});
{const F=run(S5([TR({acct:'A',amount:-100}),TR({acct:'B',amount:100})]));T('5a matched pair -> ok, singular',has(F,/^1 transfer matched between your accounts/,'ok'),F);}
{const F=run(S5([TR({acct:'A',amount:-100}),TR({acct:'B',amount:100,date:'2026-10-14'})]));T('5b 4 days apart still matches',has(F,/^1 transfer matched/),F);}
{const F=run(S5([TR({acct:'A',amount:-100}),TR({acct:'B',amount:100,date:'2026-10-15'})]));T('5c 5 days apart does not match',!has(F,/matched/)&&has(F,/transfers? goe?s? to or from/),F);}
{const F=run(S5([TR({acct:'A',amount:-100}),TR({acct:'A',amount:100})]));T('5d same account never matches itself',!has(F,/matched/),F);}
{const F=run(S5([TR({acct:'A',amount:-100}),TR({acct:'B',amount:100.01})]));T('5e one cent apart does not match',!has(F,/matched/),F);}
{const F=run(S5([TR({acct:'A',amount:-100}),TR({acct:'A',amount:-100}),TR({acct:'B',amount:100})]));T('5f one-to-one: 2 outs, 1 in -> 1 matched, 1 unmatched',has(F,/^1 transfer matched/)&&has(F,/^1 transfer goe?s? to or from|1 transfer.*not in your imported data/),F);}
{const F=run(S5([TR({acct:'A',amount:-100}),TR({acct:'A',amount:-100,date:'2026-10-20'}),TR({acct:'B',amount:100}),TR({acct:'B',amount:100,date:'2026-10-20'})]));T('5g two pairs -> "2 transfers matched"',has(F,/^2 transfers matched/),F);}
{const F=run(S5([TR({acct:'A',amount:-100,date:'2026-10-10'}),TR({acct:'B',amount:100,date:'2026-10-13'}),TR({acct:'B',amount:100,date:'2026-10-11'})]));T('5h closest date wins; the other stays unmatched',has(F,/^1 transfer matched/)&&/2026-10-13/.test(itemsOf(F,/not in your imported data|goe?s? to or from/)),F);}
{const F=run(S5([TR({acct:'A',amount:-100}),tx({acct:'B',amount:100,cat:'Shopping',desc:'Online Transfer from Chk'})]));T('5i other half categorized as spending -> warn',has(F,/^1 payment looks like the other half of a transfer/,'warn'),F);T('5i the hint line is included',/Set these to Transfer/.test(itemsOf(F,/other half/)));T('5i counts as matched',has(F,/^1 transfer matched/),F);}
{const F=run(S5([TR({acct:'A',amount:-100}),tx({acct:'B',amount:100,cat:'Investing'})]));T('5j counterpart in Investing is already excluded from spending -> no nag',!has(F,/other half/),F);}
{const F=run(S5([TR({acct:'A',amount:-100}),tx({acct:'B',amount:100,cat:'Income'})]));T('5k counterpart in Income IS flagged (it inflates income)',has(F,/other half|look like/,'warn'),F);}
{const F=run(S5([TR({acct:'A',amount:-100}),tx({acct:'B',amount:100,cat:'Shopping'}),TR({acct:'B',amount:100})]));T('5l prefers the Transfer-labeled half over a spending row',!has(F,/other half/)&&has(F,/^1 transfer matched/),F);}
{const F=run(S5([tx({acct:'A',amount:-100,cat:'Shopping'}),tx({acct:'B',amount:100,cat:'Shopping'})]));T('5m two non-transfers are never paired',!has(F,/matched|other half/),F);}
{const F=run(S5([TR({acct:'A',amount:-100,desc:'To Rainy Day Vault'}),TR({acct:'B',amount:100,desc:'From Rainy Day Vault'})]));T('5n vault moves ignored entirely',!has(F,/matched|goe?s? to or from/),F);}
{const F=run(S5([TR({acct:'A',amount:-100,desc:'To Savings Balance'})]));T('5o "to savings balance" is an internal move',!has(F,/goe?s? to or from|should show up/),F);}
{const F=run(S5([TR({acct:'A',amount:-100,desc:'Move to Emergency Pocket'})]));T('5p pocket moves are internal',!has(F,/goe?s? to or from|should show up/),F);}
// miss vs outside
const acctsL4=[acct('A','Checking','checking',{ref:'chase:1111'}),acct('B','Savings 2222','savings',{ref:'chase:2222'})];
{const F=run(S5([TR({acct:'A',amount:-100,desc:'Transfer to savings ...2222'}),tx({acct:'B',date:'2026-10-01',amount:5,cat:'Interest'}),tx({acct:'B',date:'2026-10-30',amount:5,cat:'Interest'})],acctsL4));T('5q other account covers the date but row missing -> warn',has(F,/^1 transfer should show up in another account you imported, but doesn't/,'warn'),F);T('5q names the account',/expected in Savings 2222/.test(itemsOf(F,/should show up/)),F);}
{const F=run(S5([TR({acct:'A',amount:-100,date:'2026-09-01',desc:'Transfer to savings ...2222'}),tx({acct:'B',date:'2026-10-01',amount:5,cat:'Interest'}),tx({acct:'B',date:'2026-10-30',amount:5,cat:'Interest'})],acctsL4));T('5r date before the other account history -> info, not warn',!has(F,/should show up/)&&has(F,/goe?s? to or from/,'info')&&/before Savings 2222 history starts/.test(itemsOf(F,/goe?s? to or from/)),F);}
{const F=run(S5([TR({acct:'A',amount:-100,date:'2026-12-01',desc:'Transfer to savings ...2222'}),tx({acct:'B',date:'2026-10-01',amount:5,cat:'Interest'}),tx({acct:'B',date:'2026-10-30',amount:5,cat:'Interest'})],acctsL4));T('5s date after the other account history -> info',!has(F,/should show up/),F);}
{const A=[acct('A','Checking','checking',{ref:'chase:1111'}),acct('B','Savings','savings',{ref:'chase:2222'})];const F=run(S5([TR({acct:'A',amount:-100,desc:'Transfer to ...9999'})],A));T('5t unknown last-4 -> info',has(F,/goe?s? to or from/,'info')&&!has(F,/should show up/),F);}
{const A=[acct('A','Checking','checking',{ref:'chase:1111'}),acct('B','Savings','savings',{ref:'chase:2222'})];const F=run(S5([TR({acct:'A',amount:-100,desc:'Transfer to ...1111'})],A));T('5u last-4 pointing at the same account is not "expected elsewhere"',!has(F,/should show up/),F);}
{const A=[acct('A','Checking'),acct('B','Savings ••2222','savings')];const F=run(S5([TR({acct:'A',amount:-100,desc:'Transfer to XXXX2222'}),tx({acct:'B',date:'2026-10-01',amount:5}),tx({acct:'B',date:'2026-10-30',amount:5})],A));T('5v last-4 read from the account name',has(F,/should show up/,'warn'),F);}
{const F=run(S5([TR({acct:'A',amount:-100,desc:'Transfer to acct ending in 2222'}),tx({acct:'B',date:'2026-10-01',amount:5}),tx({acct:'B',date:'2026-10-30',amount:5})],acctsL4));T('5w "ending in 2222" wording',has(F,/should show up/),F);}
{const F=run(S5([TR({acct:'A',amount:-100,desc:'Zelle #2222'}),tx({acct:'B',date:'2026-10-01',amount:5}),tx({acct:'B',date:'2026-10-30',amount:5})],acctsL4));T('5x "#2222" wording',has(F,/should show up/),F);}
{const files=[file({acct:'B',start:'2026-10-01',end:'2026-10-31'})];const S=mk({accounts:acctsL4,files,txns:[TR({acct:'A',amount:-100,date:'2026-10-20',desc:'Transfer to ...2222'})]});T('5y covered by a saved statement period of the other account',has(run(S),/should show up/,'warn'),run(S));}
{const F=run(S5([TR({acct:'A',amount:-100,desc:'T1'}),TR({acct:'B',amount:100,desc:'T2'}),TR({acct:'A',amount:-50,desc:'T3'}),TR({acct:'B',amount:50,desc:'T4'}),TR({acct:'A',amount:-25,desc:'T5'}),TR({acct:'B',amount:25,desc:'T6'})]));T('5z three pairs -> 3 transfers matched',has(F,/^3 transfers matched/),F);}
{const A=[acct('A','A'),acct('B','B'),acct('C','C')];const F=run(S5([TR({acct:'A',amount:-100}),TR({acct:'B',amount:100}),TR({acct:'C',amount:100})],A));T('5aa three accounts: one matched, one leftover',has(F,/^1 transfer matched/)&&has(F,/goe?s? to or from/),F);}
{const F=run(S5([TR({acct:'A',amount:-100,date:'2026-10-10'}),TR({acct:'B',amount:100,date:'2026-10-10'}),TR({acct:'A',amount:-100,date:'2026-10-10'}),TR({acct:'B',amount:100,date:'2026-10-10'})]));T('5ab identical duplicate pairs match one-to-one',has(F,/^2 transfers matched/)&&!has(F,/goe?s? to or from/),F);}
{const F=run(S5([TR({acct:'A',amount:-0.004}),TR({acct:'B',amount:0.004})]));T('5ac sub-cent amounts still pair',has(F,/matched/),F);}

// ---------- 6. housekeeping ----------
{const F=run(mk({txns:[tx({cat:'Uncategorized'})]}));T('6a 1 uncategorized singular',has(F,/^1 uncategorized transaction$/,'warn'),F);}
{const F=run(mk({txns:[tx({cat:'Uncategorized'}),tx({cat:'Uncategorized'})]}));T('6b uncategorized plural',has(F,/^2 uncategorized transactions$/),F);}
{const F=run(mk({txns:[tx({key:'a|1|x|2'}),tx({key:'a|1|x|3'}),tx({key:'a|1|x'}),tx({key:'a|1|x|10'}),tx({key:'a|1|x|1'})]}));T('6c repeat rows: suffix 2-9 and 10+, not 1/none',has(F,/^3 repeat rows/,'info'),F);}
{const F=run(mk({txns:[tx({date:'2026-13-01'})]}));T('6d month 13 is unreadable',has(F,/unreadable date/,'bad'),F);}
{const F=run(mk({txns:[tx({date:'2026-02-30'})]}));T('6e Feb 30 is unreadable',has(F,/unreadable date/,'bad'),F);}
{const F=run(mk({txns:[tx({date:'2026-02-29'})]}));T('6f Feb 29 in a non-leap year is unreadable',has(F,/unreadable date/,'bad'),F);}
{const F=run(mk({txns:[tx({date:'2028-02-29'})]}));T('6g Feb 29 in a leap year is fine',!has(F,/unreadable date/),F);}
{const F=run(mk({txns:[tx({date:'abc'})]}));T('6h non-date text',has(F,/unreadable date/,'bad'),F);}
{const F=run(mk({txns:[tx({date:''})]}));T('6i empty date',has(F,/unreadable date/,'bad'),F);}
{const F=run(mk({txns:[tx({date:'2026-4-5'})]}));T('6j non-padded date is unreadable',has(F,/unreadable date/,'bad'),F);}
{const F=run(mk({txns:[tx({date:'2026-04-31'})]}));T('6k April 31',has(F,/unreadable date/,'bad'),F);}
{const F=run(mk({txns:[tx({date:'2026-11-07'})]}));T('6l tomorrow is future',has(F,/^1 transaction is dated in the future/,'warn'),F);}
{const F=run(mk({txns:[tx({date:'2026-11-06'})]}));T('6m today is not future',!has(F,/future/),F);}
{const F=auditCore(mk({txns:[tx({date:'2099-01-01'})]}));T('6n without a "today" the future check is skipped',!has(F,/future/),F);}
{const t=[];for(let i=0;i<20;i++)t.push(tx({date:'2030-01-'+String(i+1).padStart(2,'0')}));const F=run(mk({txns:t}));T('6o future list capped at 8 items, count is true',has(F,/^20 transactions are dated in the future/)&&find(F,/future/)[0].items.length===8,F);}
{const F=run(mk({txns:[tx({cat:'Income',amount:-5})]}));T('6p negative Income flagged',has(F,/^1 "Income" transaction is negative/,'warn'),F);}
{const F=run(mk({txns:[tx({cat:'Income',amount:5})]}));T('6q positive Income fine',!has(F,/negative/)&&has(F,/Dates and signs look sane/,'ok'),F);}
{const F=run(mk({txns:[tx({date:'2026-13-01'}),tx({date:'2030-01-01'})]}));T('6r no "sane" claim when something is wrong',!has(F,/look sane/),F);}
{const F=run(mk({txns:[]}));T('6s no txns -> no sane claim',!has(F,/look sane/),F);}
{const F=run(mk({txns:[tx({cat:'Uncategorized',date:'2026-13-45'})]}));T('6t bad-date row does not crash other checks',Array.isArray(F),F);}
{const F=run(mk({files:[file({start:'2026-13-01',end:'2026-13-30'})],txns:[tx()]}));T('6u bad statement dates do not crash',Array.isArray(F),F);}

// ---------- dayNum ----------
T('dayNum epoch',dayNum('1970-01-01')===0);T('dayNum consecutive',dayNum('2026-03-01')-dayNum('2026-02-28')===1);T('dayNum leap',dayNum('2028-03-01')-dayNum('2028-02-28')===2);
T('dayNum garbage',isNaN(dayNum('x'))&&isNaN(dayNum(''))&&isNaN(dayNum(null))&&isNaN(dayNum(undefined)));
T('dayNum rejects rolled-over dates',isNaN(dayNum('2026-02-30'))&&isNaN(dayNum('2026-13-01'))&&isNaN(dayNum('2026-00-10'))&&isNaN(dayNum('2026-01-00')));

// ---------- stmtSyncPairs ----------
const P=(accts,txns)=>stmtSyncPairs({accounts:accts||[acct('A')],txns});
{const p=P(null,[tx({sf:true,src:undefined,amount:-12.5,desc:'WALMART 123'}),tx({amount:-12.5,desc:'Walmart Supercenter'})]);T('pairs: same amount same day',p.length===1);}
{const p=P(null,[tx({sf:true,amount:-12.5,date:'2026-10-10'}),tx({amount:-12.5,date:'2026-10-13'})]);T('pairs: 3 days apart pairs',p.length===1);}
{const p=P(null,[tx({sf:true,amount:-12.5,date:'2026-10-10'}),tx({amount:-12.5,date:'2026-10-14'})]);T('pairs: 4 days apart does not',p.length===0);}
{const p=P(null,[tx({sf:true,amount:-12.5}),tx({amount:-12.51})]);T('pairs: different amount does not',p.length===0);}
{const p=P([acct('A'),acct('B')],[tx({sf:true,amount:-12.5}),tx({amount:-12.5,acct:'B'})]);T('pairs: different accounts do not',p.length===0);}
{const p=P(null,[tx({sf:true,amount:-12.5}),tx({sf:true,amount:-12.5})]);T('pairs: two synced rows are not each others duplicates',p.length===0);}
{const p=P(null,[tx({amount:-12.5}),tx({amount:-12.5})]);T('pairs: two manual rows are not duplicates',p.length===0);}
{const p=P(null,[tx({sf:true,amount:-5}),tx({sf:true,amount:-5}),tx({amount:-5}),tx({amount:-5})]);T('pairs: 2 vs 2 identical -> 2 pairs one-to-one',p.length===2&&new Set(p.map(x=>x.manual.id)).size===2&&new Set(p.map(x=>x.sf.id)).size===2,p.length);}
{const p=P(null,[tx({sf:true,amount:-5}),tx({sf:true,amount:-5}),tx({amount:-5})]);T('pairs: 2 synced vs 1 statement -> 1 pair',p.length===1);}
{const a=tx({sf:true,amount:-5,date:'2026-10-10'}),m1=tx({amount:-5,date:'2026-10-12'}),m2=tx({amount:-5,date:'2026-10-10'});const p=P(null,[a,m1,m2]);T('pairs: closest date wins',p.length===1&&p[0].manual.id===m2.id);}
{const p=P(null,[]);T('pairs: empty',p.length===0);}

// ---------- randomized: consistent books must be clean ----------
let seed=12345;const rnd=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};
const cents=n=>Math.round(n*100)/100;
function addDays(iso,n){const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function monthEnd(y,m){return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
for(let trial=0;trial<300;trial++){
  const nAcc=1+Math.floor(rnd()*3),accts=[],files=[],txns=[];
  for(let k=0;k<nAcc;k++){
    const id='ac'+k,type=['checking','savings','credit'][Math.floor(rnd()*3)];accts.push(acct(id,'Acct '+k,type,{ref:'b:'+(1000+k)}));
    let bal=cents(rnd()*5000-1000),y=2026,m=1+Math.floor(rnd()*4);const months=1+Math.floor(rnd()*8);
    for(let i=0;i<months;i++){
      const start=y+'-'+String(m).padStart(2,'0')+'-01',end=monthEnd(y,m),n=Math.floor(rnd()*12);let net=0;const fid='f'+k+'_'+i;
      for(let j=0;j<n;j++){const amt=cents((rnd()-.45)*400),day=1+Math.floor(rnd()*28);net=cents(net+amt);txns.push(tx({acct:id,src:fid,date:y+'-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0'),amount:amt,cat:(amt>0&&rnd()<.3)?'Income':'Shopping'}));}
      files.push(file({id:fid,acct:id,start,end,beginBal:bal,endBal:cents(bal+net),reconcile:{ok:true}}));bal=cents(bal+net);
      m++;if(m>12){m=1;y++;}
    }
  }
  const F=run({accounts:accts,txns,files});
  const bad=lv(F,'bad'),warn=lv(F,'warn');
  // negative "Income" rows are legitimately warned about, so only look at the statement-related findings
  const rel=F.filter(f=>/carry over|Ledger no longer|doesn't match|unreadable|gap|no saved original/.test(f.title));
  T('random consistent books #'+trial+' are clean',rel.length===0,{trial,rel:rel.map(f=>f.title+' '+f.items.slice(0,2))});
}
// ---------- randomized: one perturbation must be caught ----------
for(let trial=0;trial<200;trial++){
  const acc=[acct('A','Chk')],files=[],txns=[];let bal=100;
  for(let i=0;i<4;i++){const m=String(i+1).padStart(2,'0'),start='2026-'+m+'-01',end=monthEnd(2026,i+1);let net=0;
    for(let j=0;j<5;j++){const amt=cents((rnd()-.5)*300+0.37);net=cents(net+amt);txns.push(tx({id:'t'+i+'_'+j,src:'f'+i,date:'2026-'+m+'-'+String(1+j*5).padStart(2,'0'),amount:amt}));}
    files.push(file({id:'f'+i,start,end,beginBal:bal,endBal:cents(bal+net)}));bal=cents(bal+net);}
  const kind=Math.floor(rnd()*4),pick=Math.floor(rnd()*txns.length);
  if(kind===0){txns[pick].amount=cents(txns[pick].amount+0.5+rnd()*50);const F=run({accounts:acc,txns,files});T('perturb amount #'+trial+' caught',has(F,/Ledger no longer/,'bad'));}
  else if(kind===1){txns.splice(pick,1);const F=run({accounts:acc,txns,files});T('perturb delete #'+trial+' caught',has(F,/Ledger no longer/,'bad')||Math.abs(0)>1);}
  else if(kind===2){const i=1+Math.floor(rnd()*3);files[i].beginBal=cents(files[i].beginBal+1+rnd()*20);const F=run({accounts:acc,txns,files});T('perturb opening balance #'+trial+' caught',has(F,/carry over/,'bad'));}
  else{const i=1+Math.floor(rnd()*2);files.splice(i,1);const F=run({accounts:acc,txns,files});T('perturb missing statement #'+trial+' caught',has(F,/gap/,'warn'));}
}
// ---------- fuzz: never throws, shape always valid ----------
const junk=[undefined,null,'',0,'x','2026-02-31',NaN,{},[],'2026-11-06',1e9,-1e9];
for(let i=0;i<3000;i++){
  const pk=a=>a[Math.floor(rnd()*a.length)];
  const accts=[acct('A','A',pk(['checking','credit','brokerage',undefined])),acct('B','B ••1234',pk(['savings','other']),{ref:pk([undefined,'x:1234','junk'])})];
  const txns=[];const n=Math.floor(rnd()*30);
  for(let j=0;j<n;j++)txns.push({id:'q'+i+'_'+j,acct:pk(['A','B','Z']),date:rnd()<.8?'2026-1'+Math.floor(rnd()*3)+'-'+String(Math.floor(rnd()*32)).padStart(2,'0'):pk(junk),desc:pk(['Transfer ...1234','To X Vault','STORE','',undefined]),amount:rnd()<.9?cents((rnd()-.5)*200):pk([0,NaN,undefined]),cat:pk(['Transfer','Income','Shopping','Uncategorized','Investing']),key:pk([undefined,'a|1|b|2','']),src:pk([undefined,'f']),sf:pk([undefined,true])});
  const files=[];for(let j=0;j<Math.floor(rnd()*5);j++)files.push({id:'f'+j,acct:pk(['A','B','Z']),kind:pk(['pdf','csv','ofx']),start:pk(['2026-10-01','2026-11-01',undefined,'bad']),end:pk(['2026-10-31','2026-11-30',undefined,'bad']),beginBal:pk([0,100,null,undefined]),endBal:pk([0,100,null,undefined]),noLedger:pk([undefined,true]),reconcile:pk([undefined,{ok:true},{ok:false,expected:1,got:2}])});
  let F;try{F=auditCore({accounts:accts,txns,files},pk([TODAY,undefined,'']));}catch(e){T('fuzz #'+i+' threw',false,e.message);continue;}
  T('fuzz #'+i+' shape',F.every(f=>['bad','warn','info','ok'].includes(f.lvl)&&typeof f.title==='string'&&!/undefined|NaN/.test(f.title)&&f.items.every(x=>typeof x==='string')),F.filter(f=>/undefined|NaN/.test(f.title)||f.items.some(x=>typeof x!=='string')).slice(0,2));
  const again=auditCore({accounts:accts,txns,files},TODAY),F2=auditCore({accounts:accts,txns,files},TODAY);T('fuzz #'+i+' deterministic',JSON.stringify(again)===JSON.stringify(F2));
}
console.log(fail?('\n'+fail+' FAILED, '+pass+' passed'):('\nALL '+pass+' PASSED'));process.exit(fail?1:0);
