extends ProgressBar
## Floating health bar for enemies. Attach as a child of an enemy node.
## Automatically connects to the sibling HealthComponent.

var health_comp: HealthComponent

func _ready() -> void:
	# Find HealthComponent on the parent entity
	health_comp = get_parent().get_node_or_null("HealthComponent") as HealthComponent
	if health_comp:
		health_comp.health_changed.connect(_on_health_changed)
		max_value = health_comp.stats.max_health
		value = health_comp.current_health

	# Hide until damaged
	visible = false

func _on_health_changed(current: int, maximum: int) -> void:
	max_value = maximum
	value = current
	visible = true

	if current <= 0:
		visible = false
