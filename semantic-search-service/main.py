import asyncio
import logging
import os
from collections import defaultdict
from functools import lru_cache

import psycopg
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer

app = FastAPI(title="MINT Semantic Search")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["GET"], allow_headers=["*"])
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://mint:mint@postgres:5432/mint")
MODEL_NAME = os.getenv("SVO_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
EMBEDDING_REFRESH_SECONDS = max(float(os.getenv("SVO_EMBEDDING_REFRESH_SECONDS", "60")), 5.0)
log = logging.getLogger(__name__)
refresh_task: asyncio.Task | None = None
refresh_event: asyncio.Event | None = None


@lru_cache(maxsize=1)
def model():
    return SentenceTransformer(MODEL_NAME)


CATALOG_VARIABLE_CONTEXT_SQL = """
    SELECT sv.id,
           sv.label,
           sv.description,
           COALESCE(context.model_context, '') AS model_context,
           sv.semantic_text,
           sv.embedding IS NOT NULL AS has_embedding
    FROM modelcatalog_standard_variable sv
    LEFT JOIN LATERAL (
      SELECT string_agg(
               DISTINCT concat_ws(' ',
                 c.label,
                 c.description,
                 c.keywords,
                 c.usage_notes,
                 s.label,
                 s.description,
                 s.keywords,
                 v.label,
                 v.description,
                 v.keywords,
                 v.short_description,
                 v.theoretical_basis
               ),
               ' '
             ) AS model_context
      FROM (
        SELECT configuration_id, input_id AS dataset_specification_id, 'input' AS role
        FROM modelcatalog_configuration_input
        UNION ALL
        SELECT configuration_id, output_id AS dataset_specification_id, 'output' AS role
        FROM modelcatalog_configuration_output
      ) links
      JOIN modelcatalog_configuration c ON c.id = links.configuration_id
      LEFT JOIN modelcatalog_software_version v ON v.id = c.software_version_id
      LEFT JOIN modelcatalog_software s ON s.id = v.software_id
      JOIN modelcatalog_dataset_specification_presentation dsp
        ON dsp.dataset_specification_id = links.dataset_specification_id
      JOIN modelcatalog_variable_presentation vp ON vp.id = dsp.presentation_id
      WHERE vp.has_standard_variable = sv.id
    ) context ON TRUE
"""


def catalog_variable_rows(conn):
    return conn.execute(CATALOG_VARIABLE_CONTEXT_SQL).fetchall()


def embedding_text(label, description, model_context):
    return f"{label or ''}. {description or ''}. Models and workflows: {model_context or ''}"


def index_catalog_embeddings(force: bool = False) -> int:
    """Index new/changed catalog context and return the number of vectors written."""
    with psycopg.connect(DATABASE_URL) as conn:
        rows = catalog_variable_rows(conn)
        if not rows:
            return 0

        pending = [
            (row, embedding_text(row[1], row[2], row[3]))
            for row in rows
            if force or row[4] != embedding_text(row[1], row[2], row[3]) or not row[5]
        ]
        if not pending:
            return 0

        vectors = model().encode([text for _, text in pending], normalize_embeddings=True)
        for (row, text), vector in zip(pending, vectors):
            variable_id = row[0]
            literal = "[" + ",".join(str(value) for value in vector.tolist()) + "]"
            conn.execute(
                "UPDATE modelcatalog_standard_variable SET semantic_text = %s, embedding = %s::vector WHERE id = %s",
                (text, literal, variable_id),
            )
        conn.commit()
        return len(pending)


async def refresh_embeddings_loop():
    while True:
        assert refresh_event is not None
        try:
            # Hasura event triggers wake this immediately after catalog writes.
            # The timeout is a safety net for imports or writes that bypass Hasura.
            await asyncio.wait_for(refresh_event.wait(), timeout=EMBEDDING_REFRESH_SECONDS)
            refresh_event.clear()
        except asyncio.TimeoutError:
            pass
        try:
            refreshed = await asyncio.to_thread(index_catalog_embeddings)
            if refreshed:
                log.info("refreshed %d changed standard-variable embeddings", refreshed)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("semantic embedding refresh failed; will retry")


@app.on_event("startup")
def start_embedding_indexer():
    # Preserve the initial full build, then respond to Hasura catalog events
    # without re-encoding rows whose SVO/model context has not changed.
    #
    # The first build must not stop the service. On a first install the catalog
    # tables do not exist yet, because the Hasura migrations run in their own
    # container. An unguarded query there raises UndefinedTable, the startup
    # event fails and the process exits 3. The refresh loop below retries, so a
    # failure here costs one refresh interval and nothing more.
    try:
        refreshed = index_catalog_embeddings(force=True)
        log.info("indexed %d standard-variable embeddings", refreshed)
    except Exception:
        log.exception("initial embedding index failed; the refresh loop will retry")
    global refresh_event
    refresh_event = asyncio.Event()
    global refresh_task
    refresh_task = asyncio.create_task(refresh_embeddings_loop())


@app.on_event("shutdown")
async def stop_embedding_indexer():
    global refresh_event
    refresh_event = None
    if refresh_task:
        refresh_task.cancel()
        try:
            await refresh_task
        except asyncio.CancelledError:
            pass


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "embedding_refresh_seconds": EMBEDDING_REFRESH_SECONDS,
    }


@app.post("/events/catalog")
async def catalog_event():
    """Accept a Hasura catalog event and queue an incremental re-index."""
    if refresh_event is not None:
        refresh_event.set()
    return {"status": "accepted"}


@app.get("/search")
def search(q: str = Query(min_length=1), limit: int = Query(default=20, ge=1, le=100)):
    vector = model().encode([q], normalize_embeddings=True)[0].tolist()
    vector_literal = "[" + ",".join(str(value) for value in vector) + "]"
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            """
            SELECT id, label, description,
              (0.7 * (1 - (embedding <=> %s::vector)) +
               0.3 * ts_rank(to_tsvector('english', coalesce(semantic_text, '')),
                             plainto_tsquery('english', %s))) AS score
            FROM modelcatalog_standard_variable
            WHERE embedding IS NOT NULL
            ORDER BY score DESC
            LIMIT %s
            """,
            (vector_literal, q, limit),
        ).fetchall()
        variable_ids = [row[0] for row in rows]
        model_rows = conn.execute(
            """
            WITH links AS (
              SELECT configuration_id, input_id AS dataset_specification_id, 'input' AS role
              FROM modelcatalog_configuration_input
              UNION ALL
              SELECT configuration_id, output_id AS dataset_specification_id, 'output' AS role
              FROM modelcatalog_configuration_output
            )
            SELECT vp.has_standard_variable, c.id, c.label, links.role
            FROM links
            JOIN modelcatalog_configuration c ON c.id = links.configuration_id
            JOIN modelcatalog_dataset_specification_presentation dsp
              ON dsp.dataset_specification_id = links.dataset_specification_id
            JOIN modelcatalog_variable_presentation vp ON vp.id = dsp.presentation_id
            WHERE vp.has_standard_variable = ANY(%s)
            ORDER BY c.label, links.role
            """,
            (variable_ids,),
        ).fetchall() if variable_ids else []

    models_by_variable = defaultdict(list)
    seen_model_links = set()
    for variable_id, model_id, model_label, role in model_rows:
        link_key = (variable_id, model_id, role)
        if link_key in seen_model_links:
            continue
        seen_model_links.add(link_key)
        models_by_variable[variable_id].append(
            {"id": model_id, "label": model_label, "role": role}
        )

    return {
        "results": [
            {
                "id": row[0],
                "label": row[1],
                "description": row[2],
                "score": float(row[3]),
                "models": models_by_variable.get(row[0], []),
            }
            for row in rows
        ]
    }
