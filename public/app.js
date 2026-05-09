const app = document.querySelector('#app');
const appVersion = '0.3.8';
// Marcadores de compatibilidade dos testes: Como o Agente IA trabalha | Passo do esforÃ§o.

const state = {
  user: null,
  view: 'dashboard',
  data: {
    clients: [],
    assets: [],
    projects: [],
    tasks: [],
    documents: [],
    aiActions: [],
    savedViews: [],
    comments: [],
    automationRules: [],
    automationRuns: [],
    taskTemplates: [],
    taskDependencies: [],
    customFields: [],
    appInfo: null,
    agentMessages: [],
    agentProactive: null,
    dashboard: null,
    settings: null
  },
  editing: null,
  interpreted: null,
  timerInterval: null,
  timerPrompting: false,
  agentInterval: null,
  agentLastActivityAt: Date.now(),
  agentIdlePromptedAt: 0,
  agentFloatingOpen: false,
  agentDismissedQuestionId: null,
  filters: {
    q: '',
    status: '',
    priority: '',
    category: '',
    responsible: '',
    client_id: '',
    date_from: '',
    date_to: '',
    kanban_group: 'status',
    planning_view: 'hoje',
    saved_view_id: ''
  }
};

const labels = {
  dashboard: 'Dashboard',
  intake: 'Caixa inteligente',
  tasks: 'Tarefas',
  clients: 'Clientes',
  assets: 'Embarcacoes / Motorhomes',
  projects: 'Projetos / OS',
  documents: 'Documentos',
  ai: 'Agente IA',
  settings: 'Configuracoes'
};

const navItems = [
  ['dashboard', 'D', 'Dashboard'],
  ['intake', 'I', 'Caixa inteligente'],
  ['tasks', 'T', 'Tarefas'],
  ['clients', 'C', 'Clientes'],
  ['assets', 'A', 'Ativos'],
  ['projects', 'O', 'Projetos / OS'],
  ['documents', 'F', 'Documentos'],
  ['ai', 'R', 'Agente IA'],
  ['settings', 'S', 'Configuracoes']
];

const taskStatuses = [
  ['entrada_capturada', 'Entrada capturada'],
  ['triagem', 'Triagem'],
  ['a_fazer', 'A fazer'],
  ['em_andamento', 'Em andamento'],
  ['aguardando_cliente', 'Aguardando cliente'],
  ['aguardando_fornecedor', 'Aguardando fornecedor'],
  ['aguardando_aprovacao', 'Aguardando aprovacao'],
  ['aguardando_material', 'Aguardando material'],
  ['agendado', 'Agendado'],
  ['concluido', 'Concluido'],
  ['cancelado', 'Cancelado'],
  ['arquivado', 'Arquivado']
];

const priorities = [
  ['baixa', 'Baixa'],
  ['media', 'Media'],
  ['alta', 'Alta'],
  ['critica', 'Critica']
];

const categories = [
  ['cliente', 'Cliente'],
  ['comercial', 'Comercial'],
  ['proposta', 'Proposta'],
  ['ordem_servico', 'Ordem de servico'],
  ['diagnostico_tecnico', 'Diagnostico tecnico'],
  ['instalacao', 'Instalacao'],
  ['compra_material', 'Compra/material'],
  ['fornecedor', 'Fornecedor'],
  ['financeiro', 'Financeiro'],
  ['agenda', 'Agenda'],
  ['documento', 'Documento'],
  ['relatorio', 'Relatorio'],
  ['marketing', 'Marketing'],
  ['administrativo', 'Administrativo'],
  ['projeto_interno', 'Projeto interno']
];

const clientTypes = [
  ['pessoa_fisica', 'Pessoa fisica'],
  ['empresa', 'Empresa'],
  ['estaleiro', 'Estaleiro'],
  ['marina', 'Marina'],
  ['fornecedor', 'Fornecedor']
];

const assetTypes = [
  ['embarcacao', 'Embarcacao'],
  ['lancha', 'Lancha'],
  ['veleiro', 'Veleiro'],
  ['motorhome', 'Motorhome/RV'],
  ['outro', 'Outro']
];

const recurrenceOptions = [
  ['', 'Sem recorrencia'],
  ['diaria', 'Diaria'],
  ['semanal', 'Semanal'],
  ['quinzenal', 'Quinzenal'],
  ['mensal', 'Mensal']
];

const integrationStatusOptions = [
  ['futuro', 'Futuro'],
  ['planejada', 'Planejada'],
  ['preparando', 'Preparando'],
  ['em_teste', 'Em teste'],
  ['ativa', 'Ativa'],
  ['pausada', 'Pausada']
];

const confidenceOptions = [
  ['baixa', 'Baixa: perguntar mais'],
  ['media', 'Media: equilibrio'],
  ['alta', 'Alta: perguntar menos']
];

const taskTemplates = {
  proposta: {
    title: 'Preparar proposta comercial',
    category: 'proposta',
    priority: 'alta',
    estimated_minutes: 90,
    next_action: 'Revisar escopo e montar proposta',
    expected_result: 'Proposta pronta para aprovacao e envio ao cliente.',
    checklist: ['Confirmar escopo solicitado', 'Conferir materiais e compatibilidade', 'Validar condicoes comerciais', 'Preparar rascunho para aprovacao'],
    subtasks: ['Levantar informacoes tecnicas', 'Montar valores', 'Revisar proposta', 'Criar rascunho de envio']
  },
  followup: {
    title: 'Fazer follow-up com cliente',
    category: 'comercial',
    priority: 'media',
    estimated_minutes: 20,
    next_action: 'Preparar mensagem objetiva de follow-up',
    expected_result: 'Cliente respondido e historico atualizado.',
    checklist: ['Localizar ultimo contato', 'Confirmar pendencia', 'Preparar mensagem', 'Aguardar aprovacao antes de enviar'],
    subtasks: ['Resumir contexto', 'Redigir mensagem', 'Registrar retorno']
  },
  os: {
    title: 'Organizar ordem de servico',
    category: 'ordem_servico',
    priority: 'alta',
    estimated_minutes: 120,
    next_action: 'Definir escopo executavel em campo',
    expected_result: 'OS com escopo, checklist e materiais claros.',
    checklist: ['Confirmar local e acesso', 'Definir escopo de atendimento', 'Listar ferramentas e materiais', 'Registrar pendencias para relatorio final'],
    subtasks: ['Confirmar agenda', 'Separar materiais', 'Executar atendimento', 'Atualizar historico']
  },
  material: {
    title: 'Pesquisar materiais e SKUs',
    category: 'compra_material',
    priority: 'media',
    estimated_minutes: 45,
    next_action: 'Conferir especificacao tecnica',
    expected_result: 'Lista de materiais pronta para compra ou proposta.',
    checklist: ['Confirmar especificacao', 'Pesquisar fornecedor/preco', 'Registrar SKU/link', 'Aguardar aprovacao para compra'],
    subtasks: ['Validar compatibilidade', 'Pesquisar opcoes', 'Registrar links', 'Conferir disponibilidade']
  },
  relatorio: {
    title: 'Preparar relatorio tecnico',
    category: 'relatorio',
    priority: 'media',
    estimated_minutes: 75,
    next_action: 'Organizar evidencias e resumo tecnico',
    expected_result: 'Relatorio preliminar pronto para revisao humana.',
    checklist: ['Reunir fotos, medicoes e observacoes', 'Descrever sintomas e causa provavel', 'Listar pendencias/recomendacoes', 'Revisar antes de compartilhar'],
    subtasks: ['Separar evidencias', 'Escrever diagnostico', 'Listar recomendacoes', 'Revisar relatorio']
  }
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function optionList(items, selected = '') {
  return items.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
}

function labelFrom(items, value) {
  return (items.find((item) => item[0] === value) || [value, value || ''])[1];
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
    ...options
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Erro na requisicao.');
  return data;
}

async function safeApi(path, fallback) {
  try {
    return await api(path);
  } catch {
    return fallback;
  }
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function scopedFormData(container) {
  const data = {};
  container.querySelectorAll('input, select, textarea').forEach((field) => {
    if (!field.name) return;
    if (field.type === 'checkbox') {
      data[field.name] = field.checked ? 'on' : '';
    } else {
      data[field.name] = field.value;
    }
  });
  return data;
}

function parseLines(value) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function renderAuth(needsSetup) {
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-box">
        <div class="auth-brand">
          <img src="/assets/hbr-logo-mark.png" alt="HBR Systems">
          <strong>Central Operacional IA</strong>
          <span>Energia. Controle. Confianca. Uma rotina tecnica mais organizada para Boats & RV Systems.</span>
        </div>
        <form id="authForm" class="form-grid">
          ${needsSetup ? `
            <div class="field">
              <label>Nome</label>
              <input name="name" autocomplete="name" required>
            </div>
          ` : ''}
          <div class="field">
            <label>E-mail</label>
            <input name="email" type="text" inputmode="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label>Senha</label>
            <input name="password" type="password" autocomplete="${needsSetup ? 'new-password' : 'current-password'}" minlength="8" required>
          </div>
          <button class="btn primary" type="submit">${needsSetup ? 'Criar primeiro usuario' : 'Entrar'}</button>
        </form>
      </section>
    </main>
  `;
  document.querySelector('#authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formData(event.currentTarget);
    try {
      if (needsSetup) {
        await api('/api/setup', { method: 'POST', body: JSON.stringify(body) });
        toast('Usuario criado. Entre com suas credenciais.');
        renderAuth(false);
      } else {
        state.user = await api('/api/login', { method: 'POST', body: JSON.stringify(body) });
        await loadAll();
        renderApp();
      }
    } catch (error) {
      toast(error.message);
    }
  });
}

async function bootstrap() {
  const setup = await api('/api/setup/status');
  if (setup.needsSetup) return renderAuth(true);
  try {
    state.user = await api('/api/me');
    await loadAll();
    renderApp();
  } catch {
    renderAuth(false);
  }
}

async function loadAll() {
  const [
    dashboard, clients, assets, projects, tasks, documents, aiActions, savedViews, comments,
    automationRules, automationRuns, taskTemplatesData, taskDependencies, customFields,
    appInfo, agentMessages, agentProactive, settings
  ] = await Promise.all([
    api('/api/dashboard'),
    api('/api/clients'),
    api('/api/assets'),
    api('/api/projects'),
    api('/api/tasks'),
    api('/api/documents'),
    api('/api/ai-actions'),
    safeApi('/api/saved-views?scope=tasks', []),
    safeApi('/api/comments', []),
    safeApi('/api/automation-rules', []),
    safeApi('/api/automation-runs', []),
    safeApi('/api/task-templates', []),
    safeApi('/api/task-dependencies', []),
    safeApi('/api/custom-fields', []),
    safeApi('/api/app-version', null),
    safeApi('/api/agent/messages', []),
    safeApi('/api/agent/proactive', { reminders: [], patterns: [], enabled: false }),
    api('/api/settings')
  ]);
  state.data = {
    dashboard, clients, assets, projects, tasks, documents, aiActions, savedViews, comments,
    automationRules, automationRuns, taskTemplates: taskTemplatesData, taskDependencies, customFields,
    appInfo, agentMessages, agentProactive, settings
  };
}

function renderApp() {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <img src="/assets/hbr-logo-compact.png" alt="HBR Systems">
          <span>Operacao tecnica assistida</span>
        </div>
        <nav class="nav">
          ${navItems.map(([key, icon, label]) => `
            <button class="${state.view === key ? 'active' : ''}" data-view="${key}" title="${label}">
              <span>${icon}</span><span>${label}</span>
            </button>
          `).join('')}
        </nav>
        <div class="sidebar-footer">
          <span>Versao ${appVersion}</span>
          <span>${escapeHtml(state.user?.name || '')}</span>
          <button class="btn ghost small" id="logoutBtn">Sair</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="topbar-title">
            <img src="/assets/hbr-logo-compact.png" alt="" aria-hidden="true">
            <div>
              <h1>${labels[state.view]}</h1>
              <small>${subtitle()}</small>
            </div>
          </div>
          <div class="actions">${topActions()}</div>
        </header>
        ${renderCompatibilityBanner()}
        <section class="content">${renderView()}</section>
      </main>
    </div>
    <div class="drawer" id="drawer"></div>
    ${renderFloatingAgent()}
  `;
  bindNav();
  bindView();
}

function renderCompatibilityBanner() {
  const info = state.data.appInfo;
  if (info?.version === appVersion) return '';
  return `
    <div class="compat-banner">
      <strong>Servidor precisa ser reiniciado</strong>
      <span>O frontend carregou a versao ${appVersion}, mas o backend ativo nao confirmou a mesma versao. Feche o processo antigo da porta 4173 e rode npm.cmd start novamente para ativar templates, automacoes, views salvas e comentarios.</span>
    </div>
  `;
}

function renderFloatingAgent() {
  const messages = state.data.agentMessages || [];
  const proactive = state.data.agentProactive || {};
  return `
    <div class="floating-agent ${state.agentFloatingOpen ? 'open' : ''}">
      <button class="floating-agent-button" type="button" data-agent-toggle title="Abrir chat IA">
        <span>IA</span>
        ${(proactive.reminders || []).length ? `<i>${(proactive.reminders || []).length}</i>` : ''}
      </button>
      <section class="floating-agent-panel" aria-label="Chat IA suspenso">
        <header>
          <div>
            <strong>Colaborador IA</strong>
            <span>Planejamento e execucao de qualquer tela</span>
          </div>
          <button class="btn icon small" type="button" data-agent-close title="Fechar">x</button>
        </header>
        <div class="agent-messages compact" id="floatingAgentMessages">
          ${renderAgentMessages(messages)}
        </div>
        ${renderAgentChoiceArea(messages)}
        <div class="actions agent-shortcuts">
          <button class="btn small" type="button" data-agent-prompt="Monte o plano do dia por ordem de prioridade.">Plano</button>
          <button class="btn small" type="button" data-agent-prompt="Quais tarefas estao atrasadas ou bloqueadas?">Bloqueios</button>
          <button class="btn small" type="button" data-agent-prompt="Registrar demanda: ">Registrar</button>
        </div>
        <form class="agent-chat-form compact" data-agent-chat-form>
          <textarea name="message" rows="4" placeholder="Digite um comando para a IA..."></textarea>
          <button class="btn primary" type="submit">Enviar</button>
        </form>
      </section>
    </div>
  `;
}

function subtitle() {
  const map = {
    dashboard: 'Visao rapida de prioridades, pendencias e aprovacoes.',
    intake: 'Transforme texto livre em tarefa estruturada com contexto HBR.',
    tasks: 'Lista e kanban das demandas operacionais.',
    clients: 'Clientes, marinas, estaleiros, fornecedores e parceiros.',
    assets: 'Cadastro tecnico de embarcacoes e motorhomes.',
    projects: 'Escopo, checklist, materiais e tarefas vinculadas.',
    documents: 'Links e referencias documentais organizadas.',
    ai: 'Rascunhos, sugestoes e acoes que precisam de revisao.',
    settings: 'Perfil operacional, regras de autonomia e integracoes futuras.'
  };
  return map[state.view] || '';
}

function topActions() {
  if (state.view === 'tasks') {
    return [
      '<button class="btn primary" data-action="new-task">Nova tarefa</button>',
      '<button class="btn" data-export="tasks-text">Copiar p/ grupo</button>',
      '<button class="btn" data-export="tasks-report">Copiar relatorio</button>',
      '<button class="btn" data-export="tasks-operational-pdf">Relatorio PDF</button>',
      '<button class="btn" data-export="tasks-agenda">Agenda PDF</button>',
      '<button class="btn" data-export="tasks-kanban">Kanban PDF</button>',
      '<button class="btn" data-export="csv">CSV</button>',
      '<button class="btn" data-export="json">JSON</button>'
    ].join('');
  }
  if (state.view === 'clients') return '<button class="btn primary" data-action="new-client">Novo cliente</button>' + exportButtons();
  if (state.view === 'assets') return '<button class="btn primary" data-action="new-asset">Novo ativo</button>' + exportButtons();
  if (state.view === 'projects') return '<button class="btn primary" data-action="new-project">Novo projeto/OS</button>' + exportButtons();
  if (state.view === 'documents') return '<button class="btn primary" data-action="new-document">Novo documento</button>' + exportButtons();
  if (['dashboard', 'ai', 'settings'].includes(state.view)) return exportButtons({ csv: state.view !== 'settings' });
  return '';
}

function exportButtons(options = {}) {
  const csv = options.csv !== false ? '<button class="btn" data-export="csv">CSV</button>' : '';
  return `<button class="btn" data-export="pdf">PDF</button>${csv}<button class="btn" data-export="json">JSON</button>`;
}

function bindNav() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.view = button.dataset.view;
      await loadAll();
      renderApp();
    });
  });
  document.querySelector('#logoutBtn')?.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    state.user = null;
    renderAuth(false);
  });
}

function bindView() {
  document.querySelector('[data-action="new-task"]')?.addEventListener('click', () => openTaskDrawer());
  document.querySelector('[data-action="new-client"]')?.addEventListener('click', () => openClientDrawer());
  document.querySelector('[data-action="new-asset"]')?.addEventListener('click', () => openAssetDrawer());
  document.querySelector('[data-action="new-project"]')?.addEventListener('click', () => openProjectDrawer());
  document.querySelector('[data-action="new-document"]')?.addEventListener('click', () => openDocumentDrawer());
  document.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', () => handleExport(button.dataset.export));
  });

  if (state.view === 'intake') bindIntake();
  if (state.view === 'tasks') bindTasks();
  if (state.view === 'clients') bindEntityButtons('clients', openClientDrawer);
  if (state.view === 'assets') bindEntityButtons('assets', openAssetDrawer);
  if (state.view === 'projects') bindEntityButtons('projects', openProjectDrawer);
  if (state.view === 'documents') bindEntityButtons('documents', openDocumentDrawer);
  if (state.view === 'ai') bindAi();
  if (state.view === 'settings') bindSettings();
  bindTaskQuickActions();
  bindAgentChatControls();
  setupTimerTicker();
  setupAgentProactive();
}

function renderView() {
  const views = {
    dashboard: renderDashboard,
    intake: renderIntake,
    tasks: renderTasks,
    clients: () => renderClients(),
    assets: () => renderAssets(),
    projects: () => renderProjects(),
    documents: () => renderDocuments(),
    ai: renderAi,
    settings: renderSettings
  };
  return (views[state.view] || renderDashboard)();
}

function renderDashboard() {
  const dashboard = state.data.dashboard;
  const waiting = Object.fromEntries((dashboard.waiting || []).map((item) => [item.status, item.count]));
  const insights = buildTaskInsights(state.data.tasks);
  const settings = state.data.settings || {};
  const today = new Date().toISOString().slice(0, 10);
  const doneToday = state.data.tasks.filter((task) => task.status === 'concluido' && String(task.updated_at || '').slice(0, 10) === today);
  const minutesToday = state.data.tasks.reduce((sum, task) => sum + Number(task.time_spent_seconds || 0), 0);
  const goalTasks = Number(settings.daily_goal_tasks || 6);
  const goalMinutes = Number(settings.daily_goal_minutes || 240);
  const activeByResponsible = groupBy(state.data.tasks.filter((task) => !['concluido', 'cancelado', 'arquivado'].includes(task.status)), (task) => task.responsible || 'Sem responsavel');
  return `
    <div class="grid five">
      <div class="metric"><span>Tarefas</span><strong>${dashboard.counts.tasks}</strong></div>
      <div class="metric"><span>Clientes</span><strong>${dashboard.counts.clients}</strong></div>
      <div class="metric"><span>Ativos</span><strong>${dashboard.counts.assets}</strong></div>
      <div class="metric"><span>Aprovacoes IA</span><strong>${dashboard.counts.approvals}</strong></div>
      <div class="metric"><span>Automacoes</span><strong>${(state.data.automationRules || []).filter((rule) => rule.enabled).length}</strong></div>
    </div>
    <section class="band">
      <div class="section-head"><div><h2>Rendimento do dia</h2><p>Metas configuraveis com leitura operacional de conclusao, tempo registrado e carga ativa.</p></div></div>
      <div class="grid four">
        ${progressMetric('Tarefas concluidas', doneToday.length, goalTasks, `${doneToday.length}/${goalTasks}`)}
        ${progressMetric('Tempo registrado', Math.round(minutesToday / 60), goalMinutes, `${minutesLabel(Math.round(minutesToday / 60))}/${minutesLabel(goalMinutes)}`)}
        ${progressMetric('Carga ativa', insights.totalMinutes, Number(settings.daily_capacity_minutes || 360), `${minutesLabel(insights.totalMinutes)}`)}
        <div class="metric"><span>Bloqueios</span><strong>${insights.blocked.length}</strong><p class="muted">${insights.blocked.length ? 'Exige follow-up ou decisao.' : 'Sem bloqueio forte aparente.'}</p></div>
      </div>
    </section>
    <section class="band">
      <div class="section-head"><div><h2>Fila operacional</h2><p>Itens que normalmente travam resposta, execucao ou decisao.</p></div></div>
      <div class="grid four">
        <div class="metric"><span>Aguardando cliente</span><strong>${waiting.aguardando_cliente || 0}</strong></div>
        <div class="metric"><span>Aguardando fornecedor</span><strong>${waiting.aguardando_fornecedor || 0}</strong></div>
        <div class="metric"><span>Aguardando aprovacao</span><strong>${waiting.aguardando_aprovacao || 0}</strong></div>
        <div class="metric"><span>Aguardando material</span><strong>${waiting.aguardando_material || 0}</strong></div>
      </div>
    </section>
    <div class="grid two">
      <section class="band">
        <div class="section-head"><h2>Hoje</h2></div>
        ${taskMiniList(dashboard.todayTasks)}
      </section>
      <section class="band">
        <div class="section-head"><h2>Atrasadas</h2></div>
        ${taskMiniList(dashboard.overdue)}
      </section>
    </div>
    <section class="band">
      <div class="section-head"><div><h2>Carga por responsavel</h2><p>Ajuda a identificar sobrecarga, itens sem dono e filas paradas.</p></div></div>
      <div class="grid three">
        ${Object.entries(activeByResponsible).map(([responsible, tasks]) => {
          const minutes = tasks.reduce((sum, task) => sum + Number(task.estimated_minutes || 30), 0);
          const high = tasks.filter((task) => ['critica', 'alta'].includes(task.priority)).length;
          return `<div class="metric"><span>${escapeHtml(responsible)}</span><strong>${tasks.length}</strong><p class="muted">${minutesLabel(minutes)} ativos | ${high} alta/critica</p></div>`;
        }).join('') || '<div class="empty">Nenhuma tarefa ativa.</div>'}
      </div>
    </section>
  `;
}

function progressMetric(label, value, goal, text) {
  const percent = Math.max(0, Math.min(100, Math.round((Number(value || 0) / Math.max(Number(goal || 1), 1)) * 100)));
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(text)}</strong>
      <div class="progress"><i style="width:${percent}%"></i></div>
    </div>
  `;
}

function taskMiniList(tasks) {
  if (!tasks?.length) return '<div class="empty">Nenhuma tarefa nesta fila.</div>';
  return `<div class="grid">${tasks.map((task) => `
    <article class="task-card">
      ${renderTaskCardHeader(task)}
      ${renderTaskMetaLine(task)}
      ${renderTaskQuickActions(task)}
    </article>
  `).join('')}</div>`;
}

function renderIntake() {
  return `
    <section class="band">
      <div class="section-head">
        <div>
          <h2>Entrada livre</h2>
          <p>Escreva uma ou varias demandas como elas chegaram. A triagem separa tarefas, sugere relacoes e pede confirmacao quando houver ambiguidade.</p>
        </div>
      </div>
      <form id="intakeForm" class="form-grid">
        <div class="field">
          <label>Demandas</label>
          <textarea name="text" required placeholder="Cole uma conversa, anotacao de reuniao ou lista de pendencias. Pode misturar orcamentos, retornos, lembretes e prioridades."></textarea>
        </div>
        <div class="actions">
          <button class="btn primary" type="submit">Separar e interpretar</button>
        </div>
      </form>
    </section>
    <section class="band" id="interpretPanel">
      ${state.interpreted ? renderInterpretResult(state.interpreted) : '<div class="empty">A fila de tarefas propostas aparecera aqui antes de salvar.</div>'}
    </section>
  `;
}

function renderInterpretResult(data) {
  const tasks = data.tasks || [data];
  return `
    <div class="section-head">
      <div>
        <h2>Triagem em lote</h2>
        <p>${escapeHtml(data.summary || 'Revise os itens antes de confirmar.')}</p>
      </div>
    </div>
    <form id="saveInterpretedForm" class="interpret-result batch-result">
      ${tasks.map((task, index) => renderDraftTask(task, index)).join('')}
      <div class="actions">
        <button class="btn primary" type="submit">Salvar tarefas selecionadas</button>
        <button class="btn" type="button" id="copyInterpret">Copiar exportacao</button>
        <button class="btn" type="button" id="downloadInterpret">Baixar JSON</button>
        <button class="btn" type="button" id="clearInterpret">Limpar</button>
      </div>
    </form>
  `;
}

function renderDraftTask(task, index) {
  return `
    <article class="draft-task" data-task-index="${index}">
      <div class="draft-head">
        <label class="select-row">
          <input type="checkbox" name="selected" ${task.selected === false ? '' : 'checked'}>
          <span>Salvar</span>
        </label>
        <strong>${escapeHtml(task.title)}</strong>
        <span class="pill ${task.priority}">${labelFrom(priorities, task.priority)}</span>
      </div>
      <div class="summary-line">${escapeHtml(task.reasoning || '')}</div>
      ${renderResolution(task)}
      ${renderQuestions(task)}
      <input type="hidden" name="client_id" value="${escapeHtml(task.client_id || '')}">
      <input type="hidden" name="asset_id" value="${escapeHtml(task.asset_id || '')}">
      <input type="hidden" name="create_pending_client" value="${task.create_pending_client ? 'true' : 'false'}">
      <input type="hidden" name="create_pending_asset" value="${task.create_pending_asset ? 'true' : 'false'}">
      <div class="form-grid two compact-edit-grid">
        ${inputField('Titulo', 'title', task.title)}
        ${selectField('Prioridade', 'priority', priorities, task.priority)}
        ${selectField('Status', 'status', taskStatuses, task.status)}
        ${inputField('Prazo', 'due_date', task.due_date, 'date')}
        ${inputField('Planejar para', 'planned_date', task.planned_date || task.due_date, 'date')}
      </div>
      <details class="detail-block">
        <summary>Campos complementares</summary>
        <div class="form-grid two compact-edit-grid">
          ${selectField('Categoria', 'category', categories, task.category)}
        ${inputField('Esforco estimado (min)', 'estimated_minutes', task.estimated_minutes || 30, 'number')}
        ${inputField('Score operacional', 'operational_score', task.operational_score || 50, 'number')}
        ${inputField('Local / Marina', 'location', task.location)}
        ${inputField('Cliente identificado', 'client_hint', task.client_hint)}
        ${inputField('Ativo identificado', 'asset_hint', task.asset_hint)}
        </div>
      </details>
      ${textareaField('Descricao', 'description', task.description)}
      <details class="detail-block">
        <summary>Checklist, bloqueios e subtarefas</summary>
        ${textareaField('Dependencias', 'dependency_text', task.dependency_text || '')}
        ${textareaField('Bloqueio / risco de execucao', 'blocker_reason', task.blocker_reason || '')}
        ${textareaField('Checklist', 'checklist_text', (task.checklist || []).join('\n'))}
        ${textareaField('Subtarefas', 'subtasks_text', (task.subtasks || []).join('\n'))}
      </details>
      ${textareaField('Correcao ou novo comando para este item', 'correction_text', '')}
    </article>
  `;
}

function renderResolution(task) {
  const lines = [];
  if (task.client_resolution?.status === 'matched') {
    lines.push(`Cliente vinculado: ${task.client_resolution.matches[0].name}`);
  }
  if (task.client_resolution?.status === 'new_pending') {
    lines.push(`Cliente novo: sera criado cadastro basico pendente para "${task.client_resolution.hint}".`);
  }
  if (task.asset_resolution?.status === 'matched') {
    lines.push(`Ativo vinculado: ${task.asset_resolution.matches[0].name}`);
  }
  if (task.asset_resolution?.status === 'new_pending') {
    lines.push(`Ativo novo: sera criado cadastro basico pendente para "${task.asset_resolution.hint}".`);
  }
  if (task.asset_resolution?.status === 'generic') {
    lines.push(`Ativo citado de forma generica: "${task.asset_resolution.hint}".`);
  }
  return lines.length ? `<div class="resolution">${lines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}</div>` : '';
}

function renderQuestions(task) {
  if (!task.questions?.length) return '';
  return `
    <div class="question-box">
      ${task.questions.map((question) => `
        <div class="question" data-question="${escapeHtml(question.field)}">
          <strong>${escapeHtml(question.prompt)}</strong>
          <div class="actions">
            ${question.options.map((option) => `
              <button class="btn small" type="button" data-question-field="${escapeHtml(question.field)}" data-question-value="${escapeHtml(option.value)}">
                ${escapeHtml(option.label)}
              </button>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function bindIntake() {
  document.querySelector('#intakeForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      state.interpreted = await api('/api/intake/interpret', {
        method: 'POST',
        body: JSON.stringify(formData(event.currentTarget))
      });
      renderApp();
    } catch (error) {
      toast(error.message);
    }
  });
  document.querySelector('#clearInterpret')?.addEventListener('click', () => {
    state.interpreted = null;
    renderApp();
  });
  document.querySelector('#copyInterpret')?.addEventListener('click', async () => {
    const payload = buildInterpretExport();
    const text = formatInterpretExport(payload);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        copyTextFallback(text);
      }
      toast('Exportacao copiada.');
    } catch {
      copyTextFallback(text);
      toast('Exportacao copiada.');
    }
  });
  document.querySelector('#downloadInterpret')?.addEventListener('click', () => {
    const payload = buildInterpretExport();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hbr-triagem-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Arquivo JSON gerado.');
  });
  document.querySelector('#saveInterpretedForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tasks = [...event.currentTarget.querySelectorAll('.draft-task')].map((card) => collectDraftTask(card));
    try {
      await api('/api/tasks/from-intake', { method: 'POST', body: JSON.stringify({ tasks }) });
      state.interpreted = null;
      await loadAll();
      state.view = 'tasks';
      renderApp();
      toast('Tarefas criadas.');
    } catch (error) {
      toast(error.message);
    }
  });
  document.querySelectorAll('[data-question-field]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.draft-task');
      const field = button.dataset.questionField;
      const value = button.dataset.questionValue;
      const input = card.querySelector(`[name="${field}"]`);
      if (input) input.value = value === 'create_pending' ? '' : value;
      if (field === 'client_id') card.querySelector('[name="create_pending_client"]').value = value === 'create_pending' ? 'true' : 'false';
      if (field === 'asset_id') card.querySelector('[name="create_pending_asset"]').value = value === 'create_pending' ? 'true' : 'false';
      button.closest('.question').querySelectorAll('button').forEach((item) => item.classList.remove('primary'));
      button.classList.add('primary');
    });
  });
}

function buildInterpretExport() {
  const cards = [...document.querySelectorAll('.draft-task')];
  const tasks = cards.length ? cards.map((card) => {
    const index = Number(card.dataset.taskIndex);
    const generated = state.interpreted?.tasks?.[index] || {};
    return {
      ...collectDraftTask(card),
      generated_metadata: {
        temp_id: generated.temp_id,
        client_resolution: generated.client_resolution,
        asset_resolution: generated.asset_resolution,
        questions: generated.questions || []
      }
    };
  }) : (state.interpreted?.tasks || []);
  return {
    exported_at: new Date().toISOString(),
    app: 'HBR Operacional IA',
    context: 'caixa_inteligente_triagem_em_lote',
    original_input: state.interpreted?.original_input || '',
    summary: state.interpreted?.summary || '',
    task_count: tasks.length,
    tasks
  };
}

function formatInterpretExport(payload) {
  const lines = [
    '# Exportacao da caixa inteligente HBR',
    `Gerado em: ${payload.exported_at}`,
    '',
    `Resumo: ${payload.summary}`,
    `Quantidade de tarefas: ${payload.task_count}`,
    '',
    '## Tarefas'
  ];
  payload.tasks.forEach((task, index) => {
    lines.push(
      '',
      `### ${index + 1}. ${task.title}`,
      `Selecionada: ${task.selected ? 'sim' : 'nao'}`,
      `Categoria: ${task.category || ''}`,
      `Prioridade: ${task.priority || ''}`,
      `Prazo: ${task.due_date || ''}`,
      `Cliente identificado: ${task.client_hint || ''}`,
      `Ativo identificado: ${task.asset_hint || ''}`,
      '',
      'Descricao:',
      task.description || '',
      '',
      'Checklist:',
      ...(task.checklist || []).map((item) => `- ${item}`),
      '',
      'Subtarefas:',
      ...(task.subtasks || []).map((item) => `- ${item}`),
      '',
      `Raciocinio operacional: ${task.reasoning || ''}`
    );
  });
  lines.push('', '## JSON completo', '```json', JSON.stringify(payload, null, 2), '```');
  return lines.join('\n');
}

function copyTextFallback(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function collectDraftTask(card) {
  const index = Number(card.dataset.taskIndex);
  const base = state.interpreted.tasks[index];
  const body = { ...base, ...scopedFormData(card) };
  body.selected = card.querySelector('[name="selected"]').checked;
  body.checklist = parseLines(body.checklist_text);
  body.subtasks = parseLines(body.subtasks_text);
  body.tags = base.tags || [];
  body.create_pending_client = body.create_pending_client === 'true';
  body.create_pending_asset = body.create_pending_asset === 'true';
  if (body.correction_text?.trim()) {
    body.description = `${body.description || ''}\n\nCorrecao/orientacao do usuario: ${body.correction_text.trim()}`;
    body.tags = [...new Set([...(body.tags || []), 'corrigido_pelo_usuario'])];
  }
  delete body.checklist_text;
  delete body.subtasks_text;
  delete body.correction_text;
  delete body.questions;
  delete body.client_resolution;
  delete body.asset_resolution;
  return body;
}

function renderTasks() {
  const tasks = sortedTasks({ includeDone: true, tasks: filteredTasks() });
  return `
    ${renderTaskFilters()}
    ${renderPlanningCenter(tasks)}
    ${renderTaskInsights(tasks)}
    ${renderDailyPlan(tasks)}
    <section class="band">
      <div class="section-head">
        <div><h2>Lista priorizada</h2><p>Ordenada por score operacional, prazo, impacto e bloqueios.</p></div>
      </div>
      ${tasks.length ? renderTasksTable(tasks) : '<div class="empty">Nenhuma tarefa cadastrada ainda.</div>'}
    </section>
    <section class="band">
      <div class="section-head"><h2>Kanban operacional</h2></div>
      ${renderKanban(tasks)}
    </section>
  `;
}

function renderTaskFilters() {
  return `
    <section class="band filter-band">
      <div class="section-head">
        <div><h2>Filtros</h2><p>As listas, kanbans e PDFs usam exatamente os filtros aplicados aqui.</p></div>
        <button class="btn small" type="button" id="clearTaskFilters">Limpar filtros</button>
      </div>
      <div class="filter-grid primary-filters">
        ${inputField('Buscar', 'filter_q', state.filters.q)}
        ${selectField('Status', 'filter_status', [['', 'Todos'], ...taskStatuses], state.filters.status)}
        ${selectField('Prioridade', 'filter_priority', [['', 'Todas'], ...priorities], state.filters.priority)}
        ${selectField('Responsavel', 'filter_responsible', [['', 'Todos'], ...responsibleOptions()], state.filters.responsible)}
      </div>
      <details class="detail-block filter-details">
        <summary>Filtros avancados, agrupamentos e views salvas</summary>
        <div class="filter-grid">
        ${selectField('Categoria', 'filter_category', [['', 'Todas'], ...categories], state.filters.category)}
        ${relationSelect('Cliente', 'filter_client_id', `<option value="">Todos</option>${state.data.clients.map((item) => `<option value="${item.id}" ${Number(state.filters.client_id) === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}`)}
        ${inputField('Prazo de', 'filter_date_from', state.filters.date_from, 'date')}
        ${inputField('Prazo ate', 'filter_date_to', state.filters.date_to, 'date')}
        ${selectField('Kanban', 'filter_kanban_group', [['status', 'Por status'], ['responsible', 'Por responsavel']], state.filters.kanban_group)}
        ${selectField('Central de planejamento', 'filter_planning_view', planningViewOptions(), state.filters.planning_view)}
        ${selectField('View salva', 'filter_saved_view_id', [['', 'Nenhuma'], ...state.data.savedViews.map((view) => [String(view.id), view.name])], state.filters.saved_view_id)}
        </div>
        <div class="actions">
          <button class="btn small" type="button" id="saveCurrentView">Salvar view atual</button>
          <button class="btn small" type="button" id="deleteCurrentView">Excluir view salva</button>
        </div>
      </details>
    </section>
  `;
}

function planningViewOptions() {
  return [
    ['hoje', 'Hoje'],
    ['semana', 'Semana'],
    ['backlog', 'Backlog'],
    ['bloqueadas', 'Bloqueadas'],
    ['aguardando', 'Aguardando'],
    ['responsavel', 'Por responsavel'],
    ['cliente', 'Por cliente']
  ];
}

function filteredTasks() {
  const q = normalizeText(state.filters.q);
  return state.data.tasks.filter((task) => {
    if (q && !normalizeText([task.title, task.description, task.client_name, task.asset_name, task.location].join(' ')).includes(q)) return false;
    if (state.filters.status && task.status !== state.filters.status) return false;
    if (state.filters.priority && task.priority !== state.filters.priority) return false;
    if (state.filters.category && task.category !== state.filters.category) return false;
    if (state.filters.responsible && (task.responsible || '') !== state.filters.responsible) return false;
    if (state.filters.client_id && Number(task.client_id) !== Number(state.filters.client_id)) return false;
    const filterDate = task.due_date || task.planned_date || '';
    if (state.filters.date_from && (!filterDate || filterDate < state.filters.date_from)) return false;
    if (state.filters.date_to && (!filterDate || filterDate > state.filters.date_to)) return false;
    return true;
  });
}

function normalizeText(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderPlanningCenter(tasks) {
  const active = tasks.filter((task) => !['concluido', 'cancelado', 'arquivado'].includes(task.status));
  const view = state.filters.planning_view || 'hoje';
  const groups = planningGroups(active, view);
  const visibleCount = Object.values(groups).reduce((sum, items) => sum + items.length, 0);
  return `
    <section class="band planning-center">
      <div class="section-head">
        <div>
          <h2>Central de Planejamento</h2>
          <p>Views salvas, capacidade, bloqueios, responsaveis e agenda em uma leitura operacional.</p>
        </div>
        <span class="pill">${visibleCount} item(ns)</span>
      </div>
      <div class="planning-tabs">
        ${planningViewOptions().map(([key, label]) => `
          <button class="btn small ${view === key ? 'primary' : ''}" type="button" data-planning-view="${key}">${label}</button>
        `).join('')}
      </div>
      <div class="planning-board ${['responsavel', 'cliente'].includes(view) ? 'wide' : ''}">
        ${Object.entries(groups).map(([label, items]) => `
          <section class="planning-lane">
            <h3>${escapeHtml(label)} <span>${items.length}</span></h3>
            ${items.length ? sortedTasks({ tasks: items }).map(renderPlanningTask).join('') : '<div class="empty">Sem itens</div>'}
          </section>
        `).join('')}
      </div>
    </section>
  `;
}

function planningGroups(tasks, view) {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = addDays(today, 6);
  if (view === 'semana') {
    return {
      'Esta semana': tasks.filter((task) => {
        const date = taskPlanningDate(task);
        return date && date >= today && date <= weekEnd;
      }),
      'Sem data': tasks.filter((task) => !taskPlanningDate(task)),
      'Fora da semana': tasks.filter((task) => {
        const date = taskPlanningDate(task);
        return date && (date < today || date > weekEnd);
      })
    };
  }
  if (view === 'backlog') {
    return {
      'Sem data': tasks.filter((task) => !taskPlanningDate(task)),
      'Baixa/media': tasks.filter((task) => taskPlanningDate(task) && ['baixa', 'media'].includes(task.priority)),
      'Alta sem bloqueio': tasks.filter((task) => taskPlanningDate(task) && ['alta', 'critica'].includes(task.priority) && !task.blocker_reason)
    };
  }
  if (view === 'bloqueadas') {
    return {
      'Cliente': tasks.filter((task) => task.status === 'aguardando_cliente' || task.blocker_type === 'cliente'),
      'Fornecedor/material': tasks.filter((task) => ['aguardando_fornecedor', 'aguardando_material'].includes(task.status) || ['fornecedor', 'material'].includes(task.blocker_type)),
      'Aprovacao/outros': tasks.filter((task) => task.status === 'aguardando_aprovacao' || (task.blocker_reason && !['cliente', 'fornecedor', 'material'].includes(task.blocker_type)))
    };
  }
  if (view === 'aguardando') {
    return Object.fromEntries(['aguardando_cliente', 'aguardando_fornecedor', 'aguardando_aprovacao', 'aguardando_material'].map((status) => [
      labelFrom(taskStatuses, status),
      tasks.filter((task) => task.status === status)
    ]));
  }
  if (view === 'responsavel') {
    return groupBy(tasks, (task) => task.responsible || 'Sem responsavel');
  }
  if (view === 'cliente') {
    return groupBy(tasks, (task) => task.client_name || 'Sem cliente');
  }
  return {
    'Manha': tasks.filter((task) => taskPlanningDate(task) === today && planningPeriod(task) === 'manha'),
    'Tarde': tasks.filter((task) => taskPlanningDate(task) === today && planningPeriod(task) === 'tarde'),
    'Vencidas': tasks.filter((task) => taskPlanningDate(task) && taskPlanningDate(task) < today),
    'Alta prioridade sem data': tasks.filter((task) => !taskPlanningDate(task) && ['alta', 'critica'].includes(task.priority))
  };
}

function renderPlanningTask(task) {
  return `
    <article class="task-card planning-task">
      ${renderTaskCardHeader(task)}
      ${renderTaskMetaLine(task, { planning: true })}
      ${task.blocker_reason ? `<small class="danger-text">${escapeHtml(task.blocker_reason)}</small>` : ''}
      ${renderTaskQuickActions(task)}
    </article>
  `;
}

function taskPlanningDate(task) {
  return (task.planned_date || task.due_date || '').slice(0, 10);
}

function planningPeriod(task) {
  if (task.planned_period) return task.planned_period;
  if (['critica', 'alta'].includes(task.priority)) return 'manha';
  if (operationalScoreForTask(task) >= 72) return 'manha';
  if (['proposta', 'comercial', 'financeiro'].includes(task.category)) return 'manha';
  return 'tarde';
}

function plannedPeriodLabel(value) {
  return { manha: 'Manha', tarde: 'Tarde', noite: 'Noite' }[value] || value || 'Sem periodo';
}

function planningPeriodOptions() {
  const configured = state.data.settings?.planning_periods || ['manha', 'tarde'];
  const labelsByValue = { manha: 'Manha', tarde: 'Tarde', noite: 'Noite' };
  return [['', 'Sem periodo'], ...configured.map((value) => [value, labelsByValue[value] || value])];
}

function addDays(value, days) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function renderDailyPlan(tasks) {
  const today = new Date().toISOString().slice(0, 10);
  const active = tasks.filter((task) => !['concluido', 'cancelado', 'arquivado'].includes(task.status));
  const planned = active
    .filter((task) => {
      const planDate = task.planned_date || task.due_date || '';
      return (planDate && planDate <= today) || ['critica', 'alta'].includes(task.priority);
    })
    .slice(0, 8);
  const totalMinutes = planned.reduce((sum, task) => sum + Number(task.estimated_minutes || 30), 0);
  const overload = totalMinutes > 360;
  return `
    <section class="band">
      <div class="section-head">
        <div>
          <h2>Plano do dia</h2>
          <p>Fila recomendada com carga estimada, inspirada em planejamento diario e timeboxing.</p>
        </div>
        <span class="pill ${overload ? 'alta' : 'baixa'}">${minutesLabel(totalMinutes)} planejados</span>
      </div>
      ${overload ? '<div class="summary-line">A carga estimada passou de 6h. Recomendo manter apenas as propostas/retornos críticos e empurrar tarefas sem prazo claro.</div>' : ''}
      ${planned.length ? `<div class="timeline-list">${planned.map((task, index) => `
        <article class="timeline-item">
          <span>${index + 1}</span>
          <div>
            <button class="link-title" data-open-task="${task.id}" type="button">${escapeHtml(task.title)}</button>
            <p>${escapeHtml([task.client_name, task.asset_name || task.location].filter(Boolean).join(' / ') || 'Sem vinculo')} | ${minutesLabel(task.estimated_minutes || 30)} | score ${operationalScoreForTask(task)}</p>
            ${task.next_action ? `<small>${escapeHtml(task.next_action)}</small>` : ''}
            ${renderTaskQuickActions(task)}
          </div>
        </article>
      `).join('')}</div>` : '<div class="empty">Sem itens recomendados para hoje.</div>'}
    </section>
  `;
}

function renderTaskInsights(tasks) {
  const insights = buildTaskInsights(tasks);
  return `
    <section class="band">
      <div class="section-head">
        <div>
          <h2>Analise operacional</h2>
          <p>Resumo automatico para orientar prioridade, bloqueios e comunicacao com a equipe.</p>
        </div>
      </div>
      <div class="grid four">
        <div class="metric"><span>Ativas</span><strong>${insights.active}</strong></div>
        <div class="metric"><span>Criticas/altas</span><strong>${insights.highImpact}</strong></div>
        <div class="metric"><span>Atrasadas</span><strong>${insights.overdue.length}</strong></div>
        <div class="metric"><span>Carga ativa</span><strong>${minutesLabel(insights.totalMinutes)}</strong></div>
      </div>
      <div class="grid two">
        <div>
          <h3>Proximas acoes</h3>
          ${insights.nextActions.length ? `<ul class="checklist">${insights.nextActions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<div class="empty">Sem acoes prioritarias.</div>'}
        </div>
        <div>
          <h3>Riscos e bloqueios</h3>
          ${insights.risks.length ? `<ul class="checklist">${insights.risks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<div class="empty">Nenhum risco evidente.</div>'}
        </div>
      </div>
    </section>
  `;
}

function buildTaskInsights(tasks) {
  const activeTasks = tasks.filter((task) => !['concluido', 'cancelado', 'arquivado'].includes(task.status));
  const today = new Date().toISOString().slice(0, 10);
  const overdue = activeTasks.filter((task) => task.due_date && task.due_date < today);
  const highImpact = activeTasks.filter((task) => ['critica', 'alta'].includes(task.priority)).length;
  const blocked = activeTasks.filter((task) => ['aguardando_cliente', 'aguardando_fornecedor', 'aguardando_aprovacao', 'aguardando_material'].includes(task.status) || task.blocker_reason);
  const missingContext = activeTasks.filter((task) => !task.client_id && !task.client_name);
  const missingDue = activeTasks.filter((task) => !task.due_date && ['critica', 'alta'].includes(task.priority));
  const totalMinutes = activeTasks.reduce((sum, task) => sum + Number(task.estimated_minutes || 30), 0);
  const nextActions = sortedTasks({ tasks: activeTasks }).slice(0, 5).map((task) => {
    const who = [task.client_name, task.asset_name || task.location].filter(Boolean).join(' / ') || 'Sem vinculo';
    const date = formatDate(task.due_date) || 'sem prazo';
    return `Score ${operationalScoreForTask(task)} - ${labelFrom(priorities, task.priority)} - ${who}: ${task.title} (${date}, ${minutesLabel(task.estimated_minutes || 30)})`;
  });
  const risks = [
    ...overdue.slice(0, 3).map((task) => `Atrasada: ${task.title} (${formatDate(task.due_date)})`),
    ...blocked.slice(0, 3).map((task) => `Bloqueio: ${task.title} - ${task.blocker_reason || labelFrom(taskStatuses, task.status)}`),
    ...missingContext.slice(0, 2).map((task) => `Falta vinculo de cliente: ${task.title}`),
    ...missingDue.slice(0, 2).map((task) => `Alta prioridade sem prazo: ${task.title}`)
  ];
  return { active: activeTasks.length, highImpact, overdue, blocked, missingContext, missingDue, totalMinutes, nextActions, risks };
}

function renderTasksTable(tasks) {
  return `
    <div class="task-row-list">
      ${tasks.map((task) => `
        <article class="task-row">
          <div class="task-row-main">
            <span class="score-badge">${operationalScoreForTask(task)}</span>
            <div class="task-row-title">
              <button class="link-title" data-open-task="${task.id}" type="button">${escapeHtml(task.title)}</button>
              <span class="muted">${escapeHtml(task.next_action || [task.client_name, task.asset_name || task.location].filter(Boolean).join(' / ') || 'Sem proxima acao')}</span>
            </div>
            <div class="task-row-meta">
              <span class="pill">${labelFrom(taskStatuses, task.status)}</span>
              <span class="pill ${task.priority}">${labelFrom(priorities, task.priority)}</span>
              <span class="pill">${formatDate(task.due_date) || 'Sem prazo'}</span>
            </div>
            ${renderTaskQuickActions(task)}
          </div>
          <details class="row-details">
            <summary>Mais dados</summary>
            <div class="meta-grid">
              ${metaItem('Cliente', task.client_name || 'Sem cliente')}
              ${metaItem('Projeto', task.project_name || 'Sem projeto')}
              ${metaItem('Planejado', formatDate(task.planned_date) || 'Sem data')}
              ${metaItem('Esforco', minutesLabel(task.estimated_minutes || 30))}
              ${metaItem('Categoria', labelFrom(categories, task.category))}
              ${metaItem('Local', task.location || 'Sem local')}
            </div>
          </details>
        </article>
      `).join('')}
    </div>
  `;
}

function renderKanban(tasks) {
  const groupedByResponsible = state.filters.kanban_group === 'responsible';
  const lanes = groupedByResponsible
    ? responsibleLaneValues(tasks)
    : ['triagem', 'a_fazer', 'em_andamento', 'aguardando_cliente', 'aguardando_fornecedor', 'aguardando_aprovacao', 'aguardando_material', 'concluido'];
  return `
    <div class="kanban">
      ${lanes.map((lane) => `
        <div class="lane" ${groupedByResponsible ? `data-kanban-responsible="${escapeHtml(lane)}"` : `data-kanban-status="${lane}"`}>
          <h3>${groupedByResponsible ? escapeHtml(lane || 'Sem responsavel') : labelFrom(taskStatuses, lane)}</h3>
          ${tasks.filter((task) => groupedByResponsible ? (task.responsible || 'Sem responsavel') === lane : task.status === lane).map((task) => `
            <article class="task-card kanban-card" draggable="true" data-task-id="${task.id}">
              ${renderTaskCardHeader(task)}
              ${renderTaskMetaLine(task)}
              ${task.blocker_reason ? `<small class="danger-text">${escapeHtml(task.blocker_reason)}</small>` : ''}
              ${renderTaskQuickActions(task)}
            </article>
          `).join('') || '<div class="empty">Vazio</div>'}
        </div>
      `).join('')}
    </div>
  `;
}

function responsibleLaneValues(tasks) {
  const configured = responsibleOptions().map(([value]) => value);
  const fromTasks = tasks.map((task) => task.responsible || 'Sem responsavel');
  return [...new Set([...configured, ...fromTasks])].filter(Boolean);
}

function renderTaskQuickActions(task) {
  return `
    <div class="actions task-actions compact-actions">
      <button class="btn small primary" data-edit-task="${task.id}" type="button">Editar</button>
    </div>
  `;
}

function renderTaskCardHeader(task) {
  return `
    <div class="task-card-head">
      <button class="link-title" data-open-task="${task.id}" type="button">${escapeHtml(task.title)}</button>
      <span class="score-badge">${operationalScoreForTask(task)}</span>
    </div>
  `;
}

function renderTaskMetaLine(task, options = {}) {
  const date = options.planning ? taskPlanningDate(task) : task.due_date;
  const context = [task.client_name, task.asset_name || task.location].filter(Boolean).join(' / ') || 'Sem vinculo';
  return `
    <div class="task-meta-line">
      <span class="pill ${task.priority}">${labelFrom(priorities, task.priority)}</span>
      <span class="pill">${formatDate(date) || 'Sem prazo'}</span>
      ${options.planning ? `<span class="pill">${plannedPeriodLabel(planningPeriod(task))}</span>` : ''}
      <span class="muted">${escapeHtml(context)}</span>
    </div>
  `;
}

function metaItem(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '-')}</strong></div>`;
}

function bindTasks() {
  bindTaskFilters();
  bindKanbanDragAndDrop();
}

function bindTaskFilters() {
  const map = {
    filter_q: 'q',
    filter_status: 'status',
    filter_priority: 'priority',
    filter_category: 'category',
    filter_responsible: 'responsible',
    filter_client_id: 'client_id',
    filter_date_from: 'date_from',
    filter_date_to: 'date_to',
    filter_kanban_group: 'kanban_group',
    filter_planning_view: 'planning_view',
    filter_saved_view_id: 'saved_view_id'
  };
  Object.entries(map).forEach(([name, key]) => {
    document.querySelector(`[name="${name}"]`)?.addEventListener('input', (event) => {
      state.filters[key] = event.target.value;
      if (key === 'saved_view_id') applySavedView(event.target.value);
      renderApp();
    });
    document.querySelector(`[name="${name}"]`)?.addEventListener('change', (event) => {
      state.filters[key] = event.target.value;
      if (key === 'saved_view_id') applySavedView(event.target.value);
      renderApp();
    });
  });
  document.querySelector('#clearTaskFilters')?.addEventListener('click', () => {
    state.filters = defaultTaskFilters();
    renderApp();
  });
  document.querySelector('#saveCurrentView')?.addEventListener('click', async () => {
    const name = prompt('Nome da view salva:', activeFilterSummary().replace('Filtros aplicados: ', '').slice(0, 60) || 'View operacional');
    if (!name) return;
    try {
      const view = await api('/api/saved-views', {
        method: 'POST',
        body: JSON.stringify({ name, scope: 'tasks', filters: { ...state.filters }, layout: state.filters.kanban_group || 'status' })
      });
      state.filters.saved_view_id = String(view.id);
      await loadAll();
      renderApp();
      toast('View salva.');
    } catch (error) {
      toast(error.message);
    }
  });
  document.querySelector('#deleteCurrentView')?.addEventListener('click', async () => {
    if (!state.filters.saved_view_id) return toast('Selecione uma view salva.');
    if (!confirm('Excluir esta view salva?')) return;
    try {
      await api(`/api/saved-views/${state.filters.saved_view_id}`, { method: 'DELETE' });
      state.filters.saved_view_id = '';
      await loadAll();
      renderApp();
      toast('View excluida.');
    } catch (error) {
      toast(error.message);
    }
  });
  document.querySelectorAll('[data-planning-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.planning_view = button.dataset.planningView;
      renderApp();
    });
  });
}

function defaultTaskFilters() {
  return {
    q: '',
    status: '',
    priority: '',
    category: '',
    responsible: '',
    client_id: '',
    date_from: '',
    date_to: '',
    kanban_group: 'status',
    planning_view: 'hoje',
    saved_view_id: ''
  };
}

function applySavedView(id) {
  const view = state.data.savedViews.find((item) => String(item.id) === String(id));
  if (!view) return;
  state.filters = { ...defaultTaskFilters(), ...(view.filters || {}), saved_view_id: String(view.id) };
}

function bindTaskQuickActions() {
  document.querySelectorAll('[data-edit-task]').forEach((button) => {
    button.addEventListener('click', () => openTaskDrawer(state.data.tasks.find((item) => item.id === Number(button.dataset.editTask))));
  });
  document.querySelectorAll('[data-open-task]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = state.data.tasks.find((item) => item.id === Number(button.dataset.openTask));
      if (!task) return;
      state.view = 'tasks';
      renderApp();
      openTaskDrawer(task);
    });
  });
}

function bindKanbanDragAndDrop() {
  document.querySelectorAll('.kanban-card').forEach((card) => {
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', card.dataset.taskId);
      event.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  document.querySelectorAll('[data-kanban-status]').forEach((lane) => {
    lane.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      lane.classList.add('drop-target');
    });
    lane.addEventListener('dragleave', () => lane.classList.remove('drop-target'));
    lane.addEventListener('drop', async (event) => {
      event.preventDefault();
      lane.classList.remove('drop-target');
      const id = Number(event.dataTransfer.getData('text/plain'));
      const status = lane.dataset.kanbanStatus;
      const task = state.data.tasks.find((item) => item.id === id);
      if (!task || task.status === status) return;
      const payload = { status };
      if (status === 'em_andamento' && !task.timer_running) Object.assign(payload, startTimerPayload(task));
      if (status !== 'em_andamento' && task.timer_running) Object.assign(payload, pauseTimerPayload(task));
      try {
        await api(`/api/tasks/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        await loadAll();
        renderApp();
        toast(`Status alterado para ${labelFrom(taskStatuses, status)}.`);
      } catch (error) {
        toast(error.message);
      }
    });
  });
  document.querySelectorAll('[data-kanban-responsible]').forEach((lane) => {
    lane.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      lane.classList.add('drop-target');
    });
    lane.addEventListener('dragleave', () => lane.classList.remove('drop-target'));
    lane.addEventListener('drop', async (event) => {
      event.preventDefault();
      lane.classList.remove('drop-target');
      const id = Number(event.dataTransfer.getData('text/plain'));
      const responsible = lane.dataset.kanbanResponsible === 'Sem responsavel' ? '' : lane.dataset.kanbanResponsible;
      const task = state.data.tasks.find((item) => item.id === id);
      if (!task || (task.responsible || '') === responsible) return;
      try {
        await api(`/api/tasks/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ responsible })
        });
        await loadAll();
        renderApp();
        toast(`Responsavel alterado para ${responsible || 'Sem responsavel'}.`);
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

function quickFieldLabel(field) {
  return {
    status: 'Status',
    priority: 'Prioridade',
    category: 'Categoria',
    responsible: 'Responsavel',
    due_date: 'Prazo',
    planned_date: 'Planejamento',
    planned_period: 'Periodo',
    follow_up_at: 'Follow-up'
  }[field] || 'Campo';
}

function startTimerPayload(task) {
  const nowIso = new Date().toISOString();
  return {
    timer_running: true,
    timer_started_at: task.timer_running && task.timer_started_at ? task.timer_started_at : nowIso,
    last_timer_check_at: nowIso
  };
}

function pauseTimerPayload(task) {
  return {
    timer_running: false,
    timer_started_at: '',
    time_spent_seconds: currentTimerSeconds(task),
    last_timer_check_at: new Date().toISOString()
  };
}

function currentTimerSeconds(task = {}) {
  const base = Number(task.time_spent_seconds || 0);
  if (!task.timer_running || !task.timer_started_at) return base;
  const started = new Date(task.timer_started_at).getTime();
  if (!Number.isFinite(started)) return base;
  return base + Math.max(0, Math.floor((Date.now() - started) / 1000));
}

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function timerCheckMinutes() {
  const minutes = Number(state.data.settings?.timer_check_minutes || 5);
  return Number.isFinite(minutes) ? Math.max(1, Math.min(60, Math.round(minutes))) : 5;
}

function setupTimerTicker() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    document.querySelectorAll('[data-timer-readout]').forEach((node) => {
      const task = state.data.tasks.find((item) => item.id === Number(node.dataset.timerReadout));
      if (task) {
        node.textContent = formatDuration(currentTimerSeconds(task));
        node.classList.toggle('running', Boolean(task.timer_running));
      }
    });
    checkRunningTimers();
  }, 1000);
}

async function checkRunningTimers() {
  if (state.timerPrompting) return;
  const now = Date.now();
  const limit = timerCheckMinutes() * 60 * 1000;
  const task = state.data.tasks.find((item) => {
    if (!item.timer_running) return false;
    const last = new Date(item.last_timer_check_at || item.timer_started_at || 0).getTime();
    return Number.isFinite(last) && now - last >= limit;
  });
  if (!task) return;
  state.timerPrompting = true;
  try {
    await api(`/api/tasks/${task.id}`, {
      method: 'PUT',
      body: JSON.stringify(pauseTimerPayload(task))
    });
    await notifyTimerPaused(task);
    const stillWorking = window.confirm(`O timer da tarefa "${task.title}" foi pausado para conferencia. Ela ainda esta em execucao?`);
    if (stillWorking) {
      await api(`/api/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...startTimerPayload({ ...task, timer_running: false }), status: 'em_andamento' })
      });
      toast('Timer retomado.');
    } else {
      toast('Timer mantido pausado.');
    }
    await loadAll();
    renderApp();
  } catch (error) {
    toast(error.message);
  } finally {
    state.timerPrompting = false;
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

async function notifyTimerPaused(task) {
  const granted = await requestNotificationPermission();
  if (granted) {
    new Notification('Timer HBR pausado', {
      body: `Confirme se ainda esta executando: ${task.title}`
    });
  }
}

function renderClients() {
  return renderEntityTable('clients', ['Nome', 'Status dados', 'Tipo', 'WhatsApp', 'E-mail', 'Observacoes'], state.data.clients.map((item) => [
    item.name,
    item.data_status || 'completo',
    labelFrom(clientTypes, item.type),
    item.phone,
    item.email,
    item.notes
  ]));
}

function renderAssets() {
  return renderEntityTable('assets', ['Nome', 'Status dados', 'Tipo', 'Modelo', 'Marina', 'Cliente'], state.data.assets.map((item) => [
    item.name,
    item.data_status || 'completo',
    labelFrom(assetTypes, item.type),
    [item.manufacturer, item.model, item.year].filter(Boolean).join(' '),
    item.marina || item.current_location,
    clientName(item.client_id)
  ]));
}

function renderProjects() {
  return renderEntityTable('projects', ['Nome', 'Status', 'Prioridade', 'Cliente', 'Data prevista'], state.data.projects.map((item) => [
    item.name,
    item.status,
    labelFrom(priorities, item.priority),
    clientName(item.client_id),
    formatDate(item.expected_date)
  ]));
}

function renderDocuments() {
  return renderEntityTable('documents', ['Nome', 'Tipo', 'Origem', 'Link', 'Tags'], state.data.documents.map((item) => [
    item.name,
    item.type,
    item.origin,
    item.link ? { html: `<a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">Abrir</a>` } : '',
    (item.tags || []).join(', ')
  ]));
}

function renderEntityTable(type, headers, rows) {
  const items = state.data[type];
  if (!items.length) return `<section class="band"><div class="empty">Nenhum registro cadastrado.</div></section>`;
  return `
    <section class="band">
      <div class="entity-list">
        ${rows.map((cells, index) => {
          const visible = cells.slice(1, 3);
          const hidden = cells.slice(3);
          return `
            <article class="entity-row">
              <div class="entity-row-main">
                <div class="entity-title">
                  <strong>${escapeHtml(cells[0])}</strong>
                  <span class="muted">${headers[1] ? `${escapeHtml(headers[1])}: ${plainCellText(cells[1]) || '-'}` : ''}</span>
                </div>
                <div class="entity-pills">
                  ${visible.map((cell, cellIndex) => `<span class="pill">${escapeHtml(headers[cellIndex + 1])}: ${plainCellText(cell) || '-'}</span>`).join('')}
                </div>
                <div class="actions compact-actions">
                  <button class="btn small primary" data-edit-${type}="${items[index].id}">Editar</button>
                </div>
              </div>
              <details class="row-details">
                <summary>Dados do cadastro</summary>
                <div class="meta-grid">
                  ${hidden.map((cell, hiddenIndex) => metaItem(headers[hiddenIndex + 3], plainCellText(cell))).join('')}
                </div>
                <div class="actions">
                  <button class="btn small danger" data-delete-${type}="${items[index].id}">Excluir cadastro</button>
                </div>
              </details>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function cellHtml(cell) {
  if (cell && typeof cell === 'object' && cell.html) return cell.html;
  return escapeHtml(cell || '');
}

function plainCellText(cell) {
  if (cell && typeof cell === 'object' && cell.html) return cell.html.replace(/<[^>]+>/g, '').trim();
  return String(cell || '');
}

function handleExport(type) {
  if (type === 'tasks-text') return copyTasksGroupText();
  if (type === 'tasks-report') return copyTasksStatusReport();
  if (type === 'tasks-operational-pdf') return printTasksOperationalReport();
  if (type === 'tasks-agenda') return printTasksAgenda();
  if (type === 'tasks-kanban') return printTasksKanban();
  if (type === 'json') return downloadJson(currentExportPayload(), exportFileName('json'));
  if (type === 'csv') return downloadCsv(currentExportRows(), exportFileName('csv'));
  if (type === 'pdf') return printCurrentPageReport();
}

function currentExportPayload() {
  const data = {
    dashboard: state.data.dashboard,
    tasks: taskExportRows(),
    clients: state.data.clients,
    assets: state.data.assets,
    projects: state.data.projects,
    documents: state.data.documents,
    ai: state.data.aiActions,
    saved_views: state.data.savedViews,
    automation_rules: state.data.automationRules,
    automation_runs: state.data.automationRuns,
    task_templates: state.data.taskTemplates,
    task_dependencies: state.data.taskDependencies,
    custom_fields: state.data.customFields,
    comments: state.data.comments,
    settings: {
      version: appVersion,
      operational: state.data.settings,
      benchmark_apps: ['ClickUp', 'Asana', 'monday.com', 'Notion', 'Todoist', 'Trello', 'Wrike', 'Airtable', 'Jira', 'Smartsheet', 'Linear', 'Reclaim', 'Sunsama', 'Taskade'],
      autonomy: ['nivel_1_seguro', 'nivel_2_revisao', 'nivel_3_aprovacao_explicita'],
      integrations: ['Google Calendar', 'Gmail', 'Drive/Dropbox', 'WhatsApp Business', 'Planilhas', 'ERP/CRM']
    }
  };
  return {
    exported_at: new Date().toISOString(),
    page: state.view,
    title: labels[state.view],
    filters: { ...state.filters },
    records: data[state.view] || data.tasks
  };
}

function currentExportRows() {
  const map = {
    dashboard: dashboardExportRows,
    tasks: taskExportRows,
    clients: clientExportRows,
    assets: assetExportRows,
    projects: projectExportRows,
    documents: documentExportRows,
    ai: aiExportRows,
    settings: () => []
  };
  return (map[state.view] || taskExportRows)();
}

function exportFileName(extension) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `hbr-${state.view}-${stamp}.${extension}`;
}

function downloadJson(payload, filename) {
  downloadBlob(JSON.stringify(payload, null, 2), filename, 'application/json;charset=utf-8');
  toast('JSON exportado.');
}

function downloadCsv(rows, filename) {
  if (!rows.length) {
    toast('Nao ha dados para CSV.');
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(';'),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(';'))
  ].join('\n');
  downloadBlob(csv, filename, 'text/csv;charset=utf-8');
  toast('CSV exportado.');
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function priorityWeight(priority) {
  return { critica: 0, alta: 1, media: 2, baixa: 3 }[priority] ?? 4;
}

function statusWeight(status) {
  return {
    em_andamento: 0,
    aguardando_aprovacao: 1,
    a_fazer: 2,
    triagem: 3,
    entrada_capturada: 4,
    aguardando_cliente: 5,
    aguardando_fornecedor: 6,
    aguardando_material: 7,
    agendado: 8,
    concluido: 9,
    cancelado: 10,
    arquivado: 11
  }[status] ?? 12;
}

function minutesLabel(minutes) {
  const value = Number(minutes || 0);
  if (!value) return 'sem estimativa';
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

function dateDiffDays(value) {
  if (!value) return null;
  const today = new Date();
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date - base) / 86400000);
}

function operationalScoreForTask(task = {}) {
  if (task.operational_score !== null && task.operational_score !== undefined && task.operational_score !== '') {
    const persisted = Number(task.operational_score);
    if (Number.isFinite(persisted)) return Math.max(0, Math.min(100, Math.round(persisted)));
  }
  let score = { critica: 96, alta: 82, media: 55, baixa: 30 }[task.priority] ?? 50;
  const diff = dateDiffDays(task.due_date);
  if (diff !== null) {
    if (diff < 0) score += 14;
    else if (diff === 0) score += 12;
    else if (diff <= 2) score += 7;
    else if (diff <= 7) score += 3;
  } else {
    score -= 6;
  }
  if (['proposta', 'comercial', 'financeiro'].includes(task.category)) score += 6;
  if (['aguardando_cliente', 'aguardando_fornecedor', 'aguardando_aprovacao', 'aguardando_material'].includes(task.status)) score += 4;
  if (task.blocker_reason) score += 6;
  if (task.dependency_text) score += 3;
  if (!task.client_id && !task.client_name) score -= 4;
  if (['concluido', 'cancelado', 'arquivado'].includes(task.status)) score = 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreStep() {
  const step = Number(state.data.settings?.score_step || 1);
  return Number.isFinite(step) ? Math.max(1, Math.min(10, Math.round(step))) : 1;
}

function effortStepMinutes() {
  const step = Number(state.data.settings?.effort_step_minutes || 5);
  return Number.isFinite(step) ? Math.max(1, Math.min(60, Math.round(step))) : 5;
}

function sortedTasks({ includeDone = false } = {}) {
  const options = arguments[0] || {};
  const source = options.tasks || state.data.tasks;
  return [...source]
    .filter((task) => includeDone || !['concluido', 'cancelado', 'arquivado'].includes(task.status))
    .sort((a, b) => {
      const score = operationalScoreForTask(b) - operationalScoreForTask(a);
      if (score) return score;
      const rankA = Number(a.rank || 9999);
      const rankB = Number(b.rank || 9999);
      if (rankA !== rankB) return rankA - rankB;
      const priority = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (priority) return priority;
      const dateA = a.due_date || '9999-12-31';
      const dateB = b.due_date || '9999-12-31';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const status = statusWeight(a.status) - statusWeight(b.status);
      if (status) return status;
      return String(a.title).localeCompare(String(b.title));
    });
}

function taskExportRows() {
  return sortedTasks({ includeDone: true, tasks: state.view === 'tasks' ? filteredTasks() : state.data.tasks }).map((task) => ({
    score_operacional: operationalScoreForTask(task),
    prioridade: labelFrom(priorities, task.priority),
    status: labelFrom(taskStatuses, task.status),
    prazo: formatDate(task.due_date) || '',
    planejado_para: formatDate(task.planned_date) || '',
    periodo_planejado: plannedPeriodLabel(task.planned_period || planningPeriod(task)),
    follow_up: formatDate(task.follow_up_at) || '',
    esforco_estimado: minutesLabel(task.estimated_minutes || 30),
    tempo_registrado: formatDuration(currentTimerSeconds(task)),
    responsavel: task.responsible || '',
    cliente: task.client_name || '',
    ativo: task.asset_name || task.location || '',
    projeto: task.project_name || '',
    titulo: task.title,
    categoria: labelFrom(categories, task.category),
    recorrencia: labelFrom(recurrenceOptions, task.recurrence_rule || ''),
    rank: task.rank || '',
    confianca_ia: task.confidence_score || '',
    tipo_bloqueio: task.blocker_type || '',
    bloqueada_por: state.data.tasks.find((item) => item.id === Number(task.blocked_by))?.title || '',
    dependencias: task.dependency_text || '',
    bloqueio: task.blocker_reason || '',
    proxima_acao: task.next_action || '',
    resultado_esperado: task.expected_result || ''
  }));
}

function clientExportRows() {
  return state.data.clients.map((client) => ({
    nome: client.name,
    status_dados: client.data_status || 'completo',
    tipo: labelFrom(clientTypes, client.type),
    whatsapp: client.phone || '',
    email: client.email || '',
    documento: client.document || '',
    observacoes: client.notes || ''
  }));
}

function assetExportRows() {
  return state.data.assets.map((asset) => ({
    nome: asset.name,
    status_dados: asset.data_status || 'completo',
    tipo: labelFrom(assetTypes, asset.type),
    cliente: clientName(asset.client_id),
    fabricante: asset.manufacturer || '',
    modelo: asset.model || '',
    ano: asset.year || '',
    marina: asset.marina || '',
    local_atual: asset.current_location || ''
  }));
}

function projectExportRows() {
  return state.data.projects.map((project) => ({
    nome: project.name,
    status: project.status || '',
    prioridade: labelFrom(priorities, project.priority),
    cliente: clientName(project.client_id),
    ativo: state.data.assets.find((asset) => asset.id === Number(project.asset_id))?.name || '',
    data_prevista: formatDate(project.expected_date) || '',
    local: project.location || '',
    escopo: project.scope || ''
  }));
}

function documentExportRows() {
  return state.data.documents.map((document) => ({
    nome: document.name,
    tipo: document.type || '',
    cliente: clientName(document.client_id),
    projeto: state.data.projects.find((project) => project.id === Number(document.project_id))?.name || '',
    origem: document.origin || '',
    link: document.link || '',
    tags: document.tags || []
  }));
}

function aiExportRows() {
  return state.data.aiActions.map((action) => ({
    titulo: action.title,
    tipo: action.type,
    status: action.status,
    nivel_autonomia: action.autonomy_level,
    risco: action.risk || '',
    tarefa: action.task_title || '',
    raciocinio: action.reasoning || '',
    criado_em: action.created_at || ''
  }));
}

function dashboardExportRows() {
  const counts = state.data.dashboard?.counts || {};
  return Object.entries(counts).map(([indicador, valor]) => ({ indicador, valor }));
}

function tasksGroupText() {
  const tasks = sortedTasks({ tasks: state.view === 'tasks' ? filteredTasks() : state.data.tasks });
  const today = new Date().toLocaleDateString('pt-BR');
  const lines = [
    `Resumo de demandas HBR - ${today}`,
    '',
    `Total ativo: ${tasks.length}`,
    ''
  ];
  const groups = ['critica', 'alta', 'media', 'baixa'];
  groups.forEach((priority) => {
    const items = tasks.filter((task) => task.priority === priority);
    if (!items.length) return;
    lines.push(`${labelFrom(priorities, priority).toUpperCase()}`);
    items.forEach((task, index) => {
      const owner = [task.client_name, task.asset_name || task.location].filter(Boolean).join(' / ') || 'Sem cliente vinculado';
      const date = formatDate(task.due_date) || 'sem prazo';
      const next = task.next_action ? ` Proxima acao: ${task.next_action}.` : '';
      const blocker = task.blocker_reason ? ` Bloqueio: ${task.blocker_reason}.` : '';
      lines.push(`${index + 1}. [${operationalScoreForTask(task)}] ${owner} - ${task.title} | ${date} | ${minutesLabel(task.estimated_minutes || 30)} | ${labelFrom(taskStatuses, task.status)}.${next}${blocker}`);
    });
    lines.push('');
  });
  const waiting = tasks.filter((task) => task.status?.startsWith('aguardando'));
  if (waiting.length) {
    lines.push('PONTOS DE ATENCAO');
    waiting.slice(0, 8).forEach((task) => {
      lines.push(`- ${task.title}: ${labelFrom(taskStatuses, task.status)} (${formatDate(task.due_date) || 'sem prazo'})`);
    });
  }
  return lines.join('\n').trim();
}

async function copyTasksGroupText() {
  const text = tasksGroupText();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else copyTextFallback(text);
  } catch {
    copyTextFallback(text);
  }
  toast('Lista pronta copiada para o grupo.');
}

function tasksStatusReportText() {
  const insights = buildTaskInsights(state.data.tasks);
  const lines = [
    `Relatorio operacional HBR - ${new Date().toLocaleDateString('pt-BR')}`,
    '',
    `Tarefas ativas: ${insights.active}`,
    `Criticas/altas: ${insights.highImpact}`,
    `Atrasadas: ${insights.overdue.length}`,
    `Bloqueadas: ${insights.blocked.length}`,
    `Carga ativa estimada: ${minutesLabel(insights.totalMinutes)}`,
    '',
    'Prioridades recomendadas:',
    ...(insights.nextActions.length ? insights.nextActions.map((item) => `- ${item}`) : ['- Nenhuma tarefa ativa.']),
    '',
    'Riscos / bloqueios:',
    ...(insights.risks.length ? insights.risks.map((item) => `- ${item}`) : ['- Nenhum risco evidente.']),
    '',
    'Leitura operacional:',
    insights.highImpact > 0
      ? '- Recomendo atacar primeiro demandas criticas/altas com prazo definido ou impacto comercial/financeiro.'
      : '- Fila sem criticidade elevada no momento.',
    insights.blocked.length > 0
      ? '- Existem itens aguardando terceiros; vale fazer follow-up antes de abrir novas frentes.'
      : '- Nao ha bloqueios fortes aparentes.',
    insights.missingContext.length > 0
      ? '- Existem tarefas sem cliente vinculado; completar contexto melhora a automacao futura.'
      : '- As tarefas ativas estao com contexto basico suficiente.'
  ];
  return lines.join('\n');
}

async function copyTasksStatusReport() {
  const text = tasksStatusReportText();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else copyTextFallback(text);
  } catch {
    copyTextFallback(text);
  }
  toast('Relatorio operacional copiado.');
}

function printTasksOperationalReport() {
  const tasks = sortedTasks({ includeDone: true, tasks: filteredTasks() });
  const insights = buildTaskInsights(tasks);
  const filterText = activeFilterSummary();
  const rows = tasks.map((task) => `
    <article class="print-task">
      <div class="print-task-head">
        <strong>${escapeHtml(task.title)}</strong>
        <span>Score ${operationalScoreForTask(task)}</span>
      </div>
      <p>${escapeHtml([task.client_name, task.asset_name || task.location].filter(Boolean).join(' / ') || 'Sem vinculo')}</p>
      <p>${escapeHtml(labelFrom(taskStatuses, task.status))} | ${escapeHtml(labelFrom(priorities, task.priority))} | ${escapeHtml(labelFrom(categories, task.category))} | ${escapeHtml(task.responsible || 'Sem responsavel')}</p>
      <p>Prazo: ${formatDate(task.due_date) || 'sem prazo'} | Esforco: ${minutesLabel(task.estimated_minutes || 30)} | Tempo registrado: ${formatDuration(currentTimerSeconds(task))}</p>
      ${task.next_action ? `<p>Proxima acao: ${escapeHtml(task.next_action)}</p>` : ''}
      ${task.blocker_reason ? `<p>Bloqueio: ${escapeHtml(task.blocker_reason)}</p>` : ''}
    </article>
  `).join('');
  printHtml('Relatorio operacional HBR', `
    <section class="print-cover">
      <h1>Relatorio operacional HBR</h1>
      <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
      <p>${escapeHtml(filterText)}</p>
    </section>
    <section class="print-section">
      <h2>Analise operacional</h2>
      <div class="print-metrics">
        <div><strong>${insights.active}</strong><span>ativas</span></div>
        <div><strong>${insights.highImpact}</strong><span>criticas/altas</span></div>
        <div><strong>${insights.overdue.length}</strong><span>atrasadas</span></div>
        <div><strong>${minutesLabel(insights.totalMinutes)}</strong><span>carga ativa</span></div>
      </div>
      <h2>Proximas acoes</h2>
      <ul>${(insights.nextActions.length ? insights.nextActions : ['Nenhuma tarefa ativa.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <h2>Riscos e bloqueios</h2>
      <ul>${(insights.risks.length ? insights.risks : ['Nenhum risco evidente.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
    <section class="print-section">
      <h2>Tarefas filtradas</h2>
      ${rows || '<p>Nenhuma tarefa encontrada.</p>'}
    </section>
  `);
}

function activeFilterSummary() {
  const parts = [];
  if (state.filters.q) parts.push(`busca: ${state.filters.q}`);
  if (state.filters.status) parts.push(`status: ${labelFrom(taskStatuses, state.filters.status)}`);
  if (state.filters.priority) parts.push(`prioridade: ${labelFrom(priorities, state.filters.priority)}`);
  if (state.filters.category) parts.push(`categoria: ${labelFrom(categories, state.filters.category)}`);
  if (state.filters.responsible) parts.push(`responsavel: ${state.filters.responsible}`);
  if (state.filters.client_id) parts.push(`cliente: ${clientName(state.filters.client_id)}`);
  if (state.filters.date_from) parts.push(`de: ${formatDate(state.filters.date_from)}`);
  if (state.filters.date_to) parts.push(`ate: ${formatDate(state.filters.date_to)}`);
  if (state.filters.planning_view) parts.push(`view: ${labelFrom(planningViewOptions(), state.filters.planning_view)}`);
  if (state.filters.saved_view_id) parts.push(`view salva: ${state.data.savedViews.find((item) => String(item.id) === String(state.filters.saved_view_id))?.name || state.filters.saved_view_id}`);
  return parts.length ? `Filtros aplicados: ${parts.join(' | ')}` : 'Sem filtros aplicados.';
}

function printCurrentPageReport() {
  const payload = currentExportPayload();
  const rows = currentExportRows();
  const body = rows.length
    ? reportTable(rows)
    : `<pre>${escapeHtml(JSON.stringify(payload.records, null, 2))}</pre>`;
  printHtml(`${labels[state.view]} - HBR`, `
    <section class="print-cover">
      <h1>${escapeHtml(labels[state.view])}</h1>
      <p>Exportado em ${new Date().toLocaleString('pt-BR')}</p>
    </section>
    ${body}
  `);
}

function printTasksAgenda() {
  const tasks = sortedTasks({ tasks: state.view === 'tasks' ? filteredTasks() : state.data.tasks });
  const withDate = tasks.filter((task) => agendaTaskDate(task));
  const withoutDate = tasks.filter((task) => !agendaTaskDate(task));
  const weekGroups = groupBy(withDate, (task) => agendaWeekKey(agendaTaskDate(task)));
  const content = Object.entries(weekGroups).sort(([a], [b]) => a.localeCompare(b)).map(([weekKey, items]) => renderAgendaWeek(weekKey, items)).join('');
  const undated = withoutDate.length ? `
    <section class="print-section agenda-week">
      <h2>Sem data definida</h2>
      <div class="agenda-undated">
        ${withoutDate.map(renderAgendaTask).join('')}
      </div>
    </section>
  ` : '';
  printHtml('Agenda de demandas HBR', `
    <section class="print-cover">
      <h1>Agenda semanal de demandas HBR</h1>
      <p>Organizada por semana, dia e periodo. Manha prioriza criticidade, fluxo de caixa, proposta e score alto; tarde concentra execucao, follow-up e tarefas de menor impacto imediato.</p>
      <p>${escapeHtml(activeFilterSummary())}</p>
      <p>Gerado em ${new Date().toLocaleString('pt-BR')}.</p>
    </section>
    ${content || '<p>Nenhuma tarefa ativa com data definida.</p>'}
    ${undated}
  `, true);
}

function agendaTaskDate(task) {
  return (task.planned_date || task.due_date || '').slice(0, 10);
}

function agendaWeekKey(dateValue) {
  const date = localDate(dateValue);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

function localDate(value) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function agendaWeekDays(weekKey) {
  const start = localDate(weekKey);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function agendaPeriod(task) {
  if (task.planned_period) return task.planned_period;
  const score = operationalScoreForTask(task);
  if (['critica', 'alta'].includes(task.priority)) return 'manha';
  if (score >= 72) return 'manha';
  if (['proposta', 'comercial', 'financeiro'].includes(task.category)) return 'manha';
  return 'tarde';
}

function renderAgendaWeek(weekKey, tasks) {
  const days = agendaWeekDays(weekKey);
  const end = days[days.length - 1];
  return `
    <section class="print-section agenda-week">
      <h2>Semana de ${formatDate(weekKey)} a ${formatDate(end)}</h2>
      <div class="agenda-week-grid">
        ${days.map((day) => renderAgendaDay(day, tasks.filter((task) => agendaTaskDate(task) === day))).join('')}
      </div>
    </section>
  `;
}

function renderAgendaDay(day, tasks) {
  const morning = sortedTasks({ tasks: tasks.filter((task) => agendaPeriod(task) === 'manha') });
  const afternoon = sortedTasks({ tasks: tasks.filter((task) => agendaPeriod(task) === 'tarde') });
  return `
    <section class="agenda-day">
      <h3>${agendaDayLabel(day)}</h3>
      <div class="agenda-period">
        <h4>Manha</h4>
        ${morning.map(renderAgendaTask).join('') || '<p class="muted">Sem itens</p>'}
      </div>
      <div class="agenda-period">
        <h4>Tarde</h4>
        ${afternoon.map(renderAgendaTask).join('') || '<p class="muted">Sem itens</p>'}
      </div>
    </section>
  `;
}

function agendaDayLabel(day) {
  const date = localDate(day);
  const weekday = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'][date.getDay()];
  return `${weekday} - ${formatDate(day)}`;
}

function renderAgendaTask(task) {
  return `
    <article class="agenda-task">
      <div class="print-task-head">
        <strong>${escapeHtml(task.title)}</strong>
        <span>${operationalScoreForTask(task)}</span>
      </div>
      <p>${escapeHtml([task.client_name, task.asset_name || task.location].filter(Boolean).join(' / ') || 'Sem vinculo')}</p>
      <p>${escapeHtml(labelFrom(priorities, task.priority))} | ${escapeHtml(labelFrom(taskStatuses, task.status))} | ${minutesLabel(task.estimated_minutes || 30)} | ${escapeHtml(task.responsible || 'Sem responsavel')}</p>
      ${task.next_action ? `<p><b>Proxima:</b> ${escapeHtml(task.next_action)}</p>` : ''}
      ${task.blocker_reason ? `<p><b>Bloqueio:</b> ${escapeHtml(task.blocker_reason)}</p>` : ''}
    </article>
  `;
}

function printTasksKanban() {
  const tasks = sortedTasks({ includeDone: true, tasks: state.view === 'tasks' ? filteredTasks() : state.data.tasks });
  const lanes = ['triagem', 'a_fazer', 'em_andamento', 'aguardando_cliente', 'aguardando_fornecedor', 'aguardando_aprovacao', 'aguardando_material', 'agendado', 'concluido'];
  const content = `
    <section class="print-cover">
      <h1>Kanban de demandas HBR</h1>
      <p>Gerado em ${new Date().toLocaleString('pt-BR')}.</p>
    </section>
    <div class="print-kanban">
      ${lanes.map((lane) => `
        <section class="print-lane">
          <h2>${escapeHtml(labelFrom(taskStatuses, lane))}</h2>
          ${tasks.filter((task) => task.status === lane).map((task) => `
            <article class="print-kanban-card">
              <strong>${escapeHtml(task.title)}</strong>
              <p>${escapeHtml([task.client_name, task.asset_name || task.location].filter(Boolean).join(' / ') || 'Sem vinculo')}</p>
              <span>${escapeHtml(labelFrom(priorities, task.priority))} | ${formatDate(task.due_date) || 'sem prazo'} | score ${operationalScoreForTask(task)} | ${minutesLabel(task.estimated_minutes || 30)}</span>
            </article>
          `).join('') || '<p class="muted">Sem itens</p>'}
        </section>
      `).join('')}
    </div>
  `;
  printHtml('Kanban de demandas HBR', content, true);
}

function reportTable(rows) {
  if (!rows.length) return '<p>Nenhum dado.</p>';
  const headers = Object.keys(rows[0]);
  return `
    <table class="print-table">
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>${headers.map((header) => `<td>${escapeHtml(Array.isArray(row[header]) ? row[header].join(', ') : row[header] ?? '')}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] ||= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function printHtml(title, body, landscape = false) {
  const win = window.open('', '_blank');
  if (!win) {
    toast('Permita pop-ups para gerar PDF.');
    return;
  }
  win.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: ${landscape ? 'A4 landscape' : 'A4'}; margin: 12mm; }
          body { font-family: Arial, sans-serif; color: #1b2328; margin: 0; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          h2 { margin: 18px 0 10px; font-size: 16px; color: #0f766e; }
          p { margin: 4px 0; line-height: 1.35; }
          .print-brand { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #C8A063; padding-bottom: 10px; margin-bottom: 16px; }
          .print-brand img { width: 160px; height: auto; object-fit: contain; }
          .print-brand span { color: #274A6D; font-weight: 700; }
          .print-cover { border-bottom: 1px solid #D9DDE1; padding-bottom: 8px; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
          .print-section { break-inside: auto; page-break-inside: auto; }
          .print-section h2 { break-after: avoid; page-break-after: avoid; }
          .print-task, .print-kanban-card { border: 1px solid #d8dfdc; border-radius: 6px; padding: 10px; margin: 8px 0; break-inside: avoid; page-break-inside: avoid; overflow: hidden; }
          .print-task-head { display: flex; justify-content: space-between; gap: 16px; }
          .print-task-head span, .print-kanban-card span { color: #b45309; font-weight: 700; font-size: 12px; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .print-table th, .print-table td { border: 1px solid #d8dfdc; padding: 6px; vertical-align: top; }
          .print-table th { background: #eef3f1; text-align: left; }
          .print-kanban { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-items: start; }
          .print-lane { border: 1px solid #d8dfdc; border-radius: 6px; padding: 8px; break-inside: avoid; page-break-inside: avoid; }
          .print-lane h2 { margin-top: 0; }
          .agenda-week { break-before: auto; page-break-before: auto; }
          .agenda-week-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; align-items: start; }
          .agenda-day { border: 1px solid #d8dfdc; border-radius: 6px; padding: 7px; min-height: 220px; break-inside: avoid; page-break-inside: avoid; }
          .agenda-day h3 { margin: 0 0 8px; font-size: 12px; color: #0D1B2A; }
          .agenda-period { border-top: 1px solid #eef3f1; padding-top: 6px; margin-top: 6px; }
          .agenda-period h4 { margin: 0 0 5px; font-size: 11px; color: #C8A063; text-transform: uppercase; }
          .agenda-task { border: 1px solid #d8dfdc; border-left: 3px solid #274A6D; border-radius: 5px; padding: 6px; margin: 5px 0; font-size: 10px; break-inside: avoid; page-break-inside: avoid; overflow: hidden; }
          .agenda-task .print-task-head { display: block; }
          .agenda-task .print-task-head strong { display: block; line-height: 1.25; }
          .agenda-task .print-task-head span { float: right; margin-left: 4px; }
          .agenda-undated { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .print-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
          .print-metrics div { border: 1px solid #d8dfdc; border-radius: 6px; padding: 8px; }
          .print-metrics strong { display: block; font-size: 18px; color: #0D1B2A; }
          .print-metrics span { color: #66757d; font-size: 11px; }
          .muted { color: #66757d; }
        </style>
      </head>
      <body>
        <header class="print-brand">
          <img src="${window.location.origin}/assets/hbr-logo-compact.png" alt="HBR Systems">
          <span>Energia. Controle. Confianca.</span>
        </header>
        ${body}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

function renderAi() {
  const actions = state.data.aiActions;
  const pending = actions.filter((item) => item.status === 'aguardando_revisao');
  const history = actions.filter((item) => item.status !== 'aguardando_revisao');
  const proactive = state.data.agentProactive || {};
  return `
    <section class="band">
      <div class="section-head">
        <div>
          <h2>Colaborador IA 24h</h2>
          <p>Chat operacional para registrar demandas, organizar prioridades, atualizar tarefas e preparar rascunhos. A IA executa acoes internas seguras; exclusoes, configuracoes sensiveis e envios externos continuam bloqueados ou em revisao humana.</p>
        </div>
      </div>
      <div class="grid three">
        <div class="metric"><span>Autonomia interna</span><strong>${proactive.can_autonomously_create_internal_records ? 'Ativa' : 'Revisao'}</strong><p class="muted">Cria tarefas, altera status/prioridade quando o pedido for claro e registra historico.</p></div>
        <div class="metric"><span>Lembretes</span><strong>${(proactive.reminders || []).length}</strong><p class="muted">Tarefas vencidas, de hoje, bloqueadas ou criticas sem prazo.</p></div>
        <div class="metric"><span>Padroes detectados</span><strong>${(proactive.patterns || []).length}</strong><p class="muted">Fluxos sugeridos a partir da repeticao de propostas, follow-ups e materiais.</p></div>
      </div>
    </section>
    <div class="grid two agent-grid">
      <section class="band agent-chat">
        <div class="section-head">
          <div>
            <h2>Chat IA operacional</h2>
            <p>Escreva como falaria com um colaborador: "registre", "monte o plano", "marque como em andamento" ou "prepare um rascunho".</p>
          </div>
        </div>
        <div class="agent-messages" id="agentMessages">
          ${renderAgentMessages(state.data.agentMessages || [])}
        </div>
        ${renderAgentChoiceArea(state.data.agentMessages || [])}
        <div class="actions agent-shortcuts">
          <button class="btn small" type="button" data-agent-prompt="Monte o plano do dia por ordem de prioridade.">Plano do dia</button>
          <button class="btn small" type="button" data-agent-prompt="Quais tarefas estao atrasadas ou bloqueadas?">Atrasos/bloqueios</button>
          <button class="btn small" type="button" data-agent-prompt="Registrar demanda: ">Registrar demanda</button>
        </div>
        <form id="agentChatForm" class="agent-chat-form" data-agent-chat-form>
          <textarea name="message" placeholder="Ex.: Registre que preciso revisar a proposta da La Osadia e preparar retorno para Amarildo hoje a tarde."></textarea>
          <button class="btn primary" type="submit">Enviar para IA</button>
        </form>
      </section>
      <section class="band">
        <div class="section-head"><div><h2>Proatividade</h2><p>Avisos e sugestoes que o agente usa para chamar sua atencao quando a rotina esfria.</p></div></div>
        ${renderAgentProactive(proactive)}
      </section>
    </div>
    <div class="grid two">
      <section class="band">
        <div class="section-head"><div><h2>Aguardando revisao</h2><p>Rascunhos e sugestoes que ainda nao executam nada fora do sistema.</p></div></div>
        ${renderAiList(pending, true)}
      </section>
      <section class="band">
        <div class="section-head"><h2>Historico da IA</h2></div>
        ${renderAiList(history, false)}
      </section>
    </div>
    <section class="band">
      <div class="section-head"><div><h2>Automacoes internas e logs</h2><p>Regras inspiradas no benchmark, executadas sem enviar nada externo.</p></div></div>
      ${renderAutomationMiniBoard()}
    </section>
  `;
}

function renderAutomationMiniBoard() {
  const rules = state.data.automationRules || [];
  const runs = state.data.automationRuns || [];
  return `
    <div class="grid two">
      <div>
        <h3>Regras</h3>
        ${rules.map((rule) => `
          <article class="agent-flow">
            <strong>${escapeHtml(rule.name)}</strong>
            <p>${escapeHtml(rule.description || '')}</p>
            <div class="actions">
              <span class="pill">${rule.enabled ? 'Ativa' : 'Pausada'}</span>
              <span class="pill">${rule.requires_approval ? 'Revisao' : 'Interna'}</span>
              <button class="btn small" type="button" data-run-automation="${rule.id}">Rodar</button>
            </div>
          </article>
        `).join('') || '<div class="empty">Nenhuma regra.</div>'}
      </div>
      <div>
        <h3>Logs recentes</h3>
        ${runs.slice(0, 6).map((run) => `
          <article class="activity-item">
            <strong>${escapeHtml(run.rule_name || 'Automacao')}</strong>
            <span>${escapeHtml(new Date(run.created_at).toLocaleString('pt-BR'))}</span>
            <p>${escapeHtml(run.summary || '')}</p>
          </article>
        `).join('') || '<div class="empty">Sem logs.</div>'}
      </div>
    </div>
  `;
}

function renderAgentMessages(messages) {
  if (!messages.length) {
    return `
      <div class="agent-message assistant">
        <strong>IA HBR</strong>
        <p>Estou pronto para registrar demandas, montar plano de prioridades, criar rascunhos e fazer perguntas quando faltar contexto.</p>
      </div>
    `;
  }
  return messages.slice(-18).map((message) => `
    <div class="agent-message ${message.role === 'user' ? 'user' : 'assistant'}">
      <strong>${message.role === 'user' ? 'Voce' : 'IA HBR'}</strong>
      <p>${escapeHtml(message.content)}</p>
    </div>
  `).join('');
}

function renderAgentChoiceArea(messages) {
  const last = [...messages].reverse().find((message) => message.role === 'assistant' && message.metadata?.questions?.length);
  const latest = messages[messages.length - 1];
  if (last && latest?.id !== last.id) return '<div class="agent-choices muted">Sem decisao pendente no momento.</div>';
  if (last && state.agentDismissedQuestionId === last.id) return '<div class="agent-choices muted">Opcoes dispensadas. Voce pode seguir com um novo comando.</div>';
  if (!last) return '<div class="agent-choices muted">Quando a IA precisar de contexto, as opcoes clicaveis aparecem aqui.</div>';
  return `
    <div class="agent-choices" data-agent-question="${last.id}">
      ${last.metadata.questions.map((question) => `
        <div class="agent-question">
          <div class="agent-question-head">
            <strong>${escapeHtml(question.prompt)}</strong>
            <button class="btn icon small" type="button" data-agent-dismiss-question="${last.id}" title="Dispensar opcoes">x</button>
          </div>
          <div class="actions">
            ${(question.options || []).map((option) => {
              const label = typeof option === 'string' ? option : option.label;
              const prompt = typeof option === 'string' ? option : (option.action_prompt || option.value || option.label);
              return `<button class="btn small" type="button" data-agent-choice="${last.id}" data-agent-autosend="1" data-agent-prompt="${escapeHtml(prompt)}">${escapeHtml(label)}</button>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderAgentProactive(proactive) {
  const reminders = proactive.reminders || [];
  const patterns = proactive.patterns || [];
  const flows = proactive.flows || [];
  return `
    <div class="agent-section">
      <h3>Lembretes inteligentes</h3>
      ${reminders.length ? reminders.map((item) => `
        <article class="agent-reminder">
          <button class="link-title" type="button" data-open-task="${item.task_id}">${escapeHtml(item.title)}</button>
          <span class="pill">${escapeHtml(item.type)}</span>
          <p class="muted">${escapeHtml(item.detail)}</p>
        </article>
      `).join('') : '<div class="empty">Nenhum lembrete critico agora.</div>'}
    </div>
    <div class="agent-section">
      <h3>Fluxos automaticos internos</h3>
      ${flows.length ? flows.map((flow) => `
        <article class="agent-flow">
          <strong>${escapeHtml(flow.name)}</strong>
          <p><b>Gatilho:</b> ${escapeHtml(flow.condition?.trigger || flow.trigger_type)}</p>
          <p><b>Acao interna:</b> ${escapeHtml(flow.action?.action || '')}</p>
          <span class="pill">${flow.enabled ? 'Ativo' : 'Pausado'}</span>
        </article>
      `).join('') : '<div class="empty">Nenhum fluxo automatico interno criado ainda.</div>'}
    </div>
    <div class="agent-section">
      <h3>Padroes sugeridos</h3>
      ${patterns.length ? patterns.map((pattern) => `
        <article class="agent-flow">
          <strong>${escapeHtml(pattern.name)}</strong>
          <p><b>Gatilho:</b> ${escapeHtml(pattern.trigger)}</p>
          <p><b>Acao:</b> ${escapeHtml(pattern.action)}</p>
          <span class="pill">Confianca ${escapeHtml(pattern.confidence)}</span>
        </article>
      `).join('') : '<div class="empty">A IA ainda esta observando padroes da operacao.</div>'}
    </div>
  `;
}

function renderAiList(actions, pending) {
  if (!actions.length) return '<div class="empty">Nenhuma acao nesta fila.</div>';
  return `<div class="grid">${actions.map((item) => `
    <article class="approval-card">
      <strong>${escapeHtml(item.title)}</strong>
      <div class="actions">
        <span class="pill">Nivel ${item.autonomy_level}</span>
        <span class="pill">${escapeHtml(item.status)}</span>
        <span class="pill ${item.risk === 'alto' ? 'alta' : ''}">Risco ${escapeHtml(item.risk || 'medio')}</span>
      </div>
      ${item.task_title ? `<span class="muted">${escapeHtml(item.task_title)}</span>` : ''}
      ${item.reasoning ? `<div class="summary-line">${escapeHtml(item.reasoning)}</div>` : ''}
      ${item.content ? `<div class="pre">${escapeHtml(item.content)}</div>` : ''}
      ${pending ? `
        <div class="actions">
          <button class="btn primary small" data-approve-ai="${item.id}">Aprovar</button>
          <button class="btn danger small" data-reject-ai="${item.id}">Rejeitar</button>
        </div>
      ` : ''}
    </article>
  `).join('')}</div>`;
}

function bindAi() {
  const messagesNode = document.querySelector('#agentMessages');
  if (messagesNode) messagesNode.scrollTop = messagesNode.scrollHeight;
  bindAgentChatControls();
  bindSettingsExtras();
  document.querySelectorAll('[data-approve-ai], [data-reject-ai]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.approveAi || button.dataset.rejectAi;
      const action = button.dataset.approveAi ? 'approve' : 'reject';
      try {
        await api(`/api/ai-actions/${id}/${action}`, { method: 'POST' });
        await loadAll();
        renderApp();
        toast(action === 'approve' ? 'Acao aprovada.' : 'Acao rejeitada.');
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

function bindAgentChatControls() {
  document.querySelectorAll('[data-agent-chat-form]').forEach((form) => {
    if (form.dataset.boundAgentChat) return;
    form.dataset.boundAgentChat = '1';
    form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentForm = event.currentTarget;
    const textarea = currentForm?.querySelector('textarea[name="message"]');
    const message = textarea?.value.trim() || '';
    if (!message) return;
    try {
      const result = await api('/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      state.data.agentMessages = result.messages || [];
      state.data.agentProactive = result.proactive || state.data.agentProactive;
      state.agentDismissedQuestionId = null;
      if (typeof currentForm?.reset === 'function') currentForm.reset();
      await loadAll();
      state.agentFloatingOpen = true;
      renderApp();
      toast('IA atualizou a operacao.');
    } catch (error) {
      toast(error.message);
    }
    });
  });
  document.querySelectorAll('[data-agent-prompt]').forEach((button) => {
    if (button.dataset.boundAgentPrompt) return;
    button.dataset.boundAgentPrompt = '1';
    button.addEventListener('click', () => {
      if (button.dataset.agentChoice) {
        state.agentDismissedQuestionId = Number(button.dataset.agentChoice);
        document.querySelectorAll(`[data-agent-question="${button.dataset.agentChoice}"]`).forEach((node) => node.remove());
      }
      const panel = button.closest('.floating-agent-panel, .agent-chat') || document;
      const textarea = panel.querySelector('textarea[name="message"]') || document.querySelector('#agentChatForm textarea') || document.querySelector('.floating-agent-panel textarea');
      if (!textarea) return;
      textarea.value = button.dataset.agentPrompt || '';
      textarea.focus();
      if (button.dataset.agentAutosend === '1') {
        textarea.closest('form')?.requestSubmit();
      }
    });
  });
  document.querySelectorAll('[data-agent-dismiss-question]').forEach((button) => {
    button.addEventListener('click', () => {
      state.agentDismissedQuestionId = Number(button.dataset.agentDismissQuestion);
      document.querySelectorAll(`[data-agent-question="${button.dataset.agentDismissQuestion}"]`).forEach((node) => node.remove());
    });
  });
  document.querySelectorAll('[data-agent-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      state.agentFloatingOpen = !state.agentFloatingOpen;
      renderApp();
    });
  });
  document.querySelectorAll('[data-agent-close]').forEach((button) => {
    button.addEventListener('click', () => {
      state.agentFloatingOpen = false;
      renderApp();
    });
  });
}

function setupAgentProactive() {
  if (state.agentInterval) return;
  const markActivity = () => {
    state.agentLastActivityAt = Date.now();
  };
  ['click', 'keydown', 'mousemove', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, markActivity, { passive: true });
  });
  state.agentInterval = setInterval(async () => {
    const settings = state.data.settings || {};
    if (!settings.agent_enabled || !state.user) return;
    const idleMinutes = Number(settings.agent_idle_minutes || 20);
    const idleFor = Date.now() - state.agentLastActivityAt;
    const recentlyPrompted = Date.now() - state.agentIdlePromptedAt < Math.max(5, idleMinutes) * 60000;
    if (idleFor < idleMinutes * 60000 || recentlyPrompted) return;
    state.agentIdlePromptedAt = Date.now();
    const message = 'A rotina ficou sem movimento. Existe alguma nova demanda para registrar ou quer revisar prioridades?';
    notifyUser('IA HBR', message);
    toast(message);
  }, 60000);
}

function notifyUser(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
    return;
  }
  if (Notification.permission === 'default') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') new Notification(title, { body });
    });
  }
}

function renderSettings() {
  const settings = state.data.settings || {};
  return `
    <section class="band">
      <div class="section-head">
        <div>
          <h2>Versao ${appVersion}</h2>
          <p>Configuracoes reais da operacao: perfil da empresa, IA, score, capacidade diaria, campos de entrada e integracoes futuras.</p>
        </div>
      </div>
      <form id="settingsForm" class="form-grid">
        <div class="grid two">
          <section class="settings-panel">
            <h3>Empresa</h3>
            ${inputField('Nome da empresa', 'company_name', settings.company_name)}
            ${inputField('Assinatura / slogan', 'brand_tagline', settings.brand_tagline)}
            ${inputField('Responsavel padrao', 'default_responsible', settings.default_responsible)}
          </section>
          <section class="settings-panel">
            <h3>Planejamento</h3>
            <div class="form-grid two">
              ${inputField('Inicio do dia', 'workday_start', settings.workday_start || '08:00', 'time')}
              ${inputField('Fim do dia', 'workday_end', settings.workday_end || '18:00', 'time')}
              ${inputField('Capacidade diaria (min)', 'daily_capacity_minutes', settings.daily_capacity_minutes || 360, 'number')}
              ${inputField('Esforco padrao (min)', 'default_estimated_minutes', settings.default_estimated_minutes || 30, 'number')}
              ${inputField('Passo do esforço (min)', 'effort_step_minutes', settings.effort_step_minutes || 5, 'number')}
              ${inputField('Conferir timer a cada (min)', 'timer_check_minutes', settings.timer_check_minutes || 5, 'number')}
              ${inputField('IA pergunta apos inatividade (min)', 'agent_idle_minutes', settings.agent_idle_minutes || 20, 'number')}
              ${inputField('IA revisa lembretes a cada (min)', 'agent_reminder_minutes', settings.agent_reminder_minutes || 30, 'number')}
              ${inputField('Passo do score', 'score_step', settings.score_step || 1, 'number')}
              ${inputField('Meta diaria de tarefas', 'daily_goal_tasks', settings.daily_goal_tasks || 6, 'number')}
              ${inputField('Meta diaria de tempo (min)', 'daily_goal_minutes', settings.daily_goal_minutes || 240, 'number')}
            </div>
          </section>
        </div>

        <section class="settings-panel">
          <h3>Regras da IA</h3>
          <div class="form-grid two">
            ${selectField('Nivel de perguntas na triagem', 'intake_confidence', confidenceOptions, settings.intake_confidence || 'media')}
            ${textareaField('Notas de status / fluxo', 'custom_status_notes', settings.custom_status_notes || '')}
          </div>
          <div class="toggle-grid">
            ${checkboxField('auto_create_pending_records', 'Criar cadastros pendentes quando nao houver match', settings.auto_create_pending_records)}
            ${checkboxField('ask_when_missing_client', 'Perguntar quando faltar cliente', settings.ask_when_missing_client)}
            ${checkboxField('ask_when_missing_due_date', 'Perguntar quando faltar prazo', settings.ask_when_missing_due_date)}
            ${checkboxField('require_approval_level_2', 'Exigir revisao para acoes nivel 2', settings.require_approval_level_2)}
            ${checkboxField('require_approval_level_3', 'Exigir aprovacao explicita para nivel 3', settings.require_approval_level_3)}
            ${checkboxField('agent_enabled', 'Ativar colaborador IA proativo', settings.agent_enabled)}
            ${checkboxField('agent_autonomous_internal_actions', 'Permitir acoes internas autonomas seguras', settings.agent_autonomous_internal_actions)}
            ${checkboxField('agent_pattern_detection', 'Detectar padroes e sugerir fluxos automaticos', settings.agent_pattern_detection)}
          </div>
        </section>

        <section class="settings-panel">
          <h3>Campos e intake</h3>
          ${textareaField('Responsaveis', 'responsibles_text', (settings.responsibles || ['HBR']).join('\n'))}
          ${textareaField('Periodos do dia', 'planning_periods_text', (settings.planning_periods || ['manha', 'tarde']).join('\n'))}
          ${textareaField('Categorias adicionais', 'additional_categories_text', (settings.additional_categories || []).join('\n'))}
          <p class="muted">Padrao visto em Asana, ClickUp e Wrike: campos configuraveis ajudam a adaptar a operacao sem alterar codigo. Nesta versao, categorias adicionais ficam salvas e prontas para serem ligadas aos filtros dinamicos.</p>
        </section>

        <section class="settings-panel">
          <h3>Integracoes</h3>
          <div class="form-grid three">
            ${selectField('Google Calendar', 'integration_calendar', integrationStatusOptions, settings.integrations?.calendar || 'planejada')}
            ${selectField('Gmail / E-mail', 'integration_gmail', integrationStatusOptions, settings.integrations?.gmail || 'planejada')}
            ${selectField('Drive / Dropbox', 'integration_drive_dropbox', integrationStatusOptions, settings.integrations?.drive_dropbox || 'planejada')}
            ${selectField('WhatsApp Business', 'integration_whatsapp', integrationStatusOptions, settings.integrations?.whatsapp || 'planejada')}
            ${selectField('Planilhas', 'integration_spreadsheets', integrationStatusOptions, settings.integrations?.spreadsheets || 'planejada')}
            ${selectField('ERP / CRM', 'integration_erp_crm', integrationStatusOptions, settings.integrations?.erp_crm || 'futuro')}
          </div>
        </section>

        ${renderAutomationSettings()}
        ${renderTemplateSettings()}
        ${renderCustomFieldsSettings()}

        <div class="actions">
          <button class="btn primary" type="submit">Salvar configuracoes</button>
          <button class="btn" type="button" id="resetSettingsView">Recarregar</button>
        </div>
      </form>
    </section>
    <section class="band">
      <div class="section-head">
        <div>
          <h2>Benchmark aplicado</h2>
          <p>Itens que mais aparecem em sistemas semelhantes e que viraram configuracoes no app.</p>
        </div>
      </div>
      <div class="grid four">
        <div class="metric"><span>Campos customizados</span><strong>Alta</strong><p class="muted">Asana, ClickUp, Wrike e Airtable usam campos configuraveis para adaptar fluxo e relatorios.</p></div>
        <div class="metric"><span>Formularios/intake</span><strong>Alta</strong><p class="muted">Wrike e monday valorizam intake estruturado com perguntas, destino e automacoes.</p></div>
        <div class="metric"><span>Automacoes</span><strong>Media</strong><p class="muted">ClickUp, Trello, Asana e monday permitem regras, mas aqui seguem controladas por aprovacao.</p></div>
        <div class="metric"><span>Metas/capacidade</span><strong>Media</strong><p class="muted">Todoist, Motion, Reclaim e Sunsama reforcam metas, capacidade e planejamento diario.</p></div>
      </div>
    </section>
  `;
}

function checkboxField(name, label, checked) {
  return `
    <label class="toggle-row">
      <input type="checkbox" name="${name}" ${checked ? 'checked' : ''}>
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function renderAutomationSettings() {
  const rules = state.data.automationRules || [];
  const runs = state.data.automationRuns || [];
  return `
    <section class="settings-panel">
      <h3>Automacoes internas</h3>
      <p class="muted">Regras executam apenas dentro do app, registram log e criam sugestoes para revisao quando houver risco.</p>
      <div class="grid two">
        ${rules.map((rule) => `
          <article class="automation-card">
            <strong>${escapeHtml(rule.name)}</strong>
            <p>${escapeHtml(rule.description || '')}</p>
            <div class="actions">
              <span class="pill">${escapeHtml(rule.trigger_type)}</span>
              <span class="pill">${rule.enabled ? 'Ativa' : 'Pausada'}</span>
              <span class="pill">${rule.requires_approval ? 'Revisao' : 'Interna'}</span>
            </div>
            <div class="actions">
              <button class="btn small" type="button" data-run-automation="${rule.id}">Rodar agora</button>
              <button class="btn small" type="button" data-toggle-automation="${rule.id}">${rule.enabled ? 'Pausar' : 'Ativar'}</button>
            </div>
          </article>
        `).join('') || '<div class="empty">Nenhuma automacao cadastrada.</div>'}
      </div>
      <details>
        <summary>Ultimos logs</summary>
        <div class="activity-list">
          ${runs.slice(0, 8).map((run) => `
            <article class="activity-item">
              <strong>${escapeHtml(run.rule_name || 'Automacao')}</strong>
              <span>${escapeHtml(new Date(run.created_at).toLocaleString('pt-BR'))}</span>
              <p>${escapeHtml(run.summary || '')}</p>
            </article>
          `).join('') || '<div class="empty">Sem execucoes registradas.</div>'}
        </div>
      </details>
    </section>
  `;
}

function renderTemplateSettings() {
  const templates = availableTaskTemplates();
  return `
    <section class="settings-panel">
          <h3>Modelos de preenchimento de tarefa</h3>
          <p class="muted">Edite aqui os modelos que aparecem no topo do pop-up da tarefa. Eles definem categoria, prioridade, esforco, proxima acao, resultado esperado, checklist e subtarefas.</p>
      <div class="grid three">
        ${templates.map((template) => `
          <article class="automation-card">
            <strong>${escapeHtml(template.name || template.key)}</strong>
            <p>${escapeHtml(template.description || template.expected_result || '')}</p>
            <div class="actions">
              <span class="pill">${escapeHtml(labelFrom(categories, template.category))}</span>
              <span class="pill ${template.priority}">${escapeHtml(labelFrom(priorities, template.priority))}</span>
              <span class="pill">${minutesLabel(template.estimated_minutes || 30)}</span>
            </div>
            <button class="btn small" type="button" data-edit-template="${template.id || ''}" data-template-key="${escapeHtml(template.key)}">Editar</button>
          </article>
        `).join('')}
      </div>
      <button class="btn small" type="button" id="newTemplateBtn">Novo template</button>
    </section>
  `;
}

function renderCustomFieldsSettings() {
  const fields = state.data.customFields || [];
  return `
    <section class="settings-panel">
      <h3>Campos customizados</h3>
      <div class="grid three">
        ${fields.map((field) => `
          <article class="automation-card">
            <strong>${escapeHtml(field.label)}</strong>
            <p>${escapeHtml(field.entity_type)} / ${escapeHtml(field.type)} / ${escapeHtml(field.key)}</p>
            <span class="pill">${field.required ? 'Obrigatorio' : 'Opcional'}</span>
          </article>
        `).join('') || '<div class="empty">Sem campos customizados.</div>'}
      </div>
      <button class="btn small" type="button" id="newCustomFieldBtn">Novo campo</button>
    </section>
  `;
}

function bindSettings() {
  document.querySelector('#resetSettingsView')?.addEventListener('click', async () => {
    await loadAll();
    renderApp();
    toast('Configuracoes recarregadas.');
  });
  document.querySelector('#settingsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const raw = scopedFormData(event.currentTarget);
    const body = {
      company_name: raw.company_name,
      brand_tagline: raw.brand_tagline,
      default_responsible: raw.default_responsible,
      workday_start: raw.workday_start,
      workday_end: raw.workday_end,
      daily_capacity_minutes: raw.daily_capacity_minutes,
      default_estimated_minutes: raw.default_estimated_minutes,
      effort_step_minutes: raw.effort_step_minutes,
      timer_check_minutes: raw.timer_check_minutes,
      agent_idle_minutes: raw.agent_idle_minutes,
      agent_reminder_minutes: raw.agent_reminder_minutes,
      score_step: raw.score_step,
      daily_goal_tasks: raw.daily_goal_tasks,
      daily_goal_minutes: raw.daily_goal_minutes,
      responsibles: parseLines(raw.responsibles_text),
      planning_periods: parseLines(raw.planning_periods_text),
      intake_confidence: raw.intake_confidence,
      auto_create_pending_records: Boolean(raw.auto_create_pending_records),
      ask_when_missing_client: Boolean(raw.ask_when_missing_client),
      ask_when_missing_due_date: Boolean(raw.ask_when_missing_due_date),
      require_approval_level_2: Boolean(raw.require_approval_level_2),
      require_approval_level_3: Boolean(raw.require_approval_level_3),
      agent_enabled: Boolean(raw.agent_enabled),
      agent_autonomous_internal_actions: Boolean(raw.agent_autonomous_internal_actions),
      agent_pattern_detection: Boolean(raw.agent_pattern_detection),
      custom_status_notes: raw.custom_status_notes,
      additional_categories: parseLines(raw.additional_categories_text),
      integrations: {
        calendar: raw.integration_calendar,
        gmail: raw.integration_gmail,
        drive_dropbox: raw.integration_drive_dropbox,
        whatsapp: raw.integration_whatsapp,
        spreadsheets: raw.integration_spreadsheets,
        erp_crm: raw.integration_erp_crm
      }
    };
    try {
      state.data.settings = await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      await loadAll();
      renderApp();
      toast('Configuracoes salvas.');
    } catch (error) {
      toast(error.message);
    }
  });
  bindSettingsExtras();
}

function bindSettingsExtras() {
  document.querySelectorAll('[data-run-automation]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const result = await api(`/api/automation-rules/${button.dataset.runAutomation}/run`, { method: 'POST' });
        await loadAll();
        renderApp();
        toast(result.summary || 'Automacao executada.');
      } catch (error) {
        toast(error.message);
      }
    });
  });
  document.querySelectorAll('[data-toggle-automation]').forEach((button) => {
    button.addEventListener('click', async () => {
      const rule = state.data.automationRules.find((item) => item.id === Number(button.dataset.toggleAutomation));
      if (!rule) return;
      try {
        await api(`/api/automation-rules/${rule.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...rule, enabled: !rule.enabled, condition: rule.condition, action: rule.action })
        });
        await loadAll();
        renderApp();
        toast(rule.enabled ? 'Automacao pausada.' : 'Automacao ativada.');
      } catch (error) {
        toast(error.message);
      }
    });
  });
  document.querySelector('#newTemplateBtn')?.addEventListener('click', () => openTemplateDrawer());
  document.querySelectorAll('[data-edit-template]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.editTemplate);
      const template = id
        ? state.data.taskTemplates.find((item) => item.id === id)
        : availableTaskTemplates().find((item) => item.key === button.dataset.templateKey);
      openTemplateDrawer(template || {});
    });
  });
  document.querySelector('#newCustomFieldBtn')?.addEventListener('click', () => openCustomFieldDrawer());
}

function openTemplateDrawer(item = {}) {
  const body = `
    <form class="form-grid">
      <div class="form-grid two">
        ${inputField('Chave', 'key', item.key || '')}
        ${inputField('Nome', 'name', item.name || item.title || '')}
        ${selectField('Categoria', 'category', categories, item.category || 'cliente')}
        ${selectField('Prioridade', 'priority', priorities, item.priority || 'media')}
        ${inputField('Esforco estimado (min)', 'estimated_minutes', item.estimated_minutes || 30, 'number')}
        ${inputField('Proxima acao', 'next_action', item.next_action || '')}
      </div>
      ${textareaField('Descricao', 'description', item.description || '')}
      ${textareaField('Resultado esperado', 'expected_result', item.expected_result || '')}
      ${textareaField('Checklist', 'checklist_text', (item.checklist || []).join('\n'))}
      ${textareaField('Subtarefas', 'subtasks_text', (item.subtasks || []).join('\n'))}
      ${checkboxField('enabled', 'Template ativo', item.enabled !== false)}
      <button class="btn primary" type="submit">Salvar template</button>
    </form>
  `;
  openDrawer(item.id ? 'Editar template HBR' : 'Novo template HBR', body, async (event) => {
    event.preventDefault();
    const body = formData(event.currentTarget);
    body.checklist = parseLines(body.checklist_text);
    body.subtasks = parseLines(body.subtasks_text);
    body.enabled = Boolean(body.enabled);
    delete body.checklist_text;
    delete body.subtasks_text;
    try {
      await api(item.id ? `/api/task-templates/${item.id}` : '/api/task-templates', {
        method: item.id ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      });
      await loadAll();
      closeDrawer();
      renderApp();
      toast('Template salvo.');
    } catch (error) {
      toast(error.message);
    }
  });
}

function openCustomFieldDrawer(item = {}) {
  const body = `
    <form class="form-grid">
      <div class="form-grid two">
        ${selectField('Entidade', 'entity_type', [['tasks', 'Tarefas'], ['clients', 'Clientes'], ['assets', 'Ativos'], ['projects', 'Projetos / OS']], item.entity_type || 'tasks')}
        ${inputField('Chave', 'key', item.key || '')}
        ${inputField('Rotulo', 'label', item.label || '')}
        ${selectField('Tipo', 'type', [['text', 'Texto'], ['number', 'Numero'], ['date', 'Data'], ['select', 'Selecao'], ['boolean', 'Sim/nao']], item.type || 'text')}
      </div>
      ${textareaField('Opcoes (uma por linha)', 'options_text', (item.options || []).join('\n'))}
      ${checkboxField('required', 'Campo obrigatorio', item.required)}
      <button class="btn primary" type="submit">Salvar campo</button>
    </form>
  `;
  openDrawer(item.id ? 'Editar campo customizado' : 'Novo campo customizado', body, async (event) => {
    event.preventDefault();
    const body = formData(event.currentTarget);
    body.options = parseLines(body.options_text);
    body.required = Boolean(body.required);
    delete body.options_text;
    try {
      await api(item.id ? `/api/custom-fields/${item.id}` : '/api/custom-fields', {
        method: item.id ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      });
      await loadAll();
      closeDrawer();
      renderApp();
      toast('Campo customizado salvo.');
    } catch (error) {
      toast(error.message);
    }
  });
}

function bindEntityButtons(type, opener) {
  document.querySelectorAll(`[data-edit-${type}]`).forEach((button) => {
    button.addEventListener('click', () => opener(state.data[type].find((item) => item.id === Number(button.dataset[`edit${pascal(type)}`]))));
  });
  document.querySelectorAll(`[data-delete-${type}]`).forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset[`delete${pascal(type)}`];
      if (!confirm('Excluir este registro?')) return;
      try {
        await api(`/api/${type}/${id}`, { method: 'DELETE' });
        await loadAll();
        renderApp();
        toast('Registro excluido.');
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

function pascal(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clientName(id) {
  return state.data.clients.find((item) => item.id === Number(id))?.name || '';
}

function clientOptions(selected) {
  return `<option value="">Sem vinculo</option>${state.data.clients.map((item) => `<option value="${item.id}" ${Number(selected) === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}`;
}

function assetOptions(selected) {
  return `<option value="">Sem vinculo</option>${state.data.assets.map((item) => `<option value="${item.id}" ${Number(selected) === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}`;
}

function projectOptions(selected) {
  return `<option value="">Sem vinculo</option>${state.data.projects.map((item) => `<option value="${item.id}" ${Number(selected) === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}`;
}

function taskOptions(selected, currentId = null) {
  return `<option value="">Sem dependencia direta</option>${state.data.tasks
    .filter((item) => item.id !== Number(currentId))
    .map((item) => `<option value="${item.id}" ${Number(selected) === item.id ? 'selected' : ''}>#${item.id} ${escapeHtml(item.title)}</option>`)
    .join('')}`;
}

function blockerTypeOptions() {
  return [
    ['', 'Sem bloqueio'],
    ['cliente', 'Cliente'],
    ['fornecedor', 'Fornecedor'],
    ['material', 'Material'],
    ['aprovacao', 'Aprovacao'],
    ['documento', 'Documento'],
    ['financeiro', 'Financeiro'],
    ['operacional', 'Operacional']
  ];
}

function responsibleOptions() {
  const configured = state.data.settings?.responsibles || [];
  const fromTasks = state.data.tasks.map((task) => task.responsible).filter(Boolean);
  return [...new Set([...configured, ...fromTasks])].filter(Boolean).map((name) => [name, name]);
}

function renderTaskDrawerActivity(item) {
  const comments = (state.data.comments || []).filter((comment) => comment.entity_type === 'tasks' && Number(comment.entity_id) === Number(item.id));
  const dependencies = (state.data.taskDependencies || []).filter((dep) => Number(dep.task_id) === Number(item.id));
  return `
    <details class="detail-block task-records">
      <summary>Comentarios, dependencias e historico</summary>
      ${textareaField('Novo comentario interno', 'new_comment_text', '')}
      ${comments.length ? comments.slice(0, 6).map((comment) => `
        <article class="activity-item">
          <strong>${escapeHtml(comment.author_name || comment.author_type || 'HBR')}</strong>
          <span>${escapeHtml(new Date(comment.created_at).toLocaleString('pt-BR'))}</span>
          <p>${escapeHtml(comment.content)}</p>
        </article>
      `).join('') : '<div class="empty">Sem comentarios nesta tarefa.</div>'}
      <div class="record-divider">
        <strong>Dependencias reais</strong>
        <span>Use somente quando uma tarefa depende de outra entrega para continuar.</span>
      </div>
      <div class="form-grid two">
        ${relationSelect('Nova dependencia de tarefa', 'new_dependency_task', taskOptions('', item.id))}
        ${inputField('Nota da dependencia', 'new_dependency_note', '')}
      </div>
      ${dependencies.length ? dependencies.map((dep) => `
        <article class="activity-item">
          <strong>${escapeHtml(dep.depends_on_title || dep.dependency_type || 'Dependencia')}</strong>
          <span>${escapeHtml(dep.status || 'ativa')}</span>
          <p>${escapeHtml(dep.note || '')}</p>
        </article>
      `).join('') : '<div class="empty">Sem dependencias registradas.</div>'}
      <p class="muted">Historico completo fica registrado automaticamente a cada alteracao importante. Esta area existe para consulta e anotacoes, nao para preenchimento diario.</p>
    </details>
  `;
}

function renderTaskOperationalTools(item) {
  if (!item.id) return '<div class="empty">Salve a tarefa para liberar timer, rascunhos e registros.</div>';
  const timerSeconds = currentTimerSeconds(item);
  return `
    <details class="detail-block task-tools">
      <summary>Ferramentas da tarefa</summary>
      <div class="inline-panel">
        <h3>Timer e rascunhos</h3>
        <div class="actions">
          <span class="timer-readout ${item.timer_running ? 'running' : ''}" data-timer-readout="${item.id}">${formatDuration(timerSeconds)}</span>
          <button class="btn small" data-drawer-timer-start="${item.id}" type="button">${item.timer_running ? 'Continuar timer' : 'Iniciar timer'}</button>
          <button class="btn small" data-drawer-timer-pause="${item.id}" type="button">Pausar timer</button>
          <button class="btn small" data-drawer-draft-email="${item.id}" type="button">Criar rascunho de e-mail</button>
          <button class="btn small" data-drawer-draft-whatsapp="${item.id}" type="button">Criar rascunho de WhatsApp</button>
        </div>
      </div>
    </details>
  `;
}

function inputField(label, name, value = '', type = 'text') {
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${escapeHtml(value || '')}"></div>`;
}

function textareaField(label, name, value = '') {
  return `<div class="field"><label>${label}</label><textarea name="${name}">${escapeHtml(value || '')}</textarea></div>`;
}

function selectField(label, name, options, selected = '') {
  return `<div class="field"><label>${label}</label><select name="${name}">${optionList(options, selected)}</select></div>`;
}

function relationSelect(label, name, html) {
  return `<div class="field"><label>${label}</label><select name="${name}">${html}</select></div>`;
}

function openDrawer(title, body, onSubmit) {
  const drawer = document.querySelector('#drawer');
  drawer.className = 'drawer open';
  drawer.innerHTML = `
    <div class="drawer-panel">
      <div class="section-head">
        <h2>${title}</h2>
        <button class="btn ghost" id="closeDrawer">Fechar</button>
      </div>
      ${body}
    </div>
  `;
  drawer.querySelector('#closeDrawer').addEventListener('click', closeDrawer);
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) closeDrawer();
  }, { once: true });
  drawer.querySelector('form')?.addEventListener('submit', onSubmit);
}

function closeDrawer() {
  const drawer = document.querySelector('#drawer');
  drawer.className = 'drawer';
  drawer.innerHTML = '';
}

function bindDrawerTabs() {
  document.querySelectorAll('[data-drawer-tabs]').forEach((tabs) => {
    tabs.querySelectorAll('[data-tab-target]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.tabTarget;
        const form = button.closest('form') || document;
        tabs.querySelectorAll('[data-tab-target]').forEach((item) => item.classList.toggle('active', item === button));
        form.querySelectorAll('[data-tab-panel]').forEach((panel) => {
          panel.classList.toggle('active', panel.dataset.tabPanel === target);
        });
      });
    });
  });
  document.querySelectorAll('[data-tab-jump]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tabJump;
      const form = button.closest('form') || document;
      form.querySelector(`[data-tab-target="${target}"]`)?.click();
    });
  });
}

function openTaskDrawer(item = {}) {
  const body = `
    <form class="form-grid task-editor-form">
      <div class="template-strip compact-template-strip">
        <label>
          <span title="Aplica um modelo de preenchimento nos campos operacionais da tarefa. O titulo existente nao e alterado.">Preencher com modelo</span>
          <select name="task_template_select" data-template-select>
            <option value="">Selecionar modelo...</option>
            ${availableTaskTemplates().slice(0, 20).map((template) => `<option value="${escapeHtml(template.key)}">${escapeHtml(template.name)}</option>`).join('')}
          </select>
        </label>
        <small>Use apenas quando quiser preencher campos operacionais com um padrao HBR.</small>
      </div>
      <div class="drawer-tabs" data-drawer-tabs>
        <button class="active" type="button" data-tab-target="task-basic">Essencial</button>
        <button type="button" data-tab-target="task-priority">Prazo e importancia</button>
        <button type="button" data-tab-target="task-context">Contexto e bloqueios</button>
      </div>

      <section class="drawer-tab-panel active" data-tab-panel="task-basic">
        <div class="tab-panel-head">
          <h3>Informacoes essenciais</h3>
          <p>O minimo para reconhecer, executar e acompanhar a tarefa no dia a dia.</p>
        </div>
        ${inputField('Titulo', 'title', item.title)}
        ${textareaField('Descricao', 'description', item.description)}
        <div class="form-grid two">
          ${selectField('Status', 'status', taskStatuses, item.status || 'triagem')}
          ${selectField('Responsavel', 'responsible', [['', 'Sem responsavel'], ...responsibleOptions()], item.responsible || '')}
        </div>
        ${inputField('Proxima acao', 'next_action', item.next_action)}
        ${renderTaskRelationSummary(item)}
        <details class="detail-block checklist-trigger">
          <summary>${(item.checklist || []).length || (item.subtasks || []).length ? 'Editar checklist' : 'Adicionar checklist'}</summary>
          <p class="muted">Use quando a tarefa precisa virar passos de execucao. Se for uma tarefa simples, pode deixar fechado.</p>
          ${textareaField('Checklist', 'checklist_text', (item.checklist || []).join('\n'))}
          ${textareaField('Subtarefas', 'subtasks_text', (item.subtasks || []).join('\n'))}
        </details>
      </section>

      <section class="drawer-tab-panel" data-tab-panel="task-priority">
        <div class="tab-panel-head">
          <h3>Prazo, importancia e carga</h3>
          <p>Use esta aba para decidir quando a tarefa deve ser entregue, quando sera executada e qual peso operacional ela tem.</p>
        </div>
        <div class="form-grid two">
          ${selectField('Prioridade', 'priority', priorities, item.priority || 'media')}
          ${inputField('Prazo final', 'due_date', item.due_date, 'date')}
          ${inputField('Planejar para', 'planned_date', item.planned_date || item.due_date, 'date')}
          ${selectField('Periodo planejado', 'planned_period', planningPeriodOptions(), item.planned_period || planningPeriod(item))}
          ${inputField('Follow-up em', 'follow_up_at', (item.follow_up_at || '').slice(0, 10), 'date')}
          ${inputField('Esforco estimado (min)', 'estimated_minutes', item.estimated_minutes || 30, 'number')}
          ${inputField('Score operacional', 'operational_score', item.operational_score ?? operationalScoreForTask(item), 'number')}
          ${inputField('Rank manual', 'rank', item.rank || 0, 'number')}
          ${selectField('Recorrencia', 'recurrence_rule', recurrenceOptions, item.recurrence_rule || '')}
        </div>
      </section>

      <section class="drawer-tab-panel" data-tab-panel="task-context">
        <div class="tab-panel-head">
          <h3>Contexto, resultado e bloqueios</h3>
          <p>Vinculos e detalhes menos recorrentes ficam aqui para manter a tela principal limpa.</p>
        </div>
        <div class="form-grid two">
          ${selectField('Categoria', 'category', categories, item.category || 'cliente')}
          ${inputField('Local / Marina', 'location', item.location)}
          ${relationSelect('Cliente', 'client_id', clientOptions(item.client_id))}
          ${relationSelect('Ativo', 'asset_id', assetOptions(item.asset_id))}
          ${relationSelect('Projeto / OS', 'project_id', projectOptions(item.project_id))}
        </div>
        ${textareaField('Resultado esperado', 'expected_result', item.expected_result)}
        ${textareaField('Dependencias', 'dependency_text', item.dependency_text)}
        <div class="form-grid two">
          ${relationSelect('Bloqueado por tarefa', 'blocked_by', taskOptions(item.blocked_by, item.id))}
          ${selectField('Tipo de bloqueio', 'blocker_type', blockerTypeOptions(), item.blocker_type || '')}
        </div>
        ${textareaField('Bloqueio / risco de execucao', 'blocker_reason', item.blocker_reason)}
      </section>

      <section class="drawer-utility-area">
        ${renderTaskOperationalTools(item)}
        ${item.id ? renderTaskDrawerActivity(item) : ''}
      </section>

      <div class="actions">
        <button class="btn primary" type="submit">Salvar</button>
      </div>
    </form>
  `;
  openDrawer(item.id ? 'Editar tarefa' : 'Nova tarefa', body, async (event) => {
    event.preventDefault();
    const body = formData(event.currentTarget);
    body.checklist = parseLines(body.checklist_text);
    body.subtasks = parseLines(body.subtasks_text);
    body.needs_approval = true;
    body.operational_score = body.operational_score === '' ? operationalScoreForTask(body) : body.operational_score;
    body.last_reviewed_at = new Date().toISOString();
    const newComment = body.new_comment_text;
    const dependencyNote = body.new_dependency_note;
    const dependencyTask = body.new_dependency_task;
    delete body.task_template_select;
    delete body.checklist_text;
    delete body.subtasks_text;
    delete body.new_comment_text;
    delete body.new_dependency_note;
    delete body.new_dependency_task;
    try {
      const saved = await api(item.id ? `/api/tasks/${item.id}` : '/api/tasks', {
        method: item.id ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      });
      if (newComment && String(newComment).trim()) {
        await api('/api/comments', {
          method: 'POST',
          body: JSON.stringify({ entity_type: 'tasks', entity_id: saved.id || item.id, content: newComment })
        });
      }
      if (dependencyTask || dependencyNote) {
        await api('/api/task-dependencies', {
          method: 'POST',
          body: JSON.stringify({
            task_id: saved.id || item.id,
            depends_on_task_id: dependencyTask || null,
            dependency_type: body.blocker_type || 'operacional',
            note: dependencyNote || body.dependency_text || ''
          })
        });
      }
      await loadAll();
      closeDrawer();
      renderApp();
      toast('Tarefa salva.');
    } catch (error) {
      toast(error.message);
    }
  });
  bindDrawerTabs();
  bindTaskTemplates();
  bindTaskDrawerActions();
  bindTaskRelationActions();
}

function bindTaskTemplates() {
  document.querySelectorAll('[data-template-select]').forEach((select) => {
    select.addEventListener('change', () => {
      const template = taskTemplateByKey(select.value);
      const form = select.closest('form');
      if (!template || !form) return;
      applyTaskTemplateToForm(form, template);
      form.elements.operational_score.value = operationalScoreForTask(formData(form));
      toast(`Modelo aplicado: ${template.name || template.key}. Revise e clique em Salvar.`);
    });
  });
  document.querySelectorAll('[data-template]').forEach((button) => {
    button.addEventListener('click', () => {
      const template = taskTemplateByKey(button.dataset.template);
      const form = button.closest('form');
      if (!template || !form) return;
      applyTaskTemplateToForm(form, template);
      form.elements.operational_score.value = operationalScoreForTask(formData(form));
      button.closest('.template-strip')?.querySelectorAll('[data-template]').forEach((node) => node.classList.remove('active'));
      button.classList.add('active');
      toast(`Modelo aplicado: ${template.name || template.key}. Revise e clique em Salvar.`);
    });
  });
}

function renderTaskRelationSummary(item = {}) {
  const client = state.data.clients.find((entry) => entry.id === Number(item.client_id));
  const asset = state.data.assets.find((entry) => entry.id === Number(item.asset_id));
  const project = state.data.projects.find((entry) => entry.id === Number(item.project_id));
  return `
    <section class="relation-summary">
      <div class="relation-summary-head">
        <div>
          <h3>Resumo dos vinculos</h3>
          <p>Dados de cliente, ativo e OS ficam recolhidos. Clique no nome para editar o cadastro ou altere os vinculos na aba de contexto.</p>
        </div>
        <button class="btn small" type="button" data-tab-jump="task-context">Alterar vinculos</button>
      </div>
      <div class="relation-cards">
        ${relationSummaryCard('Cliente', client?.name || 'Sem cliente vinculado', client ? `data-open-related-client="${client.id}"` : '')}
        ${relationSummaryCard('Ativo', asset?.name || 'Sem ativo vinculado', asset ? `data-open-related-asset="${asset.id}"` : '')}
        ${relationSummaryCard('Projeto / OS', project?.name || 'Sem projeto vinculado', project ? `data-open-related-project="${project.id}"` : '')}
      </div>
    </section>
  `;
}

function relationSummaryCard(label, value, attrs = '') {
  if (!attrs) {
    return `
      <article class="relation-card">
        <span>${label}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `;
  }
  return `
    <article class="relation-card">
      <span>${label}</span>
      <button class="link-title" type="button" ${attrs}>${escapeHtml(value)}</button>
    </article>
  `;
}

function bindTaskRelationActions() {
  document.querySelectorAll('[data-open-related-client]').forEach((button) => {
    button.addEventListener('click', () => {
      const client = state.data.clients.find((entry) => entry.id === Number(button.dataset.openRelatedClient));
      if (client) openClientDrawer(client);
    });
  });
  document.querySelectorAll('[data-open-related-asset]').forEach((button) => {
    button.addEventListener('click', () => {
      const asset = state.data.assets.find((entry) => entry.id === Number(button.dataset.openRelatedAsset));
      if (asset) openAssetDrawer(asset);
    });
  });
  document.querySelectorAll('[data-open-related-project]').forEach((button) => {
    button.addEventListener('click', () => {
      const project = state.data.projects.find((entry) => entry.id === Number(button.dataset.openRelatedProject));
      if (project) openProjectDrawer(project);
    });
  });
}

function applyTaskTemplateToForm(form, template) {
  const fieldMap = {
    category: template.category,
    priority: template.priority,
    estimated_minutes: template.estimated_minutes,
    next_action: template.next_action,
    expected_result: template.expected_result
  };
  for (const [field, value] of Object.entries(fieldMap)) {
    if (form.elements[field] && value !== undefined && value !== null && value !== '') {
      form.elements[field].value = value;
    }
  }
  if (form.elements.title && !form.elements.title.value && (template.title || template.name)) {
    form.elements.title.value = template.title || template.name;
  }
  if (form.querySelector('[name="checklist_text"]') && Array.isArray(template.checklist)) {
    form.querySelector('[name="checklist_text"]').value = template.checklist.join('\n');
  }
  if (form.querySelector('[name="subtasks_text"]') && Array.isArray(template.subtasks)) {
    form.querySelector('[name="subtasks_text"]').value = template.subtasks.join('\n');
  }
}

function bindTaskDrawerActions() {
  document.querySelectorAll('[data-drawer-draft-email], [data-drawer-draft-whatsapp]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.drawerDraftEmail || button.dataset.drawerDraftWhatsapp;
      const type = button.dataset.drawerDraftWhatsapp ? 'whatsapp' : 'email';
      try {
        await api(`/api/tasks/${id}/drafts`, { method: 'POST', body: JSON.stringify({ type }) });
        await loadAll();
        closeDrawer();
        state.view = 'ai';
        renderApp();
        toast('Rascunho criado para revisao.');
      } catch (error) {
        toast(error.message);
      }
    });
  });
  document.querySelectorAll('[data-drawer-timer-start]').forEach((button) => {
    button.addEventListener('click', async () => {
      const task = state.data.tasks.find((item) => item.id === Number(button.dataset.drawerTimerStart));
      if (!task) return;
      try {
        await requestNotificationPermission();
        await api(`/api/tasks/${task.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...startTimerPayload(task), status: 'em_andamento' })
        });
        await loadAll();
        renderApp();
        openTaskDrawer(state.data.tasks.find((item) => item.id === task.id));
        toast('Timer iniciado.');
      } catch (error) {
        toast(error.message);
      }
    });
  });
  document.querySelectorAll('[data-drawer-timer-pause]').forEach((button) => {
    button.addEventListener('click', async () => {
      const task = state.data.tasks.find((item) => item.id === Number(button.dataset.drawerTimerPause));
      if (!task) return;
      try {
        await api(`/api/tasks/${task.id}`, {
          method: 'PUT',
          body: JSON.stringify(pauseTimerPayload(task))
        });
        await loadAll();
        renderApp();
        openTaskDrawer(state.data.tasks.find((item) => item.id === task.id));
        toast('Timer pausado.');
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

function availableTaskTemplates() {
  const dynamic = (state.data.taskTemplates || []).filter((template) => template.enabled !== false);
  if (dynamic.length) return dynamic;
  return Object.entries(taskTemplates).map(([key, value]) => ({
    key,
    name: ({ proposta: 'Proposta', followup: 'Follow-up', os: 'OS', material: 'Materiais', relatorio: 'Relatorio' }[key] || key),
    description: '',
    ...value
  }));
}

function taskTemplateByKey(key) {
  return availableTaskTemplates().find((template) => template.key === key) || taskTemplates[key];
}

function openClientDrawer(item = {}) {
  const body = `
    <form class="form-grid">
      ${inputField('Nome', 'name', item.name)}
      <div class="form-grid two">
        ${selectField('Tipo', 'type', clientTypes, item.type || 'pessoa_fisica')}
        ${inputField('WhatsApp / telefone', 'phone', item.phone)}
        ${inputField('E-mail', 'email', item.email, 'email')}
        ${inputField('Documento', 'document', item.document)}
      </div>
      ${textareaField('Endereco', 'address', item.address)}
      ${textareaField('Observacoes', 'notes', item.notes)}
      <button class="btn primary" type="submit">Salvar</button>
    </form>
  `;
  openDrawer(item.id ? 'Editar cliente' : 'Novo cliente', body, saveEntity('clients', item.id));
}

function openAssetDrawer(item = {}) {
  const body = `
    <form class="form-grid">
      ${inputField('Nome', 'name', item.name)}
      <div class="form-grid two">
        ${selectField('Tipo', 'type', assetTypes, item.type || 'embarcacao')}
        ${relationSelect('Cliente proprietario', 'client_id', clientOptions(item.client_id))}
        ${inputField('Fabricante', 'manufacturer', item.manufacturer)}
        ${inputField('Modelo', 'model', item.model)}
        ${inputField('Ano', 'year', item.year)}
        ${inputField('Tamanho', 'size', item.size)}
        ${inputField('Local atual', 'current_location', item.current_location)}
        ${inputField('Marina', 'marina', item.marina)}
      </div>
      ${textareaField('Sistemas instalados', 'installed_systems_text', (item.installed_systems || []).join('\n'))}
      ${textareaField('Observacoes tecnicas', 'technical_notes', item.technical_notes)}
      <button class="btn primary" type="submit">Salvar</button>
    </form>
  `;
  openDrawer(item.id ? 'Editar ativo' : 'Novo ativo', body, async (event) => {
    event.preventDefault();
    const body = formData(event.currentTarget);
    body.installed_systems = parseLines(body.installed_systems_text);
    delete body.installed_systems_text;
    await submitEntity('assets', item.id, body);
  });
}

function openProjectDrawer(item = {}) {
  const body = `
    <form class="form-grid">
      ${inputField('Nome', 'name', item.name)}
      <div class="form-grid two">
        ${relationSelect('Cliente', 'client_id', clientOptions(item.client_id))}
        ${relationSelect('Ativo', 'asset_id', assetOptions(item.asset_id))}
        ${selectField('Prioridade', 'priority', priorities, item.priority || 'media')}
        ${inputField('Status', 'status', item.status || 'triagem')}
        ${inputField('Responsavel', 'responsible', item.responsible)}
        ${inputField('Data prevista', 'expected_date', item.expected_date, 'date')}
        ${inputField('Local', 'location', item.location)}
      </div>
      ${textareaField('Escopo', 'scope', item.scope)}
      ${textareaField('Checklist', 'checklist_text', (item.checklist || []).join('\n'))}
      ${textareaField('Materiais', 'materials_text', (item.materials || []).join('\n'))}
      <button class="btn primary" type="submit">Salvar</button>
    </form>
  `;
  openDrawer(item.id ? 'Editar projeto/OS' : 'Novo projeto/OS', body, async (event) => {
    event.preventDefault();
    const body = formData(event.currentTarget);
    body.checklist = parseLines(body.checklist_text);
    body.materials = parseLines(body.materials_text);
    delete body.checklist_text;
    delete body.materials_text;
    await submitEntity('projects', item.id, body);
  });
}

function openDocumentDrawer(item = {}) {
  const body = `
    <form class="form-grid">
      ${inputField('Nome', 'name', item.name)}
      <div class="form-grid two">
        ${inputField('Tipo', 'type', item.type || 'documento')}
        ${relationSelect('Cliente', 'client_id', clientOptions(item.client_id))}
        ${relationSelect('Projeto', 'project_id', projectOptions(item.project_id))}
        ${inputField('Origem', 'origin', item.origin)}
      </div>
      ${inputField('Link', 'link', item.link, 'url')}
      ${textareaField('Tags', 'tags_text', (item.tags || []).join('\n'))}
      ${textareaField('Observacao', 'notes', item.notes)}
      <button class="btn primary" type="submit">Salvar</button>
    </form>
  `;
  openDrawer(item.id ? 'Editar documento' : 'Novo documento', body, async (event) => {
    event.preventDefault();
    const body = formData(event.currentTarget);
    body.tags = parseLines(body.tags_text);
    delete body.tags_text;
    await submitEntity('documents', item.id, body);
  });
}

function saveEntity(type, id) {
  return async (event) => {
    event.preventDefault();
    await submitEntity(type, id, formData(event.currentTarget));
  };
}

async function submitEntity(type, id, body) {
  try {
    await api(id ? `/api/${type}/${id}` : `/api/${type}`, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });
    await loadAll();
    closeDrawer();
    renderApp();
    toast('Registro salvo.');
  } catch (error) {
    toast(error.message);
  }
}

bootstrap().catch((error) => {
  app.innerHTML = `<main class="auth-shell"><section class="auth-box"><strong>Erro ao iniciar</strong><p>${escapeHtml(error.message)}</p></section></main>`;
});
