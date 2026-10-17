import { signOut } from "@/auth";

// O cookie (JWT) ainda é válido para o middleware, que não consulta o banco (sem isso, cairia
// num loop: a página redireciona para /login, e /login, vendo o cookie "logado", manda de volta).
// Essa rota limpa o cookie de verdade antes de ir para /login.
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
