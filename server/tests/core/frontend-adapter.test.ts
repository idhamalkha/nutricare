import { describe,it,expect } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('frontend serving contract',()=>{
 it('serves the existing dashboard without modifying source files',async()=>{
  const app=buildApp();
  const response=await app.inject({method:'GET',url:'/pages/ahli-gizi.html'});
  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('text/html');
  expect(response.body).toContain('NutriCare');
  await app.close();
 });
 it('keeps health check public for frontend startup diagnostics',async()=>{
  const app=buildApp();
  const response=await app.inject({method:'GET',url:'/api/health'});
  expect(response.statusCode).toBe(200);
  await app.close();
 });
});
