import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Política de Privacidade" };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contato@fechouclima.com.br";

export default function PrivacidadePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-5 px-4 py-6 text-sm leading-relaxed">
      <Link href="/login" className="inline-flex min-h-11 items-center text-muted-foreground">
        ← Voltar
      </Link>
      <h1 className="text-xl font-semibold">Política de Privacidade</h1>
      <p className="text-muted-foreground">Última atualização: outubro de 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. Quem somos</h2>
        <p>
          O FechouClima (fechouclima.com.br) é um serviço que ajuda técnicos de climatização e refrigeração a criar e enviar orçamentos.
          Para os dados da sua conta, o FechouClima é o controlador. Para os dados dos seus clientes que você cadastra, você (técnico) é o
          controlador e o FechouClima atua como operador, tratando os dados apenas para prestar o serviço.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. Dados que tratamos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Do técnico: nome, e-mail, senha (guardada apenas em forma de hash), logo e nome da empresa, preferências e data do aceite dos termos.</li>
          <li>Dos clientes do técnico: nome, telefone, endereço (opcional), serviços orçados, valores e resposta ao orçamento (aprovação ou recusa e o motivo, se informado).</li>
          <li>Técnicos: assinatura de notificações do navegador, se você ativar os avisos.</li>
          <li>Registros técnicos de segurança, como o endereço IP, usados apenas para limitar tentativas abusivas de acesso.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. Para que usamos</h2>
        <p>
          Executar o serviço contratado (criar, enviar e acompanhar orçamentos), avisar você sobre respostas dos clientes, enviar o resumo
          semanal (que pode ser desativado a qualquer momento), proteger a conta e cumprir obrigações legais. Não vendemos dados e não
          usamos dados de clientes para publicidade.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. O que o cliente final vê</h2>
        <p>
          O link público do orçamento mostra o nome do cliente, os itens, os valores, a validade e a identificação do técnico. Ele não mostra
          o telefone nem o endereço do cliente. Quem tem o link consegue ver o orçamento, então envie-o apenas ao cliente.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">5. Com quem compartilhamos</h2>
        <p>
          Usamos fornecedores para operar o serviço: hospedagem do aplicativo (Vercel), banco de dados (Neon) e envio de e-mails (Resend).
          Eles tratam os dados apenas para nos prestar o serviço. Os dados podem ser processados fora do Brasil, com salvaguardas
          contratuais desses fornecedores.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">6. Por quanto tempo guardamos</h2>
        <p>
          Enquanto sua conta existir. Ao excluir a conta, apagamos definitivamente seus dados e os dados dos seus clientes, incluindo
          orçamentos e links públicos. Cópias de segurança dos fornecedores podem levar algum tempo para expirar.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">7. Seus direitos</h2>
        <p>
          Você pode acessar, corrigir, baixar e excluir seus dados diretamente em Ajustes, no aplicativo (&quot;Baixar meus dados&quot; e
          &quot;Excluir minha conta&quot;). Também pode pedir qualquer direito previsto na LGPD (Lei 13.709/2018) pelo e-mail abaixo. Se você é
          cliente de um técnico e quer exercer seus direitos sobre dados que ele cadastrou, fale com o técnico; se preferir, escreva para nós
          e encaminhamos.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">8. Contato</h2>
        <p>
          Dúvidas e pedidos sobre privacidade:{" "}
          <a href={`mailto:${CONTACT}`} className="underline">
            {CONTACT}
          </a>
          .
        </p>
      </section>
    </main>
  );
}
