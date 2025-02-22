import os
import subprocess
import re
from .logger import log
import json
from datetime import datetime

base_directory = os.getcwd()

semver_validation = re.compile(
    r"^(?:v|)(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)(?:-(?P<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?P<build_metadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)

changes_regex = re.compile(
    r"\s+(?P<files_changed>0|[1-9]\d*)\s+file(|s) changed((,|)\s+(?P<insertions>0|[1-9]\d*)\s+insertion(s|)\(\+\)|)((,|)\s+(?P<deletions>0|[1-9]\d*)\s+deletion(s|)\(-\)|)"
)


def run_command(command: str) -> str:
    res = subprocess.run(command, capture_output=True, shell=True)
    if res.stderr:
        log.error(res.stderr.decode("utf-8"))
    if not res.stdout:
        return None
    return res.stdout.decode("utf-8")


def unpack_list(l: list[list]) -> list:
    res = []
    for item in l:
        if type(item) == list:
            res.extend(item)
        else:
            res.append(item)
    return res


def verify_pattern(patterns: list[str], item: str) -> bool:
    for pattern in patterns:
        pattern = re.sub(r"/\*$", "*", pattern.lower())
        pattern = re.sub(r"/$", "$", pattern)
        pattern = pattern.replace(".", "\\.").replace("**", "*").replace("*", ".*")
        res = re.search(rf"{pattern.lower()}", item.lower())
        if res:
            return True
    return False


def get_files_list(base_dir: str, exclude: list[str] = [], only: list[str] = []):
    result = []
    log.debug(base_dir)
    items = os.listdir(base_dir)
    for item in items:
        item = os.path.join(base_dir, item)
        if any(ex == os.path.dirname(item).split(os.path.sep)[-1] for ex in [".git", ".venv", "__pycache__"]):
                log.debug(item, "dir excluded by default")
                continue
        if os.path.isdir(item):
            result.extend(get_files_list(item, exclude=exclude, only=only))
            continue
        log.debug(item, "nodir")
        if len(exclude) > 0 and verify_pattern(exclude, item):
            log.debug(item, "excluded")
            continue
        if len(only) > 0 and not verify_pattern(only, item):
            log.debug(item, "not included")
            continue
        log.debug(item, "passed")
        result.append(item)
    return result


def _make_gen(reader):
    b = reader(1024 * 1024)
    while b:
        yield b
        b = reader(1024 * 1024)


def rawgencount(filename):
    f = open(filename, "rb")
    f_gen = _make_gen(f.raw.read)
    return sum(buf.count(b"\n") for buf in f_gen)


def get_files_lines_count(file_list: list[str]):
    return sum(rawgencount(file) for file in file_list)


def get_latest_date(date_strings, date_format):
    """
    Compares a list of date strings and returns the latest date string.

    Args:
        date_strings: A list of date strings.
        date_format: The format of the date strings (e.g., "%Y-%m-%d").

    Returns:
        The latest date string, or None if the input list is empty.
    """
    if not date_strings:
        return None

    dates = [datetime.strptime(date_str, date_format) for date_str in date_strings]
    latest_date = max(dates)
    return latest_date.strftime(date_format)


def get_current_version():
    default_ver = {
        "major": 0,
        "minor": 0,
        "patch": 0,
        "prerelease": "",
        "build_metadata": "",
        "str": "v0.0.0",
    }
    command = [
        "gh",
        "release",
        "list",
        "--limit",
        "100",
        "--json",
        "publishedAt,name,tagName,isLatest,isDraft",
    ]

    result = run_command(" ".join(command))
    log.debug("Current versions:\n", result)
    if not result:
        return default_ver

    results = json.loads(result)
    results = list(filter(lambda x: x["isDraft"] == False, results))

    date_strings = [item["publishedAt"] for item in results]
    date_format = "%Y-%m-%dT%H:%M:%SZ"
    latest_date = get_latest_date(date_strings, date_format)

    filtering = list(filter(lambda x: x["publishedAt"] == latest_date, results))
    if len(filtering) == 0:
        return default_ver

    latest_tag = filtering[0]["tagName"]

    valid = semver_validation.search(latest_tag)

    if not valid:
        return default_ver
    version = valid.groupdict()
    version["major"] = int(version["major"])
    version["minor"] = int(version["minor"])
    version["patch"] = int(version["patch"])
    version["prerelease"] = (
        version["prerelease"] if version["prerelease"] != None else ""
    )
    version["build_metadata"] = (
        version["build_metadata"] if version["build_metadata"] != None else ""
    )
    version["str"] = latest_tag
    return version


def get_diff(
    source: str,
    target: str,
    directory: str = ".",
    exclude: list[str] = [],
    include: list[str] = [],
):
    exclude = [f"':^{item}'".replace("_", "*") for item in exclude]
    include = [os.path.join(directory, "*", item) for item in include]
    source = f"{source}" if len(source) > 0 else ""
    target = f"{target}.." if len(target) > 0 else ""
    command = [
        "git",
        "diff",
        "--shortstat",
        "--summary",
        f"{target}{source}",
        "--",
        directory if len(include) == 0 else "",
        *include,
        *exclude,
    ]
    debug_command = [
        "git",
        "diff",
        f"{target}{source}",
        "--",
        directory if len(include) == 0 else "",
        *include,
        *exclude,
    ]
    debug_result = run_command(" ".join(debug_command))
    log.debug(debug_result)
    log.debug("git diff command:\n", " ".join(command))
    result = run_command(" ".join(command))
    log.debug("git diff result:\n", result)
    if not result:
        result = ""
    changes_res = changes_regex.search(result)
    deleted_files = len(re.findall(r"\n\s+delete\s+mode", result))
    added_files = len(re.findall(r"\n\s+create\s+mode", result))
    if not changes_res:
        return {
            "files_changed": 0,
            "insertions": 0,
            "deletions": 0,
            "files_added": added_files,
            "files_removed": deleted_files,
        }
    res = changes_res.groupdict()
    res["files_added"] = added_files
    res["files_removed"] = deleted_files
    for key in res.keys():
        if res[key] == None:
            res[key] = 0
        else:
            res[key] = int(res[key])
    return res


def calculate_version(
    current_version: dict,
    changes: dict,
    limits: dict,
    enable_prefix=False,
    alpha=False,
    beta=False,
    rc=False,
    prerelease_tag: str = "",
    build_metadata: str = "",
) -> list[str, dict]:
    is_one = ""
    big_change = False
    max_change = max(changes["insertions%"], changes["deletions%"])
    if max_change == 0:
        return None, None
    if alpha:
        is_one = "alpha"
        log.info("alpha version")
    elif beta:
        is_one = "beta"
        log.info("beta version")
    elif rc:
        is_one = "rc"
        log.info("release candidate version")
    elif 0 < max_change <= limits["patch"]:
        log.info(
            f'Changes ({max_change}%) under {limits["patch"]}%, increasing patch version'
        )
        current_version["patch"] += 1

    if limits["patch"] < max_change <= limits["minor"]:
        log.info(
            f'Changes ({max_change}%) over {limits["patch"]}% and under {limits["minor"]}%, increasing minor version'
        )
        current_version["minor"] += 1
        current_version["patch"] = 0
        big_change = True
    elif max_change > limits["minor"]:
        log.info(
            f'Changes ({max_change}%) over {limits["minor"]}%, increasing major version'
        )
        current_version["major"] += 1
        current_version["minor"] = 0
        current_version["patch"] = 0
        big_change = True

    if len(is_one) > 0:
        if is_one in current_version["prerelease"] and not big_change:
            current_a_version = current_version["prerelease"].split(".")[-1]
            if len(current_a_version) > 0 and not is_one in current_a_version:
                current_version["prerelease"] = f"{is_one}.{int(current_a_version)+1}"
            else:
                current_version["prerelease"] = f"{is_one}.1"
        else:
            current_version["prerelease"] = is_one
        if (
            len(prerelease_tag) > 0
            and "alpha" not in prerelease_tag
            and "beta" not in prerelease_tag
            and "rc" not in prerelease_tag
        ):
            current_version["prerelease"] = (
                f'{current_version["prerelease"]}-{prerelease_tag}'
            )
    if (
        current_version["major"] == 0
        and current_version["minor"] == 0
        and current_version["patch"] == 0
    ):
        current_version["patch"] = 1
    current_version["build_metadata"] = build_metadata
    version = f'{current_version["major"]}.{current_version["minor"]}.{current_version["patch"]}'
    if enable_prefix:
        version = f"v{version}"
    if len(current_version["prerelease"]) > 0:
        version += f'-{current_version["prerelease"]}'
    elif len(prerelease_tag) > 0:
        version += f"-{prerelease_tag}"

    if len(current_version["build_metadata"]) > 0:
        version += f'+{current_version["build_metadata"]}'
    current_version["str"] = version
    return version, current_version


def create_version_tag(tag: str, target: str = "", draft=False, prerelease=False):
    log.info("Creating version tag:", tag)
    command = ["gh", "release", "create", tag, "--generate-notes"]
    if len(target) > 0:
        command.extend(["--target", target])
    if draft:
        command.append("--draft")
    elif prerelease:
        command.append("--prerelease")
    log.debug("Create version tag command:\n", " ".join(command))
    result = run_command(" ".join(command))
    log.debug("Create version tag command result:\n", result)
    if not result:
        return log.error("Failed to create new tag version")
    log.success("New tag created:", result)
