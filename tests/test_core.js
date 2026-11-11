const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const core=html.split('// ==CORE START==')[1].split('// ==CORE END==')[0];
const api=new Function(core+';return {parseCSV,detectDelim,parseDate,parseAmount,findHeader,guessMapping,extractTxns,guessFlip,parseOFX,assignKeys,categorize,merchantKey,stmtSyncPairs,LEGACY_RULES,DEFAULT_RULES};')();
let fail=0;
const eq=(name,a,b)=>{const ok=JSON.stringify(a)===JSON.stringify(b);if(!ok){fail++;console.log('FAIL',name,'\n  got ',JSON.stringify(a),'\n  want',JSON.stringify(b));}else console.log('ok  ',name);};

// primitives
eq('date mdy',api.parseDate('11/01/2026'),'2026-11-01');
eq('date m/d/yy',api.parseDate('1/5/26'),'2026-01-05');
eq('date iso',api.parseDate('2026-11-01'),'2026-11-01');
eq('date text',api.parseDate('Nov 3, 2026'),'2026-11-03');
eq('date junk',api.parseDate('Pending'),null);
eq('date number',api.parseDate('5'),null);
eq('amt neg',api.parseAmount('-$1,234.50'),-1234.5);
eq('amt paren',api.parseAmount('(45.00)'),-45);
eq('amt trailing',api.parseAmount('12.30-'),-12.3);
eq('amt empty',isNaN(api.parseAmount('')),true);
eq('amt word',isNaN(api.parseAmount('DEBIT')),true);

const run=(csv,type)=>{
  const rows=api.parseCSV(csv,api.detectDelim(csv));
  const hi=api.findHeader(rows);
  const headers=rows[hi].map(x=>x.trim());
  const map=api.guessMapping(headers);
  let r=api.extractTxns(rows,hi,map,false);
  const flip=api.guessFlip(r.txns,type);
  if(flip) r=api.extractTxns(rows,hi,map,true);
  return {hi,map,flip,...r};
};

// Chase checking (trailing commas)
let r=run(`Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,11/01/2026,"KROGER #123 CINCINNATI OH",-54.21,DEBIT_CARD,1200.00,,
CREDIT,10/31/2026,"ACME CORP PAYROLL",2400.00,ACH_CREDIT,1254.21,,
DEBIT,10/30/2026,"Payment to Chase card ending in 1234",-300.00,ACCT_XFER,-1145.79,,
`,'checking');
eq('chase chk count',r.txns.length,3);
eq('chase chk first',r.txns[0],{date:'2026-11-01',desc:'KROGER #123 CINCINNATI OH',amount:-54.21});
eq('chase chk flip',r.flip,false);
eq('cat kroger',api.categorize(r.txns[0].desc,r.txns[0].amount,[]),'Groceries');
eq('cat payroll',api.categorize(r.txns[1].desc,r.txns[1].amount,[]),'Income');

// Chase credit card (signed)
r=run(`Transaction Date,Post Date,Description,Category,Type,Amount,Memo
11/01/2026,11/02/2026,AMAZON.COM*2K4L9 AMZN.COM/BILL WA,Shopping,Sale,-23.99,
10/30/2026,10/31/2026,Payment Thank You-Mobile,,Payment,300.00,
10/29/2026,10/30/2026,CHIPOTLE 1842,Food & Drink,Sale,-12.40,
`,'credit');
eq('chase cc flip',r.flip,false);
eq('chase cc date col',r.map.date,0);
eq('chase cc cat0',api.categorize(r.txns[0].desc,r.txns[0].amount,[]),'Shopping');
eq('chase cc payment',api.categorize(r.txns[1].desc,r.txns[1].amount,[]),'Transfer');

// Discover (purchases positive)
r=run(`Trans. Date,Post Date,Description,Amount,Category
11/01/2026,11/02/2026,STARBUCKS STORE 123,5.75,Restaurants
11/01/2026,11/02/2026,SHELL OIL 57312,40.10,Gasoline
10/31/2026,11/01/2026,TARGET 00012345,62.00,Merchandise
10/30/2026,10/30/2026,NETFLIX.COM,15.49,Services
10/29/2026,10/29/2026,DIRECTPAY FULL BALANCE,-100.00,Payments and Credits
`,'credit');
eq('discover flip',r.flip,true);
eq('discover purchase neg',r.txns[0].amount,-5.75);
eq('discover payment pos',r.txns[4].amount,100);
eq('discover payment cat',api.categorize(r.txns[4].desc,r.txns[4].amount,[]),'Transfer');
eq('discover shell',api.categorize(r.txns[1].desc,r.txns[1].amount,[]),'Gas');

// SoFi
r=run(`Date,Description,Type,Amount,Current balance,Status
2026-11-01,Direct Deposit ACME,Deposit,2400.00,3000.00,Posted
2026-11-02,Netflix,Card,-15.49,2984.51,Posted
2026-11-03,Transfer to Vault,Transfer,-100.00,2884.51,Posted
`,'checking');
eq('sofi count',r.txns.length,3);
eq('sofi dd income',api.categorize(r.txns[0].desc,r.txns[0].amount,[]),'Income');
eq('sofi netflix',api.categorize(r.txns[1].desc,r.txns[1].amount,[]),'Subscriptions');
eq('sofi transfer',api.categorize(r.txns[2].desc,r.txns[2].amount,[]),'Transfer');

// Fidelity brokerage with preamble + footer
r=run(`

Run Date,Account,Account Number,Action,Symbol,Security Description,Security Type,Quantity,Price ($),Commission ($),Fees ($),Accrued Interest ($),Amount ($),Settlement Date
11/01/2026,Individual,X123,YOU BOUGHT VANGUARD S&P 500 ETF (VOO) (Cash),VOO,VANGUARD S&P 500,Cash,2,500,,,,-1000.00,11/03/2026
11/02/2026,Individual,X123,DIVIDEND RECEIVED,VOO,VANGUARD S&P 500,Cash,,,,,,3.20,

"The data and information in this spreadsheet is provided to you solely for your use and is not for distribution."
"Date downloaded 11/03/2026 10:00 am"
`,'brokerage');
eq('fid header idx',r.hi,0);
eq('fid count',r.txns.length,2);
eq('fid skipped footer',r.skipped>=1,true);
eq('fid bought',api.categorize(r.txns[0].desc,r.txns[0].amount,[]),'Investing');
eq('fid dividend',api.categorize(r.txns[1].desc,r.txns[1].amount,[]),'Income');

// Separate debit/credit columns (Marcus-style / generic)
r=run(`Date,Description,Debit,Credit,Balance
01/05/2026,Interest Paid,,12.34,5012.34
01/09/2026,Transfer to checking,500.00,,4512.34
`,'savings');
eq('debit/credit count',r.txns.length,2);
eq('credit +',r.txns[0].amount,12.34);
eq('debit -',r.txns[1].amount,-500);
eq('interest income',api.categorize(r.txns[0].desc,r.txns[0].amount,[]),'Interest');

// Semicolon CSV with BOM + quoted commas
r=run('\uFEFFDate;Payee;Amount\n05.01.2026;x;1\n',  'checking');
eq('semicolon delim',api.detectDelim('Date;Payee;Amount\n01/05/2026;"A, B";-3,20\n'),';');

// OFX (SGML, no closing tags) and XML
const ofx=`OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261101120000
<TRNAMT>-54.21
<FITID>1
<NAME>KROGER #123
<MEMO>POS PURCHASE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261031
<TRNAMT>2400.00
<FITID>2
<NAME>ACME &amp; CO PAYROLL
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const o=api.parseOFX(ofx);
eq('ofx count',o.length,2);
eq('ofx first',o[0],{date:'2026-11-01',desc:'KROGER #123 - POS PURCHASE',amount:-54.21});
eq('ofx entity',o[1].desc,'ACME & CO PAYROLL');
const sgml=`<OFX><STMTTRN><DTPOSTED>20261101<TRNAMT>-5.00<NAME>COFFEE<STMTTRN><DTPOSTED>20261102<TRNAMT>-6.00<NAME>TACO</OFX>`;
eq('ofx no-close count',api.parseOFX(sgml).length,2);

// Dedupe incl. identical same-day txns
const t=[{date:'2026-11-01',desc:'COFFEE',amount:-4},{date:'2026-11-01',desc:'COFFEE',amount:-4},{date:'2026-11-02',desc:'X',amount:-1}];
let k=api.assignKeys('a',t,new Set());
eq('keys fresh',k.fresh.length,3);
const ex=new Set(k.fresh.map(x=>x.key));
let k2=api.assignKeys('a',t,ex);
eq('re-import all dup',[k2.fresh.length,k2.dup],[0,3]);
let k3=api.assignKeys('a',t.concat([{date:'2026-11-01',desc:'COFFEE',amount:-4}]),ex);
eq('third identical is new',[k3.fresh.length,k3.dup],[1,3]);

// user rules + merchant key + word boundary
eq('user rule wins',api.categorize('KROGER FUEL',-30,[{match:'kroger fuel',cat:'Gas'}]),'Gas');
eq('boundary: current != rent',api.categorize('CURRENT ACCOUNT FEE X',-1,[]),'Uncategorized');
eq('uber eats dining',api.categorize('UBER EATS HELP.UBER.COM',-20,[]),'Dining');
eq('uber transport',api.categorize('UBER *TRIP',-20,[]),'Transport');
eq('merchant key',api.merchantKey('AMAZON.COM*2K4L9 AMZN.COM/BILL WA'),'amazon com');
eq('unknown positive',api.categorize('Venmo cashout',20,[]),'Income');
eq('unknown negative',api.categorize('Mystery Merchant',-20,[]),'Uncategorized');

// statement rows vs bank-synced rows
{const S={accounts:[{id:'a'},{id:'b'}],txns:[
 {id:'1',acct:'a',date:'2026-10-06',amount:-800,desc:'ATM WITHDRAWAL 000619',sf:true},
 {id:'2',acct:'a',date:'2026-10-06',amount:-800,desc:'ATM Withdrawal 10/06 755 W L'},
 {id:'3',acct:'a',date:'2026-10-09',amount:-4.5,desc:'coffee',sf:true},
 {id:'4',acct:'a',date:'2026-10-10',amount:-4.5,desc:'Coffee'},
 {id:'5',acct:'a',date:'2026-10-11',amount:-4.5,desc:'Coffee 2nd'},
 {id:'6',acct:'b',date:'2026-10-06',amount:-800,desc:'other account'},
 {id:'7',acct:'a',date:'2026-09-01',amount:-10,desc:'old statement only'}]};
 const P=api.stmtSyncPairs(S);
 eq('pairs found',P.length,2);
 eq('closest date first',P.find(x=>x.sf.id==='3').manual.id,'4');
 eq('never crosses accounts',P.some(x=>x.manual.id==='6'),false);}

// bill pay to a payee is spending, card payments are transfers
eq('online payment to HOA is not a transfer',api.categorize('Online Payment 29736687071 To Lakes of River Trails II HOA 09/24',-100,[])!=='Transfer',true);
eq('online payment to amex is a transfer',api.categorize('Online Payment 123 To Amex Epayment',-500,[]),'Transfer');
eq('chase card payment is a transfer',api.categorize('Payment To Chase Card Ending IN 9102',-900,[]),'Transfer');
eq('internal vault move stays transfer',api.categorize('From Joint savings balance',250,[]),'Transfer');

// ---- built-in category rules ----
{const c=(d,a=-10)=>api.categorize(d,a,[]);
 const eq=(n,g,w)=>{ if(g!==w){console.log('FAIL cat '+n+': got '+g+' want '+w);fail=true;} else console.log('ok   cat '+n); };
 eq('Walmart supercenter groceries',c('WM SUPERCENTER #5080'),'Groceries');
 eq('Wal-Mart groceries',c('WAL-MART #1455'),'Groceries');
 eq('Target card payment is a transfer',c('TARGET CARD SRVC PAYMENT H 418366718'),'Transfer');
 eq('Target store shopping',c('TARGET T-1766 HURST TX'),'Shopping');
 eq('Vault interest is Interest',c('Interest earned (House Vault)',1.2),'Interest');
 for(const d of ['INTEREST PAYMENT','Interest Earned','INTEREST CREDIT','Interest Paid','CREDIT INTEREST','BONUS INTEREST','Savings Interest','INTEREST ADJUSTMENT','Interest Income','INTEREST DEPOSIT','CD Interest Payment','Interest Paid 03/31','INTEREST']) eq('interest phrase "'+d+'"',c(d,3.21),'Interest');
 eq('interest charge stays a fee',c('INTEREST CHARGE ON PURCHASES',-23.5),'Fees & Interest');
 eq('finance charge stays a fee',c('FINANCE CHARGE',-8),'Fees & Interest');
 eq('refund of an interest charge is not Interest income',c('INTEREST CHARGE REVERSAL',8)!=='Interest',true);
 eq('negative interest line is not income',c('INTEREST PAYMENT',-3)!=='Interest'&&c('INTEREST PAYMENT',-3)!=='Income',true);
 eq('dividend stays income',c('DIVIDEND RECEIVED',4.2),'Income');
 eq('paycheck stays income',c('ACME CORP PAYROLL',2500),'Income');
 eq('your own rule beats Interest',api.categorize('INTEREST PAYMENT',3,[{match:'interest payment',cat:'Income'}]),'Income');
 eq('Vault move still transfer',c('To House Vault'),'Transfer');
 eq('From Joint is a transfer, not income',c('From Joint',950),'Transfer');
 eq('From Joint savings balance',c('From Joint savings balance',950),'Transfer');
 eq('Mortgage',c('FIRSTUNITEDBANK LOAN PMT 0003379574'),'Housing');
 eq('Toast restaurant',c('TST*SUSHI GO- HURST'),'Dining');
 eq('Dutch Bros',c('DUTCH BROS TX1403 HURST'),'Dining');
 eq('DoorDash via DD',c('DD *HAWAIIANBROS'),'Dining');
 eq('Pets',c('PETSMART # 0190'),'Pets');
 eq('Barber',c('SQ *STYLE HOUSE BARBERSHO'),'Personal Care');
 eq('Toll',c('NTTA AUTOCHARGE'),'Transport');
 eq('Energy bill',c('BKV ENERGY'),'Bills & Utilities');
 eq('Medical',c('MED*TEXASHEALTH RESOURCES'),'Health');
 eq('Claude sub',c('GOOGLE *Claude by Anth'),'Subscriptions');
 eq('Sweep into money market is investing',c('PURCHASE INTO CORE ACCOUNT FIDELITY GOVERNMENT MONEY MARKET'),'Investing');
 eq('Dividend stays income',c('DIVIDEND RECEIVED FIDELITY GOVERNMENT MONEY MARKET (SPAXX)',3),'Income');
 eq('Browns chicken not a salon',c('BROWNS CHICKEN'),'Uncategorized');
 eq('Your own rule still wins',api.categorize('WM SUPERCENTER',-5,[{match:'wm supercenter',cat:'Shopping'}]),'Shopping');
 eq('Old rules still available for the upgrade',api.categorize('WAL-MART #1',-5,[],api.LEGACY_RULES),'Shopping');
}
console.log(fail?('\n'+fail+' FAILED'):'\nALL PASSED');
process.exit(fail?1:0);
