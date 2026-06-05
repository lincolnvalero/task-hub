/**
 * Task-Hub — Corrigir Status das Tarefas Importadas do Trello
 *
 * Situação: as 62 tarefas importadas estão todas como BACKLOG.
 * As tarefas de campanhas de 2025 (concluídas) devem ser CONCLUIDO.
 * A campanha "Rotina de Postagens" (recorrente) permanece BACKLOG.
 *
 * Uso:
 * 1. Acesse https://task-hub-tan.vercel.app e faça login como ADMIN
 * 2. Abra DevTools → Console (F12)
 * 3. Cole TODO o conteúdo deste arquivo e pressione Enter
 */
(async () => {
  'use strict';

  const TOKEN = localStorage.getItem('taskhub_token');
  if (!TOKEN) { alert('❌ Faça login como admin primeiro!'); return; }
  const BASE = window.location.origin;
  let calls = 0;

  async function api(method, path, body) {
    calls++;
    // Pausa a cada 60 chamadas para evitar rate-limit (100/min)
    if (calls > 1 && calls % 60 === 0) {
      console.log('⏳ Pausa anti-rate-limit (5s)...');
      await new Promise(r => setTimeout(r, 5000));
    }
    const headers = { 'Authorization': 'Bearer ' + TOKEN };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(BASE + path, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (res.status === 204) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  }

  console.log('🔍 Buscando campanhas...');
  const campanhas = await api('GET', '/campaigns');
  if (!campanhas || !Array.isArray(campanhas)) {
    console.error('❌ Não foi possível buscar campanhas:', campanhas);
    return;
  }

  // Campanhas que NÃO devem ter status alterado (recorrentes/ativas)
  const CAMPANHAS_ATIVAS = ['rotina', 'postagens', 'recorrente', 'permanente'];

  const campanhasConcluidas = campanhas.filter(c => {
    const nome = (c.nome || '').toLowerCase();
    return !CAMPANHAS_ATIVAS.some(p => nome.includes(p));
  });

  const campanhasAtivas = campanhas.filter(c => {
    const nome = (c.nome || '').toLowerCase();
    return CAMPANHAS_ATIVAS.some(p => nome.includes(p));
  });

  console.log(`📋 Total de campanhas: ${campanhas.length}`);
  console.log(`✅ Campanhas a marcar como CONCLUIDO: ${campanhasConcluidas.map(c => c.nome).join(', ')}`);
  console.log(`🔄 Campanhas que ficam BACKLOG: ${campanhasAtivas.map(c => c.nome).join(', ')}`);

  if (campanhasConcluidas.length === 0) {
    console.warn('⚠️ Nenhuma campanha identificada para conclusão.');
    console.log('Campanhas encontradas:', campanhas.map(c => `"${c.nome}"`).join(', '));
    console.log('Ajuste o array CAMPANHAS_ATIVAS se necessário e rode de novo.');
    return;
  }

  let totalAtualizado = 0;
  let totalErros = 0;

  for (const campanha of campanhasConcluidas) {
    console.log(`\n📁 Processando campanha: "${campanha.nome}" (${campanha.id})`);

    // Busca tarefas da campanha
    const resp = await api('GET', `/campaigns/${campanha.id}`);
    const tarefas = resp?.tasks ?? resp?.tarefas ?? [];

    if (!Array.isArray(tarefas) || tarefas.length === 0) {
      // Tenta buscar via query de tarefas filtradas por campaign_id
      const allTasks = await api('GET', `/tasks?limit=500`);
      const tarefasDaCampanha = Array.isArray(allTasks)
        ? allTasks.filter(t => t.campaign_id === campanha.id && t.status_atual !== 'CONCLUIDO')
        : [];

      if (tarefasDaCampanha.length === 0) {
        console.log(`  ℹ️  Sem tarefas pendentes encontradas.`);
        continue;
      }

      for (const tarefa of tarefasDaCampanha) {
        const r = await api('PATCH', `/tasks/${tarefa.id}/status`, { status: 'CONCLUIDO' });
        if (r && !r.error) {
          totalAtualizado++;
          process.stdout?.write?.('.');
        } else {
          totalErros++;
          console.warn(`  ⚠️  Erro ao atualizar tarefa ${tarefa.id}:`, r);
        }
        // Pequena pausa a cada 15 tarefas
        if ((totalAtualizado + totalErros) % 15 === 0) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    } else {
      const pendentes = tarefas.filter(t => t.status_atual !== 'CONCLUIDO');
      console.log(`  📝 ${pendentes.length} tarefas para atualizar (${tarefas.length} total)`);

      for (const tarefa of pendentes) {
        const r = await api('PATCH', `/tasks/${tarefa.id}/status`, { status: 'CONCLUIDO' });
        if (r && !r.error) {
          totalAtualizado++;
          process.stdout?.write?.('.');
        } else {
          totalErros++;
          console.warn(`  ⚠️  Erro ao atualizar tarefa ${tarefa.id}:`, r);
        }
        if ((totalAtualizado + totalErros) % 15 === 0) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
  }

  console.log(`\n✅ Concluído!`);
  console.log(`  Tarefas marcadas como CONCLUIDO: ${totalAtualizado}`);
  console.log(`  Erros: ${totalErros}`);
  console.log(`\n💡 Recarregue o dashboard para ver os novos números.`);
  console.log(`   A eficiência agora deve subir para ~${Math.round((totalAtualizado / 62) * 100)}%`);
})();
