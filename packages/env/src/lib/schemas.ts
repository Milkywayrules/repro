import { z } from 'zod'

export const appEnvSchema = z.enum(['test', 'dev', 'stg', 'prod'])
export const deployPlatformSchema = z.enum(['local', 'railway', 'contabo'])

export type AppEnv = z.infer<typeof appEnvSchema>
export type DeployPlatform = z.infer<typeof deployPlatformSchema>
