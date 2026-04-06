extends Control
## Main HUD. Displays hero health, gold, and XP.

@onready var health_bar: ProgressBar = $HealthBar
@onready var gold_label: Label = $GoldLabel

func _ready() -> void:
	EventBus.hero_health_changed.connect(_on_hero_health_changed)
	health_bar.value = 100

func _on_hero_health_changed(current: int, maximum: int) -> void:
	health_bar.max_value = maximum
	health_bar.value = current

func _process(_delta: float) -> void:
	gold_label.text = "Gold: %d" % GameManager.current_gold
