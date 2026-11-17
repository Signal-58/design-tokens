import type { FileGuard } from '../src/index'

/** The Figma file every test's script or plugin is built for. */
export const FILE: FileGuard = { project: 'Test Project', fileKey: 'TestFileKey0000000000000' }

/** A mock Figma for that file: `figma.fileKey` as a plugin with the private API sees it. */
export const inFile = <T extends object>(figma: T): T => ({ fileKey: FILE.fileKey, ...figma })
