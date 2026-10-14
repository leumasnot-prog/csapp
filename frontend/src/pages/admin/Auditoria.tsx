import { useState } from "react";
import { api } from "../../api";
import { Carregando, Erro, fmtDataHora, useCarregar } from "../../ui";

interface Registro {
  id: number;
  ocorrido_em: string;
  ator_tipo: string;
  ator_id: number | null;
  acao: string;
  entidade: string;
  entidade_id: number | null;
  escola_id: number | null;
  dados: Record<string, unknown>;
  ip: string | null;
  hash: string;
}

export default function Auditoria() {
  const [acao, setAcao] = useState("");
  const { dados, erro } = useCarregar(
    () => api<Registro[]>(`/api/admin/auditoria?limite=200${acao ? `&acao=${encodeURIComponent(acao)}` : ""}`),
    [acao],
  );
  const [verif, setVerif] = useState<{ ok: boolean; total: number; primeiro_erro_id: number | null } | null>(null);

  return (
    <>
      <h1>Auditoria</h1>
      <div className="cartao">
        <p className="pequeno muted">
          O log é somente-inserção (o banco bloqueia alteração e exclusão) e cada registro carrega o hash do anterior. A verificação
          recalcula toda a cadeia.
        </p>
        <button className="secundario" onClick={async () => setVerif(await api("/api/admin/auditoria/verificar"))}>Verificar integridade</button>
        {verif && (
          <div className={`alerta ${verif.ok ? "ok" : "erro"}`} style={{ marginTop: "1rem" }}>
            {verif.ok
              ? `✅ Cadeia íntegra: ${verif.total} registros verificados.`
              : `⛔ Cadeia quebrada no registro #${verif.primeiro_erro_id} (após ${verif.total} registros íntegros).`}
          </div>
        )}
      </div>
      <div className="campo" style={{ maxWidth: 300 }}>
        <input placeholder="Filtrar por ação (ex.: VAGA_PREENCHIDA)" value={acao} onChange={(e) => setAcao(e.target.value.toUpperCase())} />
      </div>
      <Erro msg={erro} />
      {!dados ? <Carregando /> : (
        <div className="cartao tabela">
          <table>
            <thead><tr><th>#</th><th>Quando</th><th>Ação</th><th>Quem</th><th className="esconder-mobile">Detalhes</th></tr></thead>
            <tbody>
              {dados.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{fmtDataHora(r.ocorrido_em)}</td>
                  <td>{r.acao}<div className="muted pequeno">{r.entidade} {r.entidade_id ?? ""}</div></td>
                  <td className="pequeno">{r.ator_tipo}{r.ator_id ? ` #${r.ator_id}` : ""}{r.ip && <div className="muted">{r.ip}</div>}</td>
                  <td className="esconder-mobile pequeno"><code style={{ wordBreak: "break-all" }}>{JSON.stringify(r.dados).slice(0, 220)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
