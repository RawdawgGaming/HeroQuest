extends EnemyState
## Enemy death. Plays animation, emits signal, then removes self.

const DEATH_DURATION := 0.5
var timer: float = 0.0

func enter() -> void:
	timer = DEATH_DURATION
	enemy.velocity = Vector2.ZERO
	enemy.modulate = Color(0.5, 0.5, 0.5, 0.7)

	# Disable all collision so it stops interacting
	enemy.set_collision_layer_value(3, false)

	# Disable hurtbox so it can't take more damage
	var hurtbox := enemy.get_node_or_null("HurtboxComponent") as Area2D
	if hurtbox:
		hurtbox.set_deferred("monitoring", false)
		hurtbox.set_deferred("monitorable", false)

	if enemy.has_node("AnimationPlayer"):
		var anim := enemy.get_node("AnimationPlayer") as AnimationPlayer
		if anim.has_animation("death"):
			anim.play("death")

	EventBus.enemy_died.emit(enemy)

func process_physics(delta: float) -> void:
	timer -= delta
	if timer <= 0:
		enemy.queue_free()
