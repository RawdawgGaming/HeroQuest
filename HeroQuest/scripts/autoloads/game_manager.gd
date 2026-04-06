extends Node
## Global game state manager.

# Collision layer reference:
# Layer 1: World (ground, walls)
# Layer 2: Hero body
# Layer 3: Enemy body
# Layer 4: Hero hitbox (attacks FROM hero)
# Layer 5: Enemy hitbox (attacks FROM enemies)
# Layer 6: Hero hurtbox (receives damage ON hero)
# Layer 7: Enemy hurtbox (receives damage ON enemies)

var is_game_active: bool = false
var current_gold: int = 0
var current_diamonds: int = 0

func _ready() -> void:
	is_game_active = true
