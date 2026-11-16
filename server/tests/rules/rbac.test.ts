import { describe,it,expect } from 'vitest';
import { checkPermission, requirePermission } from '../../src/rbac.js';
import { ForbiddenError } from '../../src/http/errors.js';

describe('RBAC',()=>{
 it('allows ahli-gizi read logistics report',()=>expect(checkPermission('ahli-gizi','logistik','read')).toBe(true));
 it('denies perawat read logistics report as ForbiddenError',()=>{expect(()=>requirePermission('perawat','logistik','read')).toThrow(ForbiddenError);});
 it('allows logistics to create stock transactions',()=>expect(checkPermission('logistik','logistik','create')).toBe(true));
 it('allows nurses to manage patient intake and dietary restrictions',()=>{
  expect(checkPermission('perawat','pasien','create')).toBe(true);
  expect(checkPermission('perawat','pasien','update')).toBe(true);
  expect(checkPermission('perawat','pantangan','create')).toBe(true);
  expect(checkPermission('perawat','pantangan','update')).toBe(true);
 });
 it('lets nurses delete patient and restriction records they maintain',()=>{
  expect(checkPermission('perawat','pasien','delete')).toBe(true);
  expect(checkPermission('perawat','pantangan','delete')).toBe(true);
 });
 it('allows logistics to read dietitian recommendations',()=>{
  expect(checkPermission('logistik','rekomendasi','read')).toBe(true);
 });
 it('does not let nurses change recommendation or schedule decisions',()=>{
  expect(checkPermission('perawat','rekomendasi','create')).toBe(false);
  expect(checkPermission('perawat','jadwal','update')).toBe(false);
 });
 it('does not let waiter create or delete distribution schedules',()=>{
  expect(checkPermission('waiter','jadwal','create')).toBe(false);
  expect(checkPermission('waiter','jadwal','delete')).toBe(false);
 });
 it('lets waiter confirm deliveries without editing schedule details',()=>{
  expect(checkPermission('waiter','jadwal','action')).toBe(true);
  expect(checkPermission('waiter','jadwal','update')).toBe(false);
 });
});
