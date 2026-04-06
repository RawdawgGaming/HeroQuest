extends Resource
class_name AbilityData
## Defines a single ability. Used by the ability system (Phase 2).

@export var ability_name: String = ""
@export var cooldown: float = 5.0
@export var damage_multiplier: float = 1.0
@export var range_radius: float = 100.0
@export var effect_scene: PackedScene
@export var input_action: String = "ability_1"
@export var description: String = ""
