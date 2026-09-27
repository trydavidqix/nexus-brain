import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES=['task','event','trace','telemetry','agent','runtime','tool','plugin','mcp','alert','eval','artifact','engineering-plan','identity','nexus-task','memory','memory-record','memory-event','memory-sighting','evidence','permission','browser-plan','browser-task','browser-session','browser-observation','browser-action','browser-backend','browser-host','browser-profile','browser-recipe','brain-request','brain-response','research-request','research-result','research-run','reach-request','reach-outcome','skill-registry-entry','task-skill-set','skill-event'];
const SET=new Set(TYPES);
const DIR=join(dirname(fileURLToPath(import.meta.url)),'..','schemas');
const SCHEMAS=Object.fromEntries(TYPES.map(type=>[type,JSON.parse(readFileSync(join(DIR,type,`${type}.v1.schema.json`),'utf8'))]));

function matches(value,type){
  if(type==='null') return value===null;
  if(type==='array') return Array.isArray(value);
  if(type==='object') return value!==null&&typeof value==='object'&&!Array.isArray(value);
  if(type==='integer') return Number.isInteger(value);
  if(type==='number') return Number.isFinite(value);
  return typeof value===type;
}
function check(schema,value,path,errors){
  if(!schema||typeof schema!=='object') return;
  if(Array.isArray(schema.anyOf)){
    if(!schema.anyOf.some(option=>{const local=[];check(option,value,path,local);return local.length===0;})) errors.push(`${path}: no anyOf schema matched`);
    return;
  }
  if(schema.const!==undefined&&value!==schema.const) errors.push(`${path}: const mismatch`);
  if(Array.isArray(schema.enum)&&!schema.enum.includes(value)) errors.push(`${path}: value is not in enum`);
  if(schema.type!==undefined){
    const expected=Array.isArray(schema.type)?schema.type:[schema.type];
    if(!expected.some(type=>matches(value,type))){errors.push(`${path}: expected type ${expected.join('|')}`);return;}
  }
  if(typeof value==='string'){
    if(Number.isFinite(schema.minLength)&&value.length<schema.minLength) errors.push(`${path}: shorter than minLength`);
    if(schema.pattern&&!(new RegExp(schema.pattern).test(value))) errors.push(`${path}: pattern mismatch`);
    if(schema.format==='date-time'&&!Number.isFinite(Date.parse(value))) errors.push(`${path}: invalid date-time`);
  }
  if(typeof value==='number'){
    if(Number.isFinite(schema.minimum)&&value<schema.minimum) errors.push(`${path}: below minimum`);
    if(Number.isFinite(schema.maximum)&&value>schema.maximum) errors.push(`${path}: above maximum`);
  }
  if(Array.isArray(value)){
    if(Number.isFinite(schema.minItems)&&value.length<schema.minItems) errors.push(`${path}: fewer than minItems`);
    if(schema.items) value.forEach((item,index)=>check(schema.items,item,`${path}[${index}]`,errors));
  }
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    for(const field of schema.required||[]) if(value[field]===undefined||value[field]===null||value[field]==='') errors.push(`${path}.${field}: required`);
    const properties=schema.properties||{};
    for(const [field,child] of Object.entries(properties)) if(value[field]!==undefined) check(child,value[field],`${path}.${field}`,errors);
    if(schema.additionalProperties===false) for(const field of Object.keys(value)) if(!Object.hasOwn(properties,field)) errors.push(`${path}.${field}: additional property not allowed`);
  }
}
export function contractSchema(type){return SET.has(type)?structuredClone(SCHEMAS[type]):null;}
export function validateContract(type,value){
  if(!SET.has(type)) return {valid:false,errors:[`unknown contract type: ${type}`],schema_id:null};
  if(!value||typeof value!=='object'||Array.isArray(value)) return {valid:false,errors:['$: expected object'],schema_id:SCHEMAS[type].$id};
  const errors=[];check(SCHEMAS[type],value,'$',errors);
  if(type==='memory-record') validateMemoryRecordInvariants(value,errors);
  if(type==='memory-event') validateMemoryEventInvariants(value,errors);
  if(type==='research-run'){
    const started=Date.parse(value.started_at);
    const completed=Date.parse(value.completed_at);
    if(Number.isFinite(started)&&Number.isFinite(completed)&&completed<started) errors.push('$.completed_at: must not precede started_at');
  }
  return {valid:errors.length===0,errors,schema_id:SCHEMAS[type].$id};
}

function validateMemoryScope(value,errors){
  if(value.scope==='GLOBAL'&&(value.project_id!==undefined||value.scope_id!=='global')) errors.push('$.scope: GLOBAL memory must omit project_id and use global scope_id');
  if(value.scope!=='GLOBAL'&&(typeof value.project_id!=='string'||value.project_id.length===0)) errors.push('$.project_id: non-global memory requires project_id');
  if(value.scope==='PROJECT'&&value.scope_id!==value.project_id) errors.push('$.scope_id: PROJECT scope_id must match project_id');
}

function validateMemoryRecordInvariants(value,errors){
  validateMemoryScope(value,errors);
  const from=Date.parse(value.temporal?.valid_from);
  const until=value.temporal?.valid_until===undefined?null:Date.parse(value.temporal?.valid_until);
  if(until!==null&&Number.isFinite(from)&&Number.isFinite(until)&&until<=from) errors.push('$.temporal.valid_until: must be later than valid_from');
  if(['VERIFIED','CANONICAL'].includes(value.status)&&Array.isArray(value.evidence_ids)&&value.evidence_ids.length===0) errors.push('$.evidence_ids: VERIFIED/CANONICAL records require evidence');
}

function validateMemoryEventInvariants(value,errors){
  validateMemoryScope(value,errors);
  if(['RECALLED','SELECTED','INJECTED','USED','VALIDATED','CONTRIBUTED'].includes(value.event_type)){
    if(typeof value.task_id!=='string'||value.task_id.length===0) errors.push('$.task_id: memory-use events require task_id');
    if(typeof value.agent_id!=='string'||value.agent_id.length===0) errors.push('$.agent_id: memory-use events require agent_id');
  }
}
export function assertContract(type,value){const result=validateContract(type,value);if(!result.valid) throw new Error(`${type} contract invalid (${result.schema_id}): ${result.errors.join(', ')}`);return value;}
export function normalizeLegacy(value,type){
  const copy={...(value||{})};
  if(type==='task'){
    copy.status ||= copy.external_state==='DONE'||copy.internal_state==='DONE'?'completed':copy.internal_state==='BLOCKED'?'blocked':copy.internal_state||'unavailable';
    copy.source ||= 'legacy.task.state';copy.measurement_type ||= 'unavailable';copy.timestamp ||= copy.updated_at||copy.created_at||new Date(0).toISOString();
  } else {copy.source ||= 'legacy';copy.measurement_type ||= 'unavailable';copy.timestamp ||= copy.created_at||new Date(0).toISOString();}
  return copy;
}
export function contractTypes(){return [...TYPES];}
