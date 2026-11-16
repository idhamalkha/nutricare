// Test serializer: pastikan format sesuai kontrak
import { describe, it, expect } from 'vitest';
import { serializeId, serializeNumber, serializeTime, serializeDate } from '../../src/serializers/base.js';

describe('Serializers', () => {
  describe('serializeId', () => {
    it('harus return string', () => {
      expect(serializeId('abc-123')).toBe('abc-123');
      expect(serializeId(123)).toBe('123');
    });
  });
  
  describe('serializeNumber', () => {
    it('harus convert numeric string ke number', () => {
      expect(serializeNumber('123.45')).toBe(123.45);
      expect(serializeNumber(123.45)).toBe(123.45);
    });
  });
  
  describe('serializeTime', () => {
    it('harus return HH:MM dari HH:MM:SS', () => {
      expect(serializeTime('08:15:00')).toBe('08:15');
      expect(serializeTime('08:15:30.123')).toBe('08:15');
    });
  });
  
  describe('serializeDate', () => {
    it('harus return YYYY-MM-DD', () => {
      expect(serializeDate('2026-10-30')).toBe('2026-10-30');
      expect(serializeDate('2026-10-30T10:30:00Z')).toBe('2026-10-30');
      expect(serializeDate(new Date('2026-10-30'))).toBe('2026-10-30');
      // PostgreSQL DATE is parsed as local midnight by node-postgres.
      expect(serializeDate(new Date(2026, 10, 2))).toBe('2026-11-02');
    });
  });
});
