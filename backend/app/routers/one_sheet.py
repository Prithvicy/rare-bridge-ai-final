from fastapi import APIRouter, Response
from ..schemas import OneSheetRequest, OneSheetResponse
from ..services.pdf import make_one_sheet_pdf

router = APIRouter()

@router.post("", response_model=OneSheetResponse)
async def one_sheet(req: OneSheetRequest):
    # Return a URL that triggers on-demand PDF generation (works in mock/real modes)
    return OneSheetResponse(pdfUrl=f"/one-sheet/download?name={req.name}&condition={req.condition}&notes={req.notes}")

@router.get("/download")
async def dl(name: str, condition: str, notes: str = ""):
    pdf = make_one_sheet_pdf(name, condition, notes)
    return Response(content=pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{(name or "one-sheet").replace(" ", "_")}.pdf"'
    })
