import os
import tempfile
import zipfile

from core.config import (
    ALLOWED_EXTENSIONS,
    MAX_FILE_COUNT,
    MAX_FILE_SIZE,
    MAX_TOTAL_SIZE,
    MAX_ZIP_RATIO,
)


def validate_single_file(path: str) -> None:
    ext = os.path.splitext(path)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"[validator] Unsupported file type '{ext}' in '{os.path.basename(path)}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    try:
        size = os.path.getsize(path)
    except OSError as e:
        raise RuntimeError(f"[validator] Could not read size of '{path}': {e}") from e

    if size > MAX_FILE_SIZE:
        mb = size / (1024 * 1024)
        raise ValueError(
            f"[validator] '{os.path.basename(path)}' is {mb:.1f} MB — exceeds the {MAX_FILE_SIZE // (1024 * 1024)} MB per-file limit."
        )


def validate_zip(path: str) -> list[str]:
    # Reject the zip itself before opening if it already exceeds the total upload limit.
    try:
        zip_size = os.path.getsize(path)
    except OSError as e:
        raise RuntimeError(f"[validator] Could not read size of zip '{path}': {e}") from e

    if zip_size == 0:
        raise ValueError("[validator] ZIP file is empty (0 bytes) — upload rejected.")

    if zip_size > MAX_TOTAL_SIZE:
        mb = zip_size / (1024 * 1024)
        raise ValueError(
            f"[validator] ZIP file is {mb:.1f} MB — exceeds the {MAX_TOTAL_SIZE // (1024 * 1024)} MB total upload limit."
        )

    try:
        with zipfile.ZipFile(path, "r") as zf:
            infos = zf.infolist()

            # Check file count from metadata before extracting anything.
            if len(infos) > MAX_FILE_COUNT:
                raise ValueError(
                    f"[validator] ZIP contains {len(infos)} files — exceeds the {MAX_FILE_COUNT} file limit."
                )

            uncompressed_total = sum(info.file_size for info in infos)

            # Zip bomb check: a legitimate archive should not expand more than MAX_ZIP_RATIO times.
            # zip_size is guaranteed > 0 here so division is safe.
            if uncompressed_total / zip_size > MAX_ZIP_RATIO:
                ratio = uncompressed_total / zip_size
                raise ValueError(
                    f"[validator] ZIP has a suspicious compression ratio of {ratio:.0f}x "
                    f"(limit is {MAX_ZIP_RATIO}x) — possible zip bomb, upload rejected."
                )

            if uncompressed_total > MAX_TOTAL_SIZE:
                mb = uncompressed_total / (1024 * 1024)
                raise ValueError(
                    f"[validator] ZIP contents would expand to {mb:.1f} MB — "
                    f"exceeds the {MAX_TOTAL_SIZE // (1024 * 1024)} MB total limit."
                )

            # Extract into a sibling folder of the zip file so the caller's
            # cleanup of the zip's parent dir also removes extracted files.
            tmp_dir = os.path.join(os.path.dirname(path), "_extracted")
            os.makedirs(tmp_dir, exist_ok=True)
            try:
                zf.extractall(tmp_dir)
            except OSError as e:
                raise RuntimeError(f"[validator] Failed to extract ZIP to disk: {e}") from e
    except (zipfile.BadZipFile, zipfile.LargeZipFile) as e:
        raise ValueError(f"[validator] Could not open ZIP file: {e}") from e

    # Validate each extracted file individually — zip-level checks passing doesn't guarantee
    # every file inside is safe (e.g. a nested oversized or unsupported file).
    valid_paths = []
    for info in infos:
        if info.is_dir():
            continue
        extracted_path = os.path.join(tmp_dir, info.filename)
        ext = os.path.splitext(info.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            print(f"[validator] Skipping unsupported file in ZIP: '{info.filename}'")
            continue
        try:
            validate_single_file(extracted_path)
        except ValueError as e:
            raise ValueError(
                f"[validator] File inside ZIP failed validation: {e}"
            ) from e
        valid_paths.append(extracted_path)

    if not valid_paths:
        raise ValueError(
            f"[validator] ZIP contained no supported files "
            f"({', '.join(sorted(ALLOWED_EXTENSIONS))})."
        )

    return valid_paths


def validate_upload(paths: list[str]) -> list[str]:
    if not paths:
        raise ValueError("[validator] No files provided for upload.")

    # Single zip file — delegate entirely to validate_zip.
    if len(paths) == 1 and paths[0].lower().endswith(".zip"):
        return validate_zip(paths[0])

    # A zip mixed with other files is not a supported upload mode.
    zip_files = [p for p in paths if p.lower().endswith(".zip")]
    if zip_files:
        raise ValueError(
            "[validator] A ZIP file cannot be uploaded alongside other files. "
            "Upload the ZIP alone, or extract it and upload the files individually."
        )

    # Individual files mode.
    if len(paths) > MAX_FILE_COUNT:
        raise ValueError(
            f"[validator] {len(paths)} files uploaded — exceeds the {MAX_FILE_COUNT} file limit."
        )

    try:
        total_size = sum(os.path.getsize(p) for p in paths)
    except OSError as e:
        raise RuntimeError(f"[validator] Could not read file sizes: {e}") from e

    if total_size > MAX_TOTAL_SIZE:
        mb = total_size / (1024 * 1024)
        raise ValueError(
            f"[validator] Combined upload size is {mb:.1f} MB — "
            f"exceeds the {MAX_TOTAL_SIZE // (1024 * 1024)} MB total limit."
        )

    for path in paths:
        validate_single_file(path)

    return paths
