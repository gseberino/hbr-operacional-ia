import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { db, getSetting, migrate, now, parseJson, recordHistory, setSetting, stringifyJson, touch } from './db.js';
import { createDraft, interpretOperationalBatch, interpretOperationalText } from './ai/interpreter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const PORT = Number(process.env.PORT || 4173);
const APP_VERSION = '0.3.11';

migrate();

const jsonFields = new Set(['tags', 'checklist', 'subtasks', 'attachments', 'links', 'installed_systems', 'materials']);
const defaultSettings = {
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
  }
};

const entityConfig = {
  clients: {
    table: 'clients',
    fields: ['name', 'data_status', 'type', 'phone', 'email', 'document', 'address', 'notes']
  },
  assets: {
    table: 'assets',
    fields: ['name', 'data_status', 'type', 'manufacturer', 'model', 'year', 'size', 'current_location', 'marina', 'client_id', 'installed_systems', 'technical_notes']
  },
  projects: {
    table: 'projects',
    fields: ['name', 'client_id', 'asset_id', 'scope', 'status', 'priority', 'responsible', 'expected_date', 'location', 'checklist', 'materials']
  },
  documents: {
    table: 'documents',
    fields: ['name', 'type', 'client_id', 'project_id', 'link', 'origin', 'tags', 'notes']
  },
  tasks: {
    table: 'tasks',
    fields: [
      'title', 'description', 'original_input', 'category', 'subcategory', 'status', 'priority', 'due_date', 'responsible',
      'client_id', 'asset_id', 'project_id', 'location', 'tags', 'origin_channel', 'action_type', 'automation_level',
      'planned_date', 'estimated_minutes', 'recurrence_rule', 'dependency_text', 'blocker_reason', 'operational_score',
      'time_spent_seconds', 'timer_started_at', 'timer_running', 'last_timer_check_at',
      'planned_period', 'rank', 'follow_up_at', 'blocked_by', 'blocker_type', 'confidence_score', 'ai_reasoning_summary', 'last_reviewed_at',
      'next_action', 'expected_result', 'checklist', 'subtasks', 'attachments', 'links', 'ai_can_execute',
      'needs_approval', 'human_approved', 'ai_executed', 'action_risk'
    ]
  }
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    ...headers
  });
  res.end(payload);
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('JSON invalido.');
    error.status = 400;
    throw error;
  }
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = hashPassword(password, salt).split(':')[1];
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

function getSession(req) {
  const token = parseCookies(req).hbr_session;
  if (!token) return null;
  const row = db.prepare(`
    SELECT sessions.token, users.id, users.name, users.email, users.role
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND sessions.expires_at > CURRENT_TIMESTAMP
  `).get(token);
  return row || null;
}

function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { error: 'Autenticacao necessaria.' });
    return null;
  }
  return session;
}

function cleanPayload(payload, fields) {
  const out = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      if (jsonFields.has(field)) out[field] = stringifyJson(payload[field]);
      else if (['client_id', 'asset_id', 'project_id'].includes(field)) out[field] = payload[field] ? Number(payload[field]) : null;
      else if (['automation_level', 'estimated_minutes', 'operational_score', 'time_spent_seconds', 'rank', 'blocked_by', 'confidence_score'].includes(field)) out[field] = payload[field] === '' || payload[field] === null || payload[field] === undefined ? null : Number(payload[field]);
      else if (['ai_can_execute', 'needs_approval', 'human_approved', 'ai_executed', 'timer_running'].includes(field)) out[field] = payload[field] ? 1 : 0;
      else out[field] = payload[field] ?? '';
    }
  }
  return out;
}

function inflateRow(row) {
  if (!row) return row;
  const copy = { ...row };
  for (const field of jsonFields) {
    if (Object.prototype.hasOwnProperty.call(copy, field)) {
      copy[field] = parseJson(copy[field], []);
    }
  }
  for (const field of ['ai_can_execute', 'needs_approval', 'human_approved', 'ai_executed', 'timer_running']) {
    if (Object.prototype.hasOwnProperty.call(copy, field)) copy[field] = Boolean(copy[field]);
  }
  return copy;
}

function listEntities(type, url) {
  const config = entityConfig[type];
  const params = url.searchParams;
  const where = [];
  const values = [];
  if (params.get('q')) {
    const q = `%${params.get('q')}%`;
    if (type === 'tasks') where.push('(tasks.title LIKE ? OR tasks.description LIKE ? OR tasks.location LIKE ?)');
    else where.push(`(${config.table}.name LIKE ?)`);
    values.push(...(type === 'tasks' ? [q, q, q] : [q]));
  }
  for (const field of ['status', 'priority', 'category', 'client_id', 'project_id', 'responsible']) {
    if (params.get(field) && config.fields.includes(field)) {
      where.push(`${config.table}.${field} = ?`);
      values.push(params.get(field));
    }
  }
  if (type === 'tasks' && params.get('date_from')) {
    where.push('(tasks.due_date >= ? OR tasks.planned_date >= ?)');
    values.push(params.get('date_from'), params.get('date_from'));
  }
  if (type === 'tasks' && params.get('date_to')) {
    where.push('(tasks.due_date <= ? OR tasks.planned_date <= ?)');
    values.push(params.get('date_to'), params.get('date_to'));
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const joinSql = type === 'tasks'
    ? `LEFT JOIN clients ON clients.id = tasks.client_id
       LEFT JOIN assets ON assets.id = tasks.asset_id
       LEFT JOIN projects ON projects.id = tasks.project_id`
    : '';
  const selectSql = type === 'tasks'
    ? `tasks.*, clients.name AS client_name, assets.name AS asset_name, projects.name AS project_name`
    : `${config.table}.*`;
  return db.prepare(`
    SELECT ${selectSql}
    FROM ${config.table}
    ${joinSql}
    ${whereSql}
    ORDER BY ${config.table}.updated_at DESC, ${config.table}.id DESC
  `).all(...values).map(inflateRow);
}

function createEntity(type, payload, userId) {
  const config = entityConfig[type];
  const clean = cleanPayload(payload, config.fields);
  if (!clean.name && type !== 'tasks') throw Object.assign(new Error('Nome e obrigatorio.'), { status: 400 });
  if (!clean.title && type === 'tasks') throw Object.assign(new Error('Titulo e obrigatorio.'), { status: 400 });
  const fields = Object.keys(clean);
  const placeholders = fields.map(() => '?').join(', ');
  const result = db.prepare(`
    INSERT INTO ${config.table} (${fields.join(', ')})
    VALUES (${placeholders})
  `).run(...fields.map((field) => clean[field]));
  recordHistory(type, Number(result.lastInsertRowid), 'criado', clean, userId);
  return getEntity(type, Number(result.lastInsertRowid));
}

function getEntity(type, id) {
  const config = entityConfig[type];
  const joinSql = type === 'tasks'
    ? `LEFT JOIN clients ON clients.id = tasks.client_id
       LEFT JOIN assets ON assets.id = tasks.asset_id
       LEFT JOIN projects ON projects.id = tasks.project_id`
    : '';
  const selectSql = type === 'tasks'
    ? `tasks.*, clients.name AS client_name, assets.name AS asset_name, projects.name AS project_name`
    : `${config.table}.*`;
  return inflateRow(db.prepare(`
    SELECT ${selectSql}
    FROM ${config.table}
    ${joinSql}
    WHERE ${config.table}.id = ?
  `).get(id));
}

function updateEntity(type, id, payload, userId) {
  const config = entityConfig[type];
  const clean = cleanPayload(payload, config.fields);
  const fields = Object.keys(clean);
  if (!fields.length) return getEntity(type, id);
  db.prepare(`
    UPDATE ${config.table}
    SET ${fields.map((field) => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(...fields.map((field) => clean[field]), id);
  recordHistory(type, id, 'atualizado', clean, userId);
  return getEntity(type, id);
}

function deleteEntity(type, id, userId) {
  const config = entityConfig[type];
  const existing = getEntity(type, id);
  if (!existing) return false;
  db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(id);
  recordHistory(type, id, 'excluido', { title: existing.title || existing.name }, userId);
  return true;
}

function dashboard() {
  const counts = {
    tasks: db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count,
    clients: db.prepare('SELECT COUNT(*) AS count FROM clients').get().count,
    assets: db.prepare('SELECT COUNT(*) AS count FROM assets').get().count,
    projects: db.prepare('SELECT COUNT(*) AS count FROM projects').get().count,
    approvals: db.prepare("SELECT COUNT(*) AS count FROM ai_actions WHERE status = 'aguardando_revisao'").get().count
  };
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = db.prepare(`
    SELECT * FROM tasks
    WHERE due_date = ? AND status NOT IN ('concluido', 'cancelado', 'arquivado')
    ORDER BY priority DESC, updated_at DESC
  `).all(today).map(inflateRow);
  const overdue = db.prepare(`
    SELECT * FROM tasks
    WHERE due_date < ? AND due_date != '' AND status NOT IN ('concluido', 'cancelado', 'arquivado')
    ORDER BY due_date ASC
  `).all(today).map(inflateRow);
  const waiting = db.prepare(`
    SELECT status, COUNT(*) AS count FROM tasks
    WHERE status IN ('aguardando_cliente', 'aguardando_fornecedor', 'aguardando_aprovacao', 'aguardando_material')
    GROUP BY status
  `).all();
  const recentAi = db.prepare('SELECT * FROM ai_actions ORDER BY updated_at DESC LIMIT 5').all();
  return { counts, todayTasks, overdue, waiting, recentAi };
}

function operationalSettings() {
  return { ...defaultSettings, ...getSetting('operational', defaultSettings) };
}

function cleanSettings(payload) {
  const current = operationalSettings();
  const integrations = { ...(current.integrations || {}), ...(payload.integrations || {}) };
  return {
    ...current,
    company_name: String(payload.company_name ?? current.company_name).trim() || defaultSettings.company_name,
    brand_tagline: String(payload.brand_tagline ?? current.brand_tagline).trim(),
    default_responsible: String(payload.default_responsible ?? current.default_responsible).trim(),
    workday_start: String(payload.workday_start ?? current.workday_start).slice(0, 5),
    workday_end: String(payload.workday_end ?? current.workday_end).slice(0, 5),
    daily_capacity_minutes: clampNumber(payload.daily_capacity_minutes, 60, 720, current.daily_capacity_minutes),
    default_estimated_minutes: clampNumber(payload.default_estimated_minutes, 5, 240, current.default_estimated_minutes),
    effort_step_minutes: clampNumber(payload.effort_step_minutes, 1, 60, current.effort_step_minutes || 5),
    timer_check_minutes: clampNumber(payload.timer_check_minutes, 1, 60, current.timer_check_minutes || 5),
    agent_enabled: Boolean(payload.agent_enabled),
    agent_idle_minutes: clampNumber(payload.agent_idle_minutes, 5, 240, current.agent_idle_minutes || 20),
    agent_reminder_minutes: clampNumber(payload.agent_reminder_minutes, 5, 240, current.agent_reminder_minutes || 30),
    agent_pattern_detection: Boolean(payload.agent_pattern_detection),
    agent_autonomous_internal_actions: Boolean(payload.agent_autonomous_internal_actions),
    score_step: clampNumber(payload.score_step, 1, 10, 1),
    daily_goal_tasks: clampNumber(payload.daily_goal_tasks, 1, 50, current.daily_goal_tasks || 6),
    daily_goal_minutes: clampNumber(payload.daily_goal_minutes, 30, 720, current.daily_goal_minutes || 240),
    planning_periods: Array.isArray(payload.planning_periods)
      ? payload.planning_periods.map((item) => String(item).trim()).filter(Boolean)
      : parseJson(payload.planning_periods, current.planning_periods || ['manha', 'tarde']),
    responsibles: Array.isArray(payload.responsibles)
      ? payload.responsibles.map((item) => String(item).trim()).filter(Boolean)
      : parseJson(payload.responsibles, current.responsibles || ['HBR']),
    intake_confidence: ['baixa', 'media', 'alta'].includes(payload.intake_confidence) ? payload.intake_confidence : current.intake_confidence,
    auto_create_pending_records: Boolean(payload.auto_create_pending_records),
    require_approval_level_2: Boolean(payload.require_approval_level_2),
    require_approval_level_3: Boolean(payload.require_approval_level_3),
    ask_when_missing_client: Boolean(payload.ask_when_missing_client),
    ask_when_missing_due_date: Boolean(payload.ask_when_missing_due_date),
    additional_categories: Array.isArray(payload.additional_categories)
      ? payload.additional_categories.map((item) => String(item).trim()).filter(Boolean)
      : parseJson(payload.additional_categories, current.additional_categories || []),
    custom_status_notes: String(payload.custom_status_notes ?? current.custom_status_notes).trim(),
    integrations
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function histories(type, id) {
  return db.prepare(`
    SELECT activity_history.*, users.name AS user_name
    FROM activity_history
    LEFT JOIN users ON users.id = activity_history.user_id
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY activity_history.created_at DESC
  `).all(type, id).map((row) => ({ ...row, details: parseJson(row.details, {}) }));
}

function boolFromPayload(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback ? 1 : 0;
  return value ? 1 : 0;
}

function savedViews(scope = 'tasks') {
  return db.prepare('SELECT * FROM saved_views WHERE scope = ? ORDER BY is_default DESC, updated_at DESC, id DESC').all(scope)
    .map((row) => ({
      ...row,
      filters: parseJson(row.filters, {}),
      sort: parseJson(row.sort, {}),
      is_default: Boolean(row.is_default)
    }));
}

function createSavedView(payload, userId) {
  const filters = payload.filters && typeof payload.filters === 'object' ? payload.filters : {};
  const sort = payload.sort && typeof payload.sort === 'object' ? payload.sort : {};
  const result = db.prepare(`
    INSERT INTO saved_views (name, scope, filters, sort, layout, is_default)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    String(payload.name || 'View salva').trim(),
    String(payload.scope || 'tasks'),
    JSON.stringify(filters),
    JSON.stringify(sort),
    String(payload.layout || 'lista'),
    boolFromPayload(payload.is_default)
  );
  const id = Number(result.lastInsertRowid);
  recordHistory('saved_views', id, 'criado', { name: payload.name, scope: payload.scope || 'tasks' }, userId);
  return savedViews(payload.scope || 'tasks').find((view) => view.id === id);
}

function updateSavedView(id, payload, userId) {
  const existing = db.prepare('SELECT * FROM saved_views WHERE id = ?').get(id);
  if (!existing) return null;
  const next = {
    name: String(payload.name ?? existing.name).trim(),
    scope: String(payload.scope ?? existing.scope),
    filters: JSON.stringify(payload.filters && typeof payload.filters === 'object' ? payload.filters : parseJson(existing.filters, {})),
    sort: JSON.stringify(payload.sort && typeof payload.sort === 'object' ? payload.sort : parseJson(existing.sort, {})),
    layout: String(payload.layout ?? existing.layout),
    is_default: payload.is_default === undefined ? existing.is_default : boolFromPayload(payload.is_default)
  };
  db.prepare(`
    UPDATE saved_views
    SET name = ?, scope = ?, filters = ?, sort = ?, layout = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(next.name, next.scope, next.filters, next.sort, next.layout, next.is_default, id);
  recordHistory('saved_views', id, 'atualizado', next, userId);
  return savedViews(next.scope).find((view) => view.id === id);
}

function comments(entityType = '', entityId = null) {
  const where = [];
  const values = [];
  if (entityType) {
    where.push('entity_type = ?');
    values.push(entityType);
  }
  if (entityId) {
    where.push('entity_id = ?');
    values.push(Number(entityId));
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db.prepare(`
    SELECT * FROM comments
    ${whereSql}
    ORDER BY created_at DESC, id DESC
    LIMIT 300
  `).all(...values);
}

function createComment(payload, userId, authorName = '') {
  if (!payload.entity_type || !payload.entity_id || !String(payload.content || '').trim()) {
    throw Object.assign(new Error('Comentario precisa de entidade e conteudo.'), { status: 400 });
  }
  const result = db.prepare(`
    INSERT INTO comments (entity_type, entity_id, content, author_type, author_name, visibility)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    String(payload.entity_type),
    Number(payload.entity_id),
    String(payload.content).trim(),
    String(payload.author_type || 'humano'),
    String(payload.author_name || authorName || 'HBR'),
    String(payload.visibility || 'interno')
  );
  const id = Number(result.lastInsertRowid);
  recordHistory(payload.entity_type, Number(payload.entity_id), 'comentario_criado', { comment_id: id }, userId);
  return db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
}

function automationRules() {
  return db.prepare('SELECT * FROM automation_rules ORDER BY enabled DESC, updated_at DESC, id DESC').all()
    .map((row) => ({
      ...row,
      condition: parseJson(row.condition_json, {}),
      action: parseJson(row.action_json, {}),
      enabled: Boolean(row.enabled),
      requires_approval: Boolean(row.requires_approval)
    }));
}

function automationRuns(limit = 80) {
  return db.prepare(`
    SELECT automation_runs.*, automation_rules.name AS rule_name
    FROM automation_runs
    LEFT JOIN automation_rules ON automation_rules.id = automation_runs.rule_id
    ORDER BY automation_runs.created_at DESC, automation_runs.id DESC
    LIMIT ?
  `).all(limit).map((row) => ({ ...row, result: parseJson(row.result_json, {}) }));
}

function upsertAutomationRule(payload, userId, id = null) {
  const body = {
    name: String(payload.name || 'Automacao interna').trim(),
    description: String(payload.description || '').trim(),
    trigger_type: String(payload.trigger_type || 'manual'),
    condition_json: JSON.stringify(payload.condition || payload.condition_json || {}),
    action_json: JSON.stringify(payload.action || payload.action_json || {}),
    requires_approval: boolFromPayload(payload.requires_approval, true),
    enabled: boolFromPayload(payload.enabled, true)
  };
  if (id) {
    db.prepare(`
      UPDATE automation_rules
      SET name = ?, description = ?, trigger_type = ?, condition_json = ?, action_json = ?, requires_approval = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(body.name, body.description, body.trigger_type, body.condition_json, body.action_json, body.requires_approval, body.enabled, id);
    recordHistory('automation_rules', id, 'atualizado', body, userId);
    return automationRules().find((rule) => rule.id === id);
  }
  const result = db.prepare(`
    INSERT INTO automation_rules (name, description, trigger_type, condition_json, action_json, requires_approval, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(body.name, body.description, body.trigger_type, body.condition_json, body.action_json, body.requires_approval, body.enabled);
  const newId = Number(result.lastInsertRowid);
  recordHistory('automation_rules', newId, 'criado', body, userId);
  return automationRules().find((rule) => rule.id === newId);
}

function runAutomationRule(id, userId) {
  const rule = automationRules().find((item) => item.id === Number(id));
  if (!rule || !rule.enabled) throw Object.assign(new Error('Automacao nao encontrada ou pausada.'), { status: 404 });
  const tasks = activeTasks();
  const today = new Date().toISOString().slice(0, 10);
  let matched = [];
  let summary = '';
  if (rule.trigger_type === 'stale_proposal') {
    matched = tasks.filter((task) => task.category === 'proposta' && task.status !== 'concluido').slice(0, 8);
    summary = `Sugeri follow-up para ${matched.length} proposta(s) ativa(s).`;
  } else if (rule.trigger_type === 'due_today') {
    matched = tasks.filter((task) => task.due_date === today || task.planned_date === today).slice(0, 10);
    summary = `Revisei ${matched.length} tarefa(s) com agenda/prazo para hoje.`;
  } else if (rule.trigger_type === 'high_without_due') {
    matched = tasks.filter((task) => ['critica', 'alta'].includes(task.priority) && !task.due_date).slice(0, 10);
    summary = `Identifiquei ${matched.length} prioridade(s) alta/critica sem prazo.`;
  } else if (rule.trigger_type === 'blocked_waiting') {
    matched = tasks.filter((task) => ['aguardando_cliente', 'aguardando_fornecedor', 'aguardando_aprovacao', 'aguardando_material'].includes(task.status) || task.blocker_reason).slice(0, 10);
    summary = `Resumi ${matched.length} bloqueio(s) operacional(is).`;
  } else if (rule.trigger_type === 'daily_review') {
    matched = tasks.sort((a, b) => agentTaskScore(b) - agentTaskScore(a)).slice(0, 10);
    summary = `Montei revisao diaria com ${matched.length} prioridade(s).`;
  } else if (rule.trigger_type === 'timer_check') {
    matched = tasks.filter((task) => task.timer_running).slice(0, 10);
    summary = `Verifiquei ${matched.length} timer(s) em andamento.`;
  } else {
    matched = tasks.slice(0, 10);
    summary = `Automacao manual revisou ${matched.length} tarefa(s).`;
  }

  const result = {
    matched_task_ids: matched.map((task) => task.id),
    items: matched.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      planned_date: task.planned_date
    }))
  };
  const run = db.prepare(`
    INSERT INTO automation_runs (rule_id, status, summary, result_json)
    VALUES (?, 'executado', ?, ?)
  `).run(rule.id, summary, JSON.stringify(result));
  db.prepare('UPDATE automation_rules SET last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(rule.id);
  recordHistory('automation_rules', rule.id, 'executado', { run_id: Number(run.lastInsertRowid), ...result }, userId);
  if (rule.requires_approval && matched.length) {
    db.prepare(`
      INSERT INTO ai_actions (type, title, content, autonomy_level, status, risk, reasoning)
      VALUES ('automacao', ?, ?, 2, 'aguardando_revisao', 'medio', ?)
    `).run(
      `Automacao: ${rule.name}`,
      `${summary}\n\n${matched.map((task, index) => `${index + 1}. ${task.title}`).join('\n')}`,
      'Automacao interna gerou uma sugestao e aguarda revisao humana.'
    );
  }
  return { rule, run_id: Number(run.lastInsertRowid), summary, result };
}

function taskTemplates() {
  return db.prepare('SELECT * FROM task_templates ORDER BY enabled DESC, name ASC').all()
    .map((row) => ({
      ...row,
      checklist: parseJson(row.checklist, []),
      subtasks: parseJson(row.subtasks, []),
      enabled: Boolean(row.enabled)
    }));
}

function upsertTaskTemplate(payload, userId, id = null) {
  const body = {
    key: String(payload.key || payload.name || 'template').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, ''),
    name: String(payload.name || payload.key || 'Template HBR').trim(),
    description: String(payload.description || '').trim(),
    category: String(payload.category || 'cliente'),
    priority: String(payload.priority || 'media'),
    estimated_minutes: clampNumber(payload.estimated_minutes, 5, 480, 30),
    next_action: String(payload.next_action || '').trim(),
    expected_result: String(payload.expected_result || '').trim(),
    checklist: JSON.stringify(Array.isArray(payload.checklist) ? payload.checklist : parseJson(payload.checklist, [])),
    subtasks: JSON.stringify(Array.isArray(payload.subtasks) ? payload.subtasks : parseJson(payload.subtasks, [])),
    enabled: boolFromPayload(payload.enabled, true)
  };
  if (id) {
    db.prepare(`
      UPDATE task_templates
      SET key = ?, name = ?, description = ?, category = ?, priority = ?, estimated_minutes = ?, next_action = ?, expected_result = ?, checklist = ?, subtasks = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(body.key, body.name, body.description, body.category, body.priority, body.estimated_minutes, body.next_action, body.expected_result, body.checklist, body.subtasks, body.enabled, id);
    recordHistory('task_templates', id, 'atualizado', body, userId);
    return taskTemplates().find((template) => template.id === id);
  }
  const result = db.prepare(`
    INSERT INTO task_templates (key, name, description, category, priority, estimated_minutes, next_action, expected_result, checklist, subtasks, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(body.key, body.name, body.description, body.category, body.priority, body.estimated_minutes, body.next_action, body.expected_result, body.checklist, body.subtasks, body.enabled);
  const newId = Number(result.lastInsertRowid);
  recordHistory('task_templates', newId, 'criado', body, userId);
  return taskTemplates().find((template) => template.id === newId);
}

function customFields(entityType = '') {
  const rows = entityType
    ? db.prepare('SELECT * FROM custom_fields WHERE entity_type = ? ORDER BY id ASC').all(entityType)
    : db.prepare('SELECT * FROM custom_fields ORDER BY entity_type ASC, id ASC').all();
  return rows.map((row) => ({
    ...row,
    options: parseJson(row.options, []),
    required: Boolean(row.required)
  }));
}

function upsertCustomField(payload, userId, id = null) {
  const body = {
    entity_type: String(payload.entity_type || 'tasks'),
    key: String(payload.key || payload.label || 'campo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, ''),
    label: String(payload.label || payload.key || 'Campo customizado').trim(),
    type: String(payload.type || 'text'),
    options: JSON.stringify(Array.isArray(payload.options) ? payload.options : parseJson(payload.options, [])),
    required: boolFromPayload(payload.required)
  };
  if (id) {
    db.prepare(`
      UPDATE custom_fields
      SET entity_type = ?, key = ?, label = ?, type = ?, options = ?, required = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(body.entity_type, body.key, body.label, body.type, body.options, body.required, id);
    recordHistory('custom_fields', id, 'atualizado', body, userId);
    return customFields().find((field) => field.id === id);
  }
  const result = db.prepare(`
    INSERT INTO custom_fields (entity_type, key, label, type, options, required)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(body.entity_type, body.key, body.label, body.type, body.options, body.required);
  const newId = Number(result.lastInsertRowid);
  recordHistory('custom_fields', newId, 'criado', body, userId);
  return customFields().find((field) => field.id === newId);
}

function taskDependencies(taskId = null) {
  const where = taskId ? 'WHERE task_dependencies.task_id = ?' : '';
  const values = taskId ? [Number(taskId)] : [];
  return db.prepare(`
    SELECT task_dependencies.*, tasks.title AS task_title, parent.title AS depends_on_title
    FROM task_dependencies
    LEFT JOIN tasks ON tasks.id = task_dependencies.task_id
    LEFT JOIN tasks AS parent ON parent.id = task_dependencies.depends_on_task_id
    ${where}
    ORDER BY task_dependencies.updated_at DESC, task_dependencies.id DESC
  `).all(...values);
}

function createTaskDependency(payload, userId) {
  if (!payload.task_id) throw Object.assign(new Error('Dependencia precisa de tarefa.'), { status: 400 });
  const result = db.prepare(`
    INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type, note, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    Number(payload.task_id),
    payload.depends_on_task_id ? Number(payload.depends_on_task_id) : null,
    String(payload.dependency_type || 'operacional'),
    String(payload.note || ''),
    String(payload.status || 'ativa')
  );
  recordHistory('tasks', Number(payload.task_id), 'dependencia_criada', { dependency_id: Number(result.lastInsertRowid) }, userId);
  return taskDependencies(Number(payload.task_id)).find((item) => item.id === Number(result.lastInsertRowid));
}

function normalizeName(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchScore(hint, candidate) {
  const a = normalizeName(hint);
  const b = normalizeName(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.86;
  const aTokens = new Set(a.split(' ').filter(Boolean));
  const bTokens = new Set(b.split(' ').filter(Boolean));
  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  return overlap / Math.max(aTokens.size, bTokens.size, 1);
}

function findEntityMatches(type, hint) {
  if (!hint) return [];
  const table = type === 'client' ? 'clients' : 'assets';
  return db.prepare(`SELECT id, name, data_status FROM ${table} ORDER BY updated_at DESC`).all()
    .map((row) => ({ ...row, score: matchScore(hint, row.name) }))
    .filter((row) => row.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function isGenericAssetHint(hint) {
  return ['embarcacao', 'barco', 'lancha', 'veleiro', 'motorhome/rv', 'motorhome', 'rv'].includes(normalizeName(hint));
}

function enrichResolution(task) {
  const enriched = { ...task, questions: [...(task.questions || [])] };
  const clientMatches = findEntityMatches('client', task.client_hint);
  if (task.client_hint) {
    if (clientMatches.length === 1 && clientMatches[0].score >= 0.86) {
      enriched.client_id = clientMatches[0].id;
      enriched.client_resolution = { status: 'matched', hint: task.client_hint, matches: clientMatches };
    } else if (clientMatches.length > 1 || (clientMatches.length === 1 && clientMatches[0].score < 0.86)) {
      enriched.client_resolution = { status: 'ambiguous', hint: task.client_hint, matches: clientMatches };
      enriched.questions.push({
        field: 'client_id',
        type: 'choice',
        prompt: `Qual cadastro corresponde a "${task.client_hint}"?`,
        options: [
          ...clientMatches.map((match) => ({ label: match.name, value: String(match.id) })),
          { label: 'Criar cadastro basico pendente', value: 'create_pending' },
          { label: 'Deixar sem vinculo por enquanto', value: '' }
        ]
      });
    } else {
      enriched.create_pending_client = true;
      enriched.client_resolution = { status: 'new_pending', hint: task.client_hint, matches: [] };
    }
  } else {
    enriched.client_resolution = { status: 'none', hint: '', matches: [] };
  }

  const assetMatches = findEntityMatches('asset', task.asset_hint);
  if (task.asset_hint && !isGenericAssetHint(task.asset_hint)) {
    if (assetMatches.length === 1 && assetMatches[0].score >= 0.86) {
      enriched.asset_id = assetMatches[0].id;
      enriched.asset_resolution = { status: 'matched', hint: task.asset_hint, matches: assetMatches };
    } else if (assetMatches.length > 1 || (assetMatches.length === 1 && assetMatches[0].score < 0.86)) {
      enriched.asset_resolution = { status: 'ambiguous', hint: task.asset_hint, matches: assetMatches };
      enriched.questions.push({
        field: 'asset_id',
        type: 'choice',
        prompt: `Qual embarcacao/motorhome corresponde a "${task.asset_hint}"?`,
        options: [
          ...assetMatches.map((match) => ({ label: match.name, value: String(match.id) })),
          { label: 'Criar cadastro basico pendente', value: 'create_pending' },
          { label: 'Deixar sem vinculo por enquanto', value: '' }
        ]
      });
    } else {
      enriched.create_pending_asset = true;
      enriched.asset_resolution = { status: 'new_pending', hint: task.asset_hint, matches: [] };
    }
  } else {
    enriched.asset_resolution = { status: task.asset_hint ? 'generic' : 'none', hint: task.asset_hint || '', matches: [] };
  }

  if (!task.due_date) {
    enriched.questions.push({
      field: 'due_date',
      type: 'choice',
      prompt: 'Esta demanda precisa de prazo definido agora?',
      options: [
        { label: 'Nao, revisar depois', value: '' },
        { label: 'Hoje', value: new Date().toISOString().slice(0, 10) },
        { label: 'Amanha', value: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }
      ]
    });
  }
  return enriched;
}

function createPendingClient(name, userId) {
  const existing = findEntityMatches('client', name).find((match) => match.score >= 0.95);
  if (existing) return existing.id;
  const result = db.prepare(`
    INSERT INTO clients (name, data_status, type, notes)
    VALUES (?, 'pendente', 'pessoa_fisica', ?)
  `).run(name, 'Cadastro basico criado pela caixa inteligente. Completar telefone, e-mail, documento e observacoes.');
  const id = Number(result.lastInsertRowid);
  recordHistory('clients', id, 'criado_pendente_por_ia', { source: 'intake' }, userId);
  return id;
}

function createPendingAsset(name, clientId, userId) {
  if (!name || isGenericAssetHint(name)) return null;
  const existing = findEntityMatches('asset', name).find((match) => match.score >= 0.95);
  if (existing) return existing.id;
  const result = db.prepare(`
    INSERT INTO assets (name, data_status, type, client_id, technical_notes)
    VALUES (?, 'pendente', 'embarcacao', ?, ?)
  `).run(name, clientId || null, 'Cadastro basico criado pela caixa inteligente. Completar fabricante, modelo, ano, local, marina e sistemas instalados.');
  const id = Number(result.lastInsertRowid);
  recordHistory('assets', id, 'criado_pendente_por_ia', { source: 'intake', client_id: clientId || null }, userId);
  return id;
}

function prepareIntakeTask(payload, userId) {
  const task = { ...payload };
  if (task.client_id === 'create_pending') task.client_id = null;
  if (task.asset_id === 'create_pending') task.asset_id = null;
  if (!task.client_id && task.create_pending_client && task.client_hint) {
    task.client_id = createPendingClient(task.client_hint, userId);
  }
  if (!task.asset_id && task.create_pending_asset && task.asset_hint) {
    task.asset_id = createPendingAsset(task.asset_hint, task.client_id, userId);
  }
  if (!task.ai_reasoning_summary && task.reasoning) task.ai_reasoning_summary = task.reasoning;
  if (!task.confidence_score) {
    const missing = [task.client_id || task.client_hint, task.due_date, task.next_action].filter(Boolean).length;
    task.confidence_score = Math.max(45, Math.min(92, 55 + missing * 12));
  }
  if (!task.planned_period && task.planned_date) {
    task.planned_period = ['critica', 'alta'].includes(task.priority) || ['proposta', 'comercial', 'financeiro'].includes(task.category) ? 'manha' : 'tarde';
  }
  if (!task.last_reviewed_at) task.last_reviewed_at = now();
  return task;
}

function createTaskFromIntake(payload, userId) {
  const prepared = prepareIntakeTask(payload, userId);
  const task = createEntity('tasks', prepared, userId);
  const result = db.prepare(`
    INSERT INTO ai_actions (task_id, type, title, content, autonomy_level, status, risk, reasoning)
    VALUES (?, 'triagem', ?, ?, 1, 'registrado', ?, ?)
  `).run(task.id, `Triagem IA - ${task.title}`, JSON.stringify(prepared, null, 2), prepared.action_risk || 'baixo', prepared.reasoning || '');
  recordHistory('ai_actions', Number(result.lastInsertRowid), 'registrado', { task_id: task.id }, userId);
  return task;
}

function agentMessages(limit = 60) {
  return db.prepare('SELECT * FROM agent_messages ORDER BY id DESC LIMIT ?').all(limit)
    .reverse()
    .map((row) => ({ ...row, metadata: parseJson(row.metadata, {}) }));
}

function saveAgentMessage(role, content, metadata = {}) {
  const result = db.prepare(`
    INSERT INTO agent_messages (role, content, metadata)
    VALUES (?, ?, ?)
  `).run(role, content, JSON.stringify(metadata));
  return db.prepare('SELECT * FROM agent_messages WHERE id = ?').get(Number(result.lastInsertRowid));
}

function activeTasks() {
  return listEntities('tasks', new URL('http://local/api/tasks'))
    .filter((task) => !['concluido', 'cancelado', 'arquivado'].includes(task.status));
}

function taskById(id) {
  return getEntity('tasks', Number(id));
}

function findBestTask(text) {
  const hint = normalizeName(text);
  if (!hint) return null;
  const candidates = listEntities('tasks', new URL('http://local/api/tasks'))
    .map((task) => ({
      task,
      score: Math.max(matchScore(hint, task.title), matchScore(hint, `${task.title} ${task.client_name || ''} ${task.asset_name || ''}`))
    }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 0.28 ? candidates[0].task : null;
}

function agentProactiveState() {
  const settings = operationalSettings();
  const today = new Date().toISOString().slice(0, 10);
  const tasks = activeTasks();
  const overdue = tasks.filter((task) => task.due_date && task.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const dueToday = tasks.filter((task) => task.due_date === today).sort((a, b) => Number(b.operational_score || 0) - Number(a.operational_score || 0));
  const noOwner = tasks.filter((task) => !task.responsible).slice(0, 6);
  const blocked = tasks.filter((task) => ['aguardando_cliente', 'aguardando_fornecedor', 'aguardando_aprovacao', 'aguardando_material'].includes(task.status)).slice(0, 6);
  const highNoDate = tasks.filter((task) => ['alta', 'critica'].includes(task.priority) && !task.due_date).slice(0, 6);
  const patterns = settings.agent_pattern_detection ? buildAgentPatterns(tasks) : [];
  const flows = syncAgentFlows(patterns);
  const reminders = [
    ...overdue.slice(0, 4).map((task) => ({ type: 'atraso', task_id: task.id, title: task.title, detail: `Prazo venceu em ${task.due_date}.` })),
    ...dueToday.slice(0, 4).map((task) => ({ type: 'hoje', task_id: task.id, title: task.title, detail: `Vence hoje com score ${task.operational_score || 0}.` })),
    ...blocked.slice(0, 3).map((task) => ({ type: 'bloqueio', task_id: task.id, title: task.title, detail: `Status: ${task.status}.` })),
    ...highNoDate.slice(0, 3).map((task) => ({ type: 'sem_prazo', task_id: task.id, title: task.title, detail: 'Alta prioridade sem prazo definido.' }))
  ].slice(0, 10);
  return {
    enabled: Boolean(settings.agent_enabled),
    idle_minutes: Number(settings.agent_idle_minutes || 20),
    reminder_minutes: Number(settings.agent_reminder_minutes || 30),
    reminders,
    questions: [
      { prompt: 'Existe alguma demanda nova que ainda nao foi registrada?', options: ['Registrar agora', 'Nao por enquanto'] },
      { prompt: 'Quer que eu monte o plano do dia pelas prioridades atuais?', options: ['Sim, montar plano', 'Nao agora'] }
    ],
    patterns,
    flows,
    can_autonomously_create_internal_records: Boolean(settings.agent_autonomous_internal_actions)
  };
}

function buildAgentPatterns(tasks) {
  const byCategory = groupCount(tasks, 'category');
  const byStatus = groupCount(tasks, 'status');
  const patterns = [];
  if ((byCategory.proposta || 0) >= 3) {
    patterns.push({
      name: 'Fluxo comercial de propostas',
      trigger: 'Texto com orcamento, proposta, enviar ou retorno ao cliente',
      action: 'Criar tarefa de proposta com prioridade alta, checklist comercial, prazo proximo e rascunho de mensagem para revisao.',
      confidence: 'alta'
    });
  }
  if ((byStatus.aguardando_cliente || 0) >= 2) {
    patterns.push({
      name: 'Follow-up automatico de cliente',
      trigger: 'Tarefa parada aguardando cliente',
      action: 'Sugerir follow-up, criar rascunho e destacar no dashboard sem enviar nada externo.',
      confidence: 'media'
    });
  }
  if (tasks.some((task) => String(task.category).includes('compra') || String(task.description || '').toLowerCase().includes('sku'))) {
    patterns.push({
      name: 'Lista tecnica de materiais',
      trigger: 'Demanda com materiais, SKUs, Garmin, Victron, cabos ou fornecedores',
      action: 'Separar subtarefas para compatibilidade, SKU, disponibilidade, preco e aprovacao.',
      confidence: 'media'
    });
  }
  return patterns.slice(0, 6);
}

function syncAgentFlows(patterns) {
  for (const pattern of patterns) {
    const existing = db.prepare('SELECT id FROM agent_flows WHERE name = ?').get(pattern.name);
    if (existing) continue;
    db.prepare(`
      INSERT INTO agent_flows (name, trigger_type, condition_json, action_json, enabled)
      VALUES (?, 'pattern', ?, ?, 1)
    `).run(pattern.name, JSON.stringify({ trigger: pattern.trigger, confidence: pattern.confidence }), JSON.stringify({ action: pattern.action }));
  }
  return db.prepare('SELECT * FROM agent_flows ORDER BY updated_at DESC, id DESC LIMIT 12').all()
    .map((flow) => ({
      ...flow,
      enabled: Boolean(flow.enabled),
      condition: parseJson(flow.condition_json, {}),
      action: parseJson(flow.action_json, {})
    }));
}

function groupCount(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] || 'sem_valor';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function groupBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row);
    acc[key] ||= [];
    acc[key].push(row);
    return acc;
  }, {});
}

function agentPlanText(tasks) {
  const ordered = [...tasks]
    .sort((a, b) => agentTaskScore(b) - agentTaskScore(a))
    .slice(0, 8);
  if (!ordered.length) return 'Nao encontrei tarefas ativas para montar um plano agora.';
  return [
    'Plano operacional sugerido:',
    ...ordered.map((task, index) => `${index + 1}. ${task.title} | ${task.client_name || 'Sem cliente'} | ${task.priority} | ${task.due_date || task.planned_date || 'sem prazo'} | ${agentTaskMinutes(task)} min | score ${agentTaskScore(task)}`),
    'Posso registrar novas demandas, ajustar status/prioridade ou preparar rascunhos para revisao.'
  ].join('\n');
}

function agentTaskScore(task) {
  const persisted = Number(task.operational_score || 0);
  if (Number.isFinite(persisted) && persisted > 0) return persisted;
  let score = { critica: 96, alta: 82, media: 55, baixa: 30 }[task.priority] || 50;
  if (['proposta', 'comercial', 'financeiro'].includes(task.category)) score += 6;
  if (task.due_date && task.due_date <= new Date().toISOString().slice(0, 10)) score += 10;
  if (task.blocker_reason) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function agentTaskMinutes(task) {
  const settings = operationalSettings();
  const minutes = Number(task.estimated_minutes || settings.default_estimated_minutes || 30);
  return Number.isFinite(minutes) ? Math.max(5, Math.min(480, Math.round(minutes))) : 30;
}

function agentScheduleIntent(text) {
  return /\b(reorganize|reorganizar|organize|organizar|encaix|tempo disponivel|tempo disponível|capacidade|reagend|remanej|redistribu|planej.*hoje|tarefas de hoje|rotina de hoje|carga do dia)\b/i.test(text);
}

function dateToPt(dateValue) {
  if (!dateValue) return 'sem data';
  const [year, month, day] = dateValue.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : dateValue;
}

function addDaysIso(dateValue, days) {
  const [year, month, day] = dateValue.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextPlanningDate(today, offset) {
  let date = addDaysIso(today, offset);
  while (new Date(`${date}T00:00:00`).getDay() === 0) {
    date = addDaysIso(date, 1);
  }
  return date;
}

function agentWorkdayPool(text) {
  const today = new Date().toISOString().slice(0, 10);
  const normalized = normalizeName(text);
  const includeAll = /\b(todas|tudo|fila inteira|semana)\b/i.test(normalized);
  const tasks = activeTasks().filter((task) => {
    const planned = (task.planned_date || '').slice(0, 10);
    const due = (task.due_date || '').slice(0, 10);
    if (includeAll) return true;
    return planned === today || due === today || (due && due < today);
  });
  return tasks.length ? tasks : activeTasks().slice(0, 12);
}

function agentReorganizeWorkday(text, userId) {
  const settings = operationalSettings();
  const today = new Date().toISOString().slice(0, 10);
  const capacity = Math.max(60, Math.min(720, Number(settings.daily_capacity_minutes || 360)));
  const tasks = agentWorkdayPool(text)
    .sort((a, b) => {
      const score = agentTaskScore(b) - agentTaskScore(a);
      if (score) return score;
      const dateA = a.due_date || a.planned_date || '9999-12-31';
      const dateB = b.due_date || b.planned_date || '9999-12-31';
      return dateA.localeCompare(dateB);
    });
  if (!tasks.length) {
    return {
      message: 'Nao encontrei tarefas ativas para reorganizar. Se quiser, posso criar uma rotina base ou revisar a caixa inteligente.',
      questions: [{
        prompt: 'Qual caminho faz sentido agora?',
        options: [
          { label: 'Criar tarefa', action_prompt: 'Crie uma nova tarefa operacional para revisar depois.' },
          { label: 'Montar plano', action_prompt: 'Monte um plano com as tarefas ativas disponiveis.' },
          { label: 'Revisar atrasos', action_prompt: 'Quais tarefas estao atrasadas ou bloqueadas?' }
        ]
      }]
    };
  }

  const totalMinutes = tasks.reduce((sum, task) => sum + agentTaskMinutes(task), 0);
  let dayOffset = 0;
  let remaining = capacity;
  const allocation = [];

  for (const task of tasks) {
    const minutes = agentTaskMinutes(task);
    if (allocation.some((item) => item.date === nextPlanningDate(today, dayOffset)) && minutes > remaining) {
      dayOffset += 1;
      remaining = capacity;
    }
    const plannedDate = nextPlanningDate(today, dayOffset);
    const plannedPeriod = allocation.filter((item) => item.date === plannedDate)
      .reduce((sum, item) => sum + item.minutes, 0) < Math.floor(capacity / 2) ? 'manha' : 'tarde';
    const patch = {
      planned_date: plannedDate,
      planned_period: plannedPeriod,
      rank: allocation.length + 1,
      last_reviewed_at: now()
    };
    if (['entrada_capturada', 'triagem'].includes(task.status)) patch.status = 'a_fazer';
    const updated = updateEntity('tasks', task.id, patch, userId);
    allocation.push({ task: updated, minutes, date: plannedDate });
    remaining -= minutes;
  }

  const byDate = groupBy(allocation, (item) => item.date);
  const todayItems = byDate[today] || [];
  const movedItems = allocation.filter((item) => item.date !== today);
  const lines = [
    `Reorganizei ${allocation.length} tarefa(s) usando capacidade diaria de ${capacity} min (${Math.round(capacity / 60 * 10) / 10}h).`,
    `Esforco total estimado: ${totalMinutes} min (${Math.round(totalMinutes / 60 * 10) / 10}h). ${totalMinutes <= capacity ? 'Cabe no dia de hoje.' : `Nao cabe em um unico dia; redistribui o excedente em ${Object.keys(byDate).length} dia(s).`}`,
    '',
    'Raciocinio operacional resumido:',
    '- Priorizei score, prazo vencido/hoje, prioridade critica/alta e impacto comercial/financeiro.',
    '- Atualizei o campo planejado para, mantendo o prazo original como referencia de risco.',
    '- Itens que excederam a capacidade foram movidos para os proximos dias uteis.',
    '',
    'Plano aplicado:',
    ...Object.entries(byDate).map(([date, items]) => {
      const minutes = items.reduce((sum, item) => sum + item.minutes, 0);
      const titles = items.map((item, index) => `   ${index + 1}. ${item.task.title} | ${item.minutes} min | score ${agentTaskScore(item.task)}`).join('\n');
      return `${dateToPt(date)} - ${minutes} min\n${titles}`;
    })
  ];
  if (movedItems.length) {
    lines.push('', `Reagendadas para proximos dias: ${movedItems.map((item) => item.task.title).join('; ')}.`);
  }
  return {
    message: lines.join('\n'),
    questions: [],
    updated_task_ids: allocation.map((item) => item.task.id),
    today_task_ids: todayItems.map((item) => item.task.id)
  };
}

function agentBlockedText() {
  const proactive = agentProactiveState();
  if (!proactive.reminders.length) return 'Nao encontrei atrasos ou bloqueios criticos agora.';
  return [
    'Pontos que merecem atencao:',
    ...proactive.reminders.map((item, index) => `${index + 1}. ${item.title} | ${item.type} | ${item.detail}`)
  ].join('\n');
}

function agentCanHandleAsTask(text) {
  return /\b(crie|criar|registre|registrar|adiciona|adicionar|nova tarefa|lembre|lembrar|demanda|pendencia|pendência|preciso|cliente|orcamento|orçamento|proposta|follow)/i.test(text);
}

function agentExplicitCreateIntent(text) {
  return /\b(crie|criar|registre|registrar|adiciona|adicionar|nova tarefa|nova demanda|nova pendencia|nova pendÃªncia|lembre|lembrar)\b/i.test(text);
}

function agentWantsDraft(text) {
  return /\b(rascunho|email|e-mail|whatsapp|mensagem)\b/i.test(text) && /\b(prepar|crie|criar|gerar|redig|rascunho)\b/i.test(text);
}

function agentPreviewIntent(text) {
  return /\b(antes de agir|antes de executar|confirme|confirmar antes|o que voce entendeu|o que vocÃª entendeu|interprete|interpretar antes|pergunte antes|sem executar)\b/i.test(text);
}

function agentNoActionIntent(text) {
  return /\b(nao execute nada|nÃ£o execute nada|nao executar|nÃ£o executar|nao execute|nÃ£o execute|nao agora|nÃ£o agora|cancelar acao|cancelar aÃ§Ã£o|manter.*referencia|manter.*referÃªncia)\b/i.test(text);
}

function agentDangerousRequest(text) {
  return /\b(excluir|exclua|apagar|apague|deletar|delete|remover definitivamente|zerar|senha|permissao|permissão|configuracao critica|configuração crítica|alterar configuracoes|alterar configurações)\b/i.test(text);
}

function agentClarifyingQuestions(text) {
  const normalized = normalizeName(text);
  if (normalized.length < 12) {
    return [
      {
        prompt: 'O que voce quer que eu faca com essa informacao?',
        options: [
          { label: 'Criar tarefa', action_prompt: `Crie uma tarefa usando este contexto: ${text}` },
          { label: 'Montar plano', action_prompt: `Monte um plano considerando este contexto: ${text}` },
          { label: 'Preparar rascunho', action_prompt: `Prepare um rascunho usando este contexto: ${text}` }
        ]
      },
      {
        prompt: 'Qual urgencia devo considerar?',
        options: [
          { label: 'Hoje', action_prompt: `Crie uma tarefa para hoje usando este contexto: ${text}` },
          { label: 'Esta semana', action_prompt: `Crie uma tarefa para esta semana usando este contexto: ${text}` },
          { label: 'Sem prazo', action_prompt: `Crie uma tarefa sem prazo definido usando este contexto: ${text}` }
        ]
      }
    ];
  }
  return [];
}

function agentInterpretationPreview(text) {
  const interpreted = interpretOperationalBatch(text);
  const tasks = interpreted.tasks.map(enrichResolution).slice(0, 10);
  const summary = tasks.length
    ? tasks.map((task, index) => `${index + 1}. ${task.title} | ${task.client_hint || 'sem cliente'} | ${task.priority} | ${task.due_date || 'sem prazo'} | ${task.category}`).join('\n')
    : 'Nao encontrei tarefas claras no texto.';
  const content = [
    'Antes de agir, esta e minha leitura operacional:',
    summary,
    '',
    'Nao executei nenhuma alteracao. Posso criar as tarefas, montar plano ou transformar isso em rascunho se voce confirmar.'
  ].join('\n');
  return {
    message: content,
    questions: [{
      prompt: 'Como devo seguir?',
      options: [
        { label: 'Confirmar e criar tarefas', action_prompt: `Confirmo: registre as demandas internas deste texto: ${text}` },
        { label: 'Montar plano', action_prompt: `Monte um plano com base neste texto, sem enviar nada externo: ${text}` },
        { label: 'Nao executar', action_prompt: 'Nao execute nada agora. Apenas mantenha essa interpretacao como referencia.' }
      ]
    }]
  };
}

function agentCreateDraft(text, userId) {
  const task = findBestTask(text);
  if (!task) {
    return {
      ok: false,
      message: 'Nao encontrei uma tarefa correspondente para criar o rascunho. Informe o titulo, cliente ou embarcacao da tarefa.',
      questions: [{ prompt: 'Qual tarefa devo usar como base?', options: ['Ultima tarefa criada', 'Tarefa de maior score', 'Vou escrever o titulo'] }]
    };
  }
  const type = /\b(whatsapp|zap|mensagem)\b/i.test(text) ? 'whatsapp' : 'email';
  const draft = createDraft({ task, type });
  const result = db.prepare(`
    INSERT INTO ai_actions (task_id, type, title, content, autonomy_level, status, risk, reasoning)
    VALUES (?, ?, ?, ?, ?, 'aguardando_revisao', ?, ?)
  `).run(task.id, type, draft.title, draft.content, draft.autonomy_level, draft.risk, draft.reasoning);
  recordHistory('tasks', task.id, 'rascunho_ia_criado_pelo_chat', { ai_action_id: Number(result.lastInsertRowid), type }, userId);
  return {
    ok: true,
    message: `Criei um rascunho de ${type === 'whatsapp' ? 'WhatsApp' : 'e-mail'} para revisao humana na fila de aprovacoes: ${task.title}.`
  };
}

function agentCreateTasksFromText(text, userId) {
  const interpreted = interpretOperationalBatch(text);
  return interpreted.tasks
    .map(enrichResolution)
    .slice(0, 12)
    .map((task) => createTaskFromIntake({ ...task, selected: true }, userId));
}

function agentCreateTasksAndDrafts(text, userId) {
  const created = agentCreateTasksFromText(text, userId);
  const type = /\b(whatsapp|zap|mensagem)\b/i.test(text) ? 'whatsapp' : 'email';
  const drafts = created.map((task) => {
    const draft = createDraft({ task, type });
    const result = db.prepare(`
      INSERT INTO ai_actions (task_id, type, title, content, autonomy_level, status, risk, reasoning)
      VALUES (?, ?, ?, ?, ?, 'aguardando_revisao', ?, ?)
    `).run(task.id, type, draft.title, draft.content, draft.autonomy_level, draft.risk, draft.reasoning);
    recordHistory('tasks', task.id, 'rascunho_ia_criado_pelo_chat', { ai_action_id: Number(result.lastInsertRowid), type }, userId);
    return { id: Number(result.lastInsertRowid), task_id: task.id, type, title: draft.title };
  });
  const content = created.length
    ? [
      `Registrei ${created.length} tarefa(s) e criei ${drafts.length} rascunho(s) de ${type === 'whatsapp' ? 'WhatsApp' : 'e-mail'} para revisao humana.`,
      ...created.map((task, index) => `${index + 1}. ${task.title} | ${task.priority} | ${task.due_date || 'sem prazo'}`)
    ].join('\n')
    : 'Nao consegui identificar uma tarefa segura para registrar antes do rascunho.';
  return { message: content, tasks: created, drafts, questions: [] };
}

function agentUpdateTask(text, userId) {
  const task = findBestTask(text);
  if (!task) return null;
  const patch = {};
  const statusMap = [
    ['conclu', 'concluido'],
    ['andamento', 'em_andamento'],
    ['aguardando cliente', 'aguardando_cliente'],
    ['aguardando fornecedor', 'aguardando_fornecedor'],
    ['aguardando aprovacao', 'aguardando_aprovacao'],
    ['aguardando aprovação', 'aguardando_aprovacao'],
    ['a fazer', 'a_fazer']
  ];
  const lower = text.toLowerCase();
  for (const [hint, status] of statusMap) {
    if (lower.includes(hint)) patch.status = status;
  }
  for (const priority of ['critica', 'alta', 'media', 'baixa']) {
    if (lower.includes(`prioridade ${priority}`)) patch.priority = priority;
  }
  if (!Object.keys(patch).length) return null;
  const updated = updateEntity('tasks', task.id, patch, userId);
  return `Atualizei "${updated.title}" com ${Object.entries(patch).map(([key, value]) => `${key}: ${value}`).join(', ')}.`;
}

function agentWantsComment(text) {
  return /\b(comentario|comentario interno|registre no historico|registrar no historico|observacao interna|anote|anotar)\b/i.test(text);
}

function agentCreateCommentFromText(text, userId) {
  const task = findBestTask(text);
  if (!task) {
    return {
      message: 'Nao encontrei uma tarefa suficientemente parecida para registrar o comentario. Informe o titulo ou cliente da tarefa.',
      questions: [{
        prompt: 'Onde devo registrar?',
        options: [
          { label: 'Criar nova tarefa', action_prompt: `Crie uma tarefa com este contexto e registre a observacao: ${text}` },
          { label: 'Listar prioridades', action_prompt: 'Mostre a lista de prioridades para eu escolher uma tarefa.' }
        ]
      }]
    };
  }
  const content = text
    .replace(/\b(registre|registrar|adicione|adicionar|comentario|comentario interno|observacao interna|anote|anotar|no historico|na tarefa)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim() || text;
  const comment = createComment({
    entity_type: 'tasks',
    entity_id: task.id,
    content,
    author_type: 'ia',
    author_name: 'IA HBR'
  }, userId, 'IA HBR');
  return {
    message: `Registrei comentario interno em "${task.title}" e mantive no historico da tarefa.`,
    comment
  };
}

function agentBlockTask(text, userId) {
  if (!/\b(bloquead|bloquear|bloqueio|aguardando|depend|depende)\b/i.test(text)) return null;
  const task = findBestTask(text);
  if (!task) return null;
  const lower = text.toLowerCase();
  const patch = {
    blocker_reason: text.slice(0, 300),
    blocker_type: 'operacional',
    last_reviewed_at: now()
  };
  if (lower.includes('cliente')) {
    patch.status = 'aguardando_cliente';
    patch.blocker_type = 'cliente';
  } else if (lower.includes('fornecedor')) {
    patch.status = 'aguardando_fornecedor';
    patch.blocker_type = 'fornecedor';
  } else if (lower.includes('material') || lower.includes('peca') || lower.includes('peça')) {
    patch.status = 'aguardando_material';
    patch.blocker_type = 'material';
  } else if (lower.includes('aprov')) {
    patch.status = 'aguardando_aprovacao';
    patch.blocker_type = 'aprovacao';
  }
  const updated = updateEntity('tasks', task.id, patch, userId);
  createComment({
    entity_type: 'tasks',
    entity_id: task.id,
    content: `Bloqueio registrado pela IA: ${patch.blocker_reason}`,
    author_type: 'ia',
    author_name: 'IA HBR'
  }, userId, 'IA HBR');
  return `Registrei bloqueio em "${updated.title}" (${patch.blocker_type}) e atualizei o status para ${labelForStatus(updated.status)}.`;
}

function labelForStatus(status) {
  return {
    entrada_capturada: 'Entrada capturada',
    triagem: 'Triagem',
    a_fazer: 'A fazer',
    em_andamento: 'Em andamento',
    aguardando_cliente: 'Aguardando cliente',
    aguardando_fornecedor: 'Aguardando fornecedor',
    aguardando_aprovacao: 'Aguardando aprovacao',
    aguardando_material: 'Aguardando material',
    agendado: 'Agendado',
    concluido: 'Concluido',
    cancelado: 'Cancelado',
    arquivado: 'Arquivado'
  }[status] || status || '';
}

function agentRunAutomations(text, userId) {
  if (!/\b(rode|rodar|executar|execute|automacao|automacoes|automa[cç][aã]o|automa[cç][oõ]es)\b/i.test(text)) return null;
  const enabled = automationRules().filter((rule) => rule.enabled).slice(0, 6);
  const runs = enabled.map((rule) => runAutomationRule(rule.id, userId));
  return {
    message: runs.length
      ? `Executei ${runs.length} automacao(oes) interna(s) e registrei logs. Nada externo foi enviado.\n${runs.map((run, index) => `${index + 1}. ${run.rule.name}: ${run.summary}`).join('\n')}`
      : 'Nao ha automacoes internas ativas para executar.',
    runs
  };
}

function handleAgentChat(text, userId) {
  const cleanText = String(text || '').trim();
  if (!cleanText) throw Object.assign(new Error('Mensagem obrigatoria.'), { status: 400 });
  saveAgentMessage('user', cleanText, {});

  if (agentDangerousRequest(cleanText)) {
    const content = 'Nao vou executar exclusao, alteracao sensivel de configuracoes, senha ou permissao pelo chat. Posso preparar uma recomendacao e deixar a acao para execucao manual.';
    saveAgentMessage('assistant', content, { action: 'blocked_sensitive' });
    return { message: content, questions: [] };
  }

  if (agentNoActionIntent(cleanText)) {
    const content = 'Combinado. Nao executei nenhuma acao e mantive a interpretacao apenas como referencia para consulta.';
    saveAgentMessage('assistant', content, { action: 'no_action_confirmed' });
    return { message: content, questions: [] };
  }

  if (agentPreviewIntent(cleanText)) {
    const result = agentInterpretationPreview(cleanText);
    saveAgentMessage('assistant', result.message, { action: 'preview_only', questions: result.questions });
    return result;
  }

  if (agentScheduleIntent(cleanText)) {
    const result = agentReorganizeWorkday(cleanText, userId);
    saveAgentMessage('assistant', result.message, {
      action: 'workday_reorganized',
      updated_task_ids: result.updated_task_ids || [],
      today_task_ids: result.today_task_ids || []
    });
    return result;
  }

  const automationRun = agentRunAutomations(cleanText, userId);
  if (automationRun) {
    saveAgentMessage('assistant', automationRun.message, { action: 'automation_rules_run', run_count: automationRun.runs.length });
    return { message: automationRun.message, questions: [], runs: automationRun.runs };
  }

  const questions = agentClarifyingQuestions(cleanText);
  if (questions.length) {
    const content = 'A entrada ficou rasa demais para eu agir com seguranca. Escolha uma direcao e eu continuo a partir dela.';
    saveAgentMessage('assistant', content, { questions, action: 'clarify' });
    return { message: content, questions };
  }

  if (/\b(marque|marcar|altere|alterar|atualize|atualizar|defina|coloque|mude|mudar)\b/i.test(cleanText)) {
    const updated = agentUpdateTask(cleanText, userId);
    if (updated) {
      saveAgentMessage('assistant', updated, { action: 'task_updated' });
      return { message: updated, questions: [] };
    }
  }

  const blocked = agentBlockTask(cleanText, userId);
  if (blocked) {
    saveAgentMessage('assistant', blocked, { action: 'task_blocked' });
    return { message: blocked, questions: [] };
  }

  if (agentWantsComment(cleanText)) {
    const result = agentCreateCommentFromText(cleanText, userId);
    saveAgentMessage('assistant', result.message, { action: result.comment ? 'comment_created' : 'comment_needs_task', questions: result.questions || [] });
    return { message: result.message, questions: result.questions || [], comment: result.comment };
  }

  if (agentWantsDraft(cleanText) && agentExplicitCreateIntent(cleanText)) {
    const result = agentCreateTasksAndDrafts(cleanText, userId);
    saveAgentMessage('assistant', result.message, {
      action: 'tasks_and_drafts_created',
      task_ids: result.tasks.map((task) => task.id),
      draft_ids: result.drafts.map((draft) => draft.id)
    });
    return result;
  }

  if (agentWantsDraft(cleanText)) {
    const result = agentCreateDraft(cleanText, userId);
    saveAgentMessage('assistant', result.message, { action: result.ok ? 'draft_created' : 'draft_needs_context', questions: result.questions || [] });
    return { message: result.message, questions: result.questions || [] };
  }

  if (/\b(plano do dia|prioridades|o que fazer|ordem de prioridade|fila)\b/i.test(cleanText)) {
    const content = agentPlanText(activeTasks());
    saveAgentMessage('assistant', content, { action: 'plan_generated' });
    return { message: content, questions: [] };
  }

  if (/\b(atrasad\w*|bloquead\w*|parad\w*|aguardando)\b/i.test(cleanText)) {
    const content = agentBlockedText();
    saveAgentMessage('assistant', content, { action: 'blockers_summary' });
    return { message: content, questions: [] };
  }

  if (agentCanHandleAsTask(cleanText)) {
    const created = agentCreateTasksFromText(cleanText, userId);
    const content = created.length
      ? `Registrei ${created.length} tarefa(s) interna(s) e deixei tudo rastreado. Principais itens:\n${created.map((task, index) => `${index + 1}. ${task.title} | ${task.priority} | ${task.due_date || 'sem prazo'}`).join('\n')}`
      : 'Interpretei a entrada, mas nao encontrei uma tarefa segura para criar. Me diga cliente, ativo ou proxima acao desejada.';
    const followup = created.some((task) => !task.client_id || !task.due_date)
      ? [{
        prompt: 'Quer complementar agora os dados pendentes?',
        options: [
          { label: 'Adicionar cliente/prazo', action_prompt: `Quero complementar cliente e prazo das tarefas criadas: ${created.map((task) => task.title).join('; ')}` },
          { label: 'Depois', action_prompt: 'Nao complementar agora. Manter cadastros pendentes para revisar depois.' },
          { label: 'Abrir tarefas', action_prompt: 'Mostre um resumo das tarefas ativas por prioridade.' }
        ]
      }]
      : [];
    saveAgentMessage('assistant', content, { action: 'tasks_created', task_ids: created.map((task) => task.id), questions: followup });
    return { message: content, questions: followup, tasks: created };
  }

  const content = [
    'Entendi o contexto, mas vou confirmar antes de agir porque nao ficou claro se voce quer criar tarefa, alterar uma tarefa existente ou gerar um rascunho.',
    'Posso agir dentro do app quando a intencao estiver clara; acoes externas continuam travadas para aprovacao.'
  ].join('\n');
  const fallbackQuestions = [
    {
      prompt: 'Qual caminho devo seguir?',
      options: [
        { label: 'Criar tarefa', action_prompt: `Crie uma tarefa a partir desta mensagem: ${cleanText}` },
        { label: 'Atualizar tarefa', action_prompt: `Atualize uma tarefa existente usando este contexto: ${cleanText}` },
        { label: 'Gerar rascunho', action_prompt: `Prepare um rascunho usando este contexto: ${cleanText}` }
      ]
    }
  ];
  saveAgentMessage('assistant', content, { action: 'needs_intent', questions: fallbackQuestions });
  return { message: content, questions: fallbackQuestions };
}

async function api(req, res, url) {
  if (url.pathname === '/api/app-version' && req.method === 'GET') {
    return json(res, 200, {
      name: 'hbr-operacional-ia',
      version: APP_VERSION,
      backend: true,
      features: ['saved_views', 'comments', 'automation_rules', 'task_templates', 'task_dependencies', 'custom_fields']
    });
  }

  if (url.pathname === '/api/setup/status' && req.method === 'GET') {
    const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    return json(res, 200, { needsSetup: count === 0 });
  }

  if (url.pathname === '/api/setup' && req.method === 'POST') {
    const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    if (count > 0) return json(res, 409, { error: 'Configuracao inicial ja foi concluida.' });
    const body = await readBody(req);
    if (!body.name || !body.email || !body.password || body.password.length < 8) {
      return json(res, 400, { error: 'Informe nome, e-mail e senha com pelo menos 8 caracteres.' });
    }
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(body.name, body.email.toLowerCase(), hashPassword(body.password), 'admin');
    return json(res, 201, { ok: true });
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(body.email || '').toLowerCase());
    if (!user || !verifyPassword(String(body.password || ''), user.password_hash)) {
      return json(res, 401, { error: 'E-mail ou senha invalidos.' });
    }
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expires);
    return json(res, 200, { id: user.id, name: user.name, email: user.email, role: user.role }, {
      'Set-Cookie': `hbr_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`
    });
  }

  if (url.pathname === '/api/logout' && req.method === 'POST') {
    const token = parseCookies(req).hbr_session;
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'hbr_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
  }

  const session = requireAuth(req, res);
  if (!session) return;

  if (url.pathname === '/api/me' && req.method === 'GET') return json(res, 200, session);
  if (url.pathname === '/api/dashboard' && req.method === 'GET') return json(res, 200, dashboard());
  if (url.pathname === '/api/settings' && req.method === 'GET') return json(res, 200, operationalSettings());
  if (url.pathname === '/api/settings' && req.method === 'PUT') {
    const settings = setSetting('operational', cleanSettings(await readBody(req)));
    recordHistory('settings', 1, 'atualizado', settings, session.id);
    return json(res, 200, settings);
  }

  if (url.pathname === '/api/saved-views' && req.method === 'GET') {
    return json(res, 200, savedViews(url.searchParams.get('scope') || 'tasks'));
  }

  if (url.pathname === '/api/saved-views' && req.method === 'POST') {
    return json(res, 201, createSavedView(await readBody(req), session.id));
  }

  const savedViewMatch = url.pathname.match(/^\/api\/saved-views\/(\d+)$/);
  if (savedViewMatch) {
    const id = Number(savedViewMatch[1]);
    if (req.method === 'PUT') {
      const row = updateSavedView(id, await readBody(req), session.id);
      return row ? json(res, 200, row) : json(res, 404, { error: 'View salva nao encontrada.' });
    }
    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM saved_views WHERE id = ?').run(id);
      recordHistory('saved_views', id, 'excluido', {}, session.id);
      return json(res, 204, {});
    }
  }

  if (url.pathname === '/api/comments' && req.method === 'GET') {
    return json(res, 200, comments(url.searchParams.get('entity_type') || '', url.searchParams.get('entity_id') || null));
  }

  if (url.pathname === '/api/comments' && req.method === 'POST') {
    return json(res, 201, createComment(await readBody(req), session.id, session.name));
  }

  const commentMatch = url.pathname.match(/^\/api\/comments\/(\d+)$/);
  if (commentMatch && req.method === 'DELETE') {
    const id = Number(commentMatch[1]);
    const existing = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    if (!existing) return json(res, 404, { error: 'Comentario nao encontrado.' });
    db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    recordHistory(existing.entity_type, existing.entity_id, 'comentario_excluido', { comment_id: id }, session.id);
    return json(res, 204, {});
  }

  if (url.pathname === '/api/automation-rules' && req.method === 'GET') {
    return json(res, 200, automationRules());
  }

  if (url.pathname === '/api/automation-rules' && req.method === 'POST') {
    return json(res, 201, upsertAutomationRule(await readBody(req), session.id));
  }

  const automationRuleMatch = url.pathname.match(/^\/api\/automation-rules\/(\d+)(?:\/(run))?$/);
  if (automationRuleMatch) {
    const id = Number(automationRuleMatch[1]);
    if (automationRuleMatch[2] === 'run' && req.method === 'POST') return json(res, 200, runAutomationRule(id, session.id));
    if (req.method === 'PUT') {
      const rule = upsertAutomationRule(await readBody(req), session.id, id);
      return rule ? json(res, 200, rule) : json(res, 404, { error: 'Automacao nao encontrada.' });
    }
    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM automation_rules WHERE id = ?').run(id);
      recordHistory('automation_rules', id, 'excluido', {}, session.id);
      return json(res, 204, {});
    }
  }

  if (url.pathname === '/api/automation-runs' && req.method === 'GET') {
    return json(res, 200, automationRuns());
  }

  if (url.pathname === '/api/task-templates' && req.method === 'GET') {
    return json(res, 200, taskTemplates());
  }

  if (url.pathname === '/api/task-templates' && req.method === 'POST') {
    return json(res, 201, upsertTaskTemplate(await readBody(req), session.id));
  }

  const taskTemplateMatch = url.pathname.match(/^\/api\/task-templates\/(\d+)$/);
  if (taskTemplateMatch) {
    const id = Number(taskTemplateMatch[1]);
    if (req.method === 'PUT') {
      const template = upsertTaskTemplate(await readBody(req), session.id, id);
      return template ? json(res, 200, template) : json(res, 404, { error: 'Template nao encontrado.' });
    }
    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM task_templates WHERE id = ?').run(id);
      recordHistory('task_templates', id, 'excluido', {}, session.id);
      return json(res, 204, {});
    }
  }

  if (url.pathname === '/api/custom-fields' && req.method === 'GET') {
    return json(res, 200, customFields(url.searchParams.get('entity_type') || ''));
  }

  if (url.pathname === '/api/custom-fields' && req.method === 'POST') {
    return json(res, 201, upsertCustomField(await readBody(req), session.id));
  }

  const customFieldMatch = url.pathname.match(/^\/api\/custom-fields\/(\d+)$/);
  if (customFieldMatch) {
    const id = Number(customFieldMatch[1]);
    if (req.method === 'PUT') {
      const field = upsertCustomField(await readBody(req), session.id, id);
      return field ? json(res, 200, field) : json(res, 404, { error: 'Campo customizado nao encontrado.' });
    }
    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM custom_fields WHERE id = ?').run(id);
      recordHistory('custom_fields', id, 'excluido', {}, session.id);
      return json(res, 204, {});
    }
  }

  if (url.pathname === '/api/task-dependencies' && req.method === 'GET') {
    return json(res, 200, taskDependencies(url.searchParams.get('task_id') || null));
  }

  if (url.pathname === '/api/task-dependencies' && req.method === 'POST') {
    return json(res, 201, createTaskDependency(await readBody(req), session.id));
  }

  const taskDependencyMatch = url.pathname.match(/^\/api\/task-dependencies\/(\d+)$/);
  if (taskDependencyMatch && req.method === 'DELETE') {
    const id = Number(taskDependencyMatch[1]);
    const existing = db.prepare('SELECT * FROM task_dependencies WHERE id = ?').get(id);
    if (!existing) return json(res, 404, { error: 'Dependencia nao encontrada.' });
    db.prepare('DELETE FROM task_dependencies WHERE id = ?').run(id);
    recordHistory('tasks', existing.task_id, 'dependencia_excluida', { dependency_id: id }, session.id);
    return json(res, 204, {});
  }

  if (url.pathname === '/api/agent/messages' && req.method === 'GET') {
    return json(res, 200, agentMessages());
  }

  if (url.pathname === '/api/agent/proactive' && req.method === 'GET') {
    return json(res, 200, agentProactiveState());
  }

  if (url.pathname === '/api/agent/chat' && req.method === 'POST') {
    const body = await readBody(req);
    const result = handleAgentChat(body.message, session.id);
    return json(res, 200, { ...result, messages: agentMessages(), proactive: agentProactiveState() });
  }

  if (url.pathname === '/api/intake/interpret' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.text || !String(body.text).trim()) return json(res, 400, { error: 'Texto da demanda e obrigatorio.' });
    const interpreted = interpretOperationalBatch(String(body.text));
    return json(res, 200, {
      ...interpreted,
      tasks: interpreted.tasks.map(enrichResolution)
    });
  }

  if (url.pathname === '/api/tasks/from-intake' && req.method === 'POST') {
    const body = await readBody(req);
    const tasks = Array.isArray(body.tasks) ? body.tasks : [body];
    const created = tasks.filter((task) => task.selected !== false).map((task) => createTaskFromIntake(task, session.id));
    return json(res, 201, Array.isArray(body.tasks) ? { tasks: created } : created[0]);
  }

  const draftMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/drafts$/);
  if (draftMatch && req.method === 'POST') {
    const task = getEntity('tasks', Number(draftMatch[1]));
    if (!task) return json(res, 404, { error: 'Tarefa nao encontrada.' });
    const body = await readBody(req);
    const type = body.type === 'whatsapp' ? 'whatsapp' : 'email';
    const draft = createDraft({ task, type });
    const result = db.prepare(`
      INSERT INTO ai_actions (task_id, type, title, content, autonomy_level, status, risk, reasoning)
      VALUES (?, ?, ?, ?, ?, 'aguardando_revisao', ?, ?)
    `).run(task.id, type, draft.title, draft.content, draft.autonomy_level, draft.risk, draft.reasoning);
    recordHistory('tasks', task.id, 'rascunho_ia_criado', { ai_action_id: Number(result.lastInsertRowid), type }, session.id);
    return json(res, 201, { id: Number(result.lastInsertRowid), ...draft, type, status: 'aguardando_revisao', task_id: task.id });
  }

  if (url.pathname === '/api/ai-actions' && req.method === 'GET') {
    const rows = db.prepare(`
      SELECT ai_actions.*, tasks.title AS task_title
      FROM ai_actions
      LEFT JOIN tasks ON tasks.id = ai_actions.task_id
      ORDER BY ai_actions.updated_at DESC
    `).all();
    return json(res, 200, rows);
  }

  const aiActionMatch = url.pathname.match(/^\/api\/ai-actions\/(\d+)\/(approve|reject)$/);
  if (aiActionMatch && req.method === 'POST') {
    const id = Number(aiActionMatch[1]);
    const status = aiActionMatch[2] === 'approve' ? 'aprovado' : 'rejeitado';
    db.prepare('UPDATE ai_actions SET status = ?, approved_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, now(), id);
    recordHistory('ai_actions', id, status, {}, session.id);
    return json(res, 200, db.prepare('SELECT * FROM ai_actions WHERE id = ?').get(id));
  }

  const historyMatch = url.pathname.match(/^\/api\/(tasks|clients|assets|projects|documents|ai-actions)\/(\d+)\/history$/);
  if (historyMatch && req.method === 'GET') {
    return json(res, 200, histories(historyMatch[1], Number(historyMatch[2])));
  }

  const entityMatch = url.pathname.match(/^\/api\/(clients|assets|projects|documents|tasks)(?:\/(\d+))?$/);
  if (entityMatch) {
    const [, type, idRaw] = entityMatch;
    const id = idRaw ? Number(idRaw) : null;
    if (req.method === 'GET' && !id) return json(res, 200, listEntities(type, url));
    if (req.method === 'GET' && id) {
      const row = getEntity(type, id);
      return row ? json(res, 200, row) : json(res, 404, { error: 'Registro nao encontrado.' });
    }
    if (req.method === 'POST' && !id) return json(res, 201, createEntity(type, await readBody(req), session.id));
    if (req.method === 'PUT' && id) return json(res, 200, updateEntity(type, id, await readBody(req), session.id));
    if (req.method === 'DELETE' && id) return json(res, deleteEntity(type, id, session.id) ? 204 : 404, {});
  }

  return json(res, 404, { error: 'Rota nao encontrada.' });
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

async function staticFile(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = normalize(join(publicDir, requested));
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    const index = await readFile(join(publicDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': mime['.html'] });
    res.end(index);
    return;
  }
  const buffer = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
  res.end(buffer);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else await staticFile(req, res, url);
  } catch (error) {
    console.error(error);
    send(res, error.status || 500, { error: error.message || 'Erro interno.' });
  }
}).listen(PORT, () => {
  console.log(`HBR Operacional IA em http://localhost:${PORT}`);
});
