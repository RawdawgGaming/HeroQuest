extends Area2D
class_name HitboxComponent
## Deals damage to HurtboxComponents it overlaps with.
## Attach to an Area2D node. Set collision layer to HeroHitbox (4) or EnemyHitbox (5).

@export var damage: int = 10

func _ready() -> void:
	area_entered.connect(_on_area_entered)

func _on_area_entered(area: Area2D) -> void:
	if area is HurtboxComponent:
		area.receive_damage(damage)
