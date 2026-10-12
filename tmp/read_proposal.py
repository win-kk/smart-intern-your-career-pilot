import pdfplumber

path = r"D:\04_Downloads\NEXORA_Lab7_Proposal.pdf"
with pdfplumber.open(path) as pdf:
    print(f"PAGES {len(pdf.pages)}")
    for index, page in enumerate(pdf.pages, start=1):
        print(f"--- PAGE {index} ---")
        print(page.extract_text() or "")
