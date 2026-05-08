import { interpretOperationalBatch } from '../src/ai/interpreter.js';

const sample = `temos alguns orçamentos que precisam ser enviados dia 08/05 logo pela manhã. estes são importantes pois dependemos disso para reestabelecer nosso fluxo de caixa que esta negativo. os orçamentos são, 2 deles para a embarcação Aria, do cliente Marcelo Marco Bertoldi. da Madu do cliente Junior Rudec. e para a embarcação La Osadia, o orçamento precisa ser montado ao longo do dia, de preferencia, pela manhã para ser enviado no inicio da tarde. Ainda para La Osadia, precisamos dar retorno para o Amarildo, responsavel pelo financeiro da embarcação e porta-voz do cliente. o orçamento se trata da oferta de 2 sonares garmin, 1 mais completo e robusto com conexão entre os outros da linha GPSMAP que ja existem no barco, e o outro, para o bote inflavel que cliente citou importancia em ter um equipamento de pelo menos 7". devemos considerar ofertar também um vhf pro cliente, que em determinadas situações pode ocorrer de um convidado utilizar o bote, mesmo que o marinheiro possua um vhf portatil. isso quebra a objeção do marinheiro ja possuir o vhf portatil. ao conversar com o cliente sobre o problema do sonar pago por ele, este apresentou problema de fabricação e para não comprometer a necessidade do cliente em ter um sonar a bordo, iremos propor a substituição por o modelo mais completo e compativel com os outros GPSMAP que ja citei aqui, nossa melhor solução a ser apresentada, sera, descontar o valor já pago por este que apresentou falha, e abater destes 2 modelos novos. e como forma de agradecimento, iremos instalar como brinde, um painel de interruptores em acrilico com botoes de inox impermeaveis. OBS: estas são as principais prioridades. mas existem outras diversas demandas, que, ao iniciar a rotina de revisão das tarefas, irei repassar alguams delas, no momento, só quero que me lembre delas por titulo, segue: Marcelo MP Motorhomes, Lobo do Mar, Maicon Paraguai, Donna V, Nota fiscal devolução Kamell, Sr Roberto, Andre Peruca, Célio Dondoka (Esqueci que este também é prioridade, ja tem orçamentos prontos, amanha revisamos e te passo.), Cristiano, Helcio Motorhome, Sandro Motorhome.`;

const result = interpretOperationalBatch(sample);

console.log(JSON.stringify({
  summary: result.summary,
  task_count: result.tasks.length,
  tasks: result.tasks.map((task) => ({
    title: task.title,
    category: task.category,
    priority: task.priority,
    due_date: task.due_date,
    client_hint: task.client_hint,
    asset_hint: task.asset_hint,
    description: task.description,
    checklist: task.checklist,
    subtasks: task.subtasks,
    reasoning: task.reasoning
  }))
}, null, 2));
