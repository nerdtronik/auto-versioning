import sys
from time import sleep
import hashlib
from threading import Thread, Event
from time import time
import shutil
import json
import inspect
import os
from datetime import datetime, timezone

LOGGER_LEVELS = {
    "TRACE": 0,
    "DEBUG": 1,
    "INFO": 2,
    "DONE": 2,
    "RUNNING": 2,
    "FAILED": 2,
    "COMPLETED": 2,
    "SUCCESS": 3,
    "WARNING": 4,
    "ERROR": 5,
    "CRITICAL": 6,
    "EXCEPTION": 7,
}


def format_elapsed_time(start_time: float, end_time: float) -> str:
    """Function to format elapsed time in <h>h, <m>m, <s>s, <ms>ms

    Args:
        start_time (float): Start time in epoch format
        end_time (float): Finish time in epoch format

    Returns:
        str: Formatted elapsed time
    """
    elapsed_time = end_time - start_time
    result = ""
    hours = int(elapsed_time // 3600)
    if hours > 0:
        result += f"{hours}h, "
    elapsed_time %= 3600
    minutes = int(elapsed_time // 60)
    if minutes > 0:
        result += f"{minutes}min, "
    elapsed_time %= 60
    seconds = int(elapsed_time)
    if seconds > 0:
        result += f"{seconds}s, "
    milliseconds = int((elapsed_time - seconds) * 1000)
    if milliseconds > 0:
        result += f"{milliseconds}ms"
    return result


class color:
    DEFAULT = "\033[0m"
    END = "\033[0m"
    # Styles
    BOLD = "\033[1m"
    ITALIC = "\033[3m"
    UNDERLINE = "\033[4m"
    UNDERLINE_THICK = "\033[21m"
    HIGHLIGHTED = "\033[7m"
    HIGHLIGHTED_BLACK = "\033[40m"
    HIGHLIGHTED_RED = "\033[41m"
    HIGHLIGHTED_GREEN = "\033[42m"
    HIGHLIGHTED_YELLOW = "\033[43m"
    HIGHLIGHTED_BLUE = "\033[44m"
    HIGHLIGHTED_PURPLE = "\033[45m"
    HIGHLIGHTED_CYAN = "\033[46m"
    HIGHLIGHTED_GREY = "\033[47m"

    HIGHLIGHTED_GREY_LIGHT = "\033[100m"
    HIGHLIGHTED_RED_LIGHT = "\033[101m"
    HIGHLIGHTED_GREEN_LIGHT = "\033[102m"
    HIGHLIGHTED_YELLOW_LIGHT = "\033[103m"
    HIGHLIGHTED_BLUE_LIGHT = "\033[104m"
    HIGHLIGHTED_PURPLE_LIGHT = "\033[105m"
    HIGHLIGHTED_CYAN_LIGHT = "\033[106m"
    HIGHLIGHTED_WHITE_LIGHT = "\033[107m"

    STRIKE_THROUGH = "\033[9m"
    MARGIN_1 = "\033[51m"
    MARGIN_2 = "\033[52m"  # seems equal to MARGIN_1
    # colors
    BLACK = "\033[30m"
    RED_DARK = "\033[31m"
    GREEN_DARK = "\033[32m"
    YELLOW_DARK = "\033[33m"
    BLUE_DARK = "\033[34m"
    PURPLE_DARK = "\033[35m"
    CYAN_DARK = "\033[36m"
    GREY_DARK = "\033[37m"

    BLACK_LIGHT = "\033[90m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    PURPLE = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"


LOGGER_LEVEL_COLORS = {
    "TRACE": f"{color.BOLD+color.PURPLE}TRAC{color.END}",
    "RUNNING": f"{color.BOLD+color.PURPLE}RUNN{color.END}",
    "DEBUG": f"{color.BOLD+color.CYAN}DEBG{color.END}",
    "INFO": f"{color.BOLD+color.WHITE}INFO{color.END}",
    "DONE": f"{color.BOLD+color.GREEN}DONE{color.END}",
    "SUCCESS": f"{color.BOLD+color.HIGHLIGHTED_GREEN_LIGHT}SUCC{color.END}",
    "COMPLETED": f"{color.BOLD+color.HIGHLIGHTED_GREEN}COMP{color.END}",
    "WARNING": f"{color.BOLD+color.YELLOW_DARK}WARN{color.END}",
    "ERROR": f"{color.BOLD+color.RED}ERRR{color.END}",
    "FAILED": f"{color.BOLD+color.RED}FAIL{color.END}",
    "CRITICAL": f"{color.BOLD+color.HIGHLIGHTED_RED}CRIT{color.END}",
    "EXCEPTION": f"{color.BOLD+color.HIGHLIGHTED_YELLOW}EXCP{color.END}",
}


class Logger:
    """Logger helper to pretty format and follow processes in the background"""

    def __init__(self, env):
        global logger
        self.env = env
        self.idx = 0
        self._th_event = Event()
        self._tasks = {}
        self._task_thread: Thread = None
        self._running_task: str = ""
        self._animation = ["⠙", "⠘", "⠰", "⠴", "⠤", "⠦", "⠆", "⠃", "⠋", "⠉"]
        self.h_separator = "─"
        self.v_separator = " "
        self.level = LOGGER_LEVELS["INFO"]
        self.sh_file = True
        self.sh_date = True
        self.sh_env = True
        self.sh_level = True

    def show_file(self):
        self.sh_file = True

    def hide_file(self):
        self.sh_file = False

    def show_date(self):
        self.sh_date = True

    def hide_date(self):
        self.sh_date = False

    def show_env(self):
        self.sh_env = True

    def hide_env(self):
        self.sh_env = False

    def show_level(self):
        self.sh_level = True

    def hide_level(self):
        self.sh_level = False

    def set_level(self, level: str):
        """Method to set the level of logging

        Args:
            level (str): Logger Level
                        TRACE, DEBUG, INFO,
                        SUCCESS, WARNING,
                        ERROR, CRITICAL
        """
        self.level = LOGGER_LEVELS[level.upper()]

    def log(self, level: str, *messages, frame=None):
        """Main Log method to handle levels and messages join

        Args:
            level (str): Logger Level
                        TRACE, DEBUG, INFO,
                        SUCCESS, WARNING,
                        ERROR, CRITICAL
            frame: stack frame
            *messages: Multiple values to be logged that supports being passed at str()
        """
        level = level.upper()
        if LOGGER_LEVELS[level] < self.level:
            return
        if not frame:
            frame = inspect.currentframe().f_back
            # Get the filename from the frame
        line = frame.f_lineno
        filename = "/".join(frame.f_code.co_filename.split(os.sep)[-2:])

        message = self._get_message(*messages)
        if self._task_thread:
            self.remove_line()
            message += "\n"
        now = datetime.now(timezone.utc)
        log_message = ""
        if self.sh_date:
            log_message += f"{color.BLUE_DARK+now.isoformat()+color.END} | "
        if self.sh_env:
            log_message += f"{color.PURPLE}({self.env}){color.END} | "
        if self.sh_level:
            log_message += f"{LOGGER_LEVEL_COLORS[level]} | "
        if self.sh_file:
            log_message += f"{color.GREEN_DARK+filename}{color.YELLOW_DARK}:{color.GREEN_DARK+str(line)+color.END} | "

        log_message += f"{message}"

        if level.upper() == "EXCEPTION":
            raise Exception(message)
        print(log_message)

    def set_env(self, env: str):
        """Method to set the ENV name used for identifying the logs

        Args:
            env (str): ENV Name
        """
        self.env = env

    def sep(self):
        """Method to print an horizontal separator in the console"""
        if self.level >= 4:
            return
        width = shutil.get_terminal_size((80, 20))[0]
        print(self.h_separator * width)

    def _get_message(self, *messages) -> str:
        """Method to join multiple values into a string that will be logged

        Returns:
            str: Joined items by Logger.v_separator
        """
        res = []
        for msg in messages:
            if type(msg) == dict or type(msg) == list:
                res.append(json.dumps(msg))
            else:
                res.append(str(msg))
        return self.v_separator.join(res)

    def trace(self, *messages):
        """Method to log TRACE level messages"""
        frame = inspect.currentframe().f_back
        self.log("TRACE", *messages, frame=frame)

    def debug(self, *messages):
        """Method to log DEBUG level messages"""
        frame = inspect.currentframe().f_back
        self.log("DEBUG", *messages, frame=frame)

    def info(self, *messages):
        """Method to log INFO level messages"""
        frame = inspect.currentframe().f_back
        self.log("INFO", *messages, frame=frame)

    def success(self, *messages):
        """Method to log SUCCESS level messages"""
        frame = inspect.currentframe().f_back
        self.log("SUCCESS", *messages, frame=frame)

    def warn(self, *messages):
        """Method to log WARNING level messages"""
        frame = inspect.currentframe().f_back
        self.log("WARNING", *messages, frame=frame)

    def error(self, *messages):
        """Method to log ERROR level messages"""
        frame = inspect.currentframe().f_back
        self.log("ERROR", *messages, frame=frame)

    def critical(self, *messages):
        """Method to log CRITICAL level messages"""
        frame = inspect.currentframe().f_back
        self.log("CRITICAL", *messages, frame=frame)

    def done(self, *messages):
        """Method to log DONE level messages"""
        frame = inspect.currentframe().f_back
        self.log("DONE", *messages, frame=frame)

    def exception(self, *messages):
        """Method to log EXCEPTION level messages"""
        frame = inspect.currentframe().f_back
        self.log("EXCEPTION", *messages, frame=frame)

    def remove_line(self):
        """Method to remove one line from the command line"""
        print("\033[A\033[K", end="")

    def remove_lines(self, num: int):
        """Method to remove multiple line from the command line

        Args:
            num (int): Number of lines to be cleared
        """
        for i in range(num):
            self.remove_line()

    def wait_animation(self, frame):
        """Method to be called on a thread and log the status of ongoing tasks"""
        if self.level >= 4:
            return
        _animation_index = 0
        message = ""
        start_time = time()
        if len(self._tasks.keys()) > 0:
            message = self._tasks[self._running_task]["message"]
            start_time = self._tasks[self._running_task]["start_time"]

        while len(self._tasks.keys()) > 0 and not self._th_event.is_set():
            self.remove_line()
            num_tasks = len(self._tasks.keys())
            if num_tasks == 1:
                self.log(
                    "RUNNING",
                    f"{message} {self._animation[_animation_index]} ({format_elapsed_time(start_time,time())})",
                    frame=frame,
                )
            else:
                self.log(
                    "RUNNING",
                    f"{message} ({num_tasks} tasks running) {self._animation[_animation_index]} ({format_elapsed_time(start_time,time())})",
                    frame=frame,
                )
            if self._th_event.is_set():
                return
            sleep(0.1)
            _animation_index += 1
            if _animation_index >= len(self._animation):
                _animation_index = 0

    def start(self, *messages) -> str:
        """Method to start logging a foreground process in the background

        Example:
        ```
        # Start your process logging
        process_id=log.start("This is a long task")

        # Long task here

        # Finish your task passing the results
        log.finish(process_id,"Optional Message", success=False)
        ```

        Returns:
            str: Key of the process to be run
        """
        if self.level >= 4:
            return
        start_time = time()
        message = self._get_message(*messages)
        key = hashlib.md5(message.encode()).hexdigest()
        frame = inspect.currentframe().f_back
        self._tasks[key] = {"message": message, "start_time": start_time}

        if len(self._tasks.keys()) > 1:
            return key
        self._running_task = key
        if not self._task_thread:
            sys.stdout.write("\n")
            self._task_thread = Thread(target=self.wait_animation, args=[frame])
            self._task_thread.start()
        return key

    def finish(self, key: str, *messages, success: bool = True):
        """Method to finish logging running foreground processes in the background (queued)

        Note:
            This will kill the logs of the process' key passed,
            if there are multiple processes started, the logger will continue showing those

        Args:
            key (str): Key of the running process
            *messages: Optional values to be showed under the process' result log
            success (bool, optional): Tells if the process was successful or not. Defaults to True.
        """
        if self.level >= 4:
            return
        task = self._tasks.pop(key)
        message = self._get_message(*messages)
        self._th_event.set()
        self._task_thread.join()
        self._th_event.clear()

        self.remove_line()

        postfix = f"\n{message}" if len(message.strip()) > 0 else ""
        frame = inspect.currentframe().f_back
        if success:
            self.log(
                "COMPLETED",
                f"{task['message']} ✅ ({format_elapsed_time(task['start_time'],time())}){postfix}",
                frame=frame,
            )
        else:
            self.log(
                "FAILED",
                f"{task['message']} ❌ ({format_elapsed_time(task['start_time'],time())}){postfix}",
                frame=frame,
            )

        if len(self._tasks.keys()) == 0 and self._task_thread:
            self._task_thread = None
            self._running_task = ""
        else:
            sys.stdout.write("\n")
            self._running_task = list(self._tasks.keys())[-1]
            self._task_thread = Thread(target=self.wait_animation)
            self._task_thread.start()

    def clear_threads(self):
        """Method to stop every thread logging foreground processes in the background"""
        self._th_event.set()
        if self._task_thread:
            self._task_thread.join()
        self._th_event.clear()

    def _custom_catch(self, catch):
        """Method to overload the logger.catch method"""
        self.clear_threads()

    def catch(self, function):
        """Custom wrapper of the loguru.logger.catch method

        Args:
            function (function): Function that is being catch

        Returns:
            function: Returns the default loguru.logger.catch method
        """
        self.clear_threads()
        return self.logger.catch(default=None, reraise=True).__call__(function=function)

    def output_file(
        self,
        file_path: str,
        rotation: str = None,
        retention: str = None,
        compression: str = None,
    ) -> None:
        self.logger.add(
            file_path,
            colorize=False,
            rotation=rotation,
            retention=retention,
            compression=compression,
            catch=True,
            format=LOGGER_FILE_FORMAT,
        )


log = Logger("env")
# log.output_file("test_{time:YYYY-MM-DD}.log")
