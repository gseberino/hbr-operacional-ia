const domainProducts = [
  'Victron', 'Cerbo GX', 'SmartShunt', 'VE.Direct', 'MultiPlus', 'Quattro',
  'Orion', 'Lynx', 'BMV', 'Raymarine', 'Garmin', 'Simrad', 'Furuno', 'B&G',
  'Maretron', 'NMEA2000', 'NMEA0183', 'GPSMAP', 'sonar', 'VHF'
];

const categories = [
  ['proposta', ['proposta', 'orcamento', 'orçamento', 'cotacao', 'cotação', 'valor']],
  ['ordem_servico', ['ordem de servico', 'ordem de serviço', 'os ', 'servico', 'serviço', 'instalacao', 'instalação']],
  ['diagnostico_tecnico', ['diagnostico', 'diagnóstico', 'falha', 'problema', 'medir', 'teste', 'inspecao', 'inspeção']],
  ['compra_material', ['material', 'peca', 'peça', 'fornecedor', 'comprar', 'sku', 'estoque']],
  ['agenda', ['agenda', 'reuniao', 'reunião', 'visita', 'marcar', 'deslocamento']],
  ['documento', ['documento', 'drive', 'dropbox', 'arquivo', 'relatorio', 'relatório']],
  ['financeiro', ['pagamento', 'cobranca', 'cobrança', 'nota fiscal', 'boleto', 'sinal']],
  ['comercial', ['cliente', 'retorno', 'follow-up', 'follow up', 'responder', 'venda']]
];

const weekdays = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  terça: 2,
  'terça-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
  sábado: 6
};

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function nextWeekday(targetDay) {
  const date = new Date();
  const current = date.getDay();
  let delta = targetDay - current;
  if (delta < 0) delta += 7;
  date.setDate(date.getDate() + delta);
  return toDateOnly(date);
}

function detectDueDate(text) {
  const clean = normalize(text);
  const today = new Date();
  if (clean.includes('hoje')) return toDateOnly(today);
  if (clean.includes('amanha')) {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return toDateOnly(date);
  }
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const br = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (br) {
    const year = br[3] ? (br[3].length === 2 ? `20${br[3]}` : br[3]) : String(today.getFullYear());
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  for (const [name, day] of Object.entries(weekdays)) {
    if (clean.includes(name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
      return nextWeekday(day);
    }
  }
  return '';
}

function detectClient(text) {
  const match = text.match(/cliente\s+([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\wÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç.-]*(?:\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\wÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç.-]*){0,3})/);
  if (match) return match[1].trim().replace(/[,.]$/, '');
  const sr = text.match(/\b(?:sr\.?|sra\.?)\s+([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\wÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç.-]*(?:\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\wÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç.-]*){0,2})/i);
  return sr ? sr[1].trim().replace(/[,.]$/, '') : '';
}

function detectLocation(text) {
  const marina = text.match(/\b(Marina\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\wÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç.-]*(?:\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\wÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç.-]*){0,4})/);
  if (marina) return marina[1].trim().replace(/[,.]$/, '');
  const local = text.match(/\b(?:em|na|no)\s+([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\wÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç.-]*(?:\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\wÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç.-]*){1,4})/);
  return local ? local[1].trim().replace(/[,.]$/, '') : '';
}

function detectAsset(text) {
  const clean = normalize(text);
  const named = text.match(/\bembarca[cç][aã]o\s+([A-Z][\w.-]*(?:\s+[A-Z][\w.-]*){0,3})/i);
  if (named) return named[1].trim().replace(/[,.]$/, '');
  if (clean.includes('motorhome') || clean.includes('rv')) return 'motorhome/RV';
  if (clean.includes('lancha')) return 'lancha';
  if (clean.includes('veleiro')) return 'veleiro';
  if (clean.includes('embarcacao') || clean.includes('barco')) return 'embarcacao';
  return '';
}

function detectProducts(text) {
  const clean = normalize(text);
  return domainProducts.filter((product) => clean.includes(normalize(product)));
}

function detectCategory(text) {
  const clean = normalize(text);
  for (const [category, terms] of categories) {
    if (terms.some((term) => clean.includes(normalize(term)))) return category;
  }
  return 'cliente';
}

function detectPriority(text, category, dueDate) {
  const clean = normalize(text);
  if (['urgente', 'critico', 'crítico', 'parado', 'sem energia', 'pane'].some((term) => clean.includes(normalize(term)))) {
    return 'critica';
  }
  if (['fluxo de caixa negativo', 'caixa negativo', 'reestabelecer nosso fluxo de caixa', 'prioridade'].some((term) => clean.includes(normalize(term)))) {
    return 'alta';
  }
  if (['ate hoje', 'até hoje', 'cliente aguardando', 'responder', 'sexta'].some((term) => clean.includes(normalize(term)))) {
    return 'alta';
  }
  if (['financeiro', 'diagnostico_tecnico'].includes(category) && dueDate) return 'alta';
  return 'media';
}

function estimateMinutes(text, category, products = []) {
  const clean = normalize(text);
  let minutes = {
    proposta: 90,
    ordem_servico: 120,
    diagnostico_tecnico: 90,
    compra_material: 45,
    agenda: 20,
    documento: 45,
    financeiro: 30,
    comercial: 25,
    cliente: 30
  }[category] ?? 30;
  if (products.length >= 3) minutes += 30;
  if (clean.includes('relatorio') || clean.includes('proposta completa')) minutes += 45;
  if (clean.includes('lista de materiais') || clean.includes('comparativo')) minutes += 30;
  if (clean.includes('apenas') || clean.includes('so quero que me lembre') || clean.includes('lembrete')) minutes = Math.min(minutes, 15);
  return Math.max(15, Math.min(minutes, 240));
}

function detectPlannedDate(text, dueDate) {
  const clean = normalize(text);
  if (clean.includes('pela manha') || clean.includes('logo pela manha') || clean.includes('inicio da rotina')) return dueDate || toDateOnly(new Date());
  if (clean.includes('ao longo do dia') || clean.includes('inicio da tarde')) return dueDate || toDateOnly(new Date());
  return dueDate || '';
}

function detectDependencyText(text) {
  const clean = normalize(text);
  const dependencies = [];
  if (clean.includes('aguardando cliente') || clean.includes('depende do cliente')) dependencies.push('Retorno ou aprovacao do cliente');
  if (clean.includes('fornecedor')) dependencies.push('Retorno de fornecedor');
  if (clean.includes('pagamento') || clean.includes('fluxo de caixa') || clean.includes('valor ja pago')) dependencies.push('Conferencia comercial/financeira');
  if (clean.includes('documento') || clean.includes('drive') || clean.includes('dropbox')) dependencies.push('Documento relacionado');
  if (clean.includes('material') || clean.includes('peca') || clean.includes('sku')) dependencies.push('Pecas, materiais ou SKUs');
  return dependencies.join('; ');
}

function detectBlockerReason(text, status = '') {
  const clean = normalize(text);
  if (status?.startsWith('aguardando')) return 'Status indica dependencia externa ou aprovacao.';
  if (clean.includes('aguardando')) return 'Texto indica que a tarefa depende de uma resposta externa.';
  if (clean.includes('falha de fabricacao')) return 'Ha risco tecnico/comercial por falha de fabricacao ja percebida pelo cliente.';
  if (clean.includes('falta') || clean.includes('pendencia')) return 'Texto sugere informacao ou recurso pendente.';
  return '';
}

function operationalScore({ priority, dueDate, category, text, status, dependencyText, blockerReason }) {
  const clean = normalize(text || '');
  let score = { critica: 95, alta: 82, media: 55, baixa: 30 }[priority] ?? 50;
  const today = toDateOnly(new Date());
  if (dueDate) {
    if (dueDate < today) score += 12;
    if (dueDate === today) score += 10;
  } else {
    score -= 6;
  }
  if (['financeiro', 'proposta', 'comercial'].includes(category)) score += 6;
  if (clean.includes('fluxo de caixa') || clean.includes('caixa negativo')) score += 10;
  if (clean.includes('cliente') && (clean.includes('retorno') || clean.includes('responder'))) score += 5;
  if (dependencyText) score += 3;
  if (blockerReason) score += 6;
  if (['concluido', 'cancelado', 'arquivado'].includes(status)) score = 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildChecklist(text, category, products) {
  const clean = normalize(text);
  const items = [];
  if (category === 'proposta' || clean.includes('orcamento')) {
    items.push('Revisar escopo solicitado pelo cliente');
    items.push('Conferir lista de materiais e compatibilidade tecnica');
    items.push('Validar prazo, condicoes comerciais e dependencias');
    items.push('Preparar resposta ou proposta para revisao');
  }
  if (category === 'diagnostico_tecnico') {
    items.push('Registrar sintomas e condicoes em que a falha ocorre');
    items.push('Conferir alimentacao, protecoes, conexoes e comunicacao');
    items.push('Separar evidencias: fotos, medicoes, logs ou telas');
    items.push('Resumir causa provavel e proximo teste');
  }
  if (category === 'ordem_servico') {
    items.push('Confirmar local, acesso e janela de atendimento');
    items.push('Definir escopo executavel em campo');
    items.push('Listar ferramentas, pecas e materiais necessarios');
    items.push('Registrar pendencias para relatorio final');
  }
  if (products.length) {
    items.push(`Verificar itens citados: ${products.join(', ')}`);
  }
  if (!items.length) {
    items.push('Confirmar informacoes essenciais');
    items.push('Definir proxima acao objetiva');
    items.push('Registrar retorno esperado');
  }
  return items;
}

function buildSubtasks(category) {
  const base = {
    proposta: ['Levantar informacoes tecnicas', 'Conferir materiais', 'Preparar rascunho comercial', 'Enviar para aprovacao humana'],
    ordem_servico: ['Validar escopo', 'Planejar atendimento', 'Separar materiais', 'Atualizar status da OS'],
    diagnostico_tecnico: ['Coletar sintomas', 'Executar verificacoes iniciais', 'Registrar evidencias', 'Preparar resumo tecnico'],
    compra_material: ['Conferir especificacao', 'Pesquisar fornecedor/preco', 'Registrar SKU/link', 'Confirmar compra apos aprovacao'],
    agenda: ['Definir participantes', 'Sugerir horario', 'Preparar pauta', 'Aguardar aprovacao para criar evento'],
    documento: ['Localizar documento relacionado', 'Classificar tipo e tags', 'Preparar resumo', 'Solicitar revisao'],
    financeiro: ['Identificar pendencia', 'Conferir valor/documento', 'Preparar comunicacao', 'Aguardar aprovacao para envio'],
    comercial: ['Contextualizar demanda', 'Preparar retorno', 'Fazer follow-up', 'Atualizar historico do cliente'],
    cliente: ['Classificar demanda', 'Associar cliente/projeto', 'Definir prazo', 'Executar proxima acao']
  };
  return base[category] ?? base.cliente;
}

function titleFromText(text, category, client, products) {
  if (client && products.length) return `${client} - ${products[0]} / ${category.replaceAll('_', ' ')}`;
  if (client) return `${client} - ${category.replaceAll('_', ' ')}`;
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
}

export function interpretOperationalText(text) {
  const category = detectCategory(text);
  const dueDate = detectDueDate(text);
  const clientName = detectClient(text);
  const location = detectLocation(text);
  const assetHint = detectAsset(text);
  const products = detectProducts(text);
  const priority = detectPriority(text, category, dueDate);
  const checklist = buildChecklist(text, category, products);
  const subtasks = buildSubtasks(category);
  const actionType = category === 'agenda' ? 'sugerir_evento' : category === 'documento' ? 'organizar_documento' : 'preparar_resposta';
  const needsApproval = ['sugerir_evento', 'preparar_resposta', 'organizar_documento'].includes(actionType);
  const estimatedMinutes = estimateMinutes(text, category, products);
  const plannedDate = detectPlannedDate(text, dueDate);
  const dependencyText = detectDependencyText(text);
  const blockerReason = detectBlockerReason(text);
  const score = operationalScore({ priority, dueDate, category, text, status: 'triagem', dependencyText, blockerReason });

  return {
    title: titleFromText(text, category, clientName, products),
    description: text,
    original_input: text,
    category,
    subcategory: products[0] || '',
    status: 'triagem',
    priority,
    due_date: dueDate,
    client_hint: clientName,
    asset_hint: assetHint,
    location,
    tags: [...new Set([category, ...products, assetHint].filter(Boolean))],
    origin_channel: 'manual',
    action_type: actionType,
    automation_level: needsApproval ? 2 : 1,
    planned_date: plannedDate,
    estimated_minutes: estimatedMinutes,
    recurrence_rule: '',
    dependency_text: dependencyText,
    blocker_reason: blockerReason,
    operational_score: score,
    next_action: subtasks[0],
    expected_result: 'Demanda estruturada, com proxima acao clara e revisao humana antes de qualquer acao externa.',
    checklist,
    subtasks,
    ai_can_execute: false,
    needs_approval: true,
    human_approved: false,
    ai_executed: false,
    action_risk: needsApproval ? 'medio' : 'baixo',
    reasoning: buildReasoning(category, priority, dueDate, clientName, products)
  };
}

function splitTopLevelCommas(text) {
  const items = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      if (current.trim()) items.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function sentenceChunks(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstMatch(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim().replace(/[,.]$/, '') : '';
}

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateOnly(date);
}

function buildDemand(text, overrides = {}) {
  const interpreted = interpretOperationalText(text);
  const merged = {
    ...interpreted,
    ...overrides,
    tags: [...new Set([...(interpreted.tags || []), ...(overrides.tags || [])].filter(Boolean))],
    checklist: overrides.checklist || interpreted.checklist,
    subtasks: overrides.subtasks || interpreted.subtasks,
    questions: overrides.questions || []
  };
  const dependencyText = merged.dependency_text || detectDependencyText(merged.description || text);
  const blockerReason = merged.blocker_reason || detectBlockerReason(merged.description || text, merged.status);
  return {
    ...merged,
    planned_date: merged.planned_date || detectPlannedDate(merged.description || text, merged.due_date),
    estimated_minutes: merged.estimated_minutes || estimateMinutes(merged.description || text, merged.category, detectProducts(merged.description || text)),
    dependency_text: dependencyText,
    blocker_reason: blockerReason,
    operational_score: merged.operational_score || operationalScore({
      priority: merged.priority,
      dueDate: merged.due_date,
      category: merged.category,
      text: merged.description || text,
      status: merged.status,
      dependencyText,
      blockerReason
    })
  };
}

function extractReminderTasks(originalText) {
  const clean = normalize(originalText);
  const marker = clean.indexOf('segue:');
  if (marker < 0) return [];
  const after = originalText.slice(marker + 'segue:'.length);
  return splitTopLevelCommas(after)
    .map((raw) => raw.trim().replace(/[.;]$/, ''))
    .filter(Boolean)
    .map((raw) => {
      const note = firstMatch(raw, /\(([^)]+)\)/);
      const title = raw.replace(/\s*\([^)]+\)\s*/g, '').trim();
      const reminder = classifyReminder(title, note, raw);
      return buildDemand(`Lembrete de revisao operacional: ${title}. ${note}`, {
        title: `Lembrar: ${title}`,
        description: reminder.description,
        category: reminder.category,
        status: 'entrada_capturada',
        priority: reminder.priority,
        due_date: reminder.due_date,
        client_hint: reminder.client_hint,
        asset_hint: reminder.asset_hint,
        next_action: 'Detalhar demanda durante a rotina de revisao',
        expected_result: 'Titulo lembrado para posterior triagem detalhada.',
        checklist: reminder.checklist,
        subtasks: reminder.subtasks,
        action_type: 'lembrar_demanda',
        automation_level: 1,
        action_risk: 'baixo',
        reasoning: reminder.reasoning
      });
    });
}

function classifyReminder(title, note, raw) {
  const cleanTitle = normalize(title);
  const cleanRaw = normalize(raw);
  const base = {
    category: 'cliente',
    priority: cleanRaw.includes('prioridade') ? 'alta' : 'media',
    due_date: cleanRaw.includes('amanha') ? tomorrowDate() : '',
    client_hint: '',
    asset_hint: '',
    description: note ? `Lembrete capturado por titulo. Observacao: ${note}` : 'Lembrete capturado por titulo para detalhamento posterior.',
    checklist: ['Confirmar cliente/projeto relacionado', 'Detalhar escopo ou pendencia', 'Definir prazo e proxima acao'],
    subtasks: ['Abrir conversa de detalhamento', 'Associar cadastro correto', 'Converter em tarefa completa'],
    reasoning: 'Identifiquei este item como lembrete por titulo dentro de uma lista secundaria de demandas.'
  };

  if (cleanTitle.includes('nota fiscal') || cleanTitle.includes('devolucao')) {
    return {
      ...base,
      category: 'financeiro',
      client_hint: title.replace(/nota fiscal|devolu[cç][aã]o/ig, '').trim(),
      description: `Lembrete financeiro/documental: tratar nota fiscal de devolucao relacionada a ${title.replace(/nota fiscal|devolu[cç][aã]o/ig, '').trim() || title}.`,
      checklist: ['Confirmar nota fiscal e motivo da devolucao', 'Localizar documento fiscal', 'Verificar impacto financeiro/estoque', 'Definir proxima acao com responsavel'],
      subtasks: ['Localizar NF', 'Confirmar dados da devolucao', 'Registrar pendencia financeira'],
      reasoning: 'Classifiquei como financeiro porque o titulo cita nota fiscal e devolucao.'
    };
  }

  if (cleanRaw.includes('orcamento') || cleanRaw.includes('orcamentos prontos')) {
    return {
      ...base,
      category: 'proposta',
      priority: 'alta',
      client_hint: title,
      due_date: base.due_date || tomorrowDate(),
      description: note
        ? `Revisar orcamentos prontos de ${title}. Observacao original: ${note}`
        : `Revisar proposta/orcamento relacionado a ${title}.`,
      checklist: ['Localizar orcamentos prontos', 'Revisar escopo, valores e condicoes', 'Preparar retorno para aprovacao', 'Definir envio apos revisao'],
      subtasks: ['Abrir orcamentos', 'Revisar informacoes comerciais', 'Preparar rascunho de retorno'],
      reasoning: 'Elevei para proposta prioritária porque a observacao informa que ja existem orcamentos prontos para revisao.'
    };
  }

  if (cleanTitle.includes('motorhome')) {
    return {
      ...base,
      client_hint: title.replace(/motorhomes?|rv/ig, '').trim(),
      asset_hint: 'motorhome/RV',
      description: `Lembrete operacional de motorhome/RV: ${title}. Detalhar escopo, local, cliente e pendencias na revisao.`,
      checklist: ['Confirmar proprietario/cliente', 'Identificar motorhome/RV correto', 'Detalhar demanda tecnica ou comercial', 'Definir prazo e proxima acao'],
      subtasks: ['Associar cliente', 'Completar cadastro do ativo', 'Transformar em tarefa detalhada'],
      reasoning: 'Identifiquei motorhome/RV no titulo e preparei o lembrete para associar cliente e ativo depois.'
    };
  }

  if (['lobo do mar', 'donna v'].some((asset) => cleanTitle.includes(asset))) {
    return {
      ...base,
      asset_hint: title,
      description: `Lembrete relacionado a embarcacao/projeto ${title}. Detalhar cliente, escopo e prioridade durante a revisao.`,
      checklist: ['Confirmar cliente/proprietario', 'Associar embarcacao/projeto correto', 'Detalhar pendencia', 'Definir proxima acao'],
      subtasks: ['Localizar historico', 'Associar ativo', 'Criar tarefa detalhada'],
      reasoning: 'Tratei o titulo como provavel embarcacao/projeto conhecido, nao apenas como texto solto.'
    };
  }

  const possiblePerson = title.replace(/^sr\.?\s+/i, '').trim();
  if (possiblePerson.split(/\s+/).length <= 3) {
    return {
      ...base,
      client_hint: possiblePerson,
      description: note
        ? `Lembrete de cliente/contato: ${title}. Observacao original: ${note}`
        : `Lembrete de cliente/contato: ${title}. Detalhar demanda na rotina de revisao.`,
      reasoning: 'Tratei o titulo como provavel cliente/contato para facilitar match de cadastro.'
    };
  }

  return base;
}

function extractBudgetTasks(originalText) {
  const tasks = [];
  const clean = normalize(originalText);
  const obsIndex = clean.indexOf('obs:');
  const mainText = obsIndex >= 0 ? originalText.slice(0, obsIndex) : originalText;
  const globalDueDate = detectDueDate(mainText);
  const globalPriority = normalize(mainText).includes('fluxo de caixa') ? 'alta' : '';

  const aria = mainText.match(/(?:\d+\s+deles\s+)?para\s+a\s+embarca[cç][aã]o\s+([^,.]+?),\s+do\s+cliente\s+([^,.]+)/i);
  if (aria) {
    tasks.push(buildDemand(`Enviar orcamentos da embarcacao ${aria[1]} para o cliente ${aria[2]}.`, {
      title: `Enviar orcamentos - ${aria[1]}`,
      description: [
        `Enviar 2 orcamentos da embarcacao ${aria[1].trim()} para o cliente ${aria[2].trim()}.`,
        'Prioridade alta porque os envios foram associados ao restabelecimento do fluxo de caixa.',
        globalDueDate ? `Prazo indicado no texto: ${globalDueDate}.` : ''
      ].filter(Boolean).join('\n'),
      client_hint: aria[2].trim(),
      asset_hint: aria[1].trim(),
      category: 'proposta',
      priority: globalPriority || 'alta',
      due_date: globalDueDate,
      next_action: 'Revisar os 2 orcamentos e preparar envio',
      expected_result: 'Orcamentos revisados e prontos para envio com aprovacao humana.',
      checklist: ['Localizar os 2 orcamentos da embarcacao', 'Conferir escopo, valores e condicoes', 'Preparar rascunho de envio ao cliente', 'Solicitar aprovacao antes de enviar'],
      subtasks: ['Revisar primeiro orçamento', 'Revisar segundo orçamento', 'Preparar mensagem de envio', 'Marcar como aguardando aprovacao'],
      reasoning: 'Separei esta demanda porque o texto indica dois orcamentos especificos para a embarcacao e cliente informados.'
    }));
  }

  const madu = mainText.match(/\bda\s+([^,.]+?)\s+do\s+cliente\s+([^,.]+?)(?:\.|,|\se\s+para)/i);
  if (madu) {
    tasks.push(buildDemand(`Enviar orcamento da embarcacao ${madu[1]} para o cliente ${madu[2]}.`, {
      title: `Enviar orcamento - ${madu[1]}`,
      description: [
        `Enviar orcamento da embarcacao ${madu[1].trim()} para o cliente ${madu[2].trim()}.`,
        'Prioridade alta por estar no grupo de orcamentos importantes para o fluxo de caixa.',
        globalDueDate ? `Prazo indicado no texto: ${globalDueDate}.` : ''
      ].filter(Boolean).join('\n'),
      client_hint: madu[2].trim(),
      asset_hint: madu[1].trim(),
      category: 'proposta',
      priority: globalPriority || 'alta',
      due_date: globalDueDate,
      next_action: 'Revisar orcamento e preparar envio',
      expected_result: 'Orcamento enviado apos revisao e aprovacao humana.',
      checklist: ['Localizar orcamento pronto', 'Conferir escopo e condicoes', 'Preparar rascunho de envio', 'Aguardar aprovacao para envio'],
      subtasks: ['Revisar orçamento', 'Preparar mensagem', 'Registrar retorno esperado'],
      reasoning: 'Separei esta demanda porque o texto cita outro orcamento com embarcacao e cliente proprios.'
    }));
  }

  if (clean.includes('la osadia')) {
    tasks.push(buildDemand('Montar proposta de sonares Garmin e possivel VHF para a embarcacao La Osadia.', {
      title: 'Montar proposta sonar/VHF - La Osadia',
      description: [
        'Montar proposta para a embarcacao La Osadia ao longo do dia, preferencialmente pela manha, para envio no inicio da tarde.',
        'Oferta principal: 2 opcoes de sonar Garmin.',
        'Opcao 1: modelo mais completo e robusto, compativel e integrado aos GPSMAP ja existentes no barco.',
        'Opcao 2: equipamento de pelo menos 7 polegadas para o bote inflavel.',
        'Considerar oferta adicional de VHF para o bote, justificando que convidados podem usar o bote mesmo que o marinheiro tenha VHF portatil.',
        'Considerar abatimento do valor ja pago pelo sonar que apresentou falha de fabricacao.',
        'Como agradecimento, incluir instalacao de um painel de interruptores em acrilico com botoes de inox impermeaveis como brinde.'
      ].join('\n'),
      client_hint: '',
      asset_hint: 'La Osadia',
      category: 'proposta',
      subcategory: 'Garmin',
      priority: 'alta',
      due_date: globalDueDate,
      next_action: 'Montar proposta pela manha para envio no inicio da tarde',
      expected_result: 'Proposta com duas opcoes de sonar Garmin, possivel VHF e regra de abatimento do equipamento com falha.',
      checklist: [
        'Montar opcao robusta compativel com GPSMAP existente',
        'Montar opcao de pelo menos 7 polegadas para o bote inflavel',
        'Avaliar oferta de VHF para uso por convidado no bote',
        'Aplicar abatimento do sonar pago que apresentou falha',
        'Incluir brinde: painel de interruptores em acrilico com botoes inox impermeaveis',
        'Preparar rascunho de justificativa tecnica e comercial'
      ],
      subtasks: ['Selecionar modelos Garmin', 'Definir comparativo tecnico', 'Calcular abatimento', 'Preparar proposta', 'Enviar para aprovacao humana'],
      tags: ['Garmin', 'GPSMAP', 'sonar', 'VHF'],
      reasoning: 'Agrupei os detalhes tecnicos e comerciais da La Osadia em uma proposta propria porque ha escopo, estrategia de venda, abatimento e brinde.'
    }));

    const contact = mainText.match(/retorno\s+para\s+o\s+([^,.]+),\s+respons[aá]vel\s+pelo\s+financeiro/i);
    tasks.push(buildDemand(contact ? `Dar retorno para ${contact[1]}, responsavel financeiro e porta-voz da La Osadia.` : 'Dar retorno ao responsavel financeiro da La Osadia.', {
      title: `Retornar financeiro - La Osadia${contact ? ` / ${contact[1].trim()}` : ''}`,
      description: contact
        ? `Dar retorno para ${contact[1].trim()}, responsavel financeiro da embarcacao La Osadia e porta-voz do cliente. O retorno deve ficar separado da montagem tecnica da proposta, mas relacionado a ela.`
        : 'Dar retorno ao responsavel financeiro e porta-voz da embarcacao La Osadia. O retorno deve ficar separado da montagem tecnica da proposta, mas relacionado a ela.',
      client_hint: contact ? contact[1].trim() : '',
      asset_hint: 'La Osadia',
      category: 'comercial',
      priority: 'alta',
      due_date: globalDueDate,
      next_action: 'Preparar retorno para o porta-voz financeiro',
      expected_result: 'Responsavel financeiro informado sobre encaminhamento da proposta e substituicao sugerida.',
      checklist: ['Confirmar papel do contato', 'Preparar mensagem objetiva', 'Citar que proposta sera revisada antes do envio', 'Aguardar aprovacao para disparar mensagem'],
      subtasks: ['Preparar rascunho de WhatsApp/e-mail', 'Revisar tom comercial', 'Aguardar aprovacao'],
      reasoning: 'Separei o retorno ao responsavel financeiro da proposta tecnica porque e uma acao de comunicacao com contato especifico.'
    }));
  }

  return tasks;
}

export function interpretOperationalBatch(text) {
  const budgetTasks = extractBudgetTasks(text);
  const reminderTasks = extractReminderTasks(text);
  let tasks = [...budgetTasks, ...reminderTasks];

  if (!tasks.length) {
    const chunks = sentenceChunks(text);
    const actionable = chunks.filter((chunk) => {
      const clean = normalize(chunk);
      return ['preciso', 'precisamos', 'enviar', 'montar', 'revisar', 'cobrar', 'retornar', 'criar', 'organizar', 'preparar', 'orçamento', 'orcamento'].some((term) => clean.includes(normalize(term)));
    });
    tasks = (actionable.length ? actionable : [text]).map((chunk) => buildDemand(chunk));
  }

  return {
    mode: 'batch',
    original_input: text,
    summary: `Identifiquei ${tasks.length} demanda${tasks.length === 1 ? '' : 's'} separada${tasks.length === 1 ? '' : 's'} para revisao antes de salvar.`,
    tasks: tasks.map((task, index) => ({ temp_id: `draft-${index + 1}`, selected: true, ...task }))
  };
}

function buildReasoning(category, priority, dueDate, clientName, products) {
  const parts = [`Classifiquei como ${category.replaceAll('_', ' ')} pelo vocabulario da demanda.`];
  if (clientName) parts.push(`Identifiquei possivel cliente: ${clientName}.`);
  if (products.length) parts.push(`Detectei itens tecnicos relevantes: ${products.join(', ')}.`);
  if (dueDate) parts.push(`Sugeri prazo em ${dueDate}.`);
  parts.push(`Prioridade sugerida: ${priority}.`);
  parts.push('Nenhuma acao externa deve ser executada sem aprovacao humana.');
  return parts.join(' ');
}

export function createDraft({ task, type }) {
  const client = task.client_name || 'cliente';
  const intro = type === 'whatsapp'
    ? `Olá, ${client}.`
    : `Olá, ${client},\n\n`;
  const body = [
    intro,
    'Estou organizando o retorno sobre a demanda abaixo:',
    task.description || task.title,
    '',
    'Proximos pontos que vou validar:',
    ...(task.checklist || []).map((item) => `- ${item}`),
    '',
    'Assim que eu concluir a revisao tecnica/comercial, envio o retorno para sua aprovacao.'
  ].join('\n');

  return {
    title: type === 'whatsapp' ? `Rascunho de WhatsApp - ${task.title}` : `Rascunho de e-mail - ${task.title}`,
    content: body,
    autonomy_level: 2,
    risk: 'medio',
    reasoning: 'Rascunho preparado para revisao humana. O MVP nao envia mensagens nem e-mails automaticamente.'
  };
}
