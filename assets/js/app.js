// app.js — Secure accounting with username/password unlock
const LS_KEY = 'ghadeer.sec.auth.v1';
const AUTH_USERNAME = 'star';
const AUTH_PASSWORD = 'star1996@';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let decryptedState = null;
let secretCache = null;

const defaultState = {
  clients: {},
  expenses: [],
  settings: { currency: 'USD', locale: 'en-US' }
};

function hasEncryptedState(){ try{ return !!localStorage.getItem(LS_KEY); }catch{ return false; } }
async function saveEncrypted(){
  if(!secretCache || !decryptedState) return;
  decryptedState._ts = Date.now();
  const bundle = await GCrypto.aesEncryptJson(decryptedState, secretCache);
  localStorage.setItem(LS_KEY, JSON.stringify(bundle));
}
async function firstTimeCreate(secret){
  const bundle = await GCrypto.aesEncryptJson(defaultState, secret);
  localStorage.setItem(LS_KEY, JSON.stringify(bundle));
  secretCache = secret;
  decryptedState = JSON.parse(JSON.stringify(defaultState));
}
async function unlock(secret){
  const bundle = JSON.parse(localStorage.getItem(LS_KEY));
  decryptedState = await GCrypto.aesDecryptJson(bundle, secret);
  secretCache = secret;
}

// helpers
function fmt(n){
  const {locale, currency} = decryptedState.settings || {locale:'en-US', currency:'USD'};
  try{ return Number(n).toLocaleString(locale, {style:'currency', currency}); }
  catch{ return Number(n).toLocaleString(locale||'en-US') + ' ' + (currency||'USD'); }
}
const today = ()=> new Date().toISOString().slice(0,10);
const uid = ()=> Math.random().toString(36).slice(2) + Date.now().toString(36);
function sum(arr){ return arr.reduce((a,b)=> a + Number(b||0), 0); }
function escapeHtml(s=''){ return s.replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s=''){ return s.replace(/['"]/g, m=> (m==='"'?'&quot;':'&#39;')); }
function safeFile(s=''){ return s.replace(/[^-\w]+/g,'_'); }

// UI boot
window.addEventListener('DOMContentLoaded', ()=>{
  const gate = $('#gate'); const tabs = $('#tabs'); const app = $('#app');
  if(!hasEncryptedState()){
    $('#gateTitle').textContent = 'تسجيل الدخول لأول مرة';
    $('#gateDesc').textContent = 'استخدم اسم المستخدم وكلمة المرور الافتراضية لتهيئة قاعدة البيانات.';
  }else{
    $('#gateTitle').textContent = 'تسجيل الدخول';
    $('#gateDesc').textContent = 'أدخل اسم المستخدم وكلمة المرور لفتح قاعدة البيانات.';
  }

  $('#gateConfirm').addEventListener('click', async ()=>{
    try{
      const username = ($('#loginUser').value||'').trim();
      const password = $('#loginPass').value || '';
      if(username !== AUTH_USERNAME || password !== AUTH_PASSWORD){
        alert('بيانات تسجيل الدخول غير صحيحة.');
        return;
      }
      if(!hasEncryptedState()) await firstTimeCreate(password);
      else await unlock(password);
      // init UI
      $('#t_date').value = today();
      $('#p_date').value = today();
      $('#e_date').value = today();
      $('#currencyCode').value = decryptedState.settings.currency || 'USD';
      $('#localeSelect').value = decryptedState.settings.locale || 'en-US';
      renderAll();
      gate.classList.add('hidden'); app.classList.remove('hidden'); tabs.classList.remove('hidden');
    }catch(e){ console.error(e); alert('بيانات تسجيل الدخول غير صحيحة أو البيانات تالفة.'); }
  });

  $('#importEnc').addEventListener('click', ()=>{
    const fp = document.getElementById('filePicker'); fp.value='';
    fp.onchange = ()=>{
      const f = fp.files[0]; if(!f) return;
      const r = new FileReader(); r.onload = ()=>{
        try{
          const j = JSON.parse(r.result);
          if(!j.cipher || !j.iv || !j.salt) throw new Error('bad');
          localStorage.setItem(LS_KEY, JSON.stringify(j));
          alert('تم الاستيراد — أدخل اسم المستخدم وكلمة المرور الخاصة بهذه النسخة.'); location.reload();
        }catch{ alert('ملف غير صالح.'); }
      };
      r.readAsText(f, 'utf-8');
    };
    fp.click();
  });
  $('#resetAll').addEventListener('click', ()=>{
    if(confirm('مسح كل البيانات المشفّرة؟')){ localStorage.removeItem(LS_KEY); location.reload(); }
  });
});

// Tabs
$$('#tabs .tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('#tabs .tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.tab;
    $$('.tab-pane').forEach(p=>p.classList.add('hidden'));
    $('#'+id).classList.remove('hidden');
    if(id==='summary') renderSummary();
    if(id==='expenses') renderExpenses();
    if(id==='transactions') syncClientSelects();
    if(id==='clients') renderClients();
  });
});

// Accounting logic
function calcClientBalance(name){
  const c = decryptedState.clients[name]; if(!c) return 0;
  return c.ledger.reduce((bal,op)=> bal + (op.type==='invoice'? Number(op.amount||0): -Number(op.amount||0)), 0);
}
function syncClientSelects(){
  const names = Object.keys(decryptedState.clients).sort((a,b)=> a.localeCompare(b,'ar'));
  for(const id of ['t_client','p_client']){ const el = $('#'+id); el.innerHTML=''; names.forEach(n=>{
    const o = document.createElement('option'); o.value=n; o.textContent=n; el.appendChild(o);
  });}
}
$('#addClientBtn').addEventListener('click', async ()=>{
  const name = $('#c_name').value.trim(), phone = $('#c_phone').value.trim(), city = $('#c_city').value.trim();
  if(!name) return alert('أدخل اسم العميل');
  if(!decryptedState.clients[name]) decryptedState.clients[name] = { name, phone, city, ledger:[] };
  else { decryptedState.clients[name].phone = phone || decryptedState.clients[name].phone; decryptedState.clients[name].city = city || decryptedState.clients[name].city; }
  await saveEncrypted(); $('#c_name').value=''; $('#c_phone').value=''; $('#c_city').value=''; renderClients(); syncClientSelects();
});
$('#exportClientsBtn').addEventListener('click', ()=>{
  const rows = Object.values(decryptedState.clients).map(c=>({ name:c.name, phone:c.phone||'', city:c.city||'', operations:c.ledger.length, balance: calcClientBalance(c.name) }));
  const blob = new Blob([JSON.stringify(rows,null,2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='clients_export.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
$('#clientSearch').addEventListener('input', renderClients);
$('#clientSort').addEventListener('change', renderClients);

function renderClients(){
  const tbody = $('#clientRows'); if(!tbody) return; tbody.innerHTML='';
  const q = ($('#clientSearch').value||'').trim().toLowerCase(); const sort = $('#clientSort').value;
  let list = Object.values(decryptedState.clients);
  if(q){ list = list.filter(c => (c.name||'').toLowerCase().includes(q) || (c.phone||'').toLowerCase().includes(q) || (c.city||'').toLowerCase().includes(q)); }
  list.forEach(c=> c.balance = calcClientBalance(c.name));
  if(sort==='name') list.sort((a,b)=> a.name.localeCompare(b.name,'ar'));
  if(sort==='balanceDesc') list.sort((a,b)=> b.balance - a.balance);
  if(sort==='balanceAsc') list.sort((a,b)=> a.balance - b.balance);
  if(sort==='invoices') list.sort((a,b)=> b.ledger.length - a.ledger.length);
  list.forEach(c=>{
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td data-label="العميل">\${escapeHtml(c.name)}</td>
      <td data-label="الهاتف">\${escapeHtml(c.phone||'-')}</td>
      <td data-label="المدينة">\${escapeHtml(c.city||'-')}</td>
      <td data-label="العمليات">\${c.ledger.length}</td>
      <td data-label="الرصيد"><span class="\${c.balance>=0?'balance-pos':'balance-neg'}">\${fmt(c.balance)}</span></td>
      <td class="right" data-label="خيارات">
        <div class="row-actions">
          <button class="btn" onclick="openStatement('\${escapeAttr(c.name)}')">👁️ كشف</button>
          <button class="btn" onclick="quickInvoice('\${escapeAttr(c.name)}')">🧾 فاتورة</button>
          <button class="btn" onclick="quickPayment('\${escapeAttr(c.name)}')">💸 دفعة</button>
          <button class="btn danger" onclick="deleteClient('\${escapeAttr(c.name)}')">🗑️ حذف</button>
        </div>
      </td>\`;
    tbody.appendChild(tr);
  });
}
async function deleteClient(name){
  if(!confirm('حذف العميل وجميع عملياته؟')) return;
  delete decryptedState.clients[name]; await saveEncrypted(); renderClients(); syncClientSelects(); renderSummary();
}
function quickInvoice(name){ $('#t_client').value=name; $$('#tabs .tab').find(b=>b.dataset.tab==='transactions').click(); $('#t_desc').focus(); }
function quickPayment(name){ $('#p_client').value=name; $$('#tabs .tab').find(b=>b.dataset.tab==='transactions').click(); $('#p_desc').focus(); }

// Invoices/Payments
$('#addInvoiceBtn').addEventListener('click', async ()=>{
  const client=$('#t_client').value, desc=$('#t_desc').value.trim(), amount=Number($('#t_amount').value), date=$('#t_date').value||today();
  if(!client) return alert('اختر العميل'); if(!(amount>0)) return alert('أدخل مبلغًا صحيحًا');
  decryptedState.clients[client].ledger.push({ id:uid(), type:'invoice', desc, amount, date });
  await saveEncrypted(); $('#t_desc').value=''; $('#t_amount').value=''; $('#t_date').value=''; renderClients(); renderSummary(); alert('تمت إضافة الفاتورة.');
});
$('#addPaymentBtn').addEventListener('click', async ()=>{
  const client=$('#p_client').value, desc=$('#p_desc').value.trim(), amount=Number($('#p_amount').value), date=$('#p_date').value||today();
  if(!client) return alert('اختر العميل'); if(!(amount>0)) return alert('أدخل مبلغًا صحيحًا');
  decryptedState.clients[client].ledger.push({ id:uid(), type:'payment', desc, amount, date });
  await saveEncrypted(); $('#p_desc').value=''; $('#p_amount').value=''; $('#p_date').value=''; renderClients(); renderSummary(); alert('تم تسجيل الدفعة.');
});

// Expenses
$('#addExpenseBtn').addEventListener('click', async ()=>{
  const desc=$('#e_desc').value.trim(), amount=Number($('#e_amount').value), date=$('#e_date').value||today();
  if(!(amount>0)) return alert('أدخل مبلغًا صحيحًا');
  decryptedState.expenses.push({ id:uid(), desc, amount, date });
  await saveEncrypted(); $('#e_desc').value=''; $('#e_amount').value=''; $('#e_date').value=''; renderExpenses(); renderSummary();
});
function renderExpenses(){
  const tbody = $('#expenseRows'); if(!tbody) return; tbody.innerHTML='';
  const rows = [...decryptedState.expenses].sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  rows.forEach(e=>{
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td data-label="التاريخ">\${escapeHtml(e.date||'-')}</td>
      <td data-label="الوصف">\${escapeHtml(e.desc||'-')}</td>
      <td data-label="المبلغ">\${fmt(e.amount||0)}</td>
      <td data-label="خيارات" class="right"><div class="row-actions">
        <button class="btn danger" onclick="deleteExpense('\${e.id}')">🗑️ حذف</button>
      </div></td>\`;
    tbody.appendChild(tr);
  });
}
async function deleteExpense(id){
  if(!confirm('حذف المصروف؟')) return;
  decryptedState.expenses = decryptedState.expenses.filter(x=>x.id!==id);
  await saveEncrypted(); renderExpenses(); renderSummary();
}

// Summary
function renderSummary(){
  const all = Object.values(decryptedState.clients);
  const invoicesTotal = sum(all.flatMap(c => c.ledger.filter(x=>x.type==='invoice').map(x=>x.amount)));
  const paymentsTotal = sum(all.flatMap(c => c.ledger.filter(x=>x.type==='payment').map(x=>x.amount)));
  const expensesTotal = sum(decryptedState.expenses.map(e=>e.amount));
  const netProfit = invoicesTotal - expensesTotal;
  $('#s_totalInvoices').textContent = fmt(invoicesTotal);
  $('#s_totalPayments').textContent = fmt(paymentsTotal);
  $('#s_totalExpenses').textContent = fmt(expensesTotal);
  $('#s_netProfit').textContent = fmt(netProfit);

  const tbody = $('#topClientsRows'); if(!tbody) return; tbody.innerHTML='';
  const ranked = all.map(c=>{
    const inv = sum(c.ledger.filter(x=>x.type==='invoice').map(x=>x.amount));
    const bal = calcClientBalance(c.name);
    return {name:c.name, inv, count:c.ledger.filter(x=>x.type==='invoice').length, bal};
  }).sort((a,b)=> b.inv - a.inv).slice(0,10);
  ranked.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td data-label="العميل">\${escapeHtml(r.name)}</td>
      <td data-label="عدد الفواتير">\${r.count}</td>
      <td data-label="إجمالي فواتيره">\${fmt(r.inv)}</td>
      <td data-label="الرصيد"><span class="\${r.bal>=0?'balance-pos':'balance-neg'}">\${fmt(r.bal)}</span></td>\`;
    tbody.appendChild(tr);
  });
}

// Settings
$('#saveSettingsBtn').addEventListener('click', async ()=>{
  decryptedState.settings.currency = $('#currencyCode').value.trim() || 'USD';
  decryptedState.settings.locale = $('#localeSelect').value || 'en-US';
  await saveEncrypted(); renderClients(); renderExpenses(); renderSummary(); alert('تم حفظ الإعدادات.');
});
$('#exportAllBtn').addEventListener('click', ()=>{
  const bundle = localStorage.getItem(LS_KEY); if(!bundle) return alert('لا توجد بيانات لتصديرها.');
  const a=document.createElement('a'); const url=URL.createObjectURL(new Blob([bundle],{type:'application/json;charset=utf-8'}));
  a.href=url; a.download='ghadeer_encrypted_backup.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
$('#lockBtn').addEventListener('click', ()=>{
  $('#gateTitle').textContent = 'تسجيل الدخول';
  $('#gateDesc').textContent='أدخل اسم المستخدم وكلمة المرور لفتح قاعدة البيانات.';
  $('#loginUser').value='';
  $('#loginPass').value='';
  $('#gate').classList.remove('hidden');
});

// Drawer
const drawer = $('#drawer');
$('#d_close').addEventListener('click', ()=> drawer.classList.remove('open'));
$('#d_search').addEventListener('input', ()=> renderStatement(currentStatementName));
$('#d_range').addEventListener('change', ()=> renderStatement(currentStatementName));
$('#d_export').addEventListener('click', ()=>{
  if(!currentStatementName) return;
  const rows = buildStatementRows(currentStatementName, true).map(r=>({ date:r.date, desc:r.desc, type:r.type, amount:r.amount }));
  const a=document.createElement('a'); const url=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}));
  a.href=url; a.download='statement_'+safeFile(currentStatementName)+'.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
let currentStatementName=null;
function openStatement(name){
  currentStatementName=name;
  const c = decryptedState.clients[name];
  $('#d_title').textContent='كشف حساب';
  $('#d_subtitle').textContent = (c.name||'')+' — '+(c.phone||'-')+' — '+(c.city||'-');
  $('#d_search').value=''; $('#d_range').value='all';
  renderStatement(name); drawer.classList.add('open');
}
function buildStatementRows(name, raw=false){
  const q = ($('#d_search').value||'').trim().toLowerCase();
  const range = $('#d_range').value; const sinceDays = range==='all'? null : Number(range);
  const c = decryptedState.clients[name]; const now = new Date(); let list=[...c.ledger];
  list.sort((a,b)=> (a.date||'').localeCompare(b.date||'') || a.id.localeCompare(b.id));
  if(q) list = list.filter(x=> (x.desc||'').toLowerCase().includes(q));
  if(sinceDays){ const since = new Date(now.getTime()-sinceDays*24*60*60*1000); list = list.filter(x=> x.date && new Date(x.date) >= since); }
  if(raw) return list.map(x=>({...x}));
  return list.map(x=>({id:x.id, date:x.date, desc:x.desc, type:x.type, amount:Number(x.amount)}));
}
function renderStatement(name){
  const tbody = $('#d_rows'); tbody.innerHTML=''; if(!name) return;
  const rows = buildStatementRows(name); let running = 0;
  rows.forEach(r=>{
    running += (r.type==='invoice'? Number(r.amount): -Number(r.amount));
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td data-label="التاريخ">\${escapeHtml(r.date||'-')}</td>
      <td data-label="البيان">\${escapeHtml(r.desc||'-')}</td>
      <td data-label="النوع"><span class="pill \${r.type==='invoice'?'in':'out'}">\${r.type==='invoice'?'فاتورة':'دفعة'}</span></td>
      <td data-label="المبلغ">\${fmt(r.amount||0)}</td>
      <td data-label="الرصيد بعد العملية">\${fmt(running)}</td>
      <td data-label="خيارات" class="right"><div class="row-actions">
        <button class="btn" onclick="editOp('\${escapeAttr(name)}','\${r.id}')">✏️ تعديل</button>
        <button class="btn danger" onclick="deleteOp('\${escapeAttr(name)}','\${r.id}')">🗑️ حذف</button>
      </div></td>\`;
    tbody.appendChild(tr);
  });
}
async function editOp(name, opId){
  const c = decryptedState.clients[name]; const op = c.ledger.find(x=>x.id===opId);
  if(!op) return;
  const newDesc = prompt('وصف العملية:', op.desc||'') ?? op.desc;
  const newAmount = Number(prompt('المبلغ:', op.amount) ?? op.amount);
  const newDate = prompt('التاريخ (YYYY-MM-DD):', op.date||today()) ?? op.date;
  if(!(newAmount>0)) return alert('المبلغ غير صالح');
  op.desc=newDesc; op.amount=newAmount; op.date=newDate;
  await saveEncrypted(); renderClients(); renderStatement(name); renderSummary();
}
async function deleteOp(name, opId){
  if(!confirm('حذف العملية؟')) return;
  const c = decryptedState.clients[name]; c.ledger = c.ledger.filter(x=>x.id!==opId);
  await saveEncrypted(); renderClients(); renderStatement(name); renderSummary();
}

// render all
function renderAll(){ syncClientSelects(); renderClients(); renderExpenses(); renderSummary(); }
window.openStatement = openStatement;
window.deleteClient  = deleteClient;
window.quickInvoice  = quickInvoice;
window.quickPayment  = quickPayment;
window.deleteExpense = deleteExpense;
window.editOp = editOp;
window.deleteOp = deleteOp;
