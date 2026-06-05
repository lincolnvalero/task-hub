/**
 * Task-Hub — Importação Trello no Console do Navegador
 *
 * 1. Acesse https://task-hub-tan.vercel.app e faça login como ADMIN
 * 2. Abra DevTools → Console (F12)
 * 3. Cole TODO o conteúdo deste arquivo e pressione Enter
 */
(async () => {
  'use strict';

  // ── Setup ─────────────────────────────────────────────────────────────────
  const TOKEN = localStorage.getItem('taskhub_token');
  if (!TOKEN) { alert('❌ Faça login como admin primeiro!'); return; }
  const BASE = window.location.origin;
  let calls = 0;

  async function api(method, path, body) {
    calls++;
    if (calls > 0 && calls % 60 === 0) {
      console.log('⏳ Pausa para evitar rate-limit (5s)...');
      await new Promise(r => setTimeout(r, 5000));
    }
    const headers = { 'Authorization': 'Bearer ' + TOKEN };
    if (body) headers['Content-Type'] = 'application/json'; // só quando há body
    const res = await fetch(BASE + path, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (res.status === 204) return null;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(method + ' ' + path + ' → ' + res.status + ': ' + JSON.stringify(json));
    return json;
  }

  console.log('\n🚀  Task-Hub — Importação Trello: Conexão Promessa');
  console.log('='.repeat(55));

  // ── 1. Verificar time disponível ──────────────────────────────────────────
  const teams = await api('GET', '/teams');
  if (!Array.isArray(teams) || !teams.length) {
    alert('❌ Nenhum time encontrado!\nCrie ao menos 1 time no Task-Hub antes de importar.');
    return;
  }
  const TEAM = teams[0].id;
  console.log('✅ Time usado: "' + teams[0].nome + '" (ID: ' + TEAM + ')');

  // ── 2. Deletar dados de teste ─────────────────────────────────────────────
  console.log('\n🗑️  Deletando dados de teste...');
  const [camps, tasks0] = await Promise.all([api('GET', '/campaigns'), api('GET', '/tasks')]);
  for (const c of camps || []) await api('DELETE', '/campaigns/' + c.id);
  for (const t of tasks0 || []) await api('DELETE', '/tasks/' + t.id);
  console.log('   → ' + (camps || []).length + ' campanhas e ' + (tasks0 || []).length + ' tarefas removidas');

  // ── 3. Criar campanhas ─────────────────────────────────────────────────────
  console.log('\n📁  Criando 5 campanhas...');
  const defs = [
    ['conf','Conferência de Missões','A Dimensão da Missão — 17 e 18 de maio de 2025. Palestras, podcasts, entrevistas e thumbnails.','#E8743B','2025-05-17','Promessa Santo Amaro — SP'],
    ['vig','Vigília e Campanha de Missões','Vigília 30/8 e Campanha de Missões 06/09 — Missão Global: Começa em nós, alcança o mundo.','#E74C3C','2025-08-30','IAP Santo Amaro'],
    ['mul','Encontro de Líderes — Ministério de Mulheres','Encontro especial para líderes — 13/09/2025 às 15h. Local: Promessa Santa Emília.','#9B59B6','2025-09-13','Promessa Santa Emília'],
    ['jov','Dia do Jovem Promessista','Culto especial da juventude — Conectados no Evangelho, Convictos na Missão. 20/09/2025 às 17h.','#27AE60','2025-09-20','Promessa Santo Amaro'],
    ['ws','Workshop de Mídia 2025','Comunicação que impulsiona a missão — 08/11/2025 às 15h. Realização: Ministério de Comunicação, TV Viva Promessa e Movimento Radiação.','#2980B9','2025-11-08','Promessa Santo Amaro'],
  ];
  const ID = {};
  for (const [k, nome, descricao, cor, data_evento, local] of defs) {
    const r = await api('POST', '/campaigns', { nome, descricao, cor, data_evento, local });
    ID[k] = r.id;
    console.log('   ✓ ' + nome);
  }

  // ── 4. Definir tarefas ─────────────────────────────────────────────────────
  // Formato: [camp, titulo, prioridade, canal, tipo_tarefa, data_fim?]
  const raw = [
    // ── Conferência de Missões ──────────────────────────────────────────────
    ['conf','Thumbnails YouTube | Conferência "A Dimensão da Missão"','ALTA','YOUTUBE','Thumbnail','2025-08-31'],
    ['conf','YOUTUBE VÍDEO 1 | A Dimensão da Missão em Meio à Cultura Relativista — Pr. Renato Camargo','ALTA','YOUTUBE','Vídeo YouTube','2025-08-09'],
    ['conf','INSTAGRAM ENTREVISTA: 1 Palestra — A Dimensão da Missão — Pr. Renato Camargo','ALTA','INSTAGRAM','Entrevista Instagram','2025-08-09'],
    ['conf','YOUTUBE VÍDEO 2 | Os Dons na Missão — Pr. Ricardo Costa','ALTA','YOUTUBE','Vídeo YouTube','2025-08-16'],
    ['conf','INSTAGRAM ENTREVISTA: 2 – Os Dons na Missão — Pr. Ricardo Costa','MEDIA','INSTAGRAM','Entrevista Instagram','2025-08-16'],
    ['conf','INSTAGRAM ENTREVISTA: 2 – Os Dons na Missão — Kaciany Dourado','MEDIA','INSTAGRAM','Entrevista Instagram','2025-08-19'],
    ['conf','YOUTUBE VÍDEO 3 | Podcast: Igreja — Um Lugar de Encontro de Gerações','ALTA','YOUTUBE','Vídeo YouTube','2025-08-23'],
    ['conf','INSTAGRAM ENTREVISTA: 3 – Encontro de Gerações — Pr. Ton Dias','MEDIA','INSTAGRAM','Entrevista Instagram','2025-08-23'],
    ['conf','INSTAGRAM ENTREVISTA: 3 – Encontro de Gerações — Pr. Cícero Alves','MEDIA','INSTAGRAM','Entrevista Instagram','2025-08-24'],
    ['conf','INSTAGRAM ENTREVISTA: 3 – Encontro de Gerações — Rafael Souza','MEDIA','INSTAGRAM','Entrevista Instagram','2025-08-27'],
    ['conf','INSTAGRAM ENTREVISTA: 3 – Encontro de Gerações — Robson Nogueira','MEDIA','INSTAGRAM','Entrevista Instagram','2025-08-28'],
    ['conf','YOUTUBE VÍDEO 4 | Mensagem: Igreja Viva e Suas Marcas — Pr. Fabiano Santana','ALTA','YOUTUBE','Vídeo YouTube','2025-08-31'],
    ['conf','INSTAGRAM ENTREVISTA: 4 – Igreja Viva e Suas Marcas — Pr. Fabiano Santana','MEDIA','INSTAGRAM','Entrevista Instagram','2025-08-31'],
    ['conf','YOUTUBE VÍDEO 5 | Podcast: A Igreja Servindo a Cidade','ALTA','YOUTUBE','Vídeo YouTube','2025-09-06'],
    ['conf','INSTAGRAM ENTREVISTA: 5 – Ideologia de Gênero e a Missão — Dsa. Elza Satiko','MEDIA','INSTAGRAM','Entrevista Instagram','2025-09-06'],
    ['conf','INSTAGRAM ENTREVISTA: 5 – Ideologia de Gênero e a Missão — Daysa Hilario','MEDIA','INSTAGRAM','Entrevista Instagram','2025-09-07'],
    ['conf','INSTAGRAM ENTREVISTA: 6 – A Igreja Servindo a Cidade — Pb. Ismael Aguiar','MEDIA','INSTAGRAM','Entrevista Instagram','2025-09-09'],
    ['conf','INSTAGRAM ENTREVISTA: 6 – A Igreja Servindo a Cidade — Ricardo Petenuci','MEDIA','INSTAGRAM','Entrevista Instagram','2025-09-10'],
    ['conf','YOUTUBE VÍDEO 7 | Influenciando na Universidade — Pr. Beto Soares','ALTA','YOUTUBE','Vídeo YouTube','2025-09-13'],
    ['conf','INSTAGRAM ENTREVISTA: 7 – Influenciando na Universidade — Pr. Beto Soares','MEDIA','INSTAGRAM','Entrevista Instagram','2025-09-13'],
    ['conf','INSTAGRAM ENTREVISTA: 8 – Assuntos Diversos — Carlos Daniel e Nubia Nascimento','MEDIA','INSTAGRAM','Entrevista Instagram','2025-09-15'],
    ['conf','INSTAGRAM ENTREVISTA: 8 – Assuntos Diversos — Ester Adrieli e Marcia Aparecida','MEDIA','INSTAGRAM','Entrevista Instagram','2025-09-16'],
    ['conf','INSTAGRAM ENTREVISTA: 8 – Assuntos Diversos — Cantora Mari Rocha','MEDIA','INSTAGRAM','Entrevista Instagram','2025-09-18'],
    ['conf','INSTAGRAM: Vídeo Melhores Momentos da Conferência de Missões','ALTA','INSTAGRAM','Vídeo Instagram','2025-09-19'],
    ['conf','Post 8 — Carrossel: Como funciona a Campanha de Missões?','MEDIA','INSTAGRAM','Carrossel','2025-09-01'],
    // ── Vigília e Campanha de Missões ───────────────────────────────────────
    ['vig','Post 1 — Save The Date (Vigília de Missões)','ALTA','INSTAGRAM','Estático','2025-07-29'],
    ['vig','Post 2 — Estático: Aqueça seu coração para a missão!','ALTA','INSTAGRAM','Estático','2025-08-06'],
    ['vig','Post 3 — Missão Global: Começa em nós, alcança o mundo!','ALTA','INSTAGRAM','Estático','2025-08-11'],
    ['vig','Post 4 — Estático: "Ide por todo o mundo e pregai o evangelho" (Mc 16:15)','MEDIA','INSTAGRAM','Estático','2025-08-13'],
    ['vig','Post 6 — Estático: Doe com propósito','MEDIA','INSTAGRAM','Estático','2025-08-25'],
    ['vig','Post 7 — Estático: É AMANHÃ — Vigília de Missões','ALTA','INSTAGRAM','Estático','2025-08-29'],
    ['vig','Post 9 — Estático: A missão continua','MEDIA','INSTAGRAM','Estático','2025-09-08'],
    ['vig','VÍDEO DA VIGÍLIA DE MISSÕES','ALTA','INSTAGRAM','Vídeo','2025-08-15'],
    ['vig','VÍDEO CAMPANHA DE MISSÕES','ALTA','INSTAGRAM','Vídeo','2025-08-20'],
    ['vig','Artes da Campanha — Missão Global 2025','ALTA','INSTAGRAM','Arte',null],
    ['vig','Vídeo: Melhores momentos da vigília','MEDIA','INSTAGRAM','Vídeo',null],
    ['vig','Vídeo: Painel Missão Global','MEDIA','YOUTUBE','Vídeo',null],
    ['vig','Vídeo: Trecho da pregação do Pr. Ademilson','MEDIA','INSTAGRAM','Vídeo',null],
    ['vig','Vídeo: Entrevista com Pr. Ademilson','MEDIA','INSTAGRAM','Entrevista Instagram',null],
    ['vig','Vídeo: Campanha de Missões (versão curta para redes)','MEDIA','INSTAGRAM','Vídeo',null],
    ['vig','Vídeo: Entrevistas com Melita','MEDIA','INSTAGRAM','Entrevista Instagram',null],
    ['vig','Vídeo: Entrevistas com Origem','MEDIA','INSTAGRAM','Entrevista Instagram',null],
    ['vig','Vídeo: Meme da mídia (Lincoln Orando)','BAIXA','INSTAGRAM','Vídeo',null],
    // ── Encontro de Líderes — Ministério de Mulheres ────────────────────────
    ['mul','Arte Save The Date — Encontro de Líderes Ministério de Mulheres 13/09','ALTA','INSTAGRAM','Estático','2025-07-29'],
    ['mul','Conheça quem vai te inspirar! — Artes das palestrantes','ALTA','INSTAGRAM','Estático','2025-08-20'],
    ['mul','EU VOU! E você? — Encontro de Líderes','MEDIA','INSTAGRAM','Estático','2025-09-01'],
    ['mul','Faltam 30 dias! — Contagem regressiva para o Encontro de Líderes','MEDIA','INSTAGRAM','Estático','2025-08-13'],
    ['mul','Chegou o grande dia! — Que esse seja um dia de comunhão, aprendizado e propósito!','ALTA','INSTAGRAM','Estático','2025-09-13'],
    ['mul','Carrossel — Encontro de Líderes (cobertura fotográfica)','ALTA','INSTAGRAM','Carrossel',null],
    // ── Dia do Jovem Promessista ─────────────────────────────────────────────
    ['jov','POST 1 — Vídeo: Save The Date — Dia do Jovem Promessista','ALTA','INSTAGRAM','Vídeo','2025-08-08'],
    ['jov','POST 2 — Carrossel: Dia do Jovem Promessista ("Conectados no Evangelho")','ALTA','INSTAGRAM','Carrossel','2025-08-21'],
    ['jov','POST 3 — Estático: Não somos o futuro da Igreja. Somos o agora!','MEDIA','INSTAGRAM','Estático','2025-09-03'],
    ['jov','POST 4 — Reels: Chamadas dos Jovens','ALTA','INSTAGRAM','Reels','2025-09-15'],
    ['jov','POST E STORIES — É hoje + É amanhã — Dia do Jovem Promessista','ALTA','INSTAGRAM','Stories',null],
    // ── Workshop de Mídia 2025 ───────────────────────────────────────────────
    ['ws','Estático: Save the Date — Workshop de Mídia 2025','ALTA','INSTAGRAM','Estático','2025-10-13'],
    ['ws','ESTÁTICO: "INSCRIÇÕES ABERTAS" — Workshop de Mídia 2025','ALTA','INSTAGRAM','Estático','2025-10-28'],
    ['ws','Carrossel: Apresentando os temas e convidados confirmados (Radiação, TV Viva...)','ALTA','INSTAGRAM','Carrossel','2025-10-30'],
    ['ws','Vídeo: "É dia 08 de novembro – Workshop de Mídia" (chamada de divulgação)','ALTA','YOUTUBE','Vídeo','2025-11-01'],
    ['ws','CREDENCIAL (CRACHÁ) — Workshop de Mídia 2025','MEDIA','OUTRO','Arte','2025-10-28'],
    ['ws','CERTIFICADO DE PARTICIPAÇÃO — Workshop de Mídia 2025','MEDIA','OUTRO','Arte','2025-10-28'],
    ['ws','Arte "É hoje!" — Dia do Workshop de Mídia (feed + story)','ALTA','INSTAGRAM','Estático','2025-11-08'],
    ['ws','Inscrições encerradas — Post de encerramento das inscrições','MEDIA','INSTAGRAM','Estático','2025-11-06'],
  ];

  // ── 5. Criar tarefas ──────────────────────────────────────────────────────
  console.log('\n📋  Criando ' + raw.length + ' tarefas...');
  let ok = 0, fail = 0;
  for (let i = 0; i < raw.length; i++) {
    const [camp, titulo, prioridade, canal, tipo_tarefa, data_fim_planejado] = raw[i];
    const body = { titulo, prioridade, canal, tipo_tarefa, campaign_id: ID[camp], team_ids: [TEAM], user_ids: [] };
    if (data_fim_planejado) body.data_fim_planejado = data_fim_planejado;
    try {
      await api('POST', '/tasks', body);
      ok++;
    } catch(e) {
      console.warn('   ⚠️ Falha: "' + titulo.slice(0, 50) + '": ' + e.message);
      fail++;
    }
    if ((i + 1) % 15 === 0) {
      console.log('   ' + (i + 1) + '/' + raw.length + ' criadas...');
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // ── 6. Resultado ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(55));
  console.log('✅  Importação concluída!');
  console.log('   ' + ok + ' tarefas criadas' + (fail ? ', ' + fail + ' falhas' : '') + ' em 5 campanhas.');
  const cnt = {};
  for (const [k] of raw) cnt[k] = (cnt[k] || 0) + 1;
  const nm = { conf:'Conferência de Missões', vig:'Vigília e Campanha', mul:'Encontro Líderes — Mulheres', jov:'Dia do Jovem Promessista', ws:'Workshop de Mídia 2025' };
  for (const [k, n] of Object.entries(cnt)) console.log('   ' + nm[k].padEnd(36) + n + ' tarefas');
  console.log('\n💡 Nota: todas as tarefas foram criadas com status BACKLOG.');
  console.log('   Acesse Campanhas no Task-Hub para visualizar.\n');
})();
