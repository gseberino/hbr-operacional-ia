import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const port = 4298;
const dbPath = join(process.cwd(), 'data', 'e2e-test.sqlite');

for (const suffix of ['', '-wal', '-shm']) {
  const file = `${dbPath}${suffix}`;
  if (existsSync(file)) rmSync(file);
}

const server = spawn(process.execPath, ['src/server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), HBR_DB_PATH: dbPath },
  stdio: ['ignore', 'pipe', 'pipe']
});

async function stop() {
  if (!server.killed) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${dbPath}${suffix}`;
    if (existsSync(file)) rmSync(file);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`http://localhost:${port}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path}: ${response.status} ${text}`);
  return { response, data, text };
}

async function textRequest(path) {
  const response = await fetch(`http://localhost:${port}${path}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return text;
}

function cookieFrom(response) {
  return response.headers.get('set-cookie')?.split(';')[0] || '';
}

async function waitForServer() {
  for (let index = 0; index < 40; index += 1) {
    try {
      await request('/api/setup/status');
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error('Servidor E2E nao respondeu.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await waitForServer();

  await request('/api/setup', {
    method: 'POST',
    body: JSON.stringify({ name: 'E2E HBR', email: 'e2e@hbr.local', password: 'senha-e2e-123' })
  });

  const login = await request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'e2e@hbr.local', password: 'senha-e2e-123' })
  });
  const cookie = cookieFrom(login.response);

  const client = await request('/api/clients', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      name: 'Marcelo Marco Bertoldi',
      type: 'pessoa_fisica',
      phone: '+55 47 99999-0000',
      email: 'marcelo@example.com',
      document: '000.000.000-00',
      address: 'Marina teste, Itajai',
      notes: 'Cliente premium com demandas Victron/Garmin.'
    })
  });

  const asset = await request('/api/assets', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      name: 'Aria',
      type: 'embarcacao',
      manufacturer: 'Estaleiro Teste',
      model: 'Fly 55',
      year: '2024',
      size: '55 pes',
      current_location: 'Itajai',
      marina: 'Marina X',
      client_id: client.data.id,
      installed_systems: ['Garmin GPSMAP', 'Victron Cerbo GX'],
      technical_notes: 'Sistema NMEA2000 e energia integrada.'
    })
  });

  const project = await request('/api/projects', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      name: 'Retrofit Garmin/Victron - Aria',
      client_id: client.data.id,
      asset_id: asset.data.id,
      scope: 'Revisao de proposta, materiais e integracao.',
      status: 'triagem',
      priority: 'alta',
      responsible: 'HBR',
      expected_date: '2026-05-08',
      location: 'Marina X',
      checklist: ['Conferir materiais', 'Validar escopo'],
      materials: ['Garmin sonar', 'Cabos NMEA2000']
    })
  });

  const document = await request('/api/documents', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      name: 'Orcamento Aria v1',
      type: 'proposta',
      client_id: client.data.id,
      project_id: project.data.id,
      link: 'https://example.com/aria',
      origin: 'Google Drive',
      tags: ['orcamento', 'garmin'],
      notes: 'Documento de teste E2E.'
    })
  });

  const manualTask = await request('/api/tasks', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      title: 'Revisar proposta completa Aria',
      description: 'Validar escopo, materiais, prazo e estrategia comercial.',
      original_input: 'Teste manual E2E',
      category: 'proposta',
      subcategory: 'Garmin',
      status: 'a_fazer',
      priority: 'critica',
      due_date: '2026-05-08',
      responsible: 'HBR',
      client_id: client.data.id,
      asset_id: asset.data.id,
      project_id: project.data.id,
      location: 'Marina X',
      tags: ['E2E', 'prioridade'],
      origin_channel: 'manual',
      action_type: 'preparar_resposta',
      automation_level: 2,
      planned_date: '2026-05-08',
      estimated_minutes: 110,
      recurrence_rule: 'semanal',
      dependency_text: 'Conferencia comercial e aprovacao humana',
      blocker_reason: 'Impacto de fluxo de caixa se atrasar',
      operational_score: 98,
      time_spent_seconds: 0,
      timer_running: false,
      next_action: 'Conferir itens comerciais',
      expected_result: 'Proposta pronta para aprovacao.',
      checklist: ['Conferir escopo', 'Conferir valores'],
      subtasks: ['Abrir proposta', 'Revisar materiais'],
      attachments: ['foto-painel.jpg'],
      links: ['https://example.com/aria'],
      ai_can_execute: false,
      needs_approval: true,
      human_approved: false,
      ai_executed: false,
      action_risk: 'medio'
    })
  });

  const updatedTask = await request(`/api/tasks/${manualTask.data.id}`, {
    method: 'PUT',
    headers: { Cookie: cookie },
    body: JSON.stringify({ status: 'em_andamento', next_action: 'Finalizar conferencia tecnica' })
  });
  assert(updatedTask.data.status === 'em_andamento', 'Update de tarefa falhou.');
  assert(updatedTask.data.estimated_minutes === 110, 'Campo de esforco estimado nao persistiu.');
  assert(updatedTask.data.operational_score === 98, 'Score operacional nao persistiu.');
  assert(updatedTask.data.dependency_text.includes('Conferencia'), 'Dependencia nao persistiu.');

  const settingsBefore = await request('/api/settings', { headers: { Cookie: cookie } });
  assert(settingsBefore.data.score_step === 1, 'Passo padrao do score deveria ser 1.');
  const settingsAfter = await request('/api/settings', {
    method: 'PUT',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      ...settingsBefore.data,
      default_responsible: 'Equipe HBR',
      daily_capacity_minutes: 420,
      effort_step_minutes: 5,
      timer_check_minutes: 5,
      agent_idle_minutes: 20,
      agent_reminder_minutes: 30,
      score_step: 1,
      daily_goal_tasks: 5,
      daily_goal_minutes: 180,
      planning_periods: ['manha', 'tarde', 'noite'],
      responsibles: ['Equipe HBR', 'Tecnico Campo'],
      additional_categories: ['Garantia', 'Acompanhamento construtivo'],
      agent_enabled: true,
      agent_autonomous_internal_actions: true,
      agent_pattern_detection: true,
      integrations: { ...settingsBefore.data.integrations, calendar: 'preparando', gmail: 'planejada' }
    })
  });
  assert(settingsAfter.data.default_responsible === 'Equipe HBR', 'Configuracoes nao salvaram responsavel padrao.');
  assert(settingsAfter.data.daily_capacity_minutes === 420, 'Configuracoes nao salvaram capacidade diaria.');
  assert(settingsAfter.data.effort_step_minutes === 5, 'Configuracoes nao salvaram passo de esforco.');
  assert(settingsAfter.data.timer_check_minutes === 5, 'Configuracoes nao salvaram conferencia de timer.');
  assert(settingsAfter.data.agent_enabled === true, 'Configuracoes nao salvaram agente proativo.');
  assert(settingsAfter.data.agent_idle_minutes === 20, 'Configuracoes nao salvaram inatividade do agente.');
  assert(settingsAfter.data.daily_goal_tasks === 5, 'Configuracoes nao salvaram meta de tarefas.');
  assert(settingsAfter.data.planning_periods.includes('noite'), 'Configuracoes nao salvaram periodos do dia.');
  assert(settingsAfter.data.responsibles.includes('Tecnico Campo'), 'Configuracoes nao salvaram responsaveis.');
  assert(settingsAfter.data.integrations.calendar === 'preparando', 'Configuracoes nao salvaram integracao.');

  const savedView = await request('/api/saved-views', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      name: 'Prioridades propostas',
      scope: 'tasks',
      filters: { priority: 'alta', category: 'proposta', planning_view: 'semana' },
      layout: 'kanban'
    })
  });
  assert(savedView.data.filters.priority === 'alta', 'View salva nao persistiu filtros.');

  const templates = await request('/api/task-templates', { headers: { Cookie: cookie } });
  assert(templates.data.length >= 8, 'Templates HBR editaveis nao foram semeados.');
  const templateCreated = await request('/api/task-templates', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      key: 'teste_e2e',
      name: 'Teste E2E',
      description: 'Template criado pelo teste.',
      category: 'administrativo',
      priority: 'baixa',
      estimated_minutes: 15,
      checklist: ['Checar item'],
      subtasks: ['Executar teste'],
      enabled: true
    })
  });
  assert(templateCreated.data.key === 'teste_e2e', 'Criacao de template editavel falhou.');

  const customField = await request('/api/custom-fields', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      entity_type: 'tasks',
      key: 'risco_e2e',
      label: 'Risco E2E',
      type: 'select',
      options: ['baixo', 'alto'],
      required: false
    })
  });
  assert(customField.data.options.includes('alto'), 'Campo customizado nao persistiu opcoes.');

  const scoreDown = await request(`/api/tasks/${manualTask.data.id}`, {
    method: 'PUT',
    headers: { Cookie: cookie },
    body: JSON.stringify({ operational_score: updatedTask.data.operational_score - settingsAfter.data.score_step })
  });
  assert(scoreDown.data.operational_score === 97, 'Ajuste unitario do score falhou.');
  const effortUp = await request(`/api/tasks/${manualTask.data.id}`, {
    method: 'PUT',
    headers: { Cookie: cookie },
    body: JSON.stringify({ estimated_minutes: updatedTask.data.estimated_minutes + settingsAfter.data.effort_step_minutes })
  });
  assert(effortUp.data.estimated_minutes === 115, 'Ajuste de esforco falhou.');
  const timerStarted = await request(`/api/tasks/${manualTask.data.id}`, {
    method: 'PUT',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      status: 'em_andamento',
      timer_running: true,
      timer_started_at: new Date().toISOString(),
      last_timer_check_at: new Date().toISOString()
    })
  });
  assert(timerStarted.data.timer_running === true, 'Timer nao iniciou.');
  const timerPaused = await request(`/api/tasks/${manualTask.data.id}`, {
    method: 'PUT',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      timer_running: false,
      timer_started_at: '',
      time_spent_seconds: 60
    })
  });
  assert(timerPaused.data.timer_running === false && timerPaused.data.time_spent_seconds === 60, 'Timer nao pausou/persistiu.');
  const responsibleChange = await request(`/api/tasks/${manualTask.data.id}`, {
    method: 'PUT',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      responsible: 'Tecnico Campo',
      priority: 'alta',
      category: 'proposta',
      due_date: '2026-05-09',
      planned_period: 'manha',
      follow_up_at: '2026-05-09',
      blocker_type: 'cliente',
      confidence_score: 88,
      rank: 1
    })
  });
  assert(responsibleChange.data.responsible === 'Tecnico Campo', 'Responsavel nao persistiu na tarefa.');
  assert(responsibleChange.data.planned_period === 'manha', 'Periodo planejado nao persistiu.');
  assert(responsibleChange.data.follow_up_at === '2026-05-09', 'Follow-up nao persistiu.');

  const comment = await request('/api/comments', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ entity_type: 'tasks', entity_id: manualTask.data.id, content: 'Comentario interno E2E.' })
  });
  assert(comment.data.content.includes('E2E'), 'Comentario interno nao foi criado.');
  const dependency = await request('/api/task-dependencies', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      task_id: manualTask.data.id,
      depends_on_task_id: null,
      dependency_type: 'cliente',
      note: 'Depende de retorno do cliente.'
    })
  });
  assert(dependency.data.note.includes('cliente'), 'Dependencia real nao foi criada.');

  const sample = 'Temos orcamentos para enviar dia 08/05 pela manha. 2 deles para a embarcacao Aria, do cliente Marcelo Marco Bertoldi. da Madu do cliente Junior Rudec. Ainda para La Osadia, precisamos dar retorno para o Amarildo. OBS: segue: Nota fiscal devolucao Kamell, Celio Dondoka (prioridade, ja tem orcamentos prontos, amanha revisamos), Sandro Motorhome.';
  const interpreted = await request('/api/intake/interpret', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ text: sample })
  });
  assert(interpreted.data.tasks.length >= 6, 'Triagem em lote separou poucas demandas.');
  assert(interpreted.data.tasks.some((task) => task.title.includes('La Osadia') && task.description.includes('VHF')), 'Triagem perdeu contexto tecnico da La Osadia.');
  assert(interpreted.data.tasks.some((task) => task.title.includes('Nota fiscal') && task.category === 'financeiro'), 'Triagem nao classificou NF devolucao como financeiro.');
  assert(interpreted.data.tasks.some((task) => task.title.includes('Celio') || task.title.includes('Célio')), 'Triagem perdeu Celio Dondoka.');
  assert(interpreted.data.tasks.every((task) => Number(task.estimated_minutes) >= 15), 'Triagem nao estimou esforco.');
  assert(interpreted.data.tasks.every((task) => Number(task.operational_score) >= 0), 'Triagem nao gerou score operacional.');

  const batch = await request('/api/tasks/from-intake', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ tasks: interpreted.data.tasks.slice(0, 4).map((task) => ({ ...task, selected: true })) })
  });
  assert(batch.data.tasks.length === 4, 'Criacao em lote falhou.');

  const emailDraft = await request(`/api/tasks/${manualTask.data.id}/drafts`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ type: 'email' })
  });
  assert(emailDraft.data.content.includes('Proximos pontos'), 'Rascunho de e-mail ficou incompleto.');

  const whatsappDraft = await request(`/api/tasks/${manualTask.data.id}/drafts`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ type: 'whatsapp' })
  });
  await request(`/api/ai-actions/${emailDraft.data.id}/approve`, { method: 'POST', headers: { Cookie: cookie } });
  await request(`/api/ai-actions/${whatsappDraft.data.id}/reject`, { method: 'POST', headers: { Cookie: cookie } });

  const agentEmpty = await request('/api/agent/messages', { headers: { Cookie: cookie } });
  assert(Array.isArray(agentEmpty.data), 'Historico do chat IA nao retornou lista.');
  const agentVague = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'La Osadia' })
  });
  assert(agentVague.data.questions.length >= 1, 'Chat IA nao pediu contexto para entrada rasa.');
  assert(agentVague.data.questions[0].options[0].action_prompt.includes('La Osadia'), 'Botao de resposta perdeu o contexto original.');
  const agentCreate = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'Registre demanda: cliente Amarildo precisa receber retorno da proposta da La Osadia hoje com prioridade alta.' })
  });
  assert(agentCreate.data.tasks.length >= 1, 'Chat IA nao criou tarefa interna.');
  const agentCompound = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'Registre uma tarefa para revisar o checklist Garmin da embarcacao Teste IA e prepare um rascunho de WhatsApp para o cliente validar hoje.' })
  });
  assert(agentCompound.data.tasks.length >= 1, 'Chat IA nao executou criacao de tarefa em comando composto.');
  assert(agentCompound.data.drafts.length >= 1, 'Chat IA nao criou rascunho em comando composto.');
  const agentExistingDraft = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'Prepare um rascunho de WhatsApp para a tarefa Revisar proposta completa Aria explicando que vamos revisar o orçamento hoje.' })
  });
  assert(agentExistingDraft.data.message.includes('Criei um rascunho'), 'Chat IA deveria usar tarefa existente para rascunho, nao criar nova tarefa.');
  const agentPreview = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'Antes de agir, interprete: preciso revisar materiais Victron da Aria e confirmar prazo com Marcelo.' })
  });
  assert(agentPreview.data.message.includes('Antes de agir'), 'Chat IA nao entrou em modo preview quando solicitado.');
  assert(agentPreview.data.questions.length >= 1, 'Chat IA preview nao ofereceu opcoes de confirmacao.');
  const agentNoAction = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'Nao execute nada agora. Apenas mantenha essa interpretacao como referencia.' })
  });
  assert(agentNoAction.data.questions.length === 0 && agentNoAction.data.message.includes('Nao executei nenhuma acao'), 'Chat IA nao acatou a opcao de nao executar.');
  const agentSchedule = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'Reorganize as tarefas de hoje para caberem no tempo disponivel; some o esforco e reagende o excedente para os proximos dias.' })
  });
  assert(agentSchedule.data.message.includes('Reorganizei'), 'Chat IA nao reorganizou tarefas do dia.');
  assert(agentSchedule.data.message.includes('Esforco total estimado'), 'Chat IA nao explicou capacidade e esforco total.');
  assert(agentSchedule.data.updated_task_ids.length >= 1, 'Chat IA nao retornou tarefas atualizadas no planejamento.');
  const plannedTask = await request(`/api/tasks/${agentSchedule.data.updated_task_ids[0]}`, { headers: { Cookie: cookie } });
  assert(plannedTask.data.planned_date, 'Chat IA nao persistiu data planejada ao reorganizar.');
  const agentBlocked = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'Exclua todos os cadastros antigos agora.' })
  });
  assert(agentBlocked.data.message.includes('Nao vou executar exclusao'), 'Chat IA nao bloqueou acao sensivel.');
  const proactive = await request('/api/agent/proactive', { headers: { Cookie: cookie } });
  assert(Array.isArray(proactive.data.reminders), 'Proatividade IA nao retornou lembretes.');
  const automationRules = await request('/api/automation-rules', { headers: { Cookie: cookie } });
  assert(automationRules.data.length >= 6, 'Automacoes internas nao foram semeadas.');
  const automationRun = await request(`/api/automation-rules/${automationRules.data[0].id}/run`, {
    method: 'POST',
    headers: { Cookie: cookie }
  });
  assert(automationRun.data.summary, 'Automacao interna nao retornou resumo.');
  const automationRuns = await request('/api/automation-runs', { headers: { Cookie: cookie } });
  assert(automationRuns.data.length >= 1, 'Log de automacao nao foi registrado.');
  const agentAutomation = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'Execute as automacoes internas e registre os logs.' })
  });
  assert(agentAutomation.data.message.includes('automacao') || agentAutomation.data.message.includes('Automacao'), 'Chat IA nao executou automacoes internas.');
  const agentComment = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'Anote um comentario interno na tarefa Revisar proposta completa Aria: cliente pediu revisao fina antes do envio.' })
  });
  assert(agentComment.data.message.includes('comentario'), 'Chat IA nao criou comentario interno.');
  const agentBlockers = await request('/api/agent/chat', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({ message: 'Quais tarefas estao atrasadas ou bloqueadas?' })
  });
  assert(agentBlockers.data.message.includes('Pontos que merecem atencao') || agentBlockers.data.message.includes('Nao encontrei'), 'Chat IA nao reconheceu pergunta sobre atrasadas/bloqueadas.');

  const history = await request(`/api/tasks/${manualTask.data.id}/history`, { headers: { Cookie: cookie } });
  assert(history.data.length >= 2, 'Historico nao registrou acoes da tarefa.');

  await request(`/api/documents/${document.data.id}`, { method: 'DELETE', headers: { Cookie: cookie } });

  const dashboard = await request('/api/dashboard', { headers: { Cookie: cookie } });
  assert(dashboard.data.counts.tasks >= 5, 'Dashboard nao refletiu tarefas criadas.');

  const appJs = await textRequest('/app.js');
  const frontendText = `${appJs}\n${await textRequest('/styles.css')}`;
  for (const expected of ['Copiar p/ grupo', 'Copiar relatorio', 'Relatorio PDF', 'Agenda PDF', 'Kanban PDF', 'Rendimento do dia', 'Carga por responsavel', 'Filtros', 'filter_responsible', 'filter_kanban_group', 'filter_planning_view', 'filter_saved_view_id', 'Salvar view atual', 'Central de Planejamento', 'planning-board', 'Por responsavel', 'Responsaveis', 'Periodos do dia', 'Meta diaria de tarefas', 'Analise operacional', 'Plano do dia', 'Templates HBR', 'Templates operacionais HBR', 'Campos customizados', 'Automacoes internas', 'Score operacional', 'data-kanban-status', 'data-kanban-responsible', 'data-score-task', 'data-effort-task', 'data-quick-field', 'data-timer-start', 'data-timer-pause', 'Conferir timer a cada', 'Como o Agente IA trabalha', 'settingsForm', 'Passo do score', 'Passo do esforço', 'Salvar configuracoes']) {
    assert(frontendText.includes(expected), `Frontend nao contem controle esperado: ${expected}`);
  }
  for (const expected of ['Colaborador IA 24h', 'agentChatForm', 'data-agent-chat-form', 'floating-agent', 'Chat IA suspenso', 'agentDismissedQuestionId', 'data-agent-choice', 'data-agent-autosend', 'requestSubmit', 'resize: both', 'Planejamento e execucao', 'agent_idle_minutes', 'Ativar colaborador IA proativo', 'Agenda semanal de demandas HBR', 'agenda-week-grid', 'Manha', 'Tarde']) {
    assert(frontendText.includes(expected), `Frontend nao contem controle esperado do agente: ${expected}`);
  }
  assert(appJs.includes("const appVersion = '0.3.2'"), 'Versao visivel do app nao foi atualizada.');
  const version = await request('/api/app-version', { headers: { Cookie: cookie } });
  assert(version.data.version === '0.3.2', 'Backend nao reportou versao 0.3.2.');

  console.log(JSON.stringify({
    status: 'E2E OK',
    created: {
      clients: 1,
      assets: 1,
      projects: 1,
      manual_tasks: 1,
      intake_tasks: batch.data.tasks.length,
      drafts: 2
    },
    intelligence_checks: {
      batch_task_count: interpreted.data.tasks.length,
      la_osadia_context: true,
      finance_classification: true,
      export_controls: true,
      planning_fields: true,
      editable_settings: true,
      score_step: 1,
      effort_step_minutes: 5,
      timer: true,
      responsibles: true,
      filtered_pdf: true,
      workday_reorganization: true,
      compound_agent_command: true,
      preview_before_action: true,
      no_action_confirmation: true,
      blockers_question: true
    }
  }, null, 2));
} finally {
  await stop();
}
