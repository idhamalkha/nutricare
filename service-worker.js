self.addEventListener('push',function(event){
 var data={};try{data=event.data?event.data.json():{};}catch(_){data={};}
 event.waitUntil(Promise.all([
  self.registration.showNotification(data.title||'NutriCare',{body:data.body||'Ada pembaruan di NutriCare.',icon:'/assets/images/logo/legos-transparent.png',data:{url:'/index.html'}}),
  self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(clients){clients.forEach(function(client){client.postMessage({type:'nutricare:refresh'});});})
 ]));
});
self.addEventListener('notificationclick',function(event){
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(clients){
  clients.forEach(function(client){client.postMessage({type:'nutricare:refresh'});});
  var existing=clients.find(function(client){return 'focus' in client;});
  return existing?existing.focus():self.clients.openWindow('/index.html');
 }));
});
