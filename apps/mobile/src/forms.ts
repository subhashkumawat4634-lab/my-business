import { paise } from '../../../shared/finance';
import { FormSpec, Row, Snapshot } from './types';
export const today = () => new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const choices = (values:string[]) => values.map(value=>({value,label:value.replaceAll('_',' ')}));
const rupees = (n:any) => String(Number(n || 0)/100);
const base = (action:string,title:string,subtitle:string):FormSpec => ({action,title,subtitle,fields:[],initial:{},transform:v=>v});
export function siteForm(site?:Row):FormSpec {
  return {...base(site?'site.update':'site.create',site?'Edit site':'New work site','A separate, clear ledger for every theka.'),entity_id:site?.id,
    fields:[{key:'name',label:'Site / work name',placeholder:'Sharma Residence · Painting'},
      {key:'owner_name',label:'Owner / client name'},{key:'phone',label:'Client phone',numeric:true},{key:'address',label:'Work address'},
      {key:'work_type',label:'Contract includes',options:[{value:'LABOUR',label:'Labour only'},{value:'MATERIAL',label:'Labour + material'}]},
      {key:'pricing',label:'Pricing basis',options:choices(['FIXED','UNIT','DAILY'])},
      {key:'contract_amount',label:'Fixed contract amount (₹)',numeric:true},
      {key:'quantity',label:'Agreed quantity / days (unit or daily contract)',numeric:true},
      {key:'unit',label:'Unit',placeholder:'sq ft / days / job'},{key:'unit_rate',label:'Rate per unit / day (₹)',numeric:true},
      {key:'remaining_estimate',label:'Estimated cost still to incur (₹)',numeric:true},
      {key:'start_date',label:'Start date · YYYY-MM-DD'},{key:'end_date',label:'Expected end date · optional'},
      {key:'status',label:'Status',options:choices(['UPCOMING','ONGOING','PAUSED','COMPLETED'])},
      {key:'notes',label:'Scope, agreement reference & terms',multiline:true}],
    initial:{name:site?.name||'',owner_name:site?.owner_name||'',phone:site?.phone||'',address:site?.address||'',work_type:site?.work_type||'LABOUR',pricing:site?.pricing||'FIXED',
      contract_amount:rupees(site?.contract_amount),quantity:String(site?.quantity||1),unit:site?.unit||'job',unit_rate:rupees(site?.unit_rate),remaining_estimate:rupees(site?.remaining_estimate),
      start_date:String(site?.start_date||today()).slice(0,10),end_date:site?.end_date?String(site.end_date).slice(0,10):'',status:site?.status||'ONGOING',notes:site?.notes||''},
    transform:v=>({...v,contract_amount:paise(v.contract_amount),unit_rate:paise(v.unit_rate),quantity:Number(v.quantity),remaining_estimate:paise(v.remaining_estimate),end_date:v.end_date||null})};
}
export function workerForm(w?:Row):FormSpec {
  return {...base(w?'worker.update':'worker.create',w?'Edit worker':'Add a worker','Rates are saved with attendance. Old wages stay unchanged.'),entity_id:w?.id,
    fields:[{key:'name',label:'Full name'},{key:'phone',label:'Mobile number',numeric:true},{key:'skill',label:'Skill / role',placeholder:'Painter, mason, helper…'},
      {key:'daily_rate',label:'Daily wage (₹)',numeric:true},{key:'overtime_rate',label:'Overtime per hour (₹)',numeric:true},
      {key:'active',label:'Worker status',options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}]}],
    initial:{name:w?.name||'',phone:w?.phone||'',skill:w?.skill||'Painter',daily_rate:rupees(w?.daily_rate),overtime_rate:rupees(w?.overtime_rate),active:String(w?.active??true)},
    transform:v=>({...v,daily_rate:paise(v.daily_rate),overtime_rate:paise(v.overtime_rate),active:v.active==='true'})};
}
export function attendanceForm(data:Snapshot, siteId?:string, workerId?:string, existing?:Row):FormSpec {
  return {...base('attendance.save',existing?'Correct attendance':'Mark attendance','One full day maximum across sites. Corrections require a reason.'),
    fields:[{key:'site_id',label:'Work site',options:data.sites.map(s=>({label:s.name,value:s.id}))},
      {key:'worker_id',label:'Worker',options:data.workers.filter(w=>w.active).map(w=>({label:w.name,value:w.id}))},
      {key:'date',label:'Work date · YYYY-MM-DD'},
      {key:'units',label:'Attendance',options:[{value:'1',label:'Present'},{value:'0.5',label:'Half Day'},{value:'0',label:'Absent'}]},
      {key:'overtime_minutes',label:'Overtime in minutes (60 = 1 hour)',numeric:true},{key:'notes',label:'Note / correction reason'}],
    initial:{site_id:existing?.site_id||siteId||data.sites[0]?.id||'',worker_id:existing?.worker_id||workerId||data.workers.find(w=>w.active)?.id||'',date:existing?String(existing.date).slice(0,10):today(),units:String(existing?.units??1),overtime_minutes:String(existing?.overtime_minutes||0),notes:''},
    transform:v=>({...v,units:Number(v.units),overtime_minutes:Number(v.overtime_minutes)})};
}
export const entryLabels:Record<string,string> = {RECEIPT:'Client payment received',WAGE_PAYMENT:'Labour payment / advance',MATERIAL:'Material cost bill',EXPENSE:'Other expense bill',EXTRA:'Approved extra work',SUPPLIER_PAYMENT:'Pay material / expense bill'};
export function entryForm(data:Snapshot,kind:string,siteId?:string,workerId?:string,bill?:Row):FormSpec {
  const form = base('entry.create',entryLabels[kind], ['MATERIAL','EXPENSE'].includes(kind)?'Record the cost first; record its payment separately. Material cost assumes use on this site.':'A dated entry with a traceable reference.');
  const fields:FormSpec['fields'] = [{key:'site_id',label:'Work site',options:data.sites.map(s=>({label:s.name,value:s.id}))}];
  if(kind==='WAGE_PAYMENT') fields.push({key:'worker_id',label:'Worker',options:data.workers.map(w=>({label:w.name,value:w.id}))});
  if(kind==='SUPPLIER_PAYMENT') fields.push({key:'linked_entry_id',label:'Bill being paid (must match site)',options:data.entries.filter(e=>['MATERIAL','EXPENSE'].includes(e.kind)&&!e.voided_at).map(e=>({label:`${e.description} · ${data.sites.find(s=>s.id===e.site_id)?.name}`,value:e.id}))});
  fields.push({key:'amount',label:'Amount (₹)',numeric:true},{key:'date',label:'Date · YYYY-MM-DD'},{key:'description',label:'Description',placeholder:kind==='EXTRA'?'Additional wall preparation':'What is this entry for?'},{key:'party',label:'Supplier / payer name · optional'});
  if(kind==='MATERIAL') fields.push({key:'quantity',label:'Quantity · optional',numeric:true},{key:'unit',label:'Unit · optional',placeholder:'bags / litres / pieces'});
  fields.push({key:'mode',label:'Mode',options:choices(['CASH','UPI','BANK','RECORD'])},{key:'reference',label:kind==='EXTRA'?'Client approval reference · required':'Receipt / bill / transaction reference'}, {key:'due_date',label:'Due date · YYYY-MM-DD · optional'});
  return {...form,fields,initial:{site_id:bill?.site_id||siteId||data.sites[0]?.id||'',worker_id:workerId||data.workers[0]?.id||'',linked_entry_id:bill?.id||'',amount:'',date:today(),description:'',party:bill?.party||'',mode:['MATERIAL','EXPENSE','EXTRA'].includes(kind)?'RECORD':'CASH',reference:'',due_date:'',quantity:'',unit:''},
    transform:v=>({site_id:v.site_id,kind,worker_id:kind==='WAGE_PAYMENT'?v.worker_id:null,linked_entry_id:kind==='SUPPLIER_PAYMENT'?v.linked_entry_id:null,amount:paise(v.amount),date:v.date,description:v.description,party:v.party,mode:v.mode,reference:v.reference,due_date:v.due_date||null,quantity:kind==='MATERIAL'&&v.quantity?Number(v.quantity):null,unit:kind==='MATERIAL'?v.unit:''})};
}
export function voidForm(entry:Row):FormSpec {
  return {...base('entry.void','Void entry','The original record stays in history. Balances will be recalculated.'),entity_id:entry.id,
    fields:[{key:'reason',label:'Why are you reversing this entry?',multiline:true}],initial:{reason:''},transform:v=>v};
}
