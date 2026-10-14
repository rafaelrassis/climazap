# Roteiro de teste com os primeiros técnicos

Objetivo: descobrir em 2 semanas, com 5 a 10 técnicos reais, se o FechouClima vira hábito. Não é um teste de funcionalidades: é para ver **uso de verdade**.

## Antes de começar (você)
- [ ] App no ar em `https://fechouclima.com.br` (`DEPLOY.md`), `/api/health` respondendo `{"ok":true}`.
- [ ] Resend com domínio verificado, `ERROR_ALERT_EMAIL` apontando para o seu e-mail, chaves VAPID configuradas.
- [ ] Um Pix real de R$ 0,01 testado de ponta a ponta (cadastro da chave, QR, pagamento).
- [ ] Textos de `/privacidade` e `/termos` revisados por um advogado; e-mail de contato confirmado.
- [ ] Você mesmo fez 3 orçamentos reais pelo celular (um iPhone e um Android, se possível).
- [ ] Combinou com cada técnico: é um teste, pode haver falhas, e você fala com ele por WhatsApp.

## Quem convidar
Técnicos que fazem orçamento toda semana e hoje mandam por WhatsApp (mensagem, foto de caderno, PDF improvisado). Misture: 2 mais jovens, 2 mais velhos (menos hábito de app), 1 com equipe pequena. Evite amigos que só querem ajudar: o que vale é quem tem a dor.

## Primeira conversa (10 minutos, por ligação ou vídeo)
1. "Como você faz orçamento hoje? Quanto tempo leva? Quantos por semana?"
2. "O que acontece depois que manda? Como sabe que o cliente viu e aprovou?"
3. Peça que ele crie a conta **sozinho**, no celular dele, enquanto você só observa e **não ajuda**. Anote onde trava.
4. Peça um orçamento de verdade (não de mentira) para um cliente atual.

## Missões da semana 1 (mande por WhatsApp)
| Dia | Missão | O que observar |
|---|---|---|
| 1 | Criar conta, cadastrar logo e escolher a cor, ajustar o preço de 3 serviços | Entendeu `Serviços` e `Ajustes`? Achou o que procurava? |
| 1-2 | Criar e enviar 1 orçamento real pelo app | Tempo até enviar (meta: abaixo de 60 s); onde errou |
| 2-3 | Ver se o cliente abriu e aprovou; testar "Cobrar resposta" | Notificação chegou? Entendeu o status? |
| 3-5 | Aprovar um orçamento e conferir Pix, PDF e lembrete de manutenção | Cliente conseguiu pagar com o QR? |
| 5-7 | Usar para todos os orçamentos da semana | Voltou ao método antigo? Por quê? |

## Semana 2
Sem missões. Deixe usar e **não lembre**. O número que importa: quantos orçamentos cada técnico criou sozinho.

## O que medir
- Cadastro concluído sem ajuda (sim ou não, e onde travou).
- Tempo para o 1º orçamento enviado.
- Orçamentos criados por semana, por técnico.
- Enviados que foram abertos, aprovados, recusados, sem resposta.
- Quem voltou na semana 2 sem você pedir.
- Erros que chegaram no seu e-mail de alerta.

Consultas úteis no banco (somente leitura):
```sql
-- orçamentos por técnico e status
select u.email, q.status, count(*) from "Quote" q join "User" u on u.id = q."userId" group by 1, 2 order by 1, 2;
-- tempo entre cadastro e primeiro orçamento
select u.email, min(q."createdAt") - u."createdAt" as ate_o_primeiro from "User" u left join "Quote" q on q."userId" = u.id group by u.id;
```

## Perguntas finais (por ligação, 15 minutos)
1. "Se o app sumisse amanhã, o que você sentiria falta?" (a resposta vale mais que qualquer nota)
2. "Qual foi a parte mais chata ou confusa?"
3. "O que você ainda faz fora do app?"
4. "Você indicaria para um colega? Por quê, ou por que não?"
5. "Pagaria por isso? Quanto por mês faria sentido?" (teste de preço: R$ 29, R$ 49, R$ 79)

## Como decidir o próximo passo
- **Voltaram sozinhos e criaram vários orçamentos:** o produto funciona. Próximo: plano pago e indicação.
- **Cadastraram e sumiram:** o problema é o primeiro uso. Reveja onboarding antes de qualquer recurso novo.
- **Usaram mas voltaram ao WhatsApp puro:** descubra o que o WhatsApp faz mais rápido e traga para o app.
- **Ninguém abriu o link do cliente:** o problema é a mensagem enviada. Teste outros textos em `Ajustes`.

Anote tudo (mesmo as reclamações pequenas) em uma planilha: técnico, data, o que aconteceu, gravidade. Padrões que se repetem em 3 técnicos viram prioridade.
