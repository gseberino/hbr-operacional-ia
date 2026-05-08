# HBR Operacional IA

MVP local de uma central operacional inteligente para HBR Systems / HBR Marine.

## Como rodar

```powershell
npm.cmd start
```

Depois acesse `http://localhost:4173`.

Na primeira abertura o sistema mostra uma tela de configuracao para criar o primeiro usuario. O banco SQLite fica em `data/hbr-operacional.sqlite`.

## GitHub

O repositorio deve versionar codigo, assets e scripts, mas nao deve versionar o banco local em `data/`, sessoes, arquivos `.env` ou logs.

Fluxo recomendado:

```powershell
git status
git add .
git commit -m "Descreva a atualizacao"
git push
```

Ou use o script do projeto:

```powershell
npm.cmd run sync -- -Message "Minha atualizacao"
```

Se ainda nao houver remoto:

```powershell
git remote add origin URL_DO_REPOSITORIO
git branch -M main
git push -u origin main
```

Tambem e possivel conectar o remoto pelo script:

```powershell
npm.cmd run sync -- -RemoteUrl https://github.com/USUARIO/REPOSITORIO.git -Message "Conectar GitHub"
```

## O que esta implementado

- Login por sessao com senha hash PBKDF2.
- Banco SQLite persistente.
- Dashboard operacional.
- CRUD de clientes, embarcacoes/motorhomes, projetos/OS, documentos e tarefas.
- Caixa de entrada inteligente por texto livre.
- Interpretador local de contexto nautico/tecnico/comercial.
- Subtarefas, checklist, prioridade, prazo, status, tags e historico.
- Tela do agente IA com rascunhos e aprovacoes.
- Registro de acoes da IA.
- Central de Planejamento com views salvas, filtros, agenda semanal e kanban.
- Comentarios internos, dependencias reais, templates HBR editaveis, campos customizados e automacoes internas com logs.

## Limites intencionais do MVP

- Gmail, Calendar, Drive, Dropbox e WhatsApp ainda nao executam acoes reais.
- A IA do MVP usa regras locais de triagem. A arquitetura separa essa camada para plugar um provedor externo depois.
- Acoes externas ficam bloqueadas por design ate aprovacao explicita.
