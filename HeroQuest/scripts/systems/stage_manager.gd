extends Node
## Manages a single stage: sets up waves, handles completion.

@onready var wave_spawner: Node = $"../WaveSpawner"
@onready var stage_complete_label: Label = $"../CanvasLayer/StageCompleteLabel"

func _ready() -> void:
	EventBus.stage_completed.connect(_on_stage_completed)
	if stage_complete_label:
		stage_complete_label.visible = false

func _on_stage_completed() -> void:
	GameManager.is_game_active = false
	if stage_complete_label:
		stage_complete_label.visible = true
