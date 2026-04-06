extends Node
## Spawns enemy waves when the hero enters trigger zones.
## Each wave definition specifies enemy scene, count, and spawn area.

@export var enemy_scene: PackedScene
@export var enemy_container_path: NodePath
@export var camera_path: NodePath

var enemy_container: Node2D
var camera: Camera2D
var waves: Array[Dictionary] = []
var current_wave_index: int = -1
var enemies_alive: int = 0
var wave_active: bool = false

func _ready() -> void:
	enemy_container = get_node(enemy_container_path) if enemy_container_path else null
	camera = get_node(camera_path) if camera_path else null
	EventBus.enemy_died.connect(_on_enemy_died)

func add_wave(enemy_count: int, spawn_position: Vector2, trigger_x: float) -> void:
	waves.append({
		"enemy_count": enemy_count,
		"spawn_position": spawn_position,
		"trigger_x": trigger_x,
		"triggered": false,
	})

func _physics_process(_delta: float) -> void:
	if wave_active:
		return

	# Check if hero has passed any trigger points
	var heroes := get_tree().get_nodes_in_group("hero")
	if heroes.size() == 0:
		return
	var hero_x: float = heroes[0].global_position.x

	for i in range(waves.size()):
		if not waves[i]["triggered"] and hero_x >= waves[i]["trigger_x"]:
			_start_wave(i)
			return

func _start_wave(index: int) -> void:
	waves[index]["triggered"] = true
	current_wave_index = index
	wave_active = true

	var wave_data: Dictionary = waves[index]
	enemies_alive = wave_data["enemy_count"]

	EventBus.wave_started.emit(index)

	# Lock camera during wave
	if camera and camera.has_method("lock_scroll"):
		camera.lock_scroll(wave_data["spawn_position"].x + 400)

	# Spawn enemies
	for i in range(wave_data["enemy_count"]):
		if enemy_scene and enemy_container:
			var enemy := enemy_scene.instantiate()
			var offset := Vector2(randf_range(-100, 100), randf_range(-30, 30))
			enemy.global_position = wave_data["spawn_position"] + offset
			enemy_container.add_child(enemy)

func _on_enemy_died(_enemy: Node2D) -> void:
	if not wave_active:
		return

	enemies_alive -= 1
	if enemies_alive <= 0:
		_wave_cleared()

func _wave_cleared() -> void:
	wave_active = false
	EventBus.wave_cleared.emit(current_wave_index)

	# Unlock camera
	if camera and camera.has_method("unlock_scroll"):
		camera.unlock_scroll()

	# Check if all waves are done
	var all_done := true
	for wave in waves:
		if not wave["triggered"]:
			all_done = false
			break

	if all_done:
		EventBus.stage_completed.emit()
