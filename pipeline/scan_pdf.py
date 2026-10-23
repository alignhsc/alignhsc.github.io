
from pathlib import Path
import json
import pymupdf


# File locations
# Finds the input PDF and prepares the analysis output folder
pipeline_dir = Path(__file__).parent
pdf_path = pipeline_dir / "input" / "sample.pdf"
output_dir = pipeline_dir / "output"
output_dir.mkdir(parents=True, exist_ok=True)


# PDF analysis
# Extracts text lines, their positions and formatting information
def analyse_pdf():
    if not pdf_path.exists():
        print("Error: sample.pdf was not found.")
        return

    pages = []

    with pymupdf.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf):
            page_data = {
                "page": page_index + 1,
                "width": round(page.rect.width, 2),
                "height": round(page.rect.height, 2),
                "lines": []
            }

            text_data = page.get_text("dict")

            for block in text_data["blocks"]:
                if "lines" not in block:
                    continue

                for line in block["lines"]:
                    spans = line["spans"]

                    text = "".join(span["text"] for span in spans).strip()

                    if not text:
                        continue

                    page_data["lines"].append({
                        "text": text,
                        "bbox": [round(value, 2) for value in line["bbox"]],
                        "fontSize": round(max(span["size"] for span in spans), 2),
                        "font": spans[0]["font"]
                    })

            pages.append(page_data)

    output_path = output_dir / "pdf_analysis.json"

    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(pages, file, indent=2, ensure_ascii=False)

    print(f"Analysed {len(pages)} pages.")
    print(f"Saved analysis to: {output_path}")


analyse_pdf()
