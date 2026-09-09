"""Populate standard-variable embeddings in MINT PostgreSQL.

Run from the service directory after the pgvector migration and installing the
optional CPU-only dependencies:
  python -m pip install -r requirements-semantic.txt
  python scripts/index_svo_embeddings.py
"""
import os
import psycopg
from sentence_transformers import SentenceTransformer

MODEL = os.getenv("SVO_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
DATABASE_URL = os.getenv(
    "SVO_DATABASE_URL",
    "postgresql://mint:mint@localhost:5432/mint",
)


def main() -> None:
    model = SentenceTransformer(MODEL)
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            "SELECT id, label, description FROM modelcatalog_standard_variable"
        ).fetchall()
        texts = [f"{label or ''}. {description or ''}" for _, label, description in rows]
        vectors = model.encode(texts, normalize_embeddings=True)
        for (variable_id, label, description), vector, text in zip(rows, vectors, texts):
            conn.execute(
                "UPDATE modelcatalog_standard_variable SET semantic_text = %s, embedding = %s WHERE id = %s",
                (text, vector.tolist(), variable_id),
            )
        conn.commit()
    print(f"Indexed {len(rows)} standard variables with {MODEL}")


if __name__ == "__main__":
    main()
