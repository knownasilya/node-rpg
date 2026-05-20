import { Scene } from "excalibur";
import { registerCoreEcsSystems } from "./ecs/core";
import { registerPlatformerSystems } from "./ecs/platformer";

// Public re-exports — keep the existing import surface stable so modifiers
// importing from "./ecs" don't break after the split.
export {
  // Core
  type ControlScheme,
  InputComponent,
  RequestedHeadingComponent,
  type MovementStyle,
  MovementComponent,
  FollowerComponent,
  ChaseComponent,
  InitialPosComponent,
  type CollisionAction,
  type CollisionRule,
  CollisionRulesComponent,
  SpawnerComponent,
  TailGrowerComponent,
  InputSystem,
  MovementSystem,
  ChaseSystem,
  LeaderHistorySystem,
  FollowerSystem,
} from "./ecs/core";

export {
  // Platformer
  GravityComponent,
  GroundedComponent,
  JumpComponent,
  PlatformerControllerComponent,
  CameraFollowComponent,
  type BoxShape,
  HitboxComponent,
  HurtboxComponent,
  type OnZero,
  HealthComponent,
  PlatformerMovementSystem,
  GravitySystem,
  JumpSystem,
  CameraFollowSystem,
  HitboxSystem,
  HitboxDebugSystem,
} from "./ecs/platformer";

export function registerEcsSystems(scene: Scene): void {
  registerCoreEcsSystems(scene);
  registerPlatformerSystems(scene);
}
