import type { TokensConfig } from './config.js';
export interface CheckResult {
    problems: string[];
    /** Things that pass but are worth seeing, such as accepted APCA misses. */
    notes: string[];
}
export declare function checkTokens(config: TokensConfig, root?: string): Promise<CheckResult>;
