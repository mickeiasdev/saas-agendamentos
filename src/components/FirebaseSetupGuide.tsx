export default function FirebaseSetupGuide() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="card">
        <h1 className="text-2xl font-bold text-slate-900">Firebase não configurado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta aplicação precisa das credenciais do seu projeto Firebase para funcionar.
          O código está pronto e real — basta conectar as credenciais seguindo os passos abaixo.
        </p>
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-slate-700">
          <li>
            Crie um projeto em{" "}
            <a
              href="https://console.firebase.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 underline"
            >
              console.firebase.google.com
            </a>{" "}
            (plano Spark é gratuito).
          </li>
          <li>Em Configurações do projeto → Seus apps → Web, registre um app e copie a configuração.</li>
          <li>Copie o arquivo <code className="rounded bg-slate-100 px-1">.env.example</code> para <code className="rounded bg-slate-100 px-1">.env.local</code> e preencha as variáveis <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_FIREBASE_*</code>.</li>
          <li>Ative Authentication (E-mail/Senha e Google) e Cloud Firestore no console. Cloud Storage não é necessário — fotos são comprimidas e salvas no Firestore.</li>
          <li>Aplique as regras de segurança em <code className="rounded bg-slate-100 px-1">firestore.rules</code>.</li>
        </ol>
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Nenhuma credencial real está (nem deve estar) neste repositório. As variáveis são
          injetadas via ambiente em tempo de execução.
        </p>
      </div>
    </div>
  );
}
