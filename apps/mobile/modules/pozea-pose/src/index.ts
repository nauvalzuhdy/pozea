import { NitroModules } from 'react-native-nitro-modules'

import type { PoseDetector } from './specs/PoseDetector.nitro'

export type { PoseDetector, PoseEngine, PoseResult } from './specs/PoseDetector.nitro'

/** Number of landmarks in the BlazePose topology used by both engines. */
export const LANDMARK_COUNT = 33

export function createPoseDetector(): PoseDetector {
  return NitroModules.createHybridObject<PoseDetector>('PoseDetector')
}
