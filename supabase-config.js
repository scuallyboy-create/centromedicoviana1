// VIANA I — CONFIGURAÇÃO SUPABASE
// Cole aqui apenas a Project URL e a Publishable/Anon Key do seu projeto.
// NUNCA coloque service_role no navegador.
window.SUPABASE_CONFIG = {
  url: 'https://centromedicoviana1.vercel.app/',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvcHVkdHN2YmFmam9qeXJqc3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzAyOTgsImV4cCI6MjEwNDcwNjI5OH0.p4Lq72QzvhwtADdyifHuiYfOByy-i_e8ihj-UDlDKJU'
};

window.VIANA_SUPABASE_READY = function(){
  const c = window.SUPABASE_CONFIG || {};
  return !!(c.url && c.anonKey &&
    /^https:\/\/[^\s]+\.supabase\.co$/.test(c.url) &&
    !c.url.includes('COLOQUE_AQUI') && !c.anonKey.includes('COLOQUE_AQUI'));
};
