import { describe,it,expect,vi } from 'vitest';
import { buildApp } from '../src/app.js';

describe('web push',()=>{
 it('serves disabled status and rejects subscription without VAPID',async()=>{
  const app=buildApp();
  const status=await app.inject({method:'GET',url:'/api/push/vapid-public-key',headers:{'x-nc-role':'ahli-gizi'}});
  expect(status.statusCode).toBe(200);
  expect(status.json()).toEqual({enabled:false,publicKey:null});
  const response=await app.inject({method:'POST',url:'/api/push/subscriptions',headers:{'x-nc-role':'ahli-gizi'},payload:{endpoint:'https://push.example/s',keys:{p256dh:'x',auth:'y'}}});
  expect(response.statusCode).toBe(503);
  await app.close();
 });
});
