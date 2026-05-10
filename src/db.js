import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataDir = join(rootDir, 'data');

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(process.env.HBR_DB_PATH || join(dataDir, 'hbr-operacional.sqlite'));
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      data_status TEXT DEFAULT 'completo',
      type TEXT DEFAULT 'pessoa_fisica',
      phone TEXT,
      email TEXT,
      document TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      data_status TEXT DEFAULT 'completo',
      type TEXT DEFAULT 'embarcacao',
      manufacturer TEXT,
      model TEXT,
      year TEXT,
      size TEXT,
      current_location TEXT,
      marina TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      installed_systems TEXT DEFAULT '[]',
      technical_notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
      scope TEXT,
      status TEXT DEFAULT 'triagem',
      priority TEXT DEFAULT 'media',
      responsible TEXT,
      expected_date TEXT,
      location TEXT,
      checklist TEXT DEFAULT '[]',
      materials TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      original_input TEXT,
      category TEXT DEFAULT 'cliente',
      subcategory TEXT,
      status TEXT DEFAULT 'entrada_capturada',
      priority TEXT DEFAULT 'media',
      due_date TEXT,
      responsible TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      location TEXT,
      tags TEXT DEFAULT '[]',
      origin_channel TEXT DEFAULT 'manual',
      action_type TEXT,
      automation_level INTEGER DEFAULT 1,
      planned_date TEXT,
      estimated_minutes INTEGER DEFAULT 30,
      recurrence_rule TEXT,
      dependency_text TEXT,
      blocker_reason TEXT,
      operational_score INTEGER DEFAULT 50,
      time_spent_seconds INTEGER DEFAULT 0,
      timer_started_at TEXT,
      timer_running INTEGER DEFAULT 0,
      last_timer_check_at TEXT,
      next_action TEXT,
      expected_result TEXT,
      checklist TEXT DEFAULT '[]',
      subtasks TEXT DEFAULT '[]',
      attachments TEXT DEFAULT '[]',
      links TEXT DEFAULT '[]',
      ai_can_execute INTEGER DEFAULT 0,
      needs_approval INTEGER DEFAULT 1,
      human_approved INTEGER DEFAULT 0,
      ai_executed INTEGER DEFAULT 0,
      action_risk TEXT DEFAULT 'baixo',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'documento',
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      link TEXT,
      origin TEXT,
      tags TEXT DEFAULT '[]',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      autonomy_level INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'aguardando_revisao',
      risk TEXT DEFAULT 'medio',
      reasoning TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_flows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      condition_json TEXT DEFAULT '{}',
      action_json TEXT DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS saved_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'tasks',
      filters TEXT DEFAULT '{}',
      sort TEXT DEFAULT '{}',
      layout TEXT DEFAULT 'lista',
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      author_type TEXT NOT NULL DEFAULT 'humano',
      author_name TEXT,
      visibility TEXT NOT NULL DEFAULT 'interno',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      trigger_type TEXT NOT NULL,
      condition_json TEXT DEFAULT '{}',
      action_json TEXT DEFAULT '{}',
      requires_approval INTEGER DEFAULT 1,
      enabled INTEGER DEFAULT 1,
      last_run_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS automation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER REFERENCES automation_rules(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'executado',
      summary TEXT,
      result_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'cliente',
      priority TEXT DEFAULT 'media',
      estimated_minutes INTEGER DEFAULT 30,
      next_action TEXT,
      expected_result TEXT,
      checklist TEXT DEFAULT '[]',
      subtasks TEXT DEFAULT '[]',
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      depends_on_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      dependency_type TEXT DEFAULT 'operacional',
      note TEXT,
      status TEXT DEFAULT 'ativa',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL DEFAULT 'tasks',
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      options TEXT DEFAULT '[]',
      required INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_type, key)
    );

    CREATE TABLE IF NOT EXISTS activity_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT DEFAULT '{}',
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      subscription_json TEXT NOT NULL,
      platform TEXT DEFAULT '',
      browser TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      last_success_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dedupe_key TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      title TEXT NOT NULL,
      body TEXT,
      payload TEXT DEFAULT '{}',
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureColumn('clients', 'data_status', "TEXT DEFAULT 'completo'");
  ensureColumn('assets', 'data_status', "TEXT DEFAULT 'completo'");
  ensureColumn('tasks', 'planned_date', 'TEXT');
  ensureColumn('tasks', 'estimated_minutes', 'INTEGER DEFAULT 30');
  ensureColumn('tasks', 'recurrence_rule', 'TEXT');
  ensureColumn('tasks', 'dependency_text', 'TEXT');
  ensureColumn('tasks', 'blocker_reason', 'TEXT');
  ensureColumn('tasks', 'operational_score', 'INTEGER DEFAULT 50');
  ensureColumn('tasks', 'time_spent_seconds', 'INTEGER DEFAULT 0');
  ensureColumn('tasks', 'timer_started_at', 'TEXT');
  ensureColumn('tasks', 'timer_running', 'INTEGER DEFAULT 0');
  ensureColumn('tasks', 'last_timer_check_at', 'TEXT');
  ensureColumn('tasks', 'planned_period', "TEXT DEFAULT ''");
  ensureColumn('tasks', 'rank', 'INTEGER DEFAULT 0');
  ensureColumn('tasks', 'follow_up_at', 'TEXT');
  ensureColumn('tasks', 'blocked_by', 'INTEGER');
  ensureColumn('tasks', 'blocker_type', "TEXT DEFAULT ''");
  ensureColumn('tasks', 'confidence_score', 'INTEGER DEFAULT 70');
  ensureColumn('tasks', 'ai_reasoning_summary', 'TEXT');
  ensureColumn('tasks', 'last_reviewed_at', 'TEXT');
  seedSetting('operational', defaultOperationalSettings());
  seedTaskTemplates();
  seedAutomationRules();
  seedCustomFields();
}

function ensureColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export function now() {
  return new Date().toISOString();
}

export function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function stringifyJson(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value ?? []);
}

export function recordHistory(entityType, entityId, action, details = {}, userId = null) {
  db.prepare(`
    INSERT INTO activity_history (entity_type, entity_id, action, details, user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(entityType, entityId, action, JSON.stringify(details), userId);
}

function defaultOperationalSettings() {
  return {
    company_name: 'HBR Systems / HBR Marine',
    brand_tagline: 'Energia. Controle. Confianca.',
    default_responsible: 'HBR',
    workday_start: '08:00',
    workday_end: '18:00',
    daily_capacity_minutes: 360,
    default_estimated_minutes: 30,
    effort_step_minutes: 5,
    timer_check_minutes: 5,
    agent_enabled: true,
    agent_idle_minutes: 20,
    agent_reminder_minutes: 30,
    agent_pattern_detection: true,
    agent_autonomous_internal_actions: true,
    score_step: 1,
    daily_goal_tasks: 6,
    daily_goal_minutes: 240,
    planning_periods: ['manha', 'tarde'],
    responsibles: ['HBR'],
    intake_confidence: 'media',
    auto_create_pending_records: true,
    require_approval_level_2: true,
    require_approval_level_3: true,
    ask_when_missing_client: true,
    ask_when_missing_due_date: true,
    additional_categories: [],
    custom_status_notes: 'Use status de espera para qualquer dependencia externa: cliente, fornecedor, aprovacao ou material.',
    integrations: {
      calendar: 'planejada',
      gmail: 'planejada',
      drive_dropbox: 'planejada',
      whatsapp: 'planejada',
      spreadsheets: 'planejada',
      erp_crm: 'futuro'
    },
    notifications_enabled: true,
    push_enabled: true,
    notify_due_today: true,
    notify_overdue: true,
    notify_follow_up: true,
    notify_blockers: true,
    notify_ai_approvals: true,
    notify_timer_checks: true,
    notification_sweep_minutes: 5
  };
}

function seedSetting(key, value) {
  const exists = db.prepare('SELECT key FROM app_settings WHERE key = ?').get(key);
  if (!exists) {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
  }
}

function seedTaskTemplates() {
  const templates = [
    ['proposta', 'Proposta', 'Estrutura HBR para proposta tecnica/comercial.', 'proposta', 'alta', 90, 'Revisar escopo e montar proposta', 'Proposta pronta para aprovacao e envio ao cliente.', ['Confirmar escopo solicitado', 'Conferir materiais e compatibilidade', 'Validar condicoes comerciais', 'Preparar rascunho para aprovacao'], ['Levantar informacoes tecnicas', 'Montar valores', 'Revisar proposta', 'Criar rascunho de envio']],
    ['followup', 'Follow-up', 'Retorno comercial ou operacional para cliente/fornecedor.', 'comercial', 'media', 20, 'Preparar mensagem objetiva de follow-up', 'Cliente respondido e historico atualizado.', ['Localizar ultimo contato', 'Confirmar pendencia', 'Preparar mensagem', 'Aguardar aprovacao antes de enviar'], ['Resumir contexto', 'Redigir mensagem', 'Registrar retorno']],
    ['os', 'OS', 'Ordem de servico com escopo, local, checklist e materiais.', 'ordem_servico', 'alta', 120, 'Definir escopo executavel em campo', 'OS com escopo, checklist e materiais claros.', ['Confirmar local e acesso', 'Definir escopo de atendimento', 'Listar ferramentas e materiais', 'Registrar pendencias para relatorio final'], ['Confirmar agenda', 'Separar materiais', 'Executar atendimento', 'Atualizar historico']],
    ['material', 'Materiais', 'Pesquisa de materiais, SKUs, fornecedores e compatibilidade.', 'compra_material', 'media', 45, 'Conferir especificacao tecnica', 'Lista de materiais pronta para compra ou proposta.', ['Confirmar especificacao', 'Pesquisar fornecedor/preco', 'Registrar SKU/link', 'Aguardar aprovacao para compra'], ['Validar compatibilidade', 'Pesquisar opcoes', 'Registrar links', 'Conferir disponibilidade']],
    ['relatorio', 'Relatorio', 'Relatorio tecnico preliminar com evidencias e recomendacoes.', 'relatorio', 'media', 75, 'Organizar evidencias e resumo tecnico', 'Relatorio preliminar pronto para revisao humana.', ['Reunir fotos, medicoes e observacoes', 'Descrever sintomas e causa provavel', 'Listar pendencias/recomendacoes', 'Revisar antes de compartilhar'], ['Separar evidencias', 'Escrever diagnostico', 'Listar recomendacoes', 'Revisar relatorio']],
    ['diagnostico', 'Diagnostico', 'Investigacao tecnica de falha, sintomas e proximos testes.', 'diagnostico_tecnico', 'alta', 90, 'Registrar sintomas e montar plano de teste', 'Diagnostico organizado com causa provavel e proximo passo.', ['Registrar sintomas', 'Conferir alimentacao/protecao/comunicacao', 'Separar evidencias', 'Definir proximo teste'], ['Coletar sintomas', 'Executar verificacoes', 'Registrar evidencias', 'Preparar resumo']],
    ['visita_tecnica', 'Visita tecnica', 'Planejamento de deslocamento e atendimento em campo.', 'agenda', 'media', 60, 'Confirmar local, acesso e janela de atendimento', 'Visita planejada com escopo, horario e materiais.', ['Confirmar marina/local', 'Confirmar acesso ao ativo', 'Separar ferramentas e materiais', 'Registrar pauta de campo'], ['Confirmar agenda', 'Separar kit tecnico', 'Executar visita', 'Atualizar historico']],
    ['cobranca', 'Cobranca', 'Cobranca ou pendencia financeira com aprovacao humana.', 'financeiro', 'alta', 30, 'Conferir valor/documento antes do contato', 'Cobranca preparada para aprovacao antes do envio.', ['Confirmar valor/documento', 'Validar historico comercial', 'Preparar mensagem', 'Aguardar aprovacao para enviar'], ['Localizar documento', 'Conferir valor', 'Preparar rascunho', 'Registrar follow-up']],
    ['garantia', 'Garantia', 'Tratativa de garantia ou falha de fabricacao.', 'diagnostico_tecnico', 'alta', 90, 'Registrar falha e politica de substituicao', 'Caso de garantia organizado com evidencia e alternativa.', ['Registrar falha percebida', 'Separar evidencia', 'Validar solucao/substituicao', 'Preparar retorno comercial'], ['Coletar evidencias', 'Validar fornecedor', 'Montar alternativa', 'Preparar comunicacao']],
    ['documentacao', 'Documentacao', 'Organizacao de documentos, links, fotos e evidencias.', 'documento', 'media', 45, 'Classificar e vincular documentos', 'Documentos organizados e vinculados ao contexto correto.', ['Localizar documentos', 'Classificar por tipo/tag', 'Vincular cliente/projeto', 'Registrar observacao'], ['Buscar arquivos', 'Organizar links', 'Atualizar cadastro']]
  ];
  const statement = db.prepare(`
    INSERT OR IGNORE INTO task_templates
      (key, name, description, category, priority, estimated_minutes, next_action, expected_result, checklist, subtasks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of templates) {
    statement.run(...item.slice(0, 8), JSON.stringify(item[8]), JSON.stringify(item[9]));
  }
}

function seedAutomationRules() {
  const rules = [
    ['Follow-up de proposta parada', 'Sugere follow-up quando proposta fica sem revisao recente.', 'stale_proposal', { category: 'proposta', idle_days: 2 }, { action: 'criar_sugestao_followup' }, 1],
    ['Tarefas vencendo hoje', 'Destaca demandas com prazo hoje e alto impacto.', 'due_today', { due: 'today' }, { action: 'criar_lembrete_prioridade' }, 0],
    ['Criticas sem prazo', 'Aponta tarefas criticas/altas sem data definida.', 'high_without_due', { priorities: ['critica', 'alta'], missing: 'due_date' }, { action: 'solicitar_prazo' }, 0],
    ['Bloqueios aguardando retorno', 'Revisa tarefas aguardando cliente, fornecedor, material ou aprovacao.', 'blocked_waiting', { statuses: ['aguardando_cliente', 'aguardando_fornecedor', 'aguardando_aprovacao', 'aguardando_material'] }, { action: 'resumir_bloqueios' }, 0],
    ['Revisao diaria de planejamento', 'Monta resumo para reorganizar a agenda do dia.', 'daily_review', { cadence: 'daily' }, { action: 'sugerir_replanejamento' }, 0],
    ['Confirmacao de tarefa em andamento', 'Pede confirmacao periodica quando timer esta ativo.', 'timer_check', { source: 'timer' }, { action: 'pausar_e_perguntar' }, 0]
  ];
  const statement = db.prepare(`
    INSERT OR IGNORE INTO automation_rules
      (name, description, trigger_type, condition_json, action_json, requires_approval)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const [name, description, trigger, condition, action, approval] of rules) {
    statement.run(name, description, trigger, JSON.stringify(condition), JSON.stringify(action), approval);
  }
}

function seedCustomFields() {
  const fields = [
    ['tasks', 'sla_tipo', 'SLA / acordo esperado', 'select', ['Mesmo dia', '24h', '48h', 'Sem SLA'], 0],
    ['tasks', 'impacto_caixa', 'Impacto no fluxo de caixa', 'select', ['baixo', 'medio', 'alto', 'critico'], 0],
    ['tasks', 'origem_conversa', 'Origem da conversa', 'select', ['WhatsApp', 'E-mail', 'Ligacao', 'Reuniao', 'Manual'], 0]
  ];
  const statement = db.prepare(`
    INSERT OR IGNORE INTO custom_fields
      (entity_type, key, label, type, options, required)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const [entity, key, label, type, options, required] of fields) {
    statement.run(entity, key, label, type, JSON.stringify(options), required);
  }
}

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  if (!row) return fallback;
  return parseJson(row.value, fallback);
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, JSON.stringify(value));
  return getSetting(key, value);
}

export function touch(table, id) {
  db.prepare(`UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
}
