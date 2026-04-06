extends Node
## Global signal hub for cross-scene communication.
## Usage: EventBus.signal_name.emit(args) / EventBus.signal_name.connect(callable)

# Hero signals
signal hero_health_changed(current: int, maximum: int)
signal hero_died
signal hero_attack_hit(enemy: Node2D, damage: int)

# Enemy signals
signal enemy_died(enemy: Node2D)
signal all_enemies_defeated

# Stage signals
signal wave_started(wave_index: int)
signal wave_cleared(wave_index: int)
signal stage_completed
