/* Golden Shield scam-help panel for the Code Black Group website.
   Talks to the Golden Shield server. A help session is opened by solving a small signed
   proof-of-work challenge in the background, so bots can't use the AI or the call-back form. */
(function(){
  var API='https://golden-shield.onrender.com/api/scam-help';
  var dlg=document.getElementById('sh'); if(!dlg) return;
  var $=function(id){ return document.getElementById(id); };
  var log=$('sh-log'), input=$('sh-in'), send=$('sh-send'), form=$('sh-form'), chips=$('sh-chips');
  var msgs=[], token=null, tokP=null, busy=false, lastFocus=null;

  var POW_SRC="self.onmessage=async function(e){var s=e.data.salt,bits=e.data.bits,enc=new TextEncoder();for(var n=0;;n++){var h=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s+':'+n)));var z=0;for(var i=0;i<h.length;i++){if(h[i]===0){z+=8;continue}z+=Math.clz32(h[i])-24;break}if(z>=bits){postMessage(n);return}}};";
  function solve(c){
    return new Promise(function(res,rej){
      try{ var w=new Worker(URL.createObjectURL(new Blob([POW_SRC],{type:'text/javascript'}))); w.onmessage=function(m){ w.terminate(); res(m.data); }; w.onerror=function(){ w.terminate(); rej(new Error('worker')); }; w.postMessage({salt:c.salt,bits:c.bits}); }
      catch(err){ rej(err); }
    }).catch(function(){
      var enc=new TextEncoder(), n=0;
      return (function step(){ return crypto.subtle.digest('SHA-256',enc.encode(c.salt+':'+n)).then(function(b){ var h=new Uint8Array(b),z=0; for(var i=0;i<h.length;i++){ if(h[i]===0){z+=8;continue} z+=Math.clz32(h[i])-24; break; } if(z>=c.bits) return n; n++; return step(); }); })();
    });
  }
  function json(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j._s=r.status; return j; }); }
  function session(){
    if(token) return Promise.resolve(token);
    if(tokP) return tokP;
    tokP=tfetch(API+'/challenge',{},12000).then(json).then(function(c){
      if(!c.salt) throw new Error('challenge');
      c.got=Date.now();
      return solve(c).then(function(n){ c.nonce=n; var wait=Math.max(0,1700-(Date.now()-c.got)); return new Promise(function(r){ setTimeout(function(){ r(c); },wait); }); });
    }).then(function(c){
      return tfetch(API+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge:{salt:c.salt,ts:c.ts,bits:c.bits,sig:c.sig,nonce:c.nonce},website:$('sh-hp').value})},12000).then(json);
    }).then(function(j){ if(!j.token) throw new Error(j.error||'session'); token=j.token; tokP=null; return token; });
    tokP.catch(function(){ tokP=null; });
    return tokP;
  }
  function add(cls,text,who){
    var d=document.createElement('div'); d.className='sh-m '+cls;
    if(who){ var w=document.createElement('span'); w.className='who'; w.textContent=who; d.appendChild(w); }
    String(text).replace(/^#+\s*/gm,'').split(/\*\*(.+?)\*\*/).forEach(function(part,i){ if(i%2){ var b=document.createElement('b'); b.textContent=part; d.appendChild(b); } else d.appendChild(document.createTextNode(part.replace(/\*/g,''))); });
    log.appendChild(d); reveal(d); return d;
  }
  var body=dlg.querySelector('.sh-body'), touch=window.matchMedia&&matchMedia('(pointer:coarse)').matches;
  /* scroll the panel (not the page) so the new message's top is in view; works the same in Safari */
  function reveal(el){ try{ var top=el.offsetTop-body.offsetTop-16, vis=body.scrollTop+body.clientHeight; if(top<body.scrollTop||el.offsetTop-body.offsetTop+el.offsetHeight>vis) body.scrollTop=Math.max(0,top); }catch(e){} }
  /* fetch with a time limit, so a slow network never leaves the visitor stuck */
  function tfetch(url,opts,ms){
    var ctl=window.AbortController?new AbortController():null, t;
    if(ctl) opts.signal=ctl.signal;
    return Promise.race([fetch(url,opts),new Promise(function(_,rej){ t=setTimeout(function(){ if(ctl) ctl.abort(); rej(new Error('timeout')); },ms); })])
      .then(function(r){ clearTimeout(t); return r; },function(e){ clearTimeout(t); throw e; });
  }
  var FALLBACK="It's not your fault, and acting quickly helps.\n1. If you gave money, card or bank details: call your bank now on the number on the back of your card.\n2. If someone has access to your device: disconnect it from the internet.\n3. Change passwords from a different, safe device.\n4. Shared ID documents? Call IDCARE on 1800 595 160.\n5. Report it at cyber.gov.au and scamwatch.gov.au.\nFor hands-on help, call Code Black Group on 1300 737 562.";
  function ask(text){
    text=String(text||'').trim(); if(!text||busy) return;
    busy=true; send.disabled=true; chips.hidden=true;
    add('u',text); msgs.push({role:'user',content:text});
    if(touch) try{ input.blur(); }catch(e){}
    var w=add('a wait','Working out your next steps','Golden Shield AI'); w.classList.add('dots');
    var done=false;
    function finish(reply,j){
      if(done) return; done=true;
      try{ if(w.parentNode) w.parentNode.removeChild(w); }catch(e){}
      var d=add('a',reply,'Golden Shield AI');
      if(j&&j.redacted) add('note',"For your safety we removed what looked like card, account or ID numbers from your message. Please don't share those here.");
      msgs.push({role:'assistant',content:reply});
      busy=false; send.disabled=false; reveal(d);
      if(!touch) try{ input.focus({preventScroll:true}); }catch(e){}
    }
    var guard=setTimeout(function(){ finish(FALLBACK); },30000); /* absolute backstop */
    session().then(function(t){
      return tfetch(API+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t,messages:msgs.slice(-10)})},25000).then(json);
    }).then(function(j){
      if(j._s===401){ token=null; }
      clearTimeout(guard); finish(j.text||FALLBACK,j);
    }).catch(function(){ clearTimeout(guard); finish(FALLBACK); });
  }
  form.addEventListener('submit',function(e){ e.preventDefault(); var v=input.value; input.value=''; ask(v); });
  input.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event('submit',{cancelable:true})); } });
  chips.addEventListener('click',function(e){ var b=e.target.closest('button'); if(b) ask(b.textContent); });

  /* urgent call-back */
  var cb=$('sh-cbf'), cbMsg=$('sh-cbmsg');
  cb.addEventListener('submit',function(e){
    e.preventDefault();
    var name=$('sh-name').value.trim(), phone=$('sh-phone').value.trim();
    if(!name||!/^[0-9+()\s.-]{8,20}$/.test(phone)){ cbMsg.className='sh-err'; cbMsg.textContent='Please add your name and a phone number we can call.'; return; }
    var btn=cb.querySelector('button'); btn.disabled=true; cbMsg.className=''; cbMsg.textContent='Sending…';
    session().then(function(t){
      return tfetch(API+'/callback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t,name:name,phone:phone,when:$('sh-when').value.trim(),what:$('sh-what').value.trim(),page:location.href})},20000).then(json);
    }).then(function(j){
      if(!j.ok) throw new Error(j.error||'failed');
      cb.innerHTML='<p class="sh-ok">Thanks. Our team has been alerted and will call you as soon as possible. If it is urgent, call 1300 737 562 now.</p>';
    }).catch(function(err){
      btn.disabled=false; cbMsg.className='sh-err';
      cbMsg.textContent=/already/.test(err.message)?'We already have your request. If it is urgent, call 1300 737 562.':'Sorry, that didn’t send. Please call 1300 737 562.';
    });
  });

  /* open and close */
  function open(){
    if(dlg.open) return; lastFocus=document.activeElement;
    if(dlg.showModal) dlg.showModal(); else dlg.setAttribute('open','');
    document.documentElement.style.overflow='hidden';
    session().catch(function(){});
    setTimeout(function(){ input.focus({preventScroll:true}); },60);
  }
  function close(){ if(dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  dlg.addEventListener('close',function(){ document.documentElement.style.overflow=''; if(location.hash==='#scam-help') history.replaceState(null,'',location.pathname+location.search); if(lastFocus&&lastFocus.focus) lastFocus.focus({preventScroll:true}); });
  dlg.addEventListener('click',function(e){ if(e.target===dlg) close(); });
  $('sh-x').addEventListener('click',close);
  [].forEach.call(document.querySelectorAll('[data-scam-help]'),function(a){ a.addEventListener('click',function(e){ e.preventDefault(); open(); }); });
  if(location.hash==='#scam-help') open();
  window.addEventListener('hashchange',function(){ if(location.hash==='#scam-help') open(); });
})();
