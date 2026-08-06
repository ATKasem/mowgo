const ALIASES = { name: ['name','client name','client_name','customer name','customer','client'], address: ['address','street','location'], phone: ['phone','phone number','phone_number','mobile','cell'], email: ['email','e-mail','email address'], rate: ['rate','price','amount','cost','mow price'] };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ORIGINS = ['https://mowgoapp.com', 'https://mowgo.pages.dev'];
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const adminAttempts = new Map();
function cors(request) { const origin=request?.headers?.get?.('origin'); return { 'Access-Control-Allow-Origin': origin&&ALLOWED_ORIGINS.includes(origin)?origin:'https://mowgoapp.com', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, x-admin-code', 'Access-Control-Max-Age': '86400' }; }
function allowed(request) { const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'unknown';const now=Date.now();const entry=adminAttempts.get(ip);if(!entry||now>=entry.reset){adminAttempts.set(ip,{count:1,reset:now+RATE_LIMIT_WINDOW});return true;}if(entry.count>=RATE_LIMIT_MAX)return false;entry.count+=1;return true; }
function timingSafeEqual(left,right) { const a=String(left||''),b=String(right||'');let diff=a.length^b.length;const length=Math.max(a.length,b.length);for(let i=0;i<length;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0; }
function firstRecord(source) { let value='',quoted=false; for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){value+=c;if(quoted&&source[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if((c==='\n'||c==='\r')&&!quoted){if(value.trim())return value;if(c==='\r'&&source[i+1]==='\n')i++;value='';}else value+=c;}return value.trim()?value:''; }
function delimiter(line) { const counts={ '\t':0, ';':0, ',':0 }; let quoted=false; for(let i=0;i<line.length;i++){if(line[i]==='"'){if(quoted&&line[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&Object.hasOwn(counts,line[i]))counts[line[i]]++;} return counts['\t']?'\t':counts[';']&&!counts[',']?';':','; }
function records(source,delimiter) { const out=[];let cells=[],value='',quoted=false,row=1,startRow=1;const push=()=>{cells.push(value.trim());out.push({cells,row:startRow});cells=[];value='';startRow=row;};for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){cells.push(value.trim());value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;push();row++;startRow=row;}else{value+=c;if(c==='\n'||c==='\r')row++;}}if(value||cells.length)push();return out;}
function parseCsv(text) {
  const source=String(text||'').replace(/^\uFEFF/,'');const firstText=firstRecord(source);if(!firstText)return {rows:[],errors:[]};const delim=delimiter(firstText);const parsedRecords=records(source,delim);const firstIndex=parsedRecords.findIndex(record=>record.cells.some(cell=>cell.trim()));
  const first=parsedRecords[firstIndex].cells; const normalized=first.map(v=>v.toLowerCase().trim()); const header=normalized.some(v=>Object.values(ALIASES).some(a=>a.includes(v))); const indexes={};
  if(header)Object.entries(ALIASES).forEach(([key,values])=>{indexes[key]=normalized.findIndex(v=>values.includes(v));}); else ['name','address','phone','email','rate'].forEach((key,i)=>{indexes[key]=i;});
  const rows=[],errors=[]; parsedRecords.forEach((record,i)=>{if(!record.cells.some(cell=>cell.trim())||(header&&i===firstIndex)||i<firstIndex)return; const row=Object.fromEntries(Object.entries(indexes).map(([key,column])=>[key,column<0?'':(record.cells[column]||'').trim()])); const missing=[!row.name&&'name',!row.address&&'address'].filter(Boolean); if(missing.length)errors.push({row:record.row,message:`Missing ${missing.join(' and ')}`});else rows.push(row);}); return {rows,errors};
}
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
function auth(context) { return Boolean(context.env.CONCIERGE_ADMIN_CODE) && timingSafeEqual(context.request.headers.get('x-admin-code'),context.env.CONCIERGE_ADMIN_CODE); }
function service(env) { return { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }; }
async function getRequest(env, id) { if(!UUID_RE.test(id||''))return null; const response=await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_requests?id=eq.${id}&select=*`,{headers:service(env)}); if(!response.ok)throw new Error('Failed to load request'); return (await response.json())[0]||null; }
function response(data,status,request){return Response.json(data,{status,headers:cors(request)});}

export function onRequestOptions({request}) { return new Response(null,{status:204,headers:cors(request)}); }
export async function onRequestGet(context) {
  if(!allowed(context.request))return response({error:'Too many requests. Please try again later.'},429,context.request);
  if(!auth(context))return response({error:'Unauthorized'},401,context.request);
  if(!context.env.SUPABASE_URL||!context.env.SUPABASE_SERVICE_ROLE_KEY)return response({error:'Server misconfigured'},500,context.request);
  const url=new URL(context.request.url); if(url.searchParams.get('action')!=='list')return response({error:'Invalid action'},400,context.request);
  try { const result=await fetch(`${context.env.SUPABASE_URL}/rest/v1/concierge_requests?select=*&order=created_at.asc`,{headers:service(context.env)}); const requests=await result.json(); if(!result.ok)throw new Error('Failed to list requests'); return response({requests},200,context.request); } catch(error){console.error('Concierge admin list failed',error);return response({error:'Something went wrong'},500,context.request);}
}
export async function onRequestPost(context) {
  if(!allowed(context.request))return response({error:'Too many requests. Please try again later.'},429,context.request);
  if(!auth(context))return response({error:'Unauthorized'},401,context.request);
  const {env,request}=context; if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return response({error:'Server misconfigured'},500,request);
  let body; try{body=await request.json();}catch{return response({error:'Invalid JSON'},400,request);}
  try {
    if(!UUID_RE.test(body.request_id||''))return response({error:'Valid request_id is required'},400,request);
    const item=await getRequest(env,body.request_id); if(!item)return response({error:'Request not found'},404,request);
    if(body.action==='undo_schedule'){
      if(!Array.isArray(body.job_ids)||!body.job_ids.length||body.job_ids.some(id=>!UUID_RE.test(id)))return response({error:'Valid job_ids are required'},400,request);
      const matchesResult=await fetch(`${env.SUPABASE_URL}/rest/v1/jobs?id=in.(${body.job_ids.join(',')})&user_id=eq.${item.user_id}&select=id`,{headers:service(env)});const matches=await matchesResult.json();if(!matchesResult.ok)throw new Error('Failed to verify scheduled jobs');const matchingIds=matches.map(job=>job.id);if(!matchingIds.length)return response({error:'No matching jobs for this request'},400,request);
      const result=await fetch(`${env.SUPABASE_URL}/rest/v1/jobs?id=in.(${matchingIds.join(',')})`,{method:'DELETE',headers:service(env)}); if(!result.ok)throw new Error('Failed to undo schedule'); return response({success:true},200,request);
    }
    if(body.action==='import'){
      if(Array.isArray(item.imported_client_ids)&&item.imported_client_ids.length)return response({error:'This request has already been imported'},400,request);
      let profileResult;try{profileResult=await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=tier&id=eq.${item.user_id}`,{headers:service(env)});}catch{return response({error:'Could not verify user plan'},500,request);}if(!profileResult.ok)return response({error:'Could not verify user plan'},500,request);const profiles=await profileResult.json().catch(()=>null);if(!Array.isArray(profiles))return response({error:'Could not verify user plan'},500,request);if(!['solo','crew'].includes(profiles[0]?.tier))return response({error:'User is not on a paid plan — import blocked'},403,request);
      const parsed=parseCsv(item.csv_content);if(parsed.rows.length>500)return response({error:'Too many clients (max 500 per import)'},400,request); if(!parsed.rows.length)return response({error:'No valid clients to import',skipped:parsed.errors},400,request);const organized=cleanClientRows(parsed.rows);
      const claim=await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_requests?id=eq.${item.id}`,{method:'PATCH',headers:service(env),body:JSON.stringify({status:'importing',imported_client_ids:[]})});if(!claim.ok)throw new Error('Failed to claim request');
      const clients=organized.rows.map(row=>{const value={user_id:item.user_id,name:row.name,address:row.address}; if(row.phone)value.phone=row.phone;if(row.email)value.email=row.email;const rate=Number.parseFloat(row.rate);if(row.rate&&Number.isFinite(rate))value.rate=rate;return value;});
      const result=await fetch(`${env.SUPABASE_URL}/rest/v1/clients`,{method:'POST',headers:{...service(env),Prefer:'return=representation'},body:JSON.stringify(clients)}); const created=await result.json(); if(!result.ok)throw new Error('Failed to import clients');const saved=await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_requests?id=eq.${item.id}`,{method:'PATCH',headers:service(env),body:JSON.stringify({imported_client_ids:created.map(client=>client.id)})});if(!saved.ok)throw new Error('Failed to save imported clients'); return response({created:created.length,clients:created.map(({id,name,address})=>({id,name,address})),skipped:parsed.errors,cleaned:organized.cleaned,duplicates:organized.duplicates},200,request);
    }
    if(body.action==='schedule'){
      if(!Array.isArray(item.imported_client_ids)||!item.imported_client_ids.length)return response({error:'Import clients first'},400,request);
      const clientsResult=await fetch(`${env.SUPABASE_URL}/rest/v1/clients?select=id,name,address&user_id=eq.${item.user_id}&id=in.(${item.imported_client_ids.join(',')})`,{headers:service(env)}); const clients=await clientsResult.json(); if(!clientsResult.ok)throw new Error('Failed to load clients');
      const today=new Date(); const todayIso=today.toISOString().slice(0,10);const end=new Date(today);end.setUTCDate(end.getUTCDate()+6);const endIso=end.toISOString().slice(0,10); const existingResult=await fetch(`${env.SUPABASE_URL}/rest/v1/jobs?select=client_id,scheduled_date,scheduled_time&user_id=eq.${item.user_id}&status=in.(scheduled,in_progress)&scheduled_date=gte.${todayIso}&scheduled_date=lte.${endIso}`,{headers:service(env)}); const existing=await existingResult.json(); if(!existingResult.ok)throw new Error('Failed to load existing jobs'); const existingClientIds=new Set(existing.map(job=>job.client_id)); const schedulableClients=clients.filter(client=>!existingClientIds.has(client.id)); const skipped=clients.length-schedulableClients.length;const usedSlots=new Set(existing.map(job=>`${job.scheduled_date}|${String(job.scheduled_time||'').slice(0,5)}`));const jobs=[];for(const client of schedulableClients){let selected=null;for(let day=0;day<7&&!selected;day++){const date=new Date(today);date.setUTCDate(date.getUTCDate()+day);const dateIso=date.toISOString().slice(0,10);for(let slot=0;slot<10;slot++){const time=`${String(8+slot).padStart(2,'0')}:00`;const key=`${dateIso}|${time}`;if(!usedSlots.has(key)){usedSlots.add(key);selected={date:dateIso,time};break;}}}if(!selected)return response({error:`Not enough free slots in the next 7 days to schedule ${schedulableClients.length} clients`},400,request);jobs.push({user_id:item.user_id,client_id:client.id,title:`Lawn care — ${client.name}`,scheduled_date:selected.date,scheduled_time:selected.time,duration_minutes:60,status:'scheduled',route_order:99,recurrence_rule:'none'});}
      if(!jobs.length)return response({jobs:[],skipped},200,request); const result=await fetch(`${env.SUPABASE_URL}/rest/v1/jobs`,{method:'POST',headers:{...service(env),Prefer:'return=representation'},body:JSON.stringify(jobs)}); const created=await result.json(); if(!result.ok)throw new Error('Failed to schedule jobs'); return response({jobs:created.map(({id,scheduled_date,scheduled_time})=>({id,scheduled_date,scheduled_time})),skipped},200,request);
    }
    if(body.action==='done'){const result=await fetch(`${env.SUPABASE_URL}/rest/v1/concierge_requests?id=eq.${item.id}`,{method:'PATCH',headers:service(env),body:JSON.stringify({status:'done',done_at:new Date().toISOString()})});if(!result.ok)throw new Error('Failed to mark request done');return response({success:true},200,request);}
    return response({error:'Invalid action'},400,request);
  } catch(error){console.error('Concierge admin failed',error);return response({error:'Something went wrong'},500,request);}
}
