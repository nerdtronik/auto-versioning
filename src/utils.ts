"use strict";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import { create as createGlob } from "@actions/glob";
import {
  PullRequestEvent,
  PushEvent,
} from "@octokit/webhooks-definitions/schema";
import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import readline from "readline";
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
    ":^.gitignore"
  ]);

  const diff = await git.diff(options);
  console.log(diff)
  const changes = changesRegex.exec(diff)?.groups ?? {};
  console.log(changes);
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
          if (include.includes(item))
            res.push({ path: item, lines: await countLines(item) });
        } else res.push({ path: item, lines: await countLines(item) });
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
  importantFiles: string[];
  importanceRate: number;
  vPrefix: boolean;
  isAlpha: boolean;
  isBeta: boolean;
  isRc: boolean;
  isDraft: boolean;
  isPrerelease: boolean;
  keyAlpha: string;
  keyBeta: string;
  keyrRc: string;
  debug: boolean;
  createTag: boolean;
  createMajorTag: boolean;
  createLatestTag: boolean;
  prereleaseTag: string;
  buildMetadata: string;
  prereleaseSep: string;
  buildSep: string;
  githubToken: string;
  excludeGitignore: boolean;
};

export async function readInputs(): Promise<Inputs> {
  let payload: PushEvent | PullRequestEvent;
  if (github.context.eventName === "push") {
    payload = github.context.payload as PushEvent;
    payload;
    core.info(`The head commit is: ${payload.head_commit}`);
    console.log(payload);
  } else if (github.context.eventName === "pull_request") {
    payload = github.context.payload as PullRequestEvent;
    console.log(payload);
  }
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
  const importantFiles = core
    .getInput("important-files")
    .split(",")
    .filter((item) => item.trim().length > 0);

  let sourceCommit = core.getInput("source-commit");
  let targetCommit = core.getInput("target-commit");

  let patchLimit = Number(core.getInput("patch-limit"));
  if (patchLimit === 0) patchLimit = 10;
  let minorLimit = Number(core.getInput("minor-limit"));
  if (minorLimit === 0) minorLimit = 75;
  let importanceRate = Number(core.getInput("importance-rate"));
  if (importanceRate === 0) importanceRate = 1.1;

  const vPrefix = core.getInput("v-prefix") === "true" ? true : false;
  const isAlpha = core.getBooleanInput("is-alpha");
  const isBeta = core.getBooleanInput("is-beta");
  const isRc = core.getBooleanInput("is-rc");
  const isDraft = core.getBooleanInput("is-draft");
  const isPrerelease = core.getBooleanInput("is-prerelease");
  const keyAlpha = core.getInput("alpha-key");
  const keyBeta = core.getInput("beta-key");
  const keyrRc = core.getInput("rc-key");
  const debug = core.getBooleanInput("debug");
  const createTag = core.getBooleanInput("create-tag");
  const createMajorTag = core.getBooleanInput("create-major-tag");
  const createLatestTag = core.getBooleanInput("create-latest-tag");
  const prereleaseTag = core.getInput("prerelease-tag");
  const buildMetadata = core.getInput("build-metadata");
  const prereleaseSep = core.getInput("prerelease-separator");
  const buildSep = core.getInput("build-separator");
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
    importantFiles,
    importanceRate,
    vPrefix,
    isAlpha,
    isBeta,
    isRc,
    isDraft,
    isPrerelease,
    keyAlpha,
    keyBeta,
    keyrRc,
    debug,
    createTag,
    createMajorTag,
    createLatestTag,
    prereleaseTag,
    buildMetadata,
    prereleaseSep,
    buildSep,
    githubToken,
    excludeGitignore,
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
  prereleaseSep: string = "-",
  buildSep: string = "+"
): Promise<Version> {
  const semverRegex = new RegExp(
    `^v*(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?:(-|\\${prereleaseSep})(?<prerelease>(?:\\d+|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:\\d+|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:(\\+|\\${buildSep})(?<buildMetadata>[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$`
  );

  const tags = (await gh.rest.repos.listReleases(repo)).data.filter(
    (tag: any) =>
      tag.draft === false &&
      tag.prerelease === false &&
      tag.tag_name !== "latest" &&
      semverRegex.test(tag.tag_name)
  );

  const latest = tags.reduce((a: any, b: any) => {
    return new Date(a.created_at) > new Date(b.created_at) ? a : b;
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
