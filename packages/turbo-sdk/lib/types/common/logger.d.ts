export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';
export interface ILogger {
    setLogLevel: (level: LogLevel) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
}
export declare class Logger implements ILogger {
    private level;
    private levels;
    static default: Logger;
    constructor({ level, }?: {
        level?: LogLevel;
    });
    private formatMessage;
    private log;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
    setLogLevel(level: LogLevel): void;
}
//# sourceMappingURL=logger.d.ts.map