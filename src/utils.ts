"use strict";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { create as createGlob } from "@actions/glob";
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import readline from "readline";
import { log } from "./logger.js";
import { simpleGit } from "simple-git";
const git = simpleGit();

const changesRegex: RegExp =
  /\s+(?<files_changed>\d+)\s+file(?:|s)\s+changed(?:(?:,|)\s+(?<insertions>\d+)\s+insertion(?:s|)\(\+\)|)(?:(?:,|)\s+(?<deletions>\d+)\s+deletion(?:s|)\(-\)|)/gm;

export function runCommand(cmd: string): string {
  return execSync(cmd).toString();
}

export async function getFilesglob(glob: string[]): Promise<string[]> {
  const g = await createGlob(glob.join("\n"), {
    omitBrokenSymbolicLinks: true,
  });
  return await g.glob();
}

export async function parseGitIgnore() {
  const files = await getFilesglob(["**.gitignore**"]);
  let res: string[] = [];
  for (var i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.trim().length === 0) continue;
    const lines = fs.readFileSync(file).toString().split("\n");
    res = res.concat(
      lines.filter(
        (line, index) =>
          !/^(#|\/)/.test(line) &&
          line.trim().length > 0 &&
          lines.indexOf(line) === index
      )
    );
  }
  return res;
}

export async function getDiff(
  source: string = "",
  target: string = "",
  dir: string = ".",
  exclude: string[] = [],
  include: string[] = []
) {
  exclude = exclude.map((exc) => `':^${exc}'`.replaceAll("_", "*"));
  include = include.map((inc) =>
    `'${dir}${path.sep}${inc}'`.replaceAll("_", "*")
  );
  if (source.length === 0) source = "";
  if (target.length === 0) target = "";
  else target = target + "..";

  let options = ["--shortstat", "--summary"];

  if (`${target}${source}`.length > 0) options.push(`${target}${source}`);

  options = options.concat([
    "--",
    include.length === 0 ? dir : "",
    ...include,
    ...exclude,
    ":^.gitignore",
  ]);

  const diff = await git.diff(options);
  const changes = changesRegex.exec(diff)?.groups ?? {};
  const deleted_files = diff.match(/\s+delete\s+mode/g)?.length ?? 0;
  const created_files = diff.match(/\s+create\s+mode/g)?.length ?? 0;

  const res = {
    filesCreated: created_files,
    filesDeleted: deleted_files,
    filesChanged: Number(changes.files_changed ?? 0),
    insertions: Number(changes.insertions ?? 0),
    deletions: Number(changes.deletions ?? 0),
  };

  // core.debug(JSON.stringify(res));
  return res;
}

export function countLines(
  file: string | Buffer<ArrayBufferLike>
): Promise<number> {
  return new Promise<number>((resolve) => {
    var inf = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity,
    });
    var count = 0;
    inf.on("line", () => {
      count += 1;
    });
    inf.on("close", () => resolve(count));
  });
}

type FileResponse = {
  path: string | Buffer<ArrayBufferLike>;
  lines: number;
};

export async function getFileList(
  ph: string,
  include: string[],
  exclude: string[]
): Promise<FileResponse[]> {
  if (!fs.pathExistsSync(ph) || fs.lstatSync(ph).isFile()) return [];
  const fileList = fs.readdirSync(ph);
  let res: FileResponse[] = [];
  await Promise.all(
    fileList.map(async (item: string) => {
      item = path.resolve(path.join(ph, item));
      if (exclude.includes(item)) return;
      if (fs.lstatSync(item).isFile()) {
        if (include.length > 0) {
          if (include.includes(item)) {
            const fileRes = { path: item, lines: await countLines(item) };
            res.push(fileRes);
          }
        } else {
          const fileRes = { path: item, lines: await countLines(item) };
          res.push(fileRes);
        }
      } else {
        const nestRes = await getFileList(
          path.join(ph, path.basename(item)),
          include,
          exclude
        );
        res = res.concat(nestRes);
      }
    })
  );
  return res;
}

type Inputs = {
  dir: string;
  exclude: string[];
  include: string[];
  sourceCommit: string;
  targetCommit: string;
  patchLimit: number;
  minorLimit: number;
  // importantFiles: string[];
  // importanceRate: number;
  vPrefix: boolean;
  isAlpha: boolean;
  isBeta: boolean;
  isRc: boolean;
  isDraft: boolean;
  isPrerelease: boolean;
  keyAlpha: string;
  keyBeta: string;
  keyRc: string;
  debug: boolean;
  createTag: boolean;
  createMajorTag: boolean;
  createMinorTag: boolean;
  createLatestTag: boolean;
  prereleaseTag: string;
  buildMetadata: string;
  prereleaseSep: string;
  buildSep: string;
  versionSep: string;
  githubToken: string;
  excludeGitignore: boolean;
};

export async function readInputs(): Promise<Inputs> {
  let dir = core.getInput("directory");
  if (dir.length === 0) dir = path.resolve(".");
  const exclude = core
    .getInput("exclude")
    .split(",")
    .filter((item) => item.trim().length > 0);
  const include = core
    .getInput("include")
    .split(",")
    .filter((item) => item.trim().length > 0);
  // const importantFiles = core
  //   .getInput("important-files")
  //   .split(",")
  //   .filter((item) => item.trim().length > 0);

  let sourceCommit = core.getInput("source-commit");
  let targetCommit = core.getInput("target-commit");

  let patchLimit = Number(core.getInput("patch-limit"));
  if (patchLimit === 0) patchLimit = 10;
  let minorLimit = Number(core.getInput("minor-limit"));
  if (minorLimit === 0) minorLimit = 75;
  // let importanceRate = Number(core.getInput("importance-rate"));
  // if (importanceRate === 0) importanceRate = 1.1;

  const vPrefix = core.getInput("v-prefix") === "true" ? true : false;
  const isAlpha = core.getBooleanInput("is-alpha");
  const isBeta = core.getBooleanInput("is-beta");
  const isRc = core.getBooleanInput("is-rc");
  const isDraft = core.getBooleanInput("is-draft");
  const isPrerelease = core.getBooleanInput("is-prerelease");
  const keyAlpha = core.getInput("alpha-key");
  const keyBeta = core.getInput("beta-key");
  const keyRc = core.getInput("rc-key");
  const debug = core.getBooleanInput("debug");
  const createTag = core.getBooleanInput("create-tag");
  const createMajorTag = core.getBooleanInput("create-major-tag");
  const createMinorTag = core.getBooleanInput("create-minor-tag");
  const createLatestTag = core.getBooleanInput("create-latest-tag");
  const prereleaseTag = core.getInput("prerelease-tag");
  const buildMetadata = core.getInput("build-metadata");
  const prereleaseSep = core.getInput("prerelease-separator");
  const buildSep = core.getInput("build-separator");
  const versionSep = core.getInput("version-separator");
  const excludeGitignore = core.getBooleanInput("exclude-gitignore");
  let githubToken = core.getInput("github-token");

  if (githubToken.length === 0 && process.env.TEST)
    githubToken = fs.readFileSync(".github.token").toString();
  else if (githubToken.length === 0)
    core.setFailed("No GITHUB TOKEN provided, sadly is required to continue");

  return {
    dir,
    exclude,
    include,
    sourceCommit,
    targetCommit,
    patchLimit,
    minorLimit,
    // importantFiles,
    // importanceRate,
    vPrefix,
    isAlpha,
    isBeta,
    isRc,
    isDraft,
    isPrerelease,
    keyAlpha,
    keyBeta,
    keyRc,
    debug,
    createTag,
    createMajorTag,
    createMinorTag,
    createLatestTag,
    prereleaseTag,
    buildMetadata,
    prereleaseSep,
    buildSep,
    githubToken,
    excludeGitignore,
    versionSep,
  };
}

type Version = {
  tagString: string;
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  buildMetadata?: string;
};

export async function getLatestTag(
  gh: InstanceType<typeof GitHub>,
  repo: { owner: string; repo: string },
  versionSep: string = ".",
  prereleaseSep: string = "-",
  buildSep: string = "+"
): Promise<Version> {
  const semverRegex = new RegExp(
    `^v*(?<major>\\d+)(?:\\.|\\${versionSep})(?<minor>\\d+)(?:\\.|\\${versionSep})(?<patch>\\d+)(?:(?:-|\\${prereleaseSep})(?<prerelease>(?:\\d+|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:(?:\\.|\\${versionSep})(?:\\d+|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:(?:\\+|\\${buildSep})(?<buildMetadata>[0-9a-zA-Z-]+(?:(?:\\.|\\${versionSep})[0-9a-zA-Z-]+)*))?$`
  );

  const tags = (await gh.rest.repos.listReleases(repo)).data.filter(
    (tag: any) =>
      tag.draft === false &&
      tag.prerelease === false &&
      tag.tag_name !== "latest" &&
      semverRegex.test(tag.tag_name)
  );
  const latest = tags.reduce((a: any, b: any) => {
    return new Date(a.published_at) > new Date(b.published_at) ? a : b;
  });
  const tagDescription = semverRegex.exec(latest.tag_name)?.groups;
  if (!tagDescription)
    return {
      major: 0,
      minor: 0,
      patch: 0,
      tagString: "v0.0.0",
    };
  const tagVersion: Version = {
    major: Number(tagDescription.major),
    minor: Number(tagDescription.minor),
    patch: Number(tagDescription.patch),
    prerelease: tagDescription.prerelease ?? "",
    buildMetadata: tagDescription.buildMetadata ?? "",
    tagString: latest.tag_name,
  };
  return tagVersion;
}

export function updateTag(
  maxChange: number,
  currentTag: Version,
  inputs: Inputs
): Version {
  log.info("Calculating new tag version");
  let prerelease = "";
  let is_oneof = "";
  let increase = false;

  if (currentTag.prerelease?.includes(inputs.keyAlpha))
    is_oneof = inputs.keyAlpha;
  else if (currentTag.prerelease?.includes(inputs.keyBeta))
    is_oneof = inputs.keyBeta;
  else if (currentTag.prerelease?.includes(inputs.keyRc))
    is_oneof = inputs.keyRc;
  else if (currentTag.prerelease?.includes(inputs.prereleaseTag))
    is_oneof = inputs.prereleaseTag;

  if (inputs.isAlpha === true) {
    increase = inputs.keyAlpha === is_oneof;
    is_oneof = inputs.keyAlpha;
  } else if (inputs.isBeta === true) {
    increase = inputs.keyBeta === is_oneof;
    is_oneof = inputs.keyBeta;
  } else if (inputs.isRc === true) {
    increase = inputs.keyRc === is_oneof;
    is_oneof = inputs.keyRc;
  } else if (inputs.prereleaseTag.length > 0) {
    increase = inputs.prereleaseTag == is_oneof;
    is_oneof = inputs.prereleaseTag;
  } else is_oneof = "";

  if (is_oneof.length > 0) {
    let currentPreVersion = "";
    if (increase) {
      currentPreVersion = String(
        Number(
          currentTag.prerelease
            ?.replace(inputs.keyAlpha, "")
            .replace(inputs.keyBeta, "")
            .replace(inputs.keyRc, "")
            .replace(inputs.prereleaseTag, "")
            .split(inputs.versionSep)[1] ?? 0
        ) + 1
      );
    }
    prerelease = `${is_oneof}${currentPreVersion.length > 0 ? inputs.versionSep : ""}${currentPreVersion}`;
  }

  if (
    prerelease.length === 0 ||
    prerelease.split(inputs.versionSep).length === 1
  )
    if (maxChange <= inputs.patchLimit) {
      log.info(
        "Changes lower than",
        inputs.patchLimit,
        "%, increasing PATCH version"
      );
      if (prerelease.split(".")[1]?.length > 0) currentTag.patch += 1;
    } else if (maxChange <= inputs.minorLimit) {
      log.info(
        "Changes lower than",
        inputs.minorLimit,
        "%, increasing MINOR version"
      );
      currentTag.minor += 1;
      currentTag.patch = 0;
      if (prerelease.length > 0) prerelease = is_oneof;
    } else {
      log.info(
        "Changes higher than",
        inputs.minorLimit,
        "%, increasing MAJOR version"
      );
      currentTag.major += 1;
      currentTag.minor = 0;
      currentTag.patch = 0;
      if (prerelease.length > 0) prerelease = is_oneof;
    }

  let tagString = "";

  if (inputs.vPrefix === true) tagString = "v";

  tagString += `${currentTag.major}${inputs.versionSep}${currentTag.minor}${inputs.versionSep}${currentTag.patch}`;

  currentTag.prerelease = prerelease;
  if (prerelease.length > 0) tagString += inputs.prereleaseSep + prerelease;

  currentTag.buildMetadata = inputs.buildMetadata;
  if (inputs.buildMetadata.length > 0) {
    tagString += inputs.buildSep + inputs.buildMetadata;
  }

  currentTag.tagString = tagString;
  return currentTag;
}

export async function createTag(
  gh: InstanceType<typeof GitHub>,
  tag: Version,
  inputs: Inputs
) {
  let creation = [];

  const defaultTag = async () => {
    log.info("Creating tag version", tag.tagString);
    const success = await createorUpdateTag(
      gh,
      tag.tagString,
      inputs.sourceCommit,
      inputs.isDraft,
      inputs.isPrerelease,
      inputs.createLatestTag === false
    );
    if (success === false)
      core.setFailed("Failed to create tag: " + tag.tagString);
    return success;
  };
  creation.push(defaultTag);

  if (inputs.createMajorTag) {
    creation.push(async () => {
      let tagString = "";
      if (inputs.vPrefix) tagString += "v";
      tagString += String(tag.major);
      if (tag.prerelease && tag.prerelease.length > 0)
        tagString += inputs.prereleaseSep + tag.prerelease;
      if (tag.buildMetadata && tag.buildMetadata.length > 0)
        tagString += inputs.buildSep + tag.buildMetadata;
      log.info("Creating tag:", tagString);
      const success = await createorUpdateTag(
        gh,
        tagString,
        inputs.sourceCommit,
        inputs.isDraft,
        inputs.isPrerelease,
        inputs.createLatestTag === false
      );
      if (success === false)
        core.setFailed("Failed to create tag: " + tagString);
      return success;
    });
  }
  if (inputs.createMinorTag) {
    creation.push(async () => {
      let tagString = "";
      if (inputs.vPrefix) tagString += "v";
      tagString += `${tag.major}${inputs.versionSep}${tag.minor}`;
      if (tag.prerelease && tag.prerelease.length > 0)
        tagString += inputs.prereleaseSep + tag.prerelease;
      if (tag.buildMetadata && tag.buildMetadata.length > 0)
        tagString += inputs.buildSep + tag.buildMetadata;
      log.info("Creating tag:", tagString);
      const success = await createorUpdateTag(
        gh,
        tagString,
        inputs.sourceCommit,
        inputs.isDraft,
        inputs.isPrerelease,
        inputs.createLatestTag === false
      );
      if (success === false)
        core.setFailed("Failed to create tag: " + tagString);
      return success;
    });
  }

  if (inputs.createLatestTag) {
    creation.push(async () => {
      log.info("Creating tag: latest");
      const success = await createorUpdateTag(
        gh,
        "latest",
        inputs.sourceCommit,
        inputs.isDraft,
        inputs.isPrerelease,
        true
      );
      if (success === false) core.setFailed("Failed to create tag: latest");
      return success;
    });
  }

  const res = await Promise.all(creation.map((item) => item()));
  if (res.every((result) => result === false))
    core.setFailed("failed to create tags");
}

async function createorUpdateTag(
  gh: InstanceType<typeof GitHub>,
  tag: string,
  sha: string,
  isDraft: boolean,
  isPrerelease: boolean,
  latest: boolean
): Promise<boolean> {
  try {
    const existingTag = await gh.request(
      "GET /repos/{owner}/{repo}/releases/tags/{tag}",
      {
        ...github.context.repo,
        tag: tag,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    const releaseId = existingTag.data.id;
    const res = await gh.request(
      "DELETE /repos/{owner}/{repo}/releases/{release_id}",
      {
        ...github.context.repo,
        release_id: releaseId,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    await gh.request("DELETE /repos/{owner}/{repo}/git/refs/tags/{tag}", {
      ...github.context.repo,
      tag: tag,
    });
    if (res.status >= 400) {
      log.info("Failed to update tag", tag);
      return false;
    }
  } catch (e) {
    log.info("Failed to update tag", tag, "trying to create it");
  }

  const res = await gh.request(`POST /repos/{owner}/{repo}/releases`, {
    ...github.context.repo,
    tag_name: tag,
    name: tag,
    body: "Generated automatically using auto-versioning",
    draft: isDraft,
    target_commitish: sha,
    prerelease: isPrerelease,
    generate_release_notes: true,
    make_latest: latest == true ? "true" : "false",
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (res.status >= 200 && res.status <= 299) {
    log.info("Tag", tag, "Successfully created");
    return true;
  }
  return false;
  return true;
}
