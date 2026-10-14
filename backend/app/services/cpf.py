import re
import unicodedata


def somente_digitos(valor: str | None) -> str:
    return re.sub(r"\D", "", valor or "")


def cpf_valido(valor: str | None) -> bool:
    cpf = somente_digitos(valor)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for n in (9, 10):
        soma = sum(int(cpf[i]) * (n + 1 - i) for i in range(n))
        dv = (soma * 10) % 11 % 10
        if dv != int(cpf[n]):
            return False
    return True


def mascarar_cpf(cpf: str) -> str:
    """***.456.789-** — exibição minimizada (LGPD)."""
    c = somente_digitos(cpf)
    if len(c) != 11:
        return "***"
    return f"***.{c[3:6]}.{c[6:9]}-**"


def chave(texto: str) -> str:
    """Normaliza para comparação: sem acento, minúsculo, espaços simples."""
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", sem_acento).strip().lower()
