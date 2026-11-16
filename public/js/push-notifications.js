(function () {
 'use strict';
 var message=document.getElementById('push-msg'), button=document.getElementById('push-enable');
 if(!message||!button)return;
 var headers=(window.NutriCareApi&&window.NutriCareApi.headers)||{};
 function status(text){message.textContent=text;}
 async function init(){
  try{
   var response=await fetch('/api/push/vapid-public-key',{headers:headers});
   if(!response.ok)throw new Error('Status push tidak dapat dibaca.');
   var config=await response.json();
   if(!config.enabled){button.disabled=true;status('Notifikasi push belum dikonfigurasi di server; pembaruan berkala tetap aktif.');return;}
   if(!('serviceWorker' in navigator)||!('PushManager' in window)){button.disabled=true;status('Browser ini tidak mendukung push; pembaruan berkala tetap aktif.');return;}
   button.disabled=false;
   var registration=await navigator.serviceWorker.register('/service-worker.js');
   var existing=await registration.pushManager.getSubscription();
   if(existing){status('Notifikasi push aktif; pembaruan berkala tetap menjadi cadangan.');button.textContent='Push aktif';button.disabled=true;return;}
   button.addEventListener('click',async function(){
    var originalLabel=button.textContent;
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    button.textContent='Mengaktifkan...';
    try{
     var permission=await Notification.requestPermission();
     if(permission!=='granted')throw new Error('Izin notifikasi tidak diberikan.');
     var raw=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/'));
     var key=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)key[i]=raw.charCodeAt(i);
     var subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
     var saved=await fetch('/api/push/subscriptions',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},headers),body:JSON.stringify(subscription)});
     if(!saved.ok)throw new Error((await saved.json()).error||'Pendaftaran push gagal.');
     button.textContent='Push aktif';
     button.removeAttribute('aria-busy');
     status('Notifikasi push aktif; pembaruan berkala tetap menjadi cadangan.');
     if(window.NutriCareUI)NutriCareUI.success('Notifikasi push aktif.','Berhasil');
    }catch(error){
     button.disabled=false;
     button.textContent=originalLabel;
     button.removeAttribute('aria-busy');
     status(error.message||'Notifikasi push gagal diaktifkan.');
     if(window.NutriCareUI)NutriCareUI.error(error.message||'Notifikasi push gagal diaktifkan.','Tidak berhasil');
    }
   });
  }catch(error){button.disabled=true;status(error.message||'Push tidak tersedia; pembaruan berkala tetap aktif.');}
 }
 init();
})();
