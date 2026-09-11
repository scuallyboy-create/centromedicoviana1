const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const hasSupabase = !!(window.SUPABASE_CONFIG &&
  window.SUPABASE_CONFIG.url &&
  !window.SUPABASE_CONFIG.url.includes('COLOQUE_AQUI') &&
  window.SUPABASE_CONFIG.anonKey &&
  !window.SUPABASE_CONFIG.anonKey.includes('COLOQUE_AQUI') &&
  window.supabase);

const sb = hasSupabase ? window.supabase.createClient(
  window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey
) : null;

const header=$('#header'), nav=$('.nav'), menu=$('.menu-toggle'), modal=$('#profileModal');
if(menu) menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',open)});
$$('.nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
window.addEventListener('scroll',()=>header?.classList.toggle('scrolled',scrollY>40),{passive:true});

const observer=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -40px'});
$$('.reveal,.reveal-group').forEach(el=>observer.observe(el));

let members=[], schedules=[];
const categories=[
 {key:'Direcção',label:'Direcção',description:'Responsáveis pela orientação administrativa, clínica e de enfermagem da instituição.'},
 {key:'Médicos',label:'Médicos',description:'Profissionais médicos e especialistas que integram a unidade.'},
 {key:'Enfermagem',label:'Enfermagem',description:'Enfermeiros e auxiliares que integram a equipa de cuidados.'},
 {key:'Técnicos de Saúde',label:'Técnicos de Saúde',description:'Profissionais das áreas técnicas, diagnóstico, farmácia e apoio clínico.'},
 {key:'Administrativo e Apoio',label:'Administrativo e Apoio',description:'Administração, secretaria, serviços gerais e apoio à instituição.'},
 {key:'Outros Profissionais',label:'Outros Profissionais',description:'Outras categorias profissionais da unidade.'}
];
let activeCategory='all', currentPage=1; const pageSize=24;
const allCategory={key:'all',label:'Toda a equipa',description:'Consulte todos os profissionais da unidade num único directório.'};

async function loadPublicData(){
  if(sb){
    const {data,error}=await sb.from('employees').select('*').eq('public_visible',true).order('name');
    if(!error && data?.length){
      members=data.map(p=>({id:p.id,name:p.name,category:p.category,role:p.role_title,function:p.function_title,photo:p.photo,bio:p.bio,status:p.status}));
      const {data:sc}=await sb.from('schedules').select('employee_id,work_date,start_time,end_time,status,note').order('work_date');
      schedules=sc||[];
      return;
    }
  }
  members=(window.teamMembers||[]).filter(p=>p.status==='ready');
}

function initials(name){return (name||'VI').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function categoryCount(k){return members.filter(p=>p.category===k).length}
function renderCategories(){
  const box=$('#teamCategories'); if(!box)return;
  box.innerHTML=[allCategory,...categories].map((c,i)=>`<button class="team-category ${i===0?'active':''}" type="button" data-category="${esc(c.key)}"><span class="cat-index">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(c.label)}</strong><small>${c.key==='all'?members.length:categoryCount(c.key)} ${((c.key==='all'?members.length:categoryCount(c.key))===1)?'profissional':'profissionais'}</small></span><b>→</b></button>`).join('');
  $$('.team-category',box).forEach(b=>b.addEventListener('click',()=>selectCategory(b.dataset.category)));
}
function selectCategory(key){
  activeCategory=key;currentPage=1;
  const c=key==='all'?allCategory:(categories.find(x=>x.key===key)||allCategory);
  $$('.team-category').forEach(b=>b.classList.toggle('active',b.dataset.category===key));
  $('#teamTitle').textContent=c.label;$('#teamDescription').textContent=c.description;renderDirectory();
}
function filteredMembers(){
  const q=($('#teamSearch')?.value||'').trim().toLocaleLowerCase('pt');
  let list=members.filter(p=>activeCategory==='all'||p.category===activeCategory);
  if(q)list=list.filter(p=>[p.name,p.role,p.function,p.category].filter(Boolean).join(' ').toLocaleLowerCase('pt').includes(q));
  const sort=$('#teamSort')?.value;
  if(sort==='name-desc')list.sort((a,b)=>b.name.localeCompare(a.name,'pt'));
  else if(sort==='category')list.sort((a,b)=>(a.category||'').localeCompare(b.category||'','pt')||a.name.localeCompare(b.name,'pt'));
  else list.sort((a,b)=>a.name.localeCompare(b.name,'pt'));
  return list;
}
function availabilityFor(id){
  const today=new Date().toISOString().slice(0,10);
  const rows=schedules.filter(x=>x.employee_id===id&&x.work_date===today);
  if(!rows.length)return {label:'Disponibilidade não publicada',class:'neutral'};
  const r=rows[0];
  if(r.status==='off')return {label:'Folga hoje',class:'off'};
  if(r.status==='absent'||r.status==='leave')return {label:'Ausente hoje',class:'absent'};
  const now=new Date(), hh=now.getHours()*60+now.getMinutes();
  if(r.start_time&&r.end_time){
    const [sh,sm]=r.start_time.slice(0,5).split(':').map(Number), [eh,em]=r.end_time.slice(0,5).split(':').map(Number);
    const start=sh*60+sm,end=eh*60+em;
    if(hh>=start&&hh<=end)return {label:`Em serviço · ${r.start_time.slice(0,5)}–${r.end_time.slice(0,5)}`,class:'on'};
  }
  return {label:`Escala · ${r.start_time?.slice(0,5)||'—'}–${r.end_time?.slice(0,5)||'—'}`,class:'scheduled'};
}
function renderDirectory(){
  const list=filteredMembers(), pages=Math.max(1,Math.ceil(list.length/pageSize));
  currentPage=Math.min(currentPage,pages); const start=(currentPage-1)*pageSize, page=list.slice(start,start+pageSize);
  $('#teamCount').textContent=String(list.length).padStart(2,'0');
  $('#teamResultsLabel').textContent=list.length?`A apresentar ${start+1}–${Math.min(start+pageSize,list.length)} de ${list.length} profissionais`:'Nenhum profissional corresponde aos filtros seleccionados.';
  $('#teamGrid').innerHTML=page.length?page.map((p,i)=>{
    const a=availabilityFor(p.id);
    const portrait=p.photo?`<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">`:`<div class="portrait-placeholder"><span>${initials(p.name)}</span><small>Fotografia a disponibilizar</small></div>`;
    return `<article class="director-card team-person-card reveal is-visible"><div class="portrait">${portrait}<div class="portrait-shade"></div><span class="number">${String(start+i+1).padStart(2,'0')}</span><span class="category-chip">${esc(p.category||'Profissional')}</span></div><div class="director-info"><div><h3>${esc(p.name)}</h3><p>${esc(p.role||p.category||'Profissional de saúde')}</p><span class="availability ${a.class}"><i></i>${esc(a.label)}</span></div><button class="more-btn" type="button" data-open-profile="${esc(p.id)}">Ver perfil <span>↗</span></button></div></article>`;
  }).join(''):`<div class="team-empty reveal is-visible"><span>⌕</span><strong>Nenhum profissional encontrado</strong><p>Tente pesquisar por outro nome, função ou categoria.</p></div>`;
  $$('[data-open-profile]','#teamGrid').forEach(b=>b.addEventListener('click',()=>openProfile(b.dataset.openProfile)));
  renderPagination(pages);
}
function renderPagination(pages){
  const box=$('#teamPagination');if(pages<=1){box.innerHTML='';return}
  let h=`<button class="page-arrow" data-page="${Math.max(1,currentPage-1)}" ${currentPage===1?'disabled':''}>← <span>Anterior</span></button>`;
  for(let i=1;i<=pages;i++) if(pages<=7||i===1||i===pages||Math.abs(i-currentPage)<=1) h+=`<button class="page-number ${i===currentPage?'active':''}" data-page="${i}">${String(i).padStart(2,'0')}</button>`; else if(i===2||i===pages-1)h+=`<span class="page-gap">…</span>`;
  h+=`<button class="page-arrow" data-page="${Math.min(pages,currentPage+1)}" ${currentPage===pages?'disabled':''}><span>Seguinte</span> →</button><span class="page-status">Página <strong>${currentPage}</strong> de <strong>${pages}</strong></span>`;
  box.innerHTML=h;$$('[data-page]',box).forEach(b=>b.addEventListener('click',()=>{if(b.disabled)return;currentPage=+b.dataset.page;renderDirectory();scrollTo({top:$('#equipa').offsetTop-70,behavior:'smooth'})}));
}
function openProfile(id){
  const p=members.find(x=>x.id===id);if(!p)return;const a=availabilityFor(id);
  $('#modalPhoto').src=p.photo||'';
  $('#modalPhoto').alt=p.name;$('#modalName').textContent=p.name;$('#modalRole').textContent=p.role||p.category;$('#modalCategory').textContent=p.category||'—';$('#modalFunction').textContent=p.function||'A completar';$('#modalBio').textContent=p.bio||'Perfil profissional a completar com os dados oficiais da instituição.';$('#modalAvailability').textContent=a.label;
  $('#modalProfileLink').href=`employee.html?id=${encodeURIComponent(p.id)}`;
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('no-scroll');
}
function closeProfile(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('no-scroll')}
$$('[data-close]',modal).forEach(x=>x.addEventListener('click',closeProfile));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeProfile()});
$('#teamSearch')?.addEventListener('input',()=>{currentPage=1;renderDirectory()});
$('#teamSort')?.addEventListener('change',()=>{currentPage=1;renderDirectory()});
$('#teamClear')?.addEventListener('click',()=>{$('#teamSearch').value='';$('#teamSort').value='name-asc';selectCategory('all')});

$$('[data-feedback-type]').forEach(b=>b.addEventListener('click',()=>{const s=$('#feedback-form select');s.value=b.dataset.feedbackType;$$('[data-feedback-type]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');$('#feedback').scrollIntoView({behavior:'smooth'});setTimeout(()=>$('#feedback-form textarea').focus(),450)}));
$('#feedback-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const success=$('#feedback-success');const btn=f.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='A enviar…';
  try{
    const d=Object.fromEntries(new FormData(f).entries());if(d.website)throw new Error('spam');
    if(!sb)throw new Error('Supabase não configurado');
    const {error}=await sb.from('feedback').insert({type:d.type,first_name:d.first_name,last_name:d.last_name,email:d.email,phone:d.phone,message:d.message});
    if(error)throw error;success.className='feedback-success show success';success.textContent='Mensagem enviada com sucesso. Obrigado pela sua participação.';f.reset();
  }catch(err){success.className='feedback-success show error';success.textContent='Não foi possível concluir o envio neste momento. Tente novamente mais tarde.'}
  finally{btn.disabled=false;btn.innerHTML='Enviar mensagem <span>→</span>'}
});

(async()=>{await loadPublicData();renderCategories();renderDirectory();$('#year').textContent=new Date().getFullYear();})();
