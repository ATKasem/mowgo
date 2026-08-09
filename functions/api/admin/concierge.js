import {
  canUndoConciergeSchedule,
  isConciergeTierEligible,
  isConciergeTransitionAllowed,
  isOperatorChecklistComplete,
  sortConciergeRequests,
} from '../_shared/concierge-policy.js';
import { parseConciergeCsv } from '../_shared/concierge-csv.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ORIGINS = ['https://mowgoapp.com'];
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const adminAttempts = new Map();
function cors(request) { const origin=request?.headers?.get?.('origin'); return { 'Access-Control-Allow-Origin': origin&&ALLOWED_ORIGINS.includes(origin)?origin:'https://mowgoapp.com', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-code', 'Access-Control-Max-Age': '86400' }; }
function allowed(request) { const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'unknown';const now=Date.now();const entry=adminAttempts.get(ip);if(!entry||now>=entry.reset){adminAttempts.set(ip,{count:1,reset:now+RATE_LIMIT_WINDOW});return true;}if(entry.count>=RATE_LIMIT_MAX)return false;entry.count+=1;return true; }
function timingSafeEqual(left,right) { const a=String(left||''),b=String(right||'');let diff=a.length^b.length;const length=Math.max(a.length,b.length);for(let i=0;i<length;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0; }
function cleanClientRows(rows) {
  const placeholders=/^(n\/?a|n\/?a\/?n|unknown|\?|none|-+|tbd|missing|not sure)$/i;
  const normalizePhone=value=>{let digits=String(value).replace(/\D/g,'');if(digits.length===11&&digits.startsWith('1'))digits=digits.slice(1);return digits.length===10?`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`:digits;};
  const seenNamesAndAddresses=new Set(),seenNamesAndPhones=new Set(),cleanedRows=[];let cleaned=0,duplicates=0;
  rows.forEach(sourceRow=>{const row={};let changed=false;['name','address','phone','email','rate'].forEach(field=>{const original=String(sourceRow?.[field]??'');let value=original.trim().replace(/\s+/g,' ');if(placeholders.test(value))value='';row[field]=value;if(value!==original)changed=true;});
    const phone=normalizePhone(row.phone);if(phone!==row.phone)changed=true;row.phone=phone;
    if(row.rate&&!/^\d+$/.test(row.rate)){const match=row.rate.match(/\d+(?:\.\d+)?/);const rate=match?match[0]:'';if(rate!==row.rate)changed=true;row.rate=rate;}
    if(!row.address&&row.name.includes(',')){const comma=row.name.indexOf(',');row.address=row.name.slice(comma+1).trim();row.name=row.name.slice(0,comma).trim();changed=true;}
    if(!row.phone){const match=row.name.match(/\b(?:1\d{10}|\d{10})\b/);if(match){row.phone=normalizePhone(match[0]);row.name=row.name.replace(match[0],'').trim().replace(/\s+/g,' ');changed=true;}}
    const name=row.name.toLowerCase(),nameAndAddress=`${name}|${row.address.toLowerCase()}`,nameAndPhone=row.phone?`${name}|${row.phone}`:'';
    if(changed)cleaned++;if(seenNamesAndAddresses.has(nameAndAddress)||(nameAndPhone&&seenNamesAndPhones.has(nameAndPhone))){duplicates++;return;}seenNamesAndAddresses.add(nameAndAddress);if(nameAndPhone)seenNamesAndPhones.add(nameAndPhone);cleanedRows.push(row);
  });return {rows:cleanedRows,cleaned,duplicates};
}
async function auth(context) {
  if(!context.env.CONCIERGE_ADMIN_CODE||!timingSafeEqual(context.request.headers.get('x-admin-code'),context.env.CONCIERGE_ADMIN_CODE))return null;
  const token=context.request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return null;
  const allowedIds=String(context.env.CONCIERGE_ADMIN_USER_IDS||'').split(',').map(value=>value.trim()).filter(Boolean);if(!allowedIds.length)return null;
  try{const userResult=await fetch(`${context.env.SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:`Bearer ${token}`,apikey:context.env.SUPABASE_ANON_KEY||context.env.SUPABASE_SERVICE_ROLE_KEY}});if(!userResult.ok)return null;const user=await userResult.json().catch(()=>null);return user?.id&&allowedIds.includes(user.id)?user:null;}catch{return null;}
}
function service(env) { return { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }; }
async function rpc(env,name,body){const result=await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:service(env),body:JSON.stringify(body)});const data=await result.json().catch(()=>null);if(!result.ok){const error=new Error(`RPC ${name} failed`);error.status=result.status;error.details=data;throw error;}return data;}
async function getRequest(env, id) { if(!UUID_RE.test(id||''))return null; const response=await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_requests?id=eq.${id}&select=*`,{headers:service(env)}); if(!response.ok)throw new Error('Failed to load request'); return (await response.json())[0]||null; }
function response(data,status,request){return Response.json(data,{status,headers:cors(request)});}
const RPC_STATE_PRECONDITIONS = new Set([
  'invalid request state', 'request must be importing', 'import clients first',
  'undo is only allowed for an active imported request', 'request is not ready for review',
  'operator checklist is incomplete', 'completed human review is required',
  'not enough first-week schedule slots', 'existing schedule verification is required',
  'request cannot be skipped from its current state',
  'request schedule must be fully undone before skip',
]);
export function classifyRpcErrorStatus(code,message) {
  if(code==='P0002')return 404;
  if(code==='23505'||code==='40001')return 409;
  if(code==='22023')return RPC_STATE_PRECONDITIONS.has(String(message||'').trim().toLowerCase())?409:400;
  return null;
}
function rpcErrorResponse(error,request){
  const code=error?.details?.code;const message=String(error?.details?.message||'');
  const status=classifyRpcErrorStatus(code,message);if(status===null)return null;
  if(status===404)return response({error:'Request not found'},status,request);
  return response({error:message||(status===409?'The request conflicts with its current database state':'Invalid concierge request')},status,request);
}

export function onRequestOptions({request}) { return new Response(null,{status:204,headers:cors(request)}); }
export async function onRequestGet(context) {
  if(!context.env.SUPABASE_URL||!context.env.SUPABASE_SERVICE_ROLE_KEY)return response({error:'Server misconfigured'},500,context.request);
  const operator=await auth(context);if(!operator)return response({error:'Unauthorized'},401,context.request);
  if(!allowed(context.request))return response({error:'Too many requests. Please try again later.'},429,context.request);
  const url=new URL(context.request.url); if(url.searchParams.get('action')!=='list')return response({error:'Invalid action'},400,context.request);
  try { const result=await fetch(`${context.env.SUPABASE_URL}/rest/v1/concierge_requests?select=*&order=priority_rank.desc,created_at.asc`,{headers:service(context.env)}); const requests=await result.json(); if(!result.ok)throw new Error('Failed to list requests'); return response({requests:sortConciergeRequests(requests)},200,context.request); } catch(error){console.error('Concierge admin list failed',error);return response({error:'Something went wrong'},500,context.request);}
}
export async function onRequestPost(context) {
  const {env,request}=context; if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return response({error:'Server misconfigured'},500,request);
  const operator=await auth(context);if(!operator)return response({error:'Unauthorized'},401,request);
  if(!allowed(request))return response({error:'Too many requests. Please try again later.'},429,request);
  let body; try{body=await request.json();}catch{return response({error:'Invalid JSON'},400,request);}
  try {
    if(!UUID_RE.test(body.request_id||''))return response({error:'Valid request_id is required'},400,request);
    const item=await getRequest(env,body.request_id); if(!item)return response({error:'Request not found'},404,request);
    if(body.action==='undo_schedule'){
      if(!canUndoConciergeSchedule(item.status))return response({error:'Schedule undo is only allowed for an active imported request'},409,request);
      return response(await rpc(env,'concierge_undo_first_week',{p_request_id:item.id,p_operator_id:operator.id}),200,request);
    }
    if(body.action==='import'){
      if(Array.isArray(item.imported_client_ids)&&item.imported_client_ids.length)return response({...item.import_summary,already_complete:true},200,request);
      if(item.status!=='pending'&&item.status!=='importing')return response({error:'Request cannot be imported from its current state'},409,request);
      let profileResult;try{profileResult=await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=tier,trial_ends_at&id=eq.${item.user_id}`,{headers:service(env)});}catch{return response({error:'Could not verify user plan'},500,request);}if(!profileResult.ok)return response({error:'Could not verify user plan'},500,request);const profiles=await profileResult.json().catch(()=>null);if(!Array.isArray(profiles))return response({error:'Could not verify user plan'},500,request);const p=profiles[0]||{};const trialExpired=p.trial_ends_at&&new Date(p.trial_ends_at).getTime()<Date.now();if(!isConciergeTierEligible(p.tier)||trialExpired)return response({error:'User is not on an active paid plan — import blocked'},403,request);
      const parsed=parseConciergeCsv(item.csv_content);if(parsed.rows.length>70)return response({error:'Too many clients for first-week setup (max 70)'},400,request); if(!parsed.rows.length)return response({error:'No valid clients to import',skipped:parsed.errors},400,request);const organized=cleanClientRows(parsed.rows);
      const clients=organized.rows.map((row,index)=>{const value={source_index:index,name:row.name,address:row.address,phone:row.phone||'',email:row.email||'',rate:0};const rate=Number.parseFloat(row.rate);if(row.rate&&Number.isFinite(rate))value.rate=rate;return value;});
      const imported=await rpc(env,'concierge_import_clients',{p_request_id:item.id,p_clients:clients,p_operator_id:operator.id});return response({...imported,skipped:parsed.errors,cleaned:organized.cleaned,duplicates:organized.duplicates},200,request);
    }
    if(body.action==='schedule'){
      if(item.status!=='importing')return response({error:'Schedule preparation requires an importing request'},409,request);
      return response(await rpc(env,'concierge_schedule_first_week',{p_request_id:item.id,p_operator_id:operator.id}),200,request);
    }
    if(body.action==='review'){
      if(item.status==='review')return response({success:true,already_complete:true,request:item},200,request);
      if(!isConciergeTransitionAllowed(item.status,'review'))return response({error:'Request must be importing before human review'},409,request);
      if(!Array.isArray(item.imported_client_ids)||!item.imported_client_ids.length)return response({error:'Import clients before human review'},409,request);
      if(!item.scheduled_at)return response({error:'Prepare or verify the first-week schedule before human review'},409,request);
      const checklist=body.operator_checklist;
      if(!checklist||typeof checklist!=='object'||Array.isArray(checklist))return response({error:'Operator checklist is required'},400,request);
      if(!isOperatorChecklistComplete(checklist))return response({error:'Complete every operator checklist item before recording review'},409,request);
      if(Number(item.schedule_summary?.created||0)===0&&Number(item.schedule_summary?.skipped_existing||0)>0&&checklist.existing_schedule_verified!==true)return response({error:'Verify the customer existing first-week schedule before recording review'},409,request);
      const notes=typeof body.notes==='string'?body.notes.trim().slice(0,4000):'';const updated=await rpc(env,'concierge_record_review',{p_request_id:item.id,p_checklist:checklist,p_notes:notes,p_operator_id:operator.id});return response({success:true,request:updated},200,request);
    }
    if(body.action==='done'){
      if(item.status==='done')return response({success:true,already_complete:true,request:item},200,request);
      if(!isConciergeTransitionAllowed(item.status,'done'))return response({error:'Human review is required before completion'},409,request);
      if(!isOperatorChecklistComplete(item.operator_checklist))return response({error:'Complete every operator checklist item before completion'},409,request);
      if(Number(item.schedule_summary?.created||0)===0&&Number(item.schedule_summary?.skipped_existing||0)>0&&item.operator_checklist?.existing_schedule_verified!==true)return response({error:'Existing first-week schedule verification is required before completion'},409,request);
      const updated=await rpc(env,'concierge_complete_review',{p_request_id:item.id,p_operator_id:operator.id});return response({success:true,request:updated},200,request);
    }
    if(body.action==='skip'){
      if(item.status==='skipped')return response({success:true,already_complete:true,request:item},200,request);
      if(!isConciergeTransitionAllowed(item.status,'skipped'))return response({error:'Only an active concierge request can be closed'},409,request);
      if((Array.isArray(item.scheduled_job_ids)&&item.scheduled_job_ids.length)||item.scheduled_at)return response({error:'Undo the first-week schedule before closing this request'},409,request);
      if(typeof body.notes!=='string')return response({error:'Operator notes are required'},400,request);
      const notes=body.notes.trim();
      if(!notes.length||notes.length>4000)return response({error:'Operator notes must be 1 to 4000 characters after trimming'},400,request);
      const updated=await rpc(env,'concierge_skip_request',{p_request_id:item.id,p_notes:notes,p_operator_id:operator.id});return response({success:true,request:updated},200,request);
    }
    return response({error:'Invalid action'},400,request);
  } catch(error){const mapped=rpcErrorResponse(error,request);if(mapped)return mapped;console.error('Concierge admin failed',error);return response({error:'Something went wrong'},500,request);}
}
