/* ===== EM bond optimizer engine, managed against an index: synthetic universe, bonds, ADMM solver ===== */
var REG=['Latin America','Europe & Central Asia','Middle East','Africa','Asia'];
var QUAL=['IG','BB','B','CCC'];
var SEC=['Sovereign','Quasi','Corporate'];
var CTRY=[
['Mexico','MX',0,0,5],['Brazil','BR',0,1,5],['Colombia','CO',0,1,4],['Chile','CL',0,0,4],['Peru','PE',0,0,3],
['Argentina','AR',0,3,3],['Ecuador','EC',0,3,2],['Dominican Rep.','DO',0,1,3],['Panama','PA',0,0,3],['Uruguay','UY',0,0,2],
['Costa Rica','CR',0,1,2],['Guatemala','GT',0,1,2],['El Salvador','SV',0,2,1],['Paraguay','PY',0,1,1],['Jamaica','JM',0,1,1],
['Poland','PL',1,0,3],['Hungary','HU',1,0,3],['Romania','RO',1,0,3],['Türkiye','TR',1,1,5],['Serbia','RS',1,1,1],
['Ukraine','UA',1,3,2],['Kazakhstan','KZ',1,0,2],['Uzbekistan','UZ',1,1,1],['Azerbaijan','AZ',1,1,1],['Georgia','GE',1,1,1],
['Bulgaria','BG',1,0,1],['Armenia','AM',1,1,1],
['Saudi Arabia','SA',2,0,5],['UAE','AE',2,0,5],['Qatar','QA',2,0,4],['Oman','OM',2,0,3],['Bahrain','BH',2,2,3],
['Kuwait','KW',2,0,2],['Jordan','JO',2,1,2],['Iraq','IQ',2,2,1],['Lebanon','LB',2,3,1],['Israel','IL',2,0,3],
['South Africa','ZA',3,1,4],['Egypt','EG',3,2,4],['Nigeria','NG',3,2,3],['Kenya','KE',3,2,2],['Ghana','GH',3,3,2],
['Angola','AO',3,2,2],["Côte d'Ivoire",'CI',3,1,2],['Senegal','SN',3,2,1],['Morocco','MA',3,1,2],['Zambia','ZM',3,3,1],
['Ethiopia','ET',3,3,1],['Gabon','GA',3,3,1],['Mozambique','MZ',3,3,1],
['Indonesia','ID',4,0,5],['Philippines','PH',4,0,4],['Malaysia','MY',4,0,3],['China','CN',4,0,4],['India','IN',4,0,3],
['Sri Lanka','LK',4,3,2],['Pakistan','PK',4,3,2],['Mongolia','MN',4,2,1],['Vietnam','VN',4,1,1],['Papua New Guinea','PG',4,2,1]];

function rng32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function gauss(r){var u=0,v=0;while(u===0)u=r();v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
var DURB=['0\u20133y','3\u20135y','5\u20137y','7\u201310y','10y+'],DURE=[3,5,7,10];
function durBucket(d){for(var i=0;i<DURE.length;i++)if(d<DURE[i])return i;return DURE.length;}
/* Average return over the best (dir=1) or worst (dir=-1) 25% of a bucket's scenario outcomes. */
function tailAvg(scen,dir){var s=scen.slice().sort(function(a,b){return dir<0?a.r-b.r:b.r-a.r;}),left=0.25,acc=0,j;
  for(j=0;j<s.length&&left>1e-12;j++){var t=Math.min(left,s[j].p);acc+=t*s[j].r;left-=t;}
  return acc/0.25;}
/* Bull and bear case per bucket. Where the analyst gives an upside (downside) scenario, the case is the average of the
   best (worst) 25% of outcomes. Where one is missing - or for every bucket when caseMode is 'all' - the case is the base
   scenario plus a K standard deviation tightening (widening) of the bucket's own spread; K is 2 by default. */
/* ---- Bull and bear shocks.  The size is either K standard deviations of the relative spread change, or a percentile of its
        distribution (taken as lognormal, so a widening is larger than the matching tightening).  The distribution is the
        bucket's own, its country's, or that of all buckets with the same rating. ---- */
function invNorm(q){var a=[-39.69683028665376,220.9460984245205,-275.9285104469687,138.3577518672690,-30.66479806614716,2.506628277459239],
  b=[-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572],
  c=[-0.007784894002430293,-0.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783],
  d=[0.007784695709041462,0.3224671290700398,2.445134137142996,3.754408661907416],x,r;
  if(q<0.02425){x=Math.sqrt(-2*Math.log(q));return (((((c[0]*x+c[1])*x+c[2])*x+c[3])*x+c[4])*x+c[5])/((((d[0]*x+d[1])*x+d[2])*x+d[3])*x+1);}
  if(q>1-0.02425){x=Math.sqrt(-2*Math.log(1-q));return -(((((c[0]*x+c[1])*x+c[2])*x+c[3])*x+c[4])*x+c[5])/((((d[0]*x+d[1])*x+d[2])*x+d[3])*x+1);}
  x=q-0.5;r=x*x;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*x/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}
function shocks(U,p){var n=U.n,B=U.B,src=p.caseSrc||'own',vol=new Float64Array(n),tg=new Float64Array(n),wd=new Float64Array(n),i,acc={},wt={};
  if(src!=='own'){for(i=0;i<n;i++){var key=src==='country'?B[i].c:B[i].q;acc[key]=(acc[key]||0)+U.wb[i]*B[i].vol;wt[key]=(wt[key]||0)+U.wb[i];}}
  var pct=p.caseShock==='pct',K=p.caseK==null?2:p.caseK,z=pct?invNorm(Math.min(0.999,Math.max(0.5,(p.casePct==null?95:p.casePct)/100))):0;
  for(i=0;i<n;i++){var ky=src==='country'?B[i].c:B[i].q,s=src==='own'||!(wt[ky]>0)?B[i].vol:acc[ky]/wt[ky];vol[i]=s;
    if(pct){wd[i]=Math.exp(z*s-s*s/2)-1;tg[i]=Math.max(0,1-Math.exp(-z*s-s*s/2));}else{tg[i]=Math.min(K*s,0.9);wd[i]=K*s;}}
  return {tg:tg,wd:wd,vol:vol};}
function cases(U,p){var n=U.n,B=U.B,bull=new Float64Array(n),bear=new Float64Array(n),sh=shocks(U,p),all=p.caseMode==='all',bb=0,be=0,i;
  for(i=0;i<n;i++){var b=B[i],up=b.base+sh.tg[i]*b.dts,dn=b.base-sh.wd[i]*b.dts;
    bull[i]=all||!b.hasUp?up:b.bullS;bear[i]=all||!b.hasDn?dn:b.bearS;bb+=U.wb[i]*bull[i]/100;be+=U.wb[i]*bear[i]/100;}
  return {bull:bull,bear:bear,benchBull:bb,benchBear:be};}

function buildUniverse(seed){
  var r=rng32(seed||7),nc=CTRY.length,i,j,k;
  // country factor model for relative spread changes (annualised)
  var gl=[],rl=[],idv=[];
  for(i=0;i<nc;i++){var q=CTRY[i][3];gl.push(0.75+0.5*r()+0.08*q);rl.push(0.6+0.8*r());idv.push(0.09+0.10*r()+0.03*q);}
  var gv=0.26,rv=0.13,F=[];
  for(i=0;i<nc;i++){F.push(new Float64Array(nc));for(j=0;j<nc;j++){
    var v=gl[i]*gl[j]*gv*gv;if(CTRY[i][2]===CTRY[j][2])v+=rl[i]*rl[j]*rv*rv;if(i===j)v+=idv[i]*idv[i];F[i][j]=v;}}
  var B=[];
  for(i=0;i<nc;i++){
    var c=CTRY[i],size=c[4],secs=[0];
    if(size>=3||(size===2&&r()<0.5))secs.push(1);
    if(size>=4||(size===3&&r()<0.6))secs.push(2);
    var share=[0.62,0.24,0.14];
    for(k=0;k<secs.length;k++){
      var s=secs[k],ql=c[3];if(s===2&&r()<0.4)ql=Math.min(3,ql+1);
      var sp=[90,210,390,820][ql]*(1+[0.9,0.55,0.55,0.8][ql]*r())*[1,1.2,1.4][s];
      var sd=[7.2,6.2,5.2,4.2][ql]*(0.75+0.5*r())*[1,0.9,0.72][s];
      var dts=sd*sp/100;
      var load=[1,1.05,0.88][s]*(0.92+0.16*r()),res=[0.04,0.10,0.16][s]*(0.8+0.4*r());
      var raw=Math.pow(size,1.7)*share[s]*(0.7+0.6*r());
      // scenarios (12-month total return, %)
      var alpha=gauss(r)*[0.7,1.3,2.2,3.6][ql];
      var muT=4.1+0.5*sp/100+alpha;
      // number of scenarios rises as quality falls; the weakest credits always carry a stress case
      var u4=r(),nS=ql===0?(u4<0.34?1:u4<0.67?2:3):ql===1?(u4<0.4?2:u4<0.8?3:4):ql===2?(u4<0.5?3:4):4,sc;
      if(nS===1)sc=[['Base',1,0]];
      else if(nS===2)sc=[['Base',0.75,0],['Spreads widen',0.25,-0.35*dts]];
      else if(nS===3)sc=[['Spreads tighten',0.25,0.2*dts],['Base',0.5,0],['Spreads widen',0.25,-0.35*dts]];
      else sc=[['Spreads tighten',0.2,0.2*dts],['Base',0.5,0],['Spreads widen',0.22,-0.35*dts],[ql===3?'Restructuring':'Stress',0.08,-0.8*dts-(ql===3?12:ql===2?4:0)]];
      // the analyst view (alpha) sits in the good scenarios only, so a strong view does not soften the downside
      var sh=0,pg=0;for(j=0;j<sc.length;j++){sh+=sc[j][1]*sc[j][2];if(sc[j][2]>=0)pg+=sc[j][1];}
      var scen=sc.map(function(x){return {name:x[0],p:x[1],k:x[2]>0?1:x[2]<0?-1:0,r:muT-alpha-sh+x[2]+(x[2]>=0?alpha/pg:0)};});
      B.push({id:c[1]+'-'+['SOV','QS','CORP'][s],c:i,country:c[0],code:c[1],reg:c[2],sec:s,q:ql,spread:sp,sd:sd,dur:sd*(1.02+0.1*r()),
        dts:dts,yld:4.1+sp/100,price:[99,95,90,72][ql]+8*(r()-0.5)*(1+ql),mu:muT,scen:scen,base:muT-alpha-sh+alpha/pg,hasUp:sc.some(function(x){return x[2]>0;}),hasDn:sc.some(function(x){return x[2]<0;}),bullS:tailAvg(scen,1),bearS:tailAvg(scen,-1),vol:Math.sqrt(load*load*F[i][i]+res*res),load:load,res:res,raw:raw,tc:[0.6,1,1.5,2.5][ql]*[1,1.1,1.3][s]});
    }
  }
  var n=B.length,tot=0;for(i=0;i<n;i++)tot+=B[i].raw;
  var wb=new Float64Array(n),w0=new Float64Array(n),t0=0;
  for(i=0;i<n;i++){wb[i]=100*B[i].raw/tot;var z=r()<0.12?0:wb[i]*Math.exp(0.30*gauss(r));w0[i]=z;t0+=z;}
  for(i=0;i<n;i++)w0[i]*=98/t0;
  // bucket covariance of relative spread changes, and return-space matrix Q = E S E  (E = DTS/100)
  var Q=new Float64Array(n*n);
  for(i=0;i<n;i++)for(j=0;j<n;j++){var s2=B[i].load*B[j].load*F[B[i].c][B[j].c];if(i===j)s2+=B[i].res*B[i].res;Q[i*n+j]=s2*B[i].dts*B[j].dts/1e4;}
  // beta row: beta(w) = sum g_i w_i
  var g=new Float64Array(n),den=0,bd=0;
  for(i=0;i<n;i++){var a=0;for(j=0;j<n;j++)a+=Q[i*n+j]*wb[j];g[i]=a;den+=a*wb[i];bd+=wb[i]*B[i].dts/100;}
  for(i=0;i<n;i++)g[i]/=den;
  var bRet=0;for(i=0;i<n;i++)bRet+=wb[i]*B[i].mu/100;
  // ---- bonds: 2 to 5 per bucket. Index-weighted bond averages reproduce the bucket's spread, DTS and returns exactly ----
  var rb=rng32((seed||7)*7919+101),bonds=[],bondsOf=[];
  for(i=0;i<n;i++){var bk=B[i],sz=CTRY[bk.c][4],K=2+Math.floor(rb()*2)+(sz>=4?1:0)+(bk.sec===0&&sz>=3?1:0);
    var sh=[],mats=[],mm=[],qq=[],dd=[],cc=[],st=0,sm=0,sq=0,sdv=0,scur=0,tm=0;
    for(j=0;j<K;j++){sh.push(0.4+rb());st+=sh[j];mats.push(2027+Math.floor(rb()*24));}
    mats.sort(function(x,y){return x-y;});
    for(j=0;j<K;j++){sh[j]/=st;tm+=sh[j]*(mats[j]-2026);}
    for(j=0;j<K;j++){var tn=(mats[j]-2026)/tm-1;mm.push(Math.exp(0.35*tn+0.08*gauss(rb)));qq.push(Math.exp(0.08*tn+0.1*gauss(rb)));dd.push(gauss(rb)*[0.4,0.7,1.1,1.8][bk.q]);
      cc.push(K>2&&rb()<0.25?0:0.3+rb());sm+=sh[j]*mm[j];sq+=sh[j]*qq[j];sdv+=sh[j]*dd[j];scur+=cc[j];}
    if(scur===0){cc[0]=1;scur=1;}
    var ids=[],pavg=0;
    for(j=0;j<K;j++){var m1=mm[j]/sm,q1=qq[j]/sq,dts1=bk.dts*m1,sp1=bk.spread*q1,sd1=dts1*100/sp1,mu1=bk.mu+dd[j]-sdv,y1=4.1+sp1/100;
      var cp=Math.max(1.5,Math.round((4.1+Math.min(sp1,430+170*rb())/100)*(0.75+0.35*rb())*8)/8),pr1=Math.min(125,Math.max(22,100+(cp-y1)*sd1*0.95));
      var tick=bk.code+(bk.sec===0?'':(bk.sec===1?'-Q':'-C')+(1+Math.floor(j/2)));
      ids.push(bonds.length);pavg+=sh[j]*pr1;
      bonds.push({b:i,c:bk.c,name:tick+' '+cp+' '+mats[j],mat:mats[j],cpn:cp,share:sh[j],wb:wb[i]*sh[j],w0:w0[i]*cc[j]/scur,spread:sp1,sd:sd1,dur:sd1*1.03,db:durBucket(sd1*1.03),dts:dts1,m:m1,yld:y1,price:pr1,mu:mu1});}
    bondsOf.push(ids);bk.price=pavg;}
  var U0={n:n,B:B,wb:wb,w0:w0,Q:Q,g:g,L:chol(Q,n),benchDts:bd,benchRet:bRet,bonds:bonds,bondsOf:bondsOf};macroSens(U0);return U0;
}
/* Smallest trade allowed in a bond, in % of NAV: it must be at least minCT of CTDTS and at least minUSD (mio). */
function minPct(dts,rule){return Math.max(rule.minCT/dts,rule.minUSD/rule.nav*100);}
/* Map bucket weights to bonds. Buys go to the bonds with the highest expected return, up to +1% active each, any remainder
   to the bonds already bought; sells come from the lowest expected return first. With a minimum trade size, no piece smaller
   than the minimum is opened. Bond trades always add up to the bucket trade. Returns the bond weights and the buckets whose
   trade could not be split into pieces of allowed size. */
function mapBonds(U,w,rule){var bd=U.bonds,out=new Float64Array(bd.length),bad=[],i,k,a,CAP=1,on=!!rule&&(rule.minCT>0||rule.minUSD>0);
  function mk(x){return on?minPct(bd[x].dts,rule):0;}
  for(k=0;k<bd.length;k++)out[k]=bd[k].w0;
  var fz=(rule&&rule.frozen)||{};
  for(i=0;i<U.n;i++){var ids=U.bondsOf[i].filter(function(x){return !fz[x];}),T=w[i]-U.w0[i],ord,left,picks=[],piece;
    U.bondsOf[i].forEach(function(x){if(fz[x]===2){T+=out[x];out[x]=0;}});          // an excluded bond is sold whole; the rest of the bucket makes up the difference
    if(!ids.length){if(Math.abs(T)>1e-6)bad.push(i);continue;}
    if(T>1e-9){ord=ids.slice().sort(function(x,y){return bd[y].mu-bd[x].mu;});left=T;
      for(a=0;a<ord.length&&left>1e-12;a++){k=ord[a];piece=Math.min(left,Math.max(0,bd[k].wb+CAP-out[k]));
        if(piece<=1e-12||piece<mk(k)-1e-9)continue;
        if(left-piece>1e-12&&left-piece<mk(k))piece=left;                 // do not leave a remainder too small to trade
        out[k]+=piece;left-=piece;picks.push(k);}
      if(left>1e-12){
        if(picks.length){var ss=0;picks.forEach(function(q){ss+=bd[q].share;});picks.forEach(function(q){out[q]+=left*bd[q].share/ss;});}
        else{k=ord[0];out[k]+=left;if(left<mk(k)-1e-9)bad.push(i);}}}
    else if(T<-1e-9){ord=ids.filter(function(x){return out[x]>1e-9;}).sort(function(x,y){return bd[x].mu-bd[y].mu;});left=-T;
      var sold={},done=false,q,b2;
      for(a=0;a<ord.length&&left>1e-12;a++){k=ord[a];piece=Math.min(left,out[k]);
        if(piece<mk(k)-1e-9)continue;
        sold[k]=piece;left-=piece;picks.push(k);}
      if(left>1e-12){
        for(a=0;a<picks.length&&!done;a++){k=picks[a];if(out[k]-sold[k]>=left-1e-12){sold[k]+=left;left=0;done=true;}}     // add to a bond already being sold
        for(a=0;a<ord.length&&!done;a++){k=ord[a];if(sold[k]!=null||out[k]<mk(k)-1e-9)continue;                          // or open another bond at its minimum,
          var need=Math.max(left,mk(k));if(out[k]<need-1e-12)continue;var d=need-left;                                 // taking the difference from a bond already sold
          if(d<=1e-12){sold[k]=left;left=0;done=true;break;}
          for(b2=0;b2<picks.length;b2++){q=picks[b2];if(sold[q]-d>=mk(q)-1e-9){sold[q]-=d;sold[k]=need;left=0;done=true;break;}}}
        if(!done){bad.push(i);                                                                                         // no split of allowed size exists
          for(a=0;a<ord.length&&left>1e-12;a++){k=ord[a];piece=Math.min(left,out[k]-(sold[k]||0));if(piece>0){sold[k]=(sold[k]||0)+piece;left-=piece;}}}}
      for(a=0;a<ord.length;a++)if(sold[ord[a]]!=null)out[ord[a]]-=sold[ord[a]];}}
  return {bw:out,bad:bad};}
/* Which trades break the minimum size: bond trades, and each country's net trade (a pure switch inside a country is not a country trade). */
function checkMin(U,bw,bad,rule){var bd=U.bonds,vb={},vc=[],k,c,nc=CTRY.length,net=new Float64Array(nc),netC=new Float64Array(nc),buy=new Float64Array(nc),sell=new Float64Array(nc);
  if(!rule||!(rule.minCT>0||rule.minUSD>0))return {b:[],c:[]};
  var mc=Math.max(rule.minCT,1e-9),mu=Math.max(rule.minUSD,1e-9);
  for(k=0;k<bd.length;k++){var t=bw[k]-bd[k].w0;if(Math.abs(t)<0.004)continue;c=bd[k].c;net[c]+=t;netC[c]+=t*bd[k].dts;if(t>0)buy[c]+=t;else sell[c]-=t;
    var sc=Math.min(Math.abs(t)*bd[k].dts/mc,Math.abs(t)/100*rule.nav/mu);
    if(sc<1-1e-6){var i=bd[k].b;if(vb[i]==null||sc<vb[i])vb[i]=sc;}}
  bad.forEach(function(i){if(vb[i]==null)vb[i]=0.5;});
  for(c=0;c<nc;c++){if(Math.abs(net[c])<0.01)continue;
    var s2=Math.min(Math.abs(netC[c])/mc,Math.abs(net[c])/100*rule.nav/mu);
    if(s2<1-1e-6)vc.push({c:c,score:s2,sw:buy[c]>0&&sell[c]>0&&Math.min(buy[c],sell[c])>=2*Math.abs(net[c])});}
  return {b:Object.keys(vb).map(function(x){return {i:+x,score:vb[x]};}),c:vc};}
function chol(A,n){var L=new Float64Array(n*n),i,j,k,s;
  for(j=0;j<n;j++){s=A[j*n+j];for(k=0;k<j;k++)s-=L[j*n+k]*L[j*n+k];var d=Math.sqrt(Math.max(s,1e-14));L[j*n+j]=d;
    for(i=j+1;i<n;i++){s=A[i*n+j];for(k=0;k<j;k++)s-=L[i*n+k]*L[j*n+k];L[i*n+j]=s/d;}}
  return L;}
function cholSolve(L,n,b,x){var i,k,s; // L L' x = b
  for(i=0;i<n;i++){s=b[i];var o=i*n;for(k=0;k<i;k++)s-=L[o+k]*x[k];x[i]=s/L[o+i];}
  for(i=n-1;i>=0;i--){s=x[i];for(k=i+1;k<n;k++)s-=L[k*n+i]*x[k];x[i]=s/L[i*n+i];}}

/* Everything against the index: alpha and case alphas in bp, tracking error in bp, DTS as spread duration x spread in bp.
   ctx carries the cash rate (SOFR) and the bull / bear case of each bucket. Cash earns SOFR in every case. */
/* ---- Real data.  universeFromData(D) builds the same universe object as buildUniverse() from a data file in the format of
        docs/DATA_SCHEMA.md: countries, bonds (with scenarios and weights), a covariance of relative spread changes, and
        optionally each bond's return for a +1 std move in the macro factors.  Buckets are country x type x rating. ---- */
var MACM=[
 {name:'US 10y yield',std:'+85 bp',tip:'US Treasury yields rise. Works through duration (price falls with the yield) and a small spread effect.'},
 {name:'US dollar',std:'+7%',tip:'The broad dollar strengthens. EM spreads tend to widen, more for weaker credits.'},
 {name:'Risk aversion (VIX)',std:'+7 points',tip:'Global risk aversion rises. Spreads widen in proportion to each credit\'s spread volatility.'},
 {name:'Oil price',std:'+30%',tip:'Oil rises. Spreads of oil exporters tighten and those of importers widen a little.'},
 {name:'Industrial metals',std:'+20%',tip:'Metals prices rise. Spreads of metals exporters tighten.'},
 {name:'Global growth (PMI)',std:'+2.5 points',tip:'Global growth surprises to the upside. Spreads tighten, more for higher-beta credits.'},
 {name:'China growth',std:'+1.5 pp',tip:'Chinese growth picks up. Spreads tighten for Asia and for commodity exporters.'}];
function universeFromData(D){
  function fail(m){throw new Error('Data file: '+m);}
  function num(v,what){if(typeof v!=='number'||!isFinite(v))fail(what+' must be a number');return v;}
  function pick(list,v,what){var i=typeof v==='number'?v:list.map(function(x){return String(x).toLowerCase();}).indexOf(String(v).toLowerCase());if(!(i>=0&&i<list.length))fail(what+' "'+v+'" is not one of '+list.join(', '));return i;}
  if(!D||!Array.isArray(D.countries)||!Array.isArray(D.bonds))fail('needs "countries" and "bonds" lists');
  if(Array.isArray(D.regions)&&D.regions.length)REG=D.regions.slice();
  var TYPE_ALIAS={sov:0,sovereign:0,government:0,quasi:1,'quasi-sovereign':1,'quasi-government':1,corp:2,corporate:2},i,j,k;
  CTRY=D.countries.map(function(c){if(!c.code||!c.name)fail('every country needs "code" and "name"');return [c.name,c.code,pick(REG,c.region,'region'),c.rating==null?-1:pick(QUAL,c.rating,'rating'),1];});
  var cIdx={};CTRY.forEach(function(c,ix){cIdx[c[1]]=ix;});
  // bonds
  var rows=D.bonds.map(function(b,ix){var nm=b.name||b.id||('bond '+ix);if(!(b.country in cIdx))fail('bond "'+nm+'" has unknown country "'+b.country+'"');
    var t=typeof b.type==='number'?b.type:TYPE_ALIAS[String(b.type).toLowerCase()];if(!(t>=0&&t<3))fail('bond "'+nm+'" type must be Sovereign, Quasi or Corporate');
    var sp=num(b.spread,nm+': spread'),sd=num(b.spreadDuration,nm+': spreadDuration'),sc=Array.isArray(b.scenarios)?b.scenarios:[],ps=0,mu=0;
    if(!sc.length){if(b.expectedReturn==null)fail('bond "'+nm+'" needs "scenarios" or "expectedReturn"');sc=[{name:'Base',prob:1,ret:b.expectedReturn}];}
    sc=sc.map(function(s){var pr=num(s.prob,nm+': scenario prob'),rt=num(s.ret,nm+': scenario ret');ps+=pr;return {name:s.name||'Scenario',p:pr,r:rt};});
    if(!(ps>0))fail('bond "'+nm+'" scenario probabilities add up to zero');
    sc.forEach(function(s){s.p/=ps;mu+=s.p*s.r;});
    var bi=-1,bp=-1;sc.forEach(function(s,q){if(/base/i.test(s.name)&&bi<0)bi=q;});if(bi<0)sc.forEach(function(s,q){if(s.p>bp){bp=s.p;bi=q;}});
    var base=sc[bi].r;sc.forEach(function(s){s.k=s.r>base+1e-9?1:s.r<base-1e-9?-1:0;});
    return {src:b,name:nm,c:cIdx[b.country],sec:t,q:pick(QUAL,b.rating,nm+': rating'),spread:sp,sd:sd,dur:b.duration==null?sd:num(b.duration,nm+': duration'),dts:sd*sp/100,
      yld:b.yield==null?0:b.yield,price:b.price==null?100:b.price,wb:Math.max(0,b.indexWeight||0),w0:Math.max(0,b.portfolioWeight||0),mu:mu,scen:sc,base:base,
      hasUp:sc.some(function(s){return s.k>0;}),hasDn:sc.some(function(s){return s.k<0;}),bullS:tailAvg(sc,1),bearS:tailAvg(sc,-1),cost:b.costBp,mat:b.maturity==null?'':b.maturity,cpn:b.coupon==null?'':b.coupon,macro:b.macro};});
  var sumB=0;rows.forEach(function(r){sumB+=r.wb;});if(!(sumB>0))fail('index weights add up to zero');
  rows.forEach(function(r){r.wb*=100/sumB;});                                  // index weights are scaled to 100%
  // buckets: country x type x rating, in country order
  var groups={},order=[];rows.forEach(function(r,ix){var key=r.c*100+r.sec*10+r.q;if(!groups[key]){groups[key]=[];order.push(key);}groups[key].push(ix);});
  order.sort(function(a,b){return a-b;});
  var n=order.length,B=[],bonds=[],bondsOf=[],wb=new Float64Array(n),w0=new Float64Array(n),costBase=(D.settings&&D.settings.costBaseBp)||30;
  for(i=0;i<n;i++){var ids=groups[order[i]],r0=rows[ids[0]],W=0,P0=0;ids.forEach(function(x){W+=rows[x].wb;P0+=rows[x].w0;});
    var wt=ids.map(function(x){return W>1e-12?rows[x].wb/W:P0>1e-12?rows[x].w0/P0:1/ids.length;});
    var av=function(f){var s=0;ids.forEach(function(x,q){s+=wt[q]*f(rows[x]);});return s;};
    var dts=av(function(r){return r.dts;}),mu=av(function(r){return r.mu;}),cst=0,cw=0;ids.forEach(function(x,q){if(rows[x].cost!=null){cst+=wt[q]*rows[x].cost;cw+=wt[q];}});
    // scenarios shown for the bucket: averaged by name when every bond uses the same names, otherwise the expected return alone
    var names=rows[ids[0]].scen.map(function(s){return s.name;}).join('|'),same=ids.every(function(x){return rows[x].scen.map(function(s){return s.name;}).join('|')===names;});
    var base=av(function(r){return r.base;}),scen=same?rows[ids[0]].scen.map(function(s,q){var rr=av(function(r){return r.scen[q].r;});return {name:s.name,p:av(function(r){return r.scen[q].p;}),r:rr,k:rr>base+1e-9?1:rr<base-1e-9?-1:0};}):[{name:'Expected',p:1,r:mu,k:0}];
    var ctry=CTRY[r0.c];
    B.push({id:ctry[1]+'-'+['SOV','QS','CORP'][r0.sec]+'-'+QUAL[r0.q],c:r0.c,country:ctry[0],code:ctry[1],reg:ctry[2],sec:r0.sec,q:r0.q,spread:av(function(r){return r.spread;}),sd:av(function(r){return r.sd;}),dur:av(function(r){return r.dur;}),
      dts:dts,yld:av(function(r){return r.yld;}),price:av(function(r){return r.price;}),mu:mu,scen:scen,base:base,hasUp:ids.some(function(x){return rows[x].hasUp;}),hasDn:ids.some(function(x){return rows[x].hasDn;}),
      bullS:av(function(r){return r.bullS;}),bearS:av(function(r){return r.bearS;}),vol:0,load:1,res:0,tc:cw>0?cst/cw/costBase:[0.6,1,1.5,2.5][r0.q]*[1,1.1,1.3][r0.sec]});
    var list=[];ids.forEach(function(x,q){var r=rows[x];list.push(bonds.length);wb[i]+=r.wb;w0[i]+=r.w0;
      bonds.push({b:i,c:r.c,id:r.src.id==null?r.name:r.src.id,name:r.name,mat:r.mat,cpn:r.cpn,share:wt[q],wb:r.wb,w0:r.w0,spread:r.spread,sd:r.sd,dur:r.dur,db:durBucket(r.dur),dts:r.dts,m:dts>1e-12?r.dts/dts:1,yld:r.yld,price:r.price,mu:r.mu,scen:r.scen,macro:r.macro});});
    bondsOf.push(list);}
  CTRY.forEach(function(c,ix){if(c[3]<0){var best=-1,bw=-1;B.forEach(function(b,q){if(b.c===ix&&(b.sec===0?2:1)*(wb[q]+1e-9)>bw){bw=(b.sec===0?2:1)*(wb[q]+1e-9);best=b.q;}});c[3]=best<0?1:best;}});
  // covariance of relative spread changes between buckets
  var S=new Float64Array(n*n),rk=D.risk||{},bc=rk.bucketCov,cc=rk.countryCov;
  if(bc){var pos={};bc.keys.forEach(function(x,q){pos[x]=q;});
    for(i=0;i<n;i++){if(!(B[i].id in pos))fail('risk.bucketCov has no row for bucket '+B[i].id);for(j=0;j<n;j++)S[i*n+j]=bc.matrix[pos[B[i].id]][pos[B[j].id]];S[i*n+i]+=1e-10;}}
  else if(cc){var cp={};cc.codes.forEach(function(x,q){cp[x]=q;});var ld=rk.typeLoading||[1,1,1],rs=rk.typeResidualVol||[0.04,0.10,0.16],ov=rk.buckets||{};
    for(i=0;i<n;i++){if(!(B[i].code in cp))fail('risk.countryCov has no row for country '+B[i].code);var o=ov[B[i].id]||{};B[i].load=o.loading==null?ld[B[i].sec]:o.loading;B[i].res=o.residualVol==null?rs[B[i].sec]:o.residualVol;}
    for(i=0;i<n;i++)for(j=0;j<n;j++){var v=B[i].load*B[j].load*cc.matrix[cp[B[i].code]][cp[B[j].code]];if(i===j)v+=B[i].res*B[i].res+1e-10;S[i*n+j]=v;}}
  else fail('needs risk.countryCov or risk.bucketCov');
  var Q=new Float64Array(n*n);for(i=0;i<n;i++){B[i].vol=Math.sqrt(S[i*n+i]);for(j=0;j<n;j++)Q[i*n+j]=S[i*n+j]*B[i].dts*B[j].dts/1e4;}
  var g=new Float64Array(n),den=0,bd=0,bRet=0;
  for(i=0;i<n;i++){var a=0;for(j=0;j<n;j++)a+=Q[i*n+j]*wb[j];g[i]=a;den+=a*wb[i];bd+=wb[i]*B[i].dts/100;bRet+=wb[i]*B[i].mu/100;}
  if(!(den>0))fail('the covariance gives the index no risk');
  for(i=0;i<n;i++)g[i]/=den;
  var L=chol(Q,n);for(i=0;i<n;i++)if(!(L[i*n+i]>0))fail('the covariance matrix is not positive definite');
  var U0={n:n,B:B,wb:wb,w0:w0,Q:Q,g:g,L:L,benchDts:bd,benchRet:bRet,bonds:bonds,bondsOf:bondsOf,real:true,meta:D.meta||{}};
  // macro factors: each bond's return, in %, for a +1 std move; zero when the file gives none
  var mf=D.macro&&Array.isArray(D.macro.factors)&&D.macro.factors.length?D.macro.factors:null;
  if(mf)MACM=mf.map(function(x){return typeof x==='string'?{name:x,std:'1 std',tip:''}:{name:x.name,std:x.std||'1 std',tip:x.tip||''};});
  else if(!rows.some(function(r){return Array.isArray(r.macro);}))MACM=[];
  MACN=MACM.map(function(x){return x.name;});
  var nf=MACN.length,MR=[],mr=[];
  bonds.forEach(function(d){var row=[];for(var f=0;f<nf;f++)row.push(Array.isArray(d.macro)&&isFinite(d.macro[f])?d.macro[f]:0);MR.push(row);});
  for(k=0;k<n;k++){var acc=new Float64Array(nf),ws=0;bondsOf[k].forEach(function(x){var sh=bonds[x].share;ws+=sh;for(var f=0;f<nf;f++)acc[f]+=sh*MR[x][f];});mr.push(acc);}
  U0.MR=MR;U0.mr=mr;return U0;}
/* the mock universe written out in the data-file format: the sample file, and the round-trip test */
function exportData(U){var cov=[],keys=[],n=U.n,i,j;
  for(i=0;i<n;i++){keys.push(U.B[i].id+'-'+QUAL[U.B[i].q]);var row=[];for(j=0;j<n;j++)row.push(U.Q[i*n+j]*1e4/(U.B[i].dts*U.B[j].dts));cov.push(row);}
  return {meta:{name:'Synthetic sample universe',asOf:'2026-11-13',horizonMonths:12,note:'Generated by the mock-up. Replace with real data.'},
    settings:{costBaseBp:30},regions:REG.slice(),
    countries:CTRY.map(function(c){return {code:c[1],name:c[0],region:REG[c[2]],rating:QUAL[c[3]]};}),
    bonds:U.bonds.map(function(d,k){var b=U.B[d.b];return {id:d.name,name:d.name,country:b.code,type:SEC[b.sec],rating:QUAL[b.q],maturity:d.mat,coupon:d.cpn,price:d.price,yield:d.yld,spread:d.spread,duration:d.dur,spreadDuration:d.sd,
      indexWeight:d.wb,portfolioWeight:d.w0,costBp:30*b.tc,scenarios:b.scen.map(function(s){return {name:s.name,prob:s.p,ret:d.mu+(s.r-b.mu)*d.m};}),macro:Array.prototype.slice.call(U.MR[k])};}),
    risk:{bucketCov:{keys:keys,matrix:cov}},
    macro:{factors:MACM.map(function(x){return {name:x.name,std:x.std,tip:x.tip};})}};}

/* ---- Macro factors.  U.MR[bond][f] and U.mr[bucket][f]: return in % for a +1 standard deviation move in factor f.
        Generated for the mock-up from each country's character, with its own random stream so the universe is unchanged;
        a real build estimates them by regression. ---- */
var MACN=['US 10y yield','US dollar','Risk aversion (VIX)','Oil price','Industrial metals','Global growth (PMI)','China growth'];
function macroSens(U){var r=rng32(4242),n=U.n,B=U.B,BD=U.bonds,nf=MACN.length,OIL={SA:1,AE:1,QA:1,OM:1,BH:1,KW:1,IQ:1,NG:1,AO:1,GA:1,KZ:1,AZ:1,EC:1,CO:0.6,MX:0.4,BR:0.3,MY:0.4,GH:0.3},
   IMP={TR:1,IN:1,PK:1,EG:1,KE:1,JO:1,LB:1,PH:1,LK:1,DO:1,JM:1,UA:1,SN:1,MA:1},MET={CL:1,PE:1,ZM:1,MN:1,ZA:0.8,PG:0.8,MZ:0.6,ID:0.5,BR:0.4,KZ:0.3},cb=[],out=[],c,k,j;
  for(c=0;c<CTRY.length;c++){var cd=CTRY[c][1],q=CTRY[c][3]/3,lk=CTRY[c][2]===4?1:Math.max(0.25,0.7*Math.max(OIL[cd]||0,MET[cd]||0),MET[cd]||0);
    cb.push([0.02+0.03*q+0.012*gauss(r),0.04+0.03*q+0.015*gauss(r),0.30*(1+0.15*gauss(r)),(OIL[cd]?-0.10*OIL[cd]:IMP[cd]?0.04:0.02)+0.01*gauss(r),
      (MET[cd]?-0.08*MET[cd]:0)+0.008*gauss(r),-0.16*(1+0.2*gauss(r)),-0.05*lk+0.008*gauss(r)]);}
  var bn=[];for(k=0;k<n;k++){bn.push([]);for(j=0;j<nf;j++)bn[k].push(1+0.1*gauss(r));}
  for(k=0;k<BD.length;k++){var d=BD[k],b=B[d.b],row=[];
    for(j=0;j<nf;j++){var beta=cb[d.c][j]*bn[d.b][j]*(j===2||j===5?b.vol:1);row.push(-d.dts*beta-(j===0?d.dur*0.85:0));}
    out.push(row);}
  var mr=[];for(k=0;k<n;k++){var acc=new Float64Array(nf),ws=0;U.bondsOf[k].forEach(function(x){ws+=BD[x].wb;for(var f=0;f<nf;f++)acc[f]+=BD[x].wb*out[x][f];});
    for(j=0;j<nf;j++)acc[j]=ws>0?acc[j]/ws:0;mr.push(acc);}
  U.MR=out;U.mr=mr;}
function metrics(U,w,ctx){var n=U.n,B=U.B,i,j,sofr=ctx.sofr,bu=ctx.bull,be=ctx.bear,sum=0,beta=0,dtsP=0,te2=0,alpha=0,bull=0,bear=0,a=new Float64Array(n),nc=CTRY.length,cb=new Float64Array(nc),ce=new Float64Array(nc);
  for(i=0;i<n;i++){var b=B[i],ai=w[i]-U.wb[i];a[i]=ai;sum+=w[i];beta+=U.g[i]*w[i];dtsP+=w[i]*b.dts;
    alpha+=ai*(b.mu-sofr);bull+=ai*(bu[i]-sofr);bear+=ai*(be[i]-sofr);cb[b.c]+=ai*(bu[i]-b.mu);ce[b.c]+=ai*(be[i]-b.mu);}
  for(i=0;i<n;i++){var t=0,o=i*n;for(j=0;j<n;j++)t+=U.Q[o+j]*a[j];te2+=t*a[i];}
  var worst={v:0,c:-1,up:true};for(i=0;i<nc;i++){if(cb[i]<worst.v)worst={v:cb[i],c:i,up:true};if(ce[i]<worst.v)worst={v:ce[i],c:i,up:false};}
  return {alpha:alpha,te:Math.sqrt(Math.max(te2,0))*100,beta:beta,cash:100-sum,dts:dtsP,adts:dtsP-U.benchDts*100,ratio:dtsP/(U.benchDts*100),bull:bull,bear:bear,name:worst,cb:cb,ce:ce};}

/* ---- Problem set-up.  Variables are buy and sell (% of NAV) for the free buckets only: held and excluded buckets are
        fixed trades and drop out, which keeps the pruned problems small. Everything except the tracking-error cap is fixed
        here, so one prepared problem can be re-solved along the frontier. ---- */
function prepare(U,p,rowsOnly){
  var n=U.n,B=U.B,w0=U.w0,wb=U.wb,i,j,k,a,lock=p.locks||{},neu=p.neutral||{},cs=cases(U,p),sofr=p.sofr||0,bu=cs.bull,be=cs.bear;
  // overrides: 1 = hold today's weight, 2 = exclude (sell all, no buying)
  var tf=new Float64Array(n),wf=new Float64Array(n),pos=new Int32Array(n),F=[];
  // bond overrides: 1 = hold the bond, 2 = sell it whole. A bucket with no free bond left is fixed.
  var fzz=p.frozen||{},hH=new Float64Array(n),exH=new Float64Array(n),ntr=new Int32Array(n);
  for(i=0;i<n;i++)U.bondsOf[i].forEach(function(x){var s=fzz[x]|0;if(s===1)hH[i]+=U.bonds[x].w0;else if(s===2)exH[i]+=U.bonds[x].w0;else ntr[i]++;});
  for(i=0;i<n;i++){var lk=lock[i]|0;pos[i]=-1;tf[i]=lk===2?-w0[i]:-exH[i];if(!lk&&ntr[i]>0){pos[i]=F.length;F.push(i);}wf[i]=w0[i]+tf[i];}   // an excluded bond's sale is a fixed trade even in a free bucket
  var nf=F.length,N=2*nf,c0=100,tfix=0;for(i=0;i<n;i++){c0-=wf[i];tfix+=Math.abs(tf[i]);}
  var ct=p.basis==='ct',Db=U.benchDts,rows=[],rep=[];
  // frozen bonds (no trade): their bucket cannot go below what they hold, and cannot move at all if every bond is frozen
  var wmin=new Float64Array(n),wmax=new Float64Array(n);for(i=0;i<n;i++){wmax[i]=100;wmin[i]=Math.min(hH[i],w0[i]);}
  // a sparse limit on active weights: lo <= sum coef*(w - index) <= hi.  If an override makes it unreachable it is widened just enough.
  function addRow(idx,coef,lo,hi,meta){var act=0,mn=0,mx=0,fi=[],fc=[],q;
    for(q=0;q<idx.length;q++){var i1=idx[q],c1=coef[q],fx=pos[i1]<0,x0=c1*((fx?wf[i1]:wmin[i1])-wb[i1]),x1=c1*((fx?wf[i1]:wmax[i1])-wb[i1]);
      act+=c1*(wf[i1]-wb[i1]);mn+=Math.min(x0,x1);mx+=Math.max(x0,x1);if(!fx){fi.push(pos[i1]);fc.push(c1);}}
    var l=lo,u=hi,forced=false;if(mn>u+1e-9){u=mn;forced=true;}if(mx<l-1e-9){l=mx;forced=true;}
    var rw={idx:idx,coef:coef,fi:fi,fc:fc,l:l-act,u:u-act,abs:false,lo:l,hi:u,forced:forced,grp:true,mult:1,yk:-1},kk;for(kk in meta)rw[kk]=meta[kk];
    rw.id='g'+rep.length;rep.push(rw);if(fi.length)rows.push(rw);}
  // concentration limits: active market value %, or active CTDTS as % of index DTS
  function addGroup(key,cnt,lim,kind,skey,names){for(var g=0;g<cnt;g++){var idx=[],coef=[];
    for(var q=0;q<n;q++)if(B[q][key]===g){idx.push(q);coef.push(ct?B[q].dts/Db:1);}
    if(idx.length)addRow(idx,coef,-lim,lim,{kind:kind,key:skey,name:names(g),lim:lim});}}
  addGroup('c',CTRY.length,p.country,'Country','country',function(x){return CTRY[x][0];});
  addGroup('reg',REG.length,p.region,'Region','region',function(x){return REG[x];});
  addGroup('q',QUAL.length,p.quality,'Quality','quality',function(x){return QUAL[x];});
  addGroup('sec',SEC.length,p.sector,'Sector','sector',function(x){return SEC[x];});
  // single-name scenario limits: alpha lost (bp) if one country alone lands in its bull or its bear case
  for(var cI=0;cI<CTRY.length;cI++){var ix=[],cu=[],cd=[];
    for(i=0;i<n;i++)if(B[i].c===cI){ix.push(i);cu.push((bu[i]-B[i].mu)/100);cd.push((be[i]-B[i].mu)/100);}
    addRow(ix,cu,-p.name/100,1e9,{kind:'Name',key:'name',name:CTRY[cI][0],up:true,c:cI,mult:100,lim:p.name});
    addRow(ix,cd,-p.name/100,1e9,{kind:'Name',key:'name',name:CTRY[cI][0],up:false,c:cI,mult:100,lim:p.name});}
  // macro factor limits: alpha (bp) for a +1 std move in each factor, between a minimum and a maximum
  if(p.macMin&&p.macMax)for(var mf=0;mf<MACN.length;mf++){var mi=[],mc=[];for(i=0;i<n;i++){mi.push(i);mc.push(U.mr[i][mf]/100);}
    addRow(mi,mc,p.macMin[mf]/100,p.macMax[mf]/100,{kind:'Macro',key:'macro',name:MACN[mf],f:mf,mult:100,lim:Math.abs(p.macMin[mf])});}
  if(rowsOnly)return {rep:rep};
  // portfolio rows over all free buckets; the fixed trades are already in the levels
  var all=[],ones=[],gco=[],uco=[],dco=[],b0=0,bull0=0,bear0=0;
  for(j=0;j<nf;j++){i=F[j];all.push(j);ones.push(1);gco.push(U.g[i]*100);uco.push((bu[i]-sofr)/100);dco.push((be[i]-sofr)/100);}
  for(i=0;i<n;i++){b0+=U.g[i]*wf[i];bull0+=(bu[i]-sofr)*(wf[i]-wb[i])/100;bear0+=(be[i]-sofr)*(wf[i]-wb[i])/100;}
  if(nf){
    rows.push({fi:all,fc:ones,l:c0-p.cashMax,u:c0-p.cashMin,abs:false,kind:'Cash',id:'Cash'});
    rows.push({fi:all,fc:gco,l:(p.betaMin-b0)*100,u:(p.betaMax-b0)*100,abs:false,kind:'Beta',id:'Beta'});
    rows.push({fi:all,fc:ones,l:-1e9,u:2*p.turnover-tfix,abs:true,kind:'Turnover',id:'Turnover'});
    rows.push({fi:all,fc:uco,l:p.bull/100-bull0,u:1e9,abs:false,kind:'Bull',id:'Bull'});   // alpha if every bucket lands in its bull case
    rows.push({fi:all,fc:dco,l:p.bear/100-bear0,u:1e9,abs:false,kind:'Bear',id:'Bear'});}  // alpha if every bucket lands in its bear case
  // country-neutral rows, switched on when the minimum trade size turns a small net country trade into a pure switch:
  // the net market value traded in that country is then held at zero
  for(var cN in neu){var nx=[],no=[],fixc=0;for(i=0;i<n;i++)if(B[i].c===+cN){if(pos[i]<0)fixc+=tf[i];else{nx.push(pos[i]);no.push(1);}}
    if(nx.length)rows.push({fi:nx,fc:no,l:-fixc,u:-fixc,abs:false,kind:'Neutral',c:+cN,id:'N'+cN});}
  var mg=rows.length;
  for(k=0;k<mg;k++){var rw=rows[k],nn=0,ni=0;rw.yk=k;for(a=0;a<rw.fc.length;a++){nn+=rw.fc[a]*rw.fc[a];ni=Math.max(ni,Math.abs(rw.fc[a]));}
    nn=Math.pow(Math.sqrt(nn*2),0.25)*Math.pow(ni,0.75)||1;rw.sc=1/nn;rw.cf=rw.fc.map(function(v){return v/nn;});rw.ls=rw.l/nn;rw.us=rw.u/nn;}
  // tracking-error block: z = kap * L'(buy - sell) over the free buckets; ball centre -kap*L'd, radius kap*cap
  var L=U.L,kap=4,f0=new Float64Array(n),LF=new Float64Array(n*nf);
  for(a=0;a<n;a++){var s=0;for(j=a;j<n;j++)s+=L[j*n+a]*(wf[j]-wb[j]);f0[a]=s*kap;for(j=0;j<nf;j++)if(F[j]>=a)LF[a*nf+j]=L[F[j]*n+a];}
  // objective (minimise q'x), scaled to unit size.  Cash earns SOFR, so each bucket is worth its return over SOFR.
  var q=new Float64Array(N),qs=1e-9,lb=new Float64Array(N),ub=new Float64Array(N);
  for(j=0;j<nf;j++){i=F[j];var tc=p.cost/100*B[i].tc,ex=B[i].mu-sofr;q[j]=-ex+tc;q[nf+j]=ex+tc;qs=Math.max(qs,Math.abs(q[j]),Math.abs(q[nf+j]));ub[j]=wmax[i]-wf[i];ub[nf+j]=Math.max(0,wf[i]-wmin[i]);}
  for(j=0;j<N;j++)q[j]/=qs;
  // M = I + Ag'Ag + kap^2 [[Q,-Q],[-Q,Q]] on the free buckets
  var M=new Float64Array(N*N);
  for(j=0;j<N;j++)M[j*N+j]=1;
  for(k=0;k<mg;k++){var r2=rows[k],fx2=r2.fi,cf=r2.cf,sg=r2.abs?1:-1,a2,b2;
    for(a2=0;a2<fx2.length;a2++)for(b2=0;b2<fx2.length;b2++){var v=cf[a2]*cf[b2],x=fx2[a2],y=fx2[b2];
      M[x*N+y]+=v;M[(nf+x)*N+nf+y]+=v;M[x*N+nf+y]+=sg*v;M[(nf+x)*N+y]+=sg*v;}}
  var k2=kap*kap;
  for(a=0;a<nf;a++)for(j=0;j<nf;j++){var qv=k2*U.Q[F[a]*n+F[j]];M[a*N+j]+=qv;M[(nf+a)*N+nf+j]+=qv;M[a*N+nf+j]-=qv;M[(nf+a)*N+j]-=qv;}
  var pb={n:n,nf:nf,F:F,pos:pos,tf:tf,N:N,rows:rows,mg:mg,rep:rep,lb:lb,ub:ub,q:q,qs:qs,M:M,LF:LF,kap:kap,f0:f0,sigma:1e-6,rho:0.3,K:new Float64Array(N*N),KL:null,ct:ct,ctx:{sofr:sofr,bull:bu,bear:be}};
  factor(pb);return pb;}
/* Carry a solution of one prepared problem over to another with a different set of free buckets, as a warm start. */
function remap(po,so,pn){var N=pn.N,nf=pn.nf,m=N+pn.mg+pn.n,x=new Float64Array(N),z=new Float64Array(m),y=new Float64Array(m),j,k,No=po.N,nfo=po.nf,old={};
  for(j=0;j<nf;j++){var jo=po.pos[pn.F[j]];if(jo<0)continue;x[j]=so.x[jo];x[nf+j]=so.x[nfo+jo];z[j]=so.z[jo];z[nf+j]=so.z[nfo+jo];y[j]=so.y[jo];y[nf+j]=so.y[nfo+jo];}
  for(k=0;k<po.mg;k++)old[po.rows[k].id]=k;
  for(k=0;k<pn.mg;k++){var ko=old[pn.rows[k].id];if(ko==null)continue;var f=pn.rows[k].sc/po.rows[ko].sc;z[N+k]=so.z[No+ko]*f;y[N+k]=so.y[No+ko]/f;}
  for(k=0;k<pn.n;k++){z[N+pn.mg+k]=so.z[No+po.mg+k];y[N+pn.mg+k]=so.y[No+po.mg+k];}
  return {x:x,z:z,y:y};}
function factor(pb){var N=pb.N,K=pb.K,M=pb.M,a;for(a=0;a<N*N;a++)K[a]=pb.rho*M[a];for(a=0;a<N;a++)K[a*N+a]+=pb.sigma;pb.KL=chol(K,N);}

/* ---- ADMM (OSQP-style) with a ball projection for the tracking-error constraint ---- */
function admm(pb,teBp,warm,opt){
  opt=opt||{};
  var n=pb.n,nf=pb.nf,N=pb.N,mg=pb.mg,m=N+mg+n,rows=pb.rows,LF=pb.LF,kap=pb.kap,f0=pb.f0,q=pb.q,lb=pb.lb,ub=pb.ub,sigma=pb.sigma;
  var cap=teBp/100*kap,eps=opt.eps||2e-4,maxIt=opt.maxIt||4000,alpha=1.6,i,it,pr=1,dr=1,conv=false,infeas=false,hits=0,stopAt=0;
  var x=new Float64Array(N),z=new Float64Array(m),y=new Float64Array(m),xt=new Float64Array(N),zt=new Float64Array(m),rhs=new Float64Array(N),Aty=new Float64Array(N),vz=new Float64Array(m),yp=new Float64Array(m),dy=new Float64Array(m);
  if(warm&&warm.x.length===N&&warm.z.length===m){x.set(warm.x);z.set(warm.z);y.set(warm.y);}
  function Ax(xv,out){var a,kk,j;for(a=0;a<N;a++)out[a]=xv[a];
    for(kk=0;kk<mg;kk++){var rr=rows[kk],s1=0,id=rr.fi,c1=rr.cf;if(rr.abs)for(a=0;a<id.length;a++)s1+=c1[a]*(xv[id[a]]+xv[nf+id[a]]);else for(a=0;a<id.length;a++)s1+=c1[a]*(xv[id[a]]-xv[nf+id[a]]);out[N+kk]=s1;}
    for(a=0;a<n;a++){var s3=0,o=a*nf;for(j=0;j<nf;j++)s3+=LF[o+j]*(xv[j]-xv[nf+j]);out[N+mg+a]=kap*s3;}}
  function At(v,out){var a,kk,j;for(a=0;a<N;a++)out[a]=v[a];
    for(kk=0;kk<mg;kk++){var rr=rows[kk],id=rr.fi,c1=rr.cf,vv=v[N+kk];if(vv===0)continue;
      if(rr.abs)for(a=0;a<id.length;a++){out[id[a]]+=c1[a]*vv;out[nf+id[a]]+=c1[a]*vv;}else for(a=0;a<id.length;a++){out[id[a]]+=c1[a]*vv;out[nf+id[a]]-=c1[a]*vv;}}
    for(j=0;j<nf;j++){var s3=0;for(a=0;a<n;a++)s3+=LF[a*nf+j]*v[N+mg+a];s3*=kap;out[j]+=s3;out[nf+j]-=s3;}}
  function proj(v){var a;for(a=0;a<N;a++)v[a]=v[a]<lb[a]?lb[a]:(v[a]>ub[a]?ub[a]:v[a]);
    for(a=0;a<mg;a++){var rr=rows[a],t=v[N+a];v[N+a]=t<rr.ls?rr.ls:(t>rr.us?rr.us:t);}
    var nr=0;for(a=0;a<n;a++){var u=v[N+mg+a]+f0[a];nr+=u*u;}nr=Math.sqrt(nr);
    if(nr>cap){var f=cap/nr;for(a=0;a<n;a++)v[N+mg+a]=(v[N+mg+a]+f0[a])*f-f0[a];}}
  if(N===0){var nr0=0;for(i=0;i<n;i++)nr0+=f0[i]*f0[i];return {x:x,z:z,y:y,it:0,pr:0,dr:0,conv:Math.sqrt(nr0)<=cap*1.006+1e-9,infeas:false};}
  for(it=1;it<=maxIt;it++){
    var rho=pb.rho;
    for(i=0;i<m;i++)vz[i]=rho*z[i]-y[i];
    At(vz,Aty);for(i=0;i<N;i++)rhs[i]=sigma*x[i]-q[i]+Aty[i];
    cholSolve(pb.KL,N,rhs,xt);Ax(xt,zt);
    for(i=0;i<N;i++)x[i]=alpha*xt[i]+(1-alpha)*x[i];
    for(i=0;i<m;i++){var zh=alpha*zt[i]+(1-alpha)*z[i];vz[i]=zh;z[i]=zh+y[i]/rho;}
    proj(z);
    for(i=0;i<m;i++)y[i]+=rho*(vz[i]-z[i]);
    if(it%25===0){Ax(x,zt);pr=0;for(i=0;i<m;i++)pr=Math.max(pr,Math.abs(zt[i]-z[i]));
      At(y,Aty);dr=0;for(i=0;i<N;i++)dr=Math.max(dr,Math.abs(q[i]+Aty[i]));
      if(pr<eps&&dr<eps*5){conv=true;break;}
      if(stopAt){if(it>=stopAt)break;}
      else{var nd=0,sup=0,nb=0,a2;for(i=0;i<m;i++){dy[i]=y[i]-yp[i];yp[i]=y[i];nd=Math.max(nd,Math.abs(dy[i]));}
        if(it>=100&&nd>1e-9){                      // infeasibility certificate: A'dy = 0 with negative support over the constraint set
          for(i=0;i<N;i++)sup+=dy[i]>0?ub[i]*dy[i]:lb[i]*dy[i];
          for(i=0;i<mg;i++){a2=dy[N+i];sup+=a2>0?rows[i].us*a2:rows[i].ls*a2;}
          for(i=0;i<n;i++){a2=dy[N+mg+i];sup-=f0[i]*a2;nb+=a2*a2;}sup+=cap*Math.sqrt(nb);
          if(sup<-1e-6*nd){At(dy,Aty);var na=0;for(i=0;i<N;i++)na=Math.max(na,Math.abs(Aty[i]));hits=na<1e-3*nd?hits+1:0;}else hits=0;
          if(hits>=3){infeas=true;stopAt=Math.max(it+200,600);}}}
      if(it===100||it===200||it===400||it===800||it===1600||it===3200){var ratio=Math.sqrt(pr/(dr+1e-12));if(ratio>3||ratio<1/3){ratio=Math.min(5,Math.max(0.2,ratio));pb.rho*=ratio;factor(pb);}}}
  }
  return {x:x,z:z,y:y,it:Math.min(it,maxIt),pr:pr,dr:dr,conv:conv,infeas:infeas};}

/* ---- Turn a solution into weights, trades, a limit report and the price of each limit ---- */
function finish(U,p,pb,sol,teBp,light){
  var n=U.n,nf=pb.nf,N=pb.N,B=U.B,w0=U.w0,wb=U.wb,x=sol.x,i,j,k;
  var w=new Float64Array(n),tr=new Float64Array(n),gr=new Float64Array(n);
  for(i=0;i<n;i++){var t=pb.tf[i];j=pb.pos[i];
    var fx=0;if(j>=0){fx=t;var wfi=w0[i]+fx,bb=Math.min(Math.max(x[j],0),pb.ub[j]),ss=Math.min(Math.max(x[nf+j],0),pb.ub[nf+j]);t=bb-ss;if(Math.abs(t)<0.004)t=0;if(wfi+t<0.004&&pb.ub[nf+j]>=wfi-1e-9)t=-wfi;gr[i]=Math.abs(fx)+Math.abs(t);t+=fx;}else gr[i]=Math.abs(t);
    tr[i]=t;w[i]=w0[i]+t;}
  var mt=metrics(U,w,pb.ctx),turn=0,cost=0;for(i=0;i<n;i++){turn+=gr[i];cost+=gr[i]/100*p.cost*B[i].tc;}
  mt.turnover=turn/2;mt.cost=cost;mt.net=mt.alpha-cost;mt.ir=mt.te>0.5?mt.net/mt.te:0;       // cost and net alpha in bp
  if(light)return {te:teBp,net:mt.net,ach:mt.te,ok:!sol.infeas&&(sol.conv||sol.pr<1e-2)};
  var rep=[],big=false,mg=pb.mg,y=sol.y,qs=pb.qs,price={};
  function chk(key,kind,name,val,lo,hi,unit,tol){var st='ok',ex=Math.max(val-hi,lo-val);
    if(ex>tol){st='breach';if(ex>8*tol)big=true;}else if(hi-val<=tol)st='max';else if(val-lo<=tol)st='min';
    var e={key:key,kind:kind,name:name,val:val,lo:lo,hi:hi,st:st,unit:unit};rep.push(e);return e;}
  chk('te','Tracking error','Tracking error',mt.te,0,teBp,'bp',Math.max(0.6,teBp*0.006));
  var eb=chk('beta','Beta','Beta',mt.beta,p.betaMin,p.betaMax,'',0.004);eb.key=eb.st==='min'?'betaMin':'betaMax';
  var ec=chk('cash','Cash','Cash',mt.cash,p.cashMin,p.cashMax,'%',0.03);ec.key=ec.st==='max'?'cashMax':'cashMin';
  chk('turnover','Turnover','Turnover',mt.turnover,0,p.turnover,'%',0.05);
  chk('bull','Bull','Bull-case alpha',mt.bull,p.bull,1e9,'bp',0.6);
  chk('bear','Bear','Bear-case alpha',mt.bear,p.bear,1e9,'bp',0.6);
  // prices: gain in alpha (as % of NAV) per unit of each limit, from the duals
  var ny=0;for(i=0;i<n;i++)ny+=y[N+mg+i]*y[N+mg+i];
  price.te=Math.sqrt(ny)*pb.kap*qs/1e4;                         // per bp of tracking error
  pb.rep.forEach(function(rw){var act=0,q,v=rw.yk>=0?Math.abs(y[N+rw.yk])*rw.sc*qs/100:0,bpRow=rw.mult===100,e2;
    for(q=0;q<rw.idx.length;q++)act+=rw.coef[q]*(w[rw.idx[q]]-wb[rw.idx[q]]);
    if(rw.forced){e2={key:rw.key,kind:rw.kind,name:rw.name,val:act*rw.mult,lo:-rw.lim,hi:bpRow?1e9:rw.lim,st:'forced',unit:bpRow?'bp':'%'};rep.push(e2);}
    else{e2=chk(rw.key,rw.kind,rw.name,act*rw.mult,rw.lo*rw.mult,rw.hi>1e8?1e9:rw.hi*rw.mult,bpRow?'bp':'%',bpRow?0.3:0.03);e2.price=bpRow?v/100:v;price[rw.key]=(price[rw.key]||0)+e2.price;}
    if(bpRow){e2.up=rw.up;e2.c=rw.c;}if(rw.kind==='Macro'){e2.f=rw.f;if(rw.forced){e2.lo=rw.lo*100;e2.hi=rw.hi*100;}}});
  for(k=0;k<mg;k++){var rw=pb.rows[k],yv=y[N+k],v=Math.abs(yv)*rw.sc*qs/100;
    if(rw.kind==='Cash')price[yv>0?'cashMin':'cashMax']=v;        // per 1% of cash
    else if(rw.kind==='Beta')price[yv>0?'betaMax':'betaMin']=v;   // per 0.01 of beta
    else if(rw.kind==='Turnover')price.turnover=2*v;              // per 1% one-way turnover
    else if(rw.kind==='Bull')price.bull=v/100;                    // per bp of the bull-case floor
    else if(rw.kind==='Bear')price.bear=v/100;}                   // per bp of the bear-case floor
  return {w:w,trade:tr,m:mt,rep:rep,price:price,iters:sol.it,pr:sol.pr,dr:sol.dr,feasible:!sol.infeas&&(sol.conv||sol.pr<5e-3)&&!big};}

/* Solve, then enforce the minimum trade size by pruning. Round 0 solves the relaxed problem. Then, round by round, the trades
   that are too small at bond or country level are found and the smallest offenders are held (a small net country trade with
   sizeable legs is turned into a pure switch instead), and the problem is solved again. After the first rounds only buckets
   that are still being traded stay tradable, so the set can only shrink and the loop ends. A pruned trade that turns out to
   be needed to meet a limit is released again and kept. With opt.init the loop starts from a given set of held buckets. */
function solvePruned(U,p,warm,opt){
  opt=opt||{};
  var rule={minCT:p.minCT||0,minUSD:p.minUSD||0,nav:p.nav||5000,frozen:p.frozen||null},on=rule.minCT>0||rule.minUSD>0,MAXR=opt.maxr||12,EXPLORE=opt.explore==null?1:opt.explore,FRAC=opt.frac||0.6;
  var user=p.locks||{},lockP={},neutral={},exempt={},exC={},pb,sol=null,r,pp,base=null,first=null,prev=null,batch=null,iter,left=0,k,its=0,log=[],freeze=opt.init?0:EXPLORE,big=0,retries=0;
  function build(){var L={},q={},x;for(x in user)L[x]=user[x];for(x in lockP)if(!L[x])L[x]=1;for(x in p)q[x]=p[x];q.locks=L;q.neutral=neutral;return q;}
  function copy(o){var a={},x;for(x in o)a[x]=o[x];return a;}
  function ok(){return r.feasible||(!sol.infeas&&sol.pr<1e-2);}
  function apply(list){list.forEach(function(v){
    if(v.i!=null)lockP[v.i]=1;
    else if(v.sw&&!neutral[v.c])neutral[v.c]=1;
    else{delete neutral[v.c];for(var b=0;b<U.n;b++)if(U.B[b].c===v.c&&!exempt[b]&&!user[b])lockP[b]=1;}});}
  // a trade that brings a breached country or single-name limit back in line may be of any size
  function cure(rows){rows.forEach(function(rw){if(rw.kind!=='Country'&&rw.kind!=='Name')return;var a0=0,q;
    for(q=0;q<rw.idx.length;q++)a0+=rw.coef[q]*(U.w0[rw.idx[q]]-U.wb[rw.idx[q]]);
    if(a0>rw.hi+1e-6||a0<rw.lo-1e-6)rw.idx.forEach(function(i){exempt[i]=1;});});}
  function loop(start){
    for(iter=start;iter<=MAXR;iter++){
      var pbo=pb,solo=sol;pp=build();pb=prepare(U,pp);
      if(!base){base=pb.rep.map(function(rw){return !!rw.forced;});cure(pb.rep);}
      else{var rel=false;pb.rep.forEach(function(rw,ix){if(rw.forced&&!base[ix])rw.idx.forEach(function(i){if(lockP[i]){delete lockP[i];exempt[i]=1;rel=true;}});});
        if(rel){pp=build();pb=prepare(U,pp);}}
      var w0=!pbo?warm:(pb.nf>40&&solo?remap(pbo,solo,pb):null);                  // large problems start from the previous round's answer
      sol=admm(pb,p.te,w0,{maxIt:!pbo&&!opt.init?6000:2500});its+=sol.it;if(!first)first=sol;if(pb.nf>60)big++;
      r=finish(U,pp,pb,sol,p.te,false);
      if(opt.debug)log.push('r'+iter+' nf'+pb.nf+' it'+sol.it+(ok()?'':' INF')+' net'+r.m.net.toFixed(1));
      if(!on)return;
      if(!ok()){
        if(!prev)return;                                             // the limits themselves cannot be met
        lockP=copy(prev.lockP);neutral=copy(prev.neutral);           // undo the last batch and retry with half of it; a single trade that cannot go is kept
        if(++retries>3){pb=prev.pb;sol=prev.sol;r=prev.r;pp=prev.pp;left=batch.length;return;}
        if(batch.length>1){batch=batch.slice(0,Math.ceil(batch.length/2));apply(batch);continue;}
        if(batch[0].i!=null)exempt[batch[0].i]=1;else exC[batch[0].c]=1;
        pb=prev.pb;sol=prev.sol;r=prev.r;pp=prev.pp;}
      else if(iter===freeze)for(k=0;k<U.n;k++)if(r.trade[k]===0&&!user[k]&&!exempt[k])lockP[k]=1;   // from here on the candidate set only shrinks
      var mp=mapBonds(U,r.w,rule),ck=checkMin(U,mp.bw,mp.bad,rule);
      var vio=ck.b.filter(function(v){return !exempt[v.i]&&!user[v.i];}).map(function(v){return {i:v.i,score:v.score};});
      ck.c.forEach(function(v){if(exC[v.c])return;var free=false;for(k=0;k<U.n;k++)if(U.B[k].c===v.c&&!exempt[k]&&!user[k]&&!lockP[k])free=true;if(free)vio.push({c:v.c,score:v.score,sw:v.sw});});
      left=vio.length;if(!left||iter===MAXR)return;
      prev={pb:pb,sol:sol,r:r,pp:pp,lockP:copy(lockP),neutral:copy(neutral)};
      vio.sort(function(a,b){return a.score-b.score;});
      batch=vio.slice(0,iter>=MAXR-3?vio.length:Math.max(1,Math.ceil(vio.length*(pb.nf>60?0.6:FRAC))));apply(batch);
    }}
  if(opt.init){lockP=copy(opt.init.lockP);neutral=copy(opt.init.neutral);var b0=prepare(U,p,true).rep;base=b0.map(function(rw){return !!rw.forced;});cure(b0);for(k in exempt)delete lockP[k];}
  loop(0);
  if(on&&!sol.conv&&!sol.infeas&&pb.nf){sol=admm(pb,p.te,sol,{maxIt:6000});its+=sol.it;r=finish(U,pp,pb,sol,p.te,false);}   // polish an unfinished last round
  var mp2=on&&r.feasible?mapBonds(U,r.w,rule):null,ck2=mp2?checkMin(U,mp2.bw,mp2.bad,rule):{b:[],c:[]};
  r.min={on:on,neutral:Object.keys(neutral).map(Number),small:ck2.b.length+ck2.c.length,rounds:iter+1,its:its,big:big};
  if(opt.debug)r.min.log=log;
  return {r:r,pb:pb,sol:sol,p:pp,first:first,lockP:lockP,neutral:neutral};}
/* The full recipe with a minimum trade size. Candidates are found with 40% more turnover than allowed, because pruning
   frees budget that only names already in play can use; the answer is then pruned at the true turnover within that set.
   If that fails, the plain pruned solve is used. Without a minimum trade size this is one convex solve. */
function solveMin(U,p,warm){
  if(!((p.minCT||0)>0||(p.minUSD||0)>0))return solvePruned(U,p,warm);
  var p1={},x;for(x in p)p1[x]=p[x];p1.turnover=p.turnover*1.4;
  var o1=solvePruned(U,p1,warm),o=o1.r.feasible?solvePruned(U,p,null,{init:{lockP:o1.lockP,neutral:o1.neutral}}):null;
  if(!o||!o.r.feasible||o.r.min.small>0){var a=solvePruned(U,p,warm);
    if(!o||!o.r.feasible||(a.r.feasible&&(a.r.min.small<o.r.min.small||(a.r.min.small===o.r.min.small&&a.r.m.net>o.r.m.net))))o=a;}
  o.first=o1.first;return o;}
/* Sell small positions: a country whose holding would end below the threshold (market value % or CTDTS) is sold whole and the
   problem solved again, a few rounds at most. Countries with a held bucket or bond are left alone. */
function sellSmall(U,p,run){var o=run(p),sm=p.small,sold=[];
  if(sm&&sm.on&&sm.val>0){var locks={},x,round,fz=p.frozen||{};for(x in (p.locks||{}))locks[x]=p.locks[x];
    for(round=0;round<4;round++){var hold=new Float64Array(CTRY.length),ok=[],add=[],i,c;
      for(c=0;c<CTRY.length;c++)ok.push(true);
      for(i=0;i<U.n;i++){c=U.B[i].c;hold[c]+=sm.unit==='ct'?o.r.w[i]*U.B[i].dts:o.r.w[i];if(locks[i]===1)ok[c]=false;U.bondsOf[i].forEach(function(k){if(fz[k]===1)ok[c]=false;});}
      for(c=0;c<CTRY.length;c++)if(ok[c]&&hold[c]>1e-6&&hold[c]<sm.val-1e-9)add.push(c);
      if(!add.length)break;
      add.forEach(function(cc){sold.push(cc);for(var q=0;q<U.n;q++)if(U.B[q].c===cc)locks[q]=2;});
      var p2={};for(x in p)p2[x]=p[x];p2.locks=locks;p=p2;locks=Object.assign({},locks);o=run(p);}}
  o.r.sold=sold;return {o:o,p:p};}
function solve(U,p){var t0=Date.now(),o=sellSmall(U,p,function(q){return solveMin(U,q,null);}).o;o.r.ms=Date.now()-t0;return o.r;}

/* ---- Session: one answer per request, then the gain from loosening each binding limit and the efficient frontier, in small
        steps so that a new request can cut in. ---- */
var GRID=[20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,180,200,220,240,260,280,300];
function makeSession(U,post){var gen=0,last=null,lastP=null,inc=null;
  var NUM=['casePct','te','turnover','betaMin','betaMax','country','region','quality','sector','cashMin','cashMax','bull','bear','name','cost','sofr','caseK','minCT','minUSD','nav'];
  function tolOf(t){return Math.max(0.6,t*0.006);}
  function near(p){if(!lastP||lastP.basis!==p.basis||lastP.caseMode!==p.caseMode||lastP.caseShock!==p.caseShock||lastP.caseSrc!==p.caseSrc||JSON.stringify(lastP.small||0)!==JSON.stringify(p.small||0)||JSON.stringify(lastP.locks||{})!==JSON.stringify(p.locks||{})||JSON.stringify(lastP.frozen||{})!==JSON.stringify(p.frozen||{})||JSON.stringify([lastP.macMin,lastP.macMax])!==JSON.stringify([p.macMin,p.macMax]))return false;
    var ch=0;NUM.forEach(function(k){if(lastP[k]!==p[k])ch++;});return ch<=2;}
  function minOn(p){return (p.minCT||0)>0||(p.minUSD||0)>0;}
  /* Best answer found: a fresh solve, and - with a minimum trade size - also a solve that starts from the incumbent's set of
     tradable buckets. Keeping the better one makes a small change of a limit give a steady, never worse, answer. */
  function best(p,warm,start){var o=solveMin(U,p,warm);
    if(start&&minOn(p)){var b=solvePruned(U,p,null,{init:start});
      if(b.r.feasible&&(!o.r.feasible||(b.r.min.small<=o.r.min.small&&b.r.m.net>o.r.m.net+0.05))){b.first=o.first;o=b;}}
    return o;}
  function request(id,p,needFr){gen=id;var t0=Date.now(),nr=near(p),first=true,ss=sellSmall(U,p,function(q){var w=first&&nr;first=false;return best(q,w?last:null,w?inc:null);}),o=ss.o,sold=o.r.sold.length>0;
    last=!sold&&o.first&&o.first.conv?o.first:null;lastP=p;inc=!sold&&o.r.feasible?{lockP:o.lockP,neutral:o.neutral}:null;o.r.ms=Date.now()-t0;
    post({id:id,r:o.r});extras(id,ss.p,o,needFr);}
  /* After the answer: the gain from loosening each binding limit by one step (a full re-solve each), then the frontier. */
  function extras(id,p,o,needFr){var r0=o.r;
    if(!r0.feasible){post({id:id,gains:{},gDone:true});if(needFr)post({id:id,fr:[],frDone:true});return;}
    var bind={},gains={},st=p.steps||{},here={lockP:o.lockP,neutral:o.neutral};r0.rep.forEach(function(x){if(x.st==='max'||x.st==='min')bind[x.key]=1;});
    var keys=Object.keys(st).filter(function(k){return st[k]&&(bind[k]||(r0.price[k]||0)>1e-6);});
    function next(){if(gen!==id)return;
      if(keys.length){var k=keys.shift(),p2={},x;for(x in p)p2[x]=p[x];p2[k]=p[k]+st[k];
        var f=best(p2,o.first,here).r;gains[k]=f.feasible?Math.max(0,f.m.net-r0.m.net):null;
        post({id:id,gains:gains,gDone:!keys.length});setTimeout(next,0);return;}
      if(needFr)sweep(id,p,o);}
    if(!keys.length)post({id:id,gains:gains,gDone:true});
    setTimeout(next,0);}
  /* Frontier: best net alpha at each tracking-error limit, every other limit unchanged. Without a minimum trade size each
     point is the exact optimum. With one, each point re-sizes and prunes the trades of the current answer's tradable set. */
  function sweep(id,p,o){var r0=o.r,pts=[{te:p.te,net:r0.m.net,ach:r0.m.te,ok:true}],mo=minOn(p),here={lockP:o.lockP,neutral:o.neutral};
    var up=GRID.filter(function(t){return t>p.te;}),dn=GRID.filter(function(t){return t<p.te;}).reverse();
    var flat=r0.m.te<p.te-tolOf(p.te)?{net:r0.m.net,ach:r0.m.te}:null,dead=false,wu=o.sol,wd=o.sol,turn=0,hi=r0.m.net;
    function point(t,warm){var f;
      if(mo){var p2={},x;for(x in p)p2[x]=p[x];p2.te=t;var b=solvePruned(U,p2,null,{init:here}).r;
        if(!(b.feasible&&b.min.small<=r0.min.small))b=solveMin(U,p2,o.first).r;          // re-sizing the current trades is not enough: select names afresh
        f={te:t,net:b.m.net,ach:b.m.te,ok:b.feasible,sol:null};}
      else{var s=admm(o.pb,t,warm,{maxIt:3000});f=finish(U,o.p,o.pb,s,t,true);f.sol=s;}
      return f;}
    function step(){if(gen!==id)return;var t,isUp,pt;
      if(up.length&&(turn%2===0||!dn.length)){t=up.shift();isUp=true;}else if(dn.length){t=dn.shift();isUp=false;}else{post({id:id,fr:pts,frDone:true});return;}
      turn++;
      if(flat&&t>=flat.ach+tolOf(t))pt={te:t,net:flat.net,ach:flat.ach,ok:true};
      else if(!isUp&&dead)pt={te:t,ok:false};
      else{var f=point(t,isUp?wu:wd);
        if(isUp){wu=f.sol;if(f.ok){if(f.net<hi)f.net=hi;else hi=f.net;if(f.ach<t-tolOf(t))flat={net:f.net,ach:f.ach};}else{f={te:t,net:hi,ach:flat?flat.ach:t,ok:true};}}
        else{wd=f.sol;if(!f.ok)dead=true;}
        pt={te:f.te,net:f.net,ach:f.ach,ok:f.ok};}
      pts.push(pt);setTimeout(step,0);}
    setTimeout(step,0);}
  return {request:request};}

var DEFAULTS={te:100,betaMin:0.95,betaMax:1.10,country:3,region:6,quality:8,sector:10,cashMin:0.5,cashMax:5,turnover:20,bull:-50,bear:-50,name:50,cost:30,basis:'mv',
  sofr:3.9,nav:5000,minCT:5,minUSD:10,caseMode:'missing',caseK:2,caseShock:'std',casePct:95,caseSrc:'own',small:{on:false,val:0.25,unit:'mv'},macMin:[-100,-100,-100,-100,-100,-100,-100],macMax:[100,100,100,100,100,100,100]};
if(typeof module!=='undefined')module.exports={countries:function(){return CTRY;},universeFromData:universeFromData,exportData:exportData,macm:function(){return MACM;},shocks:shocks,invNorm:invNorm,buildUniverse:buildUniverse,cases:cases,mapBonds:mapBonds,checkMin:checkMin,solvePruned:solvePruned,solveMin:solveMin,DURB:DURB,solve:solve,prepare:prepare,admm:admm,finish:finish,metrics:metrics,makeSession:makeSession,DEFAULTS:DEFAULTS,CTRY:CTRY,REG:REG,QUAL:QUAL,SEC:SEC,GRID:GRID};
