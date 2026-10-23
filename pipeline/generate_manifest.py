
#!/usr/bin/env python3

# PDF manifest generator
# Detects question boundaries and proposes question-solution pairings
from __future__ import annotations

import argparse
import json
import re

from collections import defaultdict
from pathlib import Path

import pymupdf


# Question numbering formats
# Supports standard, standalone and unpunctuated question numbers
MC = re.compile(r"^\s*(10|[1-9])\.\s+(?=\S)")
MC_PLAIN = re.compile(r"^\s*(10|[1-9])\s+\S")
MC_STANDALONE = re.compile(r"^\s*(10|[1-9])\s*$")

ER = re.compile(
    r"^\s*Question\s+(\d{1,3})\s*"
    r"(?:\((?:continued|\d+\s*marks?)\))?",
    re.I
)

CONT = re.compile(
    r"^\s*Question\s+(\d{1,3})\s*\(continued\)",
    re.I
)

MARKS = re.compile(r"\((\d+)\s*marks?\)", re.I)


# PDF scanning
# Identifies candidate question headings from text and layout
def scan(pdf_path: Path):
    events = []

    with pymupdf.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf):
            lines = []

            for block in page.get_text("dict")["blocks"]:
                if "lines" not in block:
                    continue

                for line in block["lines"]:
                    spans = line["spans"]
                    text = "".join(
                        span["text"] for span in spans
                    ).strip()

                    if not text:
                        continue

                    lines.append({
                        "text": text,
                        "rect": list(line["bbox"])
                    })

            lines.sort(
                key=lambda line: (
                    line["rect"][1],
                    line["rect"][0]
                )
            )

            for line in lines:
                text = line["text"]
                x0, y0, x1, y1 = line["rect"]

                # Restrict detection to the question-heading region
                if (
                    x0 > page.rect.width * 0.24
                    or y0 < 15
                    or y0 > page.rect.height - 52
                ):
                    continue

                extended = ER.match(text)
                continued = bool(
                    extended and CONT.match(text)
                )

                number = None
                question_type = None
                marks = None
                detection_format = None

                # Format 1: Question 11 (2 marks)
                if extended:
                    number = int(extended.group(1))

                    if number < 11:
                        continue

                    question_type = "extended-response"

                    mark_match = MARKS.search(text)
                    marks = (
                        int(mark_match.group(1))
                        if mark_match
                        else None
                    )

                    detection_format = "question-heading"

                else:
                    # Format 2: 1. Which expression...
                    match = MC.match(text)

                    if (
                        match
                        and x0 <= page.rect.width * 0.18
                    ):
                        number = int(match.group(1))
                        detection_format = "numbered-with-period"

                    else:
                        # Fallback 1: a standalone "1" in the left column
                        match = MC_STANDALONE.match(text)

                        if (
                            match
                            and x0 <= page.rect.width * 0.13
                        ):
                            nearby_text = any(
                                other is not line
                                and other["rect"][0] > x1 + 8
                                and other["rect"][0] < page.rect.width * 0.8
                                and abs(other["rect"][1] - y0) < 12
                                and len(other["text"]) >= 12
                                for other in lines
                            )

                            if nearby_text:
                                number = int(match.group(1))
                                detection_format = (
                                    "standalone-number-fallback"
                                )

                        else:
                            # Fallback 2: 1 Which expression...
                            match = MC_PLAIN.match(text)

                            if (
                                match
                                and x0 <= page.rect.width * 0.13
                                and len(text) >= 13
                            ):
                                number = int(match.group(1))
                                detection_format = (
                                    "number-without-period-fallback"
                                )

                    if number is not None:
                        question_type = "multiple-choice"
                        marks = 1

                if number is None:
                    continue

                events.append({
                    "number": number,
                    "page": page_index + 1,
                    "y0": round(y0, 2),
                    "y1": round(y1, 2),
                    "type": question_type,
                    "continued": continued,
                    "marks": marks,
                    "heading": text[:120],
                    "detectionFormat": detection_format
                })

    return events, page_index + 1


# Numbering run detection
# Separates the original exam from repeated annotated solutions
def group_runs(events):
    runs = []
    current = []
    highest = 0

    for event in events:
        number = event["number"]

        if (
            not event["continued"]
            and current
            and (
                number < highest - 3
                or (number == 1 and highest >= 3)
            )
        ):
            runs.append(current)
            current = []
            highest = 0

        if (
            current
            and number == current[-1]["number"]
            and not event["continued"]
        ):
            continue

        current.append(event)
        highest = max(highest, number)

    if current:
        runs.append(current)

    return runs


# Crop segment generation
# Preserves question boundaries and continuation pages
def make_segments(run, pdf_path):
    by_number = defaultdict(list)
    by_page = defaultdict(list)

    for event in run:
        by_number[event["number"]].append(event)
        by_page[event["page"]].append(event)

    output = {}

    with pymupdf.open(pdf_path) as pdf:
        for number, events in by_number.items():
            segments = []

            for event in events:
                page = pdf[event["page"] - 1]

                next_headings = [
                    other["y0"]
                    for other in by_page[event["page"]]
                    if (
                        other["y0"] > event["y0"] + 2
                        and other["number"] != number
                    )
                ]

                bottom = (
                    min(next_headings) - 9
                    if next_headings
                    else min(page.rect.height - 55, 780)
                )

                top = max(12, event["y0"] - 11)

                if bottom <= top + 10:
                    continue

                segments.append({
                    "page": event["page"],
                    "rect": [
                        20,
                        round(top, 2),
                        round(page.rect.width - 20, 2),
                        round(bottom, 2)
                    ],
                    "continued": event["continued"],
                    "maskNumber": False
                })

            output[number] = segments

    return output


# Manifest construction
# Creates draft records without automatically approving anything
def build(pdf_path, solutions_path, paper_id, school, year):
    events, total_pages = scan(pdf_path)
    runs = group_runs(events)

    diagnostics = []

    if not runs:
        raise RuntimeError(
            "No question headings identified. "
            "This PDF may require visual analysis."
        )

    if solutions_path:
        solution_events, _ = scan(solutions_path)
        solution_runs = group_runs(solution_events)

        primary = max(
            runs,
            key=lambda run: len({
                event["number"] for event in run
            })
        )

        secondary = (
            max(
                solution_runs,
                key=lambda run: len({
                    event["number"] for event in run
                })
            )
            if solution_runs else []
        )

        secondary_pdf = solutions_path

        if len(solution_runs) != 1:
            diagnostics.append(
                "Solutions PDF has multiple or zero numbering runs."
            )

    else:
        primary = runs[0]
        secondary = runs[1] if len(runs) == 2 else []
        secondary_pdf = pdf_path

        if len(runs) != 2:
            diagnostics.append(
                f"Found {len(runs)} numbering runs. "
                "Solution pairing is unconfirmed."
            )

    questions = make_segments(primary, pdf_path)

    solutions = (
        make_segments(secondary, secondary_pdf)
        if secondary else {}
    )

    if secondary and set(questions) != set(solutions):
        diagnostics.append(
            "Question numbers differ between exam and solutions."
        )

    manifest = {
        "paperId": paper_id,
        "sourcePdf": pdf_path.name,
        "school": school,
        "year": year,
        "pdfPages": total_pages,
        "status": "draft-needs-review",
        "notes": (
            "Automatically proposed question and solution crops. "
            "All pairs require visual review."
        ),
        "questions": [],
        "diagnostics": diagnostics
    }

    if solutions_path:
        manifest["solutionPdf"] = solutions_path.name

    for number in sorted(questions):
        heading = next(
            (
                event for event in primary
                if (
                    event["number"] == number
                    and not event["continued"]
                )
            ),
            None
        )

        if heading is None:
            heading = next(
                event for event in primary
                if event["number"] == number
            )

        record = {
            "id": f"{paper_id}-q{number}",
            "number": number,
            "questionType": heading["type"],
            "marks": heading["marks"],
            "question": questions[number],
            "solution": solutions.get(number, []),
            "reviewStatus": "pending",
            "confidence": "candidate",
            "warnings": []
        }

        if not record["solution"]:
            record["warnings"].append(
                "No confidently paired solution"
            )

        if len(record["question"]) > 1:
            record["warnings"].append(
                "Multi-page question: verify continuation"
            )

        if record["marks"] is None:
            record["warnings"].append(
                "Check mark allocation"
            )

        if record["questionType"] == "multiple-choice":
            record["warnings"].append(
                "Original question number retained"
            )

        manifest["questions"].append(record)

    statistics = {
        "runs": [
            [
                (
                    event["number"],
                    event["page"],
                    event["continued"]
                )
                for event in run
            ]
            for run in runs
        ],
        "numbers": len(questions),
        "paired": sum(
            bool(record["solution"])
            for record in manifest["questions"]
        )
    }

    return manifest, statistics


# Command line interface
# Accepts any PDF filename and writes a new draft manifest
def main():
    parser = argparse.ArgumentParser(
        description="Generate a draft question manifest"
    )

    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--solutions", type=Path)

    parser.add_argument("--paper-id", required=True)
    parser.add_argument("--school", required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)

    args = parser.parse_args()

    if not re.fullmatch(r"[a-z0-9_-]+", args.paper_id):
        parser.error(
            "paper-id must contain lowercase letters, "
            "numbers, underscores or hyphens"
        )

    manifest, statistics = build(
        args.pdf,
        args.solutions,
        args.paper_id,
        args.school,
        args.year
    )

    args.output.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    args.output.write_text(
        json.dumps(
            manifest,
            indent=2,
            ensure_ascii=False
        ),
        encoding="utf-8"
    )

    print(f"Draft: {args.output}")
    print(f"Questions: {statistics['numbers']}")
    print(f"Proposed pairs: {statistics['paired']}")

    print(
        "Runs:",
        [
            (
                len(run),
                run[:3],
                run[-3:]
            )
            for run in statistics["runs"]
        ]
    )

    print("Diagnostics:", manifest["diagnostics"])

    print(
        "NOT APPROVED: Review question and solution crops "
        "before publishing."
    )


if __name__ == "__main__":
    main()
