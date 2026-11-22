/* Anti-clickjacking: refuse to render inside another site's frame. */
(function(){ if(window.top!==window.self){ try{ window.top.location.replace(window.self.location.href); }catch(e){ document.documentElement.style.visibility='hidden'; } } })();
