#!/usr/bin/env python3
"""Generate a paper index and independent review records; never publish crops.
Run from alignhsc root: python pipeline/prepare_review.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADMIN = ROOT / 'admin'
CROPS = ROOT / 'pipeline' / 'output' / 'crops'
MANIFESTS = ROOT / 'pipeline' / 'manifests'
OLD_KIT = ROOT / 'alignhsc-complete-review-kit' / 'alignhsc-review-kit'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def build():
    (ADMIN / 'data').mkdir(parents=True, exist_ok=True)
    papers = []
    for crop_file in sorted(CROPS.glob('*/crops.json')):
        directory = crop_file.parent
        raw = read_json(crop_file)
        paper_id = raw.get('paperId') or directory.name
        if not paper_id.replace('-', '').replace('_', '').isalnum():
            print(f'Skipping unsafe paper ID: {paper_id}')
            continue
        manifest_file = MANIFESTS / f'{paper_id}.json'
        if not manifest_file.exists():
            # The manifest may have a different filename; match paperId field instead.
            for candidate in MANIFESTS.glob('*.json'):
                try:
                    if read_json(candidate).get('paperId') == paper_id:
                        manifest_file = candidate
                        break
                except (ValueError, OSError):
                    pass
        manifest = read_json(manifest_file) if manifest_file.exists() else {}
        source = {str(q['id']): q for q in manifest.get('questions', [])}
        records = []
        for item in raw.get('records', []):
            qid = str(item['id'])
            meta = source.get(qid, {})
            def valid_images(field):
                output = []
                for filename in item.get(field, []):
                    path = Path(filename)
                    if path.is_absolute() or '..' in path.parts or path.parts[0] not in ('questions', 'solutions'):
                        raise ValueError(f'Unsafe image path {filename}')
                    if not (directory / path).is_file():
                        print(f'Warning: missing {directory / path}')
                    output.append(filename)
                return output
            qimages = valid_images('questionImages')
            simages = valid_images('solutionImages')
            records.append({
                'id': qid, 'questionNumber': str(item.get('questionNumber', meta.get('number', '?'))),
                'school': manifest.get('school', paper_id), 'year': manifest.get('year', ''),
                'questionType': meta.get('questionType', item.get('questionType', '')),
                'questionImages': qimages, 'solutionImages': simages,
                'topic': '', 'subtopic': '', 'additionalTopics': [], 'syllabusDotpoints': [],
                'difficulty': 'Medium', 'marks': meta.get('marks') or item.get('marks') or 1,
                'reviewStatus': 'needs-review', 'reviewNotes': '; '.join(meta.get('warnings', []))
            })
        target = ADMIN / 'data' / f'{paper_id}.json'
        if not target.exists():
            target.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding='utf-8')
        else:
            print(f'Preserved existing review data: {target}')
        papers.append({'id': paper_id, 'label': f"{manifest.get('school', paper_id)} — {manifest.get('year', '')}".strip(' —'),
                       'records': f'data/{paper_id}.json', 'images': f'../pipeline/output/crops/{directory.name}/', 'count': len(records)})

    if (OLD_KIT / 'records.json').exists():
        pid = 'ascham-2024-existing-review'
        papers.append({'id': pid, 'label': 'Ascham 2024 — original review kit',
                       'records': '../alignhsc-complete-review-kit/alignhsc-review-kit/records.json',
                       'images': '../alignhsc-complete-review-kit/alignhsc-review-kit/', 'count': len(read_json(OLD_KIT / 'records.json'))})

    (ADMIN / 'papers.json').write_text(json.dumps({'papers': papers}, indent=2), encoding='utf-8')
    print(f'Found {len(papers)} paper(s). Open admin/review.html via Live Server.')
    for p in papers:
        print(f" - {p['label']}: {p['count']} questions")
    if not papers:
        print('No crops found yet. Generate manifests and crops first.')


if __name__ == '__main__':
    build()
