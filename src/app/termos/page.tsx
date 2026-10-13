import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Termos de Uso" };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contato@fechouclima.com.br";

export default function TermosPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-5 px-4 py-6 text-sm leading-relaxed">
      <Link href="/login" className="inline-flex min-h-11 items-center text-muted-foreground">
        ← Voltar
      </Link>
      <h1 className="text-xl font-semibold">Termos de Uso</h1>
      <p className="text-muted-foreground">Última atualização: outubro de 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. O serviço</h2>
        <p>
          O FechouClima permite criar orçamentos, enviá-los por link (por exemplo, pelo WhatsApp) e acompanhar a resposta do cliente.
          O serviço é oferecido como está, sem garantia de disponibilidade ininterrupta.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. Sua conta</h2>
        <p>
          Você é responsável pelas informações da conta, por manter a senha em segredo e por tudo que é feito com ela. Informe dados
          verdadeiros e use o serviço apenas para fins lícitos.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. Seus orçamentos e seus clientes</h2>
        <p>
          O conteúdo dos orçamentos, os preços e a relação com seus clientes são de sua responsabilidade. O FechouClima não é parte dos
          contratos entre você e seus clientes. Você declara ter o direito de cadastrar os dados dos seus clientes e de contatá-los pelos
          canais usados, respeitando a legislação de proteção de dados e de defesa do consumidor.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. Uso proibido</h2>
        <p>
          É proibido tentar acessar contas de terceiros, sobrecarregar ou burlar limites do serviço, enviar spam ou conteúdo ilegal, ou
          usar o serviço de forma que prejudique outras pessoas.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">5. Encerramento</h2>
        <p>
          Você pode excluir sua conta a qualquer momento em Ajustes. Podemos suspender contas que violem estes termos. Ao excluir a conta,
          seus dados são apagados conforme a Política de Privacidade.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">6. Limitação de responsabilidade</h2>
        <p>
          Na medida permitida pela lei, o FechouClima não responde por lucros cessantes, perda de negócios ou danos indiretos decorrentes
          do uso ou da indisponibilidade do serviço. Mantenha cópia dos orçamentos importantes (você pode baixar seus dados em Ajustes).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">7. Mudanças e contato</h2>
        <p>
          Podemos atualizar estes termos; mudanças relevantes serão avisadas no aplicativo ou por e-mail. Contato:{" "}
          <a href={`mailto:${CONTACT}`} className="underline">
            {CONTACT}
          </a>
          . Foro: comarca do domicílio do consumidor, quando aplicável.
        </p>
      </section>
    </main>
  );
}
