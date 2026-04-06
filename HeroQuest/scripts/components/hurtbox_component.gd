extends Area2D
class_name HurtboxComponent
## Receives damage from HitboxComponents.
## Attach to an Area2D node. Set collision layer to HeroHurtbox (6) or EnemyHurtbox (7).

signal damage_received(amount: int)

func receive_damage(amount: int) -> void:
	damage_received.emit(amount)
