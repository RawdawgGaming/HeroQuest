extends Resource
class_name EnemyData
## Defines an enemy type. Create .tres files for each enemy (Goblin, Skeleton, etc.)

@export var enemy_name: String = ""
@export var base_stats: Dictionary = {
	"max_health": 40,
	"attack_power": 8,
	"defense": 2,
	"move_speed": 120.0,
}
@export var detection_range: float = 200.0
@export var attack_range: float = 35.0
@export var xp_reward: int = 10
@export var gold_reward: int = 5
@export var sprite_frames: SpriteFrames
