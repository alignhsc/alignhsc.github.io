#!/usr/bin/env python3
"""Render question and solution crops from an approved PDF manifest.

Install: python -m pip install pymupdf
Run: python pipeline/crop_from_manifest.py --manifest pipeline/manifests/ascham-2024.json --pdf pipeline/input/sample.pdf
"""
from pathlib import Path
import argparse
import json
import re
import sys

try:
    import pymupdf
except ImportError:
    try:
        import fitz as pymupdf
    except ImportError:
        sys.exit('PyMuPDF is missing. Run: python -m pip install pymupdf')


def safe_id(value):
    identifier = str(value)
    if not re.fullmatch(r'[A-Za-z0-9_-]+', identifier):
        raise ValueError(f'Unsafe question/paper ID: {identifier!r}')
    return identifier


def trim_question_number(page, clip, number):
    """Optional: hide only the original 1.–10. MC label, not the question text."""
    matches = page.search_for(f'{number}.')
    for box in matches:
        if box.x0 < 90 and abs(box.y0 - clip.y0) < 45:
            return box
    return None


def build_crop(page, segment, margin, top_pad, bottom_pad):
    if 'rect' not in segment or len(segment['rect']) != 4:
        raise ValueError('Each segment needs rect: [x0, y0, x1, y1]')
    original = pymupdf.Rect(segment['rect'])
    if original.is_empty or original.is_infinite:
        raise ValueError(f'Invalid rectangle: {segment["rect"]}')

    # Preserve the vertical manifest boundaries with conservative outward padding.
    # Uses almost full page width to protect wide formulae and tables.
    # design change: 
    #   problem: initially it only cropped a specific part of printable pdf
    #            which caused part of the solutions to be cut out
    #   solution: change it to be wider and take up full printable length

    crop = pymupdf.Rect(
        page.rect.x0 + margin,
        max(page.rect.y0, original.y0 - top_pad),
        page.rect.x1 - margin,
        min(page.rect.y1, original.y1 + bottom_pad),
    ) & page.rect
    if crop.is_empty:
        raise ValueError('Crop falls outside PDF page')
    return crop


def process(manifest_file, pdf_file, output, dpi, margin, top_pad, bottom_pad, overwrite):
    manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
    questions = manifest.get('questions')
    if not isinstance(questions, list) or not questions:
        raise ValueError('Manifest must contain a non-empty questions array')
    paper_id = safe_id(manifest['paperId'])
    if not pdf_file.is_file():
        raise FileNotFoundError(f'Cannot find PDF: {pdf_file}')
    output.mkdir(parents=True, exist_ok=True)
    written = []
    generated = []
    warnings = []
    with pymupdf.open(pdf_file) as pdf:
        for item in questions:
            q_id = safe_id(item.get('id', f'{paper_id}-q{item["number"]}'))
            number = item.get('number')
            row = {'id': q_id, 'questionNumber': str(number), 'questionImages': [], 'solutionImages': []}
            for kind, folder, prop in [('question', 'questions', 'questionImages'), ('solution', 'solutions', 'solutionImages')]:
                segments = item.get(kind, [])
                if not isinstance(segments, list):
                    raise ValueError(f'{q_id} {kind} must be an array')
                if not segments:
                    warnings.append(f'{q_id}: missing {kind} segments')
                for n, segment in enumerate(segments, start=1):
                    page_num = int(segment['page'])
                    if page_num < 1 or page_num > len(pdf):
                        raise ValueError(f'{q_id}: page {page_num} outside PDF')
                    page = pdf[page_num - 1]  # Manifest uses human-friendly 1-based pages.
                    crop = build_crop(page, segment, margin, top_pad, bottom_pad)
                    destination = output / folder / f'{q_id}-{n}.jpg'
                    if destination.exists() and not overwrite:
                        raise FileExistsError(f'{destination} already exists. Use another --output or --overwrite.')
                    destination.parent.mkdir(parents=True, exist_ok=True)

                    # Direct PDF rendering preserves printed fractions, graphs and equations.
                    pix = page.get_pixmap(dpi=dpi, clip=crop, alpha=False)
                    if segment.get('maskNumber') and isinstance(number, int) and number <= 10:
                        # Mask ONLY when this precisely matches a left-margin printed question label.
                        label = trim_question_number(page, crop, number)
                        if label is not None:
                            from PIL import Image, ImageDraw
                            from io import BytesIO
                            image = Image.open(BytesIO(pix.tobytes('png'))).convert('RGB')
                            scale = dpi / 72
                            x0 = max(0, int((label.x0 - crop.x0 - 1) * scale))
                            y0 = max(0, int((label.y0 - crop.y0 - 1) * scale))
                            x1 = min(image.width, int((label.x1 - crop.x0 + 2) * scale))
                            y1 = min(image.height, int((label.y1 - crop.y0 + 2) * scale))
                            ImageDraw.Draw(image).rectangle([x0, y0, x1, y1], fill='white')
                            image.save(destination, 'JPEG', quality=92, optimize=True)
                        else:
                            pix.save(str(destination.with_suffix('.png')))
                            destination = destination.with_suffix('.png')
                            warnings.append(f'{q_id}: could not safely mask the MC question number')
                    else:
                        # PyMuPDF JPEG support avoids external image dependencies.
                        destination.write_bytes(pix.tobytes('jpg', jpg_quality=92))
                    written.append(destination)
                    row[prop].append(f'{folder}/{destination.name}')
            generated.append(row)

    (output / 'crops.json').write_text(json.dumps({'paperId': paper_id, 'records': generated, 'warnings': warnings}, indent=2), encoding='utf-8')
    print(f'Created {len(written)} images for {len(generated)} questions in {output}')
    print(f'Pairing data: {output / "crops.json"}')
    if warnings:
        print('Warnings:')
        for warning in warnings:
            print(' -', warning)
    print('Review the crops before marking any question as approved.')


def main():
    parser = argparse.ArgumentParser(description='Crop any PDF using a verified question/solution manifest')
    parser.add_argument('--manifest', type=Path, required=True, help='Path to manifest JSON')
    parser.add_argument('--pdf', type=Path, help='PDF path; default uses sourcePdf from manifest relative to manifest folder')
    parser.add_argument('--output', type=Path, help='Output folder (default: pipeline/output/crops/<paperId>)')
    parser.add_argument('--dpi', type=int, default=140)
    parser.add_argument('--margin', type=float, default=20, help='Horizontal page margin in points')
    parser.add_argument('--top-pad', type=float, default=0, help='Extra space above manifest rectangle')
    parser.add_argument('--bottom-pad', type=float, default=0, help='Extra space below manifest rectangle')
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    if args.margin < 0 or args.top_pad < 0 or args.bottom_pad < 0 or args.dpi < 72:
        parser.error('Margins/padding must be nonnegative and DPI must be at least 72')
    manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
    pdf_path = args.pdf or args.manifest.parent / manifest['sourcePdf']
    output = args.output or Path(__file__).resolve().parent / 'output' / 'crops' / safe_id(manifest['paperId'])
    process(args.manifest, pdf_path, output, args.dpi, args.margin, args.top_pad, args.bottom_pad, args.overwrite)


if __name__ == '__main__':
    main()
