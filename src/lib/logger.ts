import { error as traceError, info as traceInfo, warn as traceWarn } from "@fltsci/tauri-plugin-tracing";

const stringify = (...args: unknown[]): string => args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");

const shouldLogToConsole = () => {
	try {
		return localStorage.getItem("imm-debug-logs") === "1";
	} catch {
		return false;
	}
};

export const info = (...args: unknown[]): void => {
	if (shouldLogToConsole()) console.log(...args);
	traceInfo(stringify(...args));
};

export const warn = (...args: unknown[]): void => {
	if (shouldLogToConsole()) console.warn(...args);
	traceWarn(stringify(...args));
};

export const error = (...args: unknown[]): void => {
	if (shouldLogToConsole()) console.error(...args);
	traceError(stringify(...args));
};
