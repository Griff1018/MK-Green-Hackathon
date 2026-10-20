"""Write synthetic sample CVs for testing CV import.

    python -m ingest.make_sample_cvs

The people, employers and contact details are invented. The Domain 1 rules forbid
real CVs, so demos use only these files.
"""
from __future__ import annotations

from app.config import ROOT

OUT = ROOT / "static" / "samples"

CVS = {
    "meiling": """Tan Mei Ling
meiling.sample@example.com | +60 12-345 6789 | Shah Alam, Selangor

Summary
Office clerk with 18 years of experience in a logistics company. Organised, reliable and trusted with customer records.

Experience
Senior Office Clerk, Sample Logistics Sdn Bhd, 2014 - Present
- Key in delivery orders and keep shipment records up to date
- Prepare customer invoices in Excel and follow up on late payments
- Answer customer emails and calls in English, Malay and Mandarin
- Arrange meetings and travel for the operations manager
Office Clerk, Example Trading Sdn Bhd, 2007 - 2014
- Filed documents and maintained the supplier database
- Handled petty cash and basic bookkeeping

Education
SPM, SMK Sample, 2006

Skills
Excel, data entry, invoicing, customer service, scheduling

Languages
English, Malay, Mandarin
""",
    "aisha": """Nur Aisha binti Example
aisha.sample@example.com | +60 13-222 3344

Profile
Final-year environmental science student interested in sustainability and data.

Education
BSc Environmental Science, Universiti Sample Malaysia, 2026

Experience
Intern, Sample Water Services, Jun 2025 - Aug 2025
- Did water quality sampling at river sites and lab work
- Cleaned the results in Excel and made charts for the weekly report
- Wrote reports for the team

Skills
Excel, basic Python, field sampling, report writing

Certifications
Elements of AI (in progress)

Languages
Malay, English
""",
    "hafiz": """Muhammad Hafiz Example
hafiz.sample@example.com | 011-2345 6789

Education
Diploma in Electrical Engineering, Politeknik Sample, 2026

Experience
Part-time Sales Assistant, Sample Hardware, 2024 - Present
- Serve customers and recommend electrical parts
- Help with stock counts
Practical training
- Wiring and circuit practicals in the polytechnic workshop
- Help classmates fix laptops and install software

Skills
Electrical wiring, troubleshooting, customer service

Languages
Malay, English
""",
}


def main() -> None:
    from docx import Document
    from fpdf import FPDF

    OUT.mkdir(parents=True, exist_ok=True)
    # Mei Ling as PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)
    for line in CVS["meiling"].splitlines():
        pdf.multi_cell(0, 6, line or " ", new_x="LMARGIN", new_y="NEXT")
    pdf.output(str(OUT / "sample-cv-meiling.pdf"))
    # Aisha as Word
    doc = Document()
    for line in CVS["aisha"].splitlines():
        doc.add_paragraph(line)
    doc.save(str(OUT / "sample-cv-aisha.docx"))
    # Hafiz as text
    (OUT / "sample-cv-hafiz.txt").write_text(CVS["hafiz"], encoding="utf-8")
    print("Wrote", ", ".join(p.name for p in sorted(OUT.iterdir())))


if __name__ == "__main__":
    main()
