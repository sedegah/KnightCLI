from __future__ import annotations

from functools import lru_cache
from typing import Dict, Any, Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config.settings import settings


def _build_connect_args() -> Dict[str, Any]:
    connect_args: Dict[str, Any] = {
        "connect_timeout": settings.DB_CONNECT_TIMEOUT,
    }

    if settings.DB_TCP_KEEPALIVES:
        connect_args.update(
            {
                "keepalives": 1,
                "keepalives_idle": settings.DB_KEEPALIVES_IDLE,
                "keepalives_interval": settings.DB_KEEPALIVES_INTERVAL,
                "keepalives_count": settings.DB_KEEPALIVES_COUNT,
            }
        )

    return connect_args


@lru_cache(maxsize=1)
def get_engine():
    if not settings.DATABASE_URL:
        raise ValueError("DATABASE_URL is required for PostgreSQL usage")

    return create_engine(
        settings.DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
        pool_pre_ping=settings.DB_POOL_PRE_PING,
        connect_args=_build_connect_args(),
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())


def get_session():
    return SessionLocal()


@contextmanager
def session_scope() -> Iterator:
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
