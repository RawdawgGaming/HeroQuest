extends Resource
class_name HeroClassData
## Defines a hero class. Create .tres files for each class (Paladin, Barbarian, etc.)

@export var class_display_name: String = ""
@export var base_stats: Dictionary = {
	"max_health": 100,
	"attack_power": 10,
	"defense": 5,
	"move_speed": 200.0,
	"crit_chance": 0.05,
}
@export var abilities: Array[Resource] = []
@export var sprite_frames: SpriteFrames
