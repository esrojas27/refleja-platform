import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from './pilot-load-runner.mjs';

test('empty summaries do not invent latency measurements', () => {
  assert.deepEqual(summarize([]), {requests:0,errors:0,p50:null,p95:null,p99:null,max:null});
});

test('nearest-rank percentiles include failed request durations without mutating samples', () => {
  const samples = Array.from({length:100}, (_,i)=>({ms:100-i,ok:i!==0}));
  const original = structuredClone(samples);
  assert.deepEqual(summarize(samples), {requests:100,errors:1,p50:50,p95:95,p99:99,max:100});
  assert.deepEqual(samples,original);
});

test('small samples report their observed slow request, not an interpolated percentile', () => {
  assert.deepEqual(summarize([{ms:10.1,ok:true},{ms:1000.8,ok:false}]),
    {requests:2,errors:1,p50:10,p95:1001,p99:1001,max:1001});
});
