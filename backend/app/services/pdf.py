import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def make_one_sheet_pdf(name: str, condition: str, notes: str) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, h-72, "Care One-Sheet")
    c.setFont("Helvetica", 12)
    c.drawString(72, h-110, f"Name: {name}")
    c.drawString(72, h-130, f"Condition: {condition}")
    text = c.beginText(72, h-170)
    text.textLines(f"Notes:\n{notes}")
    c.drawText(text)
    c.showPage()
    c.save()
    return buf.getvalue()
