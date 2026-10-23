
#!/usr/bin/env python3

# Review kit preparation
# Converts cropped question and solution images into a reviewable folder

from pathlib import Path
import argparse
import json
import shutil


# Review preparation
# Builds editable metadata and copies the images into a separate review folder
def prepare_review(crops_dir, manifest_path, review_html, output_dir):
    crop_data = json.loads(
        (crops_dir / "crops.json").read_text(encoding="utf-8")
    )

    manifest = json.loads(
        manifest_path.read_text(encoding="utf-8")
    )

    crop_records = crop_data.get("records", [])

    manifest_records = {
        item["id"]: item
        for item in manifest.get("questions", [])
    }

    if not crop_records:
        raise ValueError("No cropped question records found.")

    if output_dir.exists():
        raise FileExistsError(
            f"Review folder already exists: {output_dir}\n"
            "Choose a new folder to avoid losing your review progress."
        )

    if not review_html.is_file():
        raise FileNotFoundError(
            f"Cannot find review.html: {review_html}"
        )

    records = []
    image_paths = set()

    for crop in crop_records:
        question_id = crop["id"]
        source = manifest_records.get(question_id, {})

        question_images = crop.get("questionImages", [])
        solution_images = crop.get("solutionImages", [])

        for image_path in question_images + solution_images:
            relative_path = Path(image_path)

            if (
                relative_path.is_absolute()
                or ".." in relative_path.parts
                or not relative_path.parts
                or relative_path.parts[0] not in ("questions", "solutions")
            ):
                raise ValueError(
                    f"Unsafe image path: {image_path}"
                )

            if not (crops_dir / relative_path).is_file():
                raise FileNotFoundError(
                    f"Missing cropped image: {image_path}"
                )

            image_paths.add(image_path)

        warnings = list(source.get("warnings", []))

        if not solution_images:
            warnings.append(
                "No matched solution. Requires review."
            )

        record = {
            "id": question_id,
            "questionNumber": str(crop["questionNumber"]),
            "school": manifest.get("school", ""),
            "year": manifest.get("year"),
            "syllabusVersion": "",
            "questionType": source.get("questionType", ""),
            "questionImages": question_images,
            "solutionImages": solution_images,
            "topic": "",
            "subtopic": "",
            "syllabusDotpoints": [],
            "additionalTopics": [],
            "difficulty": "",
            "marks": source.get("marks") or 0,
            "reviewStatus": "needs-review",
            "reviewNotes": "; ".join(dict.fromkeys(warnings))
        }

        records.append(record)

    # Output creation
    # Creates the review kit without changing the website or previous reviews
    output_dir.mkdir(parents=True)

    shutil.copy2(
        review_html,
        output_dir / "review.html"
    )

    for image_path in sorted(image_paths):
        source = crops_dir / image_path
        destination = output_dir / image_path

        destination.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        shutil.copy2(source, destination)

    records_path = output_dir / "records.json"

    records_path.write_text(
        json.dumps(records, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    print(f"Prepared {len(records)} questions.")
    print(f"Review folder: {output_dir}")
    print("All questions require review before publication.")


# Command-line interface
# Accepts input paths so the program works for any school or paper
def main():
    parser = argparse.ArgumentParser(
        description="Prepare an alignhsc ingestion review kit."
    )

    parser.add_argument("--crops", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--review-html", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)

    args = parser.parse_args()

    prepare_review(
        args.crops,
        args.manifest,
        args.review_html,
        args.output
    )


if __name__ == "__main__":
    main()
