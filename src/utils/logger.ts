import { styleText } from "node:util";

type StringNumKeys = {
  [key: string]: number;
};

type ForegroundColors =
  | "black"
  | "blackBright"
  | "blue"
  | "blueBright"
  | "cyan"
  | "cyanBright"
  | "gray"
  | "green"
  | "greenBright"
  | "grey"
  | "magenta"
  | "magentaBright"
  | "red"
  | "redBright"
  | "white"
  | "whiteBright"
  | "yellow"
  | "yellowBright";
// https://nodejs.org/docs/latest/api/util.html#background-colors
type BackgroundColors =
  | "bgBlack"
  | "bgBlackBright"
  | "bgBlue"
  | "bgBlueBright"
  | "bgCyan"
  | "bgCyanBright"
  | "bgGray"
  | "bgGreen"
  | "bgGreenBright"
  | "bgGrey"
  | "bgMagenta"
  | "bgMagentaBright"
  | "bgRed"
  | "bgRedBright"
  | "bgWhite"
  | "bgWhiteBright"
  | "bgYellow"
  | "bgYellowBright";
// https://nodejs.org/docs/latest/api/util.html#modifiers
type Modifiers =
  | "blink"
  | "bold"
  | "dim"
  | "doubleunderline"
  | "framed"
  | "hidden"
  | "inverse"
  | "italic"
  | "overlined"
  | "reset"
  | "strikethrough"
  | "underline";

type StringListKeys = {
  [key: string]: Array<ForegroundColors | Modifiers | BackgroundColors>;
};

const LEVELS: StringNumKeys = {
  trace: -1,
  debug: 0,
  info: 1,
  done: 1,
  warn: 2,
  fail: 3,
  error: 3,
  critical: 4,
  panic: 4,
};

const LEVEL_COLORS: StringListKeys = {
  trace: ["bgMagentaBright", "white", "bold"],
  debug: ["cyan", "bold"],
  info: ["white", "bold"],
  done: ["green", "bold"],
  warn: ["yellowBright", "bold"],
  fail: ["red", "bold"],
  error: ["redBright", "bold"],
  critical: ["bgRedBright", "white", "bold"],
  panic: ["bgWhite", "redBright", "bold"],
};

export class Logger {
  level = "info";
  env = "default";
  separator = " ";
  showDate = true;
  showLevel = true;
  showEnv = true;

  constructor(level = "info", env = "default") {
    this.level = level;
    this.env = env;
  }

  joinMessages(messages: any[]): string {
    return Array.from(
      messages.map((msg) => {
        if (Array.isArray(msg))
          return JSON.stringify(msg.map((item) => this.joinMessages(item)));
        if (typeof msg === "object") return JSON.stringify(msg, null, 2);
        return String(msg);
      })
    ).join(this.separator);
  }

  __logger(messages: any[], level: string) {
    if (LEVELS[level] < LEVELS[this.level]) return;
    const message = this.joinMessages(messages);
    let pre: string[] = [];
    if (this.showDate) {
      pre.push(styleText(["green"], `[${new Date().toISOString()}]`));
    }
    if (this.showEnv) {
      pre.push("(" + styleText(["magentaBright", "italic"], this.env) + ")");
    }
    if (this.showLevel) {
      pre.push(styleText(LEVEL_COLORS[level], level.toUpperCase()));
    }
    console.log(pre.join(" ") + ": " + message);
    if (LEVELS[level] === 2) console.log(`::warn::${message}`);
    else if (LEVELS[level] > 2) console.log(`::error::${message}`);
  }
  trace(...messages: any[]) {
    this.__logger(messages, "trace");
  }
  debug(...messages: any[]) {
    this.__logger(messages, "debug");
  }
  info(...messages: any[]) {
    this.__logger(messages, "info");
  }
  done(...messages: any[]) {
    this.__logger(messages, "done");
  }
  warn(...messages: any[]) {
    this.__logger(messages, "warn");
  }
  fail(...messages: any[]) {
    this.__logger(messages, "fail");
  }
  error(...messages: any[]) {
    this.__logger(messages, "error");
  }
  critical(...messages: any[]) {
    this.__logger(messages, "critical");
  }
  panic(...messages: any[]) {
    this.__logger(messages, "panic");
  }
}

export let log = new Logger();
