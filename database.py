import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv(override=False)


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if DATABASE_URL:
    engine = create_engine(DATABASE_URL)

else:
    DB_HOST = os.getenv("DB_HOST", "localhost").strip()
    DB_PORT = int(os.getenv("DB_PORT", "5432"))
    DB_NAME = os.getenv("DB_NAME", "resume_screening").strip()
    DB_USER = os.getenv("DB_USER", "postgres").strip()
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")

    if not DB_PASSWORD:
        raise RuntimeError(
            "Database configuration is incomplete. "
            "Set DATABASE_URL or DB_PASSWORD."
        )

    from sqlalchemy.engine import URL

    database_url = URL.create(
        drivername="postgresql+psycopg2",
        username=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
    )

    engine = create_engine(database_url)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()