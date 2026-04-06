extends Node2D
## Forest Stage 01 setup script. Configures wave spawner with wave data.

@onready var wave_spawner = $WaveSpawner

func _ready() -> void:
	# Configure 3 enemy waves at different points along the stage
	# Wave 1: 2 goblins at the 1/4 mark
	wave_spawner.add_wave(2, Vector2(600, 300), 400.0)
	# Wave 2: 3 goblins at the 1/2 mark
	wave_spawner.add_wave(3, Vector2(1400, 300), 1100.0)
	# Wave 3: 4 goblins at the 3/4 mark
	wave_spawner.add_wave(4, Vector2(2200, 300), 1900.0)

	# Add hero to group for enemy detection
	var hero := $Entities/Hero
	if hero:
		hero.add_to_group("hero")
