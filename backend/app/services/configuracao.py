from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..models import Configuracao


def obter(s: Session) -> Configuracao:
    cfg = s.get(Configuracao, 1)
    if cfg is None:
        s.execute(insert(Configuracao).values(id=1).on_conflict_do_nothing())
        cfg = s.get(Configuracao, 1)
    return cfg
