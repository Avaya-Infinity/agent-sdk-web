export const consoleOriginal = {
	log: console.log,
	debug: console.debug,
	info: console.info,
	warn: console.warn,
	error: console.error,
	group: console.group,
};

const avayaInfinityIdentifier = "AvayaInfinityAgentSdk :: ";

const symbolColorHueMemo: Record<string, number> = {};

function getHue(symbol: string) {
	if (!symbolColorHueMemo[symbol]) {
		symbolColorHueMemo[symbol] = Math.floor(Math.random() * 360);
	}
	return symbolColorHueMemo[symbol];
}

function toHsl(h: number, s: number, l: number) {
	return `hsl(${h}, ${s}%, ${l}%)`;
}

function prepareLogStatements(avayaInfinityLog: {
	level: "ERROR" | "WARN" | "INFO" | "DEBUG" | "OFF";
	loggerName: string;
	context: string;
	message: string;
	"@timestamp": string;
	additionalDetails?: unknown;
}): [string, string, string, string, string, string, string, unknown] {
	const { level, loggerName, context, message, "@timestamp": timestamp, additionalDetails } = avayaInfinityLog;

	return [
		`%c${level}%c${loggerName}%c::%c${context}%c@(${new Date(timestamp).toLocaleString()})`,
		"color: white; background-color: gray; font-weight: bold; padding: 2px; margin: 2px 2px 2px 0px;",
		`color: ${toHsl(getHue(loggerName), 100, 70)}; background-color: ${toHsl(getHue(loggerName), 100, 10)}; font-weight: bold; padding: 2px; margin: 2px; border: 1px solid ${toHsl(getHue(loggerName), 100, 70)};`,
		"color: white; padding: 2px; margin: 2px;",
		`color: ${toHsl(getHue(context), 100, 70)}; font-weight: bold; padding: 2px; margin: 2px;`,
		"color: white; padding: 2px; margin: 2px;",
		`\n${message}\n`,
		additionalDetails ? additionalDetails : "",
	];
}

console.debug = function (...args: unknown[]) {
	if (typeof args[0] === "string" && args[0].startsWith(avayaInfinityIdentifier)) {
		const logBody = args[0].substring(avayaInfinityIdentifier.length);
		const logBodyParsed = JSON.parse(logBody);

		consoleOriginal.debug(...prepareLogStatements(logBodyParsed), ...args.slice(1));
	} else {
		consoleOriginal.debug(...args);
	}
};

console.info = function (...args: unknown[]) {
	if (typeof args[0] === "string" && args[0].startsWith(avayaInfinityIdentifier)) {
		const logBody = args[0].substring(avayaInfinityIdentifier.length);
		const logBodyParsed = JSON.parse(logBody);

		consoleOriginal.info(...prepareLogStatements(logBodyParsed), ...args.slice(1));
	} else {
		consoleOriginal.info(...args);
	}
};

console.group = function (...args: unknown[]) {
	if (typeof args[0] === "string" && args[0].startsWith(avayaInfinityIdentifier)) {
		const logBody = args[0].substring(avayaInfinityIdentifier.length);
		const logBodyParsed = JSON.parse(logBody);

		consoleOriginal.group(...prepareLogStatements(logBodyParsed), ...args.slice(1));
	} else {
		consoleOriginal.group(...args);
	}
};
