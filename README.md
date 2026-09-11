# Viana I / Ana Paula — Supabase V1

Esta versão transforma o projecto estático numa primeira base real para o sistema institucional.

## O que foi acrescentado

- `index.html` — página pública com a identidade Viana I.
- `employee.html?id=001` — perfil público + QR + escala.
- `portal.html` — área autenticada do funcionário.
- `admin.html` — área administrativa.
- `supabase-config.js` — Project URL + publishable key.
- `supabase-schema.sql` — tabelas, funções e RLS.
- `script.js` — directório público com fallback para `team-data.js`.
- `style.css` — identidade visual baseada no projecto fornecido.
- `style-portal-extra.css` — componentes do portal.
- `team-data.js` — mantido como fallback/migração inicial.
- `fundo.jpg` — mantido.

## Configuração

1. Crie/abra o projecto no Supabase.
2. Abra `supabase-schema.sql` no SQL Editor e execute-o.
3. Em `supabase-config.js`, coloque:
   - Project URL
   - Publishable/anon key
4. Crie a primeira conta em Supabase Authentication.
5. Descubra o UUID dessa conta e execute:
   `update public.profiles set role='admin', active=true where id='UUID_DO_ADMIN';`
6. Migre os funcionários de `team-data.js` para `public.employees`.
7. Associe cada funcionário a uma conta em `public.profiles.employee_id`.
8. Publique no GitHub/Vercel.

## Migração dos 150 funcionários

O `team-data.js` continua no projecto para preservar os IDs e QR Codes.
A versão de produção deve migrar esses registos para `employees`.

Não apague nem altere IDs como `001`, `002`, etc.

## Segurança

Nunca coloque uma `service_role` key no frontend.
Os dados clínicos são protegidos por RLS e não são usados no site público.

## Estado do website

O administrador altera `site_settings.site_active` pelo `admin.html`.
Para a versão seguinte, o `site-status.js` deve consultar esse estado antes de renderizar o site público; a actual versão mantém fallback local para evitar bloquear o site antes da configuração do Supabase.

## Nota sobre fotos

O ZIP recebido contém `fundo.jpg` e `team-data.js`, mas não contém a pasta `assets/equipa/` referenciada pelos 150 funcionários. Ao publicar, coloque novamente essa pasta com as fotografias originais.
