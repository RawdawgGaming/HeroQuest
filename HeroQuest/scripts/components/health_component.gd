extends Node
class_name HealthComponent
## Manages health, damage, healing, and death for any entity.
## Automatically finds a sibling StatsComponent on the same parent.

var stats: StatsComponent
var current_health: int

signal health_changed(current: int, maximum: int)
signal died

func _ready() -> void:
	# Find the StatsComponent sibling
	stats = get_parent().get_node("StatsComponent") as StatsComponent
	if stats:
		current_health = stats.max_health

func take_damage(amount: int) -> void:
	var actual_damage: int = max(amount - stats.defense, 1)
	current_health = max(current_health - actual_damage, 0)
	health_changed.emit(current_health, stats.max_health)
	if current_health <= 0:
		died.emit()

func heal(amount: int) -> void:
	current_health = min(current_health + amount, stats.max_health)
	health_changed.emit(current_health, stats.max_health)

func get_health_percent() -> float:
	if stats.max_health == 0:
		return 0.0
	return float(current_health) / float(stats.max_health)
