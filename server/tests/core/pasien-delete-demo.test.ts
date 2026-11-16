import { describe,it,expect,vi } from 'vitest';
import { deletePasien } from '../../src/modules/pasien.js';
import { pool } from '../../src/db/pool.js';

vi.mock('../../src/db/pool.js',()=>({pool:{query:vi.fn()}}));

describe('deletePasien demo actor',()=>{
 it('passes null actor for synthetic demo user to UUID audit function',async()=>{
  const q=vi.mocked(pool.query);
  q.mockResolvedValueOnce({rows:[],rowCount:1} as any)
   .mockResolvedValueOnce({rows:[],rowCount:1} as any)
   .mockResolvedValueOnce({rows:[{id:'a'}],rowCount:1} as any);
  await deletePasien('00000000-0000-4000-8000-000000000001','demo-user');
  expect(q.mock.calls[0][1]).toEqual(['00000000-0000-4000-8000-000000000001',null]);
 });

 it('menandai status pasien menjadi Pulang saat data diarsipkan',async()=>{
  const q=vi.mocked(pool.query);
  q.mockClear();
  q.mockResolvedValueOnce({rows:[],rowCount:1} as any)
   .mockResolvedValueOnce({rows:[],rowCount:1} as any)
   .mockResolvedValueOnce({rows:[{id:'a'}],rowCount:1} as any);
  await deletePasien('00000000-0000-4000-8000-000000000002','demo-user');
  expect(String(q.mock.calls[1][0])).toContain("status = 'Pulang'");
  expect(q.mock.calls[1][1]).toEqual(['00000000-0000-4000-8000-000000000002']);
 });
});
