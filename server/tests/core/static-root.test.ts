import { describe,it,expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('static frontend root',()=>{
 it('resolves the project frontend from compiled dist/src location',()=>{
  const compiledDir=join(process.cwd(),'dist','src');
  const root=existsSync(join(compiledDir,'../../index.html'))?join(compiledDir,'../../'):join(compiledDir,'../../../');
  expect(existsSync(join(root,'index.html'))).toBe(true);
  expect(existsSync(join(root,'pages','ahli-gizi.html'))).toBe(true);
 });
});
