from io import BytesIO
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.features.words.workbook.flat import build_flat_workbook
from app.features.words.workbook.format import MAX_WORKBOOK_BYTES, InvalidWorkbookError
from app.features.words.workbook.import_batches import (
    StaleImportError,
    apply_import,
    preview_import,
    recovery_record,
)
from app.features.words.workbook.import_source import read_import_source
from app.shared.deps import get_db

router = APIRouter()
Database = Annotated[Session, Depends(get_db)]


@router.post("/import/xlsx/preview")
async def preview_workbook(
    file: Annotated[UploadFile, File()],
    db: Database,
    mode: Annotated[Literal["add", "content"], Form()] = "add",
    minimum_translations: Annotated[int, Form(ge=0, le=20)] = 4,
):
    try:
        if not file.filename or not file.filename.lower().endswith(".xlsx"):
            raise InvalidWorkbookError("Please upload a .xlsx workbook")
        content = await file.read(MAX_WORKBOOK_BYTES + 1)
        source = await run_in_threadpool(read_import_source, content)
        return await run_in_threadpool(
            preview_import, db, source, mode=mode, minimum_translations=minimum_translations
        )
    except InvalidWorkbookError as exc:
        db.rollback()
        raise HTTPException(400, str(exc)) from exc
    finally:
        await file.close()


class ApplyWorkbookRequest(BaseModel):
    batch_id: str = Field(min_length=36, max_length=36)
    plan_hash: str = Field(pattern=r"^[a-f0-9]{64}$")


@router.post("/import/xlsx/apply")
def apply_workbook(payload: ApplyWorkbookRequest, db: Database):
    try:
        return apply_import(db, payload.batch_id, payload.plan_hash)
    except (InvalidWorkbookError, StaleImportError) as exc:
        db.rollback()
        raise HTTPException(409 if isinstance(exc, StaleImportError) else 400, str(exc)) from exc


@router.get("/import/xlsx/{batch_id}/recovery")
def download_recovery(batch_id: str, db: Database):
    try:
        return recovery_record(db, batch_id)
    except InvalidWorkbookError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/import/xlsx/template")
def download_template(db: Database):
    content = build_flat_workbook(db, template=True)
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="lexora-import-template.xlsx"'},
    )
