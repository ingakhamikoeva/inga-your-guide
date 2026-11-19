import test from 'node:test';
import assert from 'node:assert/strict';
import { FIBER_GUIDANCE, FAT_GUIDANCE } from '../nutrition/light-swap-guidance.js';
import { readFileSync } from 'node:fs';
test('shared fiber and fat guidance is used in the three relevant prompts',()=>{
  assert.match(FIBER_GUIDANCE,/отруби/); assert.match(FIBER_GUIDANCE,/псиллиум/);
  assert.match(FAT_GUIDANCE,/не предлагайте добавлять масло/);
  assert.match(FAT_GUIDANCE,/исключением необходимых жиров/);
  const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');
  assert.match(source('../nutrition/estimate.js'),/\$\{FIBER_GUIDANCE\}/);
  assert.match(source('../nutrition/day-analysis.js'),/\$\{METHOD_RULES\}/);
  assert.match(source('../nutrition/day-analysis.js'),/\$\{FAT_GUIDANCE\}/);
  assert.match(source('../ask-inga.js'),/POTATO_GUIDANCE \+ .*FIBER_GUIDANCE \+ .*FAT_GUIDANCE/);
});
