import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordTelemetry } from '../src/telemetry.mjs';
import { REGISTRY_TYPES, refreshRegistries, validateRegistryEntry } from '../src/registry.mjs';
const root=await mkdtemp(join(tmpdir(),'mcg-registry-'));
const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try{
 const staticRegistryRoot=join(repositoryRoot,'config','registries');
 for(const name of ['agents','mcps','models','plugins','runtimes','tools']){
  const rows=JSON.parse(await readFile(join(staticRegistryRoot,`${name}.json`),'utf8'));
  for(const row of rows){
   assert.ok(typeof row.source==='string'&&row.source.length>0,`${name}:${row.id} needs a source`);
   if(row.source.startsWith('external://'))continue;
   await assert.doesNotReject(stat(resolve(repositoryRoot,row.source)),`${name}:${row.id} source must exist: ${row.source}`);
  }
 }
 await recordTelemetry(root,{agent:'Codex CTO',runtime:'Codex CLI',tool:'git.status',plugin:'caveman',mcp:'Maestri Wire',model:'observed-model-1',operation:'test',total_tokens:12,input_tokens:10,output_tokens:2,measurement_type:'exact',source:'registry.test'});
 await recordTelemetry(root,{agent:'Codex CTO',runtime:'Codex CLI',tool:'git.status',plugin:'caveman',mcp:'Maestri Wire',model:'observed-model-1',operation:'test',outcome:'success',latency_ms:30,measurement_type:'unavailable',source:'registry.test'});
 await recordTelemetry(root,{agent:'Codex CTO',runtime:'Codex CLI',tool:'git.status',plugin:'caveman',mcp:'Maestri Wire',model:'observed-model-1',operation:'test',outcome:'failure',latency_ms:50,measurement_type:'unavailable',source:'registry.test'});
 const registries=await refreshRegistries(root,{include_processes:false});
 for(const type of REGISTRY_TYPES){assert.ok(registries[type].length>0,`${type} must not be empty`);for(const row of registries[type])assert.equal(validateRegistryEntry(type,row).valid,true,`${type}:${row.id}`);}
 assert.equal(registries.models.some(row=>row.name==='observed-model-1'&&row.health==='OBSERVED'),true);
 const codex=registries.agents.find(row=>row.name==='Codex CTO');assert.equal(codex.health,'OBSERVED');assert.equal(codex.measurement_type,'exact');assert.equal(codex.usage.tokens,12);assert.equal(codex.usage.calls,3);assert.equal(codex.success_rate,50);assert.equal(codex.failure_rate,50);assert.equal(codex.latency,40);
}finally{await rm(root,{recursive:true,force:true});}
console.log('registry tests: 1 passed');
