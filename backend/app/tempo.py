"""Fuso horário e calendário.

Instantes são sempre armazenados em UTC (timestamptz). Datas e horários de
negócio (data da aula, hora da aula) são interpretados em America/Sao_Paulo.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")

# Permite "congelar" o relógio em testes.
_agora_override: datetime | None = None


def agora() -> datetime:
    """Instante atual em UTC (aware)."""
    if _agora_override is not None:
        return _agora_override
    return datetime.now(timezone.utc)


def set_agora(valor: datetime | None) -> None:
    global _agora_override
    _agora_override = valor


def hoje() -> date:
    return agora().astimezone(TZ).date()


def local(dt: datetime) -> datetime:
    return dt.astimezone(TZ)


def combinar(d: date, t: time) -> datetime:
    """Data + hora locais (São Paulo) -> instante aware."""
    return datetime.combine(d, t, tzinfo=TZ)


def fmt_data(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def fmt_hora(t: time) -> str:
    return t.strftime("%H:%M")


def fmt_datahora(dt: datetime) -> str:
    return local(dt).strftime("%d/%m/%Y %H:%M")


def dias_letivos(inicio: date, fim: date) -> list[date]:
    """Dias de segunda a sexta no intervalo; se não houver nenhum (ex.: um
    sábado letivo isolado), todos os dias do intervalo contam."""
    dias = [inicio + timedelta(days=i) for i in range((fim - inicio).days + 1)]
    uteis = [d for d in dias if d.weekday() < 5]
    return uteis or dias


def horas_entre(inicio: time, fim: time) -> float:
    a = inicio.hour * 60 + inicio.minute
    b = fim.hour * 60 + fim.minute
    return max(0, b - a) / 60
